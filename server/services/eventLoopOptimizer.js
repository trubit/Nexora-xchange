/**
 * Event Loop Optimizer
 *
 * Monitors Node.js event loop health and implements strategies to keep it
 * responsive under high load:
 *
 *   - Event loop lag measurement (via setImmediate delta)
 *   - CPU-intensive task scheduling (yielding between chunks)
 *   - Back-pressure signals to upstream producers
 *   - Automatic GC nudge on memory threshold
 *   - Metrics collection for performance dashboard
 *
 * Read-only analytics — does NOT modify core matching engine state.
 */

import { EventEmitter } from "events";
import logger from "../config/logger.js";

const SAMPLE_INTERVAL_MS = 1_000;  // lag check every 1 s
const WARN_LAG_MS        = 100;    // warn if event loop lags > 100 ms
const CRITICAL_LAG_MS    = 500;    // critical if lag > 500 ms
const CHUNK_YIELD_EVERY  = 100;    // yield every N iterations in heavy loops
const GC_MEMORY_THRESHOLD_MB = 800;

export class EventLoopOptimizer extends EventEmitter {
  constructor() {
    super();
    this._lagSamples    = [];   // last 60 samples
    this._metrics       = { currentLagMs: 0, avgLagMs: 0, maxLagMs: 0, gcCount: 0, backPressure: false };
    this._samplerHandle = null;
    this._running       = false;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  start() {
    if (this._running) return;
    this._running = true;
    this._scheduleSample();
    logger.info("[ELO] Event loop optimizer started.");
  }

  stop() {
    this._running = false;
    if (this._samplerHandle) clearTimeout(this._samplerHandle);
    logger.info("[ELO] Event loop optimizer stopped.");
  }

  // ── Lag measurement ───────────────────────────────────────────────────────────

  _scheduleSample() {
    if (!this._running) return;
    const before = Date.now();
    setImmediate(() => {
      const lag = Date.now() - before;
      this._recordLag(lag);
      this._samplerHandle = setTimeout(() => this._scheduleSample(), SAMPLE_INTERVAL_MS);
    });
  }

  _recordLag(lagMs) {
    this._lagSamples.push({ ts: Date.now(), lag: lagMs });
    if (this._lagSamples.length > 60) this._lagSamples.shift();

    const total = this._lagSamples.reduce((s, r) => s + r.lag, 0);
    this._metrics.currentLagMs = lagMs;
    this._metrics.avgLagMs     = Math.round(total / this._lagSamples.length);
    this._metrics.maxLagMs     = Math.max(...this._lagSamples.map((r) => r.lag));

    if (lagMs >= CRITICAL_LAG_MS) {
      this._metrics.backPressure = true;
      this.emit("backpressure", { lagMs, level: "critical" });
      logger.error({ lagMs }, "[ELO] CRITICAL event loop lag detected.");
    } else if (lagMs >= WARN_LAG_MS) {
      this.emit("backpressure", { lagMs, level: "warning" });
      logger.warn({ lagMs }, "[ELO] Event loop lag elevated.");
    } else if (this._metrics.backPressure && lagMs < WARN_LAG_MS / 2) {
      this._metrics.backPressure = false;
      this.emit("recovered");
    }

    // Nudge GC on high memory
    this._checkMemory();
  }

  _checkMemory() {
    const used = process.memoryUsage().heapUsed / 1_048_576;  // bytes → MB
    if (used > GC_MEMORY_THRESHOLD_MB && global.gc) {
      global.gc();
      this._metrics.gcCount++;
      logger.info({ heapMb: Math.round(used) }, "[ELO] GC nudged.");
    }
  }

  // ── Chunked processing ────────────────────────────────────────────────────────

  /**
   * Process `items` in chunks, yielding to the event loop between each chunk.
   * Use this for any CPU-bound loop operating on large arrays.
   *
   * @param {Array}    items
   * @param {Function} processor  async fn(item) — called per item
   * @param {number}   chunkSize  default: CHUNK_YIELD_EVERY
   */
  async processChunked(items, processor, chunkSize = CHUNK_YIELD_EVERY) {
    const results = [];
    for (let i = 0; i < items.length; i++) {
      results.push(await processor(items[i]));
      if ((i + 1) % chunkSize === 0) {
        await this.yield();
      }
    }
    return results;
  }

  /**
   * Defer execution to the next tick / immediate, allowing I/O events to be processed.
   */
  yield() {
    return new Promise((resolve) => setImmediate(resolve));
  }

  /**
   * Schedule `fn` as a micro-batch — deferred by `delayMs` to avoid blocking
   * the current call stack, then run in a chunked loop.
   */
  schedule(fn, delayMs = 0) {
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try { resolve(await fn()); }
        catch (err) { reject(err); }
      }, delayMs);
    });
  }

  // ── Metrics ───────────────────────────────────────────────────────────────────

  getMetrics() {
    const mem = process.memoryUsage();
    return {
      ...this._metrics,
      heapUsedMb:  +(mem.heapUsed  / 1_048_576).toFixed(1),
      heapTotalMb: +(mem.heapTotal / 1_048_576).toFixed(1),
      rssMb:       +(mem.rss       / 1_048_576).toFixed(1),
      uptimeSeconds: Math.round(process.uptime()),
      samplesCollected: this._lagSamples.length,
    };
  }

  getLagHistory() {
    return [...this._lagSamples];
  }

  isUnderPressure() {
    return this._metrics.backPressure;
  }
}

export const eventLoopOptimizer = new EventLoopOptimizer();
