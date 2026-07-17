/**
 * AggregatedOrderBookEngine — merges raw provider books into a unified view.
 *
 * Merging rules:
 *   1. Aggregate all bids / asks across providers at the same price level
 *   2. Sort bids descending, asks ascending
 *   3. Trim to MAX_LEVELS per side
 *   4. Compute spread, depth imbalance, and estimated slippage
 *
 * Slippage is the primary quality metric (Stage 26 rule).
 */

import AggregatedBook           from "../models/AggregatedBook.js";
import { liquidityAggregatorService } from "./liquidityAggregatorService.js";
import logger                   from "../config/logger.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_LEVELS        = parseInt(process.env.AGG_BOOK_LEVELS ?? "20", 10);
const SNAPSHOT_INTERVAL = parseInt(process.env.AGG_BOOK_SNAPSHOT_MS ?? "60000", 10);

// ── Engine ────────────────────────────────────────────────────────────────────

export class AggregatedOrderBookEngine {
  constructor() {
    this._books          = new Map();   // pair → { bids, asks, bestBid, bestAsk, ... }
    this._snapshotTimer  = null;
    this._started        = false;
  }

  start() {
    if (this._started) return;
    this._started = true;
    liquidityAggregatorService.on("updated", () => this._rebuildAll());
    this._snapshotTimer = setInterval(() => this._saveSnapshots().catch((e) =>
      logger.error({ err: e.message }, "[AggBook] Snapshot error.")
    ), SNAPSHOT_INTERVAL);
    logger.info("[AggBook] Aggregated order book engine started.");
  }

  stop() {
    if (this._snapshotTimer) { clearInterval(this._snapshotTimer); this._snapshotTimer = null; }
    liquidityAggregatorService.removeAllListeners("updated");
    this._started = false;
    logger.info("[AggBook] Aggregated order book engine stopped.");
  }

  // ── Public read API ────────────────────────────────────────────────────────

  getBook(pair) { return this._books.get(pair) ?? null; }

  getAllPairs() { return Array.from(this._books.keys()); }

  getBestBidAsk(pair) {
    const book = this._books.get(pair);
    if (!book) return null;
    return { bestBid: book.bestBid, bestAsk: book.bestAsk, spreadPct: book.spreadPct, pair };
  }

  estimateSlippage(pair, side, usdAmount) {
    const book = this._books.get(pair);
    if (!book) return null;
    const levels = side === "buy" ? book.asks : book.bids;
    return _walkBook(levels, usdAmount, side);
  }

  // ── Merge logic ────────────────────────────────────────────────────────────

  mergeBooks(providerBooks) {
    if (!providerBooks.length) return null;

    const bidMap = new Map();   // price → { quantity, providers }
    const askMap = new Map();

    for (const { providerId, bids = [], asks = [] } of providerBooks) {
      for (const [price, qty] of bids) {
        const key = String(price);
        const existing = bidMap.get(key) ?? { price, quantity: 0, providers: [] };
        existing.quantity   += qty;
        existing.providers.push(providerId);
        bidMap.set(key, existing);
      }
      for (const [price, qty] of asks) {
        const key = String(price);
        const existing = askMap.get(key) ?? { price, quantity: 0, providers: [] };
        existing.quantity   += qty;
        existing.providers.push(providerId);
        askMap.set(key, existing);
      }
    }

    const bids = Array.from(bidMap.values()).sort((a, b) => b.price - a.price).slice(0, MAX_LEVELS);
    const asks = Array.from(askMap.values()).sort((a, b) => a.price - b.price).slice(0, MAX_LEVELS);

    const bestBid = bids[0]?.price ?? null;
    const bestAsk = asks[0]?.price ?? null;
    const spreadPct = bestBid && bestAsk ? ((bestAsk - bestBid) / bestBid) * 100 : null;
    const totalBidDepth = bids.reduce((s, l) => s + l.price * l.quantity, 0);
    const totalAskDepth = asks.reduce((s, l) => s + l.price * l.quantity, 0);
    const providerCount = new Set(providerBooks.map((b) => b.providerId)).size;

    return { bids, asks, bestBid, bestAsk, spreadPct, totalBidDepth, totalAskDepth, providerCount };
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  _rebuildAll() {
    // Build directly from aggregator
    this._rebuildFromAggregator();
  }

  _rebuildFromAggregator() {
    // Collect all pairs across all providers
    const pairSet = new Set();
    const providers = liquidityAggregatorService.getProviders();
    for (const p of providers) {
      for (const pair of (p.pairs ?? [])) pairSet.add(pair);
    }

    for (const pair of pairSet) {
      const rawBooks = liquidityAggregatorService.getAllProviderBooks(pair);
      if (!rawBooks.length) continue;
      const merged = this.mergeBooks(rawBooks);
      if (merged) this._books.set(pair, { ...merged, pair, updatedAt: Date.now() });
    }
  }

  async _saveSnapshots() {
    const pairs = Array.from(this._books.keys());
    const now   = new Date();
    const docs  = pairs.map((pair) => {
      const book = this._books.get(pair);
      return { ...book, timestamp: now };
    });
    if (!docs.length) return;
    await AggregatedBook.insertMany(docs, { ordered: false }).catch((e) =>
      logger.error({ err: e.message }, "[AggBook] Snapshot save error.")
    );
  }
}

// ── Walk the book to estimate slippage ────────────────────────────────────────

function _walkBook(levels, usdAmount, side) {
  if (!levels.length) return null;
  let remaining = usdAmount;
  let filledUsd = 0;
  const weightedPrices = [];

  for (const level of levels) {
    const levelUsd = level.price * level.quantity;
    const taken    = Math.min(remaining, levelUsd);
    filledUsd += taken;
    weightedPrices.push({ price: level.price, usd: taken });
    remaining -= taken;
    if (remaining <= 0) break;
  }

  const bestPrice     = levels[0]?.price ?? 0;
  const avgFillPrice  = filledUsd > 0
    ? weightedPrices.reduce((s, w) => s + w.price * (w.usd / filledUsd), 0)
    : bestPrice;
  const slippagePct   = bestPrice > 0 ? Math.abs(avgFillPrice - bestPrice) / bestPrice * 100 : 0;
  const unfilled      = remaining;

  return { avgFillPrice, slippagePct, filledUsd, unfilled, bestPrice, side };
}

export const aggregatedOrderBookEngine = new AggregatedOrderBookEngine();
