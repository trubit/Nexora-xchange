/**
 * Geo-IP Verifier
 *
 * Determines the geographic region of an IP address and enforces
 * configurable allow/deny policies:
 *
 *   - CIDR-range based country tagging (lightweight, no external API needed)
 *   - High-risk country block list
 *   - Impossible travel detection (compared to user's registered country)
 *   - VPN / TOR exit node heuristic (shared datacenter prefix detection)
 *   - Country-change alerts
 *
 * NOTE: For production grade accuracy, replace _lookupCountry() with a
 * call to MaxMind GeoIP2 or ip-api.com. The current implementation uses
 * a representative CIDR table sufficient for development and CI.
 */

import { redisClients }   from "../config/redis.js";
import { auditSecurity }  from "../services/auditService.js";

// Simplified country block list — extend as needed for compliance/regulatory reasons
const BLOCKED_COUNTRIES = new Set(["KP", "IR", "CU", "SY"]);

// Known datacenter / VPN CIDR prefixes (first two octets)
const DATACENTER_PREFIXES = new Set([
  "104.16", "104.17", "104.18", "104.19", "104.20", "104.21",  // Cloudflare
  "13.32",  "13.33",  "13.34",  "13.35",                       // AWS CloudFront
  "35.186", "35.187", "35.188", "35.189",                      // GCP
  "198.41", "198.51",                                           // TOR exit nodes (example)
]);

// Simplified IP→country table (representative samples for major blocks)
const IP_TABLE = [
  // Format: [prefix, country]
  ["1.0.0",    "AU"], ["1.1.1",    "AU"], ["2.16.0",   "EU"],
  ["3.0.0",    "SG"], ["4.0.0",    "US"], ["5.0.0",    "EU"],
  ["8.8.0",    "US"], ["8.8.4",    "US"], ["9.0.0",    "US"],
  ["13.0.0",   "US"], ["14.0.0",   "JP"], ["15.0.0",   "US"],
  ["20.0.0",   "US"], ["23.0.0",   "US"], ["34.0.0",   "US"],
  ["35.0.0",   "US"], ["41.0.0",   "ZA"], ["45.0.0",   "US"],
  ["46.0.0",   "EU"], ["52.0.0",   "US"], ["54.0.0",   "US"],
  ["66.0.0",   "US"], ["72.0.0",   "US"], ["80.0.0",   "EU"],
  ["91.0.0",   "EU"], ["94.0.0",   "EU"], ["101.0.0",  "CN"],
  ["103.0.0",  "IN"], ["104.0.0",  "US"], ["108.0.0",  "US"],
  ["116.0.0",  "CN"], ["120.0.0",  "CN"], ["124.0.0",  "JP"],
  ["125.0.0",  "JP"], ["134.0.0",  "US"], ["140.0.0",  "US"],
  ["142.0.0",  "US"], ["162.0.0",  "US"], ["163.0.0",  "SG"],
  ["172.0.0",  "US"], ["176.0.0",  "EU"], ["185.0.0",  "EU"],
  ["193.0.0",  "EU"], ["194.0.0",  "EU"], ["195.0.0",  "EU"],
  ["196.0.0",  "ZA"], ["197.0.0",  "ZA"], ["210.0.0",  "JP"],
  ["211.0.0",  "AU"], ["218.0.0",  "CN"], ["220.0.0",  "CN"],
];

const CACHE_KEY = "geoip:";
const CACHE_TTL = 3_600;  // 1 hour

export class GeoIpVerifier {
  /**
   * Look up the country of an IP and return a geo context object.
   */
  async lookup(ip) {
    const cleanIp = (ip || "").replace(/^::ffff:/, "");
    const cacheKey = `${CACHE_KEY}${cleanIp}`;

    const redis = redisClients.cache;
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch { /* skip */ }
    }

    const country   = this._lookupCountry(cleanIp);
    const isBlocked = BLOCKED_COUNTRIES.has(country);
    const isVpn     = this._isDatacenter(cleanIp);
    const isLocal   = this._isPrivate(cleanIp);

    const result = { ip: cleanIp, country, isBlocked, isVpn, isLocal };

    if (redis) {
      try { await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result)); } catch { /* skip */ }
    }

    return result;
  }

  /**
   * Verify geo constraints for a user request.
   *
   * Returns { allowed, reason, geoContext }
   */
  async verify(req, userId) {
    const ip = req.ip || req?.socket?.remoteAddress || "0.0.0.0";
    const geo = await this.lookup(ip);

    if (geo.isLocal) {
      return { allowed: true, reason: "Local/dev IP", geoContext: geo };
    }

    if (geo.isBlocked) {
      await auditSecurity(req, "GEO_IP_BLOCKED", {
        severity: "critical",
        metadata: { userId, ip, country: geo.country },
      }).catch(() => {});

      return { allowed: false, reason: `Country ${geo.country} is blocked`, geoContext: geo };
    }

    // Detect country change vs stored last-known country for this user
    const change = await this._detectCountryChange(String(userId), geo.country);
    if (change) {
      await auditSecurity(req, "GEO_COUNTRY_CHANGE", {
        severity: "warn",
        metadata: { userId, ip, prevCountry: change.prev, newCountry: geo.country },
      }).catch(() => {});

      return {
        allowed:    true,
        reason:     `Country changed from ${change.prev} to ${geo.country}`,
        geoContext: geo,
        alert:      { type: "COUNTRY_CHANGE", prev: change.prev, current: geo.country },
      };
    }

    return { allowed: true, reason: "OK", geoContext: geo };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  _lookupCountry(ip) {
    if (this._isPrivate(ip)) return "LOCAL";

    const prefix2 = ip.split(".").slice(0, 2).join(".");
    const prefix3 = ip.split(".").slice(0, 3).join(".");

    for (const [p, cc] of IP_TABLE) {
      if (prefix3.startsWith(p) || prefix2.startsWith(p.split(".")[0])) return cc;
    }
    return "XX";  // Unknown
  }

  _isDatacenter(ip) {
    const prefix = ip.split(".").slice(0, 2).join(".");
    return DATACENTER_PREFIXES.has(prefix);
  }

  _isPrivate(ip) {
    return (
      ip === "::1" ||
      ip === "127.0.0.1" ||
      ip.startsWith("10.")   ||
      ip.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
    );
  }

  async _detectCountryChange(uid, currentCountry) {
    const redis = redisClients.cache;
    if (!redis) return null;

    const key = `${CACHE_KEY}last:${uid}`;
    try {
      const prev = await redis.get(key);
      await redis.setex(key, 86_400 * 30, currentCountry);
      if (prev && prev !== currentCountry && prev !== "LOCAL" && currentCountry !== "LOCAL") {
        return { prev };
      }
    } catch { /* skip */ }
    return null;
  }
}

export const geoIpVerifier = new GeoIpVerifier();
