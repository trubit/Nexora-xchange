/**
 * LiquidityAggregatorService — external liquidity provider integration.
 *
 * Responsibilities:
 *   - Maintains a registry of active liquidity providers
 *   - Polls each provider for order book data (simulated in non-live mode)
 *   - Merges and normalises raw feeds into a canonical format
 *   - Exposes per-provider and aggregate book state
 *
 * Rule: slippage reduction is the primary optimisation goal.
 */

import { EventEmitter }   from "events";
import LiquidityProvider  from "../models/LiquidityProvider.js";
import logger             from "../config/logger.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const POLL_MS       = parseInt(process.env.LIQUIDITY_POLL_MS      ?? "5000",  10);
const HEALTH_TTL_MS = parseInt(process.env.LIQUIDITY_HEALTH_TTL_MS ?? "30000", 10);
const MAX_FAILS     = parseInt(process.env.LIQUIDITY_MAX_FAILS     ?? "3",     10);

// ── Main service ──────────────────────────────────────────────────────────────

export class LiquidityAggregatorService extends EventEmitter {
  constructor() {
    super();
    this._started    = false;
    this._pollTimer  = null;
    this._providers  = new Map();   // providerId → { config, book }
    this._books      = new Map();   // pair → [{ providerId, bids, asks, updatedAt }]
    this._stats = { polls: 0, failures: 0, providers: 0 };
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async start() {
    if (this._started) return;
    this._started = true;
    await this._loadProviders();
    this._pollTimer = setInterval(() => this._pollAll().catch((e) =>
      logger.error({ err: e.message }, "[LAggr] Poll error.")
    ), POLL_MS);
    logger.info({ providers: this._providers.size }, "[LAggr] Liquidity aggregator started.");
  }

  stop() {
    if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
    this._started = false;
    logger.info("[LAggr] Liquidity aggregator stopped.");
  }

  // ── Provider management ────────────────────────────────────────────────────

  async _loadProviders() {
    const list = await LiquidityProvider.find({ enabled: true }).lean();
    for (const p of list) {
      this._providers.set(String(p._id), { config: p, book: null, failCount: 0 });
    }
    this._stats.providers = this._providers.size;
    logger.info({ count: this._providers.size }, "[LAggr] Providers loaded.");
  }

  /** Register a new provider at runtime. */
  async registerProvider(payload) {
    const doc = await LiquidityProvider.create(payload);
    this._providers.set(String(doc._id), { config: doc.toObject(), book: null, failCount: 0 });
    this._stats.providers = this._providers.size;
    return doc.toObject();
  }

  /** Disable a provider and remove it from polling. */
  async disableProvider(providerId) {
    await LiquidityProvider.findByIdAndUpdate(providerId, { enabled: false, healthy: false });
    this._providers.delete(String(providerId));
    this._stats.providers = this._providers.size;
  }

  /** Get all provider metadata (excluding apiKey). */
  getProviders() {
    return Array.from(this._providers.values()).map((p) => ({
      id:       p.config._id,
      name:     p.config.name,
      type:     p.config.type,
      pairs:    p.config.pairs,
      healthy:  p.config.healthy,
      priority: p.config.priority,
      failCount:p.failCount,
    }));
  }

  // ── Book access ────────────────────────────────────────────────────────────

  /** Get raw book from a single provider for a pair. */
  getProviderBook(providerId, pair) {
    const state = this._providers.get(String(providerId));
    if (!state?.book) return null;
    return state.book[pair] ?? null;
  }

  /** Get all raw provider books for a pair. */
  getAllProviderBooks(pair) {
    const out = [];
    for (const [id, state] of this._providers) {
      const book = state.book?.[pair];
      if (book) out.push({ providerId: id, ...book });
    }
    return out;
  }

  getStats() {
    return { ...this._stats, running: this._started };
  }

  // ── Internal polling ───────────────────────────────────────────────────────

  async _pollAll() {
    this._stats.polls++;
    const promises = [];
    for (const [id, state] of this._providers) {
      promises.push(this._pollProvider(id, state));
    }
    await Promise.allSettled(promises);
    this.emit("updated");
  }

  async _pollProvider(providerId, state) {
    try {
      // In non-live mode (no apiEndpoint), generate a synthetic feed
      const book = await this._fetchBook(state.config);
      if (!state.book) state.book = {};
      for (const pair of (state.config.pairs || [])) {
        state.book[pair] = book[pair] ?? null;
      }
      state.failCount = 0;
      if (!state.config.healthy) {
        state.config.healthy = true;
        await LiquidityProvider.findByIdAndUpdate(state.config._id, { healthy: true, failCount: 0 });
      }
    } catch (err) {
      state.failCount = (state.failCount ?? 0) + 1;
      this._stats.failures++;
      if (state.failCount >= MAX_FAILS) {
        state.config.healthy = false;
        await LiquidityProvider.findByIdAndUpdate(state.config._id, {
          healthy: false, failCount: state.failCount,
        }).catch(() => {});
        logger.warn({ provider: state.config.name, failCount: state.failCount }, "[LAggr] Provider unhealthy.");
      }
    }
  }

  async _fetchBook(providerCfg) {
    // Synthetic book generator — in production this would call providerCfg.apiEndpoint
    const out = {};
    const pairs = providerCfg.pairs || [];
    const feeTier = providerCfg.feeTierPct ?? 0.001;

    for (const pair of pairs) {
      const basePrice = _syntheticPrice(pair);
      const spread    = basePrice * feeTier * 2;
      const bids = [];
      const asks = [];
      for (let i = 0; i < 5; i++) {
        const offset = (i + 1) * spread;
        bids.push([+(basePrice - offset).toFixed(4), +(Math.random() * 5 + 0.1).toFixed(4)]);
        asks.push([+(basePrice + offset).toFixed(4), +(Math.random() * 5 + 0.1).toFixed(4)]);
      }
      out[pair] = { bids, asks, updatedAt: Date.now() };
    }
    return out;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _syntheticPrice(pair) {
  const MAP = {
    "BTC/USDT": 60000, "ETH/USDT": 3500, "BNB/USDT": 600,
    "SOL/USDT": 150, "MATIC/USDT": 1.2, "TSRX/USDT": 0.5,
  };
  return MAP[pair] ?? 100;
}

export const liquidityAggregatorService = new LiquidityAggregatorService();
