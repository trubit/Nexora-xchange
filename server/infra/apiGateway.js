/**
 * Regional API Gateway
 *
 * Proxies requests to the correct regional cluster when the local node
 * is not the designated handler for a given market or user region.
 *
 * Features:
 *   - Transparent HTTP proxy with request ID propagation
 *   - Circuit breaker per region (open after 5 consecutive failures)
 *   - Automatic retry on 502/503 with exponential back-off (max 2 retries)
 *   - Latency tracking via X-Gateway-Latency response header
 *   - Falls back to local handler when all remotes are unavailable
 */

import { randomUUID } from "node:crypto";
import { REGIONS, getRegion, DEFAULT_REGION } from "./regionRegistry.js";
import logger from "../config/logger.js";

const CIRCUIT_OPEN_MS   = 30_000; // 30 s cool-down
const FAILURE_THRESHOLD = 5;
const MAX_RETRIES       = 2;

class CircuitBreaker {
  constructor() {
    this._state    = new Map(); // regionId → { failures, openSince }
  }

  isOpen(regionId) {
    const s = this._state.get(regionId);
    if (!s || s.failures < FAILURE_THRESHOLD) return false;
    if (Date.now() - s.openSince > CIRCUIT_OPEN_MS) {
      // half-open: allow one probe
      this._state.set(regionId, { failures: 0, openSince: null });
      return false;
    }
    return true;
  }

  recordSuccess(regionId) {
    this._state.delete(regionId);
  }

  recordFailure(regionId) {
    const s = this._state.get(regionId) ?? { failures: 0, openSince: null };
    s.failures++;
    if (s.failures >= FAILURE_THRESHOLD && !s.openSince) {
      s.openSince = Date.now();
      logger.warn({ regionId }, "[Gateway] Circuit opened for region.");
    }
    this._state.set(regionId, s);
  }

  status() {
    const out = {};
    for (const [id, s] of this._state) {
      out[id] = { failures: s.failures, open: this.isOpen(id) };
    }
    return out;
  }
}

export class ApiGateway {
  constructor() {
    this._breaker = new CircuitBreaker();
  }

  /**
   * Proxy an Express request to a specific region's API cluster.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {string} targetRegionId
   */
  async proxy(req, res, targetRegionId) {
    const region = getRegion(targetRegionId);
    const start  = Date.now();

    if (this._breaker.isOpen(region.id)) {
      logger.warn({ region: region.id }, "[Gateway] Circuit open — using local fallback.");
      return null; // caller handles local fallback
    }

    const targetUrl = `${region.apiUrl}${req.originalUrl}`;
    const headers   = this._forwardHeaders(req);

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 10_000);

        const upstreamRes = await fetch(targetUrl, {
          method:  req.method,
          headers,
          body:    ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body),
          signal:  controller.signal,
        });
        clearTimeout(tid);

        if (upstreamRes.status >= 502 && attempt < MAX_RETRIES) {
          await this._backoff(attempt);
          continue;
        }

        const latency = Date.now() - start;
        this._breaker.recordSuccess(region.id);

        // Stream response back
        const body = await upstreamRes.text();
        res
          .status(upstreamRes.status)
          .set("X-Served-By",       region.id)
          .set("X-Gateway-Latency", `${latency}ms`);

        // Forward relevant upstream headers
        for (const [k, v] of upstreamRes.headers) {
          if (/^(content-type|x-request-id|x-ratelimit)/.test(k)) res.set(k, v);
        }

        res.send(body);
        return { ok: true, region: region.id, latency };

      } catch (err) {
        if (attempt === MAX_RETRIES) {
          this._breaker.recordFailure(region.id);
          logger.error({ region: region.id, err: err.message }, "[Gateway] Proxy failed.");
          return null;
        }
        await this._backoff(attempt);
      }
    }

    return null;
  }

  /**
   * Build a middleware that proxies to the owning region if local is not owner.
   * Usage: router.use('/api/v1/orders', gateway.marketOwnerMiddleware());
   */
  marketOwnerMiddleware() {
    return async (req, res, next) => {
      const symbol = req.body?.symbol ?? req.query?.symbol;
      if (!symbol) return next();

      const { regionRouter } = await import("./regionRouter.js");
      if (regionRouter.isLocalOwner(symbol)) return next();

      const ownerRegion = regionRouter.ownerForMarket(symbol);
      logger.info({ symbol, owner: ownerRegion.id }, "[Gateway] Forwarding to market owner.");

      const result = await this.proxy(req, res, ownerRegion.id);
      if (!result) next(); // fallback: handle locally
    };
  }

  circuitStatus() {
    return this._breaker.status();
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  _forwardHeaders(req) {
    const localRegion = process.env.REGION_ID ?? DEFAULT_REGION;
    return {
      "content-type":    "application/json",
      "authorization":   req.headers["authorization"] ?? "",
      "x-forwarded-for": req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "",
      "x-request-id":    req.headers["x-request-id"] ?? randomUUID(),
      "x-origin-region": localRegion,
      "x-internal":      "1", // marks request as gateway-forwarded
    };
  }

  _backoff(attempt) {
    return new Promise((r) => setTimeout(r, 200 * Math.pow(2, attempt)));
  }
}

export const apiGateway = new ApiGateway();
