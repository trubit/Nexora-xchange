 import express from "express";
import {
  addReply,
  createTicket,
  listTickets,
  updateTicket,
} from "../controllers/supportController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireAuth, listTickets);
router.post("/", requireAuth, createTicket);
router.put("/:id", requireAuth, updateTicket);
router.post("/:id/replies", requireAuth, addReply);

// Admin-only route example
router.get("/admin/all", requireAuth, requireRole("admin"), listTickets);

export default router; 

