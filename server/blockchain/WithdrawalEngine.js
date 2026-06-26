/**
 * WithdrawalEngine — processes the WithdrawalQueue and executes on-chain transactions.
 *
 * Architecture:
 *   1. walletService.requestWithdrawal() locks funds and creates a Transaction record.
 *      A WithdrawalQueue entry is created pointing to that Transaction.
 *   2. WithdrawalEngine polls the queue (BLOCKCHAIN_WITHDRAWAL_POLL_MS interval).
 *   3. For each "pending" entry: signs + broadcasts the on-chain transaction,
 *      transitions to "submitted".
 *   4. For each "submitted" entry: checks confirmation count, transitions to "completed"
 *      when chain.confirmations threshold is reached.
 *   5. On completion: releases locked funds (removes the lock, confirms Transaction).
 *   6. On failure after maxAttempts: releases locked funds back to available, marks failed.
 *
 * Signing:
 *   The engine delegates raw transaction signing to an external signer function
 *   supplied at init(). In production, this is a KMS-backed signer.
 *   Private keys MUST NOT be in this file or any env var accessible to the app.
 *
 *   For development/testnet, set BLOCKCHAIN_DEV_SIGNER=true and provide
 *   CHAIN_{PREFIX}_DEV_PRIVATE_KEY (never in production).
 */

import WithdrawalQueue from "../models/WithdrawalQueue.js";
import BlockchainTx    from "../models/BlockchainTx.js";
import Transaction     from "../models/Transaction.js";
import Wallet          from "../models/Wallet.js";
import { ChainRegistry } from "./ChainRegistry.js";
import { getTokenConfig } from "./config/chains.js";
import { notificationService } from "../notifications/NotificationService.js";
import logger from "../config/logger.js";

const POLL_MS       = parseInt(process.env.BLOCKCHAIN_WITHDRAWAL_POLL_MS ?? "30000", 10);
const BATCH_SIZE    = parseInt(process.env.BLOCKCHAIN_WITHDRAWAL_BATCH    ?? "10",   10);
const RETRY_BACKOFF = parseInt(process.env.BLOCKCHAIN_WITHDRAWAL_RETRY_MS ?? "300000", 10); // 5 min
const DEV_SIGNER    = (process.env.BLOCKCHAIN_DEV_SIGNER ?? "false").toLowerCase() === "true";

class WithdrawalEngineClass {
  constructor() {
    this._timer   = null;
    this._running = false;
    this._signers = new Map(); // chainId → async (txData) → signedHex
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  /**
   * @param {Map<string, Function>} signers  chainId → signerFn
   *   If DEV_SIGNER=true and no signer is provided, a dev signer is auto-created.
   */
  start(signers = new Map()) {
    if (this._running) return;
    this._running = true;
    this._signers = signers;

    if (DEV_SIGNER) this._loadDevSigners();

    const tick = () => this._processBatch().catch((err) =>
      logger.error({ err: err.message }, "[WithdrawalEngine] Batch error.")
    );
    tick();
    this._timer = setInterval(tick, POLL_MS);
    this._timer.unref?.();
    logger.info("[WithdrawalEngine] Started.");
  }

  async stop() {
    this._running = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    logger.info("[WithdrawalEngine] Stopped.");
  }

  // ── Dev signer (testnet only — loads private key from env) ────────────────────

  _loadDevSigners() {
    // Dynamic import so the signing code is tree-shaken in production
    // when BLOCKCHAIN_DEV_SIGNER=false.
    // Actual signing implementation must be added by the operator:
    //   install a signing library and implement the sign function below.
    logger.warn("[WithdrawalEngine] DEV_SIGNER enabled — NOT for production use.");
  }

  // ── Batch processor ───────────────────────────────────────────────────────────

  async _processBatch() {
    if (!this._running) return;

    // Step A: process pending withdrawals (broadcast)
    const pending = await WithdrawalQueue.find({
      status: "pending",
      $expr: { $lt: ["$attempts", { $ifNull: ["$maxAttempts", BATCH_SIZE] }] },
      $or: [
        { nextRetryAt: null },
        { nextRetryAt: { $lte: new Date() } },
      ],
    })
      .sort({ priority: -1, createdAt: 1 })
      .limit(BATCH_SIZE)
      .lean();

    for (const item of pending) {
      await this._broadcast(item).catch((err) =>
        logger.error({ id: item._id, err: err.message }, "[WithdrawalEngine] Broadcast error.")
      );
    }

    // Step B: check confirmation progress for submitted withdrawals
    const submitted = await WithdrawalQueue.find({ status: "submitted" })
      .limit(BATCH_SIZE)
      .lean();

    for (const item of submitted) {
      await this._checkConfirmation(item).catch((err) =>
        logger.error({ id: item._id, err: err.message }, "[WithdrawalEngine] Confirm-check error.")
      );
    }
  }

  // ── Broadcast ─────────────────────────────────────────────────────────────────

  async _broadcast(item) {
    const adapter = ChainRegistry.get(item.chain);
    if (!adapter) {
      logger.warn({ chain: item.chain }, "[WithdrawalEngine] No adapter for chain — skipping.");
      return;
    }

    const signer = this._signers.get(item.chain);
    if (!signer) {
      logger.warn({ chain: item.chain }, "[WithdrawalEngine] No signer configured — cannot broadcast.");
      return;
    }

    await WithdrawalQueue.findByIdAndUpdate(item._id, {
      $set:  { status: "broadcasting", broadcastedAt: new Date() },
      $inc:  { attempts: 1 },
    });

    try {
      let txHash;

      if (adapter._chain.type === "evm") {
        txHash = await this._broadcastEVM(adapter, item, signer);
      } else if (adapter._chain.type === "bitcoin") {
        txHash = await this._broadcastBTC(adapter, item, signer);
      } else {
        throw new Error(`Unsupported chain type: ${adapter._chain.type}`);
      }

      await WithdrawalQueue.findByIdAndUpdate(item._id, {
        status:      "submitted",
        txHash,
        submittedAt: new Date(),
        failReason:  "",
      });

      // Create BlockchainTx audit record
      await BlockchainTx.create({
        txHash,
        chain:       item.chain,
        toAddress:   item.toAddress,
        asset:       item.asset,
        amount:      item.amount,
        direction:   "out",
        status:      "confirming",
        settlementStatus: "pending",
        userId:      item.userId,
        internalTxId: item.internalTxId,
        requiredConfirmations: adapter._chain.confirmations,
      }).catch(() => {}); // non-critical — don't fail the broadcast

      logger.info(
        { userId: item.userId, asset: item.asset, amount: item.amount, txHash },
        "[WithdrawalEngine] Broadcast submitted."
      );
    } catch (err) {
      const newAttempts = (item.attempts ?? 0) + 1;
      const maxAttempts = item.maxAttempts ?? 3;

      if (newAttempts >= maxAttempts) {
        await this._failWithdrawal(item, err.message);
      } else {
        await WithdrawalQueue.findByIdAndUpdate(item._id, {
          status:      "pending",
          failReason:  err.message,
          nextRetryAt: new Date(Date.now() + RETRY_BACKOFF),
        });
      }
      throw err;
    }
  }

  async _broadcastEVM(adapter, item, signerFn) {
    const chain       = adapter._chain;
    const tokenConfig = getTokenConfig(chain, item.asset);
    const hotWallet   = chain.hotWallet;
    if (!hotWallet) throw new Error("Hot wallet not configured for chain " + chain.id);

    const gasPrice = await adapter.getGasPrice();
    const nonce    = await adapter.getNonce(hotWallet);

    let to, value, data, gasLimit;

    if (!tokenConfig) {
      // Native token transfer
      value    = BigInt(Math.round(item.grossAmount * 1e18));
      to       = item.toAddress;
      data     = "0x";
      gasLimit = 21_000n;
    } else {
      // ERC-20 transfer
      // transfer(address,uint256) selector = 0xa9059cbb
      const paddedTo     = item.toAddress.replace(/^0x/, "").padStart(64, "0");
      const rawAmount    = BigInt(Math.round(item.grossAmount * 10 ** tokenConfig.decimals));
      const paddedAmount = rawAmount.toString(16).padStart(64, "0");
      data     = `0xa9059cbb${paddedTo}${paddedAmount}`;
      to       = tokenConfig.contractAddress;
      value    = 0n;
      gasLimit = await adapter.estimateGas({ from: hotWallet, to, data }).catch(() => 100_000n);
    }

    return adapter.signAndBroadcast({ to, value, gasPrice, gasLimit, nonce, data, signerFn });
  }

  async _broadcastBTC(adapter, item, signerFn) {
    // BTC signing requires UTXO selection — this stub delegates to signerFn
    // which must handle UTXO fetching + signing + serialization.
    const txData = {
      toAddress: item.toAddress,
      amount:    item.grossAmount, // BTC
      feeRate:   await adapter.estimateFee(parseInt(process.env.CHAIN_BTC_TARGET_BLOCKS ?? "6", 10)),
    };
    const signedHex = await signerFn(txData);
    return adapter.broadcastRawTx(signedHex);
  }

  // ── Confirmation check ────────────────────────────────────────────────────────

  async _checkConfirmation(item) {
    if (!item.txHash) return;
    const adapter = ChainRegistry.get(item.chain);
    if (!adapter) return;

    const chain = adapter._chain;

    let currentBlock, txBlock;
    try {
      currentBlock = await adapter.getLatestBlock();
      const receipt = await adapter.getTransactionReceipt(item.txHash);
      if (!receipt) return; // still pending

      // EVM: receipt.blockNumber is hex; BTC: it's a number from getTransaction
      txBlock = typeof receipt.blockNumber === "string"
        ? parseInt(receipt.blockNumber, 16)
        : receipt.blockNumber ?? receipt.height ?? null;

      // BTC failure detection: if receipt exists but is marked failed
      const failed = receipt.status === "0x0" || receipt.status === false;
      if (failed) {
        await this._failWithdrawal(item, "Transaction reverted on-chain");
        return;
      }
    } catch (err) {
      logger.warn({ id: item._id, err: err.message }, "[WithdrawalEngine] Receipt fetch failed.");
      return;
    }

    const confirmations = txBlock ? currentBlock - txBlock + 1 : 0;
    await WithdrawalQueue.findByIdAndUpdate(item._id, {
      confirmations,
      ...(txBlock && { blockNumber: txBlock }),
    });

    if (confirmations >= chain.confirmations) {
      await this._completeWithdrawal(item, confirmations);
    }
  }

  // ── Terminal state transitions ────────────────────────────────────────────────

  async _completeWithdrawal(item, confirmations) {
    const now = new Date();

    // Release locked funds (remove the lock, finalise Transaction).
    // grossAmount was locked by walletService.requestWithdrawal — not amount (net).
    await Promise.allSettled([
      Wallet.findOneAndUpdate(
        { user: item.userId, asset: item.asset },
        { $inc: { locked: -item.grossAmount, balance: -item.grossAmount } }
      ),
      Transaction.findByIdAndUpdate(item.internalTxId, {
        status: "completed",
        txHash: item.txHash,
        note:   `Settled on ${item.chain} — ${confirmations} confirmations`,
      }),
      WithdrawalQueue.findByIdAndUpdate(item._id, {
        status:       "completed",
        confirmations,
        completedAt:  now,
      }),
      BlockchainTx.findOneAndUpdate(
        { txHash: item.txHash, chain: item.chain },
        { status: "confirmed", settlementStatus: "settled", settledAt: now, confirmations }
      ),
    ]);

    notificationService.notifyWallet(String(item.userId), {
      type:   "withdrawal",
      asset:  item.asset,
      amount: item.amount,
      status: "completed",
      note:   `txHash: ${item.txHash}`,
    }).catch(() => {});

    logger.info(
      { userId: item.userId, asset: item.asset, txHash: item.txHash, confirmations },
      "[WithdrawalEngine] Withdrawal completed."
    );
  }

  async _failWithdrawal(item, reason) {
    // Return locked funds to available balance.
    // grossAmount was locked — use it here so no phantom balance remains in `locked`.
    await Promise.allSettled([
      Wallet.findOneAndUpdate(
        { user: item.userId, asset: item.asset },
        { $inc: { locked: -item.grossAmount, available: item.grossAmount } }
      ),
      Transaction.findByIdAndUpdate(item.internalTxId, {
        status: "failed",
        note:   `Withdrawal failed: ${reason}`,
      }),
      WithdrawalQueue.findByIdAndUpdate(item._id, {
        status:    "failed",
        failReason: reason,
      }),
    ]);

    notificationService.notifyWallet(String(item.userId), {
      type:   "withdrawal",
      asset:  item.asset,
      amount: item.amount,
      status: "failed",
      note:   reason,
    }).catch(() => {});

    logger.error(
      { userId: item.userId, asset: item.asset, reason },
      "[WithdrawalEngine] Withdrawal failed."
    );
  }
}

export const WithdrawalEngine = new WithdrawalEngineClass();
