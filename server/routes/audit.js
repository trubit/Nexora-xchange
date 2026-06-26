import express from "express";
import {
  getMyAuditLog, getAuditLogs, verifyUserChain, getAuditStats,
} from "../controllers/auditController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

// User — own audit trail
router.get("/me",             requireAuth,                          getMyAuditLog);

// Admin — full access
router.get("/",               requireAuth, requireRole("admin"),    getAuditLogs);
router.get("/stats",          requireAuth, requireRole("admin"),    getAuditStats);
router.get("/verify/:userId", requireAuth, requireRole("admin"),    verifyUserChain);

export default router;
