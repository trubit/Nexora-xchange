 import express from "express";
import {
  createTransaction,
  listTransactions,
} from "../controllers/transactionsController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireAuth, listTransactions);
router.post("/", requireAuth, createTransaction);

export default router; 

