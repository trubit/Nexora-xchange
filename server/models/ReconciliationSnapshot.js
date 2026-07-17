import mongoose from "mongoose";

/**
 * ReconciliationSnapshot — internal ledger vs external records reconciliation.
 *
 * Produced by the reconciliation engine to confirm that:
 *   - Ledger entries match settlement records
 *   - No double-spend or missing credit
 *   - Outstanding balance matches on-chain balances
 */
const DiscrepancySchema = new mongoose.Schema(
  {
    type:        { type: String },
    asset:       { type: String },
    expected:    { type: Number },
    actual:      { type: Number },
    diff:        { type: Number },
    relatedId:   { type: String },
    description: { type: String },
  },
  { _id: false }
);

const ReconciliationSnapshotSchema = new mongoose.Schema(
  {
    snapshotId:   { type: String, required: true, unique: true, index: true },
    type:         { type: String, enum: ["DAILY", "FULL", "SPOT"], required: true },
    asOf:         { type: Date, required: true },
    status:       { type: String, enum: ["clean", "discrepant", "pending"], default: "pending" },
    discrepancies:{ type: [DiscrepancySchema], default: [] },
    totalChecked: { type: Number, default: 0 },
    totalMatched: { type: Number, default: 0 },
    totalMismatch:{ type: Number, default: 0 },
    resolvedAt:   { type: Date, default: null },
    metadata:     { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model("ReconciliationSnapshot", ReconciliationSnapshotSchema);
