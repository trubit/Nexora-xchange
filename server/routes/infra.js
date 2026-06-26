/**
 * Infrastructure / ops routes
 * Mounted at /api/v1/infra  (internal + admin only)
 */

import { Router } from "express";
import { regionRouter } from "../infra/regionRouter.js";
import { apiGateway }   from "../infra/apiGateway.js";
import { eventBus }     from "../infra/eventBus.js";
import { marketRegionLock } from "../infra/marketRegionLock.js";
import { latencySampler, probeAllRegions } from "../infra/latencyOptimizer.js";
import { listRegions, DEFAULT_REGION } from "../infra/regionRegistry.js";

const router = Router();

// GET /api/v1/infra/regions  — list all regions + health
router.get("/regions", async (_req, res) => {
  const regions = listRegions();
  const healthy = await regionRouter.getHealthyRegions();
  const healthSet = new Set(healthy.map((r) => r.id));
  res.json({
    localRegion: process.env.REGION_ID ?? DEFAULT_REGION,
    regions: regions.map((r) => ({
      ...r,
      healthy: healthSet.has(r.id),
    })),
  });
});

// GET /api/v1/infra/circuit  — circuit breaker state per region
router.get("/circuit", (_req, res) => {
  res.json(apiGateway.circuitStatus());
});

// GET /api/v1/infra/latency  — p50/p95/p99 per region
router.get("/latency", (_req, res) => {
  res.json(latencySampler.summary());
});

// POST /api/v1/infra/probe   — trigger a fresh latency probe to all regions
router.post("/probe", async (_req, res) => {
  const results = await probeAllRegions();
  res.json(results);
});

// GET /api/v1/infra/market-locks  — which region owns each market
router.get("/market-locks", async (_req, res) => {
  const { MARKET_REGION_MAP } = await import("../infra/regionRegistry.js");
  const resolved = {};
  for (const symbol of Object.keys(MARKET_REGION_MAP)) {
    resolved[symbol] = await marketRegionLock.getOwner(symbol);
  }
  res.json({ locks: resolved });
});

// GET /api/v1/infra/event-bus  — event bus stats
router.get("/event-bus", (_req, res) => {
  res.json(eventBus.stats());
});

export default router;
