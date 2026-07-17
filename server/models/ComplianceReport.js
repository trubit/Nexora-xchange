import mongoose from "mongoose";

/**
 * ComplianceReport — regulatory snapshot report.
 *
 * Generated periodically or on-demand for regulatory submission.
 * Immutable after finalization (status cannot revert from "finalized").
 */
const ComplianceReportSchema = new mongoose.Schema(
  {
    reportId:    { type: String, required: true, unique: true, index: true },
    type:        { type: String, enum: ["DAILY", "WEEKLY", "MONTHLY", "ON_DEMAND", "AUDIT"], required: true },
    periodStart: { type: Date, required: true },
    periodEnd:   { type: Date, required: true },
    status:      { type: String, enum: ["pending", "generating", "finalized", "submitted"], default: "pending" },
    summary: {
      totalEntries:   { type: Number, default: 0 },
      totalDeposits:  { type: Number, default: 0 },
      totalWithdrawals:{ type: Number, default: 0 },
      totalTrades:    { type: Number, default: 0 },
      totalFees:      { type: Number, default: 0 },
      uniqueUsers:    { type: Number, default: 0 },
    },
    chainHash:   { type: String, default: null },    // hash of last ledger entry in period
    signature:   { type: String, default: null },    // admin signature
    generatedBy: { type: String, default: "system" },
    submittedAt: { type: Date, default: null },
    metadata:    { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model("ComplianceReport", ComplianceReportSchema);
