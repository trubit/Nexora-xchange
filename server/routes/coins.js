import express from "express";
import {
  createCoin,
  listCoins,
  listAssets,
  updateCoin,
  deleteCoin,
  handleLogoUpload,
  searchCoinGecko,
  fetchCoinGeckoDetails,
} from "../controllers/coinsController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

// Public
router.get("/assets", listAssets);
router.get("/",       listCoins);

// Admin — coin catalog management
router.post(  "/",                requireAuth, requireRole("admin"), createCoin);
router.put(   "/:id",             requireAuth, requireRole("admin"), updateCoin);
router.delete("/:id",             requireAuth, requireRole("admin"), deleteCoin);

// Admin — logo upload
router.post("/upload-logo",       requireAuth, requireRole("admin"), handleLogoUpload);

// Admin — CoinGecko integration
router.get("/cg/search",          requireAuth, requireRole("admin"), searchCoinGecko);
router.get("/cg/details/:cgId",   requireAuth, requireRole("admin"), fetchCoinGeckoDetails);

export default router;
