/**
 * Stage 1 — Arbitrage Detection & Execution System
 * Tests: SpreadAnalysisEngine, ProfitEstimationEngine, ExecutionSimulator
 */

import { describe, test, expect, vi, beforeEach } from "vitest";

// ── Silence logger & Redis for all Stage 1 modules ────────────────────────────
vi.mock("../../config/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("../../config/redis.js", () => ({
  redisClients: { cache: null, pubsub: null },
  redisEnabled: false,
}));
vi.mock("../../models/ArbitrageOpportunity.js", () => ({
  default: { create: vi.fn().mockResolvedValue({ toObject: () => ({}) }) },
}));

import { SpreadAnalysisEngine }    from "../../services/spreadAnalysisEngine.js";
import { ProfitEstimationEngine }  from "../../services/profitEstimationEngine.js";
import { ExecutionSimulator }      from "../../services/executionSimulator.js";

// ── SpreadAnalysisEngine ──────────────────────────────────────────────────────

describe("SpreadAnalysisEngine.computeSpread", () => {
  const engine = new SpreadAnalysisEngine();

  test("returns correct spread metrics for a valid ticker", () => {
    const result = engine.computeSpread({ bid: 100, ask: 101, exchange: "binance_sim", symbol: "BTC/USDT", ts: Date.now() });
    expect(result).not.toBeNull();
    expect(result.spreadAbs).toBeCloseTo(1, 5);
    expect(result.spreadPct).toBeGreaterThan(0);
    expect(result.spreadBps).toBeGreaterThan(0);
    expect(result.mid).toBeCloseTo(100.5, 2);
  });

  test("returns null for zero bid", () => {
    expect(engine.computeSpread({ bid: 0, ask: 100, exchange: "x", symbol: "X", ts: 0 })).toBeNull();
  });

  test("returns null for zero ask", () => {
    expect(engine.computeSpread({ bid: 100, ask: 0, exchange: "x", symbol: "X", ts: 0 })).toBeNull();
  });

  test("isLiquid is true when spread is under 50 bps", () => {
    const r = engine.computeSpread({ bid: 1000, ask: 1001, exchange: "x", symbol: "ETH/USDT", ts: 0 });
    expect(r.isLiquid).toBe(true);
  });

  test("isLiquid is false when spread exceeds 50 bps", () => {
    const r = engine.computeSpread({ bid: 100, ask: 110, exchange: "x", symbol: "X", ts: 0 });
    expect(r.isLiquid).toBe(false);
  });
});

describe("SpreadAnalysisEngine.findBestBidAsk", () => {
  const engine = new SpreadAnalysisEngine();

  test("finds highest bid and lowest ask across exchanges", () => {
    const tickers = {
      binance_sim:  { bid: 100, ask: 101, exchange: "binance_sim",  volume: 100 },
      coinbase_sim: { bid: 101, ask: 102, exchange: "coinbase_sim", volume: 80  },
      kraken_sim:   { bid:  99, ask: 100, exchange: "kraken_sim",   volume: 60  },
    };
    const result = engine.findBestBidAsk(tickers);
    expect(result.bestBid.exchange).toBe("coinbase_sim");
    expect(result.bestBid.price).toBe(101);
    expect(result.bestAsk.exchange).toBe("kraken_sim");
    expect(result.bestAsk.price).toBe(100);
  });

  test("returns null prices for empty tickers", () => {
    const result = engine.findBestBidAsk({});
    expect(result.bestBid.exchange).toBeNull();
    expect(result.bestAsk.exchange).toBeNull();
  });
});

describe("SpreadAnalysisEngine.detectCrossExchangeArbitrage", () => {
  const engine = new SpreadAnalysisEngine();
  const feeRates = { binance_sim: 0.001, coinbase_sim: 0.006 };

  test("detects profitable opportunity when spread exceeds fees", () => {
    const tickers = {
      binance_sim:  { bid: 200, ask: 201, exchange: "binance_sim",  volume: 100 },
      coinbase_sim: { bid: 210, ask: 211, exchange: "coinbase_sim", volume: 80  },
    };
    const opps = engine.detectCrossExchangeArbitrage("BTC/USDT", tickers, feeRates);
    expect(opps.length).toBeGreaterThan(0);
    expect(opps[0].buyExchange).toBe("binance_sim");
    expect(opps[0].sellExchange).toBe("coinbase_sim");
    expect(opps[0].netSpreadPct).toBeGreaterThan(0);
  });

  test("returns empty array when spread is too small to be profitable", () => {
    const tickers = {
      binance_sim:  { bid: 100, ask: 100.01, exchange: "binance_sim",  volume: 100 },
      coinbase_sim: { bid: 100, ask: 100.02, exchange: "coinbase_sim", volume: 80  },
    };
    const opps = engine.detectCrossExchangeArbitrage("BTC/USDT", tickers, feeRates);
    expect(opps).toHaveLength(0);
  });
});

describe("SpreadAnalysisEngine.scoreOpportunity", () => {
  const engine = new SpreadAnalysisEngine();

  test("returns a score between 0 and 100", () => {
    const score = engine.scoreOpportunity({
      netSpreadPct: 0.01, volume: 10000, volatility: 0.02, confidence: 0.8,
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test("larger spread produces higher score", () => {
    // netSpreadPct:0.0001 → 1 bps → score component 4; 0.005 → 50 bps → capped 40
    const low  = engine.scoreOpportunity({ netSpreadPct: 0.0001, volume24h: 0, volatility: 0 });
    const high = engine.scoreOpportunity({ netSpreadPct: 0.005,  volume24h: 0, volatility: 0 });
    expect(high).toBeGreaterThan(low);
  });
});

// ── ProfitEstimationEngine ────────────────────────────────────────────────────

describe("ProfitEstimationEngine.estimate", () => {
  const engine = new ProfitEstimationEngine();

  const baseOpp = {
    buyExchange:  "trusonxchanger",
    sellExchange: "binance_sim",
    spreadPct:    0.02,   // 2% gross spread
  };

  test("returns a profit estimation object with all expected keys", () => {
    const result = engine.estimate(baseOpp, { orderSizeUsd: 1000 });
    expect(result).toHaveProperty("grossRevenue");
    expect(result).toHaveProperty("fees");
    expect(result).toHaveProperty("netAfterTax");
    expect(result).toHaveProperty("roi");
    expect(result).toHaveProperty("riskAdjustedEV");
    expect(result).toHaveProperty("isProfitable");
    expect(result).toHaveProperty("breakEvenSpreadPct");
  });

  test("grossRevenue is positive for a 2% spread opportunity", () => {
    const result = engine.estimate(baseOpp, { orderSizeUsd: 1000 });
    expect(result.grossRevenue).toBeGreaterThan(0);
  });

  test("larger capital produces proportionally larger gross revenue", () => {
    const small = engine.estimate(baseOpp, { orderSizeUsd: 1000 });
    const large = engine.estimate(baseOpp, { orderSizeUsd: 5000 });
    expect(large.grossRevenue).toBeCloseTo(small.grossRevenue * 5, 0);
  });

  test("isProfitable is false when spread is below total fees", () => {
    const tinyOpp = { ...baseOpp, spreadPct: 0.00001 };  // 0.001% — way below fees
    const result  = engine.estimate(tinyOpp, { orderSizeUsd: 100 });
    expect(result.isProfitable).toBe(false);
  });

  test("total fees are positive", () => {
    const result = engine.estimate(baseOpp, { orderSizeUsd: 1000 });
    expect(result.fees.total).toBeGreaterThan(0);
  });
});

describe("ProfitEstimationEngine.computeBreakEven", () => {
  const engine = new ProfitEstimationEngine();

  test("returns a minimumSpreadPct greater than 0", () => {
    const result = engine.computeBreakEven("trusonxchanger", "binance_sim", 1000);
    expect(result.minimumSpreadPct).toBeGreaterThan(0);
  });

  test("returns feesUsd and slippageUsd for the given capital", () => {
    const result = engine.computeBreakEven("trusonxchanger", "binance_sim", 1000);
    expect(result.feesUsd).toBeGreaterThan(0);
    expect(result.slippageUsd).toBeGreaterThan(0);
  });
});

// ── ExecutionSimulator ────────────────────────────────────────────────────────

describe("ExecutionSimulator", () => {
  const sim = new ExecutionSimulator();

  const crossOpp = {
    type:        "cross_exchange",
    buyExchange: "trusonxchanger",
    sellExchange:"binance_sim",
    spreadPct:   0.02,
    legs: [
      { exchange: "trusonxchanger", side: "buy",  price: 100, quantity: 10, feeRate: 0.001 },
      { exchange: "binance_sim",    side: "sell", price: 102, quantity: 10, feeRate: 0.001 },
    ],
  };

  test("simulate returns a result with status, executionTimeMs and fillRate", () => {
    const result = sim.simulate(crossOpp, { orderSizeUsd: 1000 });
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("executionTimeMs");
    expect(result).toHaveProperty("fillRate");
    expect(result.executionTimeMs).toBeGreaterThan(0);
    expect(result.fillRate).toBeGreaterThan(0);
    expect(result.fillRate).toBeLessThanOrEqual(1);
  });

  test("slippage is non-negative", () => {
    const result = sim.simulate(crossOpp, { orderSizeUsd: 1000 });
    expect(result.slippage).toBeGreaterThanOrEqual(0);
  });

  test("simulateBatch returns one result per opportunity", () => {
    const opps = [crossOpp, crossOpp];
    const results = sim.simulateBatch(opps, { orderSizeUsd: 500 });
    expect(results).toHaveLength(2);
  });
});
