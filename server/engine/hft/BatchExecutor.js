/**
 * BatchExecutor — bulk-flush trade fills to MongoDB in a single round-trip set.
 *
 * The matching engine collects PendingFill objects during a fully synchronous
 * in-memory match loop (no DB access on the critical path). Once the match
 * is complete this class persists everything in three bulk operations:
 *
 *   1. ExecutedTrade.insertMany()   — one round trip for all trade records
 *   2. Order.bulkWrite()            — one round trip for all order status updates
 *                                     (aggregated per orderId — no read before write)
 *   3. Wallet.bulkWrite()           — one round trip for all wallet credit/debit ops
 *                                     (aggregated per (userId, asset) pair)
 *   4. Transaction.insertMany()     — fire-and-forget ledger entries (best-effort)
 *
 * DB round trips per trade batch:  3–4  (was: 5 × numTrades)
 * DB round trips per single trade: 5 originally → 3–4 total for the whole batch
 *
 * PendingFill shape:
 * {
 *   tradeId, symbol, baseAsset, quoteAsset,
 *   price, quantity, quoteAmount,
 *   buyOrderId, sellOrderId, buyUserId, sellUserId, buyLimitPrice,
 *   takerSide, executedAt: Date,
 *   makerSide, makerPrice (for wallet excess calc)
 * }
 */

import ExecutedTrade from "../../models/ExecutedTrade.js";
import Order         from "../../models/Order.js";
import Wallet        from "../../models/Wallet.js";
import Transaction   from "../../models/Transaction.js";
import { QUOTE_ASSETS } from "../../config/supportedAssets.js";
import { HFTConfig } from "./HFTConfig.js";
import { hftMetrics } from "./metrics.js";

const EPSILON = 1e-10;

// ── Symbol parsing (mirrors TradeExecutor) ────────────────────────────────────

const _sorted = [...QUOTE_ASSETS].sort((a, b) => b.length - a.length);

export function parseSymbol(symbol) {
  for (const q of _sorted) {
    if (symbol.endsWith(q)) return { baseAsset: symbol.slice(0, -q.length), quoteAsset: q };
  }
  return { baseAsset: symbol.slice(0, -4), quoteAsset: symbol.slice(-4) };
}

// ── Sequential trade-ID generator (same scheme as TradeExecutor) ──────────────

// Separate counter from TradeExecutor._seq — the two engines are mutually exclusive
// (HFT_ENABLED flag), so IDs from each path never interleave at runtime.
let _hftSeq = 0;
export function genTradeId() {
  return `TRD-${Date.now()}-${String(++_hftSeq).padStart(5, "0")}`;
}

// ── BatchExecutor ─────────────────────────────────────────────────────────────

export class BatchExecutor {
  constructor() {
    this._flushInFlight = 0;
  }

  /**
   * Persist a batch of fills to the DB.
   * Called asynchronously — never on the matching critical path.
   *
   * @param {PendingFill[]} fills
   */
  async flush(fills) {
    if (!fills.length || !HFTConfig.persistTrades) return;

    const t0 = hftMetrics.start();

    try {
      await Promise.all([
        this._persistTrades(fills),
        this._updateOrders(fills),
        this._settleWallets(fills),
      ]);
      // Fire-and-forget ledger — never blocks flush completion
      this._writeLedger(fills).catch((err) =>
        console.error("[HFT:batch] Ledger write failed:", err.message)
      );
    } catch (err) {
      console.error("[HFT:batch] Flush error:", err.message);
    } finally {
      hftMetrics.record("db_flush", t0);
    }
  }

  // ── Step 1 — trade records ────────────────────────────────────────────────

  async _persistTrades(fills) {
    const docs = fills.map((f) => ({
      tradeId:    f.tradeId,
      symbol:     f.symbol,
      baseAsset:  f.baseAsset,
      quoteAsset: f.quoteAsset,
      price:      f.price,
      quantity:   f.quantity,
      quoteAmount:f.quoteAmount,
      buyOrderId: f.buyOrderId,
      sellOrderId:f.sellOrderId,
      buyUserId:  f.buyUserId,
      sellUserId: f.sellUserId,
      takerSide:  f.takerSide,
      executedAt: f.executedAt,
    }));
    await ExecutedTrade.insertMany(docs, { ordered: false });
  }

  // ── Step 2 — order updates ────────────────────────────────────────────────

  async _updateOrders(fills) {
    // Aggregate fills by orderId — multiple partial fills for the same order
    // in one batch are merged into a single bulkWrite operation.
    const orderMap = new Map(); // orderId → { totalFillQty, priceAcc, prevAvg }

    for (const f of fills) {
      for (const [oid, qty, prc] of [
        [f.buyOrderId,  f.quantity, f.price],
        [f.sellOrderId, f.quantity, f.price],
      ]) {
        if (!orderMap.has(oid)) orderMap.set(oid, { totalFillQty: 0, weightedPrice: 0 });
        const entry = orderMap.get(oid);
        entry.weightedPrice =
          (entry.weightedPrice * entry.totalFillQty + prc * qty) /
          (entry.totalFillQty + qty);
        entry.totalFillQty += qty;
      }
    }

    if (!orderMap.size) return;

    // Fetch current order state in one batch query
    const orderIds = [...orderMap.keys()];
    const orders   = await Order.find(
      { _id: { $in: orderIds } },
      { _id: 1, amount: 1, filledAmount: 1, averagePrice: 1, remainingAmount: 1 }
    ).lean();

    const ops = orders.map((o) => {
      const entry      = orderMap.get(String(o._id));
      const prevFilled = o.filledAmount || 0;
      const newFilled  = prevFilled + entry.totalFillQty;
      const avgPrice   =
        ((o.averagePrice || 0) * prevFilled + entry.weightedPrice * entry.totalFillQty) /
        newFilled;
      const isFull     = newFilled >= o.amount - EPSILON;

      return {
        updateOne: {
          filter: { _id: o._id },
          update: {
            $set: {
              filledAmount:    newFilled,
              remainingAmount: Math.max(0, (o.remainingAmount ?? o.amount) - entry.totalFillQty),
              averagePrice:    avgPrice,
              status:          isFull ? "filled" : "partially_filled",
            },
          },
        },
      };
    });

    if (ops.length) await Order.bulkWrite(ops, { ordered: false });
  }

  // ── Step 3 — wallet settlement ────────────────────────────────────────────

  async _settleWallets(fills) {
    // Aggregate all debits/credits by (userId, asset) before writing.
    // Key format: `${userId}:${asset}`
    const credits  = new Map(); // key → amount
    const debits   = new Map(); // key → amount
    const lockedOp = new Map(); // key → { locked: delta, balance: delta }

    const addTo = (m, key, amount) => m.set(key, (m.get(key) ?? 0) + amount);
    const walletKey = (userId, asset) => `${userId}:${asset}`;

    for (const f of fills) {
      const { baseAsset, quoteAsset, buyUserId, sellUserId,
              price, quantity, quoteAmount, buyLimitPrice } = f;

      const lockedPerUnit = buyLimitPrice ?? price;
      const lockedCost    = lockedPerUnit * quantity;
      const excess        = Math.max(0, lockedCost - quoteAmount);

      // Buyer: debit locked quote (balance was already reserved), credit base
      const bBuyQuote = walletKey(buyUserId, quoteAsset);
      addTo(lockedOp, bBuyQuote + ":locked",   -lockedCost);
      addTo(lockedOp, bBuyQuote + ":balance",  -quoteAmount);
      if (excess > EPSILON) addTo(credits, walletKey(buyUserId, quoteAsset) + ":available", excess);
      addTo(credits, walletKey(buyUserId, baseAsset) + ":available", quantity);
      addTo(credits, walletKey(buyUserId, baseAsset) + ":balance",   quantity);

      // Seller: debit locked base, credit quote
      addTo(lockedOp, walletKey(sellUserId, baseAsset) + ":locked",  -quantity);
      addTo(lockedOp, walletKey(sellUserId, baseAsset) + ":balance", -quantity);
      addTo(credits, walletKey(sellUserId, quoteAsset) + ":available", quoteAmount);
      addTo(credits, walletKey(sellUserId, quoteAsset) + ":balance",   quoteAmount);
    }

    // Build bulkWrite operations
    const ops = [];

    // Merge locked + balance ops
    const lockBalMap = new Map();
    for (const [key, delta] of lockedOp) {
      const colonIdx  = key.lastIndexOf(":");
      const walKey    = key.slice(0, colonIdx);
      const field     = key.slice(colonIdx + 1);
      const [uid, ast] = walKey.split(":");
      const mk        = walletKey(uid, ast);
      if (!lockBalMap.has(mk)) lockBalMap.set(mk, { userId: uid, asset: ast, inc: {} });
      lockBalMap.get(mk).inc[field] = (lockBalMap.get(mk).inc[field] ?? 0) + delta;
    }
    for (const [, { userId, asset, inc }] of lockBalMap) {
      ops.push({
        updateOne: {
          filter: { user: userId, asset },
          update: { $inc: inc },
        },
      });
    }

    // Credit operations
    const creditMap = new Map();
    for (const [key, amount] of credits) {
      const colonIdx  = key.lastIndexOf(":");
      const walKey    = key.slice(0, colonIdx);
      const field     = key.slice(colonIdx + 1);
      const [uid, ast] = walKey.split(":");
      const mk        = walletKey(uid, ast);
      if (!creditMap.has(mk)) creditMap.set(mk, { userId: uid, asset: ast, inc: {} });
      creditMap.get(mk).inc[field] = (creditMap.get(mk).inc[field] ?? 0) + amount;
    }
    for (const [, { userId, asset, inc }] of creditMap) {
      ops.push({
        updateOne: {
          filter: { user: userId, asset },
          update: { $inc: inc },
          upsert: true,
        },
      });
    }

    if (ops.length) await Wallet.bulkWrite(ops, { ordered: false });
  }

  // ── Step 4 — transaction ledger (fire-and-forget) ─────────────────────────

  async _writeLedger(fills) {
    const docs = [];
    for (const f of fills) {
      docs.push(
        {
          user:      f.buyUserId,
          type:      "trade",
          asset:     f.baseAsset,
          amount:    f.quantity,
          status:    "completed",
          note:      `Matched: bought ${f.quantity} ${f.baseAsset} @ ${f.price} ${f.quoteAsset}`,
          createdAt: f.executedAt,
        },
        {
          user:      f.sellUserId,
          type:      "trade",
          asset:     f.quoteAsset,
          amount:    f.quoteAmount,
          status:    "completed",
          note:      `Matched: sold ${f.quantity} ${f.baseAsset} @ ${f.price} ${f.quoteAsset}`,
          createdAt: f.executedAt,
        }
      );
    }
    if (docs.length) await Transaction.insertMany(docs, { ordered: false });
  }
}
