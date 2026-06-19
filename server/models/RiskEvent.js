import mongoose from "mongoose";

const { Schema } = mongoose;

// Immutable audit log — every risk-engine decision is recorded here.
const riskEventSchema = new Schema(
  {
    user: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: true,
      index:    true,
    },

    type: {
      type: String,
      enum: [
        "velocity_breach",
        "ip_anomaly",
        "multiple_ips",
        "suspicious_trade",
        "rapid_withdrawal",
        "large_withdrawal",
        "failed_login",
        "auto_freeze",
        "manual_freeze",
        "manual_unfreeze",
      ],
      required: true,
    },

    severity: {
      type:    String,
      enum:    ["low", "medium", "high", "critical"],
      default: "medium",
    },

    // Score at the moment the event fired
    score: { type: Number, default: 0 },

    // Free-form context for the event
    details: Schema.Types.Mixed,

    // What the engine actually did
    action: {
      type:    String,
      enum:    ["none", "flagged", "frozen", "cooldown_set", "unfrozen"],
      default: "none",
    },

    ip: String,
    ua: String,
  },
  {
    timestamps: true,
  },
);

riskEventSchema.index({ createdAt: -1 });
riskEventSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("RiskEvent", riskEventSchema);
