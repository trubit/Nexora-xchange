/**
 * Liquidity Risk Detector
 *
 * Analyses the live order book and market activity to surface:
 *   - Bid-ask spread assessment per symbol
 *   - Market depth adequacy (can a large order be filled without excess slippage?)
 *   - Thin order book detection (sudden depth drops)
 *   - Liquidity score per symbol (0-100, higher = better liquidity)
 *   - Platform-wide liquidity health summary
 *   - Illiquid asset flag list
 */

import RiskReport from "../models/RiskReport.js";
import { redisClients } from "../config/redis.js";
import logger from "../config/logger.js";
import { v4 as uuidv4 } from "uuid";

// Minimum acceptable depth (USD) before a symbol is flagged illiquid
const MIN_DEPTH_USD = {
  "BTC/USDT": 500_000, "ETH/USDT": 200_000, "BNB/USDT": 100_000,
  "SOL/USDT": 50_000,  "XRP/USDT": 50_000,  DEFAULT: 10_000,
};

// Max acceptable bid-ask spread (%) before liquidity alert fires
const MAX_SPREAD_PCT = {
  "BTC/USDT": 0.05, "ETH/USDT": 0.08, "BNB/USDT": 0.10,
  "SOL/USDT": 0.15, DEFAULT: 0.50,
};

const CACHE_KEY = "liq:";
const CACHE_TTL = 300;  // 5 min — liquidity changes fast

export class LiquidityRiskDetector {
  // ── Per-symbol analysis ───────────────────────────────────────────────────────

  /**
   * Analyse a single symbol's order book.
   * Accepts a snapshot object: { symbol, bids: [[price, qty]…], asks: [[price, qty]…] }
   */
  analyseOrderBook(snapshot) {
    const { symbol, bids = [], asks = [] } = snapshot;

    if (bids.length === 0 || asks.length === 0) {
      return this._emptySymbolResult(symbol, "No order book data");
    }

    const bestBid   = bids[0][0];
    const bestAsk   = asks[0][0];
    const midPrice  = (bestBid + bestAsk) / 2;
    const spreadAbs = bestAsk - bestBid;
    const spreadPct = midPrice > 0 ? (spreadAbs / midPrice) * 100 : 0;
    const spreadBps = spreadPct * 100;

    const bidDepthUsd = this._computeDepth(bids, midPrice, 10);
    const askDepthUsd = this._computeDepth(asks, midPrice, 10);
    const totalDepth  = bidDepthUsd + askDepthUsd;
    const depthImbalance = totalDepth > 0 ? Math.abs(bidDepthUsd - askDepthUsd) / totalDepth : 0;

    const minDepth    = MIN_DEPTH_USD[symbol] || MIN_DEPTH_USD.DEFAULT;
    const maxSpread   = MAX_SPREAD_PCT[symbol] || MAX_SPREAD_PCT.DEFAULT;

    const liquidityScore = this._computeLiquidityScore(
      spreadPct, maxSpread, totalDepth, minDepth, depthImbalance,
    );

    const illiquid = liquidityScore < 40;
    const flags    = [];
    if (spreadPct > maxSpread)        flags.push("WIDE_SPREAD");
    if (totalDepth < minDepth)        flags.push("THIN_BOOK");
    if (depthImbalance > 0.5)         flags.push("DEPTH_IMBALANCE");
    if (bids.length < 5)              flags.push("FEW_BID_LEVELS");
    if (asks.length < 5)              flags.push("FEW_ASK_LEVELS");

    return {
      symbol,
      midPrice:       +midPrice.toFixed(6),
      bestBid:        +bestBid.toFixed(6),
      bestAsk:        +bestAsk.toFixed(6),
      spreadAbs:      +spreadAbs.toFixed(6),
      spreadPct:      +spreadPct.toFixed(4),
      spreadBps:      +spreadBps.toFixed(2),
      bidDepthUsd:    +bidDepthUsd.toFixed(2),
      askDepthUsd:    +askDepthUsd.toFixed(2),
      totalDepthUsd:  +totalDepth.toFixed(2),
      depthImbalance: +depthImbalance.toFixed(4),
      liquidityScore,
      illiquid,
      flags,
      analysedAt: new Date(),
    };
  }

  /**
   * Analyse multiple symbols and produce a platform-wide liquidity health report.
   */
  async analyseAll(snapshots = []) {
    const analyses = snapshots.map((s) => this.analyseOrderBook(s));

    const illiquidAssets  = analyses.filter((a) => a.illiquid).map((a) => a.symbol);
    const avgSpread       = analyses.reduce((s, a) => s + a.spreadPct, 0) / Math.max(analyses.length, 1);
    const avgDepth        = analyses.reduce((s, a) => s + a.totalDepthUsd, 0) / Math.max(analyses.length, 1);
    const avgLiqScore     = analyses.reduce((s, a) => s + a.liquidityScore, 0) / Math.max(analyses.length, 1);

    const platformScore   = Math.round(avgLiqScore);
    const platformRisk    = this._liquidityScoreToRisk(platformScore);

    const result = {
      platformLiquidityScore: platformScore,
      platformRiskLevel:      platformRisk,
      symbolCount:            analyses.length,
      illiquidAssets,
      illiquidCount:          illiquidAssets.length,
      avgBidAskSpreadPct:     +avgSpread.toFixed(4),
      avgMarketDepthUsd:      +avgDepth.toFixed(2),
      symbols:                analyses,
      analysedAt:             new Date(),
    };

    // Cache platform summary
    await this._setCached("platform", result);

    // Store in RiskReport for historical tracking
    await this._saveReport(result).catch((err) =>
      logger.warn({ err: err.message }, "[LiqDet] Failed to save report."),
    );

    return result;
  }

  /**
   * Estimate slippage for placing an order of `orderSizeUsd` on `symbol`.
   * Requires the current best ask/bid and relevant depth data.
   */
  estimateSlippage(symbol, orderSizeUsd, side, analysis) {
    if (!analysis || analysis.totalDepthUsd === 0) {
      return { estimatedSlippagePct: 1.0, canFill: false, reason: "No depth data" };
    }

    const depthOnSide = side === "buy" ? analysis.askDepthUsd : analysis.bidDepthUsd;
    const fillRatio   = Math.min(1, orderSizeUsd / depthOnSide);

    // Linear slippage model: consuming 100% of one side = full spread width
    const slippagePct = fillRatio * analysis.spreadPct;
    const canFill     = fillRatio < 0.8;  // can fill cleanly if consuming < 80% of depth

    return {
      estimatedSlippagePct: +slippagePct.toFixed(4),
      estimatedSlippageBps: +(slippagePct * 100).toFixed(2),
      fillRatio:            +fillRatio.toFixed(4),
      canFill,
      recommendation: canFill
        ? "Order can be filled with minimal market impact."
        : `Order size exceeds available depth — split into smaller lots. Max safe size: $${(depthOnSide * 0.8).toFixed(0)}.`,
    };
  }

  /**
   * Detect sudden depth collapse (flash crash precursor).
   * Compares current depth to previously cached depth for same symbol.
   */
  async detectDepthCollapse(symbol, currentDepthUsd) {
    const redis = redisClients.cache;
    if (!redis) return { collapsed: false };

    const key    = `${CACHE_KEY}depth:${symbol}`;
    const prev   = await redis.get(key).catch(() => null);
    const prevVal = prev ? parseFloat(prev) : null;

    // Cache current value with 5-min TTL
    await redis.setex(key, 300, String(currentDepthUsd)).catch(() => {});

    if (prevVal === null) return { collapsed: false };

    const dropPct = prevVal > 0 ? (prevVal - currentDepthUsd) / prevVal : 0;

    if (dropPct > 0.50) {
      logger.warn({ symbol, prevVal, currentDepthUsd, dropPct }, "[LiqDet] Depth collapse detected.");
      return {
        collapsed: true,
        severity:  dropPct > 0.80 ? "CRITICAL" : "HIGH",
        dropPct:   +dropPct.toFixed(4),
        prevDepth: prevVal,
        currDepth: currentDepthUsd,
        message:   `${symbol} order book depth dropped ${(dropPct * 100).toFixed(0)}%`,
      };
    }
    return { collapsed: false };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  _computeDepth(levels, midPrice, levelCount = 10) {
    return levels
      .slice(0, levelCount)
      .reduce((s, [price, qty]) => s + price * qty, 0);
  }

  _computeLiquidityScore(spreadPct, maxSpread, depthUsd, minDepth, depthImbalance) {
    // Spread component (lower spread = better): 0-40
    const spreadScore = Math.max(0, 40 - (spreadPct / maxSpread) * 40);

    // Depth component: 0-40
    const depthScore = Math.min(40, (depthUsd / minDepth) * 40);

    // Imbalance penalty: 0-20
    const balanceScore = Math.max(0, 20 - depthImbalance * 20);

    return Math.round(Math.min(100, spreadScore + depthScore + balanceScore));
  }

  _liquidityScoreToRisk(score) {
    if (score >= 80) return "MINIMAL";
    if (score >= 60) return "LOW";
    if (score >= 40) return "MODERATE";
    if (score >= 20) return "HIGH";
    return "CRITICAL";
  }

  _emptySymbolResult(symbol, reason) {
    return {
      symbol, midPrice: 0, bestBid: 0, bestAsk: 0, spreadAbs: 0,
      spreadPct: 0, spreadBps: 0, bidDepthUsd: 0, askDepthUsd: 0,
      totalDepthUsd: 0, depthImbalance: 0, liquidityScore: 0,
      illiquid: true, flags: ["NO_DATA"], reason, analysedAt: new Date(),
    };
  }

  // ── Persistence ───────────────────────────────────────────────────────────────

  async _saveReport(platformResult) {
    const riskScore = 100 - platformResult.platformLiquidityScore;  // invert: low liquidity = high risk
    const riskLevel = platformResult.platformRiskLevel === "MINIMAL" ? "MINIMAL"
                    : platformResult.platformRiskLevel === "LOW"     ? "LOW"
                    : platformResult.platformRiskLevel === "MODERATE"? "MODERATE"
                    : platformResult.platformRiskLevel === "HIGH"    ? "HIGH"
                    : "CRITICAL";

    return RiskReport.create({
      reportId:   uuidv4(),
      reportType: "system",
      riskScore:  Math.min(100, riskScore),
      riskLevel,
      exposure: {
        totalNotionalUsd:  0,
        netExposureUsd:    0,
        grossExposureUsd:  0,
        concentrationRisk: 0,
        leverageRatio:     1,
      },
      var: { var95_1d: 0, var99_1d: 0, cvar95_1d: 0, cvar99_1d: 0 },
      positions: [],
      liquidityRisk: {
        score:           platformResult.platformLiquidityScore,
        illiquidAssets:  platformResult.illiquidAssets,
        avgBidAskSpread: platformResult.avgBidAskSpreadPct,
        marketDepthUsd:  platformResult.avgMarketDepthUsd,
      },
      recommendations: this._generateRecommendations(platformResult),
      alerts:          this._buildAlerts(riskScore, platformResult),
      generatedAt: new Date(),
      validUntil:  new Date(Date.now() + 5 * 60_000),
    });
  }

  _generateRecommendations(r) {
    const recs = [];
    if (r.illiquidCount > 0)              recs.push(`${r.illiquidCount} illiquid assets detected: ${r.illiquidAssets.join(", ")} — consider reducing listed pairs.`);
    if (r.avgBidAskSpreadPct > 0.5)       recs.push("Average bid-ask spread is elevated — incentivize market makers.");
    if (r.avgMarketDepthUsd < 50_000)     recs.push("Market depth is shallow — add liquidity incentives.");
    if (r.platformLiquidityScore < 50)    recs.push("Platform-wide liquidity health is POOR — immediate action required.");
    return recs.length ? recs : ["Platform liquidity is healthy."];
  }

  _buildAlerts(riskScore, r) {
    const alerts = [];
    if (riskScore >= 80) alerts.push({ level: "CRITICAL", message: "Platform liquidity critically low." });
    else if (riskScore >= 60) alerts.push({ level: "HIGH", message: "Liquidity risk elevated." });
    if (r.illiquidCount > r.symbolCount * 0.3) alerts.push({ level: "HIGH", message: `${r.illiquidCount} of ${r.symbolCount} symbols are illiquid.` });
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
      logger.warn({ err: err.message }, "[LiqDet] Cache write failed.");
    }
  }

  async getPlatformSummary() {
    return this._getCached("platform");
  }
}

export const liquidityRiskDetector = new LiquidityRiskDetector();
