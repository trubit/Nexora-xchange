/**
 * Global Sync Engine (Stage 5 Orchestrator)
 *
 * Coordinates all Stage 5 global synchronisation services:
 *   - Global order book sync
 *   - Cross-region event replication
 *   - Conflict resolution
 *   - Distributed consistency management
 *   - Global timestamp authority
 *
 * Provides:
 *   - Unified startup / shutdown
 *   - Health & status endpoint data
 *   - Event bridge (pipes matching engine events into the replication stream)
 */

import { EventEmitter }                  from "events";
import { globalOrderBookSync }           from "./globalOrderBookSync.js";
import { crossRegionEventReplicator }    from "./crossRegionEventReplicator.js";
import { conflictResolutionEngine }      from "./conflictResolutionEngine.js";
import { distributedConsistencyManager } from "./distributedConsistencyManager.js";
import { globalTimestampAuthority }      from "./globalTimestampAuthority.js";
import logger                            from "../config/logger.js";

export class GlobalSyncEngine extends EventEmitter {
  constructor() {
    super();
    this._running   = false;
    this._startedAt = null;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  async start() {
    if (this._running) return;

    globalTimestampAuthority.start();
    globalOrderBookSync.start();
    crossRegionEventReplicator.start();

    // Wire OB sync events into the replication stream
    globalOrderBookSync.on("delta", ({ symbol, version, delta }) => {
      crossRegionEventReplicator.publish("ORDER_BOOK_DELTA", { symbol, version, delta })
        .catch((err) => logger.warn({ err: err.message }, "[GSE] OB delta publish failed."));
    });

    this._running   = true;
    this._startedAt = new Date();
    logger.info("[GSE] Global Sync Engine started.");
  }

  async stop() {
    if (!this._running) return;
    globalOrderBookSync.stop();
    crossRegionEventReplicator.stop();
    globalTimestampAuthority.stop();
    this._running = false;
    logger.info("[GSE] Global Sync Engine stopped.");
  }

  // ── Event bridge ──────────────────────────────────────────────────────────────

  /**
   * Called by order/trade services to push events into the sync pipeline.
   * Stamps each event with a GTA timestamp before replication.
   */
  async onTradeExecuted(trade) {
    const ts = globalTimestampAuthority.now();
    await crossRegionEventReplicator.emitTradeExecuted({ ...trade, gta_ts: ts });
  }

  async onOrderPlaced(order) {
    const ts = globalTimestampAuthority.now();
    await crossRegionEventReplicator.emitOrderPlaced({ ...order, gta_ts: ts });
    if (order.symbol && order.bids !== undefined) {
      globalOrderBookSync.applyDelta(order.symbol, { bids: order.bids || [], asks: order.asks || [] });
    }
  }

  async onOrderCancelled(order) {
    const ts = globalTimestampAuthority.now();
    await crossRegionEventReplicator.emitOrderCancelled({ ...order, gta_ts: ts });
  }

  async onPriceUpdate(symbol, price) {
    const ts = globalTimestampAuthority.now();
    await crossRegionEventReplicator.emitPriceUpdate(symbol, { price, ts });
  }

  async onUserDeposit(userId, amount) {
    await crossRegionEventReplicator.emitUserDeposit(userId, amount);
  }

  async onUserWithdrawal(userId, amount) {
    await crossRegionEventReplicator.emitUserWithdrawal(userId, amount);
  }

  // ── Convenience wrappers ──────────────────────────────────────────────────────

  getOrderBook(symbol)        { return globalOrderBookSync.getOrderBook(symbol); }
  setOrderBookSnapshot(s, b, a) { return globalOrderBookSync.setSnapshot(s, b, a); }
  nextEventId()               { return globalTimestampAuthority.nextEventId(); }
  timestamp()                 { return globalTimestampAuthority.now(); }

  async withLock(resource, fn, ttlMs) {
    return distributedConsistencyManager.withLock(resource, fn, ttlMs);
  }

  async isDuplicateEvent(key) {
    return conflictResolutionEngine.isDuplicate(key);
  }

  // ── Status ────────────────────────────────────────────────────────────────────

  async getStatus() {
    return {
      running:      this._running,
      startedAt:    this._startedAt,
      uptimeSeconds: this._startedAt ? Math.round((Date.now() - this._startedAt) / 1000) : 0,
      orderBook:    { symbols: await globalOrderBookSync.getAllSymbols() },
      replication:  crossRegionEventReplicator.getStats(),
      conflictResolution: conflictResolutionEngine.getStats(),
      consistency:  distributedConsistencyManager.getStats(),
      timestamp:    globalTimestampAuthority.getStats(),
    };
  }
}

export const globalSyncEngine = new GlobalSyncEngine();
