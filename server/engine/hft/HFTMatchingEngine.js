/**
 * HFTMatchingEngine — zero-blocking, batch-flushing drop-in for MatchingEngine.
 *
 * Architecture vs original MatchingEngine:
 *
 *   Original critical path per order:
 *     normalize → match loop → [await DB write × fills] → rest → broadcast
 *     Latency: O(fills × DB round-trip) ≈ 5–50 ms
 *
 *   HFT critical path per order:
 *     normalize → sync match loop (pure in-memory) → rest
 *     Latency: O(log n) for book ops ≈ < 1 ms
 *     Async:   fills queued → setImmediate → batch DB flush (decoupled)
 *
 * Key invariants:
 *   • All book mutations happen synchronously in _matchSync().
 *     Two concurrent orders for the same symbol never interleave book state
 *     because the OrderQueue drains each symbol's queue one item at a time
 *     before yielding to the event loop (splice-and-loop in SymbolQueue._drain).
 *   • Fills are flushed to DB asynchronously via BatchExecutor after the
 *     event loop tick that produced them — DB unavailability never stalls matching.
 *   • processOrder() returns a promise that resolves to lightweight PendingFill
 *     objects (no DB round-trips). Callers that need trade receipts get the
 *     same shape as the original execute() return value.
 *
 * Interface is identical to the original MatchingEngine:
 *   start(), stop(), hydrate(), processOrder(), processCancel(), getBook(), status()
 */

import { HFTOrderBook }     from "./HFTOrderBook.js";
import { BatchExecutor, parseSymbol, genTradeId } from "./BatchExecutor.js";
import { OrderQueueManager } from "./OrderQueue.js";
import { HFTPublisher }      from "./HFTPublisher.js";
import { HFTConfig }         from "./HFTConfig.js";
import { hftMetrics }        from "./metrics.js";

const EPSILON    = 1e-10;

export class HFTMatchingEngine {
  /**
   * @param {{ broadcaster: object }} opts
   *   broadcaster must expose emitOrderBook(symbol, snap) and emitTrade(symbol, payload)
   */
  constructor({ broadcaster }) {
    this.books       = new Map();     // symbol → HFTOrderBook
    this.broadcaster = broadcaster;
    this.running     = false;
    this._publisher  = new HFTPublisher();
    this._batchExec  = new BatchExecutor();

    this._ordersProcessed = 0;
    this._tradesExecuted  = 0;
    this._startedAt       = null;

    // Wire per-symbol queues:
    //   processFn = synchronous in-memory match (returns PendingFill[])
    //   onFills   = async batch DB flush
    this._queues = new OrderQueueManager(
      (item) => this._processSync(item),
      (fills) => this._onFills(fills),
      (err, item) =>
        console.error("[HFT:ME] Queue processing error:", err.message, item?.orderId)
    );
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  start() {
    this.running    = true;
    this._startedAt = new Date();
    console.log("[HFT:ME] HFTMatchingEngine started — HFT_ENABLED=true");
  }

  async stop() {
    this.running = false;
    await this._queues.shutdown();
    await this._publisher.drain();
    console.log("[HFT:ME] HFTMatchingEngine stopped");
  }

  // ── Book access ───────────────────────────────────────────────────────────────

  getBook(symbol) {
    const sym = String(symbol).toUpperCase();
    if (!this.books.has(sym)) this.books.set(sym, new HFTOrderBook(sym));
    return this.books.get(sym);
  }

  // ── Startup hydration ─────────────────────────────────────────────────────────

  async hydrate(orderModel) {
    const open = await orderModel
      .find({ status: { $in: ["open", "partially_filled"] } })
      .lean();

    let count = 0;
    for (const o of open) {
      const norm = this._normalize({
        orderId:   String(o._id),
        userId:    String(o.user),
        symbol:    o.symbol,
        side:      o.side,
        price:     o.price,
        amount:    o.remainingAmount ?? (o.amount - (o.filledAmount || 0)),
        createdAt: o.createdAt,
      });
      if (norm) {
        this.getBook(norm.symbol).add(norm);
        count++;
      }
    }
    console.log(`[HFT:ME] Hydrated ${count} open orders across ${this.books.size} pair(s)`);
  }

  // ── Public entry points (same interface as MatchingEngine) ─────────────────

  /**
   * Enqueue an order for processing.
   * Returns a Promise that resolves to an array of lightweight PendingFill
   * objects synchronously after the in-memory match (no DB round-trips).
   *
   * The returned fills contain all trade data needed by the caller
   * (tradeId, price, quantity, quoteAmount, executedAt).
   */
  processOrder(raw) {
    if (!this.running) return Promise.resolve([]);

    const order = this._normalize(raw);
    if (!order) return Promise.resolve([]);

    return new Promise((resolve, reject) => {
      const item = { order, resolve, reject };
      const accepted = this._queues.enqueue(order.symbol, item);
      if (!accepted) {
        reject(new Error(`[HFT:ME] Queue full for symbol ${order.symbol} — back-pressure`));
      }
    });
  }

  /**
   * Cancel an order immediately (synchronous book mutation, then broadcast).
   * Cancels bypass the queue to avoid head-of-line blocking against pending orders.
   */
  processCancel({ symbol, orderId }) {
    if (!this.running) return Promise.resolve(false);
    const sym     = String(symbol).toUpperCase();
    const book    = this.getBook(sym);
    const removed = book.cancel(String(orderId));
    if (removed) {
      const snap = book.snapshot(HFTConfig.snapshotDepth);
      this.broadcaster.emitOrderBook(sym, snap);
      this._publisher.publishOrderBook(snap);
    }
    return Promise.resolve(removed);
  }

  // ── Synchronous match (called from OrderQueue._drain, no awaits) ───────────

  /**
   * Pure in-memory match. Updates book state synchronously, returns fills.
   * No I/O of any kind — this is the latency-critical path.
   */
  _processSync({ order, resolve, reject }) {
    try {
      const t0   = hftMetrics.start();
      const book = this.getBook(order.symbol);
      const fills = this._matchSync(book, order);

      if (order.remainingQty > EPSILON) {
        book.add(order);
      }

      this._ordersProcessed++;

      const snap = book.snapshot(HFTConfig.snapshotDepth);
      this.broadcaster.emitOrderBook(order.symbol, snap);
      this._publisher.publishOrderBook(snap);

      hftMetrics.record("match", t0);

      // Resolve the caller's promise immediately with lightweight receipts
      resolve(fills.map((f) => ({
        tradeId:    f.tradeId,
        price:      f.price,
        quantity:   f.quantity,
        quoteAmount:f.quoteAmount,
        executedAt: f.executedAt,
      })));

      return fills; // returned to OrderQueue for batch flush
    } catch (err) {
      reject(err);
      return [];
    }
  }

  /**
   * Core matching loop — synchronous, no I/O, updates book in-place.
   * Returns array of PendingFill ready for BatchExecutor.flush().
   */
  _matchSync(book, order) {
    const fills = [];

    while (order.remainingQty > EPSILON) {
      const counter = order.side === "buy" ? book.bestAsk() : book.bestBid();
      if (!counter) break;

      const { price: makerPrice, level } = counter;

      if (order.side === "buy"  && order.price < makerPrice) break;
      if (order.side === "sell" && order.price > makerPrice) break;

      const maker   = level[0];
      const fillQty = Math.min(order.remainingQty, maker.remainingQty);

      // Assign trade ID now so the caller gets it immediately
      const tradeId    = genTradeId();
      const now        = new Date();
      const { baseAsset, quoteAsset } = parseSymbol(order.symbol);
      const quoteAmount = makerPrice * fillQty;

      fills.push({
        tradeId,
        symbol:      order.symbol,
        baseAsset,
        quoteAsset,
        price:       makerPrice,
        quantity:    fillQty,
        quoteAmount,
        takerSide:   order.side,
        buyOrderId:  order.side === "buy"  ? order.orderId : maker.orderId,
        sellOrderId: order.side === "sell" ? order.orderId : maker.orderId,
        buyUserId:   order.side === "buy"  ? order.userId  : maker.userId,
        sellUserId:  order.side === "sell" ? order.userId  : maker.userId,
        buyLimitPrice:  order.side === "buy"  ? order.price : maker.price,
        sellLimitPrice: order.side === "sell" ? order.price : maker.price,
        makerOrderId: maker.orderId,
        makerUserId:  maker.userId,
        executedAt:  now,
      });

      this._tradesExecuted++;

      order.remainingQty -= fillQty;
      maker.remainingQty -= fillQty;

      if (maker.remainingQty <= EPSILON) {
        book.consumeMakerFront(maker.side, makerPrice);
      }

      book.lastPrice = makerPrice;
      book.updatedAt = Date.now();

      // Emit trade event to Socket.IO subscribers (synchronous — no await)
      this.broadcaster.emitTrade(order.symbol, {
        symbol:    order.symbol,
        price:     makerPrice,
        quantity:  fillQty,
        takerSide: order.side,
        tradeId,
        ts:        Date.now(),
      });

      // Queue trade for Redis publish (fire-and-forget)
      const fill = fills[fills.length - 1];
      this._publisher.publishTrade({
        tradeId,
        symbol:      order.symbol,
        price:       makerPrice,
        quantity:    fillQty,
        quoteAmount,
        takerSide:   order.side,
        buyOrderId:  fill.buyOrderId,
        sellOrderId: fill.sellOrderId,
        executedAt:  now.toISOString(),
      });
    }

    return fills;
  }

  // ── Async persistence (called from OrderQueue after drain tick) ────────────

  async _onFills(fills) {
    await this._batchExec.flush(fills);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  _normalize(raw) {
    try {
      const qty = Number(raw.amount ?? raw.remainingQty ?? raw.quantity);
      if (!qty || qty <= 0) return null;
      return {
        orderId:      String(raw.orderId || raw._id),
        userId:       String(raw.userId  || raw.user),
        symbol:       String(raw.symbol).toUpperCase(),
        side:         raw.side,
        price:        Number(raw.price),
        remainingQty: qty,
        timestamp:    raw.createdAt ? new Date(raw.createdAt).getTime() : Date.now(),
      };
    } catch (err) {
      console.error("[HFT:ME] Order normalization failed:", err.message, raw);
      return null;
    }
  }

  // ── Status ────────────────────────────────────────────────────────────────────

  status() {
    const books = {};
    for (const [sym, book] of this.books) {
      const bid = book.bestBid();
      const ask = book.bestAsk();
      books[sym] = {
        bids:        book.bids.size,
        asks:        book.asks.size,
        totalOrders: book.index.size,
        lastPrice:   book.lastPrice,
        bestBid:     bid?.price ?? null,
        bestAsk:     ask?.price ?? null,
      };
    }
    return {
      mode:            "hft",
      running:         this.running,
      startedAt:       this._startedAt,
      ordersProcessed: this._ordersProcessed,
      tradesExecuted:  this._tradesExecuted,
      activePairs:     this.books.size,
      queues:          this._queues.stats(),
      latency:         hftMetrics.summary(),
      books,
    };
  }
}
