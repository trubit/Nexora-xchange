import mongoose from "mongoose";
import crypto   from "crypto";

/**
 * Immutable audit log — append-only, no delete route ever.
 * Each entry stores a chained SHA-256 hash so tampering is detectable.
 */
const AuditLogSchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    userEmail: { type: String, default: "" },

    // ── What happened ────────────────────────────────────────────────
    category: {
      type: String,
      enum: ["auth", "trade", "wallet", "compliance", "admin", "security", "api"],
      required: true, index: true,
    },
    action: { type: String, required: true, index: true },
    // info → normal operations  warning → suspicious  critical → fraud/breach
    severity: {
      type: String,
      enum: ["info", "warning", "critical"],
      default: "info", index: true,
    },

    // ── Context ──────────────────────────────────────────────────────
    ip:        { type: String, default: "" },
    userAgent: { type: String, default: "" },
    sessionId: { type: String, default: "" },
    metadata:  { type: mongoose.Schema.Types.Mixed, default: {} },

    // ── Tamper-evidence chain ────────────────────────────────────────
    // SHA-256( prevHash + userId + action + timestamp + JSON(metadata) )
    prevHash: { type: String, default: "GENESIS" },
    hash:     { type: String, required: true, unique: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // no updates allowed
    versionKey: false,
  }
);

// Block all destructive operations at the model level
AuditLogSchema.pre(["updateOne","updateMany","findOneAndUpdate","findByIdAndUpdate","deleteOne","deleteMany","findOneAndDelete","findByIdAndDelete"], function () {
  throw new Error("AuditLog records are immutable — modifications are forbidden.");
});

// Static: compute next entry's hash
AuditLogSchema.statics.computeHash = function ({ prevHash, userId, action, timestamp, metadata }) {
  const payload = `${prevHash}|${userId}|${action}|${timestamp}|${JSON.stringify(metadata)}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
};

// Static: fetch the latest hash in the chain (for chaining new entries)
AuditLogSchema.statics.latestHash = async function (userId) {
  const last = await this.findOne({ userId }).sort({ _id: -1 }).select("hash").lean();
  return last?.hash ?? "GENESIS";
};

AuditLogSchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret) => { ret.id = ret._id?.toString(); delete ret._id; },
});

export default mongoose.model("AuditLog", AuditLogSchema);
