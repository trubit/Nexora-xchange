import { generateInsights, invalidateCache }           from "../services/aiInsightService.js";
import { getPortfolioSnapshot, getPnLSummary, getTradeActivity } from "../services/portfolioAnalyticsService.js";
import { detectPatterns }                               from "../services/patternDetectionEngine.js";
import { getMarketOverview, getVolumeAlerts, getTrendSignals } from "../services/marketTrendService.js";

// GET /api/analytics/insights  — full AI-powered bundle (cached 5 min)
// Pass ?refresh=true to bust the cache and re-run Claude immediately
export const getInsights = async (req, res) => {
  if (req.query.refresh === "true") invalidateCache(req.user._id);
  const data = await generateInsights(req.user._id);
  res.json(data);
};

// GET /api/analytics/portfolio
export const getPortfolio = async (req, res) => {
  const data = await getPortfolioSnapshot(req.user._id);
  res.json(data);
};

// GET /api/analytics/pnl
export const getPnL = async (req, res) => {
  const data = await getPnLSummary(req.user._id);
  res.json(data);
};

// GET /api/analytics/activity
export const getActivity = async (req, res) => {
  const data = await getTradeActivity(req.user._id);
  res.json(data);
};

// GET /api/analytics/market
export const getMarket = async (req, res) => {
  const [overview, alerts, trends] = await Promise.all([
    getMarketOverview(),
    getVolumeAlerts(),
    getTrendSignals(),
  ]);
  res.json({ overview, alerts, trends });
};

// GET /api/analytics/patterns/:symbol
export const getPatterns = async (req, res) => {
  const symbol   = String(req.params.symbol || "").toUpperCase();
  const interval = String(req.query.interval || "1h");
  if (!symbol) return res.status(400).json({ message: "Symbol required." });
  const data = await detectPatterns(symbol, interval);
  res.json(data);
};
