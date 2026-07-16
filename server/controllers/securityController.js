import User              from "../models/User.js";
import AmlAlert           from "../models/AmlAlert.js";
import {
  generateApiKey, listApiKeys, revokeApiKey,
  listSessions, revokeSession, revokeAllSessions,
  adminRevokeAllSessions,
} from "../services/securityService.js";
import { getOpenAlerts, reviewAlert, getUserComplianceSummary }
  from "../services/complianceService.js";
import { auditSecurity, auditAdmin, auditCompliance } from "../services/auditService.js";
import { securityOrchestrator } from "../services/securityOrchestrator.js";
import { geoIpVerifier }        from "../services/geoIpVerifier.js";
import logger                   from "../config/logger.js";

// ══ API KEYS ══════════════════════════════════════════════════════════════════

export const createApiKey = async (req, res) => {
  const { label, scopes, ipWhitelist, expiresInDays } = req.body;
  if (!label?.trim()) return res.status(400).json({ message: "Label is required." });

  const { apiKey, rawKey } = await generateApiKey(req.user._id, {
    label: label.trim(), scopes, ipWhitelist, expiresInDays,
  });

  await auditSecurity(req, "API_KEY_CREATED", {
    severity: "info",
    metadata: { keyPrefix: apiKey.prefix, scopes: apiKey.scopes, label: apiKey.label },
  });

  res.status(201).json({ apiKey, rawKey }); // rawKey shown ONCE — warn user to copy it
};

export const getApiKeys = async (req, res) => {
  const keys = await listApiKeys(req.user._id);
  res.json({ keys });
};

export const deleteApiKey = async (req, res) => {
  const { reason } = req.body;
  const key = await revokeApiKey(req.user._id, req.params.id, reason);

  await auditSecurity(req, "API_KEY_REVOKED", {
    severity: "warning",
    metadata: { keyPrefix: key.prefix, label: key.label, reason },
  });

  res.json({ message: "API key revoked." });
};

// ══ SESSIONS ══════════════════════════════════════════════════════════════════

export const getSessions = async (req, res) => {
  const sessions = await listSessions(req.user._id);
  res.json({ sessions });
};

export const revokeSessionHandler = async (req, res) => {
  const session = await revokeSession(req.user._id, req.params.sessionId);

  await auditSecurity(req, "SESSION_REVOKED", {
    severity: "warning",
    metadata: { revokedSessionId: session.sessionId, browser: session.browser, os: session.os, ip: session.ipAddress },
  });

  res.json({ message: "Session revoked." });
};

export const revokeAllSessionsHandler = async (req, res) => {
  const count = await revokeAllSessions(req.user._id, req.headers["x-session-id"] || null);

  await auditSecurity(req, "ALL_SESSIONS_REVOKED", {
    severity: "critical",
    metadata: { count },
  });

  res.json({ message: `${count} session(s) revoked.`, count });
};

// ══ AML ALERTS — Admin ════════════════════════════════════════════════════════

export const getAmlAlerts = async (req, res) => {
  const { page, limit } = req.query;
  const result = await getOpenAlerts(Number(page) || 1, Number(limit) || 50);
  res.json(result);
};

export const getAmlAlertById = async (req, res) => {
  const alert = await AmlAlert.findById(req.params.id).populate("userId", "email name kycStatus status").lean();
  if (!alert) return res.status(404).json({ message: "Alert not found." });
  res.json({ alert });
};

export const reviewAmlAlert = async (req, res) => {
  const { status, notes } = req.body;
  const allowed = ["under_review", "cleared", "escalated", "frozen"];
  if (!allowed.includes(status)) return res.status(400).json({ message: "Invalid status." });

  const alert = await reviewAlert(req.params.id, req.user._id, status, notes);
  if (!alert) return res.status(404).json({ message: "Alert not found." });

  await auditCompliance(req, "AML_ALERT_REVIEWED", {
    severity: status === "cleared" ? "info" : "warning",
    metadata: { alertId: alert._id, alertType: alert.alertType, status, notes },
  });

  res.json({ alert });
};

// ══ USER SECURITY SUMMARY (user's own view) ════════════════════════════════════

export const getMySecuritySummary = async (req, res) => {
  const [sessions, keys, compliance] = await Promise.all([
    listSessions(req.user._id),
    listApiKeys(req.user._id),
    getUserComplianceSummary(req.user._id),
  ]);

  // lean() skips the toJSON _id→id transform; serialise manually so the
  // client receives a stable string `id` field on every API key object.
  const apiKeys = keys.map(k => ({ ...k, id: String(k._id) }));

  res.json({
    sessions,
    apiKeys,
    currentSessionId: req.sessionId || null,
    kycStatus: req.user.kycStatus,
    accountStatus: req.user.status,
    compliance: {
      openAlerts: compliance.openCount,
      recentAlerts: compliance.alerts.slice(0, 5),
    },
  });
};

// ══ Admin: freeze / unfreeze account ══════════════════════════════════════════

export const adminFreezeUser = async (req, res) => {
  const { reason = "" } = req.body;
  const user = await User.findByIdAndUpdate(
    req.params.userId,
    { status: "suspended" },
    { new: true }
  );
  if (!user) return res.status(404).json({ message: "User not found." });

  await adminRevokeAllSessions(user._id);

  await auditAdmin(req, "USER_FROZEN", {
    severity: "critical",
    metadata: { targetUserId: user._id, targetEmail: user.email, reason },
    userId: req.user._id, userEmail: req.user.email,
  });

  res.json({ message: "Account frozen and all sessions revoked.", user });
};

export const adminUnfreezeUser = async (req, res) => {
  const { reason = "" } = req.body;
  const user = await User.findByIdAndUpdate(
    req.params.userId,
    { status: "active" },
    { new: true }
  );
  if (!user) return res.status(404).json({ message: "User not found." });

  await auditAdmin(req, "USER_UNFROZEN", {
    severity: "warning",
    metadata: { targetUserId: user._id, targetEmail: user.email, reason },
    userId: req.user._id, userEmail: req.user.email,
  });

  res.json({ message: "Account reactivated.", user });
};

// ══ ZERO-TRUST SECURITY MODEL ══════════════════════════════════════════════════

/** Full zero-trust trust evaluation for the current request / user. */
export const getTrustEvaluation = async (req, res) => {
  try {
    const sessionId = req.headers["x-session-id"] || req.sessionId || "unknown";
    const trust = await securityOrchestrator.evaluateTrust(req, req.user._id, sessionId);
    res.json({ success: true, data: trust });
  } catch (err) {
    logger.error({ err: err.message }, "[Security] getTrustEvaluation failed");
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Issue a step-up authentication token for the current session. */
export const issueStepUpToken = async (req, res) => {
  try {
    const sessionId = req.headers["x-session-id"] || req.sessionId || "unknown";
    const { method = "totp" } = req.body;
    const result = await securityOrchestrator.issueStepUpToken(req.user._id, sessionId, method);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Verify a step-up token to reduce session risk score. */
export const verifyStepUpToken = async (req, res) => {
  try {
    const sessionId = req.headers["x-session-id"] || req.sessionId || "unknown";
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: "token is required." });

    const result = await securityOrchestrator.verifyStepUpToken(req.user._id, sessionId, token);
    if (!result.valid) return res.status(401).json({ success: false, message: result.reason });

    res.json({ success: true, message: "Step-up authentication verified." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Geo-IP lookup for the caller's IP. */
export const getGeoInfo = async (req, res) => {
  try {
    const ip  = req.query.ip || req.ip || "0.0.0.0";
    const geo = await geoIpVerifier.lookup(ip);
    res.json({ success: true, data: geo });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Platform-wide security health summary (admin only). */
export const getSecurityHealth = async (req, res) => {
  try {
    const summary = await securityOrchestrator.getSecurityHealthSummary();
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
