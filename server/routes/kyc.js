 import express from "express";
import {
  getMyKyc,
  listKyc,
  reviewKyc,
  submitKyc,
} from "../controllers/kycController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.get("/me", requireAuth, getMyKyc);
router.post("/submit", requireAuth, submitKyc);
router.get("/", requireAuth, requireRole("admin"), listKyc);
router.put("/:id", requireAuth, requireRole("admin"), reviewKyc);

export default router; 

