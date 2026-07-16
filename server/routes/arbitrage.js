import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  getLiveOpportunities,
  getHistory,
  getStats,
  getMarketSnapshot,
  simulateOpportunity,
  getOpportunityById,
  getExchanges,
  getTrackedSymbols,
} from "../controllers/arbitrageController.js";

const router = Router();

// All arbitrage routes require authentication.
// Stats and admin-level data require admin role.
router.use(requireAuth);

// ── Read-only analytics (any authenticated user) ───────────────────────────────
router.get("/live",       getLiveOpportunities);
router.get("/history",    getHistory);
router.get("/snapshot",   getMarketSnapshot);
router.get("/exchanges",  getExchanges);
router.get("/symbols",    getTrackedSymbols);
router.get("/:id",        getOpportunityById);

// ── Simulation (any authenticated user) ───────────────────────────────────────
router.post("/simulate", simulateOpportunity);

// ── Admin-only ─────────────────────────────────────────────────────────────────
router.get("/admin/stats", requireRole("admin"), getStats);

export default router;
