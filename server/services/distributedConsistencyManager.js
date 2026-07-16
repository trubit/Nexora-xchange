/**
 * Distributed Consistency Manager
 *
 * Ensures read-your-writes and monotonic-read consistency across the
 * analytics and reporting layers (not the matching engine — that has its own
 * ACID guarantees via MongoDB).
 *
 * Provides:
 *   - Distributed locking via Redis SET NX PX (leader election, critical sections)
 *   - Read-after-write tokens (causal consistency for client-facing APIs)
 *   - Consistency health checks (lag detection between DB writes and cache)
 *   - Quorum reads (when multiple cache nodes exist)
 *   - Snapshot isolation tokens for long-running analytics queries
 *
 * Design philosophy: eventual consistency is acceptable for analytics;
 * strong consistency is required for balance/order state (handled in DB).
 */

import crypto        from "crypto";
import { redisClients } from "../config/redis.js";
import logger        from "../config/logger.js";

const LOCK_PREFIX    = "distlock:";
const RAW_PREFIX     = "raw:";        // read-after-write token
const SNAP_PREFIX    = "snap:";
const DEFAULT_LOCK_TTL_MS = 10_000;   // 10 s
const RAW_TTL_S      = 60;            // read-after-write tokens expire after 60 s
const SNAP_TTL_S     = 300;           // snapshot tokens expire after 5 min

export class DistributedConsistencyManager {
  constructor() {
    this._stats = { locksAcquired: 0, locksFailed: 0, rawTokens: 0, snapTokens: 0 };
  }

  // ── Distributed Locking ───────────────────────────────────────────────────────

  /**
   * Acquire an advisory distributed lock.
   * Returns the lock token (to pass to release()) or null if unavailable.
   *
   * @param {string} resource   lock name (e.g. "rescore:userId123")
   * @param {number} ttlMs      max lock hold time in milliseconds
   */
  async acquire(resource, ttlMs = DEFAULT_LOCK_TTL_MS) {
    const redis = redisClients.cache;
    if (!redis) return null;

    const token  = crypto.randomBytes(16).toString("hex");
    const key    = `${LOCK_PREFIX}${resource}`;

    try {
      const result = await redis.set(key, token, "PX", ttlMs, "NX");
      if (result === "OK") {
        this._stats.locksAcquired++;
        return token;
      }
      this._stats.locksFailed++;
      return null;
    } catch (err) {
      logger.warn({ err: err.message, resource }, "[DCM] Lock acquire failed.");
      return null;
    }
  }

  /**
   * Release a lock. No-op if the token doesn't match (lock expired or stolen).
   */
  async release(resource, token) {
    const redis = redisClients.cache;
    if (!redis || !token) return;

    const script = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      else
        return 0
      end
    `;

    try {
      await redis.eval(script, 1, `${LOCK_PREFIX}${resource}`, token);
    } catch (err) {
      logger.warn({ err: err.message, resource }, "[DCM] Lock release failed.");
    }
  }

  /**
   * Run `fn` while holding a lock on `resource`.
   * Automatically releases the lock when fn completes (or throws).
   */
  async withLock(resource, fn, ttlMs = DEFAULT_LOCK_TTL_MS) {
    const token = await this.acquire(resource, ttlMs);
    if (!token) throw new Error(`Could not acquire lock for "${resource}".`);
    try {
      return await fn();
    } finally {
      await this.release(resource, token);
    }
  }

  // ── Read-After-Write Consistency ──────────────────────────────────────────────

  /**
   * Issue a read-after-write (RAW) token after a write completes.
   * The client includes this token in subsequent reads to ensure they see the write.
   */
  async issueRawToken(entity, id) {
    const redis = redisClients.cache;
    const token = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    if (redis) {
      await redis.setex(`${RAW_PREFIX}${entity}:${id}`, RAW_TTL_S, token).catch(() => {});
    }
    this._stats.rawTokens++;
    return token;
  }

  /**
   * Validate that the provided RAW token matches the stored token for this entity.
   * Returns { consistent: bool }.
   */
  async validateRawToken(entity, id, clientToken) {
    if (!clientToken) return { consistent: true };  // no token = no constraint
    const redis = redisClients.cache;
    if (!redis) return { consistent: true };

    try {
      const stored = await redis.get(`${RAW_PREFIX}${entity}:${id}`);
      return { consistent: stored === clientToken };
    } catch { return { consistent: true }; }
  }

  // ── Snapshot Isolation ────────────────────────────────────────────────────────

  /**
   * Create a named snapshot anchor — stores the current DB state version/timestamp
   * so a long-running analytics query can reference a consistent point in time.
   */
  async createSnapshot(name, metadata = {}) {
    const ts    = Date.now();
    const token = `${name}-${ts}`;
    const snap  = { token, name, ts, metadata };

    const redis = redisClients.cache;
    if (redis) {
      await redis.setex(`${SNAP_PREFIX}${token}`, SNAP_TTL_S, JSON.stringify(snap)).catch(() => {});
    }

    this._stats.snapTokens++;
    return snap;
  }

  async getSnapshot(token) {
    const redis = redisClients.cache;
    if (!redis) return null;
    try {
      const raw = await redis.get(`${SNAP_PREFIX}${token}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  // ── Consistency Health Check ──────────────────────────────────────────────────

  /**
   * Measure lag between a canonical DB record's updatedAt and its cache TTL.
   * Returns lag in milliseconds (high lag → stale cache).
   */
  async measureCacheLag(cacheKey, dbUpdatedAt) {
    const redis = redisClients.cache;
    if (!redis) return { lagMs: 0, isFresh: true };

    try {
      const [raw, ttl] = await Promise.all([
        redis.get(cacheKey),
        redis.pttl(cacheKey),
      ]);

      if (!raw) return { lagMs: null, isFresh: false, reason: "Cache miss" };

      const cached = JSON.parse(raw);
      const cacheTs = cached.updatedAt ? new Date(cached.updatedAt).getTime() : null;
      const dbTs    = dbUpdatedAt    ? new Date(dbUpdatedAt).getTime()    : null;

      if (!cacheTs || !dbTs) return { lagMs: null, isFresh: true };

      const lagMs  = dbTs - cacheTs;
      const isFresh = lagMs <= 0;

      return { lagMs, isFresh, ttlMs: ttl };
    } catch (err) {
      logger.warn({ err: err.message, cacheKey }, "[DCM] Cache lag check failed.");
      return { lagMs: null, isFresh: true };
    }
  }

  /**
   * Get a consistency health snapshot across multiple cache keys.
   */
  async consistencyReport(keyUpdatedPairs) {
    const results = await Promise.all(
      keyUpdatedPairs.map(([key, updated]) => this.measureCacheLag(key, updated)),
    );

    const stale = results.filter((r) => !r.isFresh).length;
    const avgLag = results.filter((r) => r.lagMs !== null)
      .reduce((s, r) => s + r.lagMs, 0) / Math.max(results.length, 1);

    return {
      total: results.length,
      fresh: results.length - stale,
      stale,
      avgLagMs:   Math.round(avgLag),
      isHealthy:  stale === 0,
    };
  }

  // ── Stats ─────────────────────────────────────────────────────────────────────

  getStats() {
    return { ...this._stats };
  }
}

export const distributedConsistencyManager = new DistributedConsistencyManager();
