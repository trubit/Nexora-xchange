import mongoose from "mongoose";

/**
 * ApiKeyUsage — per-minute usage record for institutional API keys.
 *
 * Used for rate-limit enforcement, quota reporting, and billing.
 */
const ApiKeyUsageSchema = new mongoose.Schema(
  {
    apiKeyId:     { type: mongoose.Schema.Types.ObjectId, ref: "ApiKey", required: true, index: true },
    institutionId:{ type: mongoose.Schema.Types.ObjectId, ref: "InstitutionalClient", required: true, index: true },
    windowStart:  { type: Date, required: true },          // minute bucket start
    requests:     { type: Number, default: 0 },
    orders:       { type: Number, default: 0 },
    wsStreams:     { type: Number, default: 0 },
    bytesOut:     { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false }
);

ApiKeyUsageSchema.index({ apiKeyId: 1, windowStart: -1 });
ApiKeyUsageSchema.index({ institutionId: 1, windowStart: -1 });
// Auto-expire usage records after 90 days
ApiKeyUsageSchema.index({ windowStart: 1 }, { expireAfterSeconds: 7776000 });

export default mongoose.model("ApiKeyUsage", ApiKeyUsageSchema);
