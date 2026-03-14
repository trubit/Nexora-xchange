 import express from "express";
import {
  createTrade,
  deleteTrade,
  getTrade,
  listTrades,
  updateTrade,
} from "../controllers/tradesController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireAuth, listTrades);
router.post("/", requireAuth, createTrade);
router.get("/:id", requireAuth, getTrade);
router.put("/:id", requireAuth, updateTrade);
router.delete("/:id", requireAuth, deleteTrade);

export default router; 

