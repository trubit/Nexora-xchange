/**
 * Geo-Route Middleware
 *
 * Attaches region context to every incoming request.
 * Adds response headers so clients know which region served them.
 *
 * req._region     → full region config object
 * req._routingInfo → { region, isLocal, resolvedBy }
 */

import { regionRouter } from "../infra/regionRouter.js";
import { DEFAULT_REGION } from "../infra/regionRegistry.js";

const LOCAL_REGION = process.env.REGION_ID ?? DEFAULT_REGION;

export function geoRouteMiddleware() {
  return (req, res, next) => {
    const region      = regionRouter.resolveRegion(req);
    const isLocal     = region.id === LOCAL_REGION;
    const resolvedBy  = req.headers["x-region"] ? "header" : "geoip";

    req._region      = region;
    req._routingInfo = { region, isLocal, resolvedBy };

    // Inform the client which region handled their request
    res.set("X-Served-By",       LOCAL_REGION);
    res.set("X-Client-Region",   region.id);
    res.set("X-Nearest-Ws",      region.wsUrl);

    next();
  };
}

/**
 * Returns an Express middleware that gates a route to requests
 * whose resolved region matches the local region.
 * Non-matching requests receive a redirect hint (not an error) —
 * the gateway layer handles actual forwarding.
 */
export function requireLocalRegion() {
  return (req, res, next) => {
    if (req._routingInfo?.isLocal !== false) return next();
    const target = req._region?.apiUrl;
    res.status(307).json({
      error:    "wrong_region",
      message:  "This request should be handled by a different regional cluster.",
      redirect: target ? `${target}${req.originalUrl}` : undefined,
      region:   req._region?.id,
    });
  };
}
