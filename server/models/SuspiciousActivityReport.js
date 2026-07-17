import mongoose from "mongoose";

/**
 * SuspiciousActivityReport (SAR) — regulatory SAR filing record.
 * Filed with FinCEN or local FIU for suspicious transactions.
 */
const SuspiciousActivityReportSchema = new mongoose.Schema(
  {
    sarId:         { type: String, required: true, unique: true, index: true },
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    alertIds:      { type: [String], default: [] },
    activityType: {
      type: String,
      enum: ["STRUCTURING", "RAPID_TRADING", "LARGE_TRANSACTION", "SANCTIONS_HIT", "VELOCITY_BREACH", "OTHER"],
      required: true,
    },
    description:   { type: String, required: true },
    totalAmountUsd:{ type: Number, default: 0 },
    periodStart:   { type: Date, required: true },
    periodEnd:     { type: Date, required: true },
    status: {
      type: String,
      enum: ["draft", "under_review", "approved", "filed", "rejected"],
      default: "draft",
      index: true,
    },
    filedWith:     { type: String, default: null },
    referenceNumber:{ type: String, default: null },
    preparedBy:    { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedBy:    { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    filedAt:       { type: Date, default: null },
    metadata:      { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model("SuspiciousActivityReport", SuspiciousActivityReportSchema);
