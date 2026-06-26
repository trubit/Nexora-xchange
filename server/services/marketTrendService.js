import Candle from "../models/Candle.js";
import { getLiveTicker } from "./tradeService.js";
import { PAIRS } from "../config/supportedAssets.js";

const round = (v, p = 2) => Number(Number(v || 0).toFixed(p));

export const getMarketOverview = () => {
  const tickers = PAIRS.map((p) => {
    const t = getLiveTicker(p.symbol);
    if (!t || !t.lastPrice) return null;
    const change24h = t.open24h > 0 ? ((t.lastPrice - t.open24h) / t.open24h) * 100 : 0;
    return {
      symbol:     p.symbol,
      baseAsset:  p.baseAsset,
      quoteAsset: p.quoteAsset,
      price:      t.lastPrice,
      change24h:  round(change24h, 2),
      high24h:    t.high24h,
      low24h:     t.low24h,
      volumeUSDT: round(t.volumeQuote24h || t.volumeBase24h * t.lastPrice, 2),
    };
  }).filter(Boolean);

  const byChange  = [...tickers].sort((a, b) => b.change24h - a.change24h);
  const byVolume  = [...tickers].sort((a, b) => b.volumeUSDT - a.volumeUSDT);

  return {
    topGainers:   byChange.slice(0, 5),
    topLosers:    byChange.slice(-5).reverse(),
    byVolume:     byVolume.slice(0, 5),
    bullishCount: tickers.filter((t) => t.change24h > 0).length,
    bearishCount: tickers.filter((t) => t.change24h < 0).length,
    total:        tickers.length,
    sentiment:    tickers.filter((t) => t.change24h > 0).length > tickers.length / 2 ? "bullish" : "bearish",
  };
};

export const getVolumeAlerts = async () => {
  const alerts = [];

  // Check USDT pairs only (most liquid)
  const usdtPairs = PAIRS.filter((p) => p.quoteAsset === "USDT").slice(0, 15);

  await Promise.all(
    usdtPairs.map(async (pair) => {
      const ticker = getLiveTicker(pair.symbol);
      if (!ticker) return;

      const candles = await Candle.find({ symbol: pair.symbol, interval: "1h" })
        .sort({ openTime: -1 })
        .limit(25)
        .lean();

      if (candles.length < 6) return;

      const avgVol  = candles.slice(1).reduce((s, c) => s + c.volume, 0) / (candles.length - 1);
      const curVol  = ticker.volumeBase24h || 0;
      const mult    = avgVol > 0 ? curVol / avgVol : 0;

      if (mult > 2) {
        const change24h = ticker.open24h > 0
          ? round(((ticker.lastPrice - ticker.open24h) / ticker.open24h) * 100, 2)
          : 0;
        alerts.push({
          symbol:        pair.symbol,
          currentVolume: round(curVol, 4),
          avgVolume:     round(avgVol, 4),
          multiplier:    round(mult, 1),
          change24h,
          price:         ticker.lastPrice,
          severity:      mult > 4 ? "high" : "medium",
        });
      }
    })
  );

  return alerts.sort((a, b) => b.multiplier - a.multiplier);
};

export const getTrendSignals = async () => {
  const signals = [];
  const usdtPairs = PAIRS.filter((p) => p.quoteAsset === "USDT").slice(0, 10);

  await Promise.all(
    usdtPairs.map(async (pair) => {
      const candles = await Candle.find({ symbol: pair.symbol, interval: "1h" })
        .sort({ openTime: -1 })
        .limit(30)
        .lean();

      if (candles.length < 20) return;
      const closes  = [...candles].reverse().map((c) => c.close);
      const current = closes[closes.length - 1];
      const sma20   = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
      const trend   = current > sma20 ? "uptrend" : "downtrend";
      const change  = closes[0] > 0 ? round(((current - closes[0]) / closes[0]) * 100, 2) : 0;

      signals.push({ symbol: pair.symbol, price: current, trend, change30h: change });
    })
  );

  return signals;
};
