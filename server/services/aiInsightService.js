import Anthropic from "@anthropic-ai/sdk";
import { getPortfolioSnapshot, getPnLSummary } from "./portfolioAnalyticsService.js";
import { detectPatterns }                       from "./patternDetectionEngine.js";
import { getMarketOverview, getVolumeAlerts }   from "./marketTrendService.js";

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// Per-user insight cache (5-minute TTL)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

const round = (v, p = 2) => Number(Number(v || 0).toFixed(p));

// ── AI narrative via Claude Haiku ─────────────────────────────────────────────

const callClaude = async (prompt) => {
  if (!client) return null;
  try {
    const msg = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 700,
      messages:   [{ role: "user", content: prompt }],
    });
    return msg.content[0]?.text || null;
  } catch (err) {
    console.error("[AI] Claude call failed:", err.message);
    return null;
  }
};

const buildPrompt = (portfolio, pnl, market, alerts, patterns) => {
  const top5 = portfolio.holdings
    .slice(0, 5)
    .map((h) => `${h.asset} $${h.valueUSDT} (${h.allocation}%)`)
    .join(", ") || "empty";

  const patSummary = patterns
    .map((p) => `${p.symbol}: RSI ${p.rsi ?? "n/a"}, ${p.trend}, signals: ${p.signals.map((s) => s.signal).join("/") || "none"}`)
    .join(" | ") || "no data";

  const alertSummary = alerts.slice(0, 3)
    .map((a) => `${a.symbol} vol ×${a.multiplier}`)
    .join(", ") || "none";

  return `You are a professional crypto portfolio analyst. Provide 5-7 concise, specific bullet points based on this real portfolio data. Be direct, reference actual numbers.

PORTFOLIO: $${portfolio.totalValueUSDT} total | Top holdings: ${top5}
P&L: Realized $${pnl.realizedPnL} | Unrealized $${pnl.unrealizedPnL} | Today $${pnl.periods?.today || 0} | This week $${pnl.periods?.week || 0}
MARKET: ${market.bullishCount}/${market.total} coins up | Sentiment: ${market.sentiment} | Top gainer: ${market.topGainers[0]?.symbol || "n/a"} ${market.topGainers[0]?.change24h || 0}%
TECHNICALS: ${patSummary}
VOLUME ALERTS: ${alertSummary}

Give 5-7 specific, actionable bullet points covering: portfolio risk, opportunities, and what to watch. Use bullet "•" format. No disclaimers.`;
};

// ── Rule-based suggestions (always available, no API needed) ─────────────────

const buildSuggestions = (portfolio, pnl, market) => {
  const sugg = [];
  const top = portfolio.holdings[0];
  const usdtH = portfolio.holdings.find((h) => h.asset === "USDT");

  if (portfolio.holdings.length === 1 && top?.asset !== "USDT") {
    sugg.push({ type: "diversify", priority: "high", icon: "bi-pie-chart", title: "Diversify Your Portfolio", description: `100% concentration in ${top.asset} is high risk. Aim for 3–5 assets.`, action: "Explore Markets", link: "/Dashboard/markets" });
  }

  if (top && top.allocation > 75 && top.asset !== "USDT") {
    sugg.push({ type: "rebalance", priority: "medium", icon: "bi-sliders", title: `Rebalance ${top.asset} (${top.allocation}%)`, description: `Consider reducing ${top.asset} to <60% to limit single-asset exposure.`, action: "Trade Now", link: "/Dashboard/trade" });
  }

  const bigLosers = pnl.holdings?.filter((h) => h.pnlPct < -15) || [];
  for (const h of bigLosers.slice(0, 2)) {
    sugg.push({ type: "stop_loss", priority: "high", icon: "bi-shield-exclamation", title: `${h.asset} Down ${Math.abs(h.pnlPct)}%`, description: `Consider a stop-loss or averaging down if you're bullish on ${h.asset}.`, action: "Set Stop-Loss", link: "/Dashboard/trade" });
  }

  if (usdtH && usdtH.allocation > 60 && portfolio.totalValueUSDT > 50) {
    sugg.push({ type: "deploy", priority: "medium", icon: "bi-cash-coin", title: `${usdtH.allocation}% in USDT`, description: "Large cash position. Deploy during dips for better long-term returns.", action: "View Markets", link: "/Dashboard/markets" });
  }

  const momGainer = market.topGainers.find((g) => g.change24h > 8);
  if (momGainer) {
    sugg.push({ type: "momentum", priority: "low", icon: "bi-rocket-takeoff", title: `${momGainer.symbol} +${momGainer.change24h}% Today`, description: "Strong momentum. Watch for a pullback entry or continuation breakout.", action: "Trade", link: "/Dashboard/trade" });
  }

  if (market.sentiment === "bearish" && pnl.unrealizedPnL < -100) {
    sugg.push({ type: "hedge", priority: "medium", icon: "bi-umbrella", title: "Market Bearish — Consider Hedging", description: "Overall market is down. Review positions and consider reducing exposure.", action: "Review Portfolio", link: "/Dashboard/analytics" });
  }

  return sugg;
};

// ── Main exports ──────────────────────────────────────────────────────────────

const safeRun = async (fn, fallback) => {
  try { return await fn(); }
  catch (err) { console.error("[analytics]", err.message); return fallback; }
};

export const generateInsights = async (userId) => {
  const key    = String(userId);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const [portfolio, pnl, market, alerts] = await Promise.all([
    safeRun(() => getPortfolioSnapshot(userId), { totalValueUSDT: 0, holdings: [], assetCount: 0 }),
    safeRun(() => getPnLSummary(userId),         { realizedPnL: 0, unrealizedPnL: 0, totalPnL: 0, periods: { today: 0, week: 0, month: 0 }, holdings: [], tradeCount: 0 }),
    safeRun(() => getMarketOverview(),           { topGainers: [], topLosers: [], byVolume: [], bullishCount: 0, bearishCount: 0, total: 0, sentiment: "neutral" }),
    safeRun(() => getVolumeAlerts(),             []),
  ]);

  // Pattern detection for top 3 non-stable assets
  const topAssets = (portfolio.holdings || [])
    .filter((h) => h.asset !== "USDT" && h.asset !== "USDC")
    .slice(0, 3)
    .map((h) => h.asset);

  const patterns = (
    await Promise.all(topAssets.map((a) => detectPatterns(`${a}USDT`).catch(() => null)))
  ).filter(Boolean);

  // AI narrative
  const aiSummary = await safeRun(() => callClaude(buildPrompt(portfolio, pnl, market, alerts, patterns)), null);

  // Rule-based suggestions
  let suggestions = [];
  try { suggestions = buildSuggestions(portfolio, pnl, market); } catch (e) { console.error("[analytics]", e.message); }

  const data = {
    portfolio,
    pnl,
    marketOverview: market,
    volumeAlerts:   alerts,
    patterns,
    suggestions,
    aiSummary,
    aiAvailable:    Boolean(client),
    cachedAt:       new Date().toISOString(),
  };

  cache.set(key, { ts: Date.now(), data });
  return data;
};

export const invalidateCache = (userId) => cache.delete(String(userId));
