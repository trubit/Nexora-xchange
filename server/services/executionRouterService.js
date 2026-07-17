/**
 * ExecutionRouterService — Smart Order Routing (SOR) engine.
 *
 * Responsibilities:
 *   - Build optimal execution routes from aggregated liquidity data
 *   - Minimize slippage via multi-venue splitting (delegates to SmartOrderSplitter)
 *   - Track per-venue latency and route around slow venues
 *   - Simulate partial execution for large orders (TWAP / iceberg)
 *   - Record all routing decisions in ExecutionRoute for audit
 *
 * Rule: MUST NOT modify the matching engine — only produces routing plans
 *       and records decisions. Actual order placement uses existing order APIs.
 */

import { EventEmitter }        from "events";
import ExecutionRoute          from "../models/ExecutionRoute.js";
import { smartOrderSplitter }  from "./smartOrderSplitter.js";
import { aggregatedOrderBookEngine } from "./aggregatedOrderBookEngine.js";
import logger                  from "../config/logger.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const TWAP_MIN_QTY_USD  = parseFloat(process.env.TWAP_MIN_USD   ?? "10000");
const ICEBERG_MIN_QTY   = parseFloat(process.env.ICEBERG_MIN_QTY ?? "100");
const LATENCY_WINDOW    = parseInt(process.env.LATENCY_WINDOW    ?? "20", 10);  // samples
const LATENCY_THRESHOLD = parseInt(process.env.LATENCY_MS_LIMIT  ?? "500", 10); // ms

// ── Latency tracker (in-memory per venue) ─────────────────────────────────────

class LatencyTracker {
  constructor() { this._venues = new Map(); }

  record(venue, latencyMs) {
    if (!this._venues.has(venue)) this._venues.set(venue, []);
    const samples = this._venues.get(venue);
    samples.push(latencyMs);
    if (samples.length > LATENCY_WINDOW) samples.shift();
  }

  avgLatency(venue) {
    const s = this._venues.get(venue);
    if (!s?.length) return null;
    return s.reduce((a, b) => a + b, 0) / s.length;
  }

  isSlow(venue) {
    const avg = this.avgLatency(venue);
    return avg !== null && avg > LATENCY_THRESHOLD;
  }

  getAll() {
    const out = {};
    for (const [v, s] of this._venues) {
      out[v] = { avg: s.reduce((a, b) => a + b, 0) / s.length, samples: s.length };
    }
    return out;
  }
}

// ── Main service ──────────────────────────────────────────────────────────────

export class ExecutionRouterService extends EventEmitter {
  constructor() {
    super();
    this._latency = new LatencyTracker();
    this._stats   = { routesPlanned: 0, routesExecuted: 0, slippageSaved: 0, errors: 0 };
  }

  // ── Routing ────────────────────────────────────────────────────────────────────

  /**
   * Plan an execution route for an order.
   * Selects between single, split, TWAP, or iceberg strategy.
   *
   * @param {{ pair, side, quantity, limitPrice?, userId?, orderId? }} order
   * @returns {ExecutionRoute} persisted route record
   */
  async planRoute(order) {
    const { pair, side, quantity, userId = null, orderId = null, limitPrice = null } = order;
    const startMs = Date.now();

    const book  = aggregatedOrderBookEngine.getBook(pair);
    const midPrice = book
      ? ((book.bestBid ?? 0) + (book.bestAsk ?? 0)) / 2
      : (limitPrice ?? 0);
    const totalUsd = quantity * midPrice;

    // Select strategy
    const strategy = _selectStrategy(totalUsd, quantity);

    let legs = [];
    let estimatedSlippage = null;

    if (strategy === "split") {
      const plan = smartOrderSplitter.buildRoutingPlan({ pair, side, quantity });
      legs             = plan.legs.map((l) => ({
        venue:    l.providerId,
        side,
        quantity: l.quantity,
        status:   "pending",
      }));
      estimatedSlippage = plan.estimatedSlippagePct;
    } else if (strategy === "twap") {
      legs = this._buildTwapLegs(pair, side, quantity, 5);
      estimatedSlippage = null;
    } else if (strategy === "iceberg") {
      legs = this._buildIcebergLegs(pair, side, quantity);
    } else {
      // single venue
      const slip = aggregatedOrderBookEngine.estimateSlippage(pair, side, totalUsd);
      legs = [{ venue: "internal", side, quantity, status: "pending" }];
      estimatedSlippage = slip?.slippagePct ?? null;
    }

    // Filter out slow venues
    legs = legs.filter((l) => !this._latency.isSlow(l.venue));
    if (!legs.length) {
      legs = [{ venue: "internal", side, quantity, status: "pending" }];
    }

    const routingMs = Date.now() - startMs;

    const route = await ExecutionRoute.create({
      orderId, userId, pair, side,
      totalQuantity: quantity,
      strategy,
      legs,
      estimatedSlippagePct: estimatedSlippage,
      routingLatencyMs:     routingMs,
      status: "planned",
    });

    this._stats.routesPlanned++;
    logger.debug({ pair, side, strategy, legs: legs.length, routingMs }, "[Router] Route planned.");
    this.emit("planned", route.toObject());
    return route.toObject();
  }

  /**
   * Record the outcome of an execution (called by order-fill handler).
   */
  async recordOutcome(routeId, { filledQuantity, averageFillPrice, latencyMs }) {
    const route = await ExecutionRoute.findById(routeId);
    if (!route) return null;

    const midPrice = averageFillPrice ?? 0;
    let actualSlippage = null;

    if (route.estimatedSlippagePct != null && route.legs.length) {
      const firstVenuePrice = route.legs[0]?.price ?? averageFillPrice;
      actualSlippage = firstVenuePrice > 0
        ? Math.abs(averageFillPrice - firstVenuePrice) / firstVenuePrice * 100
        : 0;
      const saved = (route.estimatedSlippagePct - actualSlippage) * route.totalQuantity * midPrice / 100;
      if (saved > 0) this._stats.slippageSaved += saved;
    }

    route.filledQuantity    = filledQuantity;
    route.averageFillPrice  = averageFillPrice;
    route.actualSlippagePct = actualSlippage;
    route.totalLatencyMs    = latencyMs;
    route.status            = filledQuantity >= route.totalQuantity ? "completed" : "partial";
    await route.save();

    this._stats.routesExecuted++;
    this.emit("completed", route.toObject());
    return route.toObject();
  }

  /** Record per-venue latency measurement. */
  recordLatency(venue, latencyMs) {
    this._latency.record(venue, latencyMs);
  }

  getLatencyReport() { return this._latency.getAll(); }

  getStats() { return { ...this._stats }; }

  async getRouteHistory({ userId, pair, status, limit = 50, skip = 0 } = {}) {
    const q = {};
    if (userId) q.userId = userId;
    if (pair)   q.pair   = pair;
    if (status) q.status = status;
    return ExecutionRoute.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  }

  // ── TWAP / Iceberg builders ────────────────────────────────────────────────────

  _buildTwapLegs(pair, side, quantity, slices) {
    const sliceQty = quantity / slices;
    return Array.from({ length: slices }, (_, i) => ({
      venue:    "internal",
      side,
      quantity: +sliceQty.toFixed(8),
      status:   "pending",
    }));
  }

  _buildIcebergLegs(pair, side, quantity) {
    const visiblePct = 0.1;   // show only 10% at a time
    const visible    = quantity * visiblePct;
    const count      = Math.ceil(quantity / visible);
    return Array.from({ length: count }, () => ({
      venue:    "internal",
      side,
      quantity: +visible.toFixed(8),
      status:   "pending",
    }));
  }
}

// ── Strategy selector ─────────────────────────────────────────────────────────

function _selectStrategy(totalUsd, quantity) {
  if (totalUsd >= TWAP_MIN_QTY_USD)  return "twap";
  if (quantity >= ICEBERG_MIN_QTY)   return "iceberg";
  if (totalUsd >= 500)               return "split";
  return "single";
}

export const executionRouterService = new ExecutionRouterService();
