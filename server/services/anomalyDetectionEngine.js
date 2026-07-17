/**
 * AnomalyDetectionEngine — statistical anomaly detection for market data.
 *
 * Methods:
 *   - zscore(series, value) — Z-score of a value against a reference series
 *   - detectVolumeAnomaly(candleWindow) — volume spike detection
 *   - detectPriceManipulation(trades) — wash trade / spoofing heuristics
 *   - detectLiquidityImbalance(book) — bid/ask depth divergence
 *   - forecastVolatility(priceWindow) — EWM-based volatility forecast
 *
 * All methods are pure functions — no I/O, easily testable.
 */

// ── Statistical helpers ───────────────────────────────────────────────────────

function _mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function _stddev(arr) {
  if (arr.length < 2) return 0;
  const m = _mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

// ── Engine class ──────────────────────────────────────────────────────────────

export class AnomalyDetectionEngine {
  constructor({ zscoreThreshold = 2.5, manipulationThreshold = 0.6, imbalanceThreshold = 0.35 } = {}) {
    this.zscoreThreshold      = zscoreThreshold;
    this.manipulationThreshold= manipulationThreshold;
    this.imbalanceThreshold   = imbalanceThreshold;
  }

  /**
   * Compute Z-score of a single value against a reference series.
   * @returns {{ zscore, isAnomaly, mean, stddev }}
   */
  zscore(series, value) {
    const m = _mean(series);
    const s = _stddev(series);
    // When stddev is 0 and value differs from mean, it is definitively anomalous
    const z = s === 0 ? (value === m ? 0 : Math.sign(value - m) * Infinity) : (value - m) / s;
    const isAnomaly = s === 0 ? value !== m : Math.abs(z) > this.zscoreThreshold;
    return { zscore: isFinite(z) ? z : (z > 0 ? 1e9 : -1e9), isAnomaly, mean: m, stddev: s };
  }

  /**
   * Detect volume spike in a window of OHLCV candles.
   * @param {Array<{volume: number}>} candles
   * @returns {{ detected, zscore, anomalyCandle, avgVolume }}
   */
  detectVolumeAnomaly(candles) {
    if (!candles || candles.length < 3) return { detected: false, zscore: 0 };
    const vols = candles.map((c) => c.volume);
    const last  = vols[vols.length - 1];
    const hist  = vols.slice(0, -1);
    const result = this.zscore(hist, last);
    return {
      detected:    result.isAnomaly,
      zscore:      result.zscore,
      avgVolume:   result.mean,
      anomalyVol:  last,
    };
  }

  /**
   * Detect potential price manipulation from recent trades.
   * Heuristics:
   *   1. High self-trade ratio (same address both sides, if available)
   *   2. Rapid alternating buys/sells at similar price (ping-pong)
   *   3. Volume concentration on one side above threshold
   *
   * @param {Array<{side: "buy"|"sell", price: number, quantity: number, timestamp: number}>} trades
   * @returns {{ detected, score, flags }}
   */
  detectPriceManipulation(trades) {
    if (!trades || trades.length < 5) return { detected: false, score: 0, flags: [] };

    const flags = [];
    let score   = 0;

    // 1. Side concentration
    const buys   = trades.filter((t) => t.side === "buy");
    const sells  = trades.filter((t) => t.side === "sell");
    const buyVol  = buys.reduce((s, t) => s + t.quantity, 0);
    const sellVol = sells.reduce((s, t) => s + t.quantity, 0);
    const total   = buyVol + sellVol;
    const sideRatio = total > 0 ? Math.max(buyVol, sellVol) / total : 0;
    if (sideRatio > 0.85) { flags.push("SIDE_CONCENTRATION"); score += 0.3; }

    // 2. Rapid reversal (alternating buy/sell sequences)
    let alternations = 0;
    for (let i = 1; i < trades.length; i++) {
      if (trades[i].side !== trades[i - 1].side) alternations++;
    }
    const altRatio = alternations / (trades.length - 1);
    if (altRatio > 0.7) { flags.push("RAPID_REVERSAL"); score += 0.3; }

    // 3. Tight price range (prices within 0.05% of each other — possible spoofing)
    const prices   = trades.map((t) => t.price);
    const priceMin = Math.min(...prices);
    const priceMax = Math.max(...prices);
    const priceRange = priceMin > 0 ? (priceMax - priceMin) / priceMin : 0;
    if (priceRange < 0.0005 && trades.length > 10) { flags.push("TIGHT_PRICE_RANGE"); score += 0.2; }

    // 4. Volume spike relative to trades
    const avgQty = total / trades.length;
    const maxQty = Math.max(...trades.map((t) => t.quantity));
    if (maxQty > avgQty * 5) { flags.push("VOLUME_SPIKE"); score += 0.2; }

    return {
      detected: score >= this.manipulationThreshold,
      score:    +score.toFixed(3),
      flags,
    };
  }

  /**
   * Detect liquidity imbalance between bid and ask depth.
   * @param {{ bids: Array<{quantity: number}>, asks: Array<{quantity: number}> }} book
   * @returns {{ detected, imbalanceRatio, side, severity }}
   */
  detectLiquidityImbalance(book) {
    if (!book || !book.bids?.length || !book.asks?.length) {
      return { detected: false, imbalanceRatio: 0, side: "neutral" };
    }

    const bidDepth = book.bids.reduce((s, l) => s + l.quantity, 0);
    const askDepth = book.asks.reduce((s, l) => s + l.quantity, 0);
    const total    = bidDepth + askDepth;
    if (total === 0) return { detected: false, imbalanceRatio: 0, side: "neutral" };

    const bidRatio = bidDepth / total;
    const imbalanceRatio = Math.abs(bidRatio - 0.5) * 2;   // 0=balanced, 1=completely one-sided

    const detected = imbalanceRatio > this.imbalanceThreshold;
    const side     = bidRatio > 0.5 ? "bid_heavy" : "ask_heavy";
    const severity = imbalanceRatio > 0.7 ? "HIGH" : imbalanceRatio > 0.5 ? "MEDIUM" : "LOW";

    return { detected, imbalanceRatio: +imbalanceRatio.toFixed(4), side, severity, bidDepth, askDepth };
  }

  /**
   * Forecast near-term volatility using exponentially weighted standard deviation.
   * @param {number[]} priceWindow - recent closing prices (oldest first)
   * @param {number} alpha - EWM decay factor (0 < alpha < 1)
   * @returns {{ volatilityPct, trend, forecast }}
   */
  forecastVolatility(priceWindow, alpha = 0.94) {
    if (!priceWindow || priceWindow.length < 3) {
      return { volatilityPct: 0, trend: "stable", forecast: null };
    }

    // Compute log returns
    const returns = [];
    for (let i = 1; i < priceWindow.length; i++) {
      const prev = priceWindow[i - 1];
      const curr = priceWindow[i];
      if (prev > 0) returns.push(Math.log(curr / prev));
    }

    // EWM variance
    let ewmVar = returns[0] ** 2;
    for (let i = 1; i < returns.length; i++) {
      ewmVar = alpha * ewmVar + (1 - alpha) * returns[i] ** 2;
    }
    const volatilityPct = Math.sqrt(ewmVar) * 100;

    // Simple trend: compare recent half vs older half
    const midpoint = Math.floor(priceWindow.length / 2);
    const oldAvg   = _mean(priceWindow.slice(0, midpoint));
    const newAvg   = _mean(priceWindow.slice(midpoint));
    const trend    = newAvg > oldAvg * 1.001 ? "up" : newAvg < oldAvg * 0.999 ? "down" : "stable";

    return {
      volatilityPct: +volatilityPct.toFixed(6),
      trend,
      forecast: volatilityPct > 1.0 ? "HIGH" : volatilityPct > 0.3 ? "MEDIUM" : "LOW",
    };
  }
}

export const anomalyDetectionEngine = new AnomalyDetectionEngine();
