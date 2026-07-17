import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  getMySettlements,
  getSettlementByTxHash,
  verifyTransaction,
  verifyDeposit,
  getSettlementStats,
  getPendingSettlements,
  getIndexerStatus,
  markSettlementFailed,
  getSupportedChains,
} from "../controllers/settlementController.js";

const router = express.Router();

// ── Public ──────────────────────────────────────────────────────────────────
router.get("/chains", getSupportedChains);

// ── Authenticated ───────────────────────────────────────────────────────────
router.get("/my",                   requireAuth, getMySettlements);
router.get("/tx/:chain/:txHash",    requireAuth, getSettlementByTxHash);
router.get("/verify/:chain/:txHash",requireAuth, verifyTransaction);
router.get("/verify-deposit/:chain/:txHash", requireAuth, verifyDeposit);

// ── Admin ───────────────────────────────────────────────────────────────────
router.get("/stats",    requireAuth, requireRole("admin"), getSettlementStats);
router.get("/pending",  requireAuth, requireRole("admin"), getPendingSettlements);
router.get("/indexer",  requireAuth, requireRole("admin"), getIndexerStatus);
router.patch("/:settlementId/fail", requireAuth, requireRole("admin"), markSettlementFailed);

export default router;
