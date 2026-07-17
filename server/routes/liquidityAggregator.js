import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  getAggregatedBook,
  getBestBidAsk,
  estimateSlippage,
  getActivePairs,
  listProviders,
  registerProvider,
  disableProvider,
  getRoutingPlan,
  compareRouting,
  getAggregatorStats,
} from "../controllers/liquidityAggregatorController.js";

const router = express.Router();

// ── Public (any authenticated user) ─────────────────────────────────────────
router.get("/pairs",                requireAuth, getActivePairs);
router.get("/book/:pair",           requireAuth, getAggregatedBook);
router.get("/best/:pair",           requireAuth, getBestBidAsk);
router.get("/slippage/:pair",       requireAuth, estimateSlippage);
router.get("/route/:pair",          requireAuth, getRoutingPlan);
router.get("/compare/:pair",        requireAuth, compareRouting);

// ── Admin-only ───────────────────────────────────────────────────────────────
router.get("/providers",            requireAuth, requireRole("admin"), listProviders);
router.post("/providers",           requireAuth, requireRole("admin"), registerProvider);
router.delete("/providers/:providerId", requireAuth, requireRole("admin"), disableProvider);
router.get("/stats",                requireAuth, requireRole("admin"), getAggregatorStats);

export default router;
