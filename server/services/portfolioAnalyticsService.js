import Wallet from "../models/Wallet.js";
import Trade from "../models/Trade.js";
import { getLiveTicker } from "./tradeService.js";
import { PAIRS } from "../config/supportedAssets.js";

const round = (v, p = 2) => Number(Number(v || 0).toFixed(p));

const getPriceUSDT = (asset) => {
  if (asset === "USDT" || asset === "USDC") return 1;
  const ticker = getLiveTicker(`${asset}USDT`);
  if (ticker?.lastPrice) return ticker.lastPrice;
  const pair = PAIRS.find((p) => p.symbol === `${asset}USDT`);
  return pair?.price || 0;
};

export const getPortfolioSnapshot = async (userId) => {
  const wallets = await Wallet.find({
    user: userId,
    $or: [{ available: { $gt: 0.000001 } }, { locked: { $gt: 0.000001 } }],
  }).lean();

  let totalValueUSDT = 0;
  const holdings = [];

  for (const w of wallets) {
    const total = (w.available || 0) + (w.locked || 0);
    if (total <= 0) continue;
    const priceUSDT = getPriceUSDT(w.asset);
    const valueUSDT = total * priceUSDT;
    totalValueUSDT += valueUSDT;
    holdings.push({ asset: w.asset, amount: total, available: w.available || 0, locked: w.locked || 0, priceUSDT, valueUSDT });
  }

  holdings.sort((a, b) => b.valueUSDT - a.valueUSDT);
  holdings.forEach((h) => {
    h.allocation = totalValueUSDT > 0 ? round((h.valueUSDT / totalValueUSDT) * 100, 1) : 0;
    h.valueUSDT  = round(h.valueUSDT, 2);
    h.priceUSDT  = round(h.priceUSDT, 6);
    h.amount     = round(h.amount, 8);
  });

  return { totalValueUSDT: round(totalValueUSDT, 2), holdings, assetCount: holdings.length };
};

export const getPnLSummary = async (userId) => {
  const allTrades = await Trade.find({ user: userId }).lean();
  const closedTrades = allTrades.filter((t) => t.status === "closed");
  const realizedPnL = closedTrades.reduce((s, t) => s + (t.pnl || 0), 0);

  // Unrealized P&L: compare current price to weighted average buy cost per asset
  const wallets = await Wallet.find({ user: userId }).lean();
  const unrealizedRows = [];
  let totalUnrealized = 0;

  for (const w of wallets) {
    if (w.asset === "USDT" || w.asset === "USDC") continue;
    const total = (w.available || 0) + (w.locked || 0);
    if (total < 0.000001) continue;

    const buys = allTrades.filter((t) => t.baseAsset === w.asset && t.side === "buy");
    if (!buys.length) continue;

    const totalBought = buys.reduce((s, t) => s + (t.amount || 0), 0);
    const totalSpent  = buys.reduce((s, t) => s + (t.quoteAmount || t.amount * t.price || 0), 0);
    const avgCost     = totalBought > 0 ? totalSpent / totalBought : 0;
    const currentPrice = getPriceUSDT(w.asset);
    const unrealized   = (currentPrice - avgCost) * total;
    const pnlPct       = avgCost > 0 ? ((currentPrice - avgCost) / avgCost) * 100 : 0;

    unrealizedRows.push({
      asset: w.asset, amount: round(total, 8),
      avgCost: round(avgCost, 6), currentPrice: round(currentPrice, 6),
      unrealizedPnL: round(unrealized, 2), pnlPct: round(pnlPct, 2),
    });
    totalUnrealized += unrealized;
  }

  const now = Date.now();
  const DAY = 86_400_000;
  const pnlIn = (ms) => closedTrades
    .filter((t) => new Date(t.executedAt || t.createdAt).getTime() > now - ms)
    .reduce((s, t) => s + (t.pnl || 0), 0);

  return {
    realizedPnL:   round(realizedPnL, 2),
    unrealizedPnL: round(totalUnrealized, 2),
    totalPnL:      round(realizedPnL + totalUnrealized, 2),
    periods: { today: round(pnlIn(DAY), 2), week: round(pnlIn(7 * DAY), 2), month: round(pnlIn(30 * DAY), 2) },
    holdings:   unrealizedRows,
    tradeCount: closedTrades.length,
  };
};

export const getTradeActivity = async (userId) => {
  const recent = await Trade.find({ user: userId }).sort({ createdAt: -1 }).limit(100).lean();
  const now = Date.now();
  const today = recent.filter((t) => now - new Date(t.createdAt).getTime() < 86_400_000);
  const vol24h = today.reduce((s, t) => s + (t.quoteAmount || t.amount * t.price || 0), 0);

  return {
    recentTrades: recent.slice(0, 20),
    totalTrades:  recent.length,
    trades24h:    today.length,
    volume24h:    round(vol24h, 2),
  };
};
