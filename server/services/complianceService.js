/**
 * compliance-service — KYC workflow + AML monitoring.
 *
 * AML velocity windows:
 *   - Single transaction  > $10,000 → LARGE_TRANSACTION alert (warning)
 *   - 24h rolling volume  > $50,000 → VELOCITY_BREACH alert (critical)
 *   - 1h trade count      > 100     → RAPID_TRADING alert (warning)
 *   - Structuring: 3+ txns in 1h each between $8k–$9.9k → STRUCTURING alert (critical)
 */

import User            from "../models/User.js";
import AmlAlert        from "../models/AmlAlert.js";
import ExecutedTrade   from "../models/ExecutedTrade.js";
import Transaction     from "../models/Transaction.js";
import { audit }       from "./auditService.js";
import logger          from "../config/logger.js";

// ── KYC helpers ────────────────────────────────────────────────────────────────

export const KYC_STATUS = Object.freeze({
  UNVERIFIED: "unverified",
  PENDING:    "pending",
  APPROVED:   "approved",
  REJECTED:   "rejected",
});

export const requiresKyc = (user) =>
  !user || user.kycStatus !== KYC_STATUS.APPROVED;

// ── AML thresholds ─────────────────────────────────────────────────────────────

const LARGE_TXN_USD     = 10_000;
const VELOCITY_24H_USD  = 50_000;
const RAPID_TRADE_HOUR  = 100;
const STRUCTURE_LOW     =  8_000;
const STRUCTURE_HIGH    =  9_999;
const STRUCTURE_COUNT   = 3;

// ── Internal: create or escalate an alert ─────────────────────────────────────

const raiseAlert = async (userId, userEmail, alertType, amountUsd, description, metadata, autoFreeze = false) => {
  try {
    const riskScore =
      alertType === "velocity_breach"  ? 85 :
      alertType === "structuring"      ? 90 :
      alertType === "sanctions_hit"    ? 100 :
      alertType === "rapid_trading"    ? 60 :
      alertType === "large_transaction"? 40 :
      50;

    const alert = await AmlAlert.create({
      userId, userEmail, alertType,
      status: autoFreeze ? "frozen" : "open",
      riskScore, amountUsd, description, metadata,
      frozenAt: autoFreeze ? new Date() : null,
    });

    if (autoFreeze) {
      await User.findByIdAndUpdate(userId, { status: "suspended" });
      logger.warn({ userId, alertType }, "AML auto-freeze triggered");
    }

    logger.warn({ userId, alertType, riskScore, amountUsd }, "AML alert raised");
    return alert;
  } catch (err) {
    logger.error({ err, userId, alertType }, "AML alert creation failed");
  }
};

// ── Check trade for AML violations ────────────────────────────────────────────

export const checkTradeAml = async (userId, userEmail, amountUsd) => {
  try {
    const now  = new Date();
    const h1   = new Date(now - 60 * 60 * 1000);
    const h24  = new Date(now - 24 * 60 * 60 * 1000);

    const [vol24, tradeCount1h, structCount] = await Promise.all([
      ExecutedTrade.aggregate([
        { $match: { userId: userId.toString(), executedAt: { $gte: h24 } } },
        { $group: { _id: null, total: { $sum: "$quoteQty" } } },
      ]).then((r) => r[0]?.total ?? 0),

      ExecutedTrade.countDocuments({ userId: userId.toString(), executedAt: { $gte: h1 } }),

      ExecutedTrade.countDocuments({
        userId: userId.toString(),
        executedAt: { $gte: h1 },
        quoteQty: { $gte: STRUCTURE_LOW, $lte: STRUCTURE_HIGH },
      }),
    ]);

    const alerts = [];

    if (amountUsd >= LARGE_TXN_USD) {
      alerts.push(raiseAlert(userId, userEmail, "large_transaction", amountUsd,
        `Single trade of $${amountUsd.toLocaleString()} exceeds reporting threshold.`,
        { amountUsd }));
    }

    if (vol24 + amountUsd >= VELOCITY_24H_USD) {
      alerts.push(raiseAlert(userId, userEmail, "velocity_breach", vol24 + amountUsd,
        `24h trading volume ($${(vol24 + amountUsd).toLocaleString()}) exceeds $50,000 threshold.`,
        { vol24, newTrade: amountUsd }, true /* auto-freeze */));
    }

    if (tradeCount1h >= RAPID_TRADE_HOUR) {
      alerts.push(raiseAlert(userId, userEmail, "rapid_trading", 0,
        `${tradeCount1h} trades executed in the last hour.`,
        { tradeCount1h }));
    }

    if (structCount >= STRUCTURE_COUNT) {
      alerts.push(raiseAlert(userId, userEmail, "structuring", 0,
        `${structCount} transactions between $8k–$10k detected in 1 hour (potential structuring).`,
        { structCount }, true /* auto-freeze */));
    }

    await Promise.all(alerts);
    return alerts.length > 0;
  } catch (err) {
    logger.error({ err, userId }, "AML trade check failed");
    return false;
  }
};

// ── Check wallet transaction for AML violations ────────────────────────────────

export const checkTransactionAml = async (userId, userEmail, type, amountUsd) => {
  try {
    const alerts = [];

    if (amountUsd >= LARGE_TXN_USD) {
      alerts.push(raiseAlert(userId, userEmail, "large_transaction", amountUsd,
        `${type} of $${amountUsd.toLocaleString()} triggers large-transaction reporting.`,
        { type, amountUsd }));
    }

    const h24  = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const vol24 = await Transaction.aggregate([
      { $match: { userId, createdAt: { $gte: h24 }, status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amountUsd" } } },
    ]).then((r) => r[0]?.total ?? 0);

    if (vol24 + amountUsd >= VELOCITY_24H_USD) {
      alerts.push(raiseAlert(userId, userEmail, "velocity_breach", vol24 + amountUsd,
        `24h transaction volume ($${(vol24 + amountUsd).toLocaleString()}) breaches $50k limit.`,
        { vol24, newTxn: amountUsd }, true));
    }

    await Promise.all(alerts);
    return alerts.length > 0;
  } catch (err) {
    logger.error({ err, userId }, "AML transaction check failed");
    return false;
  }
};

// ── Get compliance summary for a user ─────────────────────────────────────────

export const getUserComplianceSummary = async (userId) => {
  const [alerts, openCount] = await Promise.all([
    AmlAlert.find({ userId }).sort({ createdAt: -1 }).limit(20).lean(),
    AmlAlert.countDocuments({ userId, status: { $in: ["open", "under_review", "escalated"] } }),
  ]);
  return { alerts, openCount };
};

// ── Get all open AML alerts (admin) ───────────────────────────────────────────

export const getOpenAlerts = async (page = 1, limit = 50) => {
  const skip = (page - 1) * limit;
  const [alerts, total] = await Promise.all([
    AmlAlert.find({ status: { $in: ["open","under_review","escalated"] } })
      .sort({ riskScore: -1, createdAt: -1 })
      .skip(skip).limit(limit).lean(),
    AmlAlert.countDocuments({ status: { $in: ["open","under_review","escalated"] } }),
  ]);
  return { alerts, total, page, pages: Math.ceil(total / limit) };
};

// ── Admin: review/clear/escalate an alert ─────────────────────────────────────

export const reviewAlert = async (alertId, adminId, status, notes) => {
  const alert = await AmlAlert.findByIdAndUpdate(
    alertId,
    { status, reviewedBy: adminId, reviewedAt: new Date(), reviewNotes: notes },
    { new: true }
  );
  if (status === "cleared" && alert?.userId) {
    await User.findByIdAndUpdate(alert.userId, { status: "active" });
  }
  return alert;
};
