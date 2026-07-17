import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  getStatistics,
  getScalingEvents, triggerScale,
  getIncidents, createIncident, updateIncident,
  getDeployments, recordDeployment, rollbackDeployment,
} from "../controllers/autonomousOpsController.js";

const router = express.Router();

router.use(requireAuth, requireRole("admin"));

// Statistics
router.get("/statistics",                   getStatistics);

// Auto-scaling
router.get("/scaling",                      getScalingEvents);
router.post("/scaling/trigger",             triggerScale);

// Incidents
router.get("/incidents",                    getIncidents);
router.post("/incidents",                   createIncident);
router.patch("/incidents/:incidentId",      updateIncident);

// Deployments
router.get("/deployments",                  getDeployments);
router.post("/deployments",                 recordDeployment);
router.post("/deployments/:deploymentId/rollback", rollbackDeployment);

export default router;
