/**
 * MultiChainSettlementService — cross-chain settlement abstraction layer.
 *
 * Sits above the low-level blockchain/ adapters and provides:
 *   - Unified settlement record creation and lifecycle management
 *   - Cross-chain finality tracking with confirmation counting
 *   - Settlement state machine (detected → confirming → finalized)
 *   - AML/risk flag injection
 *   - Internal ledger credit/debit coordination (walletService)
 *   - Reorg detection and rollback
 *
 * Architecture: internal ledger is ALWAYS the source of truth.
 * Blockchain is only the settlement layer that triggers ledger changes.
 */

import { EventEmitter } from "events";
import SettlementRecord   from "../models/SettlementRecord.js";
import BlockchainTx       from "../models/BlockchainTx.js";
import { CHAINS, BLOCKCHAIN_ENABLED } from "../blockchain/config/chains.js";
import logger             from "../config/logger.js";
import { redisClients }   from "../config/redis.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const CACHE_TTL    = 300;      // 5 min
const REORG_WINDOW = 20;       // blocks; if confirmations drop, assume reorg
const HIGH_VALUE_USD_THRESHOLD = parseFloat(process.env.SETTLEMENT_HIGH_VALUE_USD ?? "10000");

// ── Risk flag logic ───────────────────────────────────────────────────────────

function _computeRiskFlags({ amount, asset, fromAddress, direction }) {
  const flags = [];
  if (amount >= HIGH_VALUE_USD_THRESHOLD) flags.push("HIGH_VALUE");
  if (direction === "deposit" && fromAddress?.toLowerCase().startsWith("0x000")) flags.push("SUSPICIOUS_ORIGIN");
  if (["ETH", "BTC", "BNB"].includes(asset) && amount > 50) flags.push("WHALE_DEPOSIT");
  return flags;
}

// ── Main service ──────────────────────────────────────────────────────────────

export class MultiChainSettlementService extends EventEmitter {
  constructor() {
    super();
    this._started    = false;
    this._processingInterval = null;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  async start() {
    if (this._started || !BLOCKCHAIN_ENABLED) return;
    this._started = true;

    // Periodic scan for settlements stuck in "confirming"
    this._processingInterval = setInterval(
      () => this._processConfirmingSettlements().catch((err) =>
        logger.error({ err: err.message }, "[MCSS] Confirming scan error.")
      ),
      parseInt(process.env.SETTLEMENT_SCAN_MS ?? "30000", 10)
    );

    logger.info("[MCSS] Multi-chain settlement service started.");
  }

  stop() {
    if (this._processingInterval) {
      clearInterval(this._processingInterval);
      this._processingInterval = null;
    }
    this._started = false;
    logger.info("[MCSS] Multi-chain settlement service stopped.");
  }

  // ── Core public API ───────────────────────────────────────────────────────────

  /**
   * Record a newly detected on-chain transaction.
   * Called by DepositDetector / blockchainIndexerService.
   */
  async recordDetected({ chain, txHash, fromAddress, toAddress, asset,
    amount, networkFee = 0, contractAddress = "", direction,
    blockNumber, blockHash, userId = null, depositRecordId = null, rawReceipt = {} }) {

    const chainCfg = CHAINS[chain];
    if (!chainCfg) throw Object.assign(new Error(`Unknown chain: ${chain}`), { statusCode: 400 });

    const settlementId = `${chain}-${txHash}`;

    // Idempotent — skip if already recorded
    const existing = await SettlementRecord.findOne({ settlementId }).lean();
    if (existing) return existing;

    const riskFlags = _computeRiskFlags({ amount, asset, fromAddress, direction });

    const record = await SettlementRecord.create({
      settlementId,
      chain,
      chainType:             chainCfg.type,
      txHash,
      blockNumber:           blockNumber ?? null,
      blockHash:             blockHash ?? "",
      fromAddress:           fromAddress ?? "",
      toAddress,
      asset,
      amount,
      networkFee,
      contractAddress,
      direction,
      confirmations:         0,
      requiredConfirmations: chainCfg.confirmations,
      status:                "detected",
      userId,
      depositRecordId,
      riskFlags,
      rawReceipt,
    });

    logger.info({ settlementId, chain, asset, amount, direction }, "[MCSS] Settlement detected.");
    this.emit("detected", record.toObject());
    return record.toObject();
  }

  /**
   * Update confirmation count. Transitions to "confirming" or "finalized".
   */
  async updateConfirmations(settlementId, confirmations) {
    const record = await SettlementRecord.findOne({ settlementId });
    if (!record) return null;
    if (["finalized", "failed"].includes(record.status)) return record.toObject();

    // Reorg detection: confirmation count dropped significantly
    if (confirmations < record.confirmations - REORG_WINDOW) {
      record.status    = "reorged";
      record.reorgDepth = record.confirmations - confirmations;
      await record.save();
      logger.warn({ settlementId, prev: record.confirmations, now: confirmations }, "[MCSS] Reorg detected.");
      this.emit("reorged", record.toObject());
      return record.toObject();
    }

    record.confirmations = confirmations;
    if (record.status === "detected") record.status = "confirming";
    if (!record.confirmedAt && confirmations >= 1) record.confirmedAt = new Date();

    const isFinalized = confirmations >= record.requiredConfirmations;
    if (isFinalized) {
      record.status      = "finalized";
      record.finalizedAt = new Date();
    }

    await record.save();

    if (isFinalized) {
      logger.info({ settlementId, confirmations }, "[MCSS] Settlement finalized.");
      this.emit("finalized", record.toObject());
    }

    return record.toObject();
  }

  /**
   * Mark a settlement as failed.
   */
  async markFailed(settlementId, reason = "") {
    const record = await SettlementRecord.findOne({ settlementId });
    if (!record || record.status === "finalized") return null;
    record.status     = "failed";
    record.failReason = reason;
    await record.save();
    this.emit("failed", record.toObject());
    return record.toObject();
  }

  /**
   * Get settlement status by txHash + chain.
   */
  async getByTxHash(chain, txHash) {
    const cacheKey = `settlement:${chain}:${txHash}`;
    const redis    = redisClients.cache;
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch { /* skip */ }
    }

    const record = await SettlementRecord.findOne({ chain, txHash }).lean();
    if (record && redis) {
      try { await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(record)); } catch { /* skip */ }
    }
    return record;
  }

  /**
   * Get all settlements for a user.
   */
  async getUserSettlements(userId, { direction, status, limit = 50, skip = 0 } = {}) {
    const q = { userId };
    if (direction) q.direction = direction;
    if (status)    q.status    = status;
    return SettlementRecord.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  }

  /**
   * System-wide settlement statistics.
   */
  async getStats() {
    const [total, byStatus, byChain, pendingCount] = await Promise.all([
      SettlementRecord.countDocuments(),
      SettlementRecord.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      SettlementRecord.aggregate([{ $group: { _id: "$chain",  count: { $sum: 1 } } }]),
      SettlementRecord.countDocuments({ status: { $in: ["detected", "confirming"] } }),
    ]);

    return {
      total,
      pending: pendingCount,
      byStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.count])),
      byChain:  Object.fromEntries(byChain.map((c)  => [c._id, c.count])),
    };
  }

  /**
   * Get all pending settlements (detected or confirming).
   */
  async getPendingSettlements(chain = null) {
    const q = { status: { $in: ["detected", "confirming"] } };
    if (chain) q.chain = chain;
    return SettlementRecord.find(q).sort({ createdAt: 1 }).lean();
  }

  // ── Internal ──────────────────────────────────────────────────────────────────

  async _processConfirmingSettlements() {
    const records = await this.getPendingSettlements();
    if (!records.length) return;

    logger.debug({ count: records.length }, "[MCSS] Scanning confirming settlements.");

    for (const record of records) {
      // Re-fetch confirmation count from BlockchainTx model (populated by adapters)
      const btx = await BlockchainTx.findOne({ txHash: record.txHash, chain: record.chain })
        .select("confirmations status").lean();
      if (!btx) continue;

      if (btx.status === "failed") {
        await this.markFailed(record.settlementId, "on-chain tx failed");
        continue;
      }

      if (btx.confirmations !== record.confirmations) {
        await this.updateConfirmations(record.settlementId, btx.confirmations);
      }
    }
  }
}

export const multiChainSettlementService = new MultiChainSettlementService();
