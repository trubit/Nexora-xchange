/**
 * Stage 5 — Global Market Synchronization Engine
 * Tests: ConflictResolutionEngine (pure logic), GlobalTimestampAuthority (HLC + monotonic)
 */

import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("../../config/redis.js", () => ({
  redisClients: { cache: null },
  redisEnabled: false,
}));

import { ConflictResolutionEngine }   from "../../services/conflictResolutionEngine.js";
import { GlobalTimestampAuthority }   from "../../services/globalTimestampAuthority.js";

// ── ConflictResolutionEngine — pure functions ─────────────────────────────────

describe("ConflictResolutionEngine.lww (Last-Write-Wins)", () => {
  // Returns { winner, ts }
  let engine;
  beforeEach(() => { engine = new ConflictResolutionEngine(); });

  test("returns the value with the higher timestamp", () => {
    const result = engine.lww("old-value", 1000, "new-value", 2000);
    expect(result.winner).toBe("new-value");
    expect(result.ts).toBe(2000);
  });

  test("tie-break: first argument (A) wins when timestamps are equal", () => {
    const result = engine.lww("a", 1000, "b", 1000);
    expect(result.winner).toBe("a");
  });

  test("always picks the higher timestamp regardless of argument order", () => {
    const r1 = engine.lww("newer", 5000, "older", 1000);
    const r2 = engine.lww("older", 1000, "newer", 5000);
    expect(r1.winner).toBe("newer");
    expect(r2.winner).toBe("newer");
  });
});

describe("ConflictResolutionEngine.resolvePrice", () => {
  // resolvePrice(symbolA, symbolB) returns the winning object (with .price)
  let engine;
  beforeEach(() => { engine = new ConflictResolutionEngine(); });

  test("returns the object with the newer timestamp", () => {
    const result = engine.resolvePrice(
      { price: 100, ts: 2000 },
      { price: 101, ts: 1000 },
    );
    expect(result.price).toBe(100);
  });

  test("tie-break: lower price wins when timestamps are equal", () => {
    const result = engine.resolvePrice(
      { price: 101, ts: 1000 },
      { price: 99,  ts: 1000 },
    );
    expect(result.price).toBe(99);
  });

  test("identical prices at same timestamp returns one of them", () => {
    const result = engine.resolvePrice(
      { price: 100, ts: 1000 },
      { price: 100, ts: 1000 },
    );
    expect(result.price).toBe(100);
  });
});

describe("ConflictResolutionEngine.compareVectorClocks", () => {
  let engine;
  beforeEach(() => { engine = new ConflictResolutionEngine(); });

  test("A_WINS when A dominates B on all nodes", () => {
    expect(engine.compareVectorClocks({ node1: 5, node2: 3 }, { node1: 3, node2: 2 })).toBe("A_WINS");
  });

  test("B_WINS when B dominates A on all nodes", () => {
    expect(engine.compareVectorClocks({ node1: 2, node2: 2 }, { node1: 4, node2: 5 })).toBe("B_WINS");
  });

  test("CONCURRENT when A wins on some nodes, B wins on others", () => {
    expect(engine.compareVectorClocks({ node1: 5, node2: 1 }, { node1: 1, node2: 5 })).toBe("CONCURRENT");
  });

  test("EQUAL when clocks are identical", () => {
    const vc = { node1: 3, node2: 3 };
    expect(engine.compareVectorClocks(vc, { ...vc })).toBe("EQUAL");
  });

  test("A_WINS when B is missing a key that A has with counter > 0", () => {
    expect(engine.compareVectorClocks({ node1: 1 }, {})).toBe("A_WINS");
  });
});

describe("ConflictResolutionEngine.detectSplitBrain", () => {
  // Returns { detected, diff } or { detected: true, diff, recommendation }
  let engine;
  beforeEach(() => { engine = new ConflictResolutionEngine(); });

  test("no split brain when versions are equal", () => {
    expect(engine.detectSplitBrain("BTC/USDT", 10, 10).detected).toBe(false);
  });

  test("no split brain when difference is within maxDiff", () => {
    expect(engine.detectSplitBrain("BTC/USDT", 10, 13, 5).detected).toBe(false);
  });

  test("split brain detected when difference exceeds maxDiff", () => {
    const result = engine.detectSplitBrain("BTC/USDT", 1, 100, 5);
    expect(result.detected).toBe(true);
    expect(result.diff).toBe(99);
    expect(result).toHaveProperty("recommendation");
  });

  test("USE_REDIS recommended when Redis is ahead", () => {
    const result = engine.detectSplitBrain("BTC/USDT", 1, 100, 5);
    expect(result.recommendation).toBe("USE_REDIS");
  });

  test("USE_LOCAL recommended when local is ahead", () => {
    const result = engine.detectSplitBrain("BTC/USDT", 100, 1, 5);
    expect(result.recommendation).toBe("USE_LOCAL");
  });
});

describe("ConflictResolutionEngine.checkSequence", () => {
  // Returns { inOrder, reprocess }
  let engine;
  beforeEach(() => { engine = new ConflictResolutionEngine(); });

  test("in-order event (seq=1) is returned as inOrder=true", () => {
    const ch = "test-ch-1";
    const result = engine.checkSequence(ch, 1, { data: "first" });
    expect(result.inOrder).toBe(true);
    expect(Array.isArray(result.reprocess)).toBe(true);
  });

  test("out-of-order event is buffered (inOrder=false)", () => {
    const ch = "test-ch-2";
    // Expected seq is 1 but we send seq 5 first
    const result = engine.checkSequence(ch, 5, { data: "future" });
    expect(result.inOrder).toBe(false);
    expect(result.reprocess).toHaveLength(0);
  });

  test("buffered event released when gap closes", () => {
    const ch = "test-ch-3";
    // Send seq 2 first (out-of-order)
    engine.checkSequence(ch, 2, { data: "second" });
    // Now send seq 1 — should drain and return seq 2 in reprocess
    const result = engine.checkSequence(ch, 1, { data: "first" });
    expect(result.inOrder).toBe(true);
    expect(result.reprocess.length).toBeGreaterThanOrEqual(1);
  });

  test("duplicate (seq < expected) returns inOrder=false", () => {
    const ch = "test-ch-4";
    engine.checkSequence(ch, 1, { data: "first" });   // advances expected to 2
    const dup = engine.checkSequence(ch, 1, { data: "dup" });
    expect(dup.inOrder).toBe(false);
  });
});

// ── GlobalTimestampAuthority — HLC ───────────────────────────────────────────

describe("GlobalTimestampAuthority.now() — monotonic guarantee", () => {
  let gta;
  beforeEach(() => { gta = new GlobalTimestampAuthority(); });

  test("now() returns a number", () => {
    expect(typeof gta.now()).toBe("number");
  });

  test("successive now() calls are non-decreasing (monotonic)", () => {
    const samples = Array.from({ length: 100 }, () => gta.now());
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
    }
  });

  test("now() is close to Date.now() (within 2 seconds)", () => {
    const hlc  = gta.now();
    const wall = Date.now();
    expect(Math.abs(hlc - wall)).toBeLessThan(2000);
  });
});

describe("GlobalTimestampAuthority.nextEventId", () => {
  let gta;
  beforeEach(() => { gta = new GlobalTimestampAuthority(); });

  test("returns a non-empty string", () => {
    const id = gta.nextEventId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  test("successive IDs are all unique", () => {
    const ids = new Set(Array.from({ length: 50 }, () => gta.nextEventId()));
    expect(ids.size).toBe(50);
  });

  test("ID contains at least 3 dash-separated segments (ts, counter, nodeId)", () => {
    const id = gta.nextEventId();
    expect(id.split("-").length).toBeGreaterThanOrEqual(3);
  });
});

describe("GlobalTimestampAuthority.parseEventId", () => {
  let gta;
  beforeEach(() => { gta = new GlobalTimestampAuthority(); });

  test("parse of a generated ID returns ts, counter, and nodeId", () => {
    const id     = gta.nextEventId();
    const parsed = gta.parseEventId(id);
    expect(parsed).toHaveProperty("ts");
    expect(parsed).toHaveProperty("counter");
    expect(parsed).toHaveProperty("nodeId");
    expect(parsed.ts).toBeGreaterThan(0);
  });

  test("parsed ts round-trips correctly", () => {
    const id     = gta.nextEventId();
    const parsed = gta.parseEventId(id);
    expect(parsed.ts).toBeCloseTo(Date.now(), -3);  // within ~1s
  });
});

describe("GlobalTimestampAuthority.compare", () => {
  let gta;
  beforeEach(() => { gta = new GlobalTimestampAuthority(); });

  test("earlier ID compares less than later ID", async () => {
    const idA = gta.nextEventId();
    await new Promise((r) => setTimeout(r, 5));
    const idB = gta.nextEventId();
    expect(gta.compare(idA, idB)).toBeLessThan(0);
    expect(gta.compare(idB, idA)).toBeGreaterThan(0);
  });

  test("same ID compares equal to itself", () => {
    const id = gta.nextEventId();
    expect(gta.compare(id, id)).toBe(0);
  });
});

describe("GlobalTimestampAuthority.receive", () => {
  let gta;
  beforeEach(() => { gta = new GlobalTimestampAuthority(); });

  test("receiving a far-future timestamp advances the clock", () => {
    const futureTs = Date.now() + 500;
    gta.receive(futureTs);
    expect(gta.now()).toBeGreaterThanOrEqual(futureTs);
  });

  test("receiving a past timestamp does not decrease the clock", () => {
    const before = gta.now();
    gta.receive(before - 10000);
    expect(gta.now()).toBeGreaterThanOrEqual(before);
  });
});

describe("GlobalTimestampAuthority.age", () => {
  // age(eventTs) takes a millisecond timestamp, NOT an event ID
  let gta;
  beforeEach(() => { gta = new GlobalTimestampAuthority(); });

  test("age of a just-issued timestamp is near zero", () => {
    const ts  = gta.now();
    const age = gta.age(ts);
    expect(age).toBeGreaterThanOrEqual(0);
    expect(age).toBeLessThan(500);  // < 500 ms
  });

  test("age of a timestamp 1 second ago is near 1000 ms", async () => {
    const ts = Date.now() - 1000;
    await new Promise((r) => setTimeout(r, 10));
    expect(gta.age(ts)).toBeGreaterThanOrEqual(1000);
  });
});
