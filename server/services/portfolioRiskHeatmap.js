/**
 * Portfolio Risk Heatmap Generator
 *
 * Produces structured heatmap data for portfolio risk visualization:
 *   - 2D grid: symbols × risk dimensions
 *   - Per-cell heat values (0-100)
 *   - Aggregated row/column risk summaries
 *   - Top-risk positions sorted by composite heat
 *   - Cross-asset correlation signals
 *
 * Output is stored in the RiskReport.heatmap field (Mixed schema).
 */

import RiskReport from "../models/RiskReport.js";
import { redisClients } from "../config/redis.js";
import logger from "../config/logger.js";
import { v4 as uuidv4 } from "uuid";

// Daily volatility estimates per pair (used for heat scaling)
const VOL = {
  "BTC/USDT": 0.04, "ETH/USDT": 0.05, "BNB/USDT": 0.045,
  "SOL/USDT": 0.07, "XRP/USDT": 0.06, "ADA/USDT": 0.065,
  "DOGE/USDT": 0.09, "AVAX/USDT": 0.08, "MATIC/USDT": 0.08,
  DEFAULT: 0.08,
};

// Correlation matrix (BTC-centric; simplified)
const CORR = {
  "BTC/USDT": { "ETH/USDT": 0.75, "BNB/USDT": 0.65, "SOL/USDT": 0.60, "XRP/USDT": 0.50 },
  "ETH/USDT": { "BTC/USDT": 0.75, "BNB/USDT": 0.70, "SOL/USDT": 0.65, "ADA/USDT": 0.60 },
};

const DIMENSIONS = ["volatility", "concentration", "liquidity", "correlation", "drawdown"];

const CACHE_KEY = "heatmap:";
const CACHE_TTL = 1800;  // 30 min

export class PortfolioRiskHeatmap {
  // ── Per-user portfolio heatmap ────────────────────────────────────────────────

  async generateForUser(userId) {
    const uid = String(userId);
    const cached = await this._getCached(`user:${uid}`);
    if (cached) return cached;

    const Order = (await import("../models/Order.js")).default;
    const orders = await Order.find({
      user:   userId,
      status: { $in: ["open", "partially_filled"] },
    }).lean();

    const positions = this._aggregatePositions(orders);
    if (positions.length === 0) {
      const empty = this._emptyHeatmap(userId);
      await this._setCached(`user:${uid}`, empty);
      return empty;
    }

    const heatmap = this._buildHeatmap(positions);
    const report  = await this._saveReport(userId, heatmap, positions);
    const result  = report.toObject();
    await this._setCached(`user:${uid}`, result);
    return result;
  }

  // ── Aggregate open positions by symbol ───────────────────────────────────────

  _aggregatePositions(orders) {
    const bySymbol = {};
    for (const o of orders) {
      const qty      = (o.amount || 0) - (o.filledAmount || 0);
      const notional = qty * (o.price || 0);
      if (!bySymbol[o.symbol]) {
        bySymbol[o.symbol] = { symbol: o.symbol, longNotional: 0, shortNotional: 0, orderCount: 0 };
      }
      if (o.side === "buy")  bySymbol[o.symbol].longNotional  += notional;
      if (o.side === "sell") bySymbol[o.symbol].shortNotional += notional;
      bySymbol[o.symbol].orderCount++;
    }

    const list = Object.values(bySymbol);
    const totalNotional = list.reduce((s, p) => s + p.longNotional + p.shortNotional, 0);
    for (const p of list) {
      p.totalNotional = +(p.longNotional + p.shortNotional).toFixed(2);
      p.netNotional   = +(p.longNotional - p.shortNotional).toFixed(2);
      p.concentrationPct = totalNotional > 0 ? +(p.totalNotional / totalNotional * 100).toFixed(2) : 0;
    }
    return list;
  }

  // ── Build the heatmap grid ────────────────────────────────────────────────────

  _buildHeatmap(positions) {
    const totalNotional = positions.reduce((s, p) => s + p.totalNotional, 0);
    const symbols = positions.map((p) => p.symbol);

    // Build cells: rows = symbols, columns = dimensions
    const cells = [];
    for (const pos of positions) {
      const row = { symbol: pos.symbol, totalNotional: pos.totalNotional, scores: {} };

      row.scores.volatility    = this._volatilityHeat(pos);
      row.scores.concentration = this._concentrationHeat(pos, totalNotional);
      row.scores.liquidity     = this._liquidityHeat(pos);
      row.scores.correlation   = this._correlationHeat(pos, positions);
      row.scores.drawdown      = this._drawdownHeat(pos);
      row.compositeHeat        = this._compositeHeat(row.scores);

      cells.push(row);
    }

    // Sort hottest first
    cells.sort((a, b) => b.compositeHeat - a.compositeHeat);

    // Column summaries (average heat per dimension across all symbols)
    const columnSummary = {};
    for (const dim of DIMENSIONS) {
      const vals = cells.map((r) => r.scores[dim]);
      columnSummary[dim] = +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1);
    }

    // Row summary (top-3 hottest positions)
    const topRiskPositions = cells.slice(0, 3).map((c) => ({
      symbol:        c.symbol,
      compositeHeat: c.compositeHeat,
      hotDimension:  Object.entries(c.scores).sort((a, b) => b[1] - a[1])[0][0],
    }));

    const portfolioHeatScore = +(cells.reduce((s, c) => s + c.compositeHeat, 0) / cells.length).toFixed(1);

    return {
      symbols,
      dimensions:          DIMENSIONS,
      cells,
      columnSummary,
      topRiskPositions,
      portfolioHeatScore,
      generatedAt:         new Date(),
    };
  }

  // ── Heat scorers (0-100) ──────────────────────────────────────────────────────

  _volatilityHeat(pos) {
    const vol = VOL[pos.symbol] || VOL.DEFAULT;
    // Annualized vol — daily * sqrt(252)
    const annualized = vol * Math.sqrt(252);
    // Score: 50% annual vol = heat 100
    return Math.min(100, Math.round(annualized / 0.5 * 100));
  }

  _concentrationHeat(pos, totalNotional) {
    if (totalNotional === 0) return 0;
    const pct = pos.totalNotional / totalNotional;
    // > 30% in one symbol = heat 100
    return Math.min(100, Math.round(pct / 0.30 * 100));
  }

  _liquidityHeat(pos) {
    const ILLIQUID_PAIRS = new Set(["SHIB/USDT", "PEPE/USDT", "FLOKI/USDT"]);
    if (ILLIQUID_PAIRS.has(pos.symbol)) return 90;

    const vol = VOL[pos.symbol] || VOL.DEFAULT;
    // Higher vol = lower liquidity = higher heat
    const base = Math.min(80, Math.round(vol * 1000));

    // Large notional in illiquid pair
    const sizePenalty = pos.totalNotional > 50_000 ? 20 : pos.totalNotional > 10_000 ? 10 : 0;
    return Math.min(100, base + sizePenalty);
  }

  _correlationHeat(pos, _positions) {
    // Correlation with BTC (the dominant risk factor)
    const corrWithBtc = CORR["BTC/USDT"]?.[pos.symbol] ||
                        CORR[pos.symbol]?.["BTC/USDT"] || 0.5;
    // BTC itself gets low correlation heat
    if (pos.symbol === "BTC/USDT") return 10;
    return Math.min(100, Math.round(corrWithBtc * 100));
  }

  _drawdownHeat(pos) {
    const vol        = VOL[pos.symbol] || VOL.DEFAULT;
    const maxDD30d   = vol * Math.sqrt(30) * 2.5;  // ~97.5th pct worst-case
    const ddHeat     = Math.min(100, Math.round(maxDD30d / 0.5 * 100));
    return ddHeat;
  }

  _compositeHeat(scores) {
    const weights = { volatility: 0.25, concentration: 0.25, liquidity: 0.20, correlation: 0.15, drawdown: 0.15 };
    const composite = Object.entries(scores).reduce((s, [dim, val]) => s + val * (weights[dim] || 0), 0);
    return Math.round(composite);
  }

  // ── Persistence ───────────────────────────────────────────────────────────────

  async _saveReport(userId, heatmap, positions) {
    const riskScore = Math.round(heatmap.portfolioHeatScore);
    const riskLevel = this._heatToLevel(riskScore);

    const positionRisks = positions.map((p) => ({
      symbol:       p.symbol,
      side:         p.netNotional >= 0 ? "long" : "short",
      notionalUsd:  p.totalNotional,
      unrealizedPnl:0,
      exposurePct:  p.concentrationPct,
      var95:        +(p.totalNotional * (VOL[p.symbol] || 0.08) * 1.645).toFixed(2),
      var99:        +(p.totalNotional * (VOL[p.symbol] || 0.08) * 2.326).toFixed(2),
      beta:         1,
      liquidationRisk: riskScore > 80 ? "HIGH" : riskScore > 60 ? "MEDIUM" : "LOW",
    }));

    const totalN = positions.reduce((s, p) => s + p.totalNotional, 0);
    const hhi    = positions.reduce((s, p) => {
      const share = totalN > 0 ? p.totalNotional / totalN : 0;
      return s + share ** 2;
    }, 0);

    return RiskReport.create({
      reportId:   uuidv4(),
      userId,
      reportType: "portfolio",
      riskScore,
      riskLevel,
      exposure: {
        totalNotionalUsd:  +totalN.toFixed(2),
        netExposureUsd:    +totalN.toFixed(2),
        grossExposureUsd:  +totalN.toFixed(2),
        concentrationRisk: +hhi.toFixed(4),
        leverageRatio:     1,
      },
      var: {
        var95_1d:  positions.reduce((s, p) => s + (p.totalNotional * (VOL[p.symbol] || 0.08) * 1.645) ** 2, 0) ** 0.5,
        var99_1d:  positions.reduce((s, p) => s + (p.totalNotional * (VOL[p.symbol] || 0.08) * 2.326) ** 2, 0) ** 0.5,
        cvar95_1d: 0,
        cvar99_1d: 0,
      },
      positions: positionRisks,
      heatmap,
      recommendations: this._generateRecommendations(heatmap),
      alerts:          this._buildAlerts(riskScore, heatmap.topRiskPositions),
      generatedAt: new Date(),
      validUntil:  new Date(Date.now() + 30 * 60_000),
    });
  }

  _heatToLevel(heat) {
    if (heat >= 80) return "CRITICAL";
    if (heat >= 60) return "HIGH";
    if (heat >= 40) return "MODERATE";
    if (heat >= 20) return "LOW";
    return "MINIMAL";
  }

  _generateRecommendations(heatmap) {
    const recs = [];
    const { columnSummary, topRiskPositions } = heatmap;

    if (columnSummary.concentration > 60) recs.push("Portfolio is over-concentrated — spread risk across more assets.");
    if (columnSummary.volatility > 70)    recs.push("High volatility exposure — hedge with lower-beta assets.");
    if (columnSummary.liquidity > 60)     recs.push("Low-liquidity assets increase slippage risk in a market shock.");
    if (topRiskPositions[0]?.compositeHeat > 75) {
      recs.push(`${topRiskPositions[0].symbol} is the hottest position — review size or add a stop-loss order.`);
    }
    if (recs.length === 0) recs.push("Portfolio risk profile is healthy across all dimensions.");
    return recs;
  }

  _buildAlerts(riskScore, topPositions = []) {
    const alerts = [];
    if (riskScore >= 80) alerts.push({ level: "CRITICAL", message: "Portfolio heat score critical — immediate review required." });
    else if (riskScore >= 60) alerts.push({ level: "HIGH",     message: "Portfolio heat score elevated." });
    if (topPositions[0]?.compositeHeat > 85) {
      alerts.push({ level: "HIGH", message: `${topPositions[0].symbol} requires immediate risk reduction.` });
    }
    return alerts;
  }

  _emptyHeatmap(userId) {
    return {
      userId,
      reportType:          "portfolio",
      riskScore:           0,
      riskLevel:           "MINIMAL",
      heatmap:             { symbols: [], cells: [], portfolioHeatScore: 0, topRiskPositions: [] },
      generatedAt:         new Date(),
    };
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
      logger.warn({ err: err.message }, "[Heatmap] Cache write failed.");
    }
  }
}

export const portfolioRiskHeatmap = new PortfolioRiskHeatmap();
