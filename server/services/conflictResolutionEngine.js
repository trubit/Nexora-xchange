/**
 * Conflict Resolution Engine
 *
 * Detects and resolves conflicts that arise when multiple event streams
 * or concurrent writes produce inconsistent state:
 *
 *   - Out-of-order event detection (via monotonic sequence gaps)
 *   - Duplicate event deduplication (idempotency keys)
 *   - Last-write-wins (LWW) merge strategy for ticker/price updates
 *   - Vector clock comparison for order book level conflicts
 *   - Split-brain detection between in-memory and Redis snapshots
 *
 * All resolution strategies favour safety (correctness over availability):
 * when genuinely ambiguous, the engine logs the conflict and lets the
 * primary source of truth (the matching engine DB) win.
 *
 * CRITICAL: Read-only analytics. Never modifies engine order state.
 */

import { redisClients } from "../config/redis.js";
import logger from "../config/logger.js";

const SEEN_KEY       = "cre:seen:";  // idempotency key store
const SEEN_TTL       = 3_600;        // 1 hour
const SEQ_WINDOW     = 10_000;       // acceptable sequence gap before out-of-order alert
const OOO_LOG_LEVEL  = "warn";

export class ConflictResolutionEngine {
  constructor() {
    this._expectedSeq  = new Map();  // channel → expected next seq
    this._oooBuffer    = new Map();  // channel → [{seq, event}]
    this._stats = {
      duplicatesDropped: 0,
      outOfOrderBuffered: 0,
      lwwResolutions: 0,
      splitBrainDetected: 0,
    };
  }

  // ── Idempotency / deduplication ───────────────────────────────────────────────

  /**
   * Check if an event with `idempotencyKey` has already been processed.
   * Returns true if the event should be dropped (duplicate).
   */
  async isDuplicate(idempotencyKey) {
    const redis = redisClients.cache;
    if (!redis) return false;
    try {
      const result = await redis.set(`${SEEN_KEY}${idempotencyKey}`, "1", "EX", SEEN_TTL, "NX");
      if (result === null) {
        this._stats.duplicatesDropped++;
        return true;  // NX failed → key existed → duplicate
      }
      return false;
    } catch { return false; }
  }

  /**
   * Generate a deterministic idempotency key for common event types.
   */
  idempotencyKey(type, id) {
    return `${type}:${id}`;
  }

  // ── Sequence ordering ─────────────────────────────────────────────────────────

  /**
   * Validate that the event's sequence number arrives in order for `channel`.
   * Out-of-order events are buffered; returns { inOrder, buffered } where
   * `buffered` is a list of events that can now be released in order.
   */
  checkSequence(channel, seq, event) {
    const expected = this._expectedSeq.get(channel) || 1;

    if (seq === expected) {
      this._expectedSeq.set(channel, seq + 1);
      return this._drainBuffer(channel, seq + 1);
    }

    if (seq < expected) {
      // Behind expected — probably a duplicate or replay
      this._stats.duplicatesDropped++;
      return { inOrder: false, reprocess: [] };
    }

    if (seq > expected + SEQ_WINDOW) {
      logger.error({ channel, expected, got: seq }, "[CRE] Sequence gap exceeds window — resetting.");
      this._expectedSeq.set(channel, seq + 1);
      return { inOrder: true, reprocess: [] };
    }

    // Out-of-order — buffer
    const buf = this._oooBuffer.get(channel) || [];
    buf.push({ seq, event });
    buf.sort((a, b) => a.seq - b.seq);
    this._oooBuffer.set(channel, buf);
    this._stats.outOfOrderBuffered++;

    logger[OOO_LOG_LEVEL]({ channel, expected, got: seq }, "[CRE] Out-of-order event buffered.");
    return { inOrder: false, reprocess: [] };
  }

  _drainBuffer(channel, nextExpected) {
    const buf = this._oooBuffer.get(channel) || [];
    const reprocess = [];

    while (buf.length > 0 && buf[0].seq === nextExpected) {
      const { seq, event } = buf.shift();
      reprocess.push(event);
      nextExpected = seq + 1;
    }

    this._oooBuffer.set(channel, buf);
    this._expectedSeq.set(channel, nextExpected);

    return { inOrder: true, reprocess };
  }

  // ── Last-Write-Wins (LWW) ─────────────────────────────────────────────────────

  /**
   * Resolve a conflict between two versions of a value using LWW.
   * Returns the winner and its timestamp.
   */
  lww(valueA, timestampA, valueB, timestampB) {
    this._stats.lwwResolutions++;
    if (timestampB > timestampA) {
      return { winner: valueB, ts: timestampB };
    }
    return { winner: valueA, ts: timestampA };
  }

  /**
   * Resolve a price conflict (ticker update from two sources).
   * Chooses the most recent timestamp; logs if timestamps are identical.
   */
  resolvePrice(symbolA, symbolB) {
    if (symbolA.ts === symbolB.ts && symbolA.price !== symbolB.price) {
      logger.warn({ symbolA, symbolB }, "[CRE] Price conflict at identical timestamp.");
      // Tie-break: use lower price (conservative for risk calculations)
      return symbolA.price <= symbolB.price ? symbolA : symbolB;
    }
    return this.lww(symbolA, symbolA.ts, symbolB, symbolB.ts).winner;
  }

  // ── Split-brain detection ─────────────────────────────────────────────────────

  /**
   * Compare in-memory order book version to Redis version.
   * Flags if they diverge by more than `maxVersionDiff`.
   */
  detectSplitBrain(symbol, localVersion, redisVersion, maxVersionDiff = 5) {
    const diff = Math.abs(localVersion - redisVersion);
    if (diff > maxVersionDiff) {
      this._stats.splitBrainDetected++;
      logger.error({
        symbol,
        localVersion,
        redisVersion,
        diff,
      }, "[CRE] Split-brain detected — in-memory and Redis snapshots diverged.");
      return { detected: true, diff, recommendation: redisVersion > localVersion ? "USE_REDIS" : "USE_LOCAL" };
    }
    return { detected: false, diff };
  }

  // ── Vector Clock (simplified, 2-node) ─────────────────────────────────────────

  /**
   * Compare two vector clocks for event ordering.
   * Returns: "A_WINS" | "B_WINS" | "CONCURRENT" | "EQUAL"
   */
  compareVectorClocks(vcA, vcB) {
    const keysA = Object.keys(vcA);
    const keysB = Object.keys(vcB);
    const allKeys = new Set([...keysA, ...keysB]);

    let aAhead = false;
    let bAhead = false;

    for (const k of allKeys) {
      const a = vcA[k] || 0;
      const b = vcB[k] || 0;
      if (a > b) aAhead = true;
      if (b > a) bAhead = true;
    }

    if (aAhead && !bAhead) return "A_WINS";
    if (bAhead && !aAhead) return "B_WINS";
    if (!aAhead && !bAhead) return "EQUAL";
    return "CONCURRENT";  // both have advances — genuine conflict
  }

  // ── Stats ─────────────────────────────────────────────────────────────────────

  getStats() {
    return {
      ...this._stats,
      pendingOooBuffers: [...this._oooBuffer.entries()].map(([k, v]) => ({ channel: k, buffered: v.length })),
    };
  }

  resetExpectedSeq(channel) {
    this._expectedSeq.delete(channel);
    this._oooBuffer.delete(channel);
  }
}

export const conflictResolutionEngine = new ConflictResolutionEngine();
