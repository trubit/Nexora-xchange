import mongoose from "mongoose";

const RevokedTokenSchema = new mongoose.Schema({
  jti: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  reason: { type: String, default: "logout" },
  revokedAt: { type: Date, default: Date.now },
  // MongoDB TTL index: document is auto-deleted when the original token would
  // have expired anyway — keeps the collection small with no manual cleanup.
  expiresAt: { type: Date, required: true },
});

RevokedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("RevokedToken", RevokedTokenSchema);
