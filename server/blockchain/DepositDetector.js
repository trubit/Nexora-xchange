/**
 * DepositDetector — listens to NodeListener block_range events,
 * scans for incoming transactions to watched addresses, and
 * credits the internal ledger exactly once per on-chain tx.
 *
 * Invariants:
 *   1. Idempotent: (txHash, chain) uniqueness index on BlockchainTx prevents
 *      double credits even if a block range is re-scanned.
 *   2. Internal ledger is primary: the Wallet balance is updated atomically
 *      inside walletService.deposit(), not here.
 *   3. Blockchain is settlement layer only: we only credit after
 *      `chain.confirmations` blocks have passed (NodeListener already filters this).
 *   4. Settlement failures are logged and retried on the next poll cycle;
 *      they never crash the listener.
 */

import BlockchainTx     from "../models/BlockchainTx.js";
import BlockchainDeposit from "../models/BlockchainDeposit.js";
import { NodeListener } from "./NodeListener.js";
import { deposit as ledgerDeposit } from "../services/walletService.js";
import { notificationService } from "../notifications/NotificationService.js";
import logger from "../config/logger.js";

const MIN_DEPOSIT = parseFloat(process.env.BLOCKCHAIN_MIN_DEPOSIT_USD ?? "0.01");

class DepositDetectorClass {
  constructor() {
    // chainId → Set<lowerAddress> — used ONLY for fast "is this address watched?" check.
    // Attribution (which user owns this address) is always resolved via a fresh DB query
    // in _settle() so that shared hot-wallet addresses don't silently overwrite each
    // other in an in-memory map.
    this._watchedByChain = new Map();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  async start() {
    await this._loadWatchedAddresses();
    NodeListener.on("block_range", (event) => this._onBlockRange(event));
    logger.info("[DepositDetector] Started — watching deposit addresses.");
  }

  // ── Watched address registry ──────────────────────────────────────────────────

  async _loadWatchedAddresses() {
    const all = await BlockchainDeposit.find({ active: true }).lean();
    for (const doc of all) {
      if (!this._watchedByChain.has(doc.chain)) {
        this._watchedByChain.set(doc.chain, new Set());
      }
      this._watchedByChain.get(doc.chain).add(doc.address.toLowerCase());
    }
    logger.info(
      { total: all.length },
      "[DepositDetector] Loaded watched deposit addresses."
    );
  }

  /** Register a new deposit address in the in-memory watch set. */
  registerAddress(depositDoc) {
    if (!this._watchedByChain.has(depositDoc.chain)) {
      this._watchedByChain.set(depositDoc.chain, new Set());
    }
    this._watchedByChain.get(depositDoc.chain).add(depositDoc.address.toLowerCase());
  }

  // ── Block range handler ───────────────────────────────────────────────────────

  async _onBlockRange({ chain, adapter, fromBlock, toBlock }) {
    const watched = this._watchedByChain.get(chain.id); // Set<address>
    if (!watched?.size) return;

    try {
      const deposits = await this._scanDeposits(chain, adapter, watched, fromBlock, toBlock);
      for (const dep of deposits) {
        await this._settle(dep, chain.id).catch((err) =>
          logger.error(
            { txHash: dep.txHash, err: err.message },
            "[DepositDetector] Settlement error."
          )
        );
      }
    } catch (err) {
      logger.error(
        { chain: chain.id, err: err.message },
        "[DepositDetector] Scan error."
      );
    }
  }

  async _scanDeposits(chain, adapter, addressSet, fromBlock, toBlock) {
    const results = [];

    if (chain.type === "evm") {
      // 1. Native asset deposits
      const native = await adapter.scanNativeDeposits(addressSet, fromBlock, toBlock);
      results.push(...native);

      // 2. ERC-20 token deposits
      const tokenContracts = Object.values(chain.tokens)
        .map((t) => t.contractAddress)
        .filter(Boolean);

      if (tokenContracts.length) {
        const tokens = await adapter.scanTokenDeposits(
          tokenContracts, addressSet, fromBlock, toBlock
        );
        results.push(...tokens);
      }
    } else if (chain.type === "bitcoin") {
      const native = await adapter.scanNativeDeposits(addressSet, fromBlock, toBlock);
      results.push(...native);
    }

    return results;
  }

  // ── Per-deposit settlement ────────────────────────────────────────────────────

  async _settle(dep, chainId) {
    // Always fetch from DB — never use the watch-map for attribution.
    // This ensures correctness even when multiple users share the same hot-wallet
    // address, because the in-memory map can only hold one entry per address.
    const depositRecord = await BlockchainDeposit.findOne({
      address: dep.toAddress.toLowerCase(),
      chain:   chainId,
      active:  true,
    }).lean();
    if (!depositRecord) return;

    // Guard: skip dust amounts
    if (dep.amount < MIN_DEPOSIT) {
      logger.debug(
        { txHash: dep.txHash, amount: dep.amount },
        "[DepositDetector] Dust deposit ignored."
      );
      return;
    }

    // Idempotent insert — unique index (txHash, chain) prevents double-credit
    let blockchainTx;
    try {
      blockchainTx = await BlockchainTx.create({
        txHash:       dep.txHash,
        chain:        depositRecord.chain,
        blockNumber:  dep.blockNumber,
        fromAddress:  dep.fromAddress,
        toAddress:    dep.toAddress,
        asset:        dep.asset,
        amount:       dep.amount,
        direction:    "in",
        status:       "confirmed",
        settlementStatus: "pending",
        userId:       depositRecord.user,
        depositAddressId: depositRecord._id,
        rawData:      dep.raw ?? {},
        requiredConfirmations: 0, // already confirmed by NodeListener
      });
    } catch (err) {
      if (err.code === 11000) {
        // Duplicate key — already processed
        logger.debug({ txHash: dep.txHash }, "[DepositDetector] Already settled — skipping.");
        return;
      }
      throw err;
    }

    // Credit the internal ledger
    try {
      const { transaction: internalTx } = await ledgerDeposit(
        String(depositRecord.user),
        { asset: dep.asset, amount: dep.amount }
      );

      await BlockchainTx.findByIdAndUpdate(blockchainTx._id, {
        settlementStatus: "settled",
        internalTxId:     internalTx._id,
        settledAt:        new Date(),
      });

      // Update cumulative stats on deposit address record
      await BlockchainDeposit.findByIdAndUpdate(depositRecord._id, {
        $inc:  { totalDeposited: dep.amount, depositCount: 1 },
        $set:  { lastDepositAt: new Date() },
      });

      // Push notification (best-effort)
      notificationService.notifyWallet(String(depositRecord.user), {
        type:   "deposit",
        asset:  dep.asset,
        amount: dep.amount,
        status: "completed",
        note:   `txHash: ${dep.txHash}`,
      }).catch(() => {});

      logger.info(
        { userId: depositRecord.user, asset: dep.asset, amount: dep.amount, txHash: dep.txHash },
        "[DepositDetector] Deposit settled."
      );
    } catch (err) {
      await BlockchainTx.findByIdAndUpdate(blockchainTx._id, {
        settlementStatus: "failed",
        failReason:       err.message,
      });
      throw err;
    }
  }
}

export const DepositDetector = new DepositDetectorClass();
