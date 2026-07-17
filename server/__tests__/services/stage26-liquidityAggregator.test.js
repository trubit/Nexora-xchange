/**
 * Stage 26 — Global Liquidity Aggregation Network
 * Tests: LiquidityAggregatorService, AggregatedOrderBookEngine (merging logic),
 *        SmartOrderSplitter (routing plans and slippage)
 */

import { describe, test, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const { mockProvider, mockAggBook } = vi.hoisted(() => ({
  mockProvider: {
    find:              vi.fn(),
    create:            vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
  mockAggBook: {
    insertMany: vi.fn(),
  },
}));

vi.mock("../../config/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("../../config/redis.js", () => ({
  redisClients: { cache: null }, redisEnabled: false,
}));
vi.mock("../../models/LiquidityProvider.js", () => ({ default: mockProvider }));
vi.mock("../../models/AggregatedBook.js",    () => ({ default: mockAggBook }));

// ── Import real classes for unit testing ─────────────────────────────────────
import { LiquidityAggregatorService } from "../../services/liquidityAggregatorService.js";
import { AggregatedOrderBookEngine, aggregatedOrderBookEngine as aggEngSingleton } from "../../services/aggregatedOrderBookEngine.js";
import { SmartOrderSplitter }         from "../../services/smartOrderSplitter.js";

// ── LiquidityAggregatorService ────────────────────────────────────────────────

describe("LiquidityAggregatorService — constructor & lifecycle", () => {
  test("instantiates with correct initial stats", () => {
    const svc = new LiquidityAggregatorService();
    const stats = svc.getStats();
    expect(stats.polls).toBe(0);
    expect(stats.failures).toBe(0);
    expect(stats.running).toBe(false);
  });

  test("stop() is safe to call without start()", () => {
    const svc = new LiquidityAggregatorService();
    expect(() => svc.stop()).not.toThrow();
  });

  test("getProviders() returns empty array initially", () => {
    const svc = new LiquidityAggregatorService();
    expect(svc.getProviders()).toEqual([]);
  });
});

describe("LiquidityAggregatorService.getProviders", () => {
  test("returns summary objects without apiKey field", () => {
    const svc = new LiquidityAggregatorService();
    svc._providers.set("prov1", {
      config: {
        _id: "prov1", name: "Binance", type: "cex",
        pairs: ["BTC/USDT"], healthy: true, priority: 1, apiKey: "SECRET",
      },
      book: null, failCount: 0,
    });
    const list = svc.getProviders();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Binance");
    expect(list[0]).not.toHaveProperty("apiKey");
  });

  test("includes healthy status and fail count", () => {
    const svc = new LiquidityAggregatorService();
    svc._providers.set("p2", {
      config: { _id: "p2", name: "OKX", type: "cex", pairs: [], healthy: false, priority: 3 },
      book: null, failCount: 5,
    });
    const list = svc.getProviders();
    expect(list[0].healthy).toBe(false);
    expect(list[0].failCount).toBe(5);
  });
});

describe("LiquidityAggregatorService.registerProvider", () => {
  beforeEach(() => vi.clearAllMocks());

  test("creates a provider and adds to internal registry", async () => {
    const docResult = {
      _id: "p1", name: "Kraken", type: "cex", pairs: ["ETH/USDT"],
      toObject: () => ({ _id: "p1", name: "Kraken", type: "cex", pairs: ["ETH/USDT"] }),
    };
    mockProvider.create.mockResolvedValueOnce(docResult);
    const svc = new LiquidityAggregatorService();
    const result = await svc.registerProvider({ name: "Kraken", type: "cex" });
    expect(mockProvider.create).toHaveBeenCalledOnce();
    expect(result.name).toBe("Kraken");
    expect(svc._providers.has("p1")).toBe(true);
    expect(svc.getStats().providers).toBe(1);
  });
});

describe("LiquidityAggregatorService.disableProvider", () => {
  beforeEach(() => vi.clearAllMocks());

  test("removes provider and updates DB", async () => {
    mockProvider.findByIdAndUpdate.mockResolvedValueOnce({});
    const svc = new LiquidityAggregatorService();
    svc._providers.set("p1", {
      config: { _id: "p1", name: "Test" }, book: null, failCount: 0,
    });
    await svc.disableProvider("p1");
    expect(svc._providers.has("p1")).toBe(false);
    expect(mockProvider.findByIdAndUpdate).toHaveBeenCalledWith("p1", { enabled: false, healthy: false });
  });
});

describe("LiquidityAggregatorService.getAllProviderBooks", () => {
  test("returns books from all providers for a pair", () => {
    const svc = new LiquidityAggregatorService();
    svc._providers.set("p1", {
      config: { name: "A" },
      book: { "BTC/USDT": { bids: [[59900, 1]], asks: [[60100, 1]], updatedAt: Date.now() } },
      failCount: 0,
    });
    svc._providers.set("p2", {
      config: { name: "B" },
      book: { "BTC/USDT": { bids: [[59950, 0.5]], asks: [[60050, 0.5]], updatedAt: Date.now() } },
      failCount: 0,
    });
    const books = svc.getAllProviderBooks("BTC/USDT");
    expect(books).toHaveLength(2);
    expect(books[0]).toHaveProperty("bids");
    expect(books[0]).toHaveProperty("providerId");
  });

  test("returns empty array for unknown pair", () => {
    const svc = new LiquidityAggregatorService();
    expect(svc.getAllProviderBooks("UNKNOWN/PAIR")).toEqual([]);
  });

  test("excludes providers with no book for the pair", () => {
    const svc = new LiquidityAggregatorService();
    svc._providers.set("p1", {
      config: { name: "A" },
      book: { "ETH/USDT": { bids: [], asks: [] } },
      failCount: 0,
    });
    expect(svc.getAllProviderBooks("BTC/USDT")).toHaveLength(0);
  });
});

describe("LiquidityAggregatorService.getProviderBook", () => {
  test("returns book for a specific provider and pair", () => {
    const svc = new LiquidityAggregatorService();
    const bookData = { bids: [[60000, 1]], asks: [[60100, 1]], updatedAt: Date.now() };
    svc._providers.set("p1", { config: { name: "X" }, book: { "BTC/USDT": bookData }, failCount: 0 });
    const result = svc.getProviderBook("p1", "BTC/USDT");
    expect(result).toBe(bookData);
  });

  test("returns null for unknown provider", () => {
    const svc = new LiquidityAggregatorService();
    expect(svc.getProviderBook("unknown", "BTC/USDT")).toBeNull();
  });
});

// ── AggregatedOrderBookEngine.mergeBooks ──────────────────────────────────────

describe("AggregatedOrderBookEngine.mergeBooks", () => {
  const engine = new AggregatedOrderBookEngine();

  test("merges bids from two providers at same price level", () => {
    const books = [
      { providerId: "p1", bids: [[59900, 1.0]], asks: [[60100, 1.0]] },
      { providerId: "p2", bids: [[59900, 0.5]], asks: [[60100, 0.5]] },
    ];
    const merged = engine.mergeBooks(books);
    const bid59900 = merged.bids.find((b) => b.price === 59900);
    expect(bid59900).toBeTruthy();
    expect(bid59900.quantity).toBeCloseTo(1.5);
    expect(bid59900.providers).toContain("p1");
    expect(bid59900.providers).toContain("p2");
  });

  test("bids sorted descending, asks sorted ascending", () => {
    const books = [
      {
        providerId: "p1",
        bids: [[59900, 1], [59800, 2], [60000, 0.5]],
        asks: [[60100, 1], [60200, 1], [60050, 0.5]],
      },
    ];
    const merged = engine.mergeBooks(books);
    expect(merged.bids[0].price).toBeGreaterThanOrEqual(merged.bids[1].price);
    expect(merged.asks[0].price).toBeLessThanOrEqual(merged.asks[1].price);
  });

  test("computes bestBid, bestAsk, and spreadPct", () => {
    const books = [{ providerId: "p1", bids: [[100, 1]], asks: [[101, 1]] }];
    const merged = engine.mergeBooks(books);
    expect(merged.bestBid).toBe(100);
    expect(merged.bestAsk).toBe(101);
    expect(merged.spreadPct).toBeCloseTo(1.0, 1);
  });

  test("computes totalBidDepth and totalAskDepth in USD", () => {
    const books = [{ providerId: "p1", bids: [[100, 2], [99, 1]], asks: [[101, 3]] }];
    const merged = engine.mergeBooks(books);
    expect(merged.totalBidDepth).toBeCloseTo(100 * 2 + 99 * 1, 0);
    expect(merged.totalAskDepth).toBeCloseTo(101 * 3, 0);
  });

  test("returns null for empty providerBooks array", () => {
    expect(engine.mergeBooks([])).toBeNull();
  });

  test("counts unique providers correctly", () => {
    const books = [
      { providerId: "p1", bids: [[100, 1]], asks: [[101, 1]] },
      { providerId: "p2", bids: [[99,  1]], asks: [[102, 1]] },
    ];
    const merged = engine.mergeBooks(books);
    expect(merged.providerCount).toBe(2);
  });

  test("aggregates asks from different providers at different prices", () => {
    const books = [
      { providerId: "p1", bids: [[100, 1]], asks: [[101, 2]] },
      { providerId: "p2", bids: [[99,  1]], asks: [[102, 3]] },
    ];
    const merged = engine.mergeBooks(books);
    expect(merged.asks).toHaveLength(2);
    const ask101 = merged.asks.find((a) => a.price === 101);
    expect(ask101.quantity).toBeCloseTo(2);
    expect(ask101.providers).toContain("p1");
  });
});

describe("AggregatedOrderBookEngine.estimateSlippage", () => {
  let engine;
  beforeEach(() => {
    engine = new AggregatedOrderBookEngine();
    engine._books.set("BTC/USDT", {
      bids: [
        { price: 60000, quantity: 1 },
        { price: 59900, quantity: 2 },
        { price: 59800, quantity: 5 },
      ],
      asks: [
        { price: 60100, quantity: 1 },
        { price: 60200, quantity: 2 },
        { price: 60300, quantity: 5 },
      ],
      bestBid: 60000, bestAsk: 60100, spreadPct: 0.167, providerCount: 1,
    });
  });

  test("returns slippage object with required fields for buy", () => {
    const result = engine.estimateSlippage("BTC/USDT", "buy", 60100);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("slippagePct");
    expect(result).toHaveProperty("avgFillPrice");
    expect(result).toHaveProperty("filledUsd");
    expect(result.side).toBe("buy");
  });

  test("returns slippage object for sell", () => {
    const result = engine.estimateSlippage("BTC/USDT", "sell", 60000);
    expect(result).not.toBeNull();
    expect(result.side).toBe("sell");
  });

  test("returns null for unknown pair", () => {
    expect(engine.estimateSlippage("UNKNOWN/PAIR", "buy", 1000)).toBeNull();
  });

  test("slippagePct ≈ 0 when order fills entirely at best price", () => {
    // Exactly 1 BTC at 60100 → one level fills it at best ask
    const result = engine.estimateSlippage("BTC/USDT", "buy", 60100);
    expect(result.slippagePct).toBeCloseTo(0, 4);
  });

  test("slippagePct > 0 when order walks into second level", () => {
    // Need ~180,300 USD to buy at levels 60100 + 60200 * 2
    const result = engine.estimateSlippage("BTC/USDT", "buy", 180000);
    expect(result.slippagePct).toBeGreaterThan(0);
  });

  test("getBestBidAsk returns structured object", () => {
    const result = engine.getBestBidAsk("BTC/USDT");
    expect(result).toHaveProperty("bestBid", 60000);
    expect(result).toHaveProperty("bestAsk", 60100);
    expect(result).toHaveProperty("spreadPct");
    expect(result).toHaveProperty("pair", "BTC/USDT");
  });

  test("getBestBidAsk returns null for unknown pair", () => {
    expect(engine.getBestBidAsk("NO/PAIR")).toBeNull();
  });

  test("getBook returns null for unknown pair", () => {
    expect(engine.getBook("NO/PAIR")).toBeNull();
  });

  test("getAllPairs lists all pairs with books", () => {
    const pairs = engine.getAllPairs();
    expect(pairs).toContain("BTC/USDT");
  });
});

// ── SmartOrderSplitter ────────────────────────────────────────────────────────

describe("SmartOrderSplitter — no book scenario", () => {
  test("returns no_book reason when aggregated engine has no book", () => {
    // SmartOrderSplitter uses the singleton; since we're NOT mocking the singleton,
    // a fresh SmartOrderSplitter will hit a real (empty) aggregatedOrderBookEngine.
    const splitter = new SmartOrderSplitter();
    const plan = splitter.buildRoutingPlan({ pair: "MISSING/PAIR", side: "buy", quantity: 1 });
    expect(plan.reason).toBe("no_book");
    expect(plan.legs).toHaveLength(0);
  });
});

describe("SmartOrderSplitter — single-leg small order", () => {
  test("small order gets strategy=single with one leg", () => {
    const splitter = new SmartOrderSplitter();
    // Inject a book directly into the engine singleton used by SmartOrderSplitter
    aggEngSingleton._books.set("TEST/USD", {
      bids: [{ price: 1, quantity: 100 }],
      asks: [{ price: 1.01, quantity: 100 }],
      bestBid: 1, bestAsk: 1.01, spreadPct: 1.0, providerCount: 1,
    });

    // quantity=1, midPrice=1.005 → totalUsd≈1.005 < MIN_SPLIT_USD(500) → single
    const plan = splitter.buildRoutingPlan({ pair: "TEST/USD", side: "buy", quantity: 1 });
    expect(plan.strategy).toBe("single");
    expect(plan.legs).toHaveLength(1);
    expect(plan.legs[0].portion).toBeCloseTo(1.0, 2);

    // Clean up
    aggEngSingleton._books.delete("TEST/USD");
  });
});

describe("SmartOrderSplitter.compareStrategies", () => {
  test("returns split and single comparison object", () => {
    const splitter = new SmartOrderSplitter();
    const result = splitter.compareStrategies("MISSING/PAIR", "buy", 1);
    expect(result).toHaveProperty("split");
    expect(result).toHaveProperty("single");
    expect(result).toHaveProperty("improvementPct");
  });

  test("split.legs is 0 when no book exists", () => {
    const splitter = new SmartOrderSplitter();
    const result = splitter.compareStrategies("NO/BOOK", "sell", 10);
    expect(result.split.legs).toBe(0);
  });

  test("single.slippagePct is null when no book exists", () => {
    const splitter = new SmartOrderSplitter();
    const result = splitter.compareStrategies("NO/BOOK", "buy", 100);
    expect(result.single.slippagePct).toBeNull();
  });
});
