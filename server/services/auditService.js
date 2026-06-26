/**
 * audit-service — immutable, chained audit logging.
 *
 * Usage:
 *   import { audit } from "./auditService.js";
 *   await audit(req, { category: "trade", action: "ORDER_PLACED",
 *                       severity: "info", metadata: { pair, side, qty } });
 *
 * Chain integrity: each entry hashes prevHash+userId+action+ts+metadata.
 * A verifyChain() helper lets admins confirm no entry was tampered with.
 */

import AuditLog from "../models/AuditLog.js";
import logger   from "../config/logger.js";

// ── Helpers ────────────────────────────────────────────────────────────────────

const parseIp = (req) =>
  (req?.headers?.["x-forwarded-for"] || "").split(",")[0].trim() ||
  req?.socket?.remoteAddress || "unknown";

const parseUA = (req) => req?.headers?.["user-agent"] || "unknown";

// ── Core log function ──────────────────────────────────────────────────────────

export const audit = async (req, {
  category, action, severity = "info", metadata = {},
  userId = null, userEmail = null,
}) => {
  try {
    const uid   = userId   ?? req?.user?._id   ?? null;
    const email = userEmail ?? req?.user?.email ?? "";
    const ts    = new Date();

    const prevHash = uid
      ? await AuditLog.latestHash(uid)
      : "GENESIS";

    const hash = AuditLog.computeHash({
      prevHash, userId: String(uid), action, timestamp: ts.toISOString(), metadata,
    });

    await AuditLog.create({
      userId: uid, userEmail: email,
      category, action, severity,
      ip:        parseIp(req),
      userAgent: parseUA(req),
      sessionId: req?.sessionId || "",
      metadata,
      prevHash, hash,
    });
  } catch (err) {
    // Never throw — logging must not break business logic
    logger.error({ err, action }, "audit write failed");
  }
};

// ── Convenience wrappers ───────────────────────────────────────────────────────

export const auditAuth     = (req, action, meta = {}) => audit(req, { category: "auth",       action, ...meta });
export const auditTrade    = (req, action, meta = {}) => audit(req, { category: "trade",      action, ...meta });
export const auditWallet   = (req, action, meta = {}) => audit(req, { category: "wallet",     action, ...meta });
export const auditAdmin    = (req, action, meta = {}) => audit(req, { category: "admin",      action, ...meta });
export const auditSecurity = (req, action, meta = {}) => audit(req, { category: "security",   action, ...meta });
export const auditCompliance = (req, action, meta = {}) => audit(req, { category: "compliance", action, ...meta });

// ── Chain-integrity verifier ───────────────────────────────────────────────────

export const verifyChain = async (userId) => {
  const logs = await AuditLog.find({ userId }).sort({ _id: 1 }).lean();
  if (!logs.length) return { valid: true, count: 0, broken: null };

  for (let i = 0; i < logs.length; i++) {
    const l = logs[i];
    const expected = AuditLog.computeHash({
      prevHash:  l.prevHash,
      userId:    String(l.userId),
      action:    l.action,
      timestamp: l.createdAt.toISOString(),
      metadata:  l.metadata,
    });
    if (expected !== l.hash) {
      return { valid: false, count: logs.length, broken: { index: i, id: l._id } };
    }
  }
  return { valid: true, count: logs.length, broken: null };
};
