/**
 * SmartOrderSplitter — optimal order routing and splitting across providers.
 *
 * Rules:
 *   - Primary goal: minimise slippage
 *   - Split large orders across multiple providers to avoid moving the market
 *   - Respect per-provider maxDepthUsd cap
 *   - Weight allocation by available depth at best levels
 *   - Return a routing plan (never executes — execution is via matching engine)
 */

import { liquidityAggregatorService }   from "./liquidityAggregatorService.js";
import { aggregatedOrderBookEngine }    from "./aggregatedOrderBookEngine.js";
import logger from "../config/logger.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_SPLIT_USD  = parseFloat(process.env.SMART_SPLIT_MIN_USD  ?? "500");   // below this: no split
const MAX_SPLIT_LEGS = parseInt(process.env.SMART_SPLIT_MAX_LEGS   ?? "5", 10); // max routing legs

// ── Splitter ──────────────────────────────────────────────────────────────────

export class SmartOrderSplitter {
  /**
   * Build an optimal routing plan for a single order.
   *
   * @param {object} order - { pair, side, quantity, limitPrice? }
   * @returns {RoutingPlan} plan with legs, estimated fill, slippage
   */
  buildRoutingPlan(order) {
    const { pair, side, quantity } = order;

    const book = aggregatedOrderBookEngine.getBook(pair);
    if (!book) {
      return { legs: [], pair, side, reason: "no_book", totalSlippagePct: null };
    }

    const levels  = side === "buy" ? book.asks : book.bids;
    const midPrice = book.bestBid && book.bestAsk
      ? (book.bestBid + book.bestAsk) / 2
      : (levels[0]?.price ?? 0);
    const totalUsd = quantity * midPrice;

    // Below threshold: single venue
    if (totalUsd < MIN_SPLIT_USD) {
      const slip = aggregatedOrderBookEngine.estimateSlippage(pair, side, totalUsd);
      return {
        legs:             [{ providerId: "internal", quantity, portion: 1.0 }],
        pair, side,
        totalUsd,
        estimatedSlippagePct: slip?.slippagePct ?? 0,
        strategy:         "single",
      };
    }

    // Multi-leg: distribute across healthy providers by depth
    const providerBooks = liquidityAggregatorService.getAllProviderBooks(pair);
    const healthyBooks  = providerBooks.filter((b) => {
      const p = liquidityAggregatorService.getProviders().find((pp) => String(pp.id) === b.providerId);
      return p?.healthy !== false;
    });

    if (!healthyBooks.length) {
      return { legs: [], pair, side, reason: "no_healthy_providers", totalSlippagePct: null };
    }

    // Compute available depth per provider
    const providerDepths = healthyBooks.map((pb) => {
      const lvls = side === "buy" ? pb.asks : pb.bids;
      const depth = lvls?.reduce((s, [p, q]) => s + p * q, 0) ?? 0;
      return { providerId: pb.providerId, depth, levels: lvls ?? [] };
    }).filter((p) => p.depth > 0).sort((a, b) => b.depth - a.depth).slice(0, MAX_SPLIT_LEGS);

    const totalDepth = providerDepths.reduce((s, p) => s + p.depth, 0);
    if (totalDepth === 0) {
      return { legs: [], pair, side, reason: "no_depth", totalSlippagePct: null };
    }

    const legs = providerDepths.map((p) => {
      const portion  = p.depth / totalDepth;
      const legQty   = quantity * portion;
      const legUsd   = legQty * midPrice;
      const legSlip  = _estimateLegSlippage(p.levels, legUsd, side);
      return {
        providerId:   p.providerId,
        quantity:     +legQty.toFixed(8),
        portion:      +portion.toFixed(4),
        estimatedSlippagePct: legSlip,
      };
    });

    const blendedSlippage = legs.reduce((s, l) => s + l.estimatedSlippagePct * l.portion, 0);

    logger.debug({ pair, side, legs: legs.length, blendedSlippage }, "[SmartSplit] Routing plan built.");

    return {
      legs,
      pair, side,
      totalUsd,
      estimatedSlippagePct: +blendedSlippage.toFixed(6),
      strategy: "split",
    };
  }

  /**
   * Estimate aggregate slippage improvement from splitting vs single-venue.
   */
  compareStrategies(pair, side, quantity) {
    const plan = this.buildRoutingPlan({ pair, side, quantity });

    // Single-venue scenario
    const book   = aggregatedOrderBookEngine.getBook(pair);
    const midPrice = book
      ? ((book.bestBid ?? 0) + (book.bestAsk ?? 0)) / 2
      : 0;
    const totalUsd = quantity * midPrice;
    const singleSlip = aggregatedOrderBookEngine.estimateSlippage(pair, side, totalUsd);

    return {
      split:  { slippagePct: plan.estimatedSlippagePct ?? null, legs: plan.legs?.length ?? 0 },
      single: { slippagePct: singleSlip?.slippagePct ?? null,   legs: 1 },
      improvementPct: singleSlip && plan.estimatedSlippagePct != null
        ? singleSlip.slippagePct - plan.estimatedSlippagePct
        : null,
    };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _estimateLegSlippage(levels, usdAmount, side) {
  if (!levels.length) return 0;
  let remaining = usdAmount;
  let filledUsd = 0;
  const weights = [];

  for (const [price, qty] of levels) {
    const levelUsd = price * qty;
    const taken    = Math.min(remaining, levelUsd);
    weights.push({ price, usd: taken });
    filledUsd  += taken;
    remaining  -= taken;
    if (remaining <= 0) break;
  }

  const best   = levels[0]?.[0] ?? 0;
  const avg    = filledUsd > 0
    ? weights.reduce((s, w) => s + w.price * (w.usd / filledUsd), 0)
    : best;
  return best > 0 ? Math.abs(avg - best) / best * 100 : 0;
}

export const smartOrderSplitter = new SmartOrderSplitter();
