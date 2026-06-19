/**
 * Conditional Order Processor
 *
 * Polls every 1 second for "pending_trigger" orders and activates them
 * when their price condition is met.
 *
 * Supported types:
 *   stop_limit    — triggers when price crosses stopPrice; executes as a limit order
 *   stop_market   — triggers when price crosses stopPrice; executes as a market order
 *   trailing_stop — tracks peak price; triggers when price retreats by trailPercent
 *   oco (secondary leg) — cancelled automatically when its partner fills
 *
 * OCO primary leg (a normal limit order) is handled in placeSpotOrder via
 * an after-fill hook that cancels the linked pending_trigger leg.
 */

import Order  from "../models/Order.js";
import Wallet from "../models/Wallet.js";

const POLL_MS = 1_000;
let   _timer  = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

const round = (v, p = 8) => Number(Number(v).toFixed(p));
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

// ── Trigger decision ──────────────────────────────────────────────────────────

const isTriggerMet = (order, lastPrice) => {
  switch (order.orderType) {
    case "stop_limit":
    case "stop_market":
      return order.triggerCondition === "gte"
        ? lastPrice >= order.stopPrice
        : lastPrice <= order.stopPrice;

    case "trailing_stop": {
      const trail = order.trailPercent / 100;
      if (order.side === "sell") {
        // Trigger when price falls below peak × (1 − trail)
        const peak = order.peakPrice ?? order.stopPrice ?? lastPrice;
        return lastPrice <= peak * (1 - trail);
      } else {
        // Trigger when price rises above peak × (1 + trail)
        const peak = order.peakPrice ?? order.stopPrice ?? lastPrice;
        return lastPrice >= peak * (1 + trail);
      }
    }

    default:
      return false;
  }
};

// For trailing stops: update the recorded peak whenever price improves.
const updatePeakIfNeeded = async (order, lastPrice) => {
  if (order.orderType !== "trailing_stop") return;
  const shouldUpdate =
    order.side === "sell"
      ? lastPrice > (order.peakPrice ?? 0)
      : lastPrice < (order.peakPrice ?? Infinity);

  if (shouldUpdate) {
    await Order.findByIdAndUpdate(order._id, { $set: { peakPrice: lastPrice } });
  }
};

// ── Trigger execution ─────────────────────────────────────────────────────────

const triggerOrder = async (order, lastPrice, matchingEngine) => {
  // Decide the execution price
  const execPrice =
    order.orderType === "stop_market" || order.orderType === "trailing_stop"
      ? lastPrice
      : (order.price ?? order.stopPrice ?? lastPrice);

  // Move order to "open" with the resolved execution price
  await Order.findByIdAndUpdate(order._id, {
    $set: {
      status:      "open",
      price:       round(execPrice, 8),
      triggeredAt: new Date(),
    },
  });

  // Update ticker market state so price field is correct at match time
  // (matching engine reads from DB, so the update above is sufficient)

  // Feed into matching engine
  if (matchingEngine?.running) {
    await matchingEngine.processOrder({
      orderId:   String(order._id),
      userId:    String(order.user),
      symbol:    order.symbol,
      side:      order.side,
      price:     round(execPrice, 8),
      amount:    order.remainingAmount,
      createdAt: order.triggeredAt ?? new Date(),
    });
  }

  console.log(
    `[COND] Triggered ${order.orderType} ${order.side} ${order.amount} ${order.symbol} @ ${round(execPrice, 8)}`
  );
};

// ── OCO partner cancellation (no fund release — secondary leg holds no funds) ─

// Returns the cancelled partner document, or null if not found / already terminal.
export const cancelOCOPartnerOrder = async (linkedOrderId) => {
  if (!linkedOrderId) return null;
  const partner = await Order.findById(linkedOrderId);
  if (!partner || ["filled", "cancelled"].includes(partner.status)) return null;

  // Release funds if this leg holds them (Leg A / primary)
  if (partner.linkedFundsHeld !== false) {
    try {
      const [base, quote] = await Promise.all([
        Wallet.findOne({ user: partner.user, asset: partner.baseAsset }),
        Wallet.findOne({ user: partner.user, asset: partner.quoteAsset }),
      ]);
      if (partner.side === "buy" && quote) {
        // peakPrice covers trailing_stop where price/stopPrice may be null
        const releasePrice = partner.price ?? partner.stopPrice ?? partner.peakPrice ?? 0;
        const release = round(partner.remainingAmount * releasePrice, 8);
        const safeRelease = clamp(release, 0, quote.locked);
        await Wallet.findOneAndUpdate(
          { _id: quote._id },
          { $inc: { locked: -safeRelease, available: safeRelease } },
        );
      } else if (partner.side === "sell" && base) {
        const safeRelease = clamp(partner.remainingAmount, 0, base.locked);
        await Wallet.findOneAndUpdate(
          { _id: base._id },
          { $inc: { locked: -safeRelease, available: safeRelease } },
        );
      }
    } catch (err) {
      console.error("[COND] OCO partner fund release failed:", err.message);
    }
  }

  await Order.findByIdAndUpdate(linkedOrderId, {
    $set: { status: "cancelled", remainingAmount: 0 },
  });

  partner.status = "cancelled";
  partner.remainingAmount = 0;
  return partner;
};

// ── When a regular (OCO-primary) limit order fills, cancel its partner ────────

export const onOrderFilled = async (order) => {
  if (order.linkedOrderId) {
    await cancelOCOPartnerOrder(order.linkedOrderId).catch(() => {});
  }
};

// ── When an OCO secondary stop triggers: cancel the primary limit first ───────

const triggerOCOSecondaryLeg = async (order, lastPrice, matchingEngine) => {
  if (order.linkedOrderId) {
    // Cancel the primary limit order and release its locked funds
    const primary = await Order.findById(order.linkedOrderId);
    if (primary && !["filled", "cancelled"].includes(primary.status)) {
      try {
        const wallet = primary.side === "buy"
          ? await Wallet.findOne({ user: primary.user, asset: primary.quoteAsset })
          : await Wallet.findOne({ user: primary.user, asset: primary.baseAsset });
        if (wallet) {
          const release = primary.side === "buy"
            ? round(primary.remainingAmount * primary.price, 8)
            : primary.remainingAmount;
          const safeRelease = clamp(release, 0, wallet.locked);
          await Wallet.findOneAndUpdate(
            { _id: wallet._id },
            { $inc: { locked: -safeRelease, available: safeRelease } },
          );
        }
      } catch (err) {
        console.error("[COND] OCO primary fund release failed:", err.message);
      }
      await Order.findByIdAndUpdate(primary._id, {
        $set: { status: "cancelled", remainingAmount: 0 },
      });
    }

    // Now lock funds for the secondary leg before triggering
    const execPrice = round(order.price ?? order.stopPrice ?? lastPrice, 8);
    try {
      if (order.side === "buy") {
        const neededQuote = round(order.remainingAmount * execPrice, 8);
        const quoteW = await Wallet.findOne({ user: order.user, asset: order.quoteAsset });
        if (quoteW && quoteW.available >= neededQuote) {
          await Wallet.findOneAndUpdate(
            { _id: quoteW._id },
            { $inc: { available: -neededQuote, locked: neededQuote } },
          );
        }
      } else {
        const baseW = await Wallet.findOne({ user: order.user, asset: order.baseAsset });
        if (baseW && baseW.available >= order.remainingAmount) {
          await Wallet.findOneAndUpdate(
            { _id: baseW._id },
            { $inc: { available: -order.remainingAmount, locked: order.remainingAmount } },
          );
        }
      }
    } catch (err) {
      console.error("[COND] OCO secondary fund lock failed:", err.message);
    }

    // Mark secondary as funded now
    await Order.findByIdAndUpdate(order._id, { $set: { linkedFundsHeld: true } });
  }

  await triggerOrder(order, lastPrice, matchingEngine);
};

// ── Main polling loop ─────────────────────────────────────────────────────────

const processPendingOrders = async (getLiveTicker, matchingEngine) => {
  const pending = await Order.find({ status: "pending_trigger" }).lean();
  if (pending.length === 0) return;

  for (const order of pending) {
    const ticker    = getLiveTicker(order.symbol);
    const lastPrice = ticker?.lastPrice;
    if (!lastPrice || lastPrice <= 0) continue;

    // Update trailing stop peak price — must be awaited before re-reading so isTriggerMet
    // sees the latest peakPrice and doesn't fire against a stale value.
    if (order.orderType === "trailing_stop") {
      try {
        await updatePeakIfNeeded(order, lastPrice);
      } catch (peakErr) {
        console.error("[COND] Peak update failed for order", String(order._id), peakErr.message);
      }
    }

    // Re-read order with the (now-committed) peakPrice for the trigger check
    const freshOrder = order.orderType === "trailing_stop"
      ? (await Order.findById(order._id).lean()) ?? order
      : order;

    // For OCO secondary legs: if the primary leg already filled or was cancelled, cancel this
    // leg too rather than triggering it (guards against the fire-and-forget cancel failure path)
    if (order.orderType === "oco" && order.linkedOrderId) {
      const partner = await Order.findById(order.linkedOrderId).lean();
      if (!partner || ["filled", "cancelled"].includes(partner.status)) {
        await Order.findByIdAndUpdate(order._id, { $set: { status: "cancelled", remainingAmount: 0 } });
        continue;
      }
    }

    if (!isTriggerMet(freshOrder, lastPrice)) continue;

    // Prevent double-triggering in concurrent polls
    const claimed = await Order.findOneAndUpdate(
      { _id: order._id, status: "pending_trigger" },
      { $set: { status: "open" } }, // temporarily lock it
    );
    if (!claimed) continue; // another process already triggered it

    try {
      if (order.orderType === "oco" && !order.linkedFundsHeld) {
        await triggerOCOSecondaryLeg(freshOrder, lastPrice, matchingEngine);
      } else {
        await triggerOrder(freshOrder, lastPrice, matchingEngine);
      }
    } catch (err) {
      // Roll back the status so it can be retried
      await Order.findByIdAndUpdate(order._id, { $set: { status: "pending_trigger" } });
      console.error("[COND] Trigger failed for order", String(order._id), err.message);
    }
  }
};

// ── Lifecycle ─────────────────────────────────────────────────────────────────

// Recursive setTimeout so the next poll only starts after the current one completes,
// preventing concurrent overlapping polls when DB is slow.
const scheduleNext = (getLiveTicker, matchingEngine) => {
  _timer = setTimeout(async () => {
    try {
      await processPendingOrders(getLiveTicker, matchingEngine);
    } catch (err) {
      console.error("[COND] Poll error:", err.message);
    }
    if (_timer !== null) scheduleNext(getLiveTicker, matchingEngine);
  }, POLL_MS);
};

export const startConditionalProcessor = (getLiveTicker, matchingEngine) => {
  if (_timer) return;
  _timer = true; // sentinel so stopConditionalProcessor() can cancel before first tick
  scheduleNext(getLiveTicker, matchingEngine);
  console.log("[COND] Conditional order processor started (1-second poll, non-overlapping).");
};

export const stopConditionalProcessor = () => {
  if (_timer) { clearTimeout(_timer); _timer = null; }
};
