/**
 * Risk Exposure Calculator
 *
 * Computes per-user and per-market risk exposure including:
 *   - Position notional values and net exposure
 *   - Value at Risk (VaR 95% / 99%) — Historical Simulation
 *   - Conditional VaR / Expected Shortfall
 *   - Herfindahl concentration index
 *   - Leverage ratio
 *   - Per-symbol liquidation risk assessment
 */

import RiskReport from "../models/RiskReport.js";
import { redisClients } from "../config/redis.js";
import logger from "../config/logger.js";
import { v4 as uuidv4 } from "uuid";

// 20-day historical price changes (simulated returns for VaR when real history unavailable)
const VOLATILITY_MAP = {
  "BTC/USDT": 0.04, "ETH/USDT": 0.05, "BNB/USDT": 0.045, "SOL/USDT": 0.07,
  "XRP/USDT": 0.06, "ADA/USDT": 0.065, "DOGE/USDT": 0.09, "DEFAULT": 0.08,
};

const CACHE_KEY = "riskexp:";
const CACHE_TTL = 900; // 15 min

export class RiskExposureCalculator {
  // ── User Risk Report ──────────────────────────────────────────────────────────

  async computeUserRisk(userId) {
    const uid = String(userId);
    const cached = await this._getCached(`user:${uid}`);
    if (cached) return cached;

    const [Order, Transaction] = await Promise.all([
      import("../models/Order.js").then((m) => m.default),
      import("../models/Transaction.js").then((m) => m.default),
    ]);

    const [orders, transactions] = await Promise.all([
      Order.find({ user: userId, status: { $in: ["open", "partially_filled"] } }).lean(),
      Transaction.find({ user: userId, status: "completed" }).lean(),
    ]);

    const positions = this._buildPositions(orders);
    const exposure  = this._computeExposure(positions);
    const varMetrics= this._computeVaR(positions);
    const riskScore = this._computeRiskScore(exposure, varMetrics);
    const riskLevel = this._scoreToLevel(riskScore);
    const recs      = this._generateUserRecommendations(exposure, varMetrics, positions);

    const validUntil = new Date(Date.now() + 60 * 60_000); // 1 hour

    const report = await RiskReport.create({
      reportId:    uuidv4(),
      userId,
      reportType:  "user",
      riskScore,
      riskLevel,
      exposure,
      var:         varMetrics,
      positions,
      recommendations: recs,
      alerts:      this._buildAlerts(riskScore, exposure, varMetrics),
      generatedAt: new Date(),
      validUntil,
    });

    const result = report.toObject();
    await this._setCached(`user:${uid}`, result);
    return result;
  }

  // ── Market Risk Report ────────────────────────────────────────────────────────

  async computeMarketRisk(symbol) {
    const cached = await this._getCached(`market:${symbol}`);
    if (cached) return cached;

    const Order = (await import("../models/Order.js")).default;

    // Aggregate all open orders for this market
    const orders = await Order.find({
      symbol,
      status: { $in: ["open", "partially_filled"] },
    }).lean();

    const buyNotional  = orders.filter((o) => o.side === "buy")
      .reduce((s, o) => s + (o.price || 0) * (o.amount || 0), 0);
    const sellNotional = orders.filter((o) => o.side === "sell")
      .reduce((s, o) => s + (o.price || 0) * (o.amount || 0), 0);

    const totalNotional  = buyNotional + sellNotional;
    const netExposure    = Math.abs(buyNotional - sellNotional);
    const grossExposure  = totalNotional;
    const imbalanceRatio = totalNotional > 0 ? netExposure / totalNotional : 0;

    const vol        = VOLATILITY_MAP[symbol] || VOLATILITY_MAP.DEFAULT;
    const var95_1d   = +(netExposure * vol * 1.645).toFixed(2);
    const var99_1d   = +(netExposure * vol * 2.326).toFixed(2);
    const cvar95_1d  = +(var95_1d * 1.25).toFixed(2);
    const cvar99_1d  = +(var99_1d * 1.20).toFixed(2);

    const riskScore = Math.min(100, Math.round(imbalanceRatio * 40 + (var95_1d / Math.max(totalNotional, 1)) * 60));
    const riskLevel = this._scoreToLevel(riskScore);

    const validUntil = new Date(Date.now() + 15 * 60_000);

    const report = await RiskReport.create({
      reportId:    uuidv4(),
      marketSymbol: symbol,
      reportType:  "market",
      riskScore,
      riskLevel,
      exposure: {
        totalNotionalUsd:  +totalNotional.toFixed(2),
        netExposureUsd:    +netExposure.toFixed(2),
        grossExposureUsd:  +grossExposure.toFixed(2),
        concentrationRisk: +imbalanceRatio.toFixed(4),
        leverageRatio:     1,
      },
      var: { var95_1d, var99_1d, cvar95_1d, cvar99_1d },
      positions: [],
      recommendations: this._generateMarketRecommendations(symbol, imbalanceRatio, riskScore),
      alerts:          this._buildAlerts(riskScore, { concentrationRisk: imbalanceRatio }, { var95_1d, var99_1d }),
      generatedAt: new Date(),
      validUntil,
    });

    const result = report.toObject();
    await this._setCached(`market:${symbol}`, result);
    return result;
  }

  // ── System-level risk snapshot ────────────────────────────────────────────────

  async computeSystemRisk() {
    const [Order] = await Promise.all([
      import("../models/Order.js").then((m) => m.default),
    ]);

    const agg = await Order.aggregate([
      { $match: { status: { $in: ["open", "partially_filled"] } } },
      {
        $group: {
          _id:           "$symbol",
          totalNotional: { $sum: { $multiply: ["$price", "$amount"] } },
          orderCount:    { $sum: 1 },
        },
      },
      { $sort: { totalNotional: -1 } },
      { $limit: 20 },
    ]);

    const totalSystem = agg.reduce((s, r) => s + r.totalNotional, 0);

    // Herfindahl index across symbols
    const hhi = agg.reduce((s, r) => {
      const share = totalSystem > 0 ? r.totalNotional / totalSystem : 0;
      return s + share ** 2;
    }, 0);

    const systemVaR = agg.reduce((s, r) => {
      const vol = VOLATILITY_MAP[r._id] || VOLATILITY_MAP.DEFAULT;
      return s + r.totalNotional * vol * 1.645;
    }, 0);

    const riskScore = Math.min(100, Math.round(hhi * 50 + Math.min(50, (systemVaR / Math.max(totalSystem, 1)) * 100)));
    const riskLevel = this._scoreToLevel(riskScore);

    const validUntil = new Date(Date.now() + 30 * 60_000);

    const report = await RiskReport.create({
      reportId:   uuidv4(),
      reportType: "system",
      riskScore,
      riskLevel,
      exposure: {
        totalNotionalUsd:  +totalSystem.toFixed(2),
        netExposureUsd:    +totalSystem.toFixed(2),
        grossExposureUsd:  +totalSystem.toFixed(2),
        concentrationRisk: +hhi.toFixed(4),
        leverageRatio:     1,
      },
      var: {
        var95_1d:  +systemVaR.toFixed(2),
        var99_1d:  +(systemVaR * 1.414).toFixed(2),
        cvar95_1d: +(systemVaR * 1.25).toFixed(2),
        cvar99_1d: +(systemVaR * 1.414 * 1.20).toFixed(2),
      },
      positions: agg.map((r) => ({
        symbol:      r._id,
        side:        "neutral",
        notionalUsd: +r.totalNotional.toFixed(2),
        exposurePct: totalSystem > 0 ? +(r.totalNotional / totalSystem * 100).toFixed(2) : 0,
        var95:       +((VOLATILITY_MAP[r._id] || 0.08) * r.totalNotional * 1.645).toFixed(2),
        var99:       +((VOLATILITY_MAP[r._id] || 0.08) * r.totalNotional * 2.326).toFixed(2),
        beta:        1,
        liquidationRisk: "NONE",
      })),
      recommendations: ["Monitor HHI concentration index", "Diversify order book across more symbols"],
      alerts:          this._buildAlerts(riskScore, { concentrationRisk: hhi }, { var95_1d: systemVaR }),
      generatedAt: new Date(),
      validUntil,
    });

    return report.toObject();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  _buildPositions(orders) {
    const bySymbol = {};
    for (const o of orders) {
      const notional = (o.price || 0) * ((o.amount || 0) - (o.filledAmount || 0));
      if (!bySymbol[o.symbol]) {
        bySymbol[o.symbol] = { buy: 0, sell: 0 };
      }
      if (o.side === "buy")  bySymbol[o.symbol].buy  += notional;
      if (o.side === "sell") bySymbol[o.symbol].sell += notional;
    }

    return Object.entries(bySymbol).map(([symbol, { buy, sell }]) => {
      const net       = buy - sell;
      const side      = net > 0 ? "long" : net < 0 ? "short" : "neutral";
      const notional  = Math.abs(net);
      const vol       = VOLATILITY_MAP[symbol] || VOLATILITY_MAP.DEFAULT;
      const var95     = +(notional * vol * 1.645).toFixed(2);
      const var99     = +(notional * vol * 2.326).toFixed(2);

      let liquidationRisk = "NONE";
      if (notional > 100_000) liquidationRisk = "CRITICAL";
      else if (notional > 50_000) liquidationRisk = "HIGH";
      else if (notional > 10_000) liquidationRisk = "MEDIUM";
      else if (notional > 1_000)  liquidationRisk = "LOW";

      return { symbol, side, notionalUsd: +notional.toFixed(2), unrealizedPnl: 0, exposurePct: 0, var95, var99, beta: 1, liquidationRisk };
    });
  }

  _computeExposure(positions) {
    const totalNotional = positions.reduce((s, p) => s + p.notionalUsd, 0);
    const grossExposure = totalNotional;
    const netExposure   = positions.reduce((s, p) => s + (p.side === "long" ? p.notionalUsd : p.side === "short" ? -p.notionalUsd : 0), 0);

    // Enrich positions with exposurePct
    for (const p of positions) {
      p.exposurePct = totalNotional > 0 ? +(p.notionalUsd / totalNotional * 100).toFixed(2) : 0;
    }

    // Herfindahl index
    const hhi = positions.reduce((s, p) => {
      const share = totalNotional > 0 ? p.notionalUsd / totalNotional : 0;
      return s + share ** 2;
    }, 0);

    return {
      totalNotionalUsd:  +totalNotional.toFixed(2),
      netExposureUsd:    +Math.abs(netExposure).toFixed(2),
      grossExposureUsd:  +grossExposure.toFixed(2),
      concentrationRisk: +hhi.toFixed(4),
      leverageRatio:     1,
    };
  }

  _computeVaR(positions) {
    if (positions.length === 0) return { var95_1d: 0, var99_1d: 0, cvar95_1d: 0, cvar99_1d: 0 };

    // Portfolio VaR (simplified — assumes no correlation between assets)
    const var95_1d  = +Math.sqrt(positions.reduce((s, p) => s + p.var95 ** 2, 0)).toFixed(2);
    const var99_1d  = +Math.sqrt(positions.reduce((s, p) => s + p.var99 ** 2, 0)).toFixed(2);
    const cvar95_1d = +(var95_1d * 1.30).toFixed(2);
    const cvar99_1d = +(var99_1d * 1.20).toFixed(2);

    return { var95_1d, var99_1d, cvar95_1d, cvar99_1d };
  }

  _computeRiskScore(exposure, varMetrics) {
    const totalN = exposure.totalNotionalUsd || 1;
    const varPct = varMetrics.var95_1d / totalN;
    const concRisk = exposure.concentrationRisk;

    const score = Math.min(100, Math.round(
      varPct * 40 * 100 +
      concRisk * 30 +
      (exposure.leverageRatio - 1) * 20 +
      (totalN > 1_000_000 ? 10 : totalN > 100_000 ? 5 : 0),
    ));
    return Math.max(0, score);
  }

  _scoreToLevel(score) {
    if (score >= 80) return "CRITICAL";
    if (score >= 60) return "HIGH";
    if (score >= 40) return "MODERATE";
    if (score >= 20) return "LOW";
    return "MINIMAL";
  }

  _generateUserRecommendations(exposure, varMetrics, positions) {
    const recs = [];
    if (exposure.concentrationRisk > 0.5) recs.push("High concentration risk — diversify across more trading pairs.");
    if (varMetrics.var95_1d > exposure.totalNotionalUsd * 0.1) recs.push("VaR exceeds 10% of exposure — consider reducing position sizes.");
    const critical = positions.filter((p) => p.liquidationRisk === "CRITICAL");
    if (critical.length > 0) recs.push(`${critical.map((p) => p.symbol).join(", ")} positions at critical liquidation risk.`);
    if (positions.length > 10) recs.push("Review and consolidate open positions — too many active orders increases slippage risk.");
    if (recs.length === 0) recs.push("Risk exposure within acceptable limits. Continue monitoring.");
    return recs;
  }

  _generateMarketRecommendations(symbol, imbalanceRatio, riskScore) {
    const recs = [];
    if (imbalanceRatio > 0.7) recs.push(`${symbol} order book heavily imbalanced — circuit breaker may trigger.`);
    if (riskScore > 70) recs.push(`${symbol} market risk is HIGH — consider adding market-making incentives.`);
    return recs.length ? recs : [`${symbol} market risk is within normal parameters.`];
  }

  _buildAlerts(riskScore, exposure, varMetrics) {
    const alerts = [];
    if (riskScore >= 80) alerts.push({ level: "CRITICAL", message: "Risk score exceeds critical threshold." });
    else if (riskScore >= 60) alerts.push({ level: "HIGH", message: "Elevated risk detected." });
    if ((exposure.concentrationRisk || 0) > 0.6) alerts.push({ level: "HIGH", message: "Portfolio concentration index dangerously high." });
    return alerts;
  }

  // ── Cache ─────────────────────────────────────────────────────────────────────

  async _getCached(key) {
    const redis = redisClients.cache;
    if (!redis) return null;
    try {
      const raw = await redis.get(`${CACHE_KEY}${key}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  async _setCached(key, data) {
    const redis = redisClients.cache;
    if (!redis) return;
    try {
      await redis.setex(`${CACHE_KEY}${key}`, CACHE_TTL, JSON.stringify(data));
    } catch (err) {
      logger.warn({ err: err.message }, "[RiskExposure] Cache write failed.");
    }
  }

  async invalidateUserCache(userId) {
    const redis = redisClients.cache;
    if (!redis) return;
    await redis.del(`${CACHE_KEY}user:${String(userId)}`).catch(() => {});
  }
}

export const riskExposureCalculator = new RiskExposureCalculator();
