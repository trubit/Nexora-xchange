/**
 * Built-in Geo-Routing Reverse Proxy
 *
 * Replaces the nginx geo-routing layer entirely.
 * Runs inside the Express server — no separate nginx or load balancer needed.
 *
 * How it works:
 *   1. Every request hits the local server first.
 *   2. geoRoute middleware already sets req._region (the client's nearest region).
 *   3. If req._region.id !== LOCAL_REGION AND the request is proxiable,
 *      this proxy forwards it to the correct regional node and streams
 *      the response back — transparent to the client.
 *   4. If the remote node is unavailable (circuit open / timeout),
 *      the local node handles it as a fallback.
 *
 * Skipped for: health, metrics, infra routes, WebSocket upgrades, static files.
 */

import { DEFAULT_REGION } from "./regionRegistry.js";
import { apiGateway }     from "./apiGateway.js";
import logger             from "../config/logger.js";

const LOCAL_REGION = process.env.REGION_ID ?? DEFAULT_REGION;

// Routes that must always be handled locally
const LOCAL_ONLY_PREFIXES = [
  "/health",
  "/metrics",
  "/uploads",
  "/api/v1/infra",
  "/api/engine",      // matching engine is region-local by design
];

const isLocalOnly = (path) =>
  LOCAL_ONLY_PREFIXES.some((p) => path.startsWith(p));

/**
 * Express middleware factory.
 * Place this AFTER geoRouteMiddleware() so req._region is already set.
 *
 * @param {object} opts
 * @param {boolean} opts.enabled   Set false to disable proxying (single-node dev mode)
 */
export function geoProxyMiddleware({ enabled = true } = {}) {
  return async (req, res, next) => {
    // Single-node / dev mode — skip all proxying
    if (!enabled) return next();

    // Don't proxy local-only routes
    if (isLocalOnly(req.path)) return next();

    // Don't proxy if client is already in our region
    const clientRegion = req._region;
    if (!clientRegion || clientRegion.id === LOCAL_REGION) return next();

    // Don't proxy internal gateway calls (prevent loops)
    if (req.headers["x-internal"] === "1") return next();

    // Don't proxy WebSocket upgrade requests (handled by socket.io directly)
    if (req.headers.upgrade?.toLowerCase() === "websocket") return next();

    logger.debug(
      { from: LOCAL_REGION, to: clientRegion.id, path: req.path },
      "[GeoProxy] Forwarding to regional node."
    );

    const result = await apiGateway.proxy(req, res, clientRegion.id);

    // If proxy failed (circuit open, timeout, etc.) — handle locally as fallback
    if (!result) {
      logger.warn(
        { region: clientRegion.id, path: req.path },
        "[GeoProxy] Remote unavailable — handling locally."
      );
      return next();
    }

    // Response already sent by apiGateway.proxy()
  };
}
