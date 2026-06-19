/**
 * Risk Engine — TrusonXchanger
 *
 * Evaluates user behaviour in real time and responds with flags, cooldowns,
 * or automatic account freezes.  Every decision is logged to RiskEvent for
 * compliance audits.
 *
 * Score bands:
 *   0–29   low       — normal limits
 *   30–59  medium    — tighter limits
 *   60–79  high      — minimal limits
 *   80–100 critical  — auto-freeze on next action
 */

import User        from "../models/User.js";
import RiskProfile from "../models/RiskProfile.js";
import RiskEvent   from "../models/RiskEvent.js";

// ── Config ────────────────────────────────────────────────────────────────────

const AUTO_FREEZE_SCORE = 80;
const MAX_IP_HISTORY    = 10;

// How much each active flag adds to the risk score
const FLAG_WEIGHTS = {
  velocity_breach:   25,
  ip_anomaly:        15,
  multiple_ips:      20,
  rapid_withdrawal:  30,
  large_withdrawal:  10,
  suspicious_trade:  35,
  failed_login:      15,
};

// Max orders per hour by risk level
const VELOCITY_LIMITS = {
  low:      100,
  medium:    40,
  high:      10,
  critical:   0,
};

// Large-withdrawal USD-equivalent thresholds per currency
const LARGE_THRESHOLD = { USD: 5_000, EUR: 4_500, NGN: 7_500_000 };

// Withdrawal cooldown durations (ms)
const COOLDOWN = {
  ip_change:        24 * 3_600_000, // 24 h
  rapid_withdrawal: 24 * 3_600_000, // 24 h
};

// ── In-memory velocity tracker (per-process sliding window) ──────────────────
// Key: userId string → array of timestamps within last 1 hour
const tradeWindow = new Map();

const _tradeCount = (userId) => {
  const id  = String(userId);
  const now = Date.now();
  const ts  = (tradeWindow.get(id) || []).filter((t) => now - t < 3_600_000);
  tradeWindow.set(id, ts);
  return ts.length;
};

const _recordTrade = (userId) => {
  const id  = String(userId);
  const now = Date.now();
  const ts  = (tradeWindow.get(id) || []).filter((t) => now - t < 3_600_000);
  ts.push(now);
  tradeWindow.set(id, ts);
  return ts.length;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const scoreToLevel = (score) => {
  if (score < 30) return "low";
  if (score < 60) return "medium";
  if (score < 80) return "high";
  return "critical";
};

const err = (msg, status = 403) =>
  Object.assign(new Error(msg), { statusCode: status });

// Upsert-safe profile loader — creates on first access
const loadProfile = async (userId) => {
  let profile = await RiskProfile.findOne({ user: userId });
  if (!profile) {
    profile = await RiskProfile.findOneAndUpdate(
      { user: userId },
      { $setOnInsert: { user: userId } },
      { upsert: true, new: true },
    );
  }
  return profile;
};

// Recalculate score from active flags + base factors, persist, and
// auto-freeze if crossing the critical threshold.
const recalculate = async (profile, opts = {}) => {
  const now  = Date.now();
  const user = await User.findById(profile.user).select("createdAt kycStatus").lean();

  let score = 0;

  // Base: new account
  if (user) {
    const ageDays = (now - new Date(user.createdAt).getTime()) / 86_400_000;
    if (ageDays < 3)  score += 20;
    else if (ageDays < 7)  score += 10;
    else if (ageDays < 30) score += 5;

    // Base: no KYC
    if (user.kycStatus !== "verified") score += 10;
  }

  // Active flags
  for (const flag of profile.flags) {
    if (!flag.expiresAt || new Date(flag.expiresAt).getTime() > now) {
      score += FLAG_WEIGHTS[flag.type] ?? 5;
    }
  }

  score = Math.min(100, score);
  const level = scoreToLevel(score);

  profile.score = score;
  profile.level = level;
  await profile.save();

  // Auto-freeze at critical threshold
  if (score >= AUTO_FREEZE_SCORE && !profile.frozen) {
    await _doFreeze(profile, "Automated: risk score reached critical threshold", "system", opts);
  }

  return profile;
};

const _addFlag = (profile, type, expiresAt, details) => {
  // Replace existing flag of the same type rather than stacking
  profile.flags = profile.flags.filter((f) => f.type !== type);
  profile.flags.push({ type, setAt: new Date(), expiresAt, details });
};

const _logEvent = async (userId, type, severity, details, action, ip, ua, score) =>
  RiskEvent.create({ user: userId, type, severity, details, action, ip, ua, score }).catch(() => {});

const _doFreeze = async (profile, reason, frozenBy, opts = {}) => {
  profile.frozen       = true;
  profile.frozenAt     = new Date();
  profile.frozenReason = reason;
  profile.frozenBy     = String(frozenBy);
  await profile.save();
  await _logEvent(
    profile.user, "auto_freeze", "critical",
    { reason },
    "frozen",
    opts.ip, opts.ua,
    profile.score,
  );
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Throw if the user's account is currently frozen.
 * Called at the start of every sensitive operation.
 */
export const checkFrozen = async (userId) => {
  const profile = await RiskProfile.findOne({ user: userId }).select("frozen frozenReason").lean();
  if (profile?.frozen) {
    throw err(
      `Your account has been frozen. Reason: ${profile.frozenReason || "contact support"}. Please reach out to support@trusonxchanger.com.`,
      403,
    );
  }
};

/**
 * Called after every successful login.
 * Detects new IPs, updates history, applies cooldowns.
 * Fire-and-forget — callers should .catch(() => {}).
 */
export const recordLogin = async (userId, ip, ua = "") => {
  const profile = await loadProfile(userId);
  const now     = new Date();

  // --- IP anomaly detection ---
  const recentIps = profile.ipHistory
    .filter((h) => now - new Date(h.seenAt).getTime() < 86_400_000)
    .map((h) => h.ip);

  const isNewIp    = !profile.ipHistory.some((h) => h.ip === ip);
  const uniqueLast24 = new Set(recentIps).size;

  if (isNewIp) {
    _addFlag(profile, "ip_anomaly", new Date(now.getTime() + 7 * 86_400_000), { ip });

    // Set withdrawal cooldown for 24 h after a new IP login
    profile.withdrawalCooldownUntil  = new Date(now.getTime() + COOLDOWN.ip_change);
    profile.withdrawalCooldownReason = "New login IP detected. 24-hour withdrawal hold for your security.";
    profile.lastIpChangeAt           = now;

    await _logEvent(
      userId, "ip_anomaly", "medium",
      { ip, previousIps: recentIps.slice(-3) },
      "cooldown_set", ip, ua, profile.score,
    );
  }

  if (uniqueLast24 >= 3 && isNewIp) {
    _addFlag(profile, "multiple_ips", new Date(now.getTime() + 3 * 86_400_000), { count: uniqueLast24 + 1 });
    await _logEvent(
      userId, "multiple_ips", "high",
      { count: uniqueLast24 + 1 },
      "flagged", ip, ua, profile.score,
    );
  }

  // Maintain rolling IP history
  profile.ipHistory.push({ ip, seenAt: now, ua });
  if (profile.ipHistory.length > MAX_IP_HISTORY) {
    profile.ipHistory = profile.ipHistory.slice(-MAX_IP_HISTORY);
  }

  profile.lastLoginAt = now;
  await recalculate(profile, { ip, ua });
};

/**
 * Called at the start of placeSpotOrder.
 * Throws if frozen or velocity limit exceeded.
 */
export const checkAndRecordTrade = async (userId) => {
  const profile = await loadProfile(userId);

  if (profile.frozen) {
    throw err(
      `Your account is frozen. Reason: ${profile.frozenReason || "contact support"}.`,
      403,
    );
  }

  const limit   = VELOCITY_LIMITS[profile.level] ?? VELOCITY_LIMITS.low;
  const current = _tradeCount(userId);

  if (current >= limit) {
    // Apply flag if not already flagged in last 5 minutes
    const recentVelocity = profile.flags.find(
      (f) => f.type === "velocity_breach" &&
             new Date(f.setAt).getTime() > Date.now() - 300_000,
    );
    if (!recentVelocity) {
      _addFlag(profile, "velocity_breach", new Date(Date.now() + 3_600_000), { count: current, limit });
      await recalculate(profile);
      await _logEvent(
        userId, "velocity_breach", "high",
        { count: current, limit, level: profile.level },
        "flagged", null, null, profile.score,
      );
    }
    throw err(
      `Trading velocity limit reached (${current}/${limit} orders/hour). Please wait before placing more orders.`,
      429,
    );
  }

  _recordTrade(userId);
};

/**
 * Called before processing a withdrawal.
 * Throws if frozen or still within cooldown window.
 */
export const checkWithdrawalAllowed = async (userId) => {
  const profile = await loadProfile(userId);

  if (profile.frozen) {
    throw err(
      `Your account is frozen. Reason: ${profile.frozenReason || "contact support"}.`,
      403,
    );
  }

  if (profile.withdrawalCooldownUntil && new Date(profile.withdrawalCooldownUntil) > new Date()) {
    const remainingMs = new Date(profile.withdrawalCooldownUntil) - Date.now();
    const remainingH  = Math.ceil(remainingMs / 3_600_000);
    throw err(
      `${profile.withdrawalCooldownReason || "Withdrawal is on hold."} Try again in ${remainingH} hour${remainingH === 1 ? "" : "s"}.`,
      403,
    );
  }
};

/**
 * Called after a successful withdrawal.
 * Applies flags for rapid-deposit-withdraw and large amounts.
 * Fire-and-forget — callers should .catch(() => {}).
 */
export const recordWithdrawal = async (userId, amount, currency) => {
  const profile = await loadProfile(userId);
  const now     = new Date();
  let   flagged = false;

  // Rapid withdrawal: funded and withdrawn within 2 hours
  if (profile.lastDepositAt) {
    const sinceDeposit = now - new Date(profile.lastDepositAt);
    if (sinceDeposit < 2 * 3_600_000) {
      _addFlag(profile, "rapid_withdrawal", new Date(now.getTime() + 7 * 86_400_000), { amount, currency });
      profile.withdrawalCooldownUntil  = new Date(now.getTime() + COOLDOWN.rapid_withdrawal);
      profile.withdrawalCooldownReason = "Rapid deposit-to-withdrawal detected. 24-hour hold applied for security.";
      flagged = true;
      await _logEvent(
        userId, "rapid_withdrawal", "high",
        { amount, currency, sinceDepositMs: sinceDeposit },
        "cooldown_set", null, null, profile.score,
      );
    }
  }

  // Large withdrawal
  const threshold = LARGE_THRESHOLD[currency];
  if (threshold && amount >= threshold) {
    _addFlag(profile, "large_withdrawal", new Date(now.getTime() + 3 * 86_400_000), { amount, currency });
    flagged = true;
    await _logEvent(
      userId, "large_withdrawal", "medium",
      { amount, currency, threshold },
      "flagged", null, null, profile.score,
    );
  }

  profile.lastWithdrawalAt = now;
  if (flagged) await recalculate(profile);
  else await profile.save();
};

/**
 * Call after a successful deposit to update the timestamp used by
 * rapid-withdrawal detection.
 */
export const recordDeposit = async (userId) => {
  await RiskProfile.findOneAndUpdate(
    { user: userId },
    { $set: { lastDepositAt: new Date() } },
    { upsert: true },
  );
};

/**
 * Admin: freeze an account manually.
 */
export const freezeAccount = async (userId, reason, adminId = "system") => {
  const profile = await loadProfile(userId);
  if (profile.frozen) return profile;

  profile.frozen       = true;
  profile.frozenAt     = new Date();
  profile.frozenReason = reason;
  profile.frozenBy     = String(adminId);
  await profile.save();

  await _logEvent(userId, "manual_freeze", "critical", { reason, adminId }, "frozen");
  return profile;
};

/**
 * Admin: unfreeze an account.
 */
export const unfreezeAccount = async (userId, adminId) => {
  const profile = await loadProfile(userId);
  profile.frozen       = false;
  profile.frozenAt     = undefined;
  profile.frozenReason = undefined;
  profile.frozenBy     = undefined;
  await profile.save();

  await _logEvent(userId, "manual_unfreeze", "low", { adminId }, "unfrozen");
  return profile;
};

/**
 * Full profile for the user-facing or admin API.
 */
export const getUserRiskProfile = async (userId) => {
  const profile = await loadProfile(userId);
  await recalculate(profile);
  return profile;
};

/**
 * Admin: list all high-risk and frozen users.
 */
export const getHighRiskProfiles = async (limit = 50) =>
  RiskProfile.find({ $or: [{ level: { $in: ["high", "critical"] } }, { frozen: true }] })
    .sort({ score: -1 })
    .limit(limit)
    .lean();

/**
 * Risk event log for a single user or the whole system.
 */
export const getUserRiskEvents = async (userId, limit = 50) =>
  RiskEvent.find({ user: userId }).sort({ createdAt: -1 }).limit(limit).lean();

export const getRecentRiskEvents = async (limit = 100) =>
  RiskEvent.find().sort({ createdAt: -1 }).limit(limit).lean();

/**
 * High-level system stats for the admin dashboard.
 */
export const getRiskStats = async () => {
  const [frozen, critical, high, medium, recentEvents] = await Promise.all([
    RiskProfile.countDocuments({ frozen: true }),
    RiskProfile.countDocuments({ level: "critical" }),
    RiskProfile.countDocuments({ level: "high" }),
    RiskProfile.countDocuments({ level: "medium" }),
    RiskEvent.countDocuments({ createdAt: { $gte: new Date(Date.now() - 86_400_000) } }),
  ]);
  return { frozen, critical, high, medium, recentEvents };
};
