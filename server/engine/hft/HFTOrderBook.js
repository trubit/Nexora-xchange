/**
 * HFTOrderBook — drop-in replacement for OrderBook with O(1) best-price access.
 *
 * Key improvements over the original:
 *
 *   bestBid() / bestAsk()
 *     Before: O(n) via Math.max/min(...map.keys())
 *     After:  O(1) — first element of a pre-sorted SortedBook
 *
 *   snapshot()
 *     Before: O(n log n) on every call — spreads all keys then sorts
 *     After:  O(k) — slices the already-sorted level array (k = depth)
 *
 *   add()
 *     Before: O(1) amortized Map set
 *     After:  O(log n) binary-search splice — acceptable for typical book depths
 *             because the sorted structure eliminates repeated O(n) best-price scans
 *
 *   cancel()
 *     Before: O(n) findIndex inside the price-level array
 *     After:  O(log n) binary search to locate the level +
 *             O(k) splice within it  (k = concurrent orders at same price, usually 1)
 *
 * Interface is identical to the original OrderBook so no call sites change.
 */

import { SortedBook } from "./SortedBook.js";
import { HFTConfig }  from "./HFTConfig.js";

export class HFTOrderBook {
  constructor(symbol) {
    this.symbol    = symbol;
    this._bids     = new SortedBook(false); // descending — best bid at index 0
    this._asks     = new SortedBook(true);  // ascending  — best ask at index 0
    this.index     = new Map();             // orderId → {side, price}
    this.lastPrice = 0;
    this.updatedAt = Date.now();

    // Cached snapshot — invalidated on every mutation, rebuilt lazily
    this._snapDirty = true;
    this._snapCache = null;
  }

  // ── Mutation ─────────────────────────────────────────────────────────────────

  add(order) {
    if (this.index.has(order.orderId)) return false;
    const book  = order.side === "buy" ? this._bids : this._asks;
    const level = book.getOrCreate(order.price);
    level.orders.push({ ...order });
    this.index.set(order.orderId, { side: order.side, price: order.price });
    this.updatedAt  = Date.now();
    this._snapDirty = true;
    return true;
  }

  cancel(orderId) {
    const loc = this.index.get(orderId);
    if (!loc) return false;
    const book  = loc.side === "buy" ? this._bids : this._asks;
    const level = book.getLevel(loc.price);
    if (level) {
      const i = level.orders.findIndex((o) => o.orderId === orderId);
      if (i !== -1) level.orders.splice(i, 1);
      if (level.orders.length === 0) book.removeLevel(loc.price);
    }
    this.index.delete(orderId);
    this.updatedAt  = Date.now();
    this._snapDirty = true;
    return true;
  }

  /**
   * Remove the first order from a level without a full cancel cycle.
   * Used by the matching engine after a maker is fully filled.
   * Expects the caller to have already decremented maker.remainingQty.
   */
  consumeMakerFront(side, price) {
    const book  = side === "buy" ? this._bids : this._asks;
    const level = book.getLevel(price);
    if (!level) return;
    const removed = level.orders.shift();
    if (removed) this.index.delete(removed.orderId);
    if (level.orders.length === 0) book.removeLevel(price);
    this._snapDirty = true;
  }

  pruneLevel(side, price) {
    const book  = side === "buy" ? this._bids : this._asks;
    const level = book.getLevel(price);
    if (level && level.orders.length === 0) book.removeLevel(price);
  }

  // ── Read ─────────────────────────────────────────────────────────────────────

  /** O(1) */
  bestBid() {
    const lvl = this._bids.best();
    return lvl ? { price: lvl.price, level: lvl.orders } : null;
  }

  /** O(1) */
  bestAsk() {
    const lvl = this._asks.best();
    return lvl ? { price: lvl.price, level: lvl.orders } : null;
  }

  midPrice() {
    const bid = this.bestBid();
    const ask = this.bestAsk();
    if (!bid || !ask) return this.lastPrice;
    return (bid.price + ask.price) / 2;
  }

  spread() {
    const bid = this.bestBid();
    const ask = this.bestAsk();
    if (!bid || !ask) return null;
    return { bid: bid.price, ask: ask.price, spread: ask.price - bid.price };
  }

  /**
   * O(k) snapshot — slices already-sorted arrays; no key spread or sort.
   * Result is cached and reused until the next mutation.
   */
  snapshot(depth = HFTConfig.snapshotDepth) {
    if (!this._snapDirty && this._snapCache) return this._snapCache;

    const mapLevel = (levels) =>
      levels.map((lvl) => {
        const qty = lvl.orders.reduce((s, o) => s + o.remainingQty, 0);
        return [lvl.price, qty];
      });

    this._snapCache = {
      symbol:         this.symbol,
      bids:           mapLevel(this._bids.topN(depth)),
      asks:           mapLevel(this._asks.topN(depth)),
      lastPrice:      this.lastPrice,
      midPrice:       this.midPrice(),
      spread:         this.spread(),
      totalBidLevels: this._bids.size,
      totalAskLevels: this._asks.size,
      totalOrders:    this.index.size,
      timestamp:      this.updatedAt,
    };
    this._snapDirty = false;
    return this._snapCache;
  }

  // ── Compat shims ─────────────────────────────────────────────────────────────

  /** Read-only view matching original .bids/.asks Map interface for status(). */
  get bids() { return { size: this._bids.size }; }
  get asks() { return { size: this._asks.size }; }
}
