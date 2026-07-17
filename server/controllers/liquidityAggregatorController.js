/**
 * Liquidity Aggregator Controller — REST handlers for Stage 26.
 */

import { liquidityAggregatorService }   from "../services/liquidityAggregatorService.js";
import { aggregatedOrderBookEngine }    from "../services/aggregatedOrderBookEngine.js";
import { smartOrderSplitter }           from "../services/smartOrderSplitter.js";
import logger                           from "../config/logger.js";

// ── Order book ────────────────────────────────────────────────────────────────

export const getAggregatedBook = (req, res) => {
  const { pair } = req.params;
  if (!pair) return res.status(400).json({ message: "pair is required." });
  const book = aggregatedOrderBookEngine.getBook(decodeURIComponent(pair));
  if (!book) return res.status(404).json({ message: "No aggregated book for this pair." });
  res.json({ book });
};

export const getBestBidAsk = (req, res) => {
  const { pair } = req.params;
  const result = aggregatedOrderBookEngine.getBestBidAsk(decodeURIComponent(pair));
  if (!result) return res.status(404).json({ message: "No data for this pair." });
  res.json(result);
};

export const estimateSlippage = (req, res) => {
  const { pair } = req.params;
  const { side, amount } = req.query;
  if (!side || !amount) return res.status(400).json({ message: "side and amount required." });
  if (!["buy", "sell"].includes(side)) return res.status(400).json({ message: "side must be buy or sell." });
  const usdAmount = parseFloat(amount);
  if (isNaN(usdAmount) || usdAmount <= 0) return res.status(400).json({ message: "amount must be a positive number." });
  const result = aggregatedOrderBookEngine.estimateSlippage(decodeURIComponent(pair), side, usdAmount);
  if (!result) return res.status(404).json({ message: "No book data to estimate slippage." });
  res.json({ estimation: result });
};

export const getActivePairs = (_req, res) => {
  const pairs = aggregatedOrderBookEngine.getAllPairs();
  res.json({ pairs, count: pairs.length });
};

// ── Providers ─────────────────────────────────────────────────────────────────

export const listProviders = (_req, res) => {
  const providers = liquidityAggregatorService.getProviders();
  res.json({ providers, count: providers.length });
};

export const registerProvider = async (req, res) => {
  try {
    const { name, type, pairs, feeTierPct, maxDepthUsd, priority, apiEndpoint } = req.body;
    if (!name || !type) return res.status(400).json({ message: "name and type are required." });
    const doc = await liquidityAggregatorService.registerProvider({
      name, type, pairs: pairs ?? [], feeTierPct, maxDepthUsd, priority, apiEndpoint: apiEndpoint ?? "",
    });
    res.status(201).json({ provider: doc });
  } catch (err) {
    logger.error({ err: err.message }, "[LAggr] registerProvider error");
    res.status(500).json({ message: "Failed to register provider." });
  }
};

export const disableProvider = async (req, res) => {
  try {
    const { providerId } = req.params;
    await liquidityAggregatorService.disableProvider(providerId);
    res.json({ message: "Provider disabled." });
  } catch (err) {
    logger.error({ err: err.message }, "[LAggr] disableProvider error");
    res.status(500).json({ message: "Failed to disable provider." });
  }
};

// ── Smart routing ─────────────────────────────────────────────────────────────

export const getRoutingPlan = (req, res) => {
  const { pair } = req.params;
  const { side, quantity } = req.query;
  if (!side || !quantity) return res.status(400).json({ message: "side and quantity are required." });
  if (!["buy", "sell"].includes(side)) return res.status(400).json({ message: "side must be buy or sell." });
  const qty = parseFloat(quantity);
  if (isNaN(qty) || qty <= 0) return res.status(400).json({ message: "quantity must be a positive number." });
  const plan = smartOrderSplitter.buildRoutingPlan({ pair: decodeURIComponent(pair), side, quantity: qty });
  res.json({ plan });
};

export const compareRouting = (req, res) => {
  const { pair } = req.params;
  const { side, quantity } = req.query;
  if (!side || !quantity) return res.status(400).json({ message: "side and quantity are required." });
  const qty = parseFloat(quantity);
  if (isNaN(qty) || qty <= 0) return res.status(400).json({ message: "quantity must be positive." });
  const comparison = smartOrderSplitter.compareStrategies(decodeURIComponent(pair), side, qty);
  res.json({ comparison });
};

export const getAggregatorStats = (_req, res) => {
  const stats = liquidityAggregatorService.getStats();
  res.json({ stats });
};
