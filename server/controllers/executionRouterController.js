/**
 * Execution Router Controller — REST handlers for Stage 28.
 */

import { executionRouterService } from "../services/executionRouterService.js";
import logger from "../config/logger.js";

export const planRoute = async (req, res) => {
  try {
    const { pair, side, quantity, limitPrice } = req.body;
    if (!pair || !side || !quantity) {
      return res.status(400).json({ message: "pair, side, and quantity are required." });
    }
    if (!["buy", "sell"].includes(side)) {
      return res.status(400).json({ message: "side must be buy or sell." });
    }
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ message: "quantity must be a positive number." });
    }
    const route = await executionRouterService.planRoute({
      pair, side, quantity: qty, limitPrice: limitPrice ? parseFloat(limitPrice) : null,
      userId: req.user._id,
    });
    res.status(201).json({ route });
  } catch (err) {
    logger.error({ err: err.message }, "[RouterCtrl] planRoute error");
    res.status(500).json({ message: "Failed to plan route." });
  }
};

export const getMyRoutes = async (req, res) => {
  try {
    const { pair, status } = req.query;
    const limit  = Math.min(parseInt(req.query.limit ?? "50", 10), 200);
    const skip   = parseInt(req.query.skip ?? "0", 10);
    const routes = await executionRouterService.getRouteHistory({
      userId: req.user._id, pair, status, limit, skip,
    });
    res.json({ routes, count: routes.length });
  } catch (err) {
    logger.error({ err: err.message }, "[RouterCtrl] getMyRoutes error");
    res.status(500).json({ message: "Failed to fetch routes." });
  }
};

export const getRouterStats = (_req, res) => {
  const stats = executionRouterService.getStats();
  res.json({ stats });
};

export const getLatencyReport = (_req, res) => {
  const report = executionRouterService.getLatencyReport();
  res.json({ latency: report });
};

export const recordOutcome = async (req, res) => {
  try {
    const { routeId } = req.params;
    const { filledQuantity, averageFillPrice, latencyMs } = req.body;
    if (!routeId || filledQuantity == null || averageFillPrice == null) {
      return res.status(400).json({ message: "routeId, filledQuantity, averageFillPrice required." });
    }
    const route = await executionRouterService.recordOutcome(routeId, {
      filledQuantity: parseFloat(filledQuantity),
      averageFillPrice: parseFloat(averageFillPrice),
      latencyMs: latencyMs ? parseInt(latencyMs, 10) : null,
    });
    if (!route) return res.status(404).json({ message: "Route not found." });
    res.json({ route });
  } catch (err) {
    logger.error({ err: err.message }, "[RouterCtrl] recordOutcome error");
    res.status(500).json({ message: "Failed to record outcome." });
  }
};
