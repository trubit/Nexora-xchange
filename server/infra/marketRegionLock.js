/**
 * Market-Region Consistency Lock
 *
 * Enforces the rule: each trading pair's matching engine lives in exactly
 * one region. Requests to process an order for a symbol must be
 * validated against this lock before the matching engine touches it.
 *
 * The lock state is stored in Redis (shared across all nodes in a region)
 * with TTL-based renewal so dead nodes release their locks automatically.
 *
 * Lock key:  nexora:market-lock:<SYMBOL>
 * Lock value: <regionId>
 * TTL:         60 s (renewed by heartbeat every 30 s)
 */

import { redisClients } from "../config/redis.js";
import { MARKET_REGION_MAP, DEFAULT_REGION } from "./regionRegistry.js";
import logger from "../config/logger.js";

const LOCAL_REGION  = process.env.REGION_ID ?? DEFAULT_REGION;
const LOCK_PREFIX   = "nexora:market-lock:";
const LOCK_TTL_MS   = 60_000;
const RENEW_INTERVAL_MS = 30_000;

export class MarketRegionLock {
  constructor() {
    this._cache    = new Map(); // symbol → ownerRegionId (in-process fallback)
    this._renewals = new Map(); // symbol → intervalId
  }

  async init() {
    // Pre-populate from static registry; Redis overrides on conflict
    for (const [symbol, regionId] of Object.entries(MARKET_REGION_MAP)) {
      this._cache.set(symbol, regionId);
    }

    if (!redisClients.cache) {
      logger.warn("[MarketLock] Redis unavailable — using static registry only.");
      return;
    }

    // Claim locks for locally-owned markets
    await Promise.all(
      Object.entries(MARKET_REGION_MAP)
        .filter(([, r]) => r === LOCAL_REGION)
        .map(([symbol]) => this._claimLock(symbol))
    );

    logger.info({ region: LOCAL_REGION }, "[MarketLock] Market locks claimed.");
  }

  /**
   * Returns the region that owns the matching engine for this symbol.
   * Checks Redis first; falls back to static registry.
   */
  async getOwner(symbol) {
    const key = LOCK_PREFIX + symbol.toUpperCase();

    if (redisClients.cache) {
      try {
        const val = await redisClients.cache.get(key);
        if (val) {
          this._cache.set(symbol, val);
          return val;
        }
      } catch {
        // Redis unavailable — use cache
      }
    }

    return this._cache.get(symbol) ?? DEFAULT_REGION;
  }

  /** True if this process's region owns the matching engine for the symbol. */
  async isOwner(symbol) {
    const owner = await this.getOwner(symbol);
    return owner === LOCAL_REGION;
  }

  /**
   * Middleware factory: blocks order processing if this region is not the owner.
   * Returns the order for local processing, or a redirect instruction.
   */
  async enforceOwnership(symbol) {
    const owner = await this.getOwner(symbol);
    return {
      isLocal:     owner === LOCAL_REGION,
      ownerRegion: owner,
    };
  }

  /** Release all locks (called on graceful shutdown). */
  async release() {
    for (const [symbol, intervalId] of this._renewals) {
      clearInterval(intervalId);
      if (redisClients.cache) {
        const key = LOCK_PREFIX + symbol;
        try {
          const val = await redisClients.cache.get(key);
          if (val === LOCAL_REGION) await redisClients.cache.del(key);
        } catch {
          // best effort
        }
      }
    }
    this._renewals.clear();
    logger.info({ region: LOCAL_REGION }, "[MarketLock] All locks released.");
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  async _claimLock(symbol) {
    const key = LOCK_PREFIX + symbol.toUpperCase();
    try {
      // SET NX EX: only set if not already claimed
      await redisClients.cache.set(key, LOCAL_REGION, "PX", LOCK_TTL_MS, "NX");
      this._cache.set(symbol, LOCAL_REGION);

      // Heartbeat renewal
      const tid = setInterval(async () => {
        try {
          const current = await redisClients.cache.get(key);
          if (current === LOCAL_REGION) {
            await redisClients.cache.pexpire(key, LOCK_TTL_MS);
          } else {
            clearInterval(tid);
            this._renewals.delete(symbol);
            logger.warn({ symbol, current }, "[MarketLock] Lock stolen by another region.");
          }
        } catch {
          // Redis hiccup — keep trying
        }
      }, RENEW_INTERVAL_MS);

      tid.unref?.(); // don't prevent process exit
      this._renewals.set(symbol, tid);
    } catch (err) {
      logger.error({ symbol, err: err.message }, "[MarketLock] Failed to claim lock.");
    }
  }
}

export const marketRegionLock = new MarketRegionLock();
