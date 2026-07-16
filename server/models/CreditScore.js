import mongoose from "mongoose";

const componentSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  score:       { type: Number, required: true, min: 0, max: 100 },
  weight:      { type: Number, required: true },
  rawValue:    mongoose.Schema.Types.Mixed,
  explanation: String,
}, { _id: false });

const creditScoreSchema = new mongoose.Schema(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // Overall composite score 0-1000 (like FICO)
    score:       { type: Number, required: true, min: 0, max: 1000, index: true },
    band: {
      type: String,
      enum: ["POOR", "FAIR", "GOOD", "VERY_GOOD", "EXCELLENT"],
      required: true,
    },

    // Component breakdown
    components:  [componentSchema],

    // Trading-specific dimensions
    tradingHistory: {
      totalTrades:        { type: Number, default: 0 },
      winRate:            { type: Number, default: 0 },
      avgTradeValueUsd:   { type: Number, default: 0 },
      profitLossRatio:    { type: Number, default: 0 },
      longestWinStreak:   { type: Number, default: 0 },
      longestLossStreak:  { type: Number, default: 0 },
    },

    // Account health
    accountHealth: {
      accountAgeDays:     { type: Number, default: 0 },
      kycVerified:        { type: Boolean, default: false },
      emailVerified:      { type: Boolean, default: false },
      depositHistory:     { type: Number, default: 0 },
      withdrawalHistory:  { type: Number, default: 0 },
      netDeposits:        { type: Number, default: 0 },
    },

    // Risk flags
    riskFlags: [{ type: String }],

    // Credit limit (how much the system will let them trade on margin)
    creditLimitUsd:   { type: Number, default: 0 },
    utilizationRate:  { type: Number, default: 0, min: 0, max: 1 },

    // Meta
    version:          { type: Number, default: 1 },
    computedAt:       { type: Date, default: Date.now },
    nextRecomputeAt:  { type: Date },
    isStale:          { type: Boolean, default: false },
  },
  { timestamps: true },
);

creditScoreSchema.index({ userId: 1, computedAt: -1 });
creditScoreSchema.index({ score: -1 });
creditScoreSchema.index({ band: 1 });
creditScoreSchema.index({ isStale: 1, nextRecomputeAt: 1 });

export default mongoose.model("CreditScore", creditScoreSchema);
