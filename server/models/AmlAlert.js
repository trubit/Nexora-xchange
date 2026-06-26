import mongoose from "mongoose";

const AmlAlertSchema = new mongoose.Schema(
  {
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    userEmail:  { type: String, default: "" },
    alertType: {
      type: String,
      enum: [
        "large_transaction",   // single txn > $10k
        "velocity_breach",     // > $50k in 24h
        "rapid_trading",       // > 100 trades/hour
        "pattern_anomaly",     // unusual trading pattern
        "sanctions_hit",       // name/IP matches watchlist
        "structuring",         // multiple transactions just under threshold
      ],
      required: true, index: true,
    },
    status: {
      type: String,
      enum: ["open", "under_review", "cleared", "escalated", "frozen"],
      default: "open", index: true,
    },
    riskScore:   { type: Number, default: 0, min: 0, max: 100 },
    amountUsd:   { type: Number, default: 0 },
    description: { type: String, default: "" },
    metadata:    { type: mongoose.Schema.Types.Mixed, default: {} },
    // Admin review
    reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt:  { type: Date, default: null },
    reviewNotes: { type: String, default: "" },
    // Auto-freeze reference
    frozenAt:    { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

AmlAlertSchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret) => { ret.id = ret._id?.toString(); delete ret._id; },
});

export default mongoose.model("AmlAlert", AmlAlertSchema);
