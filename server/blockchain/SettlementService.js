/**
 * SettlementService — main orchestrator for the blockchain settlement layer.
 *
 * Startup sequence (all guarded by BLOCKCHAIN_ENABLED env flag):
 *   1. ChainRegistry.init()     — connect to configured chains
 *   2. NodeListener.start()     — begin block polling
 *   3. DepositDetector.start()  — subscribe to block events, watch deposit addresses
 *   4. WithdrawalEngine.start() — begin polling the withdrawal queue
 *
 * Public API (called by blockchainController):
 *   getOrAssignDepositAddress(userId, asset, network)  → BlockchainDeposit doc
 *   queueWithdrawal(userId, { asset, amount, address, network })  → WithdrawalQueue doc
 *   status()                                            → system health snapshot
 *
 * Internal ledger rules:
 *   - Deposits: walletService.deposit() is the only place that credits a user.
 *   - Withdrawals: walletService.requestWithdrawal() locks funds; the engine
 *     confirms or reverts those locks after on-chain settlement.
 */

import { BLOCKCHAIN_ENABLED, resolveChain } from "./config/chains.js";
import { ChainRegistry }   from "./ChainRegistry.js";
import { NodeListener }    from "./NodeListener.js";
import { DepositDetector } from "./DepositDetector.js";
import { WithdrawalEngine } from "./WithdrawalEngine.js";
import BlockchainDeposit   from "../models/BlockchainDeposit.js";
import WithdrawalQueue     from "../models/WithdrawalQueue.js";
import { requestWithdrawal as ledgerWithdrawal } from "../services/walletService.js";
import logger from "../config/logger.js";

class SettlementServiceClass {
  constructor() {
    this._started = false;
    this._enabled = false;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  async start() {
    if (this._started) return;
    this._enabled = BLOCKCHAIN_ENABLED;

    if (!this._enabled) {
      logger.info("[SettlementService] BLOCKCHAIN_ENABLED=false — settlement layer inactive.");
      this._started = true;
      return;
    }

    logger.info("[SettlementService] Starting blockchain settlement layer...");

    try {
      await ChainRegistry.init();
    } catch (err) {
      logger.error({ err: err.message }, "[SettlementService] ChainRegistry init failed.");
    }

    try {
      await NodeListener.start();
    } catch (err) {
      logger.error({ err: err.message }, "[SettlementService] NodeListener failed to start.");
    }

    try {
      await DepositDetector.start();
    } catch (err) {
      logger.error({ err: err.message }, "[SettlementService] DepositDetector failed to start.");
    }

    try {
      WithdrawalEngine.start();
    } catch (err) {
      logger.error({ err: err.message }, "[SettlementService] WithdrawalEngine failed to start.");
    }

    this._started = true;
    logger.info("[SettlementService] Blockchain settlement layer running.");
  }

  async stop() {
    if (!this._started || !this._enabled) return;
    await Promise.allSettled([
      NodeListener.stop(),
      WithdrawalEngine.stop(),
    ]);
    logger.info("[SettlementService] Settlement layer stopped.");
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  /**
   * Returns an existing deposit address for userId+asset+network,
   * or creates a "shared hot-wallet" address using the chain's hot wallet.
   *
   * For production, swap the "shared" source for "hd" HD-derived addresses
   * once a HD derivation module is integrated.
   */
  async getOrAssignDepositAddress(userId, asset, network) {
    this._assertEnabled();
    asset   = String(asset).toUpperCase();
    network = String(network).toLowerCase();

    const chain = resolveChain(asset, network);
    if (!chain) {
      throw Object.assign(
        new Error(`No chain configured for asset=${asset} network=${network}`),
        { statusCode: 400 }
      );
    }

    // Idempotent upsert — one deposit address per (user, asset, chain)
    let doc = await BlockchainDeposit.findOne({
      user:  userId,
      asset,
      chain: chain.id,
    }).lean();

    if (!doc) {
      const address = chain.hotWallet;
      if (!address) {
        throw Object.assign(
          new Error(`Hot wallet not configured for chain ${chain.id}`),
          { statusCode: 503 }
        );
      }

      doc = await BlockchainDeposit.create({
        user:    userId,
        asset,
        chain:   chain.id,
        network,
        address,
        source:  "shared",
        active:  true,
      });

      DepositDetector.registerAddress(doc.toObject?.() ?? doc);
      logger.info(
        { userId, asset, chain: chain.id, address },
        "[SettlementService] Deposit address assigned."
      );
    }

    return doc;
  }

  /**
   * Locks funds via the internal ledger, then enqueues on-chain broadcast.
   *
   * @param {string} userId
   * @param {object} opts
   * @param {string} opts.asset
   * @param {number} opts.amount     — net amount user withdraws (before network fee)
   * @param {string} opts.address    — destination blockchain address
   * @param {string} opts.network
   */
  async queueWithdrawal(userId, { asset, amount, address, network }) {
    this._assertEnabled();
    asset   = String(asset).toUpperCase();
    network = String(network).toLowerCase();

    const chain = resolveChain(asset, network);
    if (!chain) {
      throw Object.assign(
        new Error(`No chain configured for asset=${asset} network=${network}`),
        { statusCode: 400 }
      );
    }

    const feeRate   = parseFloat(process.env[`CHAIN_${chain.prefix}_WITHDRAWAL_FEE`] ?? "0");
    const fee       = amount * feeRate;
    const gross     = amount + fee;

    // Lock funds in the internal ledger first
    const { transaction: internalTx } = await ledgerWithdrawal(userId, {
      asset,
      amount: gross,
      address,
      network,
    });

    // Enqueue on-chain broadcast
    const queueEntry = await WithdrawalQueue.create({
      userId:       userId,
      internalTxId: internalTx._id,
      asset,
      chain:        chain.id,
      network,
      toAddress:    address,
      amount,
      fee,
      grossAmount:  gross,
      status:       "pending",
      priority:     "normal",
      maxAttempts:  parseInt(process.env.BLOCKCHAIN_WITHDRAWAL_MAX_ATTEMPTS ?? "3", 10),
    });

    logger.info(
      { userId, asset, amount, address, chain: chain.id, queueId: queueEntry._id },
      "[SettlementService] Withdrawal queued."
    );

    return queueEntry;
  }

  /** System health snapshot for the /blockchain/status endpoint. */
  async status() {
    return {
      enabled:           this._enabled,
      started:           this._started,
      nodeListener:      NodeListener.isRunning,
      connectedChains:   ChainRegistry.connectedChains().map((c) => ({
        id:      c.id,
        type:    c.type,
        chainId: c.chainId ?? null,
      })),
      chainHealth:       await ChainRegistry.health(),
    };
  }

  // ── Internal ──────────────────────────────────────────────────────────────────

  _assertEnabled() {
    if (!this._enabled) {
      throw Object.assign(
        new Error("Blockchain settlement is not enabled (set BLOCKCHAIN_ENABLED=true)."),
        { statusCode: 503 }
      );
    }
  }
}

export const SettlementService = new SettlementServiceClass();
