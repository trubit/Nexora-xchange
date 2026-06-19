import mongoose from "mongoose";

const { Schema } = mongoose;

// One risk profile per user — the live, mutable risk state.
const riskProfileSchema = new Schema(
  {
    user: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: true,
      unique:   true,
      index:    true,
    },

    // ── Score & level ────────────────────────────────────────────────────────
    score: { type: Number, default: 0, min: 0, max: 100 },
    level: {
      type:    String,
      enum:    ["low", "medium", "high", "critical"],
      default: "low",
    },

    // ── Freeze state ─────────────────────────────────────────────────────────
    frozen:       { type: Boolean, default: false },
    frozenAt:     Date,
    frozenReason: String,
    frozenBy:     String, // "system" or admin userId

    // ── Active risk flags ─────────────────────────────────────────────────────
    // Each flag contributes weight to the score while active.
    flags: [
      {
        type:      { type: String, required: true },
        setAt:     { type: Date, default: Date.now },
        expiresAt: Date,   // null = permanent until admin clears
        details:   Schema.Types.Mixed,
      },
    ],

    // ── IP history (last 10 seen IPs) ─────────────────────────────────────────
    ipHistory: [
      {
        ip:     { type: String, required: true },
        seenAt: { type: Date, default: Date.now },
        ua:     String,
      },
    ],

    // ── Timestamps for cooldown calculations ─────────────────────────────────
    lastLoginAt:      Date,
    lastWithdrawalAt: Date,
    lastDepositAt:    Date,
    lastIpChangeAt:   Date,

    // ── Withdrawal cooldown ───────────────────────────────────────────────────
    withdrawalCooldownUntil:  Date,
    withdrawalCooldownReason: String,
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("RiskProfile", riskProfileSchema);
