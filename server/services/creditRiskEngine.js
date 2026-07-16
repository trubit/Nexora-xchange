/**
 * Credit Risk Engine  (credit-risk-engine)
 *
 * Evaluates every user like a financial institution:
 *   - Dynamic composite credit score 0-1000 (FICO-style)
 *   - Component weighting: account health, trading history,
 *     KYC status, deposit behavior, risk flags
 *   - Automatic band classification
 *   - Credit limit derivation
 *   - Incremental re-scoring on new trade/deposit events
 */

import User           from "../models/User.js";
import Order          from "../models/Order.js";
import Transaction    from "../models/Transaction.js";
import CreditScore    from "../models/CreditScore.js";
import KycProfile     from "../models/KycProfile.js";
import { redisClients } from "../config/redis.js";
import logger           from "../config/logger.js";

const CACHE_TTL_S = 3600;         // 1 hour
const SCORE_VERSION = 2;

// Scoring components and their weights (must sum to 1.0)
const COMPONENTS = [
  { name: "account_age",       weight: 0.10 },
  { name: "kyc_status",        weight: 0.20 },
  { name: "deposit_behavior",  weight: 0.20 },
  { name: "trading_history",   weight: 0.25 },
  { name: "pnl_quality",       weight: 0.15 },
  { name: "risk_compliance",   weight: 0.10 },
];

const BAND_THRESHOLDS = [
  { band: "EXCELLENT",  min: 800 },
  { band: "VERY_GOOD",  min: 670 },
  { band: "GOOD",       min: 580 },
  { band: "FAIR",       min: 500 },
  { band: "POOR",       min: 0   },
];

export class CreditRiskEngine {
  // ── Main scoring entry ────────────────────────────────────────────────────────

  async computeScore(userId) {
    const userIdStr = String(userId);

    // Gather all data in parallel
    const [user, kyc, orders, transactions] = await Promise.all([
      User.findById(userId).select("createdAt emailVerified status role").lean(),
      KycProfile.findOne({ user: userId }).lean(),
      Order.find({ user: userId }).select("side symbol status filledAmount price createdAt").lean(),
      Transaction.find({ user: userId }).select("type amount status createdAt").lean(),
    ]);

    if (!user) throw new Error("User not found");

    // Compute each component
    const componentScores = this._computeComponents(user, kyc, orders, transactions);

    // Composite score (weighted sum, scale to 0-1000)
    const rawScore = componentScores.reduce(
      (sum, c) => sum + c.score * c.weight,
      0,
    );
    const compositeScore = Math.round(rawScore * 10);  // 0-100 weighted → 0-1000

    const band          = this._scoreToBand(compositeScore);
    const creditLimit   = this._deriveCreditLimit(compositeScore, transactions);
    const riskFlags     = this._extractRiskFlags(user, kyc, orders, transactions);
    const tradingStats  = this._computeTradingStats(orders);
    const accountHealth = this._computeAccountHealth(user, kyc, transactions);

    const doc = await CreditScore.findOneAndUpdate(
      { userId },
      {
        userId,
        score:          compositeScore,
        band,
        components:     componentScores,
        tradingHistory: tradingStats,
        accountHealth,
        riskFlags,
        creditLimitUsd: creditLimit,
        utilizationRate:0,
        version:        SCORE_VERSION,
        computedAt:     new Date(),
        nextRecomputeAt:new Date(Date.now() + 24 * 3600_000),
        isStale:        false,
      },
      { upsert: true, new: true },
    );

    await this._cacheScore(userIdStr, doc.toObject());
    return doc.toObject();
  }

  // ── Component scorers ─────────────────────────────────────────────────────────

  _computeComponents(user, kyc, orders, transactions) {
    return COMPONENTS.map((comp) => {
      const result = this._scoreComponent(comp.name, user, kyc, orders, transactions);
      return {
        name:        comp.name,
        score:       result.score,
        weight:      comp.weight,
        rawValue:    result.rawValue,
        explanation: result.explanation,
      };
    });
  }

  _scoreComponent(name, user, kyc, orders, transactions) {
    switch (name) {

      case "account_age": {
        const ageDays  = (Date.now() - new Date(user.createdAt)) / 86_400_000;
        const score    = Math.min(100, (ageDays / 365) * 100);
        return { score, rawValue: Math.round(ageDays), explanation: `Account ${Math.round(ageDays)} days old` };
      }

      case "kyc_status": {
        const level   = kyc?.verificationLevel || "none";
        const scoreMap = { none: 0, basic: 30, intermediate: 65, advanced: 100 };
        const score    = scoreMap[level] ?? 0;
        const flagged  = kyc?.isFlagged ? -20 : 0;
        return { score: Math.max(0, score + flagged), rawValue: level, explanation: `KYC level: ${level}` };
      }

      case "deposit_behavior": {
        const deposits = transactions.filter((t) => t.type === "deposit" && t.status === "completed");
        const totalDep = deposits.reduce((s, t) => s + (t.amount || 0), 0);
        const depCount = deposits.length;
        const recency  = deposits.length
          ? (Date.now() - new Date(deposits.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0].createdAt)) / 86_400_000
          : 9999;

        let score = 0;
        if (totalDep > 100_000) score = 100;
        else if (totalDep > 10_000) score = 80;
        else if (totalDep > 1_000)  score = 60;
        else if (totalDep > 100)    score = 40;
        else if (depCount > 0)      score = 20;

        if (recency < 30) score = Math.min(100, score + 10);

        return { score, rawValue: totalDep, explanation: `Total deposits: $${totalDep.toFixed(0)}` };
      }

      case "trading_history": {
        const filled  = orders.filter((o) => o.status === "filled" || o.status === "partially_filled");
        const count   = filled.length;
        let score = Math.min(80, count * 2);
        if (count > 100) score = 100;
        else if (count > 50) score = 90;
        return { score, rawValue: count, explanation: `${count} completed trades` };
      }

      case "pnl_quality": {
        // Without P&L data stored directly, proxy via order analysis
        const filled  = orders.filter((o) => ["filled", "partially_filled"].includes(o.status));
        if (filled.length === 0) return { score: 50, rawValue: null, explanation: "No trade history" };

        const buys  = filled.filter((o) => o.side === "buy").length;
        const sells = filled.filter((o) => o.side === "sell").length;
        const ratio = buys + sells > 0 ? Math.min(buys, sells) / Math.max(buys, sells) : 0;
        const score = 40 + Math.round(ratio * 60);  // balanced trading = higher score
        return { score, rawValue: { buys, sells }, explanation: `Trade balance ratio: ${ratio.toFixed(2)}` };
      }

      case "risk_compliance": {
        const suspended = user.status === "suspended";
        const emailOk   = user.emailVerified !== false;
        let score = 100;
        if (suspended) score -= 80;
        if (!emailOk)  score -= 20;
        return { score: Math.max(0, score), rawValue: { suspended, emailOk }, explanation: "Account compliance" };
      }

      default:
        return { score: 50, rawValue: null, explanation: "Unknown component" };
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  _scoreToBand(score) {
    for (const { band, min } of BAND_THRESHOLDS) {
      if (score >= min) return band;
    }
    return "POOR";
  }

  _deriveCreditLimit(score, transactions) {
    const totalDeposits = transactions
      .filter((t) => t.type === "deposit" && t.status === "completed")
      .reduce((s, t) => s + (t.amount || 0), 0);

    const multiplier = score >= 800 ? 5 : score >= 670 ? 3 : score >= 580 ? 2 : score >= 500 ? 1.5 : 1;
    return Math.round(totalDeposits * multiplier);
  }

  _extractRiskFlags(user, kyc, orders, transactions) {
    const flags = [];
    if (user.status === "suspended")   flags.push("ACCOUNT_SUSPENDED");
    if (kyc?.isFlagged)                flags.push("KYC_FLAGGED");
    if (!user.emailVerified)           flags.push("EMAIL_UNVERIFIED");

    const withdrawals = transactions.filter((t) => t.type === "withdrawal");
    const deposits    = transactions.filter((t) => t.type === "deposit");
    const depTotal    = deposits.reduce((s, t) => s + (t.amount || 0), 0);
    const wdTotal     = withdrawals.reduce((s, t) => s + (t.amount || 0), 0);
    if (wdTotal > depTotal * 1.1)      flags.push("WITHDRAWAL_EXCEEDS_DEPOSITS");

    const last24h = orders.filter((o) => Date.now() - new Date(o.createdAt) < 86_400_000);
    if (last24h.length > 500)          flags.push("HIGH_FREQUENCY_TRADING");

    return flags;
  }

  _computeTradingStats(orders) {
    const filled = orders.filter((o) => ["filled", "partially_filled"].includes(o.status));
    const totalTrades    = filled.length;
    const avgValue       = totalTrades
      ? filled.reduce((s, o) => s + (o.filledAmount || 0) * (o.price || 0), 0) / totalTrades
      : 0;

    // Win streak proxy: consecutive fills on same side
    let maxWin = 0, maxLoss = 0, curWin = 0, curLoss = 0;
    let prevSide = null;
    for (const o of filled) {
      if (o.side === prevSide) { curWin++; curLoss = 0; }
      else { curLoss++; curWin = 0; }
      maxWin  = Math.max(maxWin,  curWin);
      maxLoss = Math.max(maxLoss, curLoss);
      prevSide = o.side;
    }

    return { totalTrades, avgTradeValueUsd: +avgValue.toFixed(2), longestWinStreak: maxWin, longestLossStreak: maxLoss, winRate: 0.5, profitLossRatio: 1 };
  }

  _computeAccountHealth(user, kyc, transactions) {
    const ageDays        = (Date.now() - new Date(user.createdAt)) / 86_400_000;
    const deposits       = transactions.filter((t) => t.type === "deposit" && t.status === "completed");
    const withdrawals    = transactions.filter((t) => t.type === "withdrawal" && t.status === "completed");
    const totalDeposits  = deposits.reduce((s, t) => s + (t.amount || 0), 0);
    const totalWithdraws = withdrawals.reduce((s, t) => s + (t.amount || 0), 0);

    return {
      accountAgeDays:    Math.round(ageDays),
      kycVerified:       ["intermediate", "advanced"].includes(kyc?.verificationLevel),
      emailVerified:     user.emailVerified !== false,
      depositHistory:    +totalDeposits.toFixed(2),
      withdrawalHistory: +totalWithdraws.toFixed(2),
      netDeposits:       +(totalDeposits - totalWithdraws).toFixed(2),
    };
  }

  // ── Cache layer ───────────────────────────────────────────────────────────────

  async _cacheScore(userId, score) {
    const redis = redisClients.cache;
    if (!redis) return;
    try {
      await redis.setex(`credit:${userId}`, CACHE_TTL_S, JSON.stringify(score));
    } catch (err) {
      logger.warn({ err: err.message }, "[CreditRisk] Cache write failed.");
    }
  }

  async getCachedScore(userId) {
    const redis = redisClients.cache;
    if (!redis) return null;
    try {
      const raw = await redis.get(`credit:${userId}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  // ── Batch re-scoring ──────────────────────────────────────────────────────────

  async markStale(userId) {
    await CreditScore.updateOne({ userId }, { $set: { isStale: true } });
    const redis = redisClients.cache;
    if (redis) await redis.del(`credit:${userId}`).catch(() => {});
  }

  async processStaleScores(limit = 20) {
    const stale = await CreditScore.find(
      { isStale: true, nextRecomputeAt: { $lte: new Date() } },
      { userId: 1 },
      { limit },
    ).lean();

    const results = [];
    for (const doc of stale) {
      try {
        const score = await this.computeScore(doc.userId);
        results.push({ userId: doc.userId, score: score.score });
      } catch (err) {
        logger.warn({ err: err.message, userId: doc.userId }, "[CreditRisk] Batch rescore failed.");
      }
    }
    return results;
  }

  // ── Distribution analytics ────────────────────────────────────────────────────

  async getDistribution() {
    return CreditScore.aggregate([
      { $group: { _id: "$band", count: { $sum: 1 }, avgScore: { $avg: "$score" } } },
      { $sort: { avgScore: -1 } },
    ]);
  }
}

export const creditRiskEngine = new CreditRiskEngine();
