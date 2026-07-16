import { arbitrageService }        from "../services/arbitrageService.js";
import { marketFeedAggregator }    from "../services/marketFeedAggregator.js";
import { spreadAnalysisEngine }    from "../services/spreadAnalysisEngine.js";
import { executionSimulator }      from "../services/executionSimulator.js";
import { profitEstimationEngine }  from "../services/profitEstimationEngine.js";
import ArbitrageOpportunity        from "../models/ArbitrageOpportunity.js";
import logger                      from "../config/logger.js";

// ── GET /api/arbitrage/live ────────────────────────────────────────────────────
export const getLiveOpportunities = async (req, res) => {
  try {
    const opportunities = await arbitrageService.getLiveOpportunities();
    res.json({ ok: true, count: opportunities.length, opportunities });
  } catch (err) {
    logger.error({ err: err.message }, "[Arbi] getLiveOpportunities error");
    res.status(500).json({ message: "Internal server error" });
  }
};

// ── GET /api/arbitrage/history ─────────────────────────────────────────────────
export const getHistory = async (req, res) => {
  try {
    const { symbol, type, limit = 50, page = 1 } = req.query;

    // Validate pagination
    const limitNum = Math.min(Number(limit) || 50, 200);
    const pageNum  = Math.max(Number(page)  || 1,  1);

    const result = await arbitrageService.getHistory({
      symbol, type, limit: limitNum, page: pageNum,
    });

    res.json({
      ok:   true,
      ...result,
      totalPages: Math.ceil(result.total / limitNum),
    });
  } catch (err) {
    logger.error({ err: err.message }, "[Arbi] getHistory error");
    res.status(500).json({ message: "Internal server error" });
  }
};

// ── GET /api/arbitrage/stats ───────────────────────────────────────────────────
export const getStats = async (req, res) => {
  try {
    const stats = await arbitrageService.getStats();
    res.json({ ok: true, ...stats });
  } catch (err) {
    logger.error({ err: err.message }, "[Arbi] getStats error");
    res.status(500).json({ message: "Internal server error" });
  }
};

// ── GET /api/arbitrage/snapshot ────────────────────────────────────────────────
export const getMarketSnapshot = async (req, res) => {
  try {
    const snapshot = marketFeedAggregator.getSnapshot();
    const symbols  = Object.keys(snapshot);

    // Compute spread metrics per symbol
    const enriched = {};
    for (const symbol of symbols) {
      const tickers    = snapshot[symbol];
      const spreads    = {};
      const crossOpps  = spreadAnalysisEngine.detectCrossExchangeArbitrage(symbol, tickers);
      const { bestBid, bestAsk } = spreadAnalysisEngine.findBestBidAsk(tickers);

      for (const [exchange, ticker] of Object.entries(tickers)) {
        spreads[exchange] = spreadAnalysisEngine.computeSpread(ticker);
      }

      enriched[symbol] = {
        tickers,
        spreads,
        bestBid,
        bestAsk,
        crossExchangeOpportunities: crossOpps.slice(0, 5),
      };
    }

    res.json({ ok: true, symbols: symbols.length, snapshot: enriched });
  } catch (err) {
    logger.error({ err: err.message }, "[Arbi] getMarketSnapshot error");
    res.status(500).json({ message: "Internal server error" });
  }
};

// ── POST /api/arbitrage/simulate ───────────────────────────────────────────────
export const simulateOpportunity = async (req, res) => {
  try {
    const { symbol, buyExchange, sellExchange, orderSizeUsd = 1000 } = req.body;

    // Input validation
    if (!symbol || !buyExchange || !sellExchange) {
      return res.status(400).json({ message: "symbol, buyExchange and sellExchange are required" });
    }
    const size = Math.min(Math.max(Number(orderSizeUsd) || 1000, 1), 1_000_000);

    const tickers = marketFeedAggregator.getTickersForSymbol(symbol);
    if (!tickers[buyExchange] || !tickers[sellExchange]) {
      return res.status(404).json({ message: "No price data available for the specified exchanges" });
    }

    const crossOpps = spreadAnalysisEngine.detectCrossExchangeArbitrage(symbol, {
      [buyExchange]:  tickers[buyExchange],
      [sellExchange]: tickers[sellExchange],
    });

    if (crossOpps.length === 0) {
      return res.json({ ok: true, message: "No arbitrage opportunity detected at current prices", tickers });
    }

    const opp  = crossOpps[0];
    const sim  = executionSimulator.simulate(opp, { orderSizeUsd: size });
    const est  = profitEstimationEngine.estimate(opp, {
      orderSizeUsd:    size,
      executionTimeMs: sim.executionTimeMs,
      slippage:        sim.slippage || 0.0002,
      fillRate:        sim.fillRate,
    });
    const breakEven = profitEstimationEngine.computeBreakEven(buyExchange, sellExchange, size);
    const scale     = profitEstimationEngine.scaleAnalysis(opp);

    res.json({
      ok: true,
      opportunity: opp,
      simulation:  sim,
      estimation:  est,
      breakEven,
      scaleAnalysis: scale,
    });
  } catch (err) {
    logger.error({ err: err.message }, "[Arbi] simulateOpportunity error");
    res.status(500).json({ message: "Internal server error" });
  }
};

// ── GET /api/arbitrage/:id ─────────────────────────────────────────────────────
export const getOpportunityById = async (req, res) => {
  try {
    const doc = await ArbitrageOpportunity.findOne({ opportunityId: req.params.id }).lean();
    if (!doc) return res.status(404).json({ message: "Opportunity not found" });
    res.json({ ok: true, opportunity: doc });
  } catch (err) {
    logger.error({ err: err.message }, "[Arbi] getOpportunityById error");
    res.status(500).json({ message: "Internal server error" });
  }
};

// ── GET /api/arbitrage/exchanges ───────────────────────────────────────────────
export const getExchanges = async (_req, res) => {
  try {
    const exchanges = marketFeedAggregator.getExchanges();
    res.json({ ok: true, exchanges });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// ── GET /api/arbitrage/symbols ─────────────────────────────────────────────────
export const getTrackedSymbols = async (_req, res) => {
  try {
    const symbols = marketFeedAggregator.getSymbols();
    res.json({ ok: true, symbols, count: symbols.length });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};
