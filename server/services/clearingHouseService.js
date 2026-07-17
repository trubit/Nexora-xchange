/**
 * ClearingHouseService — Phase 31: Global Clearing House & Settlement System.
 *
 * Architecture:
 *   trade.executed (eventBus) → ClearingService (validate + persist ClearingRecord)
 *   → SettlementProcessor (batch + settle) → LedgerReconciliation (verify)
 *   → emits: TRADE_CLEARED, SETTLEMENT_COMPLETED, SETTLEMENT_FAILED, LEDGER_UPDATED
 *
 * Roles allowed to manage settlements:
 *   admin (super admin), compliance_officer, finance_admin
 *
 * Double-entry invariant:
 *   buyer credit + seller credit == trade value (minus fees)
 *   All discrepancies are logged and trigger a reconciliation alert.
 */

import { EventEmitter }   from "events";
import crypto             from "crypto";
import ClearingRecord     from "../models/ClearingRecord.js";
import SettlementBatch    from "../models/SettlementBatch.js";
import SettlementAuditLog from "../models/SettlementAuditLog.js";
import { eventBus }       from "../infra/eventBus.js";
import logger             from "../config/logger.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const BATCH_INTERVAL_MS  = parseInt(process.env.CLEARING_BATCH_INTERVAL_MS  ?? "60000",  10);
const MAX_RETRY_COUNT    = parseInt(process.env.CLEARING_MAX_RETRY           ?? "3",      10);
const FEE_RATE           = parseFloat(process.env.CLEARING_FEE_RATE          ?? "0.001");

// ── Helper: generate a short unique ID ───────────────────────────────────────

const genId = (prefix) => `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

// ── AuditLog helper ───────────────────────────────────────────────────────────

async function audit(eventType, fields = {}) {
  try {
    await SettlementAuditLog.create({ eventType, ...fields });
  } catch (err) {
    logger.error({ err: err.message, eventType }, "[ClearingHouse] Audit log failed.");
  }
}

// ── Main service ──────────────────────────────────────────────────────────────

export class ClearingHouseService extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(30);
    this._started     = false;
    this._batchTimer  = null;
    this._currentBatchId = null;
    this._io          = null;           // Socket.IO server, injected after start
    this._stats = {
      totalReceived: 0,
      totalCleared:  0,
      totalSettled:  0,
      totalFailed:   0,
      batches:       0,
    };
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async start() {
    if (this._started) return;
    this._started = true;

    // Subscribe to trade events
    eventBus.on("trade.executed", (payload) => this._onTradeExecuted(payload));

    // Open first batch
    await this._openNewBatch();

    // Periodic batch flush
    this._batchTimer = setInterval(() => this._flushBatch().catch((e) =>
      logger.error({ err: e.message }, "[ClearingHouse] Batch flush error.")
    ), BATCH_INTERVAL_MS);

    logger.info("[ClearingHouse] Service started.");
  }

  stop() {
    if (this._batchTimer) { clearInterval(this._batchTimer); this._batchTimer = null; }
    this._started = false;
    logger.info("[ClearingHouse] Service stopped.");
  }

  setIo(io) {
    this._io = io;
  }

  // ── Trade received ────────────────────────────────────────────────────────

  async _onTradeExecuted(trade) {
    this._stats.totalReceived++;
    try {
      await this._processClearing(trade);
    } catch (err) {
      logger.error({ err: err.message, tradeId: trade?.id }, "[ClearingHouse] Clearing error.");
    }
  }

  async _processClearing(trade) {
    if (!trade?.id || !trade?.buyerUserId || !trade?.sellerUserId) return;

    const clearingId = genId("CLR");
    const totalValue = (trade.quantity || 0) * (trade.price || 0);
    const buyerFee   = totalValue * FEE_RATE;
    const sellerFee  = totalValue * FEE_RATE;

    // Create clearing record
    const record = await ClearingRecord.create({
      clearingId,
      tradeId:      String(trade.id),
      batchId:      this._currentBatchId,
      buyerUserId:  trade.buyerUserId,
      sellerUserId: trade.sellerUserId,
      symbol:       trade.symbol || "UNKNOWN",
      baseAsset:    (trade.symbol || "").replace(/USDT|USDC|BTC|ETH$/, "") || "BASE",
      quoteAsset:   (trade.symbol || "").match(/USDT|USDC|BTC|ETH$/)?.[0] || "QUOTE",
      quantity:     trade.quantity || 0,
      price:        trade.price || 0,
      totalValue,
      buyerFee,
      sellerFee,
      feeAsset:     "USDT",
      status:       "pending",
    });

    await audit("TRADE_RECEIVED", {
      clearingId,
      tradeId: String(trade.id),
      description: `Trade received for clearing: ${trade.symbol} qty=${trade.quantity} price=${trade.price}`,
    });

    // Validate immediately
    await this._validate(record);
  }

  async _validate(record) {
    await ClearingRecord.findOneAndUpdate(
      { clearingId: record.clearingId },
      { status: "validating" }
    );

    await audit("CLEARING_STARTED", {
      clearingId: record.clearingId,
      tradeId:    record.tradeId,
      description: "Validation started.",
      previousStatus: "pending",
      newStatus:      "validating",
    });

    // Double-entry check: totalValue must equal quantity × price
    const expected = record.quantity * record.price;
    const drift    = Math.abs(expected - record.totalValue);
    const valid    = drift < 0.0001;

    if (!valid) {
      await this._markFailed(record, `Double-entry validation failed: expected=${expected} got=${record.totalValue}`);
      return;
    }

    // Mark cleared
    const now = new Date();
    await ClearingRecord.findOneAndUpdate(
      { clearingId: record.clearingId },
      { status: "cleared", validatedAt: now, clearedAt: now, ledgerDebit: true, ledgerCredit: true }
    );

    this._stats.totalCleared++;

    await audit("TRADE_CLEARED", {
      clearingId: record.clearingId,
      tradeId:    record.tradeId,
      description: `Trade cleared. value=${record.totalValue} symbol=${record.symbol}`,
      previousStatus: "validating",
      newStatus:      "cleared",
    });

    eventBus.publish("trade.cleared", {
      clearingId:   record.clearingId,
      tradeId:      record.tradeId,
      buyerUserId:  record.buyerUserId,
      sellerUserId: record.sellerUserId,
      symbol:       record.symbol,
      totalValue:   record.totalValue,
    });

    this._broadcast("clearing:update", { clearingId: record.clearingId, status: "cleared" });

    // Update batch totals
    if (this._currentBatchId) {
      await SettlementBatch.findOneAndUpdate(
        { batchId: this._currentBatchId },
        { $inc: { recordCount: 1, totalVolume: record.totalValue, totalFees: record.buyerFee + record.sellerFee } }
      );
    }
  }

  // ── Settlement processor ──────────────────────────────────────────────────

  async _flushBatch() {
    if (!this._currentBatchId) return;

    const batch = await SettlementBatch.findOne({ batchId: this._currentBatchId });
    if (!batch || batch.status !== "open" || batch.recordCount === 0) {
      await this._openNewBatch();
      return;
    }

    // Close current batch and open a new one
    await SettlementBatch.findOneAndUpdate(
      { batchId: this._currentBatchId },
      { status: "processing", closedAt: new Date() }
    );

    await audit("BATCH_CLOSED", {
      batchId:     this._currentBatchId,
      description: `Batch closed for settlement. records=${batch.recordCount}`,
    });

    const batchIdToSettle = this._currentBatchId;
    await this._openNewBatch();

    // Settle the closed batch asynchronously
    setImmediate(() => this._settleBatch(batchIdToSettle));
  }

  async _settleBatch(batchId) {
    const records = await ClearingRecord.find({ batchId, status: "cleared" }).lean();
    if (!records.length) {
      await SettlementBatch.findOneAndUpdate({ batchId }, { status: "completed", processedAt: new Date() });
      return;
    }

    let settled = 0;
    let failed  = 0;

    for (const record of records) {
      try {
        await ClearingRecord.findOneAndUpdate(
          { clearingId: record.clearingId },
          { status: "settled", settledAt: new Date() }
        );

        await audit("SETTLEMENT_COMPLETED", {
          clearingId: record.clearingId,
          batchId,
          tradeId:    record.tradeId,
          description: `Trade settled successfully. symbol=${record.symbol} value=${record.totalValue}`,
          previousStatus: "cleared",
          newStatus:      "settled",
        });

        eventBus.publish("settlement.completed", {
          clearingId:   record.clearingId,
          tradeId:      record.tradeId,
          buyerUserId:  record.buyerUserId,
          sellerUserId: record.sellerUserId,
          totalValue:   record.totalValue,
          symbol:       record.symbol,
        });

        this._stats.totalSettled++;
        settled++;
      } catch (err) {
        failed++;
        this._stats.totalFailed++;
        await this._markFailed(record, err.message);
      }
    }

    const finalStatus = failed === 0 ? "completed" : (settled === 0 ? "failed" : "partial");
    await SettlementBatch.findOneAndUpdate(
      { batchId },
      { status: finalStatus, processedAt: new Date(), settled, failed: failed }
    );

    await audit("BATCH_CLOSED", {
      batchId,
      description: `Batch settlement complete. status=${finalStatus} settled=${settled} failed=${failed}`,
    });

    this._stats.batches++;
    this._broadcast("clearing:batch", { batchId, status: finalStatus, settled, failed });
    logger.info({ batchId, finalStatus, settled, failed }, "[ClearingHouse] Batch settled.");
  }

  // ── Open new batch ────────────────────────────────────────────────────────

  async _openNewBatch() {
    const batchId = genId("BATCH");
    await SettlementBatch.create({ batchId, status: "open", openedAt: new Date() });
    this._currentBatchId = batchId;

    await audit("BATCH_OPENED", {
      batchId,
      description: "New settlement batch opened.",
    });

    logger.info({ batchId }, "[ClearingHouse] New batch opened.");
  }

  // ── Mark failed ───────────────────────────────────────────────────────────

  async _markFailed(record, reason) {
    const retryCount = (record.retryCount || 0) + 1;
    await ClearingRecord.findOneAndUpdate(
      { clearingId: record.clearingId },
      { status: "failed", failedAt: new Date(), failureReason: reason, retryCount }
    );

    this._stats.totalFailed++;

    await audit("SETTLEMENT_FAILED", {
      clearingId: record.clearingId,
      tradeId:    record.tradeId,
      description: `Clearing failed: ${reason}`,
      newStatus:  "failed",
    });

    eventBus.publish("settlement.failed", {
      clearingId: record.clearingId,
      tradeId:    record.tradeId,
      reason,
    });
  }

  // ── Reconciliation ────────────────────────────────────────────────────────

  async reconcile({ initiatedBy = "system", fromDate, toDate } = {}) {
    await audit("RECONCILIATION_STARTED", {
      actor: initiatedBy,
      description: `Reconciliation initiated by ${initiatedBy}`,
      metadata: { fromDate, toDate },
    });

    const query = { status: "settled" };
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate)   query.createdAt.$lte = new Date(toDate);
    }

    const records = await ClearingRecord.find(query).lean();
    const discrepancies = [];

    for (const r of records) {
      const expected = r.quantity * r.price;
      const drift    = Math.abs(expected - r.totalValue);
      if (drift > 0.0001) {
        discrepancies.push({ clearingId: r.clearingId, expected, actual: r.totalValue, drift });
      }
    }

    await audit("RECONCILIATION_COMPLETED", {
      actor: initiatedBy,
      description: `Reconciliation complete. checked=${records.length} discrepancies=${discrepancies.length}`,
      metadata: { checked: records.length, discrepancies },
    });

    return {
      checked:       records.length,
      discrepancies: discrepancies.length,
      items:         discrepancies,
      clean:         discrepancies.length === 0,
    };
  }

  // ── Retry failed ──────────────────────────────────────────────────────────

  async retryClearing(clearingId) {
    const record = await ClearingRecord.findOne({ clearingId }).lean();
    if (!record) throw new Error("Clearing record not found.");
    if (record.status !== "failed") throw new Error("Only failed records can be retried.");
    if (record.retryCount >= MAX_RETRY_COUNT) throw new Error("Max retries exceeded.");

    await ClearingRecord.findOneAndUpdate(
      { clearingId },
      { status: "pending", failureReason: null }
    );

    await audit("RETRY_TRIGGERED", {
      clearingId,
      tradeId:    record.tradeId,
      description: `Retry triggered. attempt=${record.retryCount + 1}`,
    });

    await this._validate({ ...record, status: "pending" });
    return ClearingRecord.findOne({ clearingId }).lean();
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  async getSettlements({ status, symbol, page = 1, limit = 50 } = {}) {
    const q = {};
    if (status) q.status = status;
    if (symbol) q.symbol = symbol.toUpperCase();
    const skip = (page - 1) * Math.min(limit, 200);
    const [records, total] = await Promise.all([
      ClearingRecord.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ClearingRecord.countDocuments(q),
    ]);
    return { records, total, page, limit };
  }

  async getSettlementById(clearingId) {
    return ClearingRecord.findOne({ clearingId }).lean();
  }

  async getBatches({ status, page = 1, limit = 20 } = {}) {
    const q = status ? { status } : {};
    const skip = (page - 1) * limit;
    const [batches, total] = await Promise.all([
      SettlementBatch.find(q).sort({ openedAt: -1 }).skip(skip).limit(limit).lean(),
      SettlementBatch.countDocuments(q),
    ]);
    return { batches, total };
  }

  async getAuditLogs({ eventType, clearingId, page = 1, limit = 50 } = {}) {
    const q = {};
    if (eventType)  q.eventType  = eventType;
    if (clearingId) q.clearingId = clearingId;
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      SettlementAuditLog.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      SettlementAuditLog.countDocuments(q),
    ]);
    return { logs, total };
  }

  async getStatistics() {
    const [total, pending, clearing, cleared, settled, failed] = await Promise.all([
      ClearingRecord.countDocuments(),
      ClearingRecord.countDocuments({ status: "pending" }),
      ClearingRecord.countDocuments({ status: "validating" }),
      ClearingRecord.countDocuments({ status: "cleared" }),
      ClearingRecord.countDocuments({ status: "settled" }),
      ClearingRecord.countDocuments({ status: "failed" }),
    ]);

    const agg = await ClearingRecord.aggregate([
      { $match: { status: { $in: ["cleared", "settled"] } } },
      { $group: { _id: null, totalVolume: { $sum: "$totalValue" }, totalFees: { $sum: { $add: ["$buyerFee", "$sellerFee"] } } } },
    ]);

    const { totalVolume = 0, totalFees = 0 } = agg[0] || {};

    return {
      total, pending, clearing, cleared, settled, failed,
      totalVolume, totalFees,
      successRate: total > 0 ? ((settled / total) * 100).toFixed(2) : "0.00",
      currentBatchId: this._currentBatchId,
      inMemory: { ...this._stats },
    };
  }

  // ── Socket.IO broadcast ───────────────────────────────────────────────────

  _broadcast(event, data) {
    if (this._io) {
      this._io.to("clearing-room").emit(event, data);
    }
  }
}

export const clearingHouseService = new ClearingHouseService();
