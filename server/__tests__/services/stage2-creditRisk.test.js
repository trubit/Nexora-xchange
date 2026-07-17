/**
 * Stage 2 — Financial Risk Intelligence
 * Tests: TradingBehaviorScoring, LiquidityRiskDetector (pure-logic paths)
 */

import { describe, test, expect, vi } from "vitest";

vi.mock("../../config/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("../../config/redis.js", () => ({
  redisClients: { cache: null },
  redisEnabled: false,
}));
vi.mock("../../models/CreditScore.js",           () => ({ default: { findOne: vi.fn(), create: vi.fn() } }));
vi.mock("../../models/TradingBehaviorScore.js",  () => ({ default: { findOne: vi.fn(), create: vi.fn() } }));
vi.mock("../../models/RiskReport.js",            () => ({ default: { findOne: vi.fn(), create: vi.fn().mockResolvedValue({}) } }));
vi.mock("../../models/Order.js",                 () => ({ default: { find: vi.fn() } }));
vi.mock("../../models/Trade.js",                 () => ({ default: { find: vi.fn() } }));

import { TradingBehaviorScoring } from "../../services/tradingBehaviorScoring.js";
import { LiquidityRiskDetector }  from "../../services/liquidityRiskDetector.js";

// ── TradingBehaviorScoring internals ─────────────────────────────────────────

describe("TradingBehaviorScoring._classifyTier", () => {
  const svc = new TradingBehaviorScoring();

  const cases = [
    [85,  "CONSERVATIVE"],
    [70,  "MODERATE"],
    [55,  "AGGRESSIVE"],
    [30,  "SPECULATIVE"],
    [10,  "EXTREME"],
    [100, "CONSERVATIVE"],
    [0,   "EXTREME"],
  ];

  test.each(cases)("score %i → tier %s", (score, expected) => {
    expect(svc._classifyTier(score)).toBe(expected);
  });
});

describe("TradingBehaviorScoring._composite", () => {
  const svc = new TradingBehaviorScoring();

  test("composite is bounded between 0 and 100", () => {
    const dims = { consistency: 80, discipline: 60, riskManagement: 70, profitability: 90, marketKnowledge: 50 };
    const score = svc._composite(dims);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test("all-zero dimensions produce composite of 0", () => {
    const dims = { consistency: 0, discipline: 0, riskManagement: 0, profitability: 0, marketKnowledge: 0 };
    expect(svc._composite(dims)).toBe(0);
  });

  test("all-100 dimensions produce composite of 100", () => {
    const dims = { consistency: 100, discipline: 100, riskManagement: 100, profitability: 100, marketKnowledge: 100 };
    expect(svc._composite(dims)).toBe(100);
  });

  test("discipline (weight 0.25) dominates consistency (weight 0.20)", () => {
    // Higher-weighted dimension drives the composite higher when at 100 vs 50
    const highDiscipline  = { consistency: 50, discipline: 100, riskManagement: 50, profitability: 50, marketKnowledge: 50 };
    const highConsistency = { consistency: 100, discipline: 50, riskManagement: 50, profitability: 50, marketKnowledge: 50 };
    expect(svc._composite(highDiscipline)).toBeGreaterThan(svc._composite(highConsistency));
  });
});

describe("TradingBehaviorScoring._detectAnomalies", () => {
  const svc = new TradingBehaviorScoring();

  test("returns empty array for normal sparse trading", () => {
    const now    = Date.now();
    const orders = Array.from({ length: 5 }, (_, i) => ({
      symbol: "BTC/USDT", side: i % 2 === 0 ? "buy" : "sell",
      quantity: 1, price: 100 + i, status: "filled",
      createdAt: new Date(now - i * 3_600_000),  // 1 hour apart
    }));
    const anomalies = svc._detectAnomalies({ orders, trades: [] });
    expect(Array.isArray(anomalies)).toBe(true);
    // Widely-spaced, few orders — no anomalies expected
    expect(anomalies.filter((a) => a.type === "OVERTRADING")).toHaveLength(0);
  });

  test("OVERTRADING flagged when >50 orders in one hour", () => {
    const now    = Date.now();
    // 60 orders, all within the same clock-hour
    const base   = new Date(now);
    base.setMinutes(0, 0, 0);
    const orders = Array.from({ length: 60 }, (_, i) => ({
      symbol: "BTC/USDT", side: "buy",
      quantity: 1, price: 100, status: "filled",
      createdAt: new Date(base.getTime() + i * 30_000),  // 30 s apart, same hour
    }));
    const anomalies = svc._detectAnomalies({ orders, trades: [] });
    const types = anomalies.map((a) => a.type);
    expect(types).toContain("OVERTRADING");
  });

  test("WASH_TRADING_SUSPECT flagged when buy→sell on same symbol within 60 s", () => {
    const now    = Date.now();
    const orders = [
      { symbol: "BTC/USDT", side: "buy",  quantity: 1, price: 100, status: "filled", createdAt: new Date(now) },
      { symbol: "BTC/USDT", side: "sell", quantity: 1, price: 100, status: "filled", createdAt: new Date(now + 5000) },
    ];
    const anomalies = svc._detectAnomalies({ orders, trades: [] });
    expect(anomalies.map((a) => a.type)).toContain("WASH_TRADING_SUSPECT");
  });

  test("CONCENTRATION_RISK flagged when >80% of orders are in one symbol", () => {
    const now    = Date.now();
    const orders = [
      ...Array.from({ length: 9 }, (_, i) => ({
        symbol: "BTC/USDT", side: "buy", quantity: 1, price: 100, status: "filled",
        createdAt: new Date(now - i * 86_400_000),
      })),
      { symbol: "ETH/USDT", side: "buy", quantity: 1, price: 200, status: "filled", createdAt: new Date(now) },
    ];
    const anomalies = svc._detectAnomalies({ orders, trades: [] });
    expect(anomalies.map((a) => a.type)).toContain("CONCENTRATION_RISK");
  });
});

// ── LiquidityRiskDetector — pure functions ───────────────────────────────────
// NOTE: bids/asks are [[price, qty], ...] tuples, not objects

describe("LiquidityRiskDetector.analyseOrderBook", () => {
  const svc = new LiquidityRiskDetector();

  // XYZ/USDT uses DEFAULT thresholds: MAX_SPREAD_PCT=0.5%, MIN_DEPTH_USD=10,000
  const goodBook = {
    symbol: "XYZ/USDT",
    bids: Array.from({ length: 10 }, (_, i) => [100 - i * 0.01, 100]),  // $100 × 100 = $10k per level
    asks: Array.from({ length: 10 }, (_, i) => [100.01 + i * 0.01, 100]),
  };

  test("returns an analysis object with required fields", () => {
    const result = svc.analyseOrderBook(goodBook);
    expect(result).toHaveProperty("spreadAbs");
    expect(result).toHaveProperty("spreadBps");
    expect(result).toHaveProperty("liquidityScore");
    expect(result).toHaveProperty("flags");
    expect(result).toHaveProperty("bidDepthUsd");
    expect(result).toHaveProperty("askDepthUsd");
  });

  test("liquidityScore is between 0 and 100", () => {
    const result = svc.analyseOrderBook(goodBook);
    expect(result.liquidityScore).toBeGreaterThanOrEqual(0);
    expect(result.liquidityScore).toBeLessThanOrEqual(100);
  });

  test("wide spread sets WIDE_SPREAD flag (XYZ DEFAULT threshold is 0.5%)", () => {
    const wideBook = {
      symbol: "XYZ/USDT",
      bids: [[100, 1000]],
      asks: [[102, 1000]],  // 2% spread — well above 0.5% DEFAULT
    };
    const result = svc.analyseOrderBook(wideBook);
    expect(result.flags).toContain("WIDE_SPREAD");
  });

  test("thin book (below MIN_DEPTH_USD) sets THIN_BOOK flag", () => {
    const thinBook = {
      symbol: "XYZ/USDT",      // DEFAULT min depth = $10,000
      bids: [[100, 0.01]],     // $1 of depth — far below $10k
      asks: [[100.01, 0.01]],
    };
    const result = svc.analyseOrderBook(thinBook);
    expect(result.flags).toContain("THIN_BOOK");
  });

  test("empty bids returns NO_DATA flag", () => {
    const result = svc.analyseOrderBook({ symbol: "XYZ/USDT", bids: [], asks: [] });
    expect(result.flags).toContain("NO_DATA");
  });

  test("FEW_BID_LEVELS flagged when fewer than 5 bid levels", () => {
    const result = svc.analyseOrderBook({
      symbol: "XYZ/USDT",
      bids: [[100, 1000]],               // only 1 level
      asks: Array.from({ length: 10 }, (_, i) => [100.01 + i * 0.01, 1000]),
    });
    expect(result.flags).toContain("FEW_BID_LEVELS");
  });
});

describe("LiquidityRiskDetector.estimateSlippage", () => {
  const svc = new LiquidityRiskDetector();

  const analysis = {
    totalDepthUsd: 100000,
    askDepthUsd:   50000,
    bidDepthUsd:   50000,
    spreadPct:     0.05,  // 0.05%
  };

  test("small order has near-zero slippage", () => {
    const result = svc.estimateSlippage("BTC/USDT", 100, "buy", analysis);
    expect(result.estimatedSlippagePct).toBeGreaterThanOrEqual(0);
    expect(result.estimatedSlippagePct).toBeLessThan(0.01);
  });

  test("larger order incurs more slippage than smaller order", () => {
    const small = svc.estimateSlippage("BTC/USDT", 1000,  "buy", analysis);
    const large = svc.estimateSlippage("BTC/USDT", 40000, "buy", analysis);
    expect(large.estimatedSlippagePct).toBeGreaterThan(small.estimatedSlippagePct);
  });

  test("returns canFill and recommendation fields", () => {
    const result = svc.estimateSlippage("BTC/USDT", 1000, "sell", analysis);
    expect(result).toHaveProperty("canFill");
    expect(result).toHaveProperty("recommendation");
    expect(result).toHaveProperty("fillRatio");
  });

  test("no depth data returns slippage of 1 and canFill false", () => {
    const result = svc.estimateSlippage("BTC/USDT", 1000, "buy", { totalDepthUsd: 0 });
    expect(result.estimatedSlippagePct).toBe(1.0);
    expect(result.canFill).toBe(false);
  });
});

describe("LiquidityRiskDetector._computeLiquidityScore", () => {
  const svc = new LiquidityRiskDetector();

  test("score is between 0 and 100", () => {
    // _computeLiquidityScore(spreadPct, maxSpread, depthUsd, minDepth, depthImbalance)
    const score = svc._computeLiquidityScore(0.02, 0.5, 50000, 10000, 0.05);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test("tight spread + deep book scores higher than wide spread + thin book", () => {
    const good = svc._computeLiquidityScore(0.01, 0.5, 200000, 10000, 0.02);
    const bad  = svc._computeLiquidityScore(0.8,  0.5,    100, 10000, 0.9);
    expect(good).toBeGreaterThan(bad);
  });

  test("zero depth gives minimum score", () => {
    const score = svc._computeLiquidityScore(0.5, 0.5, 0, 10000, 1);
    expect(score).toBe(0);
  });
});
