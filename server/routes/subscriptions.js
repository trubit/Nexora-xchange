 import express from "express";
import {
  createSubscription,
  deleteSubscription,
  listSubscriptions,
  updateSubscription,
} from "../controllers/subscriptionsController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireAuth, listSubscriptions);
router.post("/", requireAuth, createSubscription);
router.put("/:id", requireAuth, updateSubscription);
router.delete("/:id", requireAuth, deleteSubscription);

export default router; 

