/**
 * Arbitrage Service — Orchestrator
 *
 * Coordinates all components of the arbitrage detection pipeline:
 *   MarketFeedAggregator → SpreadAnalysisEngine → ExecutionSimulator
 *       → ProfitEstimationEngine → Persist → Emit
 *
 * RULE: READ-ONLY analytics + signal generation.
 * This service NEVER places orders, modifies the matching engine,
 * or interacts with the order book in any write capacity.
 */

import { EventEmitter }          from "events";
import { v4 as uuid }            from "uuid";
import ArbitrageOpportunity      from "../models/ArbitrageOpportunity.js";
import { marketFeedAggregator }  from "./marketFeedAggregator.js";
import { spreadAnalysisEngine }  from "./spreadAnalysisEngine.js";
import { executionSimulator }    from "./executionSimulator.js";
import { profitEstimationEngine} from "./profitEstimationEngine.js";
import { redisClients }          from "../config/redis.js";
import logger                    from "../config/logger.js";

const DETECTION_INTERVAL_MS  = Number(process.env.ARBI_DETECT_INTERVAL_MS || 3000);
const MIN_NET_PROFIT_USD      = Number(process.env.ARBI_MIN_NET_PROFIT     || 0.01);
const DEFAULT_ORDER_SIZE_USD  = Number(process.env.ARBI_ORDER_SIZE_USD     || 1000);
const OPPORTUNITY_TTL_MS      = Number(process.env.ARBI_OPPORTUNITY_TTL_MS || 30000);
const REDIS_LIVE_KEY          = "arbi:live";
const REDIS_LIVE_TTL          = 60;  // seconds

export class ArbitrageService extends EventEmitter {
  constructor() {
    super();
    this._running          = false;
    this._timer            = null;
    this._detectedCount    = 0;
    this._profitableCount  = 0;
    this._lastScan         = null;
    this._spreadHistory    = new Map();  // symbol → number[]
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  start() {
    if (this._running) return;
    this._running = true;

    marketFeedAggregator.start();

    // Wire internal market data into the feed aggregator
    marketFeedAggregator.on("snapshot", (snapshot) => {
      this._onSnapshot(snapshot);
    });

    // Run detection on a fixed interval
    this._timer = setInterval(() => this._runDetection(), DETECTION_INTERVAL_MS);
    this._timer.unref();

    logger.info("[Arbi] Arbitrage service started.");
  }

  stop() {
    if (!this._running) return;
    this._running = false;

    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }

    marketFeedAggregator.stop();
    logger.info("[Arbi] Arbitrage service stopped.");
  }

  // ── Feed ingestion bridge ─────────────────────────────────────────────────────

  /**
   * Called by MarketDataService or socket events to feed live prices.
   */
  ingestMarketUpdate(symbol, priceData) {
    marketFeedAggregator.ingestInternal(symbol, priceData);
  }

  // ── Core detection loop ───────────────────────────────────────────────────────

  async _runDetection() {
    if (!this._running) return;

    const snapshot = marketFeedAggregator.getSnapshot();
    const symbols  = Object.keys(snapshot);
    if (symbols.length === 0) return;

    this._lastScan = new Date();
    const allOpportunities = [];

    for (const symbol of symbols) {
      const tickers = snapshot[symbol];
      if (!tickers || Object.keys(tickers).length < 2) continue;

      // Cross-exchange detection
      const crossOpps = spreadAnalysisEngine.detectCrossExchangeArbitrage(symbol, tickers);
      for (const opp of crossOpps) {
        if (!opp.isProfitable) continue;

        const processed = await this._processOpportunity(opp, tickers);
        if (processed) allOpportunities.push(processed);
      }
    }

    // Emit all opportunities
    if (allOpportunities.length > 0) {
      this.emit("opportunities", allOpportunities);
      await this._publishToRedis(allOpportunities);
    }
  }

  _onSnapshot(snapshot) {
    // Update spread history for statistical analysis
    for (const [symbol, tickers] of Object.entries(snapshot)) {
      const { bestBid, bestAsk } = spreadAnalysisEngine.findBestBidAsk(tickers);
      if (bestBid.price > 0 && bestAsk.price < Infinity) {
        const spread = bestAsk.price - bestBid.price;
        const history = this._spreadHistory.get(symbol) || [];
        history.push(spread);
        if (history.length > 100) history.shift();
        this._spreadHistory.set(symbol, history);
      }
    }
  }

  // ── Opportunity processing pipeline ──────────────────────────────────────────

  async _processOpportunity(rawOpp, tickers) {
    try {
      this._detectedCount++;

      // 1. Build opportunity legs
      const legs = this._buildLegs(rawOpp, tickers);

      // 2. Simulate execution
      const sim = executionSimulator.simulate(rawOpp, {
        orderSizeUsd: DEFAULT_ORDER_SIZE_USD,
      });

      // 3. Estimate profit
      const estimation = profitEstimationEngine.estimate(rawOpp, {
        orderSizeUsd:    DEFAULT_ORDER_SIZE_USD,
        executionTimeMs: sim.executionTimeMs,
        slippage:        sim.slippage || 0.0002,
        fillRate:        sim.fillRate,
      });

      if (estimation.netAfterTax < MIN_NET_PROFIT_USD) return null;

      this._profitableCount++;

      // 4. Score and risk-rate the opportunity
      const spreadStats = spreadAnalysisEngine.computeStatisticalSpread(
        this._spreadHistory.get(rawOpp.symbol) || [],
        rawOpp.spreadPct,
      );
      const confidence = Math.min(0.95, Math.max(0.1,
        estimation.marginOfSafety > 0
          ? 0.5 + estimation.marginOfSafety * 50
          : 0.2,
      ));
      const riskScore = spreadAnalysisEngine.scoreOpportunity({
        spreadPct:    rawOpp.spreadPct,
        netSpreadPct: rawOpp.netSpreadPct,
        volume24h:    tickers[rawOpp.buyExchange]?.volume24h,
        volatility:   spreadStats.zscore * 0.01,
      });

      // 5. Persist
      const opportunityId = uuid();
      const doc = await ArbitrageOpportunity.create({
        opportunityId,
        symbol:               rawOpp.symbol,
        type:                 rawOpp.type,
        status:               "simulated",
        legs,
        spreadAbsolute:       rawOpp.spreadAbs,
        spreadPercent:        rawOpp.spreadPct,
        estimatedGrossProfit: estimation.grossRevenue,
        estimatedTotalFees:   estimation.fees.total,
        estimatedNetProfit:   estimation.netAfterTax,
        estimatedNetProfitPct:estimation.netProfitPct,
        executionCostUsd:     estimation.fees.total + estimation.slippageCost,
        confidence,
        riskScore,
        simulation: {
          executionTimeMs: sim.executionTimeMs,
          fillRate:        sim.fillRate,
          actualProfit:    sim.actualProfit,
          slippage:        sim.slippage,
          status:          sim.status,
          reason:          sim.reason,
        },
        marketConditions: {
          volatility: Math.abs(spreadStats.zscore) * 0.01,
          liquidity:  this._estimateLiquidity(tickers),
          volume24h:  tickers[rawOpp.buyExchange]?.volume24h || 0,
          trend:      "sideways",
        },
        detectedAt: new Date(),
        expiresAt:  new Date(Date.now() + OPPORTUNITY_TTL_MS),
      });

      return doc.toObject();
    } catch (err) {
      logger.warn({ err: err.message, symbol: rawOpp.symbol }, "[Arbi] Failed to process opportunity.");
      return null;
    }
  }

  _buildLegs(opp, _tickers) {
    const qty = DEFAULT_ORDER_SIZE_USD / (opp.buyPrice || 1);

    return [
      {
        exchange: opp.buyExchange,
        symbol:   opp.symbol,
        side:     "buy",
        price:    opp.buyPrice,
        quantity: qty,
        feeRate:  opp.buyFeeRate  || 0.001,
        feeCost:  qty * opp.buyPrice * (opp.buyFeeRate || 0.001),
      },
      {
        exchange: opp.sellExchange,
        symbol:   opp.symbol,
        side:     "sell",
        price:    opp.sellPrice,
        quantity: qty,
        feeRate:  opp.sellFeeRate || 0.001,
        feeCost:  qty * opp.sellPrice * (opp.sellFeeRate || 0.001),
      },
    ];
  }

  _estimateLiquidity(tickers) {
    const vols = Object.values(tickers).map((t) => t.volume24h || 0);
    const total = vols.reduce((s, v) => s + v, 0);
    return Math.min(1, total / 10_000_000);  // normalize to 0-1 vs $10M benchmark
  }

  // ── Redis live feed ───────────────────────────────────────────────────────────

  async _publishToRedis(opportunities) {
    const redis = redisClients.cache;
    if (!redis) return;
    try {
      const payload = JSON.stringify(opportunities.slice(0, 20));
      await redis.setex(REDIS_LIVE_KEY, REDIS_LIVE_TTL, payload);
    } catch (err) {
      logger.warn({ err: err.message }, "[Arbi] Redis publish failed.");
    }
  }

  // ── Queries ───────────────────────────────────────────────────────────────────

  async getLiveOpportunities() {
    const redis = redisClients.cache;
    if (redis) {
      try {
        const raw = await redis.get(REDIS_LIVE_KEY);
        if (raw) return JSON.parse(raw);
      } catch { /* fall through to DB */ }
    }
    return ArbitrageOpportunity.find(
      { status: "simulated", expiresAt: { $gt: new Date() } },
      null,
      { sort: { estimatedNetProfit: -1 }, limit: 20 },
    ).lean();
  }

  async getHistory(opts = {}) {
    const { symbol, type, limit = 50, page = 1 } = opts;
    const query = {};
    if (symbol) query.symbol = symbol.toUpperCase();
    if (type)   query.type   = type;

    const [docs, total] = await Promise.all([
      ArbitrageOpportunity.find(query, null, {
        sort:  { detectedAt: -1 },
        skip:  (page - 1) * limit,
        limit: Number(limit),
      }).lean(),
      ArbitrageOpportunity.countDocuments(query),
    ]);

    return { docs, total, page, limit };
  }

  async getStats() {
    const [total, profitable, byType] = await Promise.all([
      ArbitrageOpportunity.countDocuments(),
      ArbitrageOpportunity.countDocuments({ "simulation.status": "profitable" }),
      ArbitrageOpportunity.aggregate([
        { $group: { _id: "$type", count: { $sum: 1 }, avgProfit: { $avg: "$estimatedNetProfit" } } },
      ]),
    ]);

    return {
      service: {
        running:         this._running,
        detectedCount:   this._detectedCount,
        profitableCount: this._profitableCount,
        lastScan:        this._lastScan,
        trackedSymbols:  marketFeedAggregator.getSymbols().length,
        exchanges:       marketFeedAggregator.getExchanges(),
      },
      database: { total, profitable, winRate: total ? profitable / total : 0, byType },
      simulation: executionSimulator.stats(),
    };
  }

  status() {
    return {
      running:         this._running,
      detectedCount:   this._detectedCount,
      profitableCount: this._profitableCount,
      lastScan:        this._lastScan,
    };
  }
}

export const arbitrageService = new ArbitrageService();
