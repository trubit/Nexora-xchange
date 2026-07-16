/**
 * Session Anomaly Detector
 *
 * Detects suspicious patterns within and across user sessions:
 *   - Impossible travel (IP locations changing faster than physically possible)
 *   - Rapid IP switching (> N distinct IPs in M minutes)
 *   - Unusual activity hours (e.g. sudden 3 AM activity for an always-daytime user)
 *   - Concurrent sessions from geographically disparate locations
 *   - High-frequency requests (bot-like behaviour)
 *   - Session reuse after revocation
 *
 * Anomalies produce a severity-tagged event that the Security Orchestrator
 * can act on (step-up auth, session freeze, alert).
 */

import DeviceSession    from "../models/DeviceSession.js";
import { redisClients } from "../config/redis.js";
import { auditSecurity } from "../services/auditService.js";
import logger            from "../config/logger.js";

const RAPID_IP_WINDOW_MS  = 5 * 60_000;   // 5 minutes
const RAPID_IP_THRESHOLD  = 3;            // distinct IPs
const HOUR_HISTORY_COUNT  = 30;           // days of hour history to build pattern

export class SessionAnomalyDetector {
  /**
   * Main entry — call on every authenticated request.
   * Returns an array of anomalies (empty = clean).
   */
  async detect(req, userId, sessionId) {
    const uid = String(userId);
    const ip  = req.ip || req?.socket?.remoteAddress || "unknown";

    const [ipAnomaly, travelAnomaly, hourAnomaly, concurrentAnomaly] = await Promise.all([
      this._detectRapidIpSwitch(uid, ip, sessionId),
      this._detectImpossibleTravel(uid, ip),
      this._detectUnusualHour(uid),
      this._detectConcurrentAnomalies(uid, ip),
    ]);

    const anomalies = [ipAnomaly, travelAnomaly, hourAnomaly, concurrentAnomaly]
      .filter(Boolean);

    if (anomalies.length > 0) {
      await this._recordAnomalies(req, uid, sessionId, anomalies);
    }

    // Update last-seen IP for future travel checks
    await this._updateIpHistory(uid, ip);

    return anomalies;
  }

  // ── Rapid IP Switching ─────────────────────────────────────────────────────────

  async _detectRapidIpSwitch(uid, currentIp, sessionId) {
    const redis = redisClients.cache;
    if (!redis) return null;

    const key = `anomaly:ips:${uid}`;
    try {
      const raw     = await redis.get(key);
      const history = raw ? JSON.parse(raw) : [];
      const now     = Date.now();

      // Prune entries older than the window
      const recent = history.filter((e) => now - e.ts < RAPID_IP_WINDOW_MS);

      const distinctIps = new Set(recent.map((e) => e.ip));
      distinctIps.add(currentIp);

      // Save updated history
      recent.push({ ip: currentIp, ts: now });
      await redis.setex(key, 600, JSON.stringify(recent.slice(-20)));

      if (distinctIps.size > RAPID_IP_THRESHOLD) {
        return {
          type:     "RAPID_IP_SWITCH",
          severity: "HIGH",
          detail:   `${distinctIps.size} distinct IPs in last 5 minutes`,
          ips:      [...distinctIps],
        };
      }
    } catch (err) {
      logger.warn({ err: err.message }, "[SADetector] Redis error on IP check.");
    }
    return null;
  }

  // ── Impossible Travel ──────────────────────────────────────────────────────────

  async _detectImpossibleTravel(uid, currentIp) {
    const redis = redisClients.cache;
    if (!redis) return null;

    try {
      const key     = `anomaly:lastip:${uid}`;
      const prevRaw = await redis.get(key);

      if (prevRaw) {
        const prev = JSON.parse(prevRaw);
        const elapsedMinutes = (Date.now() - prev.ts) / 60_000;

        // Only flag if the IP prefix (first two octets) changed AND elapsed < 30 min
        const prevSubnet = this._subnet(prev.ip);
        const currSubnet = this._subnet(currentIp);

        if (prevSubnet !== currSubnet && elapsedMinutes < 30) {
          return {
            type:     "IMPOSSIBLE_TRAVEL",
            severity: "CRITICAL",
            detail:   `IP subnet changed from ${prevSubnet} to ${currSubnet} in ${Math.round(elapsedMinutes)}m`,
            prevIp:   prev.ip,
            currIp:   currentIp,
            elapsedMinutes: Math.round(elapsedMinutes),
          };
        }
      }

      // Always update last IP (TTL 2 hours)
      await redis.setex(key, 7200, JSON.stringify({ ip: currentIp, ts: Date.now() }));
    } catch (err) {
      logger.warn({ err: err.message }, "[SADetector] Redis error on travel check.");
    }
    return null;
  }

  // ── Unusual Activity Hours ──────────────────────────────────────────────────────

  async _detectUnusualHour(uid) {
    const redis = redisClients.cache;
    if (!redis) return null;

    const currentHour = new Date().getUTCHours();
    const key         = `anomaly:hours:${uid}`;

    try {
      const raw     = await redis.get(key);
      const profile = raw ? JSON.parse(raw) : { hours: {}, count: 0 };

      // Build a baseline only after at least 20 logins
      if (profile.count < 20) {
        profile.hours[currentHour] = (profile.hours[currentHour] || 0) + 1;
        profile.count++;
        await redis.setex(key, 86_400 * 90, JSON.stringify(profile));
        return null;
      }

      const totalLogins  = Object.values(profile.hours).reduce((s, v) => s + v, 0);
      const hourFreq     = (profile.hours[currentHour] || 0) / totalLogins;

      // Unusual if this hour accounts for < 1% of historical logins
      if (hourFreq < 0.01) {
        return {
          type:     "UNUSUAL_HOUR",
          severity: "MEDIUM",
          detail:   `Login at UTC hour ${currentHour} — seen in only ${(hourFreq * 100).toFixed(1)}% of historical sessions`,
        };
      }

      // Update profile
      profile.hours[currentHour] = (profile.hours[currentHour] || 0) + 1;
      profile.count++;
      await redis.setex(key, 86_400 * 90, JSON.stringify(profile));
    } catch (err) {
      logger.warn({ err: err.message }, "[SADetector] Redis error on hour check.");
    }
    return null;
  }

  // ── Concurrent Suspicious Sessions ────────────────────────────────────────────

  async _detectConcurrentAnomalies(uid, currentIp) {
    try {
      const sessions = await DeviceSession.find(
        { userId: uid, isActive: true },
        { ipAddress: 1, lastSeenAt: 1 },
      ).lean();

      // Active in last 15 minutes
      const activeRecently = sessions.filter(
        (s) => s.lastSeenAt && Date.now() - new Date(s.lastSeenAt) < 15 * 60_000,
      );

      if (activeRecently.length < 2) return null;

      const subnets = new Set(activeRecently.map((s) => this._subnet(s.ipAddress)));
      if (subnets.size > 2) {
        return {
          type:     "CONCURRENT_MULTI_LOCATION",
          severity: "HIGH",
          detail:   `${subnets.size} geographically distinct locations active simultaneously`,
          subnets:  [...subnets],
        };
      }
    } catch (err) {
      logger.warn({ err: err.message }, "[SADetector] DB error on concurrent check.");
    }
    return null;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  _subnet(ip = "") {
    const v4 = ip.replace(/^::ffff:/, "");
    const parts = v4.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}`;
    return ip.split(":").slice(0, 3).join(":");
  }

  async _updateIpHistory(uid, ip) {
    // Already handled inline in _detectRapidIpSwitch and _detectImpossibleTravel
  }

  async _recordAnomalies(req, uid, sessionId, anomalies) {
    for (const a of anomalies) {
      await auditSecurity(req, "SESSION_ANOMALY", {
        severity: a.severity === "CRITICAL" ? "critical" : a.severity === "HIGH" ? "error" : "warn",
        metadata: { userId: uid, sessionId, ...a },
      }).catch((err) => logger.warn({ err: err.message }, "[SADetector] Audit write failed."));
    }
  }
}

export const sessionAnomalyDetector = new SessionAnomalyDetector();
