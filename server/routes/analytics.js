import express from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  getInsights,
  getPortfolio,
  getPnL,
  getActivity,
  getMarket,
  getPatterns,
} from "../controllers/analyticsController.js";

const router = express.Router();

const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    next(err);
  }
};

router.use(requireAuth);

router.get("/insights",          wrap(getInsights));
router.get("/portfolio",         wrap(getPortfolio));
router.get("/pnl",               wrap(getPnL));
router.get("/activity",          wrap(getActivity));
router.get("/market",            wrap(getMarket));
router.get("/patterns/:symbol",  wrap(getPatterns));

export default router;
