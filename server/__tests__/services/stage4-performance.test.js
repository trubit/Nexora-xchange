/**
 * Stage 4 — Extreme Performance Optimization
 * Tests: LruCache (LRU + TTL), InMemoryDataStore, BatchProcessor (queue, flush, coalesce)
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../config/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("../../config/redis.js", () => ({
  redisClients: { cache: null },
  redisEnabled: false,
}));

import { LruCache, InMemoryDataStore } from "../../services/inMemoryDataStore.js";
import { BatchProcessor }              from "../../services/batchProcessor.js";

// ── LruCache — basic operations ───────────────────────────────────────────────

describe("LruCache — basic operations", () => {
  let cache;
  beforeEach(() => { cache = new LruCache({ maxItems: 3, ttlMs: 5000 }); });

  test("set and get round-trips the value", () => {
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
  });

  test("get on missing key returns undefined", () => {
    expect(cache.get("missing")).toBeUndefined();
  });

  test("delete removes the key", () => {
    cache.set("a", 1);
    cache.delete("a");
    expect(cache.get("a")).toBeUndefined();
  });

  test("has returns true for existing key", () => {
    cache.set("x", 42);
    expect(cache.has("x")).toBe(true);
  });

  test("has returns false for missing key", () => {
    expect(cache.has("y")).toBe(false);
  });

  test("size() method returns current item count", () => {
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.size()).toBe(2);
  });
});

describe("LruCache — LRU eviction", () => {
  test("evicts the least-recently-used item when capacity is exceeded", () => {
    const cache = new LruCache({ maxItems: 3, ttlMs: 60000 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    // Access 'a' to make it recently used, so 'b' becomes LRU
    cache.get("a");
    // Adding 'd' should evict 'b' (was LRU since we accessed a, then c was already in there)
    cache.set("d", 4);
    // After eviction, b should be gone; a, c, d still present
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe(1);
    expect(cache.get("c")).toBe(3);
    expect(cache.get("d")).toBe(4);
  });

  test("size never exceeds maxItems", () => {
    const cache = new LruCache({ maxItems: 5, ttlMs: 60000 });
    for (let i = 0; i < 20; i++) cache.set(`k${i}`, i);
    expect(cache.size()).toBeLessThanOrEqual(5);
  });
});

describe("LruCache — TTL expiry", () => {
  test("expired entry returns undefined after TTL", async () => {
    const cache = new LruCache({ maxItems: 10, ttlMs: 50 });   // 50 ms TTL
    cache.set("tmp", "hello");
    await new Promise((r) => setTimeout(r, 70));               // wait 70 ms
    expect(cache.get("tmp")).toBeUndefined();
  });

  test("non-expired entry is still accessible within TTL", async () => {
    const cache = new LruCache({ maxItems: 10, ttlMs: 500 });
    cache.set("live", "world");
    await new Promise((r) => setTimeout(r, 50));
    expect(cache.get("live")).toBe("world");
  });
});

// ── InMemoryDataStore — ticker namespace ──────────────────────────────────────

describe("InMemoryDataStore — ticker namespace", () => {
  let store;
  beforeEach(() => { store = new InMemoryDataStore(); store.start(); });
  afterEach(()  => { store.stop(); });

  test("setTicker and getTicker round-trips data", () => {
    store.setTicker("BTC/USDT", { price: 50000, ts: Date.now() });
    const t = store.getTicker("BTC/USDT");
    expect(t).not.toBeNull();
    expect(t.price).toBe(50000);
  });

  test("getTicker returns null for unknown symbol", () => {
    expect(store.getTicker("UNKNOWN/USDT")).toBeNull();
  });

  test("getAllTickers returns all set symbols as a map", () => {
    store.setTicker("ETH/USDT", { price: 3000, ts: Date.now() });
    store.setTicker("BNB/USDT", { price: 400,  ts: Date.now() });
    const tickers = store.getAllTickers();
    expect(typeof tickers).toBe("object");
    expect(Object.keys(tickers).length).toBeGreaterThanOrEqual(2);
  });
});

describe("InMemoryDataStore — order book namespace", () => {
  let store;
  beforeEach(() => { store = new InMemoryDataStore(); store.start(); });
  afterEach(()  => { store.stop(); });

  test("setOrderBook and getOrderBook round-trips", () => {
    store.setOrderBook("BTC/USDT", { bids: [], asks: [] });
    const ob = store.getOrderBook("BTC/USDT");
    expect(ob).not.toBeNull();
  });

  test("getOrderBook returns null for unknown symbol", () => {
    expect(store.getOrderBook("XYZ/USDT")).toBeNull();
  });
});

describe("InMemoryDataStore — trade tape (getTrades)", () => {
  let store;
  beforeEach(() => { store = new InMemoryDataStore(); store.start(); });
  afterEach(()  => { store.stop(); });

  test("appendTrade accumulates trades for a symbol", () => {
    store.appendTrade("ETH/USDT", { price: 3000, qty: 1 });
    store.appendTrade("ETH/USDT", { price: 3010, qty: 2 });
    const trades = store.getTrades("ETH/USDT");
    expect(trades.length).toBeGreaterThanOrEqual(2);
  });

  test("getTrades returns empty array for unknown symbol", () => {
    expect(store.getTrades("XYZ/USDT")).toEqual([]);
  });

  test("getTrades respects limit parameter", () => {
    for (let i = 0; i < 10; i++) store.appendTrade("BTC/USDT", { price: i, qty: 1 });
    expect(store.getTrades("BTC/USDT", 3)).toHaveLength(3);
  });
});

describe("InMemoryDataStore — getStats", () => {
  let store;
  beforeEach(() => { store = new InMemoryDataStore(); store.start(); });
  afterEach(()  => { store.stop(); });

  test("getStats returns an object with hitRatePct", () => {
    store.getTicker("MISS");                          // miss
    store.setTicker("HIT", { p: 1, ts: Date.now() });
    store.getTicker("HIT");                           // hit
    const stats = store.getStats();
    expect(stats).toHaveProperty("hitRatePct");
    expect(stats).toHaveProperty("hits");
    expect(stats).toHaveProperty("misses");
  });
});

// ── BatchProcessor ────────────────────────────────────────────────────────────

describe("BatchProcessor — register and enqueue", () => {
  let bp;
  beforeEach(() => { bp = new BatchProcessor(); });
  afterEach(async () => { await bp.shutdown(); });

  test("registered queue accepts items without throwing", () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    bp.register("test_q", handler, { batchSize: 10, flushMs: 60000 });
    expect(() => bp.enqueue("test_q", { v: 1 })).not.toThrow();
  });

  test("enqueueing to unregistered queue throws", () => {
    expect(() => bp.enqueue("not_registered", "x")).toThrow();
  });

  test("flush handler called with all items when batchSize is reached", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    bp.register("flush_test", handler, { batchSize: 3, flushMs: 60000 });
    bp.enqueue("flush_test", 1);
    bp.enqueue("flush_test", 2);
    bp.enqueue("flush_test", 3);   // triggers flush
    await new Promise((r) => setTimeout(r, 30));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith([1, 2, 3]);
  });

  test("flush is called after flushMs timer fires", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    bp.register("timer_test", handler, { batchSize: 1000, flushMs: 30 });
    bp.enqueue("timer_test", "item");
    await new Promise((r) => setTimeout(r, 60));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test("shutdown flushes remaining items", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    bp.register("shutdown_q", handler, { batchSize: 1000, flushMs: 60000 });
    bp.enqueue("shutdown_q", "final");
    await bp.shutdown();
    expect(handler).toHaveBeenCalledWith(["final"]);
  });
});

describe("BatchProcessor.coalesce — request deduplication", () => {
  test("concurrent calls with same key share one loader invocation", async () => {
    const pending = new Map();
    let callCount = 0;
    const loader = () => {
      callCount++;
      return new Promise((r) => setTimeout(() => r("result"), 20));
    };

    const [r1, r2, r3] = await Promise.all([
      BatchProcessor.coalesce(pending, "key", loader),
      BatchProcessor.coalesce(pending, "key", loader),
      BatchProcessor.coalesce(pending, "key", loader),
    ]);

    expect(callCount).toBe(1);
    expect(r1).toBe("result");
    expect(r2).toBe("result");
    expect(r3).toBe("result");
  });

  test("different keys each trigger their own loader", async () => {
    const pending = new Map();
    let callCount = 0;
    const loader  = () => { callCount++; return Promise.resolve("ok"); };
    await Promise.all([
      BatchProcessor.coalesce(pending, "key1", loader),
      BatchProcessor.coalesce(pending, "key2", loader),
    ]);
    expect(callCount).toBe(2);
  });
});

describe("BatchProcessor — retry on flush failure", () => {
  test("retries flush handler up to MAX_RETRIES (3) on transient errors", async () => {
    const bp = new BatchProcessor();
    let calls = 0;
    const handler = vi.fn().mockImplementation(async () => {
      calls++;
      if (calls < 3) throw new Error("transient");
    });
    bp.register("retry_q", handler, { batchSize: 1, flushMs: 60000 });
    bp.enqueue("retry_q", "item");   // immediate flush (batchSize=1)
    await new Promise((r) => setTimeout(r, 1000));  // wait for up to 3 retries
    expect(handler.mock.calls.length).toBeGreaterThanOrEqual(3);
    await bp.shutdown();
  }, 5000);
});
