/**
 * OrderQueue — per-symbol FIFO queue with setImmediate-based draining.
 *
 * Design goals:
 *   • Zero-blocking event loop: the drain tick is scheduled via setImmediate
 *     so incoming HTTP/WebSocket handlers can interleave between drain cycles.
 *   • Per-symbol partitioning: orders for BTC/USDT never contend with
 *     ETH/USDT. Within one symbol, ordering is always strictly sequential
 *     (no race condition possible in Node's single-threaded model).
 *   • Back-pressure: if a symbol queue exceeds HFT_QUEUE_DEPTH_LIMIT,
 *     enqueue() returns false and the caller should respond with 503.
 *   • CPU affinity (conceptual): each SymbolQueue could be pinned to a
 *     specific worker_thread in a multi-threaded deployment. The queue
 *     boundary is the natural serialization point.
 *
 * SymbolQueue.enqueue(item) → boolean  (false = queue full / back-pressure)
 * SymbolQueue.size          → number   (current depth)
 * SymbolQueue.pause()       / resume() — for graceful shutdown
 *
 * OrderQueueManager manages the symbol→SymbolQueue registry.
 */

import { HFTConfig } from "./HFTConfig.js";
import { hftMetrics } from "./metrics.js";

// ── SymbolQueue ───────────────────────────────────────────────────────────────

class SymbolQueue {
  /**
   * @param {string}   symbol
   * @param {Function} processFn  — sync function: (item) → PendingFill[]
   * @param {Function} onFills    — async callback: (fills) → void
   * @param {Function} onError    — (err, item) → void
   */
  constructor(symbol, processFn, onFills, onError) {
    this._symbol    = symbol;
    this._process   = processFn;
    this._onFills   = onFills;
    this._onError   = onError;
    this._queue     = [];
    this._draining  = false;
    this._paused    = false;
    this._immediate = null;
  }

  /**
   * Add an item to the queue.
   * Returns false if the queue is at capacity (back-pressure signal).
   */
  enqueue(item) {
    if (this._queue.length >= HFTConfig.queueDepthLimit) return false;
    this._queue.push(item);
    this._scheduleDrain();
    return true;
  }

  get size() { return this._queue.length; }
  get symbol() { return this._symbol; }

  pause()  { this._paused = true; }
  resume() {
    this._paused = false;
    if (this._queue.length > 0) this._scheduleDrain();
  }

  // ── Internal drain ──────────────────────────────────────────────────────────

  _scheduleDrain() {
    if (this._draining || this._paused || this._immediate !== null) return;
    this._immediate = setImmediate(() => this._drain());
  }

  _drain() {
    this._immediate = null;
    this._draining  = true;

    const accumulated = [];

    // Process all currently queued items synchronously (no I/O here).
    // New items arriving mid-drain are safe — they land at the end of
    // this._queue and will be picked up by the next _scheduleDrain() call
    // triggered at the bottom of this method.
    const snapshot = this._queue.splice(0); // take current batch

    for (const item of snapshot) {
      try {
        const fills = this._process(item); // timing recorded inside _processSync
        if (fills && fills.length) accumulated.push(...fills);
      } catch (err) {
        this._onError(err, item);
      }
    }

    this._draining = false;

    // Hand accumulated fills to async persistence layer (non-blocking)
    if (accumulated.length > 0) {
      this._onFills(accumulated).catch((err) =>
        console.error(`[HFT:queue:${this._symbol}] onFills error:`, err.message)
      );
    }

    // If more items arrived while we were draining, schedule another tick
    if (this._queue.length > 0 && !this._paused) {
      this._scheduleDrain();
    }
  }

  /** Drain remaining items then stop accepting new ones. */
  async shutdown() {
    this._paused = true;
    if (this._immediate !== null) {
      clearImmediate(this._immediate);
      this._immediate = null;
    }
    // Process whatever is left synchronously
    if (this._queue.length > 0) {
      const remaining = this._queue.splice(0);
      const fills = [];
      for (const item of remaining) {
        try {
          const f = this._process(item);
          if (f && f.length) fills.push(...f);
        } catch { /* best-effort */ }
      }
      if (fills.length) {
        try { await this._onFills(fills); } catch { /* best-effort */ }
      }
    }
  }
}

// ── OrderQueueManager ─────────────────────────────────────────────────────────

export class OrderQueueManager {
  /**
   * @param {Function} processFn  — (item) → PendingFill[]   (synchronous match)
   * @param {Function} onFills    — async (fills[]) → void   (DB flush)
   * @param {Function} onError    — (err, item) → void
   */
  constructor(processFn, onFills, onError = console.error) {
    this._processFn = processFn;
    this._onFills   = onFills;
    this._onError   = onError;
    this._queues    = new Map(); // symbol → SymbolQueue
  }

  /**
   * Enqueue an order for the given symbol.
   * Creates a SymbolQueue on first use (lazy init — no startup cost).
   * Returns false if the symbol queue is full.
   */
  enqueue(symbol, item) {
    const q = this._getOrCreate(symbol);
    return q.enqueue(item);
  }

  _getOrCreate(symbol) {
    if (!this._queues.has(symbol)) {
      this._queues.set(
        symbol,
        new SymbolQueue(symbol, this._processFn, this._onFills, this._onError)
      );
    }
    return this._queues.get(symbol);
  }

  /** Current depth for a symbol (0 if queue doesn't exist). */
  depth(symbol) {
    return this._queues.get(symbol)?.size ?? 0;
  }

  /** Aggregate stats across all queues. */
  stats() {
    const out = {};
    for (const [sym, q] of this._queues) {
      out[sym] = { depth: q.size };
    }
    return out;
  }

  /** Graceful shutdown — drain all queues. */
  async shutdown() {
    await Promise.allSettled(
      [...this._queues.values()].map((q) => q.shutdown())
    );
    this._queues.clear();
  }
}
