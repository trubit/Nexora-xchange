/**
 * Batch Processor
 *
 * Collects individual items arriving at high frequency into micro-batches
 * and flushes them at configurable intervals or size limits.
 *
 * Use cases:
 *   - Batch-write audit log entries instead of one DB insert per event
 *   - Aggregate price update notifications before broadcasting via Redis
 *   - Batch-compute credit score invalidations after bursts of trades
 *   - Coalesce multiple concurrent read requests into one DB query (request coalescing)
 *
 * Architecture:
 *   - Each named queue is independent
 *   - Flush is triggered by EITHER batch size OR timeout (whichever fires first)
 *   - Failed flushes are retried up to MAX_RETRIES with exponential back-off
 *   - Never blocks the caller — enqueue() is synchronous, flush is async
 */

import { EventEmitter } from "events";
import logger from "../config/logger.js";

const DEFAULT_BATCH_SIZE  = 50;
const DEFAULT_FLUSH_MS    = 500;   // max wait before a flush
const MAX_RETRIES         = 3;
const RETRY_BASE_MS       = 200;

export class BatchProcessor extends EventEmitter {
  constructor() {
    super();
    this._queues = new Map();  // name → QueueState
  }

  // ── Queue registration ─────────────────────────────────────────────────────────

  /**
   * Register a named queue with a flush handler.
   *
   * @param {string}   name         unique queue name
   * @param {Function} flushHandler async fn(items: any[]) → void
   * @param {object}   opts         { batchSize, flushMs }
   */
  register(name, flushHandler, { batchSize = DEFAULT_BATCH_SIZE, flushMs = DEFAULT_FLUSH_MS } = {}) {
    if (this._queues.has(name)) {
      throw new Error(`BatchProcessor: queue "${name}" already registered.`);
    }
    this._queues.set(name, {
      name, flushHandler, batchSize, flushMs,
      items: [], timer: null,
      stats: { flushed: 0, items: 0, errors: 0 },
    });
  }

  // ── Enqueue ────────────────────────────────────────────────────────────────────

  /**
   * Add an item to the named queue.
   * Triggers an immediate flush if the batch size is reached.
   */
  enqueue(name, item) {
    const q = this._queue(name);
    q.items.push(item);

    if (q.items.length >= q.batchSize) {
      this._flush(q);
      return;
    }

    // Arm timer if not already running
    if (!q.timer) {
      q.timer = setTimeout(() => this._flush(q), q.flushMs);
    }
  }

  /**
   * Enqueue multiple items at once.
   */
  enqueueMany(name, items) {
    for (const item of items) this.enqueue(name, item);
  }

  // ── Manual flush ──────────────────────────────────────────────────────────────

  async flushNow(name) {
    const q = this._queue(name);
    return this._flush(q, true);
  }

  async flushAll() {
    const promises = [];
    for (const [name] of this._queues) {
      promises.push(this.flushNow(name));
    }
    await Promise.all(promises);
  }

  // ── Internal flush ────────────────────────────────────────────────────────────

  async _flush(q, immediate = false) {
    if (q.timer) { clearTimeout(q.timer); q.timer = null; }
    if (q.items.length === 0) return;

    const batch = q.items.splice(0, q.items.length);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await q.flushHandler(batch);
        q.stats.flushed++;
        q.stats.items += batch.length;
        this.emit("flushed", { name: q.name, count: batch.length });
        return;
      } catch (err) {
        logger.warn({
          err: err.message,
          queue: q.name,
          batchSize: batch.length,
          attempt,
        }, "[BatchProcessor] Flush error.");

        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_BASE_MS * 2 ** (attempt - 1)));
        } else {
          q.stats.errors++;
          this.emit("error", { name: q.name, err, batch });
          logger.error({
            err: err.message,
            queue: q.name,
            dropped: batch.length,
          }, "[BatchProcessor] Batch dropped after max retries.");
        }
      }
    }
  }

  // ── Request coalescing ─────────────────────────────────────────────────────────

  /**
   * Coalesce multiple callers asking for the same key into one resolver invocation.
   * Returns a promise that resolves when the loader completes.
   *
   * @param {Map}      pending   shared Map<key, Promise> maintained by the caller
   * @param {string}   key
   * @param {Function} loader    async () → value
   */
  static async coalesce(pending, key, loader) {
    if (pending.has(key)) return pending.get(key);
    const promise = loader().finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  _queue(name) {
    const q = this._queues.get(name);
    if (!q) throw new Error(`BatchProcessor: queue "${name}" not registered.`);
    return q;
  }

  getStats(name) {
    return name ? this._queue(name).stats : Object.fromEntries(
      [...this._queues.entries()].map(([k, v]) => [k, v.stats]),
    );
  }

  getQueueSize(name) {
    return this._queue(name).items.length;
  }

  // ── Shutdown ──────────────────────────────────────────────────────────────────

  async shutdown() {
    await this.flushAll();
    for (const q of this._queues.values()) {
      if (q.timer) { clearTimeout(q.timer); q.timer = null; }
    }
    logger.info("[BatchProcessor] Shutdown complete.");
  }
}

export const batchProcessor = new BatchProcessor();
