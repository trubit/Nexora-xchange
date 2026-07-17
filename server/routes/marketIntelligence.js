import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  getSignals,
  getWhaleActivity,
  reportWhaleTransaction,
  analyzeVolatility,
  analyzeManipulation,
  analyzeLiquidityImbalance,
  getIntelligenceStats,
} from "../controllers/marketIntelligenceController.js";

const router = express.Router();

// ── Authenticated users ───────────────────────────────────────────────────────
router.get("/signals",        requireAuth, getSignals);
router.get("/whales",         requireAuth, getWhaleActivity);
router.post("/analyze/volatility",  requireAuth, analyzeVolatility);
router.post("/analyze/manipulation",requireAuth, analyzeManipulation);
router.post("/analyze/imbalance",   requireAuth, analyzeLiquidityImbalance);

// ── Admin-only ────────────────────────────────────────────────────────────────
router.post("/whales/report",  requireAuth, requireRole("admin"), reportWhaleTransaction);
router.get("/stats",           requireAuth, requireRole("admin"), getIntelligenceStats);

export default router;
