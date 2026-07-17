/**
 * Market Intelligence Controller — REST handlers for Stage 27.
 */

import { marketIntelligenceCore }   from "../services/marketIntelligenceCore.js";
import { anomalyDetectionEngine }   from "../services/anomalyDetectionEngine.js";
import logger                       from "../config/logger.js";

// ── Signals ────────────────────────────────────────────────────────────────────

export const getSignals = async (req, res) => {
  try {
    const { pair, type, severity } = req.query;
    const limit = Math.min(parseInt(req.query.limit ?? "50", 10), 500);
    const skip  = parseInt(req.query.skip ?? "0", 10);
    const signals = await marketIntelligenceCore.getSignals({ pair, type, severity, limit, skip });
    res.json({ signals, count: signals.length });
  } catch (err) {
    logger.error({ err: err.message }, "[MICCtrl] getSignals error");
    res.status(500).json({ message: "Failed to fetch signals." });
  }
};

// ── Whale activity ─────────────────────────────────────────────────────────────

export const getWhaleActivity = async (req, res) => {
  try {
    const { pair } = req.query;
    const limit = Math.min(parseInt(req.query.limit ?? "50", 10), 200);
    const skip  = parseInt(req.query.skip ?? "0", 10);
    const activity = await marketIntelligenceCore.getWhaleActivity({ pair, limit, skip });
    res.json({ activity, count: activity.length });
  } catch (err) {
    logger.error({ err: err.message }, "[MICCtrl] getWhaleActivity error");
    res.status(500).json({ message: "Failed to fetch whale activity." });
  }
};

export const reportWhaleTransaction = async (req, res) => {
  try {
    const { pair, side, amountUsd, price, address, exchange, txHash, source } = req.body;
    if (!pair || !amountUsd) return res.status(400).json({ message: "pair and amountUsd are required." });
    const whale = await marketIntelligenceCore.ingestWhaleTransaction({
      pair, side, amountUsd: parseFloat(amountUsd), price, address, exchange, txHash, source,
    });
    if (!whale) return res.status(200).json({ message: "Below whale threshold. Not recorded." });
    res.status(201).json({ whale });
  } catch (err) {
    logger.error({ err: err.message }, "[MICCtrl] reportWhaleTransaction error");
    res.status(500).json({ message: "Failed to report whale transaction." });
  }
};

// ── Anomaly analysis ──────────────────────────────────────────────────────────

export const analyzeVolatility = (req, res) => {
  const { prices } = req.body;
  if (!Array.isArray(prices) || prices.length < 3) {
    return res.status(400).json({ message: "prices array with ≥3 entries required." });
  }
  const result = anomalyDetectionEngine.forecastVolatility(prices.map(Number));
  res.json({ analysis: result });
};

export const analyzeManipulation = (req, res) => {
  const { trades } = req.body;
  if (!Array.isArray(trades) || trades.length < 5) {
    return res.status(400).json({ message: "trades array with ≥5 entries required." });
  }
  const result = anomalyDetectionEngine.detectPriceManipulation(trades);
  res.json({ analysis: result });
};

export const analyzeLiquidityImbalance = (req, res) => {
  const { bids, asks } = req.body;
  if (!Array.isArray(bids) || !Array.isArray(asks)) {
    return res.status(400).json({ message: "bids and asks arrays required." });
  }
  const result = anomalyDetectionEngine.detectLiquidityImbalance({ bids, asks });
  res.json({ analysis: result });
};

// ── Stats ──────────────────────────────────────────────────────────────────────

export const getIntelligenceStats = (_req, res) => {
  const stats = marketIntelligenceCore.getStats();
  res.json({ stats });
};
