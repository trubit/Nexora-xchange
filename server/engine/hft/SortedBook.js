/**
 * SortedBook — sorted price-level structure for one side (bids or asks).
 *
 * Complexity guarantees:
 *   best()         — O(1)      → first element, always in sorted position
 *   getOrCreate()  — O(log n)  → binary search + splice
 *   getLevel()     — O(log n)  → binary search
 *   removeLevel()  — O(log n)  → binary search + splice
 *   topN()         — O(k)      → slice already-sorted array (no sort needed)
 *
 * vs original OrderBook (Map + Math.max/min spread):
 *   best()         was O(n)    — now O(1)
 *   snapshot sort  was O(n log n) each call — now O(k) slice
 *
 * Trade-off: splice on insert is O(n) in the worst case when levels are
 * densely distributed. In practice order books have few distinct price
 * levels in the top 20-50 levels, so n is small and cache locality of
 * the array beats a balanced BST for typical crypto book depths.
 */

export class SortedBook {
  /**
   * @param {boolean} ascending  true = asks (low→high), false = bids (high→low)
   */
  constructor(ascending) {
    this._asc    = ascending;
    this._levels = []; // [{price: number, orders: Order[]}]  pre-sorted
  }

  // ── Private binary search ────────────────────────────────────────────────────

  /**
   * Returns the index where `price` is (or would be inserted).
   * Ascending  mode: levels grow left→right, small prices first.
   * Descending mode: levels grow left→right, large prices first.
   */
  _search(price) {
    let lo = 0;
    let hi = this._levels.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      const cmp = this._levels[mid].price;
      if (this._asc ? cmp < price : cmp > price) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo;
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /** O(log n) — returns the existing level or creates and inserts a new one. */
  getOrCreate(price) {
    const idx = this._search(price);
    if (idx < this._levels.length && this._levels[idx].price === price) {
      return this._levels[idx];
    }
    const level = { price, orders: [] };
    this._levels.splice(idx, 0, level);
    return level;
  }

  /** O(log n) — returns level or null. */
  getLevel(price) {
    const idx = this._search(price);
    return idx < this._levels.length && this._levels[idx].price === price
      ? this._levels[idx]
      : null;
  }

  /** O(log n) — removes an empty level from the sorted array. */
  removeLevel(price) {
    const idx = this._search(price);
    if (idx < this._levels.length && this._levels[idx].price === price) {
      this._levels.splice(idx, 1);
    }
  }

  /** O(1) — best-priced level (lowest ask / highest bid). */
  best() {
    return this._levels.length > 0 ? this._levels[0] : null;
  }

  /** O(k) — top k levels already in sorted order; no allocation beyond slice. */
  topN(n) {
    return this._levels.slice(0, n);
  }

  get size() { return this._levels.length; }

  /** Total order count across all levels (used for status reporting only). */
  totalOrders() {
    let n = 0;
    for (const lvl of this._levels) n += lvl.orders.length;
    return n;
  }
}
