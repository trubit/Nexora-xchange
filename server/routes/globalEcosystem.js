import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  getStatistics,
  getPartners, onboardPartner, activatePartner, updatePartnerRating,
  getPayments, initiatePayment,
  getIntegrations, createIntegration, recordIntegrationCall,
} from "../controllers/globalEcosystemController.js";

const router = express.Router();

router.use(requireAuth, requireRole("admin"));

// Statistics
router.get("/statistics",                               getStatistics);

// Partners
router.get("/partners",                                 getPartners);
router.post("/partners",                                onboardPartner);
router.patch("/partners/:partnerId/activate",           activatePartner);
router.patch("/partners/:partnerId/rating",             updatePartnerRating);

// Cross-border payments
router.get("/payments",                                 getPayments);
router.post("/payments",                                initiatePayment);

// Integrations
router.get("/integrations",                             getIntegrations);
router.post("/integrations",                            createIntegration);
router.post("/integrations/:integrationId/call",        recordIntegrationCall);

export default router;
