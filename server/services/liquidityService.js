/**
 * Liquidity Engine — Nexora
 *
 * Keeps every trading pair's order book populated with realistic bid/ask depth.
 * Works by maintaining a dedicated "bot" user whose limit orders serve as
 * resting liquidity. Real user orders match against bot orders normally.
 *
 * Architecture:
 *   1. Bot user — a system account with virtually unlimited virtual balances.
 *   2. Per-pair config — spread, levels, amount range, refresh cadence.
 *   3. Engine loop — every N seconds: cancel stale bot orders, inject fresh ones.
 *   4. Spread control — bot bid < bot ask always; no self-crossing.
 *   5. Price reference — live ticker from tradeService → PAIRS default.
 */

import bcrypt from "bcryptjs";
import Order  from "../models/Order.js";
import User   from "../models/User.js";
import Wallet from "../models/Wallet.js";
import { PAIRS } from "../config/supportedAssets.js";
import { getLiveTicker } from "./tradeService.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const BOT_EMAIL    = "liquidity-bot@nexora.internal";
const BOT_BALANCE  = 1_000_000_000; // 1 billion per asset — effectively unlimited
const REFUND_AT    = 10_000;        // re-fund a wallet when available drops here

// All unique assets across all pairs (no duplicates)
const ALL_ASSETS = [...new Set(PAIRS.flatMap((p) => [p.baseAsset, p.quoteAsset]))];

// ── Per-pair default config ───────────────────────────────────────────────────

const DEFAULT_CFG = {
  enabled:          true,
  spread:           0.002,   // 0.2 % total spread (0.1 % each side of mid)
  levels:           10,      // resting order levels per side
  levelSpacing:     0.0008,  // 0.08 % price step between levels
  minAmount:        0.05,    // smallest order size (base asset)
  maxAmount:        2.0,     // largest order size
  staleDistancePct: 0.015,   // cancel a bot order if ref-price drifted > 1.5 %
  maxBotPerSide:    15,      // hard cap: bot orders per side per pair
  refreshMs:        10_000,  // engine cycle interval (ms)
};

// Pair-specific overrides (tighter spread / different sizing for major pairs)
const PAIR_OVERRIDES = {
  BTCUSDT:  { spread: 0.001,  levels: 15, minAmount: 0.0001, maxAmount: 0.08  },
  ETHUSDT:  { spread: 0.0012, levels: 12, minAmount: 0.001,  maxAmount: 0.5   },
  BNBUSDT:  { spread: 0.0015, levels: 10, minAmount: 0.01,   maxAmount: 2.0   },
  SOLUSDT:  { spread: 0.0015, levels: 10, minAmount: 0.01,   maxAmount: 5.0   },
  XRPUSDT:  { spread: 0.002,  levels: 10, minAmount: 1,      maxAmount: 200   },
  BTCETH:   { spread: 0.001,  levels: 12, minAmount: 0.0001, maxAmount: 0.05  },
  ETHBTC:   { spread: 0.001,  levels: 12, minAmount: 0.001,  maxAmount: 0.5   },
};

// ── Runtime state ─────────────────────────────────────────────────────────────

let botUserId    = null;   // ObjectId of the bot user
let engineTimer  = null;   // single setInterval handle
let running      = false;

const pairConfigs = new Map(); // symbol → merged config
const engineStats = {
  startedAt:      null,
  stoppedAt:      null,
  injectedOrders: 0,
  cancelledOrders: 0,
  cyclesRun:      0,
  lastCycleAt:    null,
  errors:         0,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const r8 = (n) => Math.round(n * 1e8) / 1e8; // round to 8 decimal places

const jitter = (base, pct) => base * (1 + (Math.random() - 0.5) * pct);

const getPairConfig = (symbol) => {
  if (!pairConfigs.has(symbol)) {
    pairConfigs.set(symbol, { ...DEFAULT_CFG, ...(PAIR_OVERRIDES[symbol] ?? {}) });
  }
  return pairConfigs.get(symbol);
};

// ── Price reference ───────────────────────────────────────────────────────────

/**
 * Best available reference price for a symbol, in order of preference:
 *   1. Live ticker last-price (from in-memory marketStats in tradeService)
 *   2. Midpoint of the best real user bid + ask in MongoDB
 *   3. PAIRS default price
 */
const getReferencePrice = async (symbol) => {
  // 1. Live ticker
  const ticker = getLiveTicker(symbol);
  if (ticker?.lastPrice > 0) return ticker.lastPrice;

  // 2. Real user orders midpoint
  const [bestBid, bestAsk] = await Promise.all([
    Order.findOne({
      symbol,
      side:   "buy",
      status: { $in: ["open", "partially_filled"] },
      user:   { $ne: botUserId },
    }).sort({ price: -1 }).select("price").lean(),
    Order.findOne({
      symbol,
      side:   "sell",
      status: { $in: ["open", "partially_filled"] },
      user:   { $ne: botUserId },
    }).sort({ price: 1 }).select("price").lean(),
  ]);

  if (bestBid && bestAsk) return (bestBid.price + bestAsk.price) / 2;
  if (bestBid)  return bestBid.price  * 1.001;
  if (bestAsk)  return bestAsk.price  * 0.999;

  // 3. PAIRS default
  const pair = PAIRS.find((p) => p.symbol === symbol);
  return pair?.price ?? 1;
};

// ── Bot user + wallets ────────────────────────────────────────────────────────

export const getOrCreateBotUser = async () => {
  // Fast path: bot already exists (every restart after the first)
  const existing = await User.findOne({ email: BOT_EMAIL });
  if (existing) return existing;

  // Slow path: first boot. Compute hash then upsert atomically so PM2 cluster
  // workers racing at startup don't cause an E11000 duplicate-key crash.
  const hash = await bcrypt.hash(`bot-${Date.now()}-${Math.random()}`, 4);
  const bot = await User.findOneAndUpdate(
    { email: BOT_EMAIL },
    { $setOnInsert: {
        name:          "Liquidity Bot",
        email:         BOT_EMAIL,
        passwordHash:  hash,
        role:          "admin",
        status:        "active",
        emailVerified: true,
        authProvider:  "local",
    }},
    { upsert: true, new: true },
  );
  console.info("[LIQUIDITY] Bot user ready:", bot._id.toString());
  return bot;
};

const ensureWallet = async (userId, asset, desiredBalance) => {
  const wallet = await Wallet.findOne({ user: userId, asset });
  if (!wallet) {
    // Upsert so concurrent calls from multiple workers don't double-create
    await Wallet.findOneAndUpdate(
      { user: userId, asset },
      { $setOnInsert: { balance: desiredBalance, available: desiredBalance, locked: 0 } },
      { upsert: true },
    );
  } else if (wallet.available < REFUND_AT) {
    const topUp = desiredBalance - wallet.balance;
    if (topUp > 0) {
      // Atomic increment — safe under concurrent engine cycles
      await Wallet.findOneAndUpdate(
        { _id: wallet._id },
        { $inc: { balance: topUp, available: topUp } },
      );
    }
  }
};

const fundBotWallets = async () => {
  for (const asset of ALL_ASSETS) {
    await ensureWallet(botUserId, asset, BOT_BALANCE);
  }
  console.info(`[LIQUIDITY] Bot wallets funded for ${ALL_ASSETS.length} assets.`);
};

// Top-up any asset that's running low (called after each cycle).
// Uses atomic $inc so overlapping cycles from a long-running engine don't
// double-fund the bot wallet via a lost-update race.
const refundDepletedWallets = async () => {
  const depleted = await Wallet.find({
    user:      botUserId,
    available: { $lt: REFUND_AT },
  }).select("_id balance").lean();

  await Promise.all(
    depleted
      .filter((w) => BOT_BALANCE - w.balance > 0)
      .map((w) => {
        const topUp = BOT_BALANCE - w.balance;
        return Wallet.findOneAndUpdate(
          { _id: w._id, balance: w.balance }, // optimistic check prevents double-apply
          { $inc: { balance: topUp, available: topUp } },
        );
      }),
  );
};

// ── Stale order cleanup ───────────────────────────────────────────────────────

const cancelStaleBotOrders = async (symbol, refPrice, cfg) => {
  const botOrders = await Order.find({
    user:   botUserId,
    symbol,
    status: { $in: ["open", "partially_filled"] },
  }).select("_id price side").lean();

  const staleIds = botOrders
    .filter((o) => Math.abs(o.price - refPrice) / refPrice > cfg.staleDistancePct)
    .map((o) => o._id);

  if (staleIds.length === 0) return 0;

  await Order.updateMany(
    { _id: { $in: staleIds } },
    { $set: { status: "cancelled", remainingAmount: 0 } },
  );

  engineStats.cancelledOrders += staleIds.length;
  return staleIds.length;
};

// ── Order injection ───────────────────────────────────────────────────────────

/**
 * Generate bid or ask price levels around the reference price.
 * Bids descend from (ref - halfSpread); asks ascend from (ref + halfSpread).
 */
const buildPriceLevels = (refPrice, side, cfg) => {
  const halfSpread = refPrice * (cfg.spread / 2);
  const base       = side === "buy" ? refPrice - halfSpread : refPrice + halfSpread;
  const dir        = side === "buy" ? -1 : 1;

  return Array.from({ length: cfg.levels }, (_, i) => {
    const raw = base * Math.pow(1 + dir * cfg.levelSpacing, i);
    return r8(Math.max(0.00000001, raw));
  });
};

/**
 * Order size grows with depth level (more liquidity farther from mid = realistic).
 * Light jitter makes the book look organic rather than mechanical.
 */
const buildAmount = (level, cfg) => {
  const base       = cfg.minAmount + (cfg.maxAmount - cfg.minAmount) * Math.random();
  const depthScale = 1 + level * 0.12;
  return r8(Math.max(cfg.minAmount, jitter(base * depthScale, 0.2)));
};

const injectOrders = async (symbol, side, refPrice, neededCount, cfg) => {
  const pair = PAIRS.find((p) => p.symbol === symbol);
  if (!pair || neededCount <= 0) return 0;

  // Existing bot prices for this side — to avoid duplicate levels
  const existing = await Order.find({
    user:   botUserId,
    symbol,
    side,
    status: { $in: ["open", "partially_filled"] },
  }).select("price").lean();

  const existingArr = existing.map((o) => r8(o.price)); // array — avoid per-level Set spread
  const levels      = buildPriceLevels(refPrice, side, cfg);
  const toCreate    = [];

  for (let i = 0; i < levels.length && toCreate.length < neededCount; i++) {
    const price = levels[i];
    // Skip if a bot order already sits within 0.005 % of this level
    const hasNearby = existingArr.some((p) => Math.abs(p - price) / price < 0.00005);
    if (hasNearby) continue;

    const amount = buildAmount(i, cfg);
    toCreate.push({
      user:            botUserId,
      symbol,
      baseAsset:       pair.baseAsset,
      quoteAsset:      pair.quoteAsset,
      side,
      orderType:       "limit",
      price,
      amount,
      remainingAmount: amount,
      filledAmount:    0,
      averagePrice:    0,
      status:          "open",
    });
  }

  if (toCreate.length > 0) {
    await Order.insertMany(toCreate);
    engineStats.injectedOrders += toCreate.length;
  }

  return toCreate.length;
};

// ── Per-pair cycle ────────────────────────────────────────────────────────────

const runPairCycle = async (symbol) => {
  const cfg = getPairConfig(symbol);
  if (!cfg.enabled || !botUserId) return;

  const refPrice = await getReferencePrice(symbol);
  if (!refPrice || refPrice <= 0) return;

  // 1. Cancel stale orders
  await cancelStaleBotOrders(symbol, refPrice, cfg);

  // 2. Count live bot orders per side
  const [bidCount, askCount] = await Promise.all([
    Order.countDocuments({
      user:   botUserId,
      symbol,
      side:   "buy",
      status: { $in: ["open", "partially_filled"] },
    }),
    Order.countDocuments({
      user:   botUserId,
      symbol,
      side:   "sell",
      status: { $in: ["open", "partially_filled"] },
    }),
  ]);

  // 3. Inject only what's missing (respect maxBotPerSide cap)
  const bidsNeeded = Math.min(cfg.levels - bidCount,  cfg.maxBotPerSide - bidCount);
  const asksNeeded = Math.min(cfg.levels - askCount,  cfg.maxBotPerSide - askCount);

  await Promise.all([
    bidsNeeded > 0 ? injectOrders(symbol, "buy",  refPrice, bidsNeeded,  cfg) : Promise.resolve(),
    asksNeeded > 0 ? injectOrders(symbol, "sell", refPrice, asksNeeded, cfg) : Promise.resolve(),
  ]);
};

// ── Engine lifecycle ──────────────────────────────────────────────────────────

export const startLiquidityEngine = async () => {
  if (running) {
    console.warn("[LIQUIDITY] Engine already running.");
    return;
  }

  try {
    // Boot the bot account and fund it
    const bot = await getOrCreateBotUser();
    botUserId = bot._id;
    await fundBotWallets();

    // Pre-load configs for all pairs
    for (const pair of PAIRS) {
      getPairConfig(pair.symbol);
    }

    // Run one immediate cycle before starting the interval
    await runEngineCycle();

    // Recurring cycle
    engineTimer = setInterval(async () => {
      await runEngineCycle();
    }, DEFAULT_CFG.refreshMs);

    running = true;
    engineStats.startedAt = new Date();
    console.info(`[LIQUIDITY] Engine started — managing ${PAIRS.length} pairs.`);
  } catch (err) {
    console.error("[LIQUIDITY] Failed to start:", err.message);
  }
};

const runEngineCycle = async () => {
  const enabledPairs = PAIRS.filter((p) => getPairConfig(p.symbol).enabled);
  const results = await Promise.allSettled(enabledPairs.map((p) => runPairCycle(p.symbol)));

  results.forEach((r, i) => {
    if (r.status === "rejected") {
      engineStats.errors++;
      console.error(`[LIQUIDITY] ${enabledPairs[i].symbol} cycle error:`, r.reason?.message);
    }
  });

  engineStats.cyclesRun++;
  engineStats.lastCycleAt = new Date();

  // Top up any depleted bot wallets quietly
  await refundDepletedWallets().catch(() => {});
};

export const stopLiquidityEngine = () => {
  if (engineTimer) clearInterval(engineTimer);
  engineTimer = null;
  running     = false;
  engineStats.stoppedAt = new Date();
  console.info("[LIQUIDITY] Engine stopped.");
};

// ── Status + config API ───────────────────────────────────────────────────────

export const getLiquidityStatus = async () => {
  // Use the in-memory live ticker for price — avoids 2 DB queries per pair.
  // countDocuments is still needed but runs in parallel across all pairs.
  const pairStats = await Promise.all(
    PAIRS.map(async (pair) => {
      const cfg    = getPairConfig(pair.symbol);
      const ticker = getLiveTicker(pair.symbol);
      const [bids, asks] = await Promise.all([
        Order.countDocuments({ user: botUserId, symbol: pair.symbol, side: "buy",  status: { $in: ["open", "partially_filled"] } }),
        Order.countDocuments({ user: botUserId, symbol: pair.symbol, side: "sell", status: { $in: ["open", "partially_filled"] } }),
      ]);
      return {
        symbol:   pair.symbol,
        enabled:  cfg.enabled,
        spread:   cfg.spread,
        levels:   cfg.levels,
        refPrice: ticker?.lastPrice ?? null,
        botBids:  bids,
        botAsks:  asks,
      };
    }),
  );

  return {
    running,
    botUserId: botUserId?.toString() ?? null,
    stats:     engineStats,
    pairs:     pairStats,
  };
};

export const setPairEnabled = (symbol, enabled) => {
  const cfg = getPairConfig(symbol);
  cfg.enabled = Boolean(enabled);
  pairConfigs.set(symbol, cfg);
  return cfg;
};

export const updatePairConfig = (symbol, patch) => {
  const cfg = getPairConfig(symbol);
  const allowed = ["enabled", "spread", "levels", "levelSpacing", "minAmount", "maxAmount", "staleDistancePct", "maxBotPerSide"];
  for (const key of allowed) {
    if (patch[key] !== undefined) cfg[key] = patch[key];
  }
  pairConfigs.set(symbol, cfg);
  return cfg;
};

export const flushBotOrders = async (symbol) => {
  const filter = symbol
    ? { user: botUserId, symbol, status: { $in: ["open", "partially_filled"] } }
    : { user: botUserId, status: { $in: ["open", "partially_filled"] } };

  const result = await Order.updateMany(filter, { $set: { status: "cancelled", remainingAmount: 0 } });
  return result.modifiedCount;
};

export const isEngineRunning = () => running;
export const getBotUserId    = () => botUserId;
