/**
 * Global Order Book Sync
 *
 * Maintains a consistent, versioned snapshot of the order book for each
 * trading symbol and distributes it to all nodes in the cluster via Redis.
 *
 * Responsibilities:
 *   - Accept order book delta events from the matching engine (read-only analytics)
 *   - Apply deltas to the in-memory snapshot atomically (version-stamped)
 *   - Publish full snapshots and incremental diffs to Redis channels
 *   - Serve the authoritative snapshot for inter-node reads
 *   - Detect and recover from stale/diverged snapshots
 *
 * CRITICAL: Never modifies matching engine state. Receives events; never writes
 * back to the engine's order queue or trade execution path.
 */

import { EventEmitter }       from "events";
import { inMemoryDataStore }  from "./inMemoryDataStore.js";
import { redisPipelineOptimizer } from "./redisPipelineOptimizer.js";
import { redisClients }       from "../config/redis.js";
import logger                 from "../config/logger.js";

const SNAPSHOT_CHANNEL = "ob:snapshot:";
const DELTA_CHANNEL    = "ob:delta:";
const SNAPSHOT_TTL     = 30;  // seconds
const MAX_BOOK_LEVELS  = 50;

export class GlobalOrderBookSync extends EventEmitter {
  constructor() {
    super();
    this._versions = new Map();  // symbol → version number
    this._running  = false;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  start() {
    this._running = true;
    logger.info("[OBSync] Global order book sync started.");
  }

  stop() {
    this._running = false;
    logger.info("[OBSync] Global order book sync stopped.");
  }

  // ── Delta application ─────────────────────────────────────────────────────────

  /**
   * Apply an order book delta event.
   * Called when the matching engine processes a new order or cancellation.
   *
   * @param {string} symbol
   * @param {object} delta  { bids: [[price, qty]…], asks: [[price, qty]…], ts }
   */
  applyDelta(symbol, delta) {
    if (!this._running) return;

    const current  = inMemoryDataStore.getOrderBook(symbol) || { bids: [], asks: [], version: 0, symbol };
    const updated  = this._mergeDelta(current, delta);
    const version  = (this._versions.get(symbol) || 0) + 1;

    updated.version    = version;
    updated.lastUpdate = Date.now();
    this._versions.set(symbol, version);

    inMemoryDataStore.setOrderBook(symbol, updated);

    // Publish delta to Redis for other nodes
    this._publishDelta(symbol, delta, version).catch((err) =>
      logger.warn({ err: err.message, symbol }, "[OBSync] Delta publish failed."),
    );

    this.emit("delta", { symbol, version, delta });
  }

  /**
   * Set a full order book snapshot (e.g. on startup or recovery from stale state).
   */
  setSnapshot(symbol, bids, asks, ts = Date.now()) {
    const version = (this._versions.get(symbol) || 0) + 1;
    const snapshot = {
      symbol, bids: this._sortBids(bids), asks: this._sortAsks(asks),
      version, lastUpdate: ts,
    };

    this._versions.set(symbol, version);
    inMemoryDataStore.setOrderBook(symbol, snapshot);

    this._publishSnapshot(symbol, snapshot).catch((err) =>
      logger.warn({ err: err.message, symbol }, "[OBSync] Snapshot publish failed."),
    );

    this.emit("snapshot", { symbol, version });
  }

  // ── Read ──────────────────────────────────────────────────────────────────────

  /**
   * Get the current order book snapshot for a symbol.
   * Falls back to Redis if not in local memory.
   */
  async getOrderBook(symbol) {
    const local = inMemoryDataStore.getOrderBook(symbol);
    if (local) return local;

    return this._fetchFromRedis(symbol);
  }

  async getAllSymbols() {
    return [...this._versions.keys()];
  }

  getVersion(symbol) {
    return this._versions.get(symbol) || 0;
  }

  // ── Merge logic ───────────────────────────────────────────────────────────────

  _mergeDelta(current, delta) {
    const bids = this._applyLevels([...current.bids], delta.bids || []);
    const asks = this._applyLevels([...current.asks], delta.asks || []);
    return { ...current, bids, asks };
  }

  _applyLevels(levels, updates) {
    const map = new Map(levels.map(([p, q]) => [p, q]));
    for (const [price, qty] of updates) {
      if (qty === 0) map.delete(price);
      else map.set(price, qty);
    }
    return [...map.entries()];
  }

  _sortBids(levels) {
    return [...levels].sort((a, b) => b[0] - a[0]).slice(0, MAX_BOOK_LEVELS);
  }

  _sortAsks(levels) {
    return [...levels].sort((a, b) => a[0] - b[0]).slice(0, MAX_BOOK_LEVELS);
  }

  // ── Redis I/O ─────────────────────────────────────────────────────────────────

  async _publishSnapshot(symbol, snapshot) {
    const redis = redisClients.cache;
    if (!redis) return;
    await redis.setex(
      `${SNAPSHOT_CHANNEL}${symbol}`,
      SNAPSHOT_TTL,
      JSON.stringify(snapshot),
    );
    await redisPipelineOptimizer.publish(`${SNAPSHOT_CHANNEL}${symbol}`, snapshot);
  }

  async _publishDelta(symbol, delta, version) {
    await redisPipelineOptimizer.publish(`${DELTA_CHANNEL}${symbol}`, { symbol, delta, version, ts: Date.now() });
  }

  async _fetchFromRedis(symbol) {
    const redis = redisClients.cache;
    if (!redis) return null;
    try {
      const raw = await redis.get(`${SNAPSHOT_CHANNEL}${symbol}`);
      if (!raw) return null;
      const snap = JSON.parse(raw);
      inMemoryDataStore.setOrderBook(symbol, snap);
      return snap;
    } catch { return null; }
  }
}

export const globalOrderBookSync = new GlobalOrderBookSync();
