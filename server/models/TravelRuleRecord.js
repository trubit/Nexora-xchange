import mongoose from "mongoose";

/**
 * TravelRuleRecord — FATF Travel Rule compliance record for VASP-to-VASP transfers.
 * Required for transfers ≥ $1,000 between VASPs.
 */
const TravelRuleRecordSchema = new mongoose.Schema(
  {
    recordId:       { type: String, required: true, unique: true, index: true },
    transactionId:  { type: String, required: true, index: true },
    asset:          { type: String, required: true },
    amount:         { type: Number, required: true },
    amountUsd:      { type: Number, required: true },

    originatorVasp:    { type: String, required: true },
    originatorName:    { type: String, required: true },
    originatorAddress: { type: String, default: null },
    originatorWallet:  { type: String, required: true },

    beneficiaryVasp:    { type: String, required: true },
    beneficiaryName:    { type: String, required: true },
    beneficiaryAddress: { type: String, default: null },
    beneficiaryWallet:  { type: String, required: true },

    status: {
      type: String,
      enum: ["pending", "sent", "received", "verified", "rejected", "failed"],
      default: "pending",
      index: true,
    },
    sentAt:     { type: Date, default: null },
    receivedAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },

    protocol:   { type: String, enum: ["TRP", "OpenVASP", "IVMS101"], default: "IVMS101" },
    messageId:  { type: String, default: null },
    metadata:   { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model("TravelRuleRecord", TravelRuleRecordSchema);
