/**
 * HFTPublisher — non-blocking Redis pub/sub with per-symbol coalescing.
 *
 * The original publisher awaited every Redis publish inside the matching loop,
 * meaning a slow Redis round-trip blocked the next trade from executing.
 *
 * This publisher:
 *   1. Never awaits — all Redis calls are fire-and-forget.
 *   2. Coalesces order-book snapshots by symbol: if 10 trades hit BTC/USDT
 *      in one event-loop tick, only the last snapshot is published (reduces
 *      subscriber flood with no information loss since each snapshot is full state).
 *   3. Batches trade events in the same coalesce window.
 *   4. Degrades gracefully when Redis is absent — all methods become no-ops.
 *
 * Coalescing window: HFT_PUB_COALESCE_MS (default 5 ms).
 * Setting it to 0 disables coalescing (publish on next setImmediate).
 */

import { redisClients }                       from "../../config/redis.js";
import { TRADE_CHANNEL, ORDERBOOK_CHANNEL } from "../publisher.js";
import { HFTConfig }                         from "./HFTConfig.js";
import { hftMetrics }                        from "./metrics.js";

// Re-use the same channel names as the standard publisher so all subscribers
// receive events regardless of which engine mode is active.
const TRADE_CH     = TRADE_CHANNEL;
const ORDERBOOK_CH = ORDERBOOK_CHANNEL;

export class HFTPublisher {
  constructor() {
    // Pending coalesced state — keyed by symbol
    this._pendingBooks  = new Map(); // symbol → snapshot (latest wins)
    this._pendingTrades = [];        // accumulates until flush
    this._flushTimer    = null;
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Queue a trade event. Never blocks — returns immediately.
   * The trade will be published in the next coalesce window.
   */
  publishTrade(payload) {
    this._pendingTrades.push({ event: "TRADE_EXECUTED", ...payload });
    this._scheduleFlush();
  }

  /**
   * Queue an order-book snapshot. Overwrites any prior pending snapshot for
   * this symbol (only the most recent snapshot is worth publishing).
   */
  publishOrderBook(snapshot) {
    this._pendingBooks.set(snapshot.symbol, { event: "ORDERBOOK_UPDATE", ...snapshot });
    this._scheduleFlush();
  }

  // ── Scheduling ───────────────────────────────────────────────────────────────

  _scheduleFlush() {
    if (this._flushTimer !== null) return; // already scheduled

    const delay = HFTConfig.pubCoalesceMs;
    if (delay <= 0) {
      // Publish on the next event-loop tick — zero coalesce window
      this._flushTimer = setImmediate(() => this._flush());
    } else {
      this._flushTimer = setTimeout(() => this._flush(), delay);
    }
  }

  _flush() {
    this._flushTimer = null;

    const trades    = this._pendingTrades.splice(0);
    const snapshots = [...this._pendingBooks.values()];
    this._pendingBooks.clear();

    if (!trades.length && !snapshots.length) return;

    const pub = redisClients.pubSub;
    if (!pub) return; // Redis not available — silently skip

    const t0 = hftMetrics.start();

    for (const trade of trades) {
      pub.publish(TRADE_CH, JSON.stringify(trade)).catch((err) =>
        console.error("[HFT:pub] Trade publish failed:", err.message)
      );
    }

    for (const snap of snapshots) {
      pub.publish(ORDERBOOK_CH, JSON.stringify(snap)).catch((err) =>
        console.error("[HFT:pub] OrderBook publish failed:", err.message)
      );
    }

    hftMetrics.record("publish", t0);
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  /** Flush any queued messages immediately (call on graceful shutdown). */
  async drain() {
    if (this._flushTimer !== null) {
      // _flushTimer holds either a setTimeout or setImmediate result depending on
      // pubCoalesceMs. Both clear functions are called; the one that doesn't match
      // is a documented Node.js no-op.
      clearTimeout(this._flushTimer);
      clearImmediate(this._flushTimer);
      this._flushTimer = null;
    }
    this._flush();
    // Give in-flight fire-and-forget publishes one tick to complete
    await new Promise((r) => setImmediate(r));
  }
}

export const hftPublisher = new HFTPublisher();
