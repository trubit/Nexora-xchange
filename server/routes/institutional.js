import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  registerClient,
  getMyClient,
  getTierLimits,
  createSubAccount,
  listSubAccounts,
  issueApiKey,
  listApiKeys,
  revokeApiKey,
  rotateApiKey,
  listClients,
  updateClientTier,
} from "../controllers/institutionalController.js";

const router = express.Router();

// ── Public (authenticated) ──────────────────────────────────────────────────
router.get("/tiers",                requireAuth, getTierLimits);
router.get("/me",                   requireAuth, getMyClient);
router.post("/register",            requireAuth, registerClient);

// ── Sub-accounts ────────────────────────────────────────────────────────────
router.post("/sub-accounts",        requireAuth, createSubAccount);
router.get("/sub-accounts",         requireAuth, listSubAccounts);

// ── API key management ───────────────────────────────────────────────────────
router.get("/api-keys",             requireAuth, listApiKeys);
router.post("/api-keys",            requireAuth, issueApiKey);
router.delete("/api-keys/:keyId",   requireAuth, revokeApiKey);
router.post("/api-keys/:keyId/rotate", requireAuth, rotateApiKey);

// ── Admin-only ───────────────────────────────────────────────────────────────
router.get("/admin/clients",        requireAuth, requireRole("admin"), listClients);
router.patch("/admin/clients/:clientId/tier", requireAuth, requireRole("admin"), updateClientTier);

export default router;
