import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  getStatistics,
  getHealthChecks,
  triggerFailover, getFailoverEvents,
  triggerManualBackup, getBackupSnapshots,
  getDrPlans, createDrPlan, recordDrTest,
} from "../controllers/hadrController.js";

const router = express.Router();

router.use(requireAuth, requireRole("admin"));

// Statistics
router.get("/statistics",           getStatistics);

// Health monitoring
router.get("/health",               getHealthChecks);

// Failover
router.get("/failover",             getFailoverEvents);
router.post("/failover",            triggerFailover);

// Backups
router.get("/backups",              getBackupSnapshots);
router.post("/backups/trigger",     triggerManualBackup);

// DR plans
router.get("/dr-plans",             getDrPlans);
router.post("/dr-plans",            createDrPlan);
router.post("/dr-plans/:planId/test", recordDrTest);

export default router;
