/**
 * Spread Analysis Engine
 *
 * Computes bid-ask spreads, cross-exchange price differentials,
 * and triangular arbitrage surfaces from aggregated market feeds.
 *
 * All operations are pure (no I/O) — feed data is passed in.
 * READ-ONLY analytics — no orders are placed.
 */

const MIN_SPREAD_PCT       = Number(process.env.ARBI_MIN_SPREAD_PCT || 0.001);  // 0.1%
const MAX_SPREAD_PCT       = Number(process.env.ARBI_MAX_SPREAD_PCT || 0.30);   // 30% (filter noise)
const TRIANGULAR_PAIRS_KEY = ["BTC", "ETH", "BNB", "USDT", "USDC", "XRP", "SOL", "ADA"];

export class SpreadAnalysisEngine {
  // ── Core spread metrics ──────────────────────────────────────────────────────

  /**
   * Compute bid-ask spread metrics for a single ticker.
   */
  computeSpread(ticker) {
    const { bid, ask } = ticker;
    if (!bid || !ask || bid <= 0 || ask <= 0) return null;

    const spreadAbs = ask - bid;
    const spreadPct = spreadAbs / ((bid + ask) / 2);
    const mid       = (bid + ask) / 2;

    return {
      exchange:     ticker.exchange,
      symbol:       ticker.symbol,
      bid,
      ask,
      mid,
      spreadAbs:    +spreadAbs.toFixed(8),
      spreadPct:    +spreadPct.toFixed(6),
      spreadBps:    +(spreadPct * 10_000).toFixed(2),
      isLiquid:     spreadPct < 0.005,  // < 50bps = liquid
      ts:           ticker.ts,
    };
  }

  /**
   * Find best bid and best ask across all exchanges for a symbol.
   */
  findBestBidAsk(tickers) {
    // tickers: { exchange → tickerObj }
    let bestBid = { exchange: null, price: -Infinity };
    let bestAsk = { exchange: null, price:  Infinity };

    for (const [exchange, ticker] of Object.entries(tickers)) {
      if (ticker.bid > bestBid.price) bestBid = { exchange, price: ticker.bid, ticker };
      if (ticker.ask < bestAsk.price) bestAsk = { exchange, price: ticker.ask, ticker };
    }

    return { bestBid, bestAsk };
  }

  // ── Cross-exchange arbitrage ──────────────────────────────────────────────────

  /**
   * Detect cross-exchange arbitrage opportunities for a symbol.
   * Returns all opportunities where: buy on exchange A, sell on exchange B.
   */
  detectCrossExchangeArbitrage(symbol, tickers, feeRates = {}) {
    const exchanges  = Object.keys(tickers);
    const results    = [];

    for (let i = 0; i < exchanges.length; i++) {
      for (let j = 0; j < exchanges.length; j++) {
        if (i === j) continue;

        const buyExchange  = exchanges[i];
        const sellExchange = exchanges[j];
        const buyTicker    = tickers[buyExchange];
        const sellTicker   = tickers[sellExchange];

        if (!buyTicker || !sellTicker) continue;

        const buyPrice  = buyTicker.ask;   // we buy at the ask
        const sellPrice = sellTicker.bid;  // we sell at the bid

        if (!buyPrice || !sellPrice || buyPrice <= 0 || sellPrice <= 0) continue;

        const spreadAbs = sellPrice - buyPrice;
        const spreadPct = spreadAbs / buyPrice;

        if (spreadPct < MIN_SPREAD_PCT || spreadPct > MAX_SPREAD_PCT) continue;
        if (spreadAbs <= 0) continue;

        const buyFeeRate  = feeRates[buyExchange]  ?? 0.001;
        const sellFeeRate = feeRates[sellExchange] ?? 0.001;

        results.push({
          type:         "cross_exchange",
          symbol,
          buyExchange,
          sellExchange,
          buyPrice,
          sellPrice,
          spreadAbs:    +spreadAbs.toFixed(8),
          spreadPct:    +spreadPct.toFixed(6),
          spreadBps:    +(spreadPct * 10_000).toFixed(2),
          buyFeeRate,
          sellFeeRate,
          totalFeeRate: buyFeeRate + sellFeeRate,
          netSpreadPct: +(spreadPct - buyFeeRate - sellFeeRate).toFixed(6),
          isProfitable: spreadPct > (buyFeeRate + sellFeeRate),
          ts:           Date.now(),
        });
      }
    }

    // Sort by net spread descending
    return results.sort((a, b) => b.netSpreadPct - a.netSpreadPct);
  }

  // ── Triangular arbitrage ──────────────────────────────────────────────────────

  /**
   * Detect triangular arbitrage opportunity for three symbols on the same exchange.
   * Path: BASE → QUOTE1 → QUOTE2 → BASE (circular)
   *
   * @param {string} exchange
   * @param {Map<string, { bid: number, ask: number }>} priceMap  symbol → ticker
   * @param {number} feeRate  per-trade fee
   */
  detectTriangularArbitrage(exchange, priceMap, feeRate = 0.001) {
    const opportunities = [];
    const symbols       = [...priceMap.keys()];

    // Build triangular path candidates
    const bases = TRIANGULAR_PAIRS_KEY;

    for (const base of bases) {
      // Find all symbols that include this base
      const relatedSymbols = symbols.filter(
        (s) => s.startsWith(base + "/") || s.endsWith("/" + base) ||
               s.startsWith(base + "-") || s.endsWith("-" + base),
      );

      for (let i = 0; i < relatedSymbols.length - 1; i++) {
        for (let j = i + 1; j < relatedSymbols.length; j++) {
          const result = this._evalTriangle(
            exchange,
            base,
            relatedSymbols[i],
            relatedSymbols[j],
            priceMap,
            feeRate,
          );
          if (result) opportunities.push(result);
        }
      }
    }

    return opportunities.sort((a, b) => b.profitPct - a.profitPct);
  }

  _evalTriangle(exchange, base, sym1, sym2, priceMap, feeRate) {
    const t1 = priceMap.get(sym1);
    const t2 = priceMap.get(sym2);
    if (!t1 || !t2) return null;

    // Simplified: assume base/QUOTE1 and base/QUOTE2 where QUOTE1/QUOTE2 also exists
    // Start with 1 unit of base currency
    let amount = 1.0;

    // Step 1: Buy QUOTE1 with BASE  (consume base, receive quote1)
    const step1Price = t1.ask;
    if (!step1Price || step1Price <= 0) return null;
    amount = (amount / step1Price) * (1 - feeRate);

    // Step 2: Buy QUOTE2 with QUOTE1 (need a cross rate)
    const crossSym = this._findCross(sym1, sym2, priceMap);
    if (!crossSym) return null;
    const tCross = priceMap.get(crossSym.symbol);
    if (!tCross) return null;
    amount = crossSym.invert
      ? (amount * tCross.bid) * (1 - feeRate)
      : (amount / tCross.ask) * (1 - feeRate);

    // Step 3: Buy BASE with QUOTE2 (sell QUOTE2 for base)
    const step3Price = t2.bid;
    if (!step3Price || step3Price <= 0) return null;
    amount = (amount * step3Price) * (1 - feeRate);

    const profitPct = amount - 1.0;
    if (profitPct <= 0) return null;

    return {
      type:       "triangular",
      exchange,
      base,
      path:       [sym1, crossSym.symbol, sym2],
      profitPct:  +profitPct.toFixed(6),
      profitBps:  +(profitPct * 10_000).toFixed(2),
      feeRate,
      ts:         Date.now(),
    };
  }

  _findCross(sym1, sym2, priceMap) {
    const q1 = this._extractQuote(sym1);
    const q2 = this._extractQuote(sym2);
    if (!q1 || !q2) return null;

    const direct  = `${q1}/${q2}`;
    const inverse = `${q2}/${q1}`;

    if (priceMap.has(direct))  return { symbol: direct,  invert: false };
    if (priceMap.has(inverse)) return { symbol: inverse, invert: true };
    return null;
  }

  _extractQuote(symbol) {
    const sep = symbol.includes("/") ? "/" : symbol.includes("-") ? "-" : null;
    if (!sep) return null;
    return symbol.split(sep)[1];
  }

  // ── Statistical spread ────────────────────────────────────────────────────────

  /**
   * Compute rolling spread statistics (mean, stddev, z-score).
   * @param {number[]} spreadHistory  array of recent spread values
   * @param {number}   current        current spread value
   */
  computeStatisticalSpread(spreadHistory, current) {
    if (!spreadHistory || spreadHistory.length < 5) {
      return { zscore: 0, mean: current, stddev: 0, isAnomaly: false };
    }

    const n    = spreadHistory.length;
    const mean = spreadHistory.reduce((s, v) => s + v, 0) / n;
    const variance =
      spreadHistory.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    const stddev = Math.sqrt(variance);

    const zscore  = stddev > 0 ? (current - mean) / stddev : 0;
    const isAnomaly = Math.abs(zscore) > 2;

    return {
      zscore:    +zscore.toFixed(4),
      mean:      +mean.toFixed(8),
      stddev:    +stddev.toFixed(8),
      isAnomaly,
      direction: zscore > 0 ? "wide" : "narrow",
    };
  }

  // ── Spread quality score ──────────────────────────────────────────────────────

  /**
   * Score an opportunity 0-100 for execution confidence.
   */
  scoreOpportunity({ spreadPct, netSpreadPct, volume24h, volatility }) {
    let score = 0;

    // Net spread contribution (0-40 pts)
    const netBps = (netSpreadPct || 0) * 10_000;
    score += Math.min(40, netBps * 4);

    // Liquidity contribution (0-30 pts)
    const vol = volume24h || 0;
    score += vol > 5_000_000 ? 30 : vol > 1_000_000 ? 20 : vol > 100_000 ? 10 : 5;

    // Volatility penalty (deduct up to 20 pts)
    const vola = volatility || 0;
    score -= Math.min(20, vola * 100);

    // Spread width bonus (wider gross spread = more buffer)
    const bps = (spreadPct || 0) * 10_000;
    score += Math.min(10, bps * 0.5);

    return Math.max(0, Math.min(100, Math.round(score)));
  }
}

export const spreadAnalysisEngine = new SpreadAnalysisEngine();
