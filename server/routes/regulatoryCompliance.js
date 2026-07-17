import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  screenEntity, getSanctionHits, reviewSanctionHit,
  getTravelRuleRecords, createTravelRuleRecord,
  getSars, createSar, submitSar,
  getReports, generateReport,
  getStatistics,
} from "../controllers/regulatoryComplianceController.js";

const router = express.Router();

// All routes require authentication + admin role
router.use(requireAuth, requireRole("admin"));

// Statistics
router.get("/statistics", getStatistics);

// Sanctions screening
router.get("/sanctions",              getSanctionHits);
router.post("/sanctions/screen",      screenEntity);
router.patch("/sanctions/:hitId",     reviewSanctionHit);

// Travel Rule
router.get("/travel-rule",            getTravelRuleRecords);
router.post("/travel-rule",           createTravelRuleRecord);

// SARs
router.get("/sar",                    getSars);
router.post("/sar",                   createSar);
router.post("/sar/:sarId/submit",     submitSar);

// Regulatory reports
router.get("/reports",                getReports);
router.post("/reports/generate",      generateReport);

export default router;
