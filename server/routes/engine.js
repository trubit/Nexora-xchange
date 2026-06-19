import { Router } from "express";
import Order from "../models/Order.js";
import Trade from "../models/Trade.js";
import Wallet from "../models/Wallet.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/engine/status
router.get("/status", (req, res) => {
  const engine = req.app.locals.matchingEngine;
  if (!engine) return res.status(503).json({ message: "Matching engine not initialized." });
  res.json({
    service:   "trusonx-matching-engine",
    version:   "2.0.0",
    timestamp: new Date().toISOString(),
    ...engine.status(),
  });
});

// GET /api/engine/orderbook/:symbol
router.get("/orderbook/:symbol", (req, res) => {
  const engine = req.app.locals.matchingEngine;
  if (!engine) return res.status(503).json({ message: "Matching engine not initialized." });
  const sym  = String(req.params.symbol).toUpperCase();
  const book = engine.getBook(sym);
  res.json(book.snapshot(20));
});

// GET /api/engine/pairs
router.get("/pairs", (req, res) => {
  const engine = req.app.locals.matchingEngine;
  if (!engine) return res.status(503).json({ message: "Matching engine not initialized." });
  const pairs = [];
  for (const [sym, book] of engine.books) {
    pairs.push({
      symbol:      sym,
      lastPrice:   book.lastPrice,
      bidLevels:   book.bids.size,
      askLevels:   book.asks.size,
      totalOrders: book.index.size,
    });
  }
  res.json({ pairs });
});

// POST /api/engine/start
router.post("/start", (req, res) => {
  const engine = req.app.locals.matchingEngine;
  if (!engine) return res.status(503).json({ message: "Matching engine not initialized." });
  if (engine.running) return res.json({ message: "Engine already running." });
  engine.start();
  res.json({ message: "Engine started." });
});

// POST /api/engine/stop
router.post("/stop", (req, res) => {
  const engine = req.app.locals.matchingEngine;
  if (!engine) return res.status(503).json({ message: "Matching engine not initialized." });
  if (!engine.running) return res.json({ message: "Engine already stopped." });
  engine.stop();
  res.json({ message: "Engine stopped. Resting orders retained in memory." });
});

// DELETE /api/engine/book/:symbol
router.delete("/book/:symbol", (req, res) => {
  const engine = req.app.locals.matchingEngine;
  if (!engine) return res.status(503).json({ message: "Matching engine not initialized." });
  const sym = String(req.params.symbol).toUpperCase();
  if (engine.books.has(sym)) {
    engine.books.delete(sym);
    return res.json({ message: `Order book for ${sym} flushed.` });
  }
  res.status(404).json({ message: `No active book for ${sym}.` });
});

// POST /api/engine/test/fill/:orderId
// Dev-only: instantly fill any open order at its limit price.
// Useful for testing without needing a real counterparty.
router.post("/test/fill/:orderId", requireAuth, async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ message: "Test endpoints are disabled in production." });
  }

  const order = await Order.findById(req.params.orderId);
  if (!order) return res.status(404).json({ message: "Order not found." });
  if (!["open", "partially_filled"].includes(order.status)) {
    return res.status(400).json({ message: `Order is already ${order.status}.` });
  }

  const fillAmount = order.remainingAmount;
  const fillPrice  = order.price;
  const fillQuote  = Number((fillAmount * fillPrice).toFixed(8));

  // Update order to filled
  order.filledAmount    = order.amount;
  order.remainingAmount = 0;
  order.averagePrice    = fillPrice;
  order.status          = "filled";
  await order.save();

  // Credit / debit wallets
  const getWallet = async (userId, asset) => {
    const key = String(asset).toUpperCase();
    let w = await Wallet.findOne({ user: userId, asset: key });
    if (!w) w = await Wallet.create({ user: userId, asset: key, balance: 0, available: 0, locked: 0 });
    return w;
  };

  const baseW  = await getWallet(order.user, order.baseAsset);
  const quoteW = await getWallet(order.user, order.quoteAsset);

  if (order.side === "buy") {
    // Release locked quote, credit base
    quoteW.locked    = Math.max(0, Number((quoteW.locked  - fillQuote).toFixed(8)));
    quoteW.balance   = Math.max(0, Number((quoteW.balance - fillQuote).toFixed(8)));
    baseW.balance    = Number((baseW.balance  + fillAmount).toFixed(8));
    baseW.available  = Number((baseW.available + fillAmount).toFixed(8));
  } else {
    // Release locked base, credit quote
    baseW.locked     = Math.max(0, Number((baseW.locked   - fillAmount).toFixed(8)));
    baseW.balance    = Math.max(0, Number((baseW.balance  - fillAmount).toFixed(8)));
    quoteW.balance   = Number((quoteW.balance  + fillQuote).toFixed(8));
    quoteW.available = Number((quoteW.available + fillQuote).toFixed(8));
  }
  await Promise.all([baseW.save(), quoteW.save()]);

  // Create trade record
  await Trade.create({
    user: order.user,
    order: order._id,
    type: "spot",
    side: order.side,
    symbol: order.symbol,
    baseAsset: order.baseAsset,
    quoteAsset: order.quoteAsset,
    orderType: order.orderType,
    amount: fillAmount,
    price: fillPrice,
    quoteAmount: fillQuote,
    fee: 0,
    status: "closed",
    executedAt: new Date(),
  });

  return res.json({
    message: `Order filled: ${fillAmount} ${order.baseAsset} @ ${fillPrice} ${order.quoteAsset}`,
    order,
  });
});

export default router;
