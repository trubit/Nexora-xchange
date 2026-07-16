import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  getMyCreditScore,
  getUserCreditScore,
  getCreditDistribution,
  getMyBehaviorScore,
  getUserBehaviorScore,
  getMyRiskExposure,
  getMarketRisk,
  getSystemRisk,
  getMyPortfolioHeatmap,
  getLiquidityRisk,
  getSymbolLiquidity,
  getMyRiskSummary,
  getMyRiskHistory,
  triggerBatchRescore,
} from "../controllers/creditRiskController.js";

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// ── Self-service (authenticated user) ─────────────────────────────────────────

// Full risk summary for current user
router.get("/my/summary",  getMyRiskSummary);

// Credit score
router.get("/my/credit",   getMyCreditScore);

// Trading behavior score
router.get("/my/behavior", getMyBehaviorScore);

// Risk exposure (open positions)
router.get("/my/exposure", getMyRiskExposure);

// Portfolio heatmap
router.get("/my/heatmap",  getMyPortfolioHeatmap);

// Historical reports
router.get("/my/history",  getMyRiskHistory);

// ── Market-level (authenticated user) ─────────────────────────────────────────

router.get("/market/:symbol", getMarketRisk);
router.get("/liquidity",      getLiquidityRisk);
router.get("/liquidity/:symbol", getSymbolLiquidity);

// ── Admin-only ─────────────────────────────────────────────────────────────────

router.get("/admin/system",              requireRole("admin"), getSystemRisk);
router.get("/admin/distribution/credit", requireRole("admin"), getCreditDistribution);
router.get("/admin/user/:userId/credit", requireRole("admin"), getUserCreditScore);
router.get("/admin/user/:userId/behavior", requireRole("admin"), getUserBehaviorScore);
router.post("/admin/rescore",            requireRole("admin"), triggerBatchRescore);

export default router;
