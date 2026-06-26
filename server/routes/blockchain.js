import express from "express";
import { getChains, getStatus, getDepositAddress, submitWithdrawal } from "../controllers/blockchainController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Public — no user data exposed
router.get("/chains", getChains);
router.get("/status", getStatus);

// Authenticated — deposit address lookup / assignment
router.get("/deposit-address", requireAuth, getDepositAddress);

// Authenticated — submit an on-chain withdrawal
router.post("/withdraw", requireAuth, submitWithdrawal);

export default router;
