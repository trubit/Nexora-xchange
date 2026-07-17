/**
 * Trading Behavior Scoring Model
 *
 * Analyses patterns in a user's trade history to produce:
 *   - Composite behavior score (0-100)
 *   - Risk tier classification
 *   - Dimensional scores: consistency, discipline, risk management,
 *     profitability, market knowledge
 *   - Anomaly detection (revenge trading, over-leveraging, wash trading)
 *   - Rolling windows: 7d / 30d / 90d trend
 */

import TradingBehaviorScore from "../models/TradingBehaviorScore.js";
import { redisClients }     from "../config/redis.js";
import logger               from "../config/logger.js";

const CACHE_KEY    = "tbscore:";
const CACHE_TTL_S  = 1800;  // 30 min

const RISK_TIERS = [
  { label: "CONSERVATIVE", min: 80 },
  { label: "MODERATE",     min: 60 },
  { label: "AGGRESSIVE",   min: 40 },
  { label: "SPECULATIVE",  min: 20 },
  { label: "EXTREME",      min:  0 },
];

export class TradingBehaviorScoring {
  // ── Public API ────────────────────────────────────────────────────────────────

  async computeScore(userId, { force = false } = {}) {
    const uid = String(userId);
    if (!force) {
      const cached = await this._getCached(uid);
      if (cached) return cached;
    }

    const data = await this._loadTradeData(uid);
    const dims = this._scoreDimensions(data);
    const behaviorScore = this._composite(dims);
    const riskTier      = this._classifyTier(behaviorScore);
    const anomalies     = this._detectAnomalies(data);
    const windows       = this._rollingWindows(data);
    const patterns      = this._extractPatterns(data);

    const nextRecompute = new Date(Date.now() + 6 * 3_600_000);

    const doc = await TradingBehaviorScore.findOneAndUpdate(
      { userId },
      {
        $set: {
          userId,
          behaviorScore,
          riskTier,
          patterns,
          dimensions: dims,
          anomalies,
          windows,
          computedAt:      new Date(),
          nextRecomputeAt: nextRecompute,
        },
      },
      { upsert: true, new: true },
    );

    const result = doc.toObject();
    await this._setCached(uid, result);
    return result;
  }

  async getScore(userId) {
    const cached = await this._getCached(String(userId));
    if (cached) return cached;
    return TradingBehaviorScore.findOne({ userId }).sort({ computedAt: -1 }).lean();
  }

  // ── Data loading ──────────────────────────────────────────────────────────────

  async _loadTradeData(userId) {
    const [Trade, Order] = await Promise.all([
      import("../models/Trade.js").then((m) => m.default),
      import("../models/Order.js").then((m) => m.default),
    ]);

    const uid = userId;
    const [trades, orders] = await Promise.all([
      Trade.find({ $or: [{ buyer: uid }, { seller: uid }] })
        .sort({ createdAt: -1 }).limit(1000).lean(),
      Order.find({ user: uid }).sort({ createdAt: -1 }).limit(2000).lean(),
    ]);

    return { trades, orders, userId };
  }

  // ── Dimension scorers ─────────────────────────────────────────────────────────

  _scoreDimensions(data) {
    return {
      consistency:    this._scoreConsistency(data),
      discipline:     this._scoreDiscipline(data),
      riskManagement: this._scoreRiskManagement(data),
      profitability:  this._scoreProfitability(data),
      marketKnowledge:this._scoreMarketKnowledge(data),
    };
  }

  /** Measures how regularly and consistently the user trades. */
  _scoreConsistency(data) {
    const { trades } = data;
    if (trades.length === 0) return 50;

    // Group trades by day
    const byDay = new Map();
    for (const t of trades) {
      const day = new Date(t.createdAt).toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) || 0) + 1);
    }

    const counts  = [...byDay.values()];
    const mean    = counts.reduce((s, v) => s + v, 0) / counts.length;
    const stddev  = Math.sqrt(counts.reduce((s, v) => s + (v - mean) ** 2, 0) / counts.length);
    const cv      = mean > 0 ? stddev / mean : 1;  // coefficient of variation

    // Low CV = consistent; high CV = erratic
    const score = Math.max(0, Math.min(100, 100 - cv * 30));
    return Math.round(score);
  }

  /** Measures discipline: avoids revenge trading, follows rational patterns. */
  _scoreDiscipline(data) {
    const { orders } = data;
    if (orders.length === 0) return 50;

    const cancelled  = orders.filter((o) => o.status === "cancelled").length;
    const total      = orders.length;
    const cancelRate = cancelled / total;

    // Detect rapid re-entry after cancellation (revenge trading proxy)
    let revengeCount = 0;
    const sorted = [...orders].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    for (let i = 1; i < sorted.length; i++) {
      const gap = new Date(sorted[i].createdAt) - new Date(sorted[i - 1].createdAt);
      if (sorted[i - 1].status === "cancelled" && gap < 60_000) revengeCount++;
    }

    const revengeRate = total > 0 ? revengeCount / total : 0;
    const score = Math.max(0, 100 - cancelRate * 30 - revengeRate * 50);
    return Math.round(score);
  }

  /** Measures use of risk management (stop-loss orders, position sizing). */
  _scoreRiskManagement(data) {
    const { orders } = data;
    if (orders.length === 0) return 50;

    const stopOrders = orders.filter((o) =>
      o.type === "stop" || o.type === "stop_limit" || o.stopPrice,
    ).length;
    const stopRate = stopOrders / orders.length;

    // Check position sizing diversity (avoiding over-concentration)
    const symbols    = new Set(orders.map((o) => o.symbol));
    const diversity  = Math.min(1, symbols.size / 5);

    // Large single orders relative to their average = poor sizing
    const values   = orders.map((o) => (o.price || 0) * (o.amount || 0));
    const avgVal   = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
    const maxVal   = Math.max(...values, 0);
    const sizeRisk = avgVal > 0 ? Math.min(1, maxVal / (avgVal * 10)) : 0;

    const score = 40 + stopRate * 30 + diversity * 20 - sizeRisk * 10;
    return Math.round(Math.max(0, Math.min(100, score)));
  }

  /** Proxy for profitability from available order data. */
  _scoreProfitability(data) {
    const { orders } = data;
    const filled = orders.filter((o) => ["filled", "partially_filled"].includes(o.status));
    if (filled.length < 5) return 50;

    const buys    = filled.filter((o) => o.side === "buy");
    const sells   = filled.filter((o) => o.side === "sell");
    const matched = Math.min(buys.length, sells.length);
    const ratio   = filled.length > 0 ? matched * 2 / filled.length : 0;

    const score = 30 + Math.round(ratio * 50) + (filled.length > 100 ? 20 : filled.length > 20 ? 10 : 0);
    return Math.min(100, score);
  }

  /** Rewards trading in liquid, well-known markets. */
  _scoreMarketKnowledge(data) {
    const { orders } = data;
    if (orders.length === 0) return 50;

    const MAJOR_PAIRS = new Set(["BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT", "XRP/USDT",
                                  "BTC-USDT", "ETH-USDT", "BTCUSDT",  "ETHUSDT"]);
    const majorCount = orders.filter((o) => MAJOR_PAIRS.has(o.symbol)).length;
    const majorRate  = majorCount / orders.length;

    // Diversity penalty: only trading one pair repeatedly is lower knowledge
    const symbols = new Set(orders.map((o) => o.symbol));
    const diversityScore = Math.min(30, symbols.size * 5);

    const score = Math.round(40 + majorRate * 30 + diversityScore);
    return Math.min(100, score);
  }

  // ── Composite ─────────────────────────────────────────────────────────────────

  _composite(dims) {
    const weights = { consistency: 0.20, discipline: 0.25, riskManagement: 0.25, profitability: 0.20, marketKnowledge: 0.10 };
    const score = Object.entries(dims).reduce((s, [k, v]) => s + v * (weights[k] || 0), 0);
    return Math.round(Math.max(0, Math.min(100, score)));
  }

  _classifyTier(score) {
    for (const { label, min } of RISK_TIERS) {
      if (score >= min) return label;
    }
    return "EXTREME";
  }

  // ── Anomaly detection ─────────────────────────────────────────────────────────

  _detectAnomalies(data) {
    const anomalies = [];
    const { orders } = data;

    // 1. Wash trading: same symbol buy + sell within 60s
    const sorted = [...orders].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const recentBySymbol = {};
    for (const o of sorted) {
      const key = o.symbol;
      const prev = recentBySymbol[key];
      if (prev && prev.side !== o.side) {
        const gap = new Date(o.createdAt) - new Date(prev.createdAt);
        if (gap < 60_000) {
          anomalies.push({
            type:        "WASH_TRADING_SUSPECT",
            severity:    "HIGH",
            detectedAt:  new Date(),
            description: `Rapid ${prev.side}→${o.side} on ${key} within ${Math.round(gap / 1000)}s`,
          });
        }
      }
      recentBySymbol[key] = o;
    }

    // 2. Overtrading: > 50 orders in a single hour
    const byHour = {};
    for (const o of orders) {
      const h = new Date(o.createdAt).toISOString().slice(0, 13);
      byHour[h] = (byHour[h] || 0) + 1;
    }
    const maxHour = Math.max(0, ...Object.values(byHour));
    if (maxHour > 50) {
      anomalies.push({
        type:        "OVERTRADING",
        severity:    "MEDIUM",
        detectedAt:  new Date(),
        description: `${maxHour} orders placed in a single hour`,
      });
    }

    // 3. Single-symbol concentration > 80%
    const symbolCounts = {};
    for (const o of orders) symbolCounts[o.symbol] = (symbolCounts[o.symbol] || 0) + 1;
    const topSymbol = Object.entries(symbolCounts).sort((a, b) => b[1] - a[1])[0];
    if (topSymbol && orders.length > 0 && topSymbol[1] / orders.length > 0.8) {
      anomalies.push({
        type:        "CONCENTRATION_RISK",
        severity:    "MEDIUM",
        detectedAt:  new Date(),
        description: `${(topSymbol[1] / orders.length * 100).toFixed(0)}% of orders in ${topSymbol[0]}`,
      });
    }

    return anomalies.slice(0, 10);
  }

  // ── Rolling window scores ─────────────────────────────────────────────────────

  _rollingWindows(data) {
    const now  = Date.now();
    const ms7  =  7 * 86_400_000;
    const ms30 = 30 * 86_400_000;
    const ms90 = 90 * 86_400_000;

    const in7  = data.orders.filter((o) => now - new Date(o.createdAt) < ms7);
    const in30 = data.orders.filter((o) => now - new Date(o.createdAt) < ms30);
    const in90 = data.orders.filter((o) => now - new Date(o.createdAt) < ms90);

    const score7  = in7.length  > 0 ? this._composite(this._scoreDimensions({ ...data, orders: in7,  trades: data.trades })) : 0;
    const score30 = in30.length > 0 ? this._composite(this._scoreDimensions({ ...data, orders: in30, trades: data.trades })) : 0;
    const score90 = in90.length > 0 ? this._composite(this._scoreDimensions({ ...data, orders: in90, trades: data.trades })) : 0;

    return { score7d: score7, score30d: score30, score90d: score90 };
  }

  // ── Pattern extraction ────────────────────────────────────────────────────────

  _extractPatterns(data) {
    const { orders } = data;
    if (orders.length === 0) {
      return {
        avgHoldingPeriodMs:   0,
        tradeFrequencyPerDay: 0,
        preferredMarkets:     [],
        orderTypeDistribution:{ market: 0, limit: 0, stop: 0 },
        avgLeverageUsed:      1,
        peakDrawdown:         0,
        recoveryRate:         0,
      };
    }

    // Trade frequency
    const days    = (Date.now() - new Date(orders[orders.length - 1].createdAt)) / 86_400_000 || 1;
    const freq    = orders.length / days;

    // Preferred markets
    const symbolCount = {};
    const typeCount   = { market: 0, limit: 0, stop: 0 };
    for (const o of orders) {
      symbolCount[o.symbol] = (symbolCount[o.symbol] || 0) + 1;
      const t = o.type || "limit";
      if (typeCount[t] !== undefined) typeCount[t]++;
      else typeCount.limit++;
    }
    const preferred = Object.entries(symbolCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([s]) => s);

    const total = orders.length;
    const dist  = {
      market: +(typeCount.market / total).toFixed(4),
      limit:  +(typeCount.limit  / total).toFixed(4),
      stop:   +(typeCount.stop   / total).toFixed(4),
    };

    return {
      avgHoldingPeriodMs:   0,  // requires matched trade pairs
      tradeFrequencyPerDay: +freq.toFixed(2),
      preferredMarkets:     preferred,
      orderTypeDistribution: dist,
      avgLeverageUsed:      1,
      peakDrawdown:         0,
      recoveryRate:         0,
    };
  }

  // ── Cache ─────────────────────────────────────────────────────────────────────

  async _getCached(uid) {
    const redis = redisClients.cache;
    if (!redis) return null;
    try {
      const raw = await redis.get(`${CACHE_KEY}${uid}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  async _setCached(uid, data) {
    const redis = redisClients.cache;
    if (!redis) return;
    try {
      await redis.setex(`${CACHE_KEY}${uid}`, CACHE_TTL_S, JSON.stringify(data));
    } catch (err) {
      logger.warn({ err: err.message }, "[TBS] Cache write failed.");
    }
  }
}

export const tradingBehaviorScoring = new TradingBehaviorScoring();
