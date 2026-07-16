/**
 * Performance Core Service (Stage 4 Orchestrator)
 *
 * Ties together all Stage 4 performance components:
 *   - Event loop optimizer (lag monitoring + chunked processing)
 *   - In-memory data store (hot-path cache)
 *   - Batch processor (micro-batching for DB writes)
 *   - Redis pipeline optimizer (efficient Redis usage)
 *
 * Provides:
 *   - Unified startup / shutdown
 *   - Performance metrics endpoint data
 *   - Pre-wired batch queues for common patterns
 *   - Network latency reducer (request coalescing)
 */

import { EventEmitter }           from "events";
import { eventLoopOptimizer }     from "./eventLoopOptimizer.js";
import { inMemoryDataStore }      from "./inMemoryDataStore.js";
import { batchProcessor, BatchProcessor } from "./batchProcessor.js";
import { redisPipelineOptimizer } from "./redisPipelineOptimizer.js";
import logger                     from "../config/logger.js";

// Shared coalescing map for request deduplication
const _coalescingPending = new Map();

export class PerformanceCoreService extends EventEmitter {
  constructor() {
    super();
    this._running   = false;
    this._startedAt = null;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  async start() {
    if (this._running) return;

    // 1. Start event loop monitoring
    eventLoopOptimizer.start();
    eventLoopOptimizer.on("backpressure", ({ lagMs, level }) => {
      logger.warn({ lagMs, level }, "[PerfCore] Back-pressure detected — throttling producers.");
      this.emit("backpressure", { lagMs, level });
    });
    eventLoopOptimizer.on("recovered", () => {
      logger.info("[PerfCore] Event loop recovered.");
      this.emit("recovered");
    });

    // 2. Start in-memory store sweep
    inMemoryDataStore.start();

    // 3. Register shared batch queues

    // Audit log batch — flush every 1 s or 100 items
    if (!batchProcessor._queues.has("audit_logs")) {
      batchProcessor.register("audit_logs", async (items) => {
        const AuditLog = (await import("../models/AuditLog.js")).default;
        await AuditLog.insertMany(items, { ordered: false });
      }, { batchSize: 100, flushMs: 1_000 });
    }

    // Credit score invalidations — flush every 5 s or 50 items
    if (!batchProcessor._queues.has("credit_invalidations")) {
      batchProcessor.register("credit_invalidations", async (userIds) => {
        const { creditRiskEngine } = await import("./creditRiskEngine.js");
        for (const uid of userIds) await creditRiskEngine.markStale(uid).catch(() => {});
      }, { batchSize: 50, flushMs: 5_000 });
    }

    // Market data Redis publish batch — flush every 100 ms or 200 items
    if (!batchProcessor._queues.has("market_pub")) {
      batchProcessor.register("market_pub", async (events) => {
        await redisPipelineOptimizer.publishMany(
          events.map((e) => ({ channel: `market:${e.symbol}`, message: e })),
        );
      }, { batchSize: 200, flushMs: 100 });
    }

    this._running   = true;
    this._startedAt = new Date();
    logger.info("[PerfCore] All Stage 4 performance services started.");
  }

  async stop() {
    if (!this._running) return;
    eventLoopOptimizer.stop();
    inMemoryDataStore.stop();
    await batchProcessor.shutdown();
    this._running = false;
    logger.info("[PerfCore] All Stage 4 performance services stopped.");
  }

  // ── Conveniences ──────────────────────────────────────────────────────────────

  /**
   * Coalesce concurrent identical queries into a single DB call.
   * Callers waiting for the same key all get the same promise.
   */
  async coalesce(key, loader) {
    return BatchProcessor.coalesce(_coalescingPending, key, loader);
  }

  /**
   * Run a CPU-intensive loop chunked so it doesn't block the event loop.
   */
  async processChunked(items, fn, chunkSize = 100) {
    return eventLoopOptimizer.processChunked(items, fn, chunkSize);
  }

  /**
   * Publish a market data event (batched for efficiency).
   */
  publishMarketEvent(symbol, data) {
    batchProcessor.enqueue("market_pub", { symbol, ...data, ts: Date.now() });
  }

  /**
   * Queue a credit score invalidation (batched to avoid DB storm on mass trades).
   */
  invalidateCreditScore(userId) {
    batchProcessor.enqueue("credit_invalidations", String(userId));
  }

  // ── Metrics ───────────────────────────────────────────────────────────────────

  getMetrics() {
    return {
      uptime:        this._startedAt ? Math.round((Date.now() - this._startedAt) / 1000) : 0,
      running:       this._running,
      eventLoop:     eventLoopOptimizer.getMetrics(),
      inMemoryStore: inMemoryDataStore.getStats(),
      batchQueues:   batchProcessor.getStats(),
      redis:         redisPipelineOptimizer.getStats(),
      coalescing:    { pendingKeys: _coalescingPending.size },
    };
  }
}

export const performanceCoreService = new PerformanceCoreService();
