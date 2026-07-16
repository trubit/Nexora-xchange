/**
 * Device Fingerprint Engine
 *
 * Produces a multi-factor device fingerprint for every request and computes
 * a trust score (0-100) by comparing against the user's known devices.
 *
 * Factors:
 *   - User-Agent + Accept headers hash
 *   - Accept-Language / Accept-Encoding
 *   - TLS/network characteristics (cipher hint from x-forwarded-proto)
 *   - Client timezone (from X-Client-Timezone header or Accept-Language heuristic)
 *   - Screen / platform hints (Sec-CH-UA client hints)
 *   - IP subnet (first two octets — stable within carrier NAT)
 *
 * All factor hashes are stored as SHA-256 so PII never rests in plain text.
 */

import crypto      from "crypto";
import DeviceSession from "../models/DeviceSession.js";
import { redisClients } from "../config/redis.js";
import logger      from "../config/logger.js";

const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

// Redis key prefix + TTL for known device cache
const CACHE_KEY = "dfp:known:";
const CACHE_TTL = 3600;  // 1 hour

// Weights for each fingerprint factor (sum = 1.0)
const FACTOR_WEIGHTS = {
  ua:       0.25,
  headers:  0.15,
  language: 0.10,
  subnet:   0.20,
  platform: 0.15,
  timezone: 0.15,
};

export class DeviceFingerprintEngine {
  /**
   * Extract and hash all fingerprint factors from a request.
   * Returns a fingerprint object (no raw PII).
   */
  extract(req) {
    const ua       = req.headers["user-agent"]            || "";
    const lang     = req.headers["accept-language"]       || "";
    const encoding = req.headers["accept-encoding"]       || "";
    const accept   = req.headers["accept"]                || "";
    const platform = req.headers["sec-ch-ua-platform"]    || "";
    const mobile   = req.headers["sec-ch-ua-mobile"]      || "";
    const chUa     = req.headers["sec-ch-ua"]             || "";
    const timezone = req.headers["x-client-timezone"]     || "";
    const rawIp    = req.ip || req?.socket?.remoteAddress || "0.0.0.0";
    const subnet   = this._ipSubnet(rawIp);

    return {
      factors: {
        ua:       sha256(ua),
        headers:  sha256(`${encoding}|${accept}`),
        language: sha256(lang.slice(0, 2)),  // first locale only for stability
        subnet:   sha256(subnet),
        platform: sha256(`${platform}|${mobile}|${chUa}`),
        timezone: sha256(timezone || lang.slice(0, 2)),
      },
      // composite fingerprint = hash of all factor hashes
      composite: sha256([ua, lang, encoding, accept, platform, mobile, chUa, subnet].join("|")),
      meta: {
        browser:    this._parseBrowser(ua),
        os:         this._parseOs(ua),
        deviceType: this._parseDeviceType(ua),
      },
    };
  }

  /**
   * Compute a trust score (0-100) for this fingerprint against
   * the user's historically seen fingerprints.
   *
   * 100 = perfect match with a known device
   * 0   = completely unrecognised fingerprint
   */
  async computeTrustScore(userId, fingerprint) {
    const uid       = String(userId);
    const cacheKey  = `${CACHE_KEY}${uid}`;

    // Try Redis cache first
    let knownFactors = null;
    const redis = redisClients.cache;
    if (redis) {
      try {
        const raw = await redis.get(cacheKey);
        if (raw) knownFactors = JSON.parse(raw);
      } catch { /* skip */ }
    }

    if (!knownFactors) {
      // Load from DB: aggregate factor hashes seen for this user across active sessions
      const sessions = await DeviceSession.find(
        { userId, isActive: true },
        { deviceFingerprint: 1, _id: 0 },
      ).lean();

      if (sessions.length === 0) {
        // Brand-new user — first device gets a baseline trust of 60
        return { score: 60, isKnown: false, matchedFactors: [], reason: "First device" };
      }

      // For existing users, we only have the composite hash. Treat any composite match as known.
      knownFactors = { composites: sessions.map((s) => s.deviceFingerprint) };

      if (redis) {
        try {
          await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(knownFactors));
        } catch { /* skip */ }
      }
    }

    // Check composite match first (fast path)
    if (knownFactors.composites?.includes(fingerprint.composite)) {
      return { score: 100, isKnown: true, matchedFactors: ["composite"], reason: "Known device" };
    }

    // Partial match — score based on individual factor hashes
    const factorHashes = knownFactors.factorSets || [];
    let bestScore = 0;
    for (const knownSet of factorHashes) {
      let match = 0;
      for (const [factor, weight] of Object.entries(FACTOR_WEIGHTS)) {
        if (knownSet[factor] === fingerprint.factors[factor]) match += weight;
      }
      bestScore = Math.max(bestScore, match);
    }

    const score = Math.round(bestScore * 100);
    const reason = score >= 70 ? "Partial fingerprint match" : "Unrecognised device";
    return { score, isKnown: score >= 80, matchedFactors: [], reason };
  }

  /**
   * Record this fingerprint as a trusted device for the user
   * (called after successful MFA or first login).
   */
  async recordDevice(userId, fingerprint) {
    const cacheKey = `${CACHE_KEY}${String(userId)}`;
    const redis = redisClients.cache;
    if (redis) {
      try { await redis.del(cacheKey); } catch { /* skip */ }
    }

    // The DeviceSession model already stores composite fingerprint.
    // Extend it here with individual factor hashes if needed via an update.
    await DeviceSession.updateMany(
      { userId, deviceFingerprint: fingerprint.composite, isActive: true },
      { $set: { fingerprintFactors: fingerprint.factors, fingerprintMeta: fingerprint.meta } },
    ).catch((err) => logger.warn({ err: err.message }, "[DFP] recordDevice update failed."));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  _ipSubnet(ip) {
    if (!ip || ip === "::1" || ip === "127.0.0.1") return "localhost";
    // IPv4: return first two octets  (e.g. "192.168")
    const v4 = ip.replace(/^::ffff:/, "");
    const parts = v4.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}`;
    // IPv6: return first 4 groups
    return ip.split(":").slice(0, 4).join(":");
  }

  _parseBrowser(ua) {
    if (/Edg\//.test(ua))       return "Edge";
    if (/OPR\/|Opera/.test(ua)) return "Opera";
    if (/Chrome\//.test(ua))    return "Chrome";
    if (/Firefox\//.test(ua))   return "Firefox";
    if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return "Safari";
    return "Unknown";
  }

  _parseOs(ua) {
    if (/Windows NT 10|Windows NT 11/.test(ua)) return "Windows 10/11";
    if (/Windows NT/.test(ua))  return "Windows";
    if (/Mac OS X/.test(ua))    return "macOS";
    if (/iPhone|iPad/.test(ua)) return "iOS";
    if (/Android/.test(ua))     return "Android";
    if (/Linux/.test(ua))       return "Linux";
    return "Unknown";
  }

  _parseDeviceType(ua) {
    if (/Mobile|iPhone/.test(ua))    return "mobile";
    if (/iPad|Tablet/.test(ua))      return "tablet";
    if (this._parseBrowser(ua) !== "Unknown") return "desktop";
    return "unknown";
  }
}

export const deviceFingerprintEngine = new DeviceFingerprintEngine();
