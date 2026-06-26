import express from "express";
import {
  createApiKey, getApiKeys, deleteApiKey,
  getSessions, revokeSessionHandler, revokeAllSessionsHandler,
  getAmlAlerts, getAmlAlertById, reviewAmlAlert,
  getMySecuritySummary,
  adminFreezeUser, adminUnfreezeUser,
} from "../controllers/securityController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

// ── User routes ──────────────────────────────────────────────────────────────
router.get("/summary",                     requireAuth, getMySecuritySummary);

// API keys
router.get("/api-keys",                    requireAuth, getApiKeys);
router.post("/api-keys",                   requireAuth, createApiKey);
router.delete("/api-keys/:id",             requireAuth, deleteApiKey);

// Sessions
router.get("/sessions",                    requireAuth, getSessions);
router.delete("/sessions/all",             requireAuth, revokeAllSessionsHandler);
router.delete("/sessions/:sessionId",      requireAuth, revokeSessionHandler);

// ── Admin routes ─────────────────────────────────────────────────────────────
// AML
router.get("/aml/alerts",                  requireAuth, requireRole("admin"), getAmlAlerts);
router.get("/aml/alerts/:id",              requireAuth, requireRole("admin"), getAmlAlertById);
router.patch("/aml/alerts/:id/review",     requireAuth, requireRole("admin"), reviewAmlAlert);

// Account freeze
router.post("/users/:userId/freeze",       requireAuth, requireRole("admin"), adminFreezeUser);
router.post("/users/:userId/unfreeze",     requireAuth, requireRole("admin"), adminUnfreezeUser);

export default router;
