import mongoose from "mongoose";

/**
 * VaultPolicy — withdrawal rules for a vault account.
 * Defines approval thresholds, daily limits, and time-lock requirements.
 */
const AssetLimitSchema = new mongoose.Schema(
  {
    asset:          { type: String, required: true },
    dailyLimitUsd:  { type: Number, default: 1000000 },
    singleTxLimitUsd:{ type: Number, default: 100000 },
  },
  { _id: false }
);

const VaultPolicySchema = new mongoose.Schema(
  {
    policyId:         { type: String, required: true, unique: true, index: true },
    name:             { type: String, required: true },
    tier:             { type: String, enum: ["cold", "warm", "hot"], required: true },
    requiredApprovals:{ type: Number, default: 1, min: 1, max: 10 },
    timeLockHours:    { type: Number, default: 0 },
    assetLimits:      { type: [AssetLimitSchema], default: [] },
    allowedDestinations:{ type: [String], default: [] },
    requiresHsm:      { type: Boolean, default: false },
    active:           { type: Boolean, default: true },
    metadata:         { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model("VaultPolicy", VaultPolicySchema);
