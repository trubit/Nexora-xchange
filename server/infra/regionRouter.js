/**
 * Region Router Service
 *
 * Maps an incoming request (by IP or explicit header) to the nearest
 * regional cluster. Falls back gracefully when geoip-lite is not installed.
 *
 * Resolution priority:
 *   1. X-Region header (internal / CDN override)
 *   2. geoip-lite country lookup → COUNTRY_REGION_MAP
 *   3. geoip-lite continent lookup → CONTINENT_REGION_MAP
 *   4. DEFAULT_REGION
 */

import {
  REGIONS,
  COUNTRY_REGION_MAP,
  CONTINENT_REGION_MAP,
  MARKET_REGION_MAP,
  DEFAULT_REGION,
  getRegion,
} from "./regionRegistry.js";

// Optional: install `geoip-lite` for real IP resolution
let geoip = null;
try {
  ({ default: geoip } = await import("geoip-lite"));
} catch {
  // geoip-lite not installed — IP-based routing disabled
}

export class RegionRouter {
  constructor() {
    this._healthCache = new Map(); // regionId → { ok, checkedAt }
    this._healthTTL   = 30_000;   // re-check every 30 s
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /** Resolve the best region for a given request. */
  resolveRegion(req) {
    // 1. Explicit header (set by CDN / internal proxy)
    const headerRegion = req.headers["x-region"];
    if (headerRegion && REGIONS[headerRegion]) return getRegion(headerRegion);

    // 2. geoip lookup
    if (geoip) {
      const ip  = this._clientIp(req);
      const geo = geoip.lookup(ip);
      if (geo) {
        const byCountry   = COUNTRY_REGION_MAP[geo.country];
        const byContinent = CONTINENT_REGION_MAP[geo.timezone?.split("/")[0]] ??
                            CONTINENT_REGION_MAP[this._continentFromGeo(geo)];
        const regionId    = byCountry ?? byContinent;
        if (regionId) return getRegion(regionId);
      }
    }

    // 3. Default
    return getRegion(DEFAULT_REGION);
  }

  /** Return the owning region for a trading pair symbol. */
  ownerForMarket(symbol) {
    const normalized = String(symbol).toUpperCase().replace("/", "");
    const regionId   = MARKET_REGION_MAP[normalized];
    return regionId ? getRegion(regionId) : getRegion(DEFAULT_REGION);
  }

  /** Return whether the current region owns the given market. */
  isLocalOwner(symbol) {
    const localRegion = process.env.REGION_ID ?? DEFAULT_REGION;
    return this.ownerForMarket(symbol).id === localRegion;
  }

  /**
   * Returns the full routing decision object attached to a request by
   * the geoRoute middleware.
   */
  routingInfo(req) {
    return req._routingInfo ?? { region: getRegion(DEFAULT_REGION), local: true };
  }

  // ── Health ───────────────────────────────────────────────────────────────────

  async getHealthyRegions() {
    const results = await Promise.all(
      Object.values(REGIONS).map((r) => this._checkRegion(r))
    );
    return results.filter((r) => r.ok);
  }

  async _checkRegion(region) {
    const cached = this._healthCache.get(region.id);
    if (cached && Date.now() - cached.checkedAt < this._healthTTL) {
      return { ...region, ok: cached.ok };
    }

    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 3_000);
      const res = await fetch(`${region.apiUrl}/health`, { signal: controller.signal });
      clearTimeout(tid);
      const ok = res.ok;
      this._healthCache.set(region.id, { ok, checkedAt: Date.now() });
      return { ...region, ok };
    } catch {
      this._healthCache.set(region.id, { ok: false, checkedAt: Date.now() });
      return { ...region, ok: false };
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  _clientIp(req) {
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) return forwarded.split(",")[0].trim();
    return req.socket?.remoteAddress ?? "127.0.0.1";
  }

  _continentFromGeo(geo) {
    // geoip-lite exposes `eu` boolean and `ll` (lat/lng) — derive continent
    if (geo.eu === "1") return "EU";
    const [lat, lng] = geo.ll ?? [0, 0];
    if (lat > -37 && lat < 37 && lng > -20 && lng < 55) return "AF";
    if (lng > 55 && lng < 180) return "AS";
    if (lat > 15 && lng < -30) return "NA";
    return "OC";
  }
}

export const regionRouter = new RegionRouter();
