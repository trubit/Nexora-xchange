import Candle from "../models/Candle.js";

const rsi = (closes, period = 14) => {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  const avgG = gains / period, avgL = losses / period;
  if (avgL === 0) return 100;
  return 100 - 100 / (1 + avgG / avgL);
};

const sma = (arr, n) => {
  if (arr.length < n) return null;
  return arr.slice(-n).reduce((a, b) => a + b, 0) / n;
};

const ema = (arr, n) => {
  if (arr.length < n) return null;
  const k = 2 / (n + 1);
  let val = arr.slice(0, n).reduce((a, b) => a + b, 0) / n;
  for (let i = n; i < arr.length; i++) val = arr[i] * k + val * (1 - k);
  return val;
};

const supportResistance = (candles) => {
  const recent = candles.slice(-20);
  return {
    support:    Math.min(...recent.map((c) => c.low)),
    resistance: Math.max(...recent.map((c) => c.high)),
  };
};

export const detectPatterns = async (symbol, interval = "1h", limit = 60) => {
  const raw = await Candle.find({ symbol: symbol.toUpperCase(), interval })
    .sort({ openTime: -1 })
    .limit(limit)
    .lean();

  if (raw.length < 14) {
    return { symbol, trend: "insufficient_data", patterns: [], signals: [], rsi: null };
  }

  const candles = [...raw].reverse();
  const closes  = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);
  const current = closes[closes.length - 1];

  const rsiVal  = rsi(closes);
  const sma20   = sma(closes, 20);
  const sma50   = sma(closes, Math.min(50, closes.length));
  const ema12   = ema(closes, 12);
  const ema26   = ema(closes, 26);
  const { support, resistance } = supportResistance(candles);

  // Average volume excluding latest bar
  const avgVol = volumes.slice(0, -1).reduce((a, b) => a + b, 0) / Math.max(volumes.length - 1, 1);
  const latestVol = volumes[volumes.length - 1];
  const volMult   = avgVol > 0 ? latestVol / avgVol : 1;

  const patterns = [];
  const signals  = [];

  // RSI signals
  if (rsiVal !== null) {
    if (rsiVal < 30) {
      patterns.push({ type: "oversold",   label: "RSI Oversold",   value: Math.round(rsiVal), severity: "bullish" });
      signals.push({ signal: "BUY",  reason: `RSI ${Math.round(rsiVal)} — oversold`, confidence: "medium" });
    } else if (rsiVal > 70) {
      patterns.push({ type: "overbought", label: "RSI Overbought", value: Math.round(rsiVal), severity: "bearish" });
      signals.push({ signal: "SELL", reason: `RSI ${Math.round(rsiVal)} — overbought`, confidence: "medium" });
    }
  }

  // MACD-like signal (EMA12 vs EMA26)
  if (ema12 && ema26) {
    if (ema12 > ema26) {
      patterns.push({ type: "macd_bull", label: "MACD Bullish", severity: "bullish" });
      signals.push({ signal: "BUY", reason: "EMA12 above EMA26 — bullish momentum", confidence: "low" });
    } else {
      patterns.push({ type: "macd_bear", label: "MACD Bearish", severity: "bearish" });
      signals.push({ signal: "SELL", reason: "EMA12 below EMA26 — bearish momentum", confidence: "low" });
    }
  }

  // SMA crossover
  if (sma20 && sma50) {
    if (sma20 > sma50 && current > sma20) {
      patterns.push({ type: "above_smas", label: "Price Above SMA20 & SMA50", severity: "bullish" });
    } else if (sma20 < sma50 && current < sma20) {
      patterns.push({ type: "below_smas", label: "Price Below SMA20 & SMA50", severity: "bearish" });
    }
  }

  // Volume spike
  if (volMult > 2) {
    patterns.push({ type: "volume_spike", label: `Volume Spike (${Math.round(volMult * 10) / 10}×)`, severity: "neutral", value: volMult });
  }

  // Support / resistance proximity (within 1.5%)
  const near = (level) => Math.abs(current - level) / current < 0.015;
  if (near(support)) {
    patterns.push({ type: "near_support", label: `Near Support $${support.toFixed(4)}`, severity: "bullish" });
    signals.push({ signal: "BUY", reason: `Near support at $${support.toFixed(4)}`, confidence: "low" });
  }
  if (near(resistance)) {
    patterns.push({ type: "near_resistance", label: `Near Resistance $${resistance.toFixed(4)}`, severity: "bearish" });
    signals.push({ signal: "SELL", reason: `Near resistance at $${resistance.toFixed(4)}`, confidence: "low" });
  }

  // Trend
  let trend = "sideways";
  if (sma20 && sma50) {
    if (current > sma20 && sma20 > sma50) trend = "uptrend";
    else if (current < sma20 && sma20 < sma50) trend = "downtrend";
  }

  return {
    symbol, currentPrice: current,
    rsi:        rsiVal ? Math.round(rsiVal * 10) / 10 : null,
    sma20:      sma20  ? Math.round(sma20  * 100) / 100 : null,
    sma50:      sma50  ? Math.round(sma50  * 100) / 100 : null,
    ema12:      ema12  ? Math.round(ema12  * 100) / 100 : null,
    ema26:      ema26  ? Math.round(ema26  * 100) / 100 : null,
    support:    Math.round(support    * 10000) / 10000,
    resistance: Math.round(resistance * 10000) / 10000,
    volumeMultiplier: Math.round(volMult * 10) / 10,
    trend, patterns, signals,
  };
};
