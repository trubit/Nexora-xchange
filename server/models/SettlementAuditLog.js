import mongoose from "mongoose";

/**
 * SettlementAuditLog — immutable event log for clearing & settlement actions.
 * Every state change on a ClearingRecord or SettlementBatch is appended here.
 * Entries are never deleted or modified.
 */
const SettlementAuditLogSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      enum: [
        "TRADE_RECEIVED",
        "CLEARING_STARTED",
        "VALIDATION_PASSED",
        "VALIDATION_FAILED",
        "TRADE_CLEARED",
        "BATCH_OPENED",
        "BATCH_CLOSED",
        "SETTLEMENT_STARTED",
        "SETTLEMENT_COMPLETED",
        "SETTLEMENT_FAILED",
        "RETRY_TRIGGERED",
        "MANUAL_OVERRIDE",
        "RECONCILIATION_STARTED",
        "RECONCILIATION_COMPLETED",
        "LEDGER_UPDATED",
      ],
      required: true,
      index: true,
    },

    clearingId:  { type: String, default: null, index: true },
    batchId:     { type: String, default: null, index: true },
    tradeId:     { type: String, default: null },
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    actor:       { type: String, default: "system" },
    description: { type: String, required: true },

    previousStatus: { type: String, default: null },
    newStatus:      { type: String, default: null },

    metadata:    { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

SettlementAuditLogSchema.index({ eventType: 1, createdAt: -1 });
SettlementAuditLogSchema.index({ clearingId: 1, createdAt: -1 });

export default mongoose.model("SettlementAuditLog", SettlementAuditLogSchema);
