/**
 * Stage 27 — Autonomous Market Intelligence Core
 * Tests: AnomalyDetectionEngine (pure functions), MarketIntelligenceCore (ingestion, stats)
 */

import { describe, test, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const { mockSignal, mockWhale } = vi.hoisted(() => ({
  mockSignal: {
    create: vi.fn(),
    find:   vi.fn(),
  },
  mockWhale: {
    create: vi.fn(),
    find:   vi.fn(),
  },
}));

vi.mock("../../config/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("../../models/MarketSignal.js",  () => ({ default: mockSignal }));
vi.mock("../../models/WhaleActivity.js", () => ({ default: mockWhale }));

import { AnomalyDetectionEngine }   from "../../services/anomalyDetectionEngine.js";
import { MarketIntelligenceCore }   from "../../services/marketIntelligenceCore.js";

// ── AnomalyDetectionEngine — zscore ──────────────────────────────────────────

describe("AnomalyDetectionEngine.zscore", () => {
  const engine = new AnomalyDetectionEngine();

  test("z-score of a value equal to mean is 0", () => {
    const series = [10, 20, 30, 40, 50];
    const mean   = 30;
    const result = engine.zscore(series, mean);
    expect(result.zscore).toBeCloseTo(0, 3);
    expect(result.isAnomaly).toBe(false);
  });

  test("z-score correctly identifies outlier (>threshold)", () => {
    const series = [10, 10, 10, 10, 10, 10, 10];
    const result = engine.zscore(series, 100);   // extreme outlier
    expect(result.zscore).toBeGreaterThan(2.5);
    expect(result.isAnomaly).toBe(true);
  });

  test("z-score for series with zero stddev returns 0", () => {
    const series = [5, 5, 5, 5, 5];
    const result = engine.zscore(series, 5);
    expect(result.zscore).toBe(0);
    expect(result.stddev).toBe(0);
  });

  test("mean is computed correctly", () => {
    const series = [2, 4, 6, 8, 10];
    const result = engine.zscore(series, 6);
    expect(result.mean).toBeCloseTo(6, 3);
  });

  test("negative z-score for value below mean", () => {
    const series = [10, 20, 30, 40, 50];
    const result = engine.zscore(series, 5);
    expect(result.zscore).toBeLessThan(0);
  });
});

describe("AnomalyDetectionEngine.detectVolumeAnomaly", () => {
  const engine = new AnomalyDetectionEngine({ zscoreThreshold: 2.0 });

  test("returns detected=false with fewer than 3 candles", () => {
    const result = engine.detectVolumeAnomaly([{ volume: 100 }, { volume: 110 }]);
    expect(result.detected).toBe(false);
  });

  test("detects a spike when latest volume is extreme", () => {
    const candles = [
      ...Array(10).fill({ volume: 1000 }),
      { volume: 50000 },  // extreme spike
    ];
    const result = engine.detectVolumeAnomaly(candles);
    expect(result.detected).toBe(true);
    expect(result.zscore).toBeGreaterThan(2.0);
  });

  test("does not flag normal volume variation", () => {
    const candles = [
      { volume: 1000 }, { volume: 1100 }, { volume: 950 }, { volume: 1050 }, { volume: 1020 },
    ];
    const result = engine.detectVolumeAnomaly(candles);
    expect(result.detected).toBe(false);
  });

  test("returns anomalyVol equal to last candle volume", () => {
    const candles = [
      ...Array(5).fill({ volume: 1000 }),
      { volume: 30000 },
    ];
    const result = engine.detectVolumeAnomaly(candles);
    expect(result.anomalyVol).toBe(30000);
  });
});

describe("AnomalyDetectionEngine.detectPriceManipulation", () => {
  const engine = new AnomalyDetectionEngine({ manipulationThreshold: 0.5 });

  test("returns detected=false for fewer than 5 trades", () => {
    const result = engine.detectPriceManipulation([
      { side: "buy", price: 100, quantity: 1 },
      { side: "sell", price: 100, quantity: 1 },
    ]);
    expect(result.detected).toBe(false);
    expect(result.score).toBe(0);
  });

  test("flags SIDE_CONCENTRATION when one side dominates", () => {
    const trades = Array(10).fill({ side: "buy", price: 100, quantity: 1 });
    const result = engine.detectPriceManipulation(trades);
    expect(result.flags).toContain("SIDE_CONCENTRATION");
  });

  test("flags RAPID_REVERSAL for alternating buy/sell pattern", () => {
    const trades = [];
    for (let i = 0; i < 10; i++) {
      trades.push({ side: i % 2 === 0 ? "buy" : "sell", price: 100, quantity: 1 });
    }
    const result = engine.detectPriceManipulation(trades);
    expect(result.flags).toContain("RAPID_REVERSAL");
  });

  test("flags TIGHT_PRICE_RANGE for >10 trades within 0.05% range", () => {
    const trades = Array(12).fill(null).map((_, i) => ({
      side: "buy", price: 100.001 + i * 0.0001, quantity: 1,
    }));
    const result = engine.detectPriceManipulation(trades);
    expect(result.flags).toContain("TIGHT_PRICE_RANGE");
  });

  test("score is a number between 0 and 1", () => {
    const trades = Array(6).fill({ side: "buy", price: 100, quantity: 1 });
    const result = engine.detectPriceManipulation(trades);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});

describe("AnomalyDetectionEngine.detectLiquidityImbalance", () => {
  const engine = new AnomalyDetectionEngine({ imbalanceThreshold: 0.35 });

  test("returns detected=false for empty book", () => {
    const result = engine.detectLiquidityImbalance({ bids: [], asks: [] });
    expect(result.detected).toBe(false);
  });

  test("detects bid-heavy imbalance", () => {
    const bids = Array(9).fill({ quantity: 10 });   // 90 total bid
    const asks = [{ quantity: 10 }];                // 10 total ask
    const result = engine.detectLiquidityImbalance({ bids, asks });
    expect(result.detected).toBe(true);
    expect(result.side).toBe("bid_heavy");
  });

  test("detects ask-heavy imbalance", () => {
    const bids = [{ quantity: 5 }];
    const asks = Array(9).fill({ quantity: 10 });
    const result = engine.detectLiquidityImbalance({ bids, asks });
    expect(result.detected).toBe(true);
    expect(result.side).toBe("ask_heavy");
  });

  test("does not detect imbalance for balanced book", () => {
    const bids = Array(5).fill({ quantity: 10 });
    const asks = Array(5).fill({ quantity: 10 });
    const result = engine.detectLiquidityImbalance({ bids, asks });
    expect(result.detected).toBe(false);
    expect(result.imbalanceRatio).toBeCloseTo(0, 2);
  });

  test("includes bidDepth and askDepth in result", () => {
    const bids = [{ quantity: 5 }, { quantity: 5 }];
    const asks = [{ quantity: 5 }, { quantity: 5 }];
    const result = engine.detectLiquidityImbalance({ bids, asks });
    expect(result.bidDepth).toBe(10);
    expect(result.askDepth).toBe(10);
  });
});

describe("AnomalyDetectionEngine.forecastVolatility", () => {
  const engine = new AnomalyDetectionEngine();

  test("returns volatilityPct=0 with fewer than 3 prices", () => {
    const result = engine.forecastVolatility([100, 101]);
    expect(result.volatilityPct).toBe(0);
    expect(result.trend).toBe("stable");
    expect(result.forecast).toBeNull();
  });

  test("detects uptrend in rising price window", () => {
    const prices = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110];
    const result = engine.forecastVolatility(prices);
    expect(result.trend).toBe("up");
  });

  test("detects downtrend in falling price window", () => {
    const prices = [110, 109, 108, 107, 106, 105, 104, 103, 102, 101, 100];
    const result = engine.forecastVolatility(prices);
    expect(result.trend).toBe("down");
  });

  test("forecast is one of LOW, MEDIUM, HIGH", () => {
    const prices = [100, 101, 99, 103, 97, 105, 95, 107, 93, 109, 91];
    const result = engine.forecastVolatility(prices);
    expect(["LOW", "MEDIUM", "HIGH"]).toContain(result.forecast);
  });

  test("volatilityPct is 0 for flat price series", () => {
    const prices = [100, 100, 100, 100, 100];
    const result = engine.forecastVolatility(prices);
    expect(result.volatilityPct).toBe(0);
  });

  test("high volatility series gets HIGH forecast", () => {
    // Wild price swings
    const prices = [100, 200, 50, 300, 10, 500, 5, 400, 20, 600, 15];
    const result = engine.forecastVolatility(prices);
    expect(result.forecast).toBe("HIGH");
  });
});

// ── MarketIntelligenceCore ────────────────────────────────────────────────────

describe("MarketIntelligenceCore — lifecycle", () => {
  test("instantiates with zero stats", () => {
    const core = new MarketIntelligenceCore();
    const stats = core.getStats();
    expect(stats.signals).toBe(0);
    expect(stats.whales).toBe(0);
    expect(stats.scans).toBe(0);
    expect(stats.running).toBe(false);
    expect(stats.trackedPairs).toBe(0);
  });

  test("stop() is safe before start()", () => {
    const core = new MarketIntelligenceCore();
    expect(() => core.stop()).not.toThrow();
  });
});

describe("MarketIntelligenceCore.ingestCandle", () => {
  test("initialises window for new pair", () => {
    const core = new MarketIntelligenceCore();
    core.ingestCandle("BTC/USDT", { open: 60000, close: 60100, volume: 10, timestamp: Date.now() });
    expect(core._windows.has("BTC/USDT")).toBe(true);
    expect(core.getStats().trackedPairs).toBe(1);
  });

  test("window trims to WINDOW_SIZE (20)", () => {
    const core = new MarketIntelligenceCore();
    for (let i = 0; i < 30; i++) {
      core.ingestCandle("ETH/USDT", { open: 3500, close: 3500 + i, volume: 100, timestamp: Date.now() });
    }
    const w = core._windows.get("ETH/USDT");
    expect(w.prices.length).toBeLessThanOrEqual(20);
  });
});

describe("MarketIntelligenceCore.ingestTrade", () => {
  test("adds trade to the pair's trade window", () => {
    const core = new MarketIntelligenceCore();
    core.ingestTrade("BTC/USDT", { side: "buy", price: 60000, quantity: 0.5, timestamp: Date.now() });
    const w = core._windows.get("BTC/USDT");
    expect(w.trades.length).toBe(1);
    expect(w.trades[0].side).toBe("buy");
  });

  test("trade window trims to 100 entries", () => {
    const core = new MarketIntelligenceCore();
    for (let i = 0; i < 110; i++) {
      core.ingestTrade("BTC/USDT", { side: "buy", price: 60000, quantity: 1, timestamp: Date.now() });
    }
    expect(core._windows.get("BTC/USDT").trades.length).toBe(100);
  });
});

describe("MarketIntelligenceCore.ingestWhaleTransaction", () => {
  beforeEach(() => vi.resetAllMocks());

  test("returns null for amount below WHALE_USD threshold", async () => {
    const core = new MarketIntelligenceCore();
    const result = await core.ingestWhaleTransaction({ pair: "BTC/USDT", amountUsd: 1000 });
    expect(result).toBeNull();
    expect(mockWhale.create).not.toHaveBeenCalled();
  });

  test("creates signal and whale record for large transaction", async () => {
    const signalDoc = { _id: "sig1", type: "WHALE_MOVE", toObject: () => ({ _id: "sig1" }) };
    const whaleDoc  = { _id: "w1", amountUsd: 200000, toObject: () => ({ _id: "w1", amountUsd: 200000 }) };
    mockSignal.create.mockResolvedValueOnce(signalDoc);
    mockWhale.create.mockResolvedValueOnce(whaleDoc);
    const core = new MarketIntelligenceCore();
    const result = await core.ingestWhaleTransaction({
      pair: "BTC/USDT", side: "buy", amountUsd: 200000,
      price: 60000, source: "exchange",
    });
    expect(mockSignal.create).toHaveBeenCalledOnce();
    expect(mockWhale.create).toHaveBeenCalledOnce();
    expect(result.amountUsd).toBe(200000);
    expect(core.getStats().whales).toBe(1);
  });

  test("emits 'whale' event after recording", async () => {
    const signalDoc = { _id: "sig2", toObject: () => ({}) };
    const whaleDoc  = { _id: "w2", amountUsd: 500000, toObject: () => ({ _id: "w2" }) };
    mockSignal.create.mockResolvedValueOnce(signalDoc);
    mockWhale.create.mockResolvedValueOnce(whaleDoc);
    const core = new MarketIntelligenceCore();
    const listener = vi.fn();
    core.on("whale", listener);
    await core.ingestWhaleTransaction({ pair: "ETH/USDT", amountUsd: 500000, source: "blockchain" });
    expect(listener).toHaveBeenCalledOnce();
    core.off("whale", listener);
  });

  test("CRITICAL severity for amount > 10× WHALE_USD threshold", async () => {
    let capturedSignal;
    // Use mockImplementationOnce only (no redundant mockResolvedValueOnce before it)
    mockSignal.create.mockImplementationOnce((payload) => {
      capturedSignal = payload;
      return { _id: "sig3", toObject: () => payload };
    });
    mockWhale.create.mockResolvedValueOnce({ _id: "w3", amountUsd: 2000000, toObject: () => ({}) });

    const core = new MarketIntelligenceCore();
    await core.ingestWhaleTransaction({ pair: "BTC/USDT", amountUsd: 2000000, source: "exchange" });
    expect(capturedSignal.severity).toBe("CRITICAL");
  });
});

describe("MarketIntelligenceCore.getSignals", () => {
  beforeEach(() => vi.resetAllMocks());

  test("returns results from MarketSignal.find", async () => {
    const fakeSignals = [{ type: "WHALE_MOVE", pair: "BTC/USDT", confidence: 0.9 }];
    const chainMock   = { sort: vi.fn().mockReturnThis(), skip: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue(fakeSignals) };
    mockSignal.find.mockReturnValueOnce(chainMock);
    const core = new MarketIntelligenceCore();
    const result = await core.getSignals({ pair: "BTC/USDT" });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("WHALE_MOVE");
  });
});

describe("MarketIntelligenceCore.createSignal", () => {
  beforeEach(() => vi.resetAllMocks());

  test("persists signal and emits 'signal' event", async () => {
    const sigDoc = { _id: "s1", type: "ANOMALY", pair: "ETH/USDT", toObject: () => ({ type: "ANOMALY" }) };
    mockSignal.create.mockResolvedValueOnce(sigDoc);
    const core     = new MarketIntelligenceCore();
    const listener = vi.fn();
    core.on("signal", listener);
    await core.createSignal({ type: "ANOMALY", pair: "ETH/USDT", confidence: 0.7 });
    expect(listener).toHaveBeenCalledOnce();
    expect(core.getStats().signals).toBe(1);
    core.off("signal", listener);
  });

  test("returns null and does not throw when create fails", async () => {
    mockSignal.create.mockRejectedValueOnce(new Error("DB error"));
    const core = new MarketIntelligenceCore();
    const result = await core.createSignal({ type: "ANOMALY", pair: "BTC/USDT", confidence: 0.5 });
    expect(result).toBeNull();
  });
});
