import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  flushBotOrders,
  getLiquidityStatus,
  isEngineRunning,
  setPairEnabled,
  startLiquidityEngine,
  stopLiquidityEngine,
  updatePairConfig,
} from "../services/liquidityService.js";
import { PAIRS } from "../config/supportedAssets.js";

const router = Router();

// All liquidity management endpoints require authentication.
// In production you would guard these with an admin-role check.
router.use(requireAuth);

// GET /api/liquidity/status
// Full engine status: running state, aggregate stats, per-pair snapshot.
router.get("/status", async (_req, res) => {
  try {
    const status = await getLiquidityStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/liquidity/start
// Start the liquidity engine (idempotent — safe to call if already running).
router.post("/start", async (_req, res) => {
  try {
    if (isEngineRunning()) return res.json({ message: "Liquidity engine is already running." });
    await startLiquidityEngine();
    res.json({ message: "Liquidity engine started." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/liquidity/stop
router.post("/stop", (_req, res) => {
  try {
    if (!isEngineRunning()) return res.json({ message: "Liquidity engine is not running." });
    stopLiquidityEngine();
    res.json({ message: "Liquidity engine stopped." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/liquidity/pairs
// List all pairs with their current config.
router.get("/pairs", (_req, res) => {
  const pairs = PAIRS.map((p) => ({
    symbol:    p.symbol,
    baseAsset: p.baseAsset,
    quoteAsset: p.quoteAsset,
    price:     p.price,
  }));
  res.json({ pairs });
});

// PATCH /api/liquidity/pairs/:symbol
// Update config for a specific pair.
// Body: { spread, levels, levelSpacing, minAmount, maxAmount, staleDistancePct, maxBotPerSide, enabled }
router.patch("/pairs/:symbol", (req, res) => {
  const symbol = String(req.params.symbol).toUpperCase();
  const exists = PAIRS.some((p) => p.symbol === symbol);
  if (!exists) return res.status(404).json({ message: `Unknown trading pair: ${symbol}` });

  const updated = updatePairConfig(symbol, req.body);
  res.json({ symbol, config: updated });
});

// POST /api/liquidity/pairs/:symbol/enable
router.post("/pairs/:symbol/enable", (req, res) => {
  const symbol = String(req.params.symbol).toUpperCase();
  const exists = PAIRS.some((p) => p.symbol === symbol);
  if (!exists) return res.status(404).json({ message: `Unknown trading pair: ${symbol}` });

  const cfg = setPairEnabled(symbol, true);
  res.json({ symbol, enabled: cfg.enabled });
});

// POST /api/liquidity/pairs/:symbol/disable
router.post("/pairs/:symbol/disable", (req, res) => {
  const symbol = String(req.params.symbol).toUpperCase();
  const exists = PAIRS.some((p) => p.symbol === symbol);
  if (!exists) return res.status(404).json({ message: `Unknown trading pair: ${symbol}` });

  const cfg = setPairEnabled(symbol, false);
  res.json({ symbol, enabled: cfg.enabled });
});

// DELETE /api/liquidity/flush
// Cancel ALL bot orders (all pairs).
router.delete("/flush", async (_req, res) => {
  try {
    const count = await flushBotOrders(null);
    res.json({ message: `Cancelled ${count} bot order(s) across all pairs.`, count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/liquidity/flush/:symbol
// Cancel bot orders for a specific pair only.
router.delete("/flush/:symbol", async (req, res) => {
  try {
    const symbol = String(req.params.symbol).toUpperCase();
    const count  = await flushBotOrders(symbol);
    res.json({ message: `Cancelled ${count} bot order(s) for ${symbol}.`, count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
