import mongoose from "mongoose";

/**
 * LiquidityProvider — registered external liquidity source.
 *
 * Each provider exposes a subset of trading pairs and has
 * configurable fee tiers and health thresholds.
 */
const LiquidityProviderSchema = new mongoose.Schema(
  {
    name:       { type: String, required: true, unique: true, index: true },
    type:       { type: String, enum: ["cex", "dex", "internal", "institutional"], required: true },
    apiEndpoint:{ type: String, default: "" },
    apiKey:     { type: String, select: false, default: "" },      // never returned in queries
    pairs:      { type: [String], default: [] },                   // supported trading pairs
    feeTierPct: { type: Number, default: 0.001, min: 0, max: 0.05 },
    maxDepthUsd:{ type: Number, default: 500000 },
    priority:   { type: Number, default: 5, min: 1, max: 10 },     // lower = higher priority
    enabled:    { type: Boolean, default: true, index: true },
    healthy:    { type: Boolean, default: true },
    lastPingAt: { type: Date, default: null },
    failCount:  { type: Number, default: 0 },
    metadata:   { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model("LiquidityProvider", LiquidityProviderSchema);
