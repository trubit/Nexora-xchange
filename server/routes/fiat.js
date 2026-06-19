import express from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/auth.js";
import {
  addBankAccount,
  deleteBankAccount,
  depositConfirm,
  depositInitiate,
  getBankAccounts,
  getSingleTransaction,
  getTransactions,
  getWallet,
  makePrimaryBankAccount,
  withdraw,
  withdrawalFeePreview,
} from "../controllers/fiatController.js";

const router = express.Router();

// All fiat routes require authentication
router.use(requireAuth);

// ── Rate limiters (production only) ───────────────────────────────────────────

const isProd = process.env.NODE_ENV === "production";
const passthrough = (_req, _res, next) => next();

const depositLimiter = isProd
  ? rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 10,
      message: { message: "Too many deposit requests. Please try again in an hour." },
      standardHeaders: true,
      legacyHeaders: false,
    })
  : passthrough;

const withdrawLimiter = isProd
  ? rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 5,
      message: { message: "Too many withdrawal requests. Please try again in an hour." },
      standardHeaders: true,
      legacyHeaders: false,
    })
  : passthrough;

const bankLimiter = isProd
  ? rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 10,
      message: { message: "Too many bank account operations. Try again later." },
      standardHeaders: true,
      legacyHeaders: false,
    })
  : passthrough;

// ── Wallet ────────────────────────────────────────────────────────────────────
router.get("/wallet",               getWallet);

// ── Deposits ──────────────────────────────────────────────────────────────────
router.post("/deposit/initiate",    depositLimiter, depositInitiate);
router.post("/deposit/confirm",     depositLimiter, depositConfirm);

// ── Withdrawals ───────────────────────────────────────────────────────────────
router.get("/withdrawal/fee",       withdrawalFeePreview);
router.post("/withdraw",            withdrawLimiter, withdraw);

// ── Bank accounts ─────────────────────────────────────────────────────────────
router.get("/bank-accounts",        getBankAccounts);
router.post("/bank-accounts",       bankLimiter, addBankAccount);
router.patch("/bank-accounts/:id/primary", bankLimiter, makePrimaryBankAccount);
router.delete("/bank-accounts/:id", bankLimiter, deleteBankAccount);

// ── Transactions ──────────────────────────────────────────────────────────────
router.get("/transactions",         getTransactions);
router.get("/transactions/:txId",   getSingleTransaction);

export default router;
