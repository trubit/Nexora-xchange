import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  getSettlements,
  getSettlementById,
  getSettlementHistory,
  reconcile,
  retrySettlement,
  getStatistics,
  getBatches,
  getAuditLogs,
} from "../controllers/clearingHouseController.js";

const router = express.Router();

// All clearing routes require authentication and admin/clearing role
router.get("/settlements",    requireAuth, requireRole("admin"), getSettlements);
router.get("/settlements/:id",requireAuth, requireRole("admin"), getSettlementById);
router.get("/history",        requireAuth, requireRole("admin"), getSettlementHistory);
router.get("/statistics",     requireAuth, requireRole("admin"), getStatistics);
router.get("/batches",        requireAuth, requireRole("admin"), getBatches);
router.get("/audit",          requireAuth, requireRole("admin"), getAuditLogs);

router.post("/reconcile",     requireAuth, requireRole("admin"), reconcile);
router.post("/retry/:id",     requireAuth, requireRole("admin"), retrySettlement);

export default router;
