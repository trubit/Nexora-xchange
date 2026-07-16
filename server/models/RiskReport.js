import mongoose from "mongoose";

const positionRiskSchema = new mongoose.Schema({
  symbol:          String,
  side:            { type: String, enum: ["long", "short", "neutral"] },
  notionalUsd:     Number,
  unrealizedPnl:   Number,
  exposurePct:     Number,
  var95:           Number,  // Value at Risk 95%
  var99:           Number,  // Value at Risk 99%
  beta:            Number,  // correlation to BTC
  liquidationRisk: { type: String, enum: ["NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"] },
}, { _id: false });

const riskReportSchema = new mongoose.Schema(
  {
    reportId:       { type: String, required: true, unique: true },
    userId:         { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    marketSymbol:   { type: String, index: true },
    reportType:     { type: String, enum: ["user", "market", "portfolio", "system"], required: true },

    // Composite risk score 0-100 (100 = highest risk)
    riskScore:      { type: Number, required: true, min: 0, max: 100 },
    riskLevel: {
      type: String,
      enum: ["MINIMAL", "LOW", "MODERATE", "HIGH", "CRITICAL"],
      required: true,
    },

    // Exposure metrics
    exposure: {
      totalNotionalUsd:    { type: Number, default: 0 },
      netExposureUsd:      { type: Number, default: 0 },
      grossExposureUsd:    { type: Number, default: 0 },
      concentrationRisk:   { type: Number, default: 0 },  // Herfindahl index 0-1
      leverageRatio:       { type: Number, default: 1 },
    },

    // Value at Risk
    var: {
      var95_1d:  { type: Number, default: 0 },
      var99_1d:  { type: Number, default: 0 },
      cvar95_1d: { type: Number, default: 0 },  // Conditional VaR (Expected Shortfall)
      cvar99_1d: { type: Number, default: 0 },
    },

    // Positions breakdown
    positions: [positionRiskSchema],

    // Heatmap data (JSON blob for portfolio risk visualization)
    heatmap: { type: mongoose.Schema.Types.Mixed },

    // Liquidity risk
    liquidityRisk: {
      score:          { type: Number, default: 0 },
      illiquidAssets: [String],
      avgBidAskSpread:{ type: Number, default: 0 },
      marketDepthUsd: { type: Number, default: 0 },
    },

    // Recommendations
    recommendations: [{ type: String }],
    alerts:          [{ level: String, message: String }],

    generatedAt:     { type: Date, default: Date.now },
    validUntil:      { type: Date },
  },
  { timestamps: true },
);

riskReportSchema.index({ userId: 1, reportType: 1, generatedAt: -1 });
riskReportSchema.index({ marketSymbol: 1, reportType: 1, generatedAt: -1 });
riskReportSchema.index({ riskScore: -1 });
riskReportSchema.index({ riskLevel: 1 });
riskReportSchema.index({ validUntil: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("RiskReport", riskReportSchema);
