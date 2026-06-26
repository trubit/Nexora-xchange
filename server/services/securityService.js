/**
 * security-service — API key management + device session tracking.
 */

import crypto     from "crypto";
import { v4 as uuid } from "uuid";
import ApiKey      from "../models/ApiKey.js";
import DeviceSession from "../models/DeviceSession.js";
import logger      from "../config/logger.js";

// ── Helpers ────────────────────────────────────────────────────────────────────

const sha256 = (str) => crypto.createHash("sha256").update(str).digest("hex");

const parseUA = (ua = "") => {
  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /OPR\/|Opera/.test(ua) ? "Opera" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Safari\//.test(ua) && !/Chrome/.test(ua) ? "Safari" : "Unknown";

  const os =
    /Windows NT 10/.test(ua) ? "Windows 10/11" :
    /Windows NT/.test(ua) ? "Windows" :
    /Mac OS X/.test(ua) ? "macOS" :
    /iPhone|iPad/.test(ua) ? "iOS" :
    /Android/.test(ua) ? "Android" :
    /Linux/.test(ua) ? "Linux" : "Unknown";

  const deviceType =
    /Mobile|Android.*Mobile|iPhone/.test(ua) ? "mobile" :
    /iPad|Tablet/.test(ua) ? "tablet" :
    browser !== "Unknown" ? "desktop" : "unknown";

  return { browser, os, deviceType };
};

const parseIp = (req) => req.ip || req?.socket?.remoteAddress || "unknown";

// ── API Key Management ─────────────────────────────────────────────────────────

export const generateApiKey = async (userId, { label, scopes = ["read"], ipWhitelist = [], expiresInDays = null }) => {
  // Generate a cryptographically secure key: prefix_base62random
  const rawKey = `txk_${crypto.randomBytes(32).toString("base64url")}`;
  const keyHash = sha256(rawKey);
  const prefix  = rawKey.slice(0, 12);

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const record = await ApiKey.create({
    userId, label, keyHash, prefix, scopes, ipWhitelist, expiresAt,
  });

  return { apiKey: record.toJSON(), rawKey }; // rawKey shown only once
};

export const listApiKeys = async (userId) =>
  ApiKey.find({ userId, isActive: true }).sort({ createdAt: -1 }).lean();

export const revokeApiKey = async (userId, keyId, reason = "") => {
  const key = await ApiKey.findOneAndUpdate(
    { _id: keyId, userId },
    { isActive: false, revokedAt: new Date(), revokedReason: reason },
    { new: true }
  );
  if (!key) throw new Error("API key not found.");
  return key;
};

export const validateApiKey = async (rawKey, requiredScope, clientIp) => {
  if (!rawKey?.startsWith("txk_")) return null;

  const keyHash = sha256(rawKey);
  const key = await ApiKey.findOne({ keyHash, isActive: true }).select("+keyHash").lean();
  if (!key) return null;

  // Expired?
  if (key.expiresAt && key.expiresAt < new Date()) {
    await ApiKey.findByIdAndUpdate(key._id, { isActive: false });
    return null;
  }

  // IP whitelist check
  if (key.ipWhitelist.length && !key.ipWhitelist.includes(clientIp)) return null;

  // Scope check
  if (requiredScope && !key.scopes.includes(requiredScope)) return null;

  // Update usage stats (fire-and-forget)
  ApiKey.findByIdAndUpdate(key._id, {
    lastUsedAt: new Date(), lastUsedIp: clientIp,
    $inc: { usageCount: 1 },
  }).catch(() => {});

  return key;
};

// ── Device Session Management ──────────────────────────────────────────────────

export const createSession = async (req, userId) => {
  try {
    const ip = parseIp(req);
    const ua = req?.headers?.["user-agent"] || "";
    const sessionId = uuid();
    const { browser, os, deviceType } = parseUA(ua);

    // Simple fingerprint — stable per device/browser
    const deviceFingerprint = sha256(`${ua}|${req?.headers?.["accept-language"] || ""}`);

    const session = await DeviceSession.create({
      userId, sessionId, deviceFingerprint,
      ipAddress: ip, userAgent: ua,
      browser, os, deviceType,
    });

    return session.sessionId;
  } catch (err) {
    logger.error({ err, userId }, "session creation failed");
    return null;
  }
};

export const touchSession = async (sessionId) => {
  if (!sessionId) return;
  DeviceSession.findOneAndUpdate(
    { sessionId, isActive: true },
    { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
  ).catch(() => {});
};

export const listSessions = async (userId) =>
  DeviceSession.find({ userId, isActive: true }).sort({ lastSeenAt: -1 }).lean();

export const revokeSession = async (userId, sessionId) => {
  const session = await DeviceSession.findOneAndUpdate(
    { sessionId, userId, isActive: true },
    { isActive: false, revokedAt: new Date(), revokedBy: "user" },
    { new: true }
  );
  if (!session) throw new Error("Session not found.");
  return session;
};

export const revokeAllSessions = async (userId, exceptSessionId = null) => {
  const query = { userId, isActive: true };
  if (exceptSessionId) query.sessionId = { $ne: exceptSessionId };
  const result = await DeviceSession.updateMany(query, {
    isActive: false, revokedAt: new Date(), revokedBy: "user",
  });
  return result.modifiedCount;
};

// Admin: revoke a specific user's all sessions
export const adminRevokeAllSessions = async (userId) => {
  const result = await DeviceSession.updateMany(
    { userId, isActive: true },
    { isActive: false, revokedAt: new Date(), revokedBy: "admin" }
  );
  return result.modifiedCount;
};

// Is new device? (not seen in last 30 days)
export const isNewDevice = async (userId, req) => {
  const ua = req?.headers?.["user-agent"] || "";
  const fingerprint = sha256(`${ua}|${req?.headers?.["accept-language"] || ""}`);
  const existing = await DeviceSession.findOne({
    userId, deviceFingerprint: fingerprint, isActive: true,
  });
  return !existing;
};
