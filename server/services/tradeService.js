import Order from "../models/Order.js";
import Trade from "../models/Trade.js";
import Wallet from "../models/Wallet.js";
import { PAIRS } from "../config/supportedAssets.js";
import { checkAndRecordTrade } from "./riskService.js";

const marketStats = new Map(
  PAIRS.map((pair) => [
    pair.symbol,
    {
      symbol: pair.symbol,
      lastPrice: pair.price,
      open24h: pair.price,
      high24h: pair.price * 1.012,
      low24h: pair.price * 0.988,
      volumeBase24h: 0,
      volumeQuote24h: 0,
      updatedAt: new Date(),
    },
  ]),
);

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const round = (value, precision = 8) =>
  Number(Number(value).toFixed(precision));

const getPairBySymbol = (symbol) =>
  PAIRS.find((pair) => pair.symbol === String(symbol || "").toUpperCase());

const ensureMarketState = (symbol) => {
  const pair = getPairBySymbol(symbol);
  if (!pair) return null;
  if (!marketStats.has(pair.symbol)) {
    marketStats.set(pair.symbol, {
      symbol: pair.symbol,
      lastPrice: pair.price,
      open24h: pair.price,
      high24h: pair.price,
      low24h: pair.price,
      volumeBase24h: 0,
      volumeQuote24h: 0,
      updatedAt: new Date(),
    });
  }
  return marketStats.get(pair.symbol);
};

const getTicker = (symbol) => {
  const state = ensureMarketState(symbol);
  if (!state) return null;
  const change24h = ((state.lastPrice - state.open24h) / state.open24h) * 100;
  return {
    symbol: state.symbol,
    lastPrice: round(state.lastPrice, 2),
    high24h: round(state.high24h, 2),
    low24h: round(state.low24h, 2),
    change24h: round(change24h, 3),
    volumeBase24h: round(state.volumeBase24h, 6),
    volumeQuote24h: round(state.volumeQuote24h, 2),
    updatedAt: state.updatedAt,
  };
};

const updateTickerFromFill = (symbol, price, amount) => {
  const state = ensureMarketState(symbol);
  if (!state) return;
  state.lastPrice = price;
  state.high24h = Math.max(state.high24h, price);
  state.low24h = Math.min(state.low24h, price);
  state.volumeBase24h += amount;
  state.volumeQuote24h += price * amount;
  state.updatedAt = new Date();
};

const normalizeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const getOrCreateWallet = async (userId, asset) => {
  const normalizedAsset = String(asset || "").toUpperCase();
  let wallet = await Wallet.findOne({ user: userId, asset: normalizedAsset });
  if (!wallet) {
    wallet = await Wallet.create({
      user: userId,
      asset: normalizedAsset,
      balance: 0,
      available: 0,
      locked: 0,
    });
  }
  return wallet;
};

const CONDITIONAL_TYPES = new Set(["stop_limit", "stop_market", "trailing_stop"]);
const ALL_ORDER_TYPES   = new Set(["market", "limit", "stop_limit", "stop_market", "trailing_stop", "oco"]);

const badInput = (msg) => Object.assign(new Error(msg), { statusCode: 400 });

const validateOrderInput = (input) => {
  const symbol    = String(input.symbol    || "").toUpperCase();
  const side      = String(input.side      || "").toLowerCase();
  const orderType = String(input.orderType || "limit").toLowerCase();
  const amount    = normalizeNumber(input.amount);
  const price     = normalizeNumber(input.price);
  const stopPrice = normalizeNumber(input.stopPrice);
  const trailPct  = normalizeNumber(input.trailPercent);

  const pair = getPairBySymbol(symbol);
  if (!pair) throw badInput("Unsupported trading pair.");
  if (!["buy", "sell"].includes(side)) throw badInput("Invalid side. Use buy or sell.");
  if (!ALL_ORDER_TYPES.has(orderType))  throw badInput("Invalid order type.");
  if (!Number.isFinite(amount) || amount <= 0) throw badInput("Amount must be greater than zero.");

  if (orderType === "limit") {
    if (!Number.isFinite(price) || price <= 0) throw badInput("Limit price must be greater than zero.");
  }

  if (orderType === "stop_limit") {
    if (!Number.isFinite(stopPrice) || stopPrice <= 0) throw badInput("Stop price is required for stop-limit orders.");
    if (!Number.isFinite(price)     || price     <= 0) throw badInput("Limit price is required for stop-limit orders.");
  }

  if (orderType === "stop_market") {
    if (!Number.isFinite(stopPrice) || stopPrice <= 0) throw badInput("Stop price is required for stop-market orders.");
  }

  if (orderType === "trailing_stop") {
    if (!Number.isFinite(trailPct) || trailPct <= 0 || trailPct > 20)
      throw badInput("Trail percent must be between 0.01 and 20.");
  }

  if (orderType === "oco") {
    if (!Number.isFinite(price)     || price     <= 0) throw badInput("Limit price is required for OCO orders.");
    if (!Number.isFinite(stopPrice) || stopPrice <= 0) throw badInput("Stop price is required for OCO orders.");
    const stopLimitPrice = normalizeNumber(input.stopLimitPrice);
    if (!Number.isFinite(stopLimitPrice) || stopLimitPrice <= 0)
      throw badInput("Stop-limit price is required for OCO orders.");
  }

  return {
    symbol, side, orderType, pair,
    amount:       round(amount,    8),
    price:        Number.isFinite(price)     ? round(price,     8) : null,
    stopPrice:    Number.isFinite(stopPrice) ? round(stopPrice, 8) : null,
    trailPercent: Number.isFinite(trailPct)  ? round(trailPct,  4) : null,
    stopLimitPrice: Number.isFinite(normalizeNumber(input.stopLimitPrice))
      ? round(normalizeNumber(input.stopLimitPrice), 8) : null,
  };
};

const reserveForLimitOrder = async (order, walletsByAsset) => {
  const { side, amount, price, baseAsset, quoteAsset } = order;
  if (side === "buy") {
    const quoteWallet = walletsByAsset[quoteAsset];
    const neededQuote = amount * price;
    if (quoteWallet.available < neededQuote) {
      const error = new Error(`Insufficient ${quoteAsset} balance.`);
      error.statusCode = 400;
      throw error;
    }
    quoteWallet.available = round(quoteWallet.available - neededQuote, 8);
    quoteWallet.locked = round(quoteWallet.locked + neededQuote, 8);
    await quoteWallet.save();
    return;
  }

  const baseWallet = walletsByAsset[baseAsset];
  if (baseWallet.available < amount) {
    const error = new Error(`Insufficient ${baseAsset} balance.`);
    error.statusCode = 400;
    throw error;
  }
  baseWallet.available = round(baseWallet.available - amount, 8);
  baseWallet.locked = round(baseWallet.locked + amount, 8);
  await baseWallet.save();
};

const debitWallet = (wallet, amount, allowLocked = false) => {
  if (allowLocked && wallet.locked >= amount) {
    wallet.locked = round(wallet.locked - amount, 8);
    wallet.balance = round(wallet.balance - amount, 8);
    return;
  }
  if (wallet.available < amount) {
    const error = new Error(`Insufficient ${wallet.asset} balance.`);
    error.statusCode = 400;
    throw error;
  }
  wallet.available = round(wallet.available - amount, 8);
  wallet.balance = round(wallet.balance - amount, 8);
};

const creditWallet = (wallet, amount) => {
  wallet.balance = round(wallet.balance + amount, 8);
  wallet.available = round(wallet.available + amount, 8);
};

const createTradeRecord = async ({
  user,
  order,
  side,
  symbol,
  baseAsset,
  quoteAsset,
  orderType,
  amount,
  price,
}) =>
  Trade.create({
    user,
    order,
    type: "spot",
    side,
    symbol,
    baseAsset,
    quoteAsset,
    orderType,
    amount: round(amount, 8),
    price: round(price, 8),
    quoteAmount: round(amount * price, 8),
    fee: 0,
    status: "closed",
    executedAt: new Date(),
  });

const applyMatchedFill = async (takerOrder, makerOrder, fillAmount, fillPrice) => {
  const [takerBase, takerQuote, makerBase, makerQuote] = await Promise.all([
    getOrCreateWallet(takerOrder.user, takerOrder.baseAsset),
    getOrCreateWallet(takerOrder.user, takerOrder.quoteAsset),
    getOrCreateWallet(makerOrder.user, makerOrder.baseAsset),
    getOrCreateWallet(makerOrder.user, makerOrder.quoteAsset),
  ]);

  const fillQuoteAmount = round(fillAmount * fillPrice, 8);

  if (takerOrder.side === "buy") {
    debitWallet(
      takerQuote,
      fillQuoteAmount,
      takerOrder.orderType === "limit" || takerOrder.status !== "open",
    );
    debitWallet(
      makerBase,
      fillAmount,
      makerOrder.orderType === "limit" || makerOrder.status !== "open",
    );
    creditWallet(takerBase, fillAmount);
    creditWallet(makerQuote, fillQuoteAmount);
  } else {
    debitWallet(
      takerBase,
      fillAmount,
      takerOrder.orderType === "limit" || takerOrder.status !== "open",
    );
    debitWallet(
      makerQuote,
      fillQuoteAmount,
      makerOrder.orderType === "limit" || makerOrder.status !== "open",
    );
    creditWallet(takerQuote, fillQuoteAmount);
    creditWallet(makerBase, fillAmount);
  }

  await Promise.all([
    takerBase.save(),
    takerQuote.save(),
    makerBase.save(),
    makerQuote.save(),
  ]);
};

const buildOrderBook = async (symbol, depth = 20) => {
  const [bidsRaw, asksRaw] = await Promise.all([
    Order.aggregate([
      { $match: { symbol, side: "buy", status: { $in: ["open", "partially_filled"] } } },
      { $group: { _id: "$price", amount: { $sum: "$remainingAmount" } } },
      { $sort: { _id: -1 } },
      { $limit: depth },
    ]),
    Order.aggregate([
      { $match: { symbol, side: "sell", status: { $in: ["open", "partially_filled"] } } },
      { $group: { _id: "$price", amount: { $sum: "$remainingAmount" } } },
      { $sort: { _id: 1 } },
      { $limit: depth },
    ]),
  ]);

  const bids = bidsRaw.map((row) => ({
    price: round(Number(row._id), 8),
    amount: round(row.amount, 8),
    total: round(Number(row._id) * row.amount, 8),
  }));

  const asks = asksRaw.map((row) => ({
    price: round(Number(row._id), 8),
    amount: round(row.amount, 8),
    total: round(Number(row._id) * row.amount, 8),
  }));

  return { bids, asks };
};

const buildPairsWithTicker = () =>
  PAIRS.map((pair) => {
    const ticker = getTicker(pair.symbol);
    return {
      symbol: pair.symbol,
      baseAsset: pair.baseAsset,
      quoteAsset: pair.quoteAsset,
      lastPrice: ticker?.lastPrice ?? pair.price,
      change24h: ticker?.change24h ?? 0,
      volumeQuote24h: ticker?.volumeQuote24h ?? 0,
    };
  });

const toPublicTrade = (trade) => ({
  id: trade.id,
  symbol: trade.symbol,
  side: trade.side,
  price: trade.price,
  amount: trade.amount,
  status: trade.status,
  executedAt: trade.executedAt || trade.createdAt,
});

const buildSyntheticOrderBook = (lastPrice, depth = 20) => {
  const safeLast = Number.isFinite(lastPrice) && lastPrice > 0 ? lastPrice : 1;
  const bids = [];
  const asks = [];

  for (let level = 0; level < depth; level += 1) {
    const offset = (level + 1) * 0.00075;
    const bidPrice = round(safeLast * (1 - offset), 8);
    const askPrice = round(safeLast * (1 + offset), 8);
    const baseAmount = round(0.03 + Math.random() * 0.65, 8);
    const depthBoost = round(1 + level * 0.08, 8);
    const bidAmount = round(baseAmount * depthBoost, 8);
    const askAmount = round((baseAmount * (0.92 + Math.random() * 0.2)) * depthBoost, 8);

    bids.push({
      price: bidPrice,
      amount: bidAmount,
      total: round(bidPrice * bidAmount, 8),
    });
    asks.push({
      price: askPrice,
      amount: askAmount,
      total: round(askPrice * askAmount, 8),
    });
  }

  return { bids, asks };
};

const buildSyntheticTrades = (symbol, lastPrice, count = 40) => {
  const safeLast = Number.isFinite(lastPrice) && lastPrice > 0 ? lastPrice : 1;
  const now = Date.now();
  return Array.from({ length: count }, (_, index) => {
    const drift = (Math.random() - 0.5) * 0.006;
    const price = round(safeLast * (1 + drift), 8);
    const amount = round(0.001 + Math.random() * 0.28, 8);
    return {
      id: `${symbol}-sim-${now}-${index}`,
      symbol,
      side: index % 2 === 0 ? "buy" : "sell",
      price,
      amount,
      status: "closed",
      executedAt: new Date(now - index * 3000).toISOString(),
    };
  });
};

export const getTradingPairs = async () => buildPairsWithTicker();

// Exposed so the liquidity engine can read live prices without a full market state fetch
export const getLiveTicker = (symbol) => getTicker(String(symbol).toUpperCase());

export const getPublicMarketState = async (symbol) => {
  const selectedPair = getPairBySymbol(symbol) || PAIRS[0];
  const selectedSymbol = selectedPair.symbol;
  const ticker = getTicker(selectedSymbol);
  const [liveOrderBook, liveMarketTrades] = await Promise.all([
    buildOrderBook(selectedSymbol, 20),
    Trade.find({ symbol: selectedSymbol, status: "closed" })
      .sort({ executedAt: -1 })
      .limit(60),
  ]);

  const hasBookDepth =
    (liveOrderBook?.bids?.length || 0) > 0 || (liveOrderBook?.asks?.length || 0) > 0;
  const orderBook = hasBookDepth
    ? liveOrderBook
    : buildSyntheticOrderBook(ticker?.lastPrice || selectedPair.price, 20);

  const marketTrades =
    liveMarketTrades.length > 0
      ? liveMarketTrades.map(toPublicTrade)
      : buildSyntheticTrades(selectedSymbol, ticker?.lastPrice || selectedPair.price, 40);

  return {
    symbol: selectedSymbol,
    ticker,
    orderBook,
    marketTrades,
    pairs: buildPairsWithTicker(),
  };
};

export const getUserMarketState = async (userId, symbol) => {
  const publicState = await getPublicMarketState(symbol);
  const pair = getPairBySymbol(publicState.symbol);
  const [openOrders, myTrades, wallets] = await Promise.all([
    Order.find({
      user: userId,
      symbol: publicState.symbol,
      status: { $in: ["open", "partially_filled"] },
    }).sort({ createdAt: -1 }),
    Trade.find({ user: userId, symbol: publicState.symbol })
      .sort({ executedAt: -1, createdAt: -1 })
      .limit(80),
    Wallet.find({ user: userId, asset: { $in: [pair.baseAsset, pair.quoteAsset] } }).sort({
      asset: 1,
    }),
  ]);

  return {
    ...publicState,
    openOrders,
    myTrades,
    wallets,
  };
};

export const placeSpotOrder = async (userId, input) => {
  await checkAndRecordTrade(userId);
  const normalized  = validateOrderInput(input);

  // Route conditional and OCO orders to their own handlers
  if (CONDITIONAL_TYPES.has(normalized.orderType)) {
    return placeConditionalOrder(userId, normalized);
  }
  if (normalized.orderType === "oco") {
    return placeOCOOrder(userId, normalized);
  }

  const ticker = getTicker(normalized.symbol);
  const marketPrice = ticker?.lastPrice || normalized.pair.price;

  const takerWallets = {
    [normalized.pair.baseAsset]: await getOrCreateWallet(userId, normalized.pair.baseAsset),
    [normalized.pair.quoteAsset]: await getOrCreateWallet(userId, normalized.pair.quoteAsset),
  };

  if (normalized.orderType === "limit") {
    await reserveForLimitOrder(
      {
        side: normalized.side,
        amount: normalized.amount,
        price: normalized.price,
        baseAsset: normalized.pair.baseAsset,
        quoteAsset: normalized.pair.quoteAsset,
      },
      takerWallets,
    );
  } else {
    const needsAsset =
      normalized.side === "buy" ? normalized.pair.quoteAsset : normalized.pair.baseAsset;
    const neededAmount =
      normalized.side === "buy"
        ? normalized.amount * (marketPrice || normalized.price || normalized.pair.price)
        : normalized.amount;
    if (takerWallets[needsAsset].available < neededAmount) {
      const error = new Error(`Insufficient ${needsAsset} balance.`);
      error.statusCode = 400;
      throw error;
    }
  }

  const takerOrder = await Order.create({
    user: userId,
    symbol: normalized.symbol,
    baseAsset: normalized.pair.baseAsset,
    quoteAsset: normalized.pair.quoteAsset,
    side: normalized.side,
    orderType: normalized.orderType,
    price: normalized.orderType === "market" ? marketPrice : normalized.price,
    amount: normalized.amount,
    remainingAmount: normalized.amount,
    filledAmount: 0,
    averagePrice: 0,
    status: "open",
  });

  const oppositeSide = normalized.side === "buy" ? "sell" : "buy";
  const priceFilter =
    normalized.orderType === "market"
      ? {}
      : normalized.side === "buy"
        ? { price: { $lte: normalized.price } }
        : { price: { $gte: normalized.price } };

  const sort =
    normalized.side === "buy"
      ? { price: 1, createdAt: 1 }
      : { price: -1, createdAt: 1 };

  const makers = await Order.find({
    symbol: normalized.symbol,
    side: oppositeSide,
    status: { $in: ["open", "partially_filled"] },
    ...priceFilter,
  })
    .sort(sort)
    .limit(100);

  const fills = [];
  let spentPriceVolume = 0;
  let totalFillAmount = 0;

  // In production, skip self-trades (wash trading prevention).
  // In development, allow self-trading so a single test account can fill orders.
  // Block self-trades unless explicitly running in development mode.
  // Defaults to blocked when NODE_ENV is unset, staging, or production.
  const blockSelfTrade = process.env.NODE_ENV !== "development";

  for (const maker of makers) {
    if (takerOrder.remainingAmount <= 0) break;
    if (blockSelfTrade && String(maker.user) === String(takerOrder.user)) continue;

    const fillAmount = round(Math.min(takerOrder.remainingAmount, maker.remainingAmount), 8);
    if (fillAmount <= 0) continue;

    const fillPrice = round(maker.price || takerOrder.price || marketPrice, 8);

    await applyMatchedFill(takerOrder, maker, fillAmount, fillPrice);
    await Promise.all([
      createTradeRecord({
        user: takerOrder.user,
        order: takerOrder._id,
        side: takerOrder.side,
        symbol: takerOrder.symbol,
        baseAsset: takerOrder.baseAsset,
        quoteAsset: takerOrder.quoteAsset,
        orderType: takerOrder.orderType,
        amount: fillAmount,
        price: fillPrice,
      }),
      createTradeRecord({
        user: maker.user,
        order: maker._id,
        side: maker.side,
        symbol: maker.symbol,
        baseAsset: maker.baseAsset,
        quoteAsset: maker.quoteAsset,
        orderType: maker.orderType,
        amount: fillAmount,
        price: fillPrice,
      }),
    ]);

    maker.remainingAmount = round(maker.remainingAmount - fillAmount, 8);
    maker.filledAmount = round(maker.amount - maker.remainingAmount, 8);
    maker.averagePrice =
      maker.filledAmount > 0
        ? round(
            ((maker.averagePrice || 0) * (maker.filledAmount - fillAmount) +
              fillAmount * fillPrice) /
              maker.filledAmount,
            8,
          )
        : 0;
    maker.status =
      maker.remainingAmount <= 0 ? "filled" : maker.filledAmount > 0 ? "partially_filled" : "open";
    await maker.save();

    takerOrder.remainingAmount = round(takerOrder.remainingAmount - fillAmount, 8);
    takerOrder.filledAmount = round(takerOrder.amount - takerOrder.remainingAmount, 8);

    fills.push({
      symbol: takerOrder.symbol,
      side: takerOrder.side,
      price: fillPrice,
      amount: fillAmount,
      time: new Date().toISOString(),
    });
    spentPriceVolume += fillAmount * fillPrice;
    totalFillAmount += fillAmount;
    updateTickerFromFill(takerOrder.symbol, fillPrice, fillAmount);
  }

  takerOrder.averagePrice =
    totalFillAmount > 0 ? round(spentPriceVolume / totalFillAmount, 8) : 0;

  if (takerOrder.orderType === "market" && takerOrder.remainingAmount > 0) {
    takerOrder.status = totalFillAmount > 0 ? "filled" : "cancelled";
    takerOrder.remainingAmount = 0;
  } else if (takerOrder.remainingAmount <= 0) {
    takerOrder.status = "filled";
  } else if (takerOrder.filledAmount > 0) {
    takerOrder.status = "partially_filled";
  } else {
    takerOrder.status = "open";
  }

  await takerOrder.save();

  // If this order is one leg of an OCO and it filled, cancel the partner
  if (takerOrder.status === "filled" && takerOrder.linkedOrderId) {
    const { cancelOCOPartnerOrder } = await import("./conditionalOrderService.js");
    cancelOCOPartnerOrder(takerOrder.linkedOrderId).catch((err) =>
      console.error("[OCO] Post-fill partner cancel failed for", String(takerOrder.linkedOrderId), err.message)
    );
  }

  const marketState = await getUserMarketState(userId, takerOrder.symbol);
  return {
    order: takerOrder,
    fills,
    marketState,
  };
};

// ── Conditional order placement ───────────────────────────────────────────────

const placeConditionalOrder = async (userId, normalized) => {
  const { symbol, side, orderType, amount, price, stopPrice, trailPercent, pair } = normalized;

  const ticker      = getTicker(symbol);
  const lastPrice   = ticker?.lastPrice || pair.price;

  // Sell stops trigger when price falls to/below stopPrice; buy stops when price rises to/above
  const triggerCondition = side === "sell" ? "lte" : "gte";

  // Lock funds immediately (same as a limit order would)
  const wallets = {
    [pair.baseAsset]:  await getOrCreateWallet(userId, pair.baseAsset),
    [pair.quoteAsset]: await getOrCreateWallet(userId, pair.quoteAsset),
  };

  const reservePrice = price ?? stopPrice ?? lastPrice;
  await reserveForLimitOrder(
    { side, amount, price: reservePrice, baseAsset: pair.baseAsset, quoteAsset: pair.quoteAsset },
    wallets,
  );

  const order = await Order.create({
    user:             userId,
    symbol,
    baseAsset:        pair.baseAsset,
    quoteAsset:       pair.quoteAsset,
    side,
    orderType,
    price:            price ?? null,
    stopPrice:        stopPrice ?? null,
    trailPercent:     trailPercent ?? null,
    peakPrice:        lastPrice, // trailing stop starts tracking from current price
    triggerCondition,
    amount,
    remainingAmount:  amount,
    filledAmount:     0,
    averagePrice:     0,
    status:           "pending_trigger",
  });

  const marketState = await getUserMarketState(userId, symbol);
  return { order, fills: [], marketState };
};

// ── OCO order placement ───────────────────────────────────────────────────────

export const placeOCOOrder = async (userId, normalized) => {
  const { symbol, side, amount, price, stopPrice, stopLimitPrice, pair } = normalized;
  // checkAndRecordTrade is already called by placeSpotOrder before routing here — no double-call

  const ticker    = getTicker(symbol);
  const lastPrice = ticker?.lastPrice || pair.price;

  if (side === "sell" && price <= lastPrice) {
    throw badInput("For a sell OCO, the limit price must be above the current market price.");
  }
  if (side === "buy"  && price >= lastPrice) {
    throw badInput("For a buy OCO, the limit price must be below the current market price.");
  }

  const wallets = {
    [pair.baseAsset]:  await getOrCreateWallet(userId, pair.baseAsset),
    [pair.quoteAsset]: await getOrCreateWallet(userId, pair.quoteAsset),
  };

  await reserveForLimitOrder(
    { side, amount, price, baseAsset: pair.baseAsset, quoteAsset: pair.quoteAsset },
    wallets,
  );

  // Create both legs and wire them. On any failure: release locked funds and cancel legA.
  let legA = null;
  try {
    legA = await Order.create({
      user: userId, symbol,
      baseAsset: pair.baseAsset, quoteAsset: pair.quoteAsset,
      side, orderType: "oco",
      price, stopPrice: null,
      amount, remainingAmount: amount,
      filledAmount: 0, averagePrice: 0,
      linkedFundsHeld: true,
      status: "open",
    });

    const legB = await Order.create({
      user: userId, symbol,
      baseAsset: pair.baseAsset, quoteAsset: pair.quoteAsset,
      side, orderType: "oco",
      price: stopLimitPrice, stopPrice,
      triggerCondition: side === "sell" ? "lte" : "gte",
      amount, remainingAmount: amount,
      filledAmount: 0, averagePrice: 0,
      linkedOrderId: legA._id,
      linkedFundsHeld: false,
      status: "pending_trigger",
    });

    await Order.findByIdAndUpdate(legA._id, { $set: { linkedOrderId: legB._id } });

    // Feed Leg A (the live limit order) into the matching engine
    const me = global.__matchingEngine;
    if (me?.running) {
      await me.processOrder({
        orderId: String(legA._id), userId: String(userId),
        symbol, side, price, amount,
      });
    }

    const marketState = await getUserMarketState(userId, symbol);
    return { order: legA, linkedOrder: legB, fills: [], marketState };

  } catch (err) {
    // Rollback: release the locked funds and mark legA cancelled so it can't fill
    try {
      if (side === "buy") {
        const release = round(amount * price, 8);
        wallets[pair.quoteAsset].locked    = round(clamp(wallets[pair.quoteAsset].locked    - release, 0, Infinity), 8);
        wallets[pair.quoteAsset].available = round(wallets[pair.quoteAsset].available + release, 8);
        await wallets[pair.quoteAsset].save();
      } else {
        wallets[pair.baseAsset].locked    = round(clamp(wallets[pair.baseAsset].locked    - amount,  0, Infinity), 8);
        wallets[pair.baseAsset].available = round(wallets[pair.baseAsset].available + amount, 8);
        await wallets[pair.baseAsset].save();
      }
    } catch (walletErr) {
      console.error("[OCO] Fund release on rollback failed:", walletErr.message);
    }
    if (legA) {
      await Order.findByIdAndUpdate(legA._id, { $set: { status: "cancelled", remainingAmount: 0 } }).catch(() => {});
    }
    throw err;
  }
};

// ── Cancel (handles all statuses including pending_trigger) ───────────────────

export const cancelUserOrder = async (userId, orderId) => {
  const order = await Order.findOne({
    _id: orderId,
    user: userId,
    status: { $in: ["open", "partially_filled", "pending_trigger"] },
  });

  if (!order) {
    const error = new Error("Cancellable order not found.");
    error.statusCode = 404;
    throw error;
  }

  // Release locked funds only if this order holds them
  if (order.linkedFundsHeld !== false) {
    const baseWallet  = await getOrCreateWallet(order.user, order.baseAsset);
    const quoteWallet = await getOrCreateWallet(order.user, order.quoteAsset);

    if (order.side === "buy") {
      // peakPrice holds the lastPrice used for reservation in trailing_stop (price and stopPrice may be null)
      const releasePrice  = order.price ?? order.stopPrice ?? order.peakPrice ?? 0;
      const releaseAmount = round(order.remainingAmount * releasePrice, 8);
      quoteWallet.locked    = round(clamp(quoteWallet.locked    - releaseAmount, 0, Infinity), 8);
      quoteWallet.available = round(quoteWallet.available + releaseAmount, 8);
    } else {
      const releaseAmount = round(order.remainingAmount, 8);
      baseWallet.locked    = round(clamp(baseWallet.locked    - releaseAmount, 0, Infinity), 8);
      baseWallet.available = round(baseWallet.available + releaseAmount, 8);
    }

    await Promise.all([baseWallet.save(), quoteWallet.save()]);
  }

  order.status = "cancelled";
  order.remainingAmount = 0;
  await order.save();

  // If this was an OCO, cancel the partner leg and return it so the controller can emit its socket event
  let cancelledPartner = null;
  if (order.linkedOrderId) {
    const { cancelOCOPartnerOrder } = await import("./conditionalOrderService.js");
    cancelledPartner = await cancelOCOPartnerOrder(order.linkedOrderId).catch((err) => {
      console.error("[OCO] Partner cancel failed for order", String(order.linkedOrderId), err.message);
      return null;
    });
  }

  const marketState = await getUserMarketState(userId, order.symbol);
  return { order, cancelledPartner, marketState };
};

export const jitterTickerPrices = () => {
  for (const pair of PAIRS) {
    const state = ensureMarketState(pair.symbol);
    const drift = (Math.random() - 0.5) * 0.0038;
    const nextPrice = Math.max(state.lastPrice * (1 + drift), state.lastPrice * 0.97);
    state.lastPrice = round(nextPrice, 8);
    state.high24h = Math.max(state.high24h, state.lastPrice);
    state.low24h = Math.min(state.low24h, state.lastPrice);
    state.updatedAt = new Date();
  }
};
