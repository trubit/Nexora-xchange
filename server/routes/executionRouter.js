import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  planRoute,
  getMyRoutes,
  getRouterStats,
  getLatencyReport,
  recordOutcome,
} from "../controllers/executionRouterController.js";

const router = express.Router();

// ── Authenticated users ────────────────────────────────────────────────────────
router.post("/plan",          requireAuth, planRoute);
router.get("/my",             requireAuth, getMyRoutes);

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get("/stats",          requireAuth, requireRole("admin"), getRouterStats);
router.get("/latency",        requireAuth, requireRole("admin"), getLatencyReport);
router.patch("/:routeId/outcome", requireAuth, requireRole("admin"), recordOutcome);

export default router;
