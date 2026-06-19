import express from "express";
import {
  cancelOrder,
  createOCOOrder,
  createOrder,
  getOpenOrders,
  getOrderHistory,
} from "../controllers/ordersController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/",           requireAuth, getOpenOrders);
router.get("/history",    requireAuth, getOrderHistory);
router.post("/",          requireAuth, createOrder);
router.post("/oco",       requireAuth, createOCOOrder);
router.post("/:id/cancel", requireAuth, cancelOrder);

export default router;
