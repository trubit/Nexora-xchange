import mongoose from "mongoose";

/**
 * CrossBorderPayment — tracks cross-border payment flows through the ecosystem.
 * status: initiated → processing → completed | failed | refunded
 * rail: SWIFT | SEPA | RippleNet | Stellar | CIPS | ACH | internal
 */
const CrossBorderPaymentSchema = new mongoose.Schema(
  {
    paymentId:     { type: String, required: true, unique: true, index: true },
    fromUserId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    fromPartnerId: { type: String, default: null },
    toPartnerId:   { type: String, default: null },
    sourceCurrency:{ type: String, required: true },
    targetCurrency:{ type: String, required: true },
    sourceAmount:  { type: Number, required: true },
    targetAmount:  { type: Number, required: true },
    exchangeRate:  { type: Number, required: true },
    feeAmount:     { type: Number, default: 0 },
    rail: {
      type: String,
      enum: ["SWIFT", "SEPA", "RippleNet", "Stellar", "CIPS", "ACH", "internal"],
      default: "internal",
    },
    status: {
      type: String,
      enum: ["initiated", "processing", "completed", "failed", "refunded"],
      default: "initiated",
      index: true,
    },
    completedAt:   { type: Date, default: null },
    metadata:      { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model("CrossBorderPayment", CrossBorderPaymentSchema);
