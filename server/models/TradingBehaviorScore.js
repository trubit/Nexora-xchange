import mongoose from "mongoose";

const tradingBehaviorScoreSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // Composite behavior score 0-100
    behaviorScore:   { type: Number, required: true, min: 0, max: 100 },
    riskTier: {
      type: String,
      enum: ["CONSERVATIVE", "MODERATE", "AGGRESSIVE", "SPECULATIVE", "EXTREME"],
      required: true,
    },

    // Trading patterns
    patterns: {
      avgHoldingPeriodMs:    { type: Number, default: 0 },
      tradeFrequencyPerDay:  { type: Number, default: 0 },
      preferredMarkets:      [String],
      orderTypeDistribution: {
        market: { type: Number, default: 0 },
        limit:  { type: Number, default: 0 },
        stop:   { type: Number, default: 0 },
      },
      avgLeverageUsed:       { type: Number, default: 1 },
      peakDrawdown:          { type: Number, default: 0 },
      recoveryRate:          { type: Number, default: 0 },
    },

    // Behavioral dimensions (each 0-100)
    dimensions: {
      consistency:      { type: Number, default: 50 },  // how consistent trading is
      discipline:       { type: Number, default: 50 },  // follows strategy, avoids revenge trading
      riskManagement:   { type: Number, default: 50 },  // stop losses, position sizing
      profitability:    { type: Number, default: 50 },  // P&L quality
      marketKnowledge:  { type: Number, default: 50 },  // trades in liquid markets
    },

    // Anomaly signals
    anomalies: [{
      type:        String,
      severity:    { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
      detectedAt:  Date,
      description: String,
    }],

    // Rolling windows
    windows: {
      score7d:   { type: Number, default: 0 },
      score30d:  { type: Number, default: 0 },
      score90d:  { type: Number, default: 0 },
    },

    computedAt:      { type: Date, default: Date.now },
    nextRecomputeAt: { type: Date },
  },
  { timestamps: true },
);

tradingBehaviorScoreSchema.index({ userId: 1, computedAt: -1 });
tradingBehaviorScoreSchema.index({ behaviorScore: -1 });
tradingBehaviorScoreSchema.index({ riskTier: 1 });

export default mongoose.model("TradingBehaviorScore", tradingBehaviorScoreSchema);
