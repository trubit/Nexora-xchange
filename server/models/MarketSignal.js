import mongoose from "mongoose";

/**
 * MarketSignal — output from the Market Intelligence Core.
 *
 * Represents a detected anomaly, trend change, or intelligence signal
 * that requires attention or triggers downstream actions.
 */
const MarketSignalSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "ANOMALY",           // generic statistical anomaly
        "WHALE_MOVE",        // large on-chain or exchange transfer
        "LIQUIDITY_IMBALANCE",// unusual bid/ask depth imbalance
        "MANIPULATION",      // suspected wash trading or spoofing
        "VOLATILITY_SPIKE",  // sudden price acceleration
        "TREND_REVERSAL",    // confirmed higher-timeframe reversal
        "CIRCUIT_BREAKER",   // price moved beyond circuit-breaker threshold
      ],
      required: true,
      index: true,
    },
    pair:        { type: String, required: true, index: true },
    severity:    { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], default: "MEDIUM" },
    confidence:  { type: Number, min: 0, max: 1, required: true },
    price:       { type: Number, default: null },
    volume:      { type: Number, default: null },
    direction:   { type: String, enum: ["up", "down", "neutral", null], default: null },
    description: { type: String, default: "" },
    metadata:    { type: mongoose.Schema.Types.Mixed, default: {} },
    resolvedAt:  { type: Date, default: null },
    acknowledged:{ type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false }
);

MarketSignalSchema.index({ pair: 1, createdAt: -1 });
MarketSignalSchema.index({ type: 1, severity: 1 });

export default mongoose.model("MarketSignal", MarketSignalSchema);
