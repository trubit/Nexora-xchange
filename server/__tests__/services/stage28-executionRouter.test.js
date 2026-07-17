/**
 * Stage 28 — Execution Optimization Engine (Smart Order Routing)
 * Tests: ExecutionRouterService (route planning, latency tracking, outcome recording)
 */

import { describe, test, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const { mockExecRoute, mockAggEngine, mockSplitter } = vi.hoisted(() => ({
  mockExecRoute: {
    create:   vi.fn(),
    find:     vi.fn(),
    findById: vi.fn(),
  },
  mockAggEngine: {
    getBook:          vi.fn().mockReturnValue(null),
    estimateSlippage: vi.fn().mockReturnValue(null),
  },
  mockSplitter: {
    buildRoutingPlan: vi.fn().mockReturnValue({ legs: [], estimatedSlippagePct: 0 }),
  },
}));

vi.mock("../../config/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("../../models/ExecutionRoute.js", () => ({ default: mockExecRoute }));
vi.mock("../../services/aggregatedOrderBookEngine.js", () => ({
  aggregatedOrderBookEngine: mockAggEngine,
  AggregatedOrderBookEngine: vi.fn(),
}));
vi.mock("../../services/smartOrderSplitter.js", () => ({
  smartOrderSplitter: mockSplitter,
  SmartOrderSplitter: vi.fn(),
}));

import { ExecutionRouterService } from "../../services/executionRouterService.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRouteDoc(overrides = {}) {
  const base = {
    _id:             "route1",
    pair:            "BTC/USDT",
    side:            "buy",
    totalQuantity:   1,
    filledQuantity:  0,
    strategy:        "single",
    legs:            [{ venue: "internal", side: "buy", quantity: 1, status: "pending" }],
    estimatedSlippagePct: 0.1,
    status:          "planned",
    ...overrides,
  };
  const save     = vi.fn().mockResolvedValue(base);
  const toObject = () => ({ ...base });
  return { ...base, save, toObject };
}

// ── Constructor and stats ─────────────────────────────────────────────────────

describe("ExecutionRouterService — constructor", () => {
  test("initialises with zero stats", () => {
    const svc = new ExecutionRouterService();
    const stats = svc.getStats();
    expect(stats.routesPlanned).toBe(0);
    expect(stats.routesExecuted).toBe(0);
    expect(stats.slippageSaved).toBe(0);
    expect(stats.errors).toBe(0);
  });

  test("latency report starts empty", () => {
    const svc = new ExecutionRouterService();
    expect(svc.getLatencyReport()).toEqual({});
  });
});

// ── Latency tracker ────────────────────────────────────────────────────────────

describe("ExecutionRouterService latency tracking", () => {
  test("recordLatency stores samples and avgLatency computes correctly", () => {
    const svc = new ExecutionRouterService();
    svc.recordLatency("binance", 100);
    svc.recordLatency("binance", 200);
    svc.recordLatency("binance", 300);
    const report = svc.getLatencyReport();
    expect(report.binance.avg).toBeCloseTo(200, 0);
    expect(report.binance.samples).toBe(3);
  });

  test("isSlow returns true for venue with avg latency above threshold (500ms)", () => {
    const svc = new ExecutionRouterService();
    for (let i = 0; i < 5; i++) svc.recordLatency("slowVenue", 600);
    // Access internal tracker
    expect(svc._latency.isSlow("slowVenue")).toBe(true);
  });

  test("isSlow returns false for fast venue", () => {
    const svc = new ExecutionRouterService();
    for (let i = 0; i < 5; i++) svc.recordLatency("fastVenue", 50);
    expect(svc._latency.isSlow("fastVenue")).toBe(false);
  });

  test("isSlow returns false for unknown venue", () => {
    const svc = new ExecutionRouterService();
    expect(svc._latency.isSlow("unknown")).toBe(false);
  });

  test("latency window is capped at LATENCY_WINDOW (20)", () => {
    const svc = new ExecutionRouterService();
    for (let i = 0; i < 30; i++) svc.recordLatency("v1", i * 10);
    const report = svc.getLatencyReport();
    expect(report.v1.samples).toBe(20);
  });
});

// ── planRoute ─────────────────────────────────────────────────────────────────

describe("ExecutionRouterService.planRoute — single strategy", () => {
  beforeEach(() => vi.resetAllMocks());

  test("selects 'single' strategy for small quantity with no book", async () => {
    mockAggEngine.getBook.mockReturnValue(null);
    const doc = makeRouteDoc({ strategy: "single" });
    mockExecRoute.create.mockResolvedValueOnce(doc);

    const svc = new ExecutionRouterService();
    const route = await svc.planRoute({ pair: "BTC/USDT", side: "buy", quantity: 0.001 });
    expect(mockExecRoute.create).toHaveBeenCalledOnce();
    const payload = mockExecRoute.create.mock.calls[0][0];
    expect(payload.strategy).toBe("single");
    expect(route.strategy).toBe("single");
  });

  test("emits 'planned' event after creating route", async () => {
    const doc = makeRouteDoc();
    mockExecRoute.create.mockResolvedValueOnce(doc);
    const svc = new ExecutionRouterService();
    const listener = vi.fn();
    svc.on("planned", listener);
    await svc.planRoute({ pair: "BTC/USDT", side: "buy", quantity: 0.001 });
    expect(listener).toHaveBeenCalledOnce();
    svc.off("planned", listener);
  });

  test("increments routesPlanned stat", async () => {
    const doc = makeRouteDoc();
    mockExecRoute.create.mockResolvedValueOnce(doc);
    const svc = new ExecutionRouterService();
    await svc.planRoute({ pair: "BTC/USDT", side: "buy", quantity: 0.001 });
    expect(svc.getStats().routesPlanned).toBe(1);
  });
});

describe("ExecutionRouterService.planRoute — split strategy", () => {
  beforeEach(() => vi.resetAllMocks());

  test("uses split when totalUsd 500-9999 (with no book midPrice, uses limitPrice)", async () => {
    mockAggEngine.getBook.mockReturnValue(null);
    mockSplitter.buildRoutingPlan.mockReturnValueOnce({
      legs: [
        { providerId: "p1", quantity: 2.5, portion: 0.5, estimatedSlippagePct: 0.01 },
        { providerId: "p2", quantity: 2.5, portion: 0.5, estimatedSlippagePct: 0.01 },
      ],
      estimatedSlippagePct: 0.01,
    });
    const doc = makeRouteDoc({ strategy: "split" });
    mockExecRoute.create.mockResolvedValueOnce(doc);

    const svc = new ExecutionRouterService();
    // quantity=5, limitPrice=200 → totalUsd=1000 → split
    await svc.planRoute({ pair: "ETH/USDT", side: "buy", quantity: 5, limitPrice: 200 });
    const payload = mockExecRoute.create.mock.calls[0][0];
    expect(payload.strategy).toBe("split");
  });
});

describe("ExecutionRouterService.planRoute — TWAP strategy", () => {
  beforeEach(() => vi.resetAllMocks());

  test("selects TWAP for large USD value (≥ TWAP_MIN_QTY_USD=10000)", async () => {
    mockAggEngine.getBook.mockReturnValue({ bestBid: 60000, bestAsk: 60000, bids: [], asks: [] });
    const doc = makeRouteDoc({ strategy: "twap" });
    mockExecRoute.create.mockResolvedValueOnce(doc);

    const svc = new ExecutionRouterService();
    // quantity=1, midPrice=60000 → totalUsd=60000 ≥ 10000 → twap
    await svc.planRoute({ pair: "BTC/USDT", side: "buy", quantity: 1 });
    const payload = mockExecRoute.create.mock.calls[0][0];
    expect(payload.strategy).toBe("twap");
    expect(Array.isArray(payload.legs)).toBe(true);
    expect(payload.legs.length).toBeGreaterThan(0);
  });

  test("TWAP splits into 5 equal slices by default", () => {
    const svc = new ExecutionRouterService();
    const legs = svc._buildTwapLegs("BTC/USDT", "buy", 10, 5);
    expect(legs).toHaveLength(5);
    expect(legs[0].quantity).toBeCloseTo(2, 4);
    expect(legs.every((l) => l.venue === "internal")).toBe(true);
    expect(legs.every((l) => l.status === "pending")).toBe(true);
  });
});

describe("ExecutionRouterService.planRoute — iceberg strategy", () => {
  beforeEach(() => vi.resetAllMocks());

  test("iceberg splits into 10 visible slices (10% each)", () => {
    const svc = new ExecutionRouterService();
    const legs = svc._buildIcebergLegs("BTC/USDT", "buy", 100);
    expect(legs.length).toBe(10);   // 100 / (100*0.1) = 10
    expect(legs[0].quantity).toBeCloseTo(10, 4);
  });
});

// ── recordOutcome ─────────────────────────────────────────────────────────────

describe("ExecutionRouterService.recordOutcome", () => {
  beforeEach(() => vi.resetAllMocks());

  test("returns null for unknown routeId", async () => {
    mockExecRoute.findById.mockResolvedValueOnce(null);
    const svc = new ExecutionRouterService();
    const result = await svc.recordOutcome("nonexistent", { filledQuantity: 1, averageFillPrice: 60000 });
    expect(result).toBeNull();
  });

  test("updates status to completed when fully filled", async () => {
    const doc = makeRouteDoc({ totalQuantity: 1, estimatedSlippagePct: null, legs: [] });
    mockExecRoute.findById.mockResolvedValueOnce(doc);
    const svc   = new ExecutionRouterService();
    const result = await svc.recordOutcome("route1", { filledQuantity: 1, averageFillPrice: 60000 });
    expect(doc.status).toBe("completed");
    expect(doc.save).toHaveBeenCalled();
    expect(result).toBeTruthy();
  });

  test("increments routesExecuted stat", async () => {
    const doc = makeRouteDoc({ totalQuantity: 0.5, estimatedSlippagePct: null, legs: [] });
    mockExecRoute.findById.mockResolvedValueOnce(doc);
    const svc = new ExecutionRouterService();
    await svc.recordOutcome("route1", { filledQuantity: 0.5, averageFillPrice: 60000 });
    expect(svc.getStats().routesExecuted).toBe(1);
  });

  test("emits 'completed' event", async () => {
    const doc = makeRouteDoc({ totalQuantity: 1, estimatedSlippagePct: null, legs: [] });
    mockExecRoute.findById.mockResolvedValueOnce(doc);
    const svc      = new ExecutionRouterService();
    const listener = vi.fn();
    svc.on("completed", listener);
    await svc.recordOutcome("route1", { filledQuantity: 1, averageFillPrice: 60000 });
    expect(listener).toHaveBeenCalledOnce();
    svc.off("completed", listener);
  });
});

// ── getRouteHistory ───────────────────────────────────────────────────────────

describe("ExecutionRouterService.getRouteHistory", () => {
  beforeEach(() => vi.resetAllMocks());

  test("queries with userId and pair filters", async () => {
    const chain = {
      sort: vi.fn().mockReturnThis(), skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([]),
    };
    mockExecRoute.find.mockReturnValueOnce(chain);
    const svc = new ExecutionRouterService();
    await svc.getRouteHistory({ userId: "u1", pair: "BTC/USDT" });
    expect(mockExecRoute.find).toHaveBeenCalledWith({ userId: "u1", pair: "BTC/USDT" });
  });

  test("returns an array", async () => {
    const chain = {
      sort: vi.fn().mockReturnThis(), skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([makeRouteDoc().toObject()]),
    };
    mockExecRoute.find.mockReturnValueOnce(chain);
    const svc    = new ExecutionRouterService();
    const result = await svc.getRouteHistory({});
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
  });
});
