import mongoose from "mongoose";

/**
 * SettlementBatch — groups ClearingRecords for atomic settlement.
 * A batch is created on schedule (or manually) and processes all
 * cleared-but-unsettled records atomically.
 */
const SettlementBatchSchema = new mongoose.Schema(
  {
    batchId:      { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ["open", "processing", "completed", "partial", "failed"],
      default: "open",
      index: true,
    },

    recordCount:  { type: Number, default: 0 },
    settled:      { type: Number, default: 0 },
    failed:       { type: Number, default: 0 },

    totalVolume:  { type: Number, default: 0 },
    totalFees:    { type: Number, default: 0 },

    openedAt:     { type: Date, default: Date.now },
    closedAt:     { type: Date, default: null },
    processedAt:  { type: Date, default: null },

    initiatedBy:  { type: String, default: "system" },
    notes:        { type: String, default: null },
    metadata:     { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model("SettlementBatch", SettlementBatchSchema);
