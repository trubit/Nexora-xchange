import mongoose from "mongoose";

const legSchema = new mongoose.Schema({
  exchange:  { type: String, required: true },
  symbol:    { type: String, required: true },
  side:      { type: String, enum: ["buy", "sell"], required: true },
  price:     { type: Number, required: true },
  quantity:  { type: Number, required: true },
  feeRate:   { type: Number, default: 0 },
  feeCost:   { type: Number, default: 0 },
}, { _id: false });

const simulationSchema = new mongoose.Schema({
  executionTimeMs: Number,
  fillRate:        { type: Number, min: 0, max: 1 },
  actualProfit:    Number,
  slippage:        Number,
  status:          { type: String, enum: ["profitable", "breakeven", "loss", "failed"] },
  reason:          String,
}, { _id: false });

const marketConditionsSchema = new mongoose.Schema({
  volatility:  Number,
  liquidity:   Number,
  volume24h:   Number,
  trend:       { type: String, enum: ["bullish", "bearish", "sideways"] },
}, { _id: false });

const arbitrageOpportunitySchema = new mongoose.Schema(
  {
    opportunityId: { type: String, required: true, unique: true, index: true },
    symbol:        { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ["triangular", "cross_exchange", "statistical", "latency"],
      required: true,
    },
    status: {
      type: String,
      enum: ["detected", "analyzing", "simulated", "expired", "invalid"],
      default: "detected",
      index: true,
    },
    legs:                  [legSchema],
    spreadAbsolute:        { type: Number, required: true },
    spreadPercent:         { type: Number, required: true },
    estimatedGrossProfit:  { type: Number },
    estimatedTotalFees:    { type: Number },
    estimatedNetProfit:    { type: Number },
    estimatedNetProfitPct: { type: Number },
    executionCostUsd:      { type: Number },
    confidence:            { type: Number, min: 0, max: 1 },
    riskScore:             { type: Number, min: 0, max: 100 },
    simulation:            simulationSchema,
    marketConditions:      marketConditionsSchema,
    detectedAt:            { type: Date, default: Date.now, index: true },
    expiresAt:             { type: Date, index: true },
  },
  { timestamps: true },
);

arbitrageOpportunitySchema.index({ symbol: 1, detectedAt: -1 });
arbitrageOpportunitySchema.index({ status: 1, detectedAt: -1 });
arbitrageOpportunitySchema.index({ estimatedNetProfit: -1 });
arbitrageOpportunitySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
arbitrageOpportunitySchema.index({ type: 1, status: 1 });

export default mongoose.model("ArbitrageOpportunity", arbitrageOpportunitySchema);
