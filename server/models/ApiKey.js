import mongoose from "mongoose";

const SCOPES = ["read", "trade", "withdraw", "admin"];

const ApiKeySchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    label:     { type: String, required: true, maxlength: 64 },
    // plaintext key is shown ONCE — only the SHA-256 hash is stored
    keyHash:   { type: String, required: true, unique: true, select: false },
    // first 12 chars shown in UI so user can identify keys
    prefix:    { type: String, required: true },
    scopes:    { type: [{ type: String, enum: SCOPES }], default: ["read"] },
    ipWhitelist: { type: [String], default: [] }, // empty = allow all
    expiresAt: { type: Date, default: null },
    lastUsedAt:{ type: Date, default: null },
    lastUsedIp:{ type: String, default: "" },
    usageCount:{ type: Number, default: 0 },
    isActive:  { type: Boolean, default: true, index: true },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: "" },
  },
  { timestamps: true, versionKey: false }
);

ApiKeySchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id?.toString(); delete ret._id;
    delete ret.keyHash; // never leak hash to client
  },
});

export const API_KEY_SCOPES = SCOPES;
export default mongoose.model("ApiKey", ApiKeySchema);
