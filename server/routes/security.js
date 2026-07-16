import express from "express";
import {
  createApiKey, getApiKeys, deleteApiKey,
  getSessions, revokeSessionHandler, revokeAllSessionsHandler,
  getAmlAlerts, getAmlAlertById, reviewAmlAlert,
  getMySecuritySummary,
  adminFreezeUser, adminUnfreezeUser,
  // Zero-trust additions
  getTrustEvaluation, issueStepUpToken, verifyStepUpToken,
  getGeoInfo, getSecurityHealth,
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

// ── Zero-Trust Security Model ─────────────────────────────────────────────────

// Trust evaluation for current request
router.get("/zero-trust/evaluate",         requireAuth, getTrustEvaluation);

// Step-up authentication
router.post("/zero-trust/step-up/issue",   requireAuth, issueStepUpToken);
router.post("/zero-trust/step-up/verify",  requireAuth, verifyStepUpToken);

// Geo-IP info
router.get("/geo",                         requireAuth, getGeoInfo);

// Admin health
router.get("/health",                      requireAuth, requireRole("admin"), getSecurityHealth);

export default router;
