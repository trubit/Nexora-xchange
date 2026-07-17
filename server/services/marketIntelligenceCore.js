/**
 * MarketIntelligenceCore — autonomous market surveillance and intelligence.
 *
 * Responsibilities:
 *   - Real-time anomaly scanning across all active trading pairs
 *   - Whale activity tracking (large trades / transfers)
 *   - Liquidity imbalance detection
 *   - Manipulation signal generation
 *   - Volatility forecasting and circuit-breaker alerting
 *
 * Emits: "signal" (new MarketSignal), "whale" (new WhaleActivity)
 */

import { EventEmitter }        from "events";
import MarketSignal            from "../models/MarketSignal.js";
import WhaleActivity           from "../models/WhaleActivity.js";
import { anomalyDetectionEngine } from "./anomalyDetectionEngine.js";
import logger                  from "../config/logger.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const SCAN_MS          = parseInt(process.env.INTEL_SCAN_MS         ?? "10000", 10);
const WHALE_USD        = parseFloat(process.env.INTEL_WHALE_USD     ?? "100000");
const CIRCUIT_BRK_PCT  = parseFloat(process.env.INTEL_CIRCUIT_BRK_PCT ?? "5");    // % move in one candle
const WINDOW_SIZE      = parseInt(process.env.INTEL_WINDOW          ?? "20", 10); // candles

// ── State store (in-memory sliding windows per pair) ─────────────────────────

export class MarketIntelligenceCore extends EventEmitter {
  constructor() {
    super();
    this._started     = false;
    this._scanTimer   = null;
    this._windows     = new Map();   // pair → { prices: number[], volumes: number[], trades: object[] }
    this._stats = { signals: 0, whales: 0, scans: 0, errors: 0 };
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  async start() {
    if (this._started) return;
    this._started  = true;
    this._scanTimer = setInterval(() => this._scan().catch((e) =>
      logger.error({ err: e.message }, "[MIC] Scan error.")
    ), SCAN_MS);
    logger.info("[MIC] Market intelligence core started.");
  }

  stop() {
    if (this._scanTimer) { clearInterval(this._scanTimer); this._scanTimer = null; }
    this._started = false;
    logger.info("[MIC] Market intelligence core stopped.");
  }

  // ── Public ingestion API ──────────────────────────────────────────────────────

  /** Feed a new price/volume candle for a pair. */
  ingestCandle(pair, { close, volume }) {
    if (!this._windows.has(pair)) this._windows.set(pair, { prices: [], volumes: [], trades: [] });
    const w = this._windows.get(pair);
    w.prices.push(close);
    w.volumes.push(volume);
    if (w.prices.length  > WINDOW_SIZE) w.prices.shift();
    if (w.volumes.length > WINDOW_SIZE) w.volumes.shift();
  }

  /** Feed a new trade for a pair (used for manipulation detection). */
  ingestTrade(pair, trade) {
    if (!this._windows.has(pair)) this._windows.set(pair, { prices: [], volumes: [], trades: [] });
    const w = this._windows.get(pair);
    w.trades.push({ ...trade, timestamp: trade.timestamp ?? Date.now() });
    // Keep last 100 trades
    if (w.trades.length > 100) w.trades.shift();
  }

  /** Feed a whale-sized transaction (exchange or on-chain). */
  async ingestWhaleTransaction({ pair, side, amountUsd, price, address, exchange, txHash, source, metadata = {} }) {
    if (amountUsd < WHALE_USD) return null;

    const signal = await this.createSignal({
      type: "WHALE_MOVE", pair, severity: amountUsd > WHALE_USD * 10 ? "CRITICAL" : "HIGH",
      confidence: 0.95, price, volume: amountUsd,
      description: `Whale ${side} ${amountUsd.toLocaleString()} USD on ${pair}`,
      metadata: { side, address, exchange, txHash },
    });

    const whale = await WhaleActivity.create({
      source: source ?? (address ? "blockchain" : "exchange"),
      pair, side: side ?? "unknown", amountUsd, price,
      address: address ?? null, exchange: exchange ?? null, txHash: txHash ?? null,
      impactPct: _estimateImpact(amountUsd),
      signalId: signal?._id ?? null, metadata,
    });

    this._stats.whales++;
    this.emit("whale", whale.toObject());
    return whale.toObject();
  }

  // ── Scanning ──────────────────────────────────────────────────────────────────

  async _scan() {
    this._stats.scans++;
    const pairs = Array.from(this._windows.keys());
    for (const pair of pairs) {
      try {
        await this._scanPair(pair);
      } catch (err) {
        this._stats.errors++;
        logger.error({ err: err.message, pair }, "[MIC] Pair scan error.");
      }
    }
  }

  async _scanPair(pair) {
    const w = this._windows.get(pair);
    if (!w) return;

    const signals = [];

    // 1. Volume anomaly
    if (w.volumes.length >= 3) {
      const va = anomalyDetectionEngine.detectVolumeAnomaly(
        w.volumes.map((v) => ({ volume: v }))
      );
      if (va.detected) {
        signals.push({
          type: "ANOMALY", severity: "MEDIUM", confidence: Math.min(Math.abs(va.zscore) / 5, 1),
          description: `Volume anomaly detected (z=${va.zscore.toFixed(2)})`,
          metadata: va,
        });
      }
    }

    // 2. Manipulation detection
    if (w.trades.length >= 5) {
      const manip = anomalyDetectionEngine.detectPriceManipulation(w.trades);
      if (manip.detected) {
        signals.push({
          type: "MANIPULATION", severity: "HIGH", confidence: manip.score,
          description: `Market manipulation suspected (score=${manip.score})`,
          metadata: manip,
        });
      }
    }

    // 3. Volatility forecast → circuit breaker
    if (w.prices.length >= 3) {
      const vf = anomalyDetectionEngine.forecastVolatility(w.prices);
      if (vf.volatilityPct >= CIRCUIT_BRK_PCT) {
        signals.push({
          type: "CIRCUIT_BREAKER", severity: "CRITICAL", confidence: 0.9,
          description: `Circuit breaker: volatility ${vf.volatilityPct.toFixed(2)}%`,
          metadata: vf,
        });
      }
    }

    // Save signals
    for (const s of signals) {
      await this.createSignal({ ...s, pair });
    }
  }

  // ── Signal factory ────────────────────────────────────────────────────────────

  async createSignal({ type, pair, severity = "MEDIUM", confidence, price = null, volume = null,
    direction = null, description = "", metadata = {} }) {
    try {
      const doc = await MarketSignal.create({
        type, pair, severity, confidence, price, volume, direction, description, metadata,
      });
      this._stats.signals++;
      this.emit("signal", doc.toObject());
      return doc;
    } catch (err) {
      logger.error({ err: err.message }, "[MIC] Signal create error.");
      return null;
    }
  }

  // ── Queries ────────────────────────────────────────────────────────────────────

  async getSignals({ pair, type, severity, limit = 50, skip = 0 } = {}) {
    const q = {};
    if (pair)     q.pair     = pair;
    if (type)     q.type     = type;
    if (severity) q.severity = severity;
    return MarketSignal.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  }

  async getWhaleActivity({ pair, limit = 50, skip = 0 } = {}) {
    const q = pair ? { pair } : {};
    return WhaleActivity.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  }

  getStats() {
    return {
      ...this._stats,
      running: this._started,
      trackedPairs: this._windows.size,
    };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _estimateImpact(usdAmount) {
  // Rough heuristic: each $100k moves price ~0.01%
  return +(usdAmount / 100000 * 0.01).toFixed(4);
}

export const marketIntelligenceCore = new MarketIntelligenceCore();
