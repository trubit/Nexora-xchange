/**
 * Global Scaling Infrastructure — main entry point
 *
 * Import this ONE file in server/index.js to bootstrap all infra.
 * Every module here runs inside the existing Express server process.
 *
 * No Kubernetes, no nginx, no Docker required — all logic lives in Node.js.
 *
 * Usage:
 *   import { infraMiddlewares, startInfra, stopInfra } from "./infra/index.js";
 *
 *   // Middlewares — add to Express BEFORE routes
 *   app.use(infraMiddlewares.geoRoute());
 *   app.use(infraMiddlewares.geoProxy());   // omit in single-node dev mode
 *   app.use(infraMiddlewares.latencyProbe());
 *
 *   // Startup — call inside startServer()
 *   await startInfra();
 *
 *   // Shutdown — call inside graceful shutdown
 *   await stopInfra();
 */

export { geoRouteMiddleware }    from "../middleware/geoRoute.js";
export { geoProxyMiddleware }    from "./geoProxy.js";
export { latencyProbeMiddleware, probeAllRegions } from "./latencyOptimizer.js";
export { eventBus,
         publishTradeExecuted,
         publishOrderPlaced,
         publishOrderCancelled,
         publishPriceUpdate,
         publishUserBalance,
         publishRegionHeartbeat } from "./eventBus.js";
export { marketRegionLock }      from "./marketRegionLock.js";
export { regionRouter }          from "./regionRouter.js";
export { apiGateway }            from "./apiGateway.js";
export { latencySampler, cachedFetch, invalidateCache } from "./latencyOptimizer.js";
export { REGIONS, MARKET_REGION_MAP, DEFAULT_REGION,
         getRegion, listRegions }  from "./regionRegistry.js";

import { geoRouteMiddleware }    from "../middleware/geoRoute.js";
import { geoProxyMiddleware }    from "./geoProxy.js";
import { latencyProbeMiddleware, probeAllRegions } from "./latencyOptimizer.js";
import { eventBus, publishRegionHeartbeat } from "./eventBus.js";
import { marketRegionLock }      from "./marketRegionLock.js";
import logger                    from "../config/logger.js";
import { DEFAULT_REGION }        from "./regionRegistry.js";

const LOCAL_REGION    = process.env.REGION_ID ?? DEFAULT_REGION;
const MULTI_REGION    = (process.env.MULTI_REGION ?? "false").toLowerCase() === "true";
const HEARTBEAT_MS    = 30_000;

let _heartbeatTimer = null;

/** Express middleware bundle — call app.use(...) for each */
export const infraMiddlewares = {
  geoRoute:     () => geoRouteMiddleware(),
  geoProxy:     () => geoProxyMiddleware({ enabled: MULTI_REGION }),
  latencyProbe: () => latencyProbeMiddleware(),
};

/** Boot all infra services. Call once inside startServer(). */
export async function startInfra() {
  logger.info({ region: LOCAL_REGION, multiRegion: MULTI_REGION }, "[Infra] Starting global infrastructure.");

  await eventBus.init();
  await marketRegionLock.init();

  if (MULTI_REGION) {
    // Probe peer regions in background — don't block server start
    probeAllRegions().catch(() => {});

    // Heartbeat: announce this region is alive every 30 s
    _heartbeatTimer = setInterval(() => {
      publishRegionHeartbeat().catch(() => {});
    }, HEARTBEAT_MS);
    _heartbeatTimer.unref?.();
  }

  logger.info("[Infra] Global infrastructure ready.");
}

/** Graceful teardown. Call inside shutdown handler. */
export async function stopInfra() {
  if (_heartbeatTimer) clearInterval(_heartbeatTimer);
  await Promise.allSettled([
    marketRegionLock.release(),
    eventBus.close(),
  ]);
  logger.info("[Infra] Global infrastructure stopped.");
}
