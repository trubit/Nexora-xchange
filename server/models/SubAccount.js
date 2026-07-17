import mongoose from "mongoose";

/**
 * SubAccount — institutional sub-account (trader seat within an institution).
 *
 * Each sub-account has its own API keys, rate limits, and position limits
 * inherited from (but bounded by) the parent InstitutionalClient.
 */
const SubAccountSchema = new mongoose.Schema(
  {
    institutionId: { type: mongoose.Schema.Types.ObjectId, ref: "InstitutionalClient", required: true, index: true },
    name:          { type: String, required: true },
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    enabled:       { type: Boolean, default: true },
    permissions:   { type: [String], default: ["trade", "read"] },
    maxOrderUsd:   { type: Number, default: 100_000 },
    maxPositionUsd:{ type: Number, default: 500_000 },
    notes:         { type: String, default: "" },
    metadata:      { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

SubAccountSchema.index({ institutionId: 1, name: 1 }, { unique: true });

export default mongoose.model("SubAccount", SubAccountSchema);
