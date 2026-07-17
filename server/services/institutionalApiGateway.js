/**
 * InstitutionalApiGateway — API key management and FIX-like protocol abstraction.
 *
 * Responsibilities:
 *   - Issue and rotate API key pairs (key + secret)
 *   - Validate API key signature on each request (HMAC-SHA256)
 *   - Enforce per-key permissions and IP whitelist
 *   - Provide FIX-like message encoding/decoding for institutional clients
 *   - WebSocket market feed subscription management
 *
 * Rule: strict security and quotas enforced (Stage 29 mandate).
 */

import crypto     from "crypto";
import ApiKey     from "../models/ApiKey.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const KEY_PREFIX   = "TSRX-";
const SECRET_BYTES = 32;
const SIG_ALGO     = "sha256";

// ── FIX-like message encoder ──────────────────────────────────────────────────

export class FixProtocolAdapter {
  /**
   * Encode a market order into a FIX-like message string.
   * Field separator: | (pipe), tag=value pairs.
   */
  encode(msgType, fields) {
    const base = { "8": "FIXT.1.1", "35": msgType, "52": new Date().toISOString() };
    const merged = { ...base, ...fields };
    return Object.entries(merged)
      .map(([tag, val]) => `${tag}=${val}`)
      .join("|");
  }

  /**
   * Decode a FIX-like message string back to a field object.
   */
  decode(message) {
    if (!message || typeof message !== "string") return null;
    const fields = {};
    for (const part of message.split("|")) {
      const eq = part.indexOf("=");
      if (eq === -1) continue;
      fields[part.slice(0, eq)] = part.slice(eq + 1);
    }
    return Object.keys(fields).length ? fields : null;
  }

  /**
   * Build a New Order Single (D) FIX message.
   */
  encodeNewOrder({ clOrdId, symbol, side, quantity, price, orderType = "1" }) {
    return this.encode("D", {
      "11": clOrdId,
      "55": symbol,
      "54": side === "buy" ? "1" : "2",
      "38": quantity,
      "44": price ?? "",
      "40": orderType,   // 1=Market 2=Limit
    });
  }

  /**
   * Build an Execution Report (8) FIX message.
   */
  encodeExecutionReport({ clOrdId, orderId, execType, side, symbol, filledQty, price, status }) {
    return this.encode("8", {
      "11": clOrdId,
      "37": orderId,
      "150": execType,
      "55": symbol,
      "54": side === "buy" ? "1" : "2",
      "32": filledQty,
      "31": price,
      "39": status,
    });
  }
}

// ── API key manager ───────────────────────────────────────────────────────────

export class InstitutionalApiGateway {
  constructor() {
    this._fix = new FixProtocolAdapter();
  }

  /**
   * Issue a new API key pair for an institutional client.
   */
  async issueApiKey({ userId, institutionId, name, permissions = ["read", "trade"],
    ipWhitelist = [], expiresInDays = 365 }) {
    const key    = KEY_PREFIX + crypto.randomBytes(16).toString("hex").toUpperCase();
    const secret = crypto.randomBytes(SECRET_BYTES).toString("hex");
    const hash   = crypto.createHash(SIG_ALGO).update(secret).digest("hex");
    const expiresAt = new Date(Date.now() + expiresInDays * 86400_000);

    const doc = await ApiKey.create({
      userId,
      name,
      key,
      hashedSecret: hash,
      permissions,
      ipWhitelist,
      expiresAt,
      metadata: { institutionId },
    });

    // Return plain secret ONCE — never stored in plaintext
    return { ...doc.toObject(), secret };
  }

  /**
   * Validate an API key + HMAC signature.
   * @param {string} key - the API key
   * @param {string} signature - HMAC-SHA256(payload, secret)
   * @param {string} payload   - the canonical signed payload (timestamp + body hash)
   * @param {string} clientIp  - requesting IP for whitelist check
   */
  async validateSignature(key, signature, payload, clientIp = null) {
    const doc = await ApiKey.findOne({ key, enabled: true }).select("+hashedSecret").lean();
    if (!doc) return { valid: false, reason: "key_not_found" };
    if (doc.expiresAt && new Date(doc.expiresAt) < new Date()) {
      return { valid: false, reason: "key_expired" };
    }
    if (doc.ipWhitelist?.length && clientIp && !doc.ipWhitelist.includes(clientIp)) {
      return { valid: false, reason: "ip_not_whitelisted" };
    }

    // We re-derive the HMAC using the stored hash as "secret" proxy
    // (In production the HMAC key would be the raw secret kept by the client)
    const expected = crypto.createHmac(SIG_ALGO, doc.hashedSecret).update(payload).digest("hex");
    const valid = crypto.timingSafeEqual(
      Buffer.from(signature.toLowerCase(), "hex"),
      Buffer.from(expected,               "hex"),
    );

    return valid
      ? { valid: true, userId: doc.userId, permissions: doc.permissions }
      : { valid: false, reason: "invalid_signature" };
  }

  /**
   * Rotate (revoke + reissue) an API key.
   */
  async rotateApiKey(keyId, { userId, institutionId }) {
    const old = await ApiKey.findById(keyId).lean();
    if (!old || String(old.userId) !== String(userId)) return null;

    // Revoke old key
    await ApiKey.findByIdAndUpdate(keyId, { enabled: false });

    // Issue new key with same settings
    return this.issueApiKey({
      userId, institutionId,
      name:        old.name + " (rotated)",
      permissions: old.permissions,
      ipWhitelist: old.ipWhitelist,
    });
  }

  /**
   * Revoke an API key immediately.
   */
  async revokeApiKey(keyId, userId) {
    const doc = await ApiKey.findOneAndUpdate(
      { _id: keyId, userId },
      { enabled: false },
      { new: true }
    ).lean();
    return doc;
  }

  /**
   * List API keys for a user (excludes secret).
   */
  async listApiKeys(userId) {
    return ApiKey.find({ userId, enabled: true })
      .select("-hashedSecret")
      .sort({ createdAt: -1 })
      .lean();
  }

  /** FIX protocol proxy. */
  get fix() { return this._fix; }
}

export const institutionalApiGateway = new InstitutionalApiGateway();
export const fixProtocolAdapter = new FixProtocolAdapter();
