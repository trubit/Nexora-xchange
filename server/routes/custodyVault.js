import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  getVaults, getVaultById, createVault, lockVault, unlockVault,
  getTransactions, initiateTransaction, approveTransaction, rejectTransaction,
  getPendingApprovals, getStatistics, getPolicies, createPolicy, getAuditLog,
} from "../controllers/custodyVaultController.js";

const router = express.Router();

router.get("/vaults",                  requireAuth, requireRole("admin"), getVaults);
router.get("/vaults/:id",              requireAuth, requireRole("admin"), getVaultById);
router.post("/vaults",                 requireAuth, requireRole("admin"), createVault);
router.patch("/vaults/:id/lock",       requireAuth, requireRole("admin"), lockVault);
router.patch("/vaults/:id/unlock",     requireAuth, requireRole("admin"), unlockVault);

router.get("/transactions",            requireAuth, requireRole("admin"), getTransactions);
router.post("/transactions",           requireAuth, requireRole("admin"), initiateTransaction);
router.post("/transactions/:txId/approve", requireAuth, requireRole("admin"), approveTransaction);
router.post("/transactions/:txId/reject",  requireAuth, requireRole("admin"), rejectTransaction);
router.get("/approvals/pending",       requireAuth, requireRole("admin"), getPendingApprovals);

router.get("/statistics",              requireAuth, requireRole("admin"), getStatistics);

router.get("/policies",                requireAuth, requireRole("admin"), getPolicies);
router.post("/policies",               requireAuth, requireRole("admin"), createPolicy);

router.get("/audit",                   requireAuth, requireRole("admin"), getAuditLog);

export default router;
