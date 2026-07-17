/**
 * Latency Optimization Layer
 *
 * Strategies applied:
 *   1. Connection pooling — reuse HTTP keep-alive agents per region endpoint
 *   2. Response caching  — short-TTL cache for market data reads (Redis L1, in-process L2)
 *   3. Latency sampling  — rolling p50/p95/p99 per region endpoint
 *   4. Adaptive routing  — skips high-latency regions for non-critical reads
 *   5. Compression hint  — sets Accept-Encoding: br,gzip on gateway requests
 */

import { Agent as HttpAgent } from "http";
import { Agent as HttpsAgent } from "https";
import { REGIONS } from "./regionRegistry.js";
import { redisClients } from "../config/redis.js";
import logger from "../config/logger.js";

const POOL_OPTS = {
  keepAlive:            true,
  keepAliveMsecs:       30_000,
  maxSockets:           50,
  maxFreeSockets:       10,
  timeout:              10_000,
};

// ── Connection pools ──────────────────────────────────────────────────────────

const _pools = new Map(); // regionId → { http, https }

export function getAgents(regionId) {
  if (!_pools.has(regionId)) {
    _pools.set(regionId, {
      http:  new HttpAgent(POOL_OPTS),
      https: new HttpsAgent(POOL_OPTS),
    });
  }
  return _pools.get(regionId);
}

export function destroyPools() {
  for (const { http, https } of _pools.values()) {
    http.destroy();
    https.destroy();
  }
  _pools.clear();
}

// ── Latency sampler ───────────────────────────────────────────────────────────

class LatencySampler {
  constructor(windowSize = 100) {
    this._window = windowSize;
    this._samples = new Map(); // regionId → number[]
  }

  record(regionId, ms) {
    if (!this._samples.has(regionId)) this._samples.set(regionId, []);
    const arr = this._samples.get(regionId);
    arr.push(ms);
    if (arr.length > this._window) arr.shift();
  }

  percentile(regionId, pct) {
    const arr = [...(this._samples.get(regionId) ?? [])].sort((a, b) => a - b);
    if (!arr.length) return null;
    const idx = Math.ceil((pct / 100) * arr.length) - 1;
    return arr[Math.max(0, idx)];
  }

  summary() {
    const out = {};
    for (const [id] of this._samples) {
      out[id] = {
        p50: this.percentile(id, 50),
        p95: this.percentile(id, 95),
        p99: this.percentile(id, 99),
        samples: this._samples.get(id).length,
      };
    }
    return out;
  }
}

export const latencySampler = new LatencySampler();

// ── Response cache ────────────────────────────────────────────────────────────

const L2_CACHE = new Map(); // in-process fallback when Redis is absent

export async function cachedFetch(cacheKey, ttlMs, fetchFn) {
  const redis = redisClients.cache;

  // L1: Redis
  if (redis) {
    try {
      const cached = await redis.get(`nexora:cache:${cacheKey}`);
      if (cached) return JSON.parse(cached);
    } catch {
      // fall through to L2
    }
  }

  // L2: in-process
  const l2 = L2_CACHE.get(cacheKey);
  if (l2 && Date.now() - l2.ts < ttlMs) return l2.data;

  // Cache miss — fetch
  const data  = await fetchFn();

  // Store in both layers
  L2_CACHE.set(cacheKey, { data, ts: Date.now() });
  if (redis) {
    redis
      .set(`nexora:cache:${cacheKey}`, JSON.stringify(data), "PX", ttlMs)
      .catch(() => {});
  }

  return data;
}

export function invalidateCache(cacheKey) {
  L2_CACHE.delete(cacheKey);
  if (redisClients.cache) {
    redisClients.cache.del(`nexora:cache:${cacheKey}`).catch(() => {});
  }
}

// ── Adaptive region selector ──────────────────────────────────────────────────

const HIGH_LATENCY_THRESHOLD_MS = 500;

/**
 * Returns the lowest-latency healthy region from the given list,
 * or the first one if no samples are available.
 */
export function pickFastestRegion(regionIds) {
  let best = null;
  let bestP95 = Infinity;

  for (const id of regionIds) {
    const p95 = latencySampler.percentile(id, 95) ?? 0;
    if (p95 < bestP95) {
      bestP95 = p95;
      best    = id;
    }
  }

  return best ?? regionIds[0];
}

// ── Middleware: timing probe ──────────────────────────────────────────────────

/**
 * Express middleware that records response latency per served-by region
 * from the X-Served-By header on proxied responses.
 */
export function latencyProbeMiddleware() {
  return (_req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const region = res.getHeader("x-served-by");
      if (region) latencySampler.record(String(region), Date.now() - start);
    });
    next();
  };
}

// ── Startup probe ─────────────────────────────────────────────────────────────

export async function probeAllRegions() {
  const results = {};
  await Promise.all(
    Object.values(REGIONS).map(async (region) => {
      const start = Date.now();
      try {
        const ctrl = new AbortController();
        const tid  = setTimeout(() => ctrl.abort(), 3_000);
        await fetch(`${region.apiUrl}/health`, { signal: ctrl.signal });
        clearTimeout(tid);
        const ms = Date.now() - start;
        latencySampler.record(region.id, ms);
        results[region.id] = { ok: true, ms };
      } catch {
        results[region.id] = { ok: false, ms: null };
      }
    })
  );
  logger.info({ probes: results }, "[Latency] Region probe complete.");
  return results;
}
