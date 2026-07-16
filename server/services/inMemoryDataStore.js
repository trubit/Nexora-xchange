/**
 * In-Memory Data Store
 *
 * High-performance in-process cache for the hottest data paths:
 *
 *   - Order book snapshots (top N levels per symbol)
 *   - Recent trade tape (last M trades per symbol)
 *   - Ticker summaries (best bid/ask + 24h stats)
 *   - User balance snapshots (read-only, invalidated on trade)
 *
 * Design:
 *   - LRU eviction per namespace (cap by item count)
 *   - TTL-based expiry (lazy on read + periodic sweep)
 *   - Lock-free (single-threaded Node.js — no mutex needed)
 *   - Zero I/O — stays entirely in the V8 heap
 *
 * CRITICAL: This store is read-only analytics.
 * Only the matching engine / order service may update order book state.
 * This store is populated via event listeners attached to those services.
 */

import { EventEmitter } from "events";
import logger from "../config/logger.js";

// Configuration
const DEFAULT_MAX_ITEMS  = 1_000;
const DEFAULT_TTL_MS     = 30_000;  // 30 s
const SWEEP_INTERVAL_MS  = 10_000;  // sweep every 10 s

export class LruCache {
  constructor({ maxItems = DEFAULT_MAX_ITEMS, ttlMs = DEFAULT_TTL_MS } = {}) {
    this._map     = new Map();
    this._maxItems = maxItems;
    this._ttlMs    = ttlMs;
  }

  set(key, value, ttlMs = this._ttlMs) {
    if (this._map.has(key)) this._map.delete(key);  // move to end (LRU)
    this._map.set(key, { value, expiresAt: Date.now() + ttlMs });
    if (this._map.size > this._maxItems) {
      // Evict oldest entry
      this._map.delete(this._map.keys().next().value);
    }
  }

  get(key) {
    const entry = this._map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) { this._map.delete(key); return undefined; }
    // Move to end (recently used)
    this._map.delete(key);
    this._map.set(key, entry);
    return entry.value;
  }

  delete(key) { this._map.delete(key); }

  has(key) { return this.get(key) !== undefined; }

  sweep() {
    const now = Date.now();
    for (const [k, v] of this._map) {
      if (now > v.expiresAt) this._map.delete(k);
    }
  }

  size() { return this._map.size; }

  clear() { this._map.clear(); }
}

export class InMemoryDataStore extends EventEmitter {
  constructor() {
    super();
    this._orderBooks = new LruCache({ maxItems: 200, ttlMs: 5_000 });    // 5 s — very hot
    this._tradeTape  = new LruCache({ maxItems: 500, ttlMs: 60_000 });   // 1 min
    this._tickers    = new LruCache({ maxItems: 200, ttlMs: 10_000 });   // 10 s
    this._userBals   = new LruCache({ maxItems: 10_000, ttlMs: 30_000 }); // 30 s
    this._generic    = new LruCache({ maxItems: 5_000, ttlMs: 30_000 });

    this._sweepHandle = null;
    this._stats = { hits: 0, misses: 0, writes: 0, evictions: 0 };
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  start() {
    this._sweepHandle = setInterval(() => this._sweep(), SWEEP_INTERVAL_MS);
    logger.info("[InMemStore] Started.");
  }

  stop() {
    if (this._sweepHandle) clearInterval(this._sweepHandle);
    logger.info("[InMemStore] Stopped.");
  }

  // ── Order Book ────────────────────────────────────────────────────────────────

  setOrderBook(symbol, snapshot) {
    this._orderBooks.set(symbol, snapshot);
    this._stats.writes++;
  }

  getOrderBook(symbol) {
    const v = this._orderBooks.get(symbol);
    v ? this._stats.hits++ : this._stats.misses++;
    return v || null;
  }

  // ── Trade Tape ────────────────────────────────────────────────────────────────

  appendTrade(symbol, trade) {
    const existing = this._tradeTape.get(symbol) || [];
    // Keep last 100 trades per symbol
    const updated  = [trade, ...existing].slice(0, 100);
    this._tradeTape.set(symbol, updated);
    this._stats.writes++;
  }

  getTrades(symbol, limit = 20) {
    const tape = this._tradeTape.get(symbol);
    if (tape) { this._stats.hits++; return tape.slice(0, limit); }
    this._stats.misses++;
    return [];
  }

  // ── Tickers ───────────────────────────────────────────────────────────────────

  setTicker(symbol, ticker) {
    this._tickers.set(symbol, ticker);
    this._stats.writes++;
  }

  getTicker(symbol) {
    const v = this._tickers.get(symbol);
    v ? this._stats.hits++ : this._stats.misses++;
    return v || null;
  }

  getAllTickers() {
    const result = {};
    const now    = Date.now();
    for (const [k, entry] of this._tickers._map) {
      if (entry && now <= entry.expiresAt) result[k] = entry.value;
    }
    return result;
  }

  // ── User Balances ─────────────────────────────────────────────────────────────

  setUserBalance(userId, balances) {
    this._userBals.set(String(userId), balances);
    this._stats.writes++;
  }

  getUserBalance(userId) {
    const v = this._userBals.get(String(userId));
    v ? this._stats.hits++ : this._stats.misses++;
    return v || null;
  }

  invalidateUserBalance(userId) {
    this._userBals.delete(String(userId));
  }

  // ── Generic ───────────────────────────────────────────────────────────────────

  set(key, value, ttlMs) {
    this._generic.set(key, value, ttlMs);
    this._stats.writes++;
  }

  get(key) {
    const v = this._generic.get(key);
    v !== undefined ? this._stats.hits++ : this._stats.misses++;
    return v;
  }

  del(key) { this._generic.delete(key); }

  // ── Stats & Sweep ─────────────────────────────────────────────────────────────

  _sweep() {
    [this._orderBooks, this._tradeTape, this._tickers, this._userBals, this._generic]
      .forEach((c) => c.sweep());
  }

  getStats() {
    const total = this._stats.hits + this._stats.misses;
    return {
      ...this._stats,
      hitRatePct:    total > 0 ? +((this._stats.hits / total) * 100).toFixed(1) : 0,
      orderBooks:    this._orderBooks.size(),
      tradeTape:     this._tradeTape.size(),
      tickers:       this._tickers.size(),
      userBalances:  this._userBals.size(),
      generic:       this._generic.size(),
    };
  }

  clearAll() {
    [this._orderBooks, this._tradeTape, this._tickers, this._userBals, this._generic]
      .forEach((c) => c.clear());
    this._stats = { hits: 0, misses: 0, writes: 0, evictions: 0 };
  }
}

export const inMemoryDataStore = new InMemoryDataStore();
