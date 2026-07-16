/**
 * Market Feed Aggregator
 *
 * Aggregates price feeds from:
 *   1. Internal exchange (live from MarketDataService / MatchingEngine books)
 *   2. Simulated external exchanges (realistic synthetic feeds for dev/testing)
 *
 * READ-ONLY — never writes to the matching engine or order books.
 * External exchange connectivity is pluggable via the ExchangeAdapter interface.
 */

import { EventEmitter } from "events";
import { redisClients } from "../config/redis.js";
import logger from "../config/logger.js";

const INTERNAL_EXCHANGE = "trusonxchanger";
const FEED_TTL_MS       = 10_000;  // price feed considered stale after 10 s
const SNAPSHOT_KEY      = "mfa:snapshot";  // Redis hash key

// ─── Simulated external exchange prices ────────────────────────────────────────
// In production replace this class with real WebSocket adapters per exchange.
class SimulatedExchangeAdapter {
  constructor(name, { baseSpreadPct = 0.002, noiseAmplitude = 0.003, driftRate = 0.00005 } = {}) {
    this.name           = name;
    this.baseSpreadPct  = baseSpreadPct;
    this.noiseAmplitude = noiseAmplitude;
    this.driftRate      = driftRate;
    this._prices        = new Map();
  }

  /** Seed initial price (called when internal price is first seen). */
  seed(symbol, midPrice) {
    if (!this._prices.has(symbol)) {
      // Start slightly off the mid — gives realistic arbitrage surface
      const offset = (Math.random() - 0.5) * 0.005 * midPrice;
      this._prices.set(symbol, midPrice + offset);
    }
  }

  /** Return a simulated ticker for the symbol. */
  getTicker(symbol) {
    if (!this._prices.has(symbol)) return null;

    const base   = this._prices.get(symbol);
    const drift  = (Math.random() - 0.5) * this.driftRate * base;
    const noise  = (Math.random() - 0.5) * this.noiseAmplitude * base;
    const mid    = base + drift + noise;

    // Persist the drifted price so subsequent calls are continuous
    this._prices.set(symbol, mid);

    const half   = (this.baseSpreadPct / 2) * mid;
    return {
      exchange:  this.name,
      symbol,
      bid:       +(mid - half).toFixed(8),
      ask:       +(mid + half).toFixed(8),
      mid:       +mid.toFixed(8),
      volume24h: +(Math.random() * 1_000_000).toFixed(2),
      ts:        Date.now(),
    };
  }
}

// ─── MarketFeedAggregator ───────────────────────────────────────────────────────

export class MarketFeedAggregator extends EventEmitter {
  constructor() {
    super();
    this._feeds     = new Map(); // exchange → symbol → ticker
    this._adapters  = new Map(); // external exchange adapters
    this._timer     = null;
    this._pollMs    = Number(process.env.ARBI_FEED_POLL_MS || 2000);

    // Register simulated external exchanges
    this._registerAdapter(new SimulatedExchangeAdapter("binance_sim",   { baseSpreadPct: 0.001, noiseAmplitude: 0.002 }));
    this._registerAdapter(new SimulatedExchangeAdapter("coinbase_sim",  { baseSpreadPct: 0.0015, noiseAmplitude: 0.0025 }));
    this._registerAdapter(new SimulatedExchangeAdapter("kraken_sim",    { baseSpreadPct: 0.002,  noiseAmplitude: 0.003 }));
    this._registerAdapter(new SimulatedExchangeAdapter("okx_sim",       { baseSpreadPct: 0.0012, noiseAmplitude: 0.0022 }));
  }

  _registerAdapter(adapter) {
    this._adapters.set(adapter.name, adapter);
    this._feeds.set(adapter.name, new Map());
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  start() {
    if (this._timer) return;
    this._timer = setInterval(() => this._poll(), this._pollMs);
    this._timer.unref();
    logger.info("[MFA] Market feed aggregator started.");
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    logger.info("[MFA] Market feed aggregator stopped.");
  }

  // ── Feed ingestion ────────────────────────────────────────────────────────────

  /**
   * Ingest an internal price update (called by MarketDataService or MatchingEngine broadcaster).
   * @param {string} symbol
   * @param {{ bid: number, ask: number, last: number, volume24h: number }} data
   */
  ingestInternal(symbol, data) {
    const sym    = symbol.toUpperCase();
    const ticker = {
      exchange:  INTERNAL_EXCHANGE,
      symbol:    sym,
      bid:       Number(data.bid  || data.last || 0),
      ask:       Number(data.ask  || data.last || 0),
      mid:       Number(data.last || ((data.bid + data.ask) / 2) || 0),
      volume24h: Number(data.volume24h || 0),
      ts:        Date.now(),
    };

    if (!this._feeds.has(INTERNAL_EXCHANGE)) {
      this._feeds.set(INTERNAL_EXCHANGE, new Map());
    }
    this._feeds.get(INTERNAL_EXCHANGE).set(sym, ticker);

    // Seed external adapters on first internal price
    for (const adapter of this._adapters.values()) {
      adapter.seed(sym, ticker.mid || ticker.bid || ticker.ask);
    }

    this.emit("internalUpdate", ticker);
  }

  // ── Polling ───────────────────────────────────────────────────────────────────

  async _poll() {
    // Collect all symbols that have an internal feed
    const internalFeed = this._feeds.get(INTERNAL_EXCHANGE);
    if (!internalFeed || internalFeed.size === 0) return;

    const symbols = [...internalFeed.keys()];
    const snapshot = {};

    for (const sym of symbols) {
      snapshot[sym] = {};
      const internalTicker = internalFeed.get(sym);
      snapshot[sym][INTERNAL_EXCHANGE] = internalTicker;

      // Fetch from each simulated adapter
      for (const [name, adapter] of this._adapters) {
        const ticker = adapter.getTicker(sym);
        if (ticker) {
          this._feeds.get(name).set(sym, ticker);
          snapshot[sym][name] = ticker;
        }
      }
    }

    this.emit("snapshot", snapshot);
    await this._persistSnapshot(snapshot);
  }

  // ── Queries ───────────────────────────────────────────────────────────────────

  /** Get all current tickers for a symbol, keyed by exchange. */
  getTickersForSymbol(symbol) {
    const sym     = symbol.toUpperCase();
    const tickers = {};
    for (const [exchange, feedMap] of this._feeds) {
      const ticker = feedMap.get(sym);
      if (ticker && Date.now() - ticker.ts < FEED_TTL_MS) {
        tickers[exchange] = ticker;
      }
    }
    return tickers;
  }

  /** Get all tracked symbols. */
  getSymbols() {
    const internal = this._feeds.get(INTERNAL_EXCHANGE);
    return internal ? [...internal.keys()] : [];
  }

  /** Get the full current snapshot (all exchanges × all symbols). */
  getSnapshot() {
    const out = {};
    for (const [exchange, feedMap] of this._feeds) {
      for (const [sym, ticker] of feedMap) {
        if (Date.now() - ticker.ts < FEED_TTL_MS) {
          if (!out[sym]) out[sym] = {};
          out[sym][exchange] = ticker;
        }
      }
    }
    return out;
  }

  getExchanges() {
    return [INTERNAL_EXCHANGE, ...this._adapters.keys()];
  }

  // ── Redis persistence ─────────────────────────────────────────────────────────

  async _persistSnapshot(snapshot) {
    const redis = redisClients.cache;
    if (!redis) return;
    try {
      const pipeline = redis.pipeline();
      for (const [sym, exchanges] of Object.entries(snapshot)) {
        pipeline.hset(`${SNAPSHOT_KEY}:${sym}`, "data", JSON.stringify(exchanges));
        pipeline.expire(`${SNAPSHOT_KEY}:${sym}`, 30);
      }
      await pipeline.exec();
    } catch (err) {
      logger.warn({ err: err.message }, "[MFA] Redis snapshot persist failed.");
    }
  }

  async loadSnapshotFromRedis(symbol) {
    const redis = redisClients.cache;
    if (!redis) return null;
    try {
      const raw = await redis.hget(`${SNAPSHOT_KEY}:${symbol.toUpperCase()}`, "data");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}

export const marketFeedAggregator = new MarketFeedAggregator();
