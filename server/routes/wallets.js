 import express from "express";
import {
  createWallet,
  listWallets,
  updateWallet,
} from "../controllers/walletsController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireAuth, listWallets);
router.post("/", requireAuth, createWallet);
router.put("/:id", requireAuth, updateWallet);

export default router; 

