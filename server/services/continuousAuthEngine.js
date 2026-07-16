/**
 * Continuous Authentication Engine
 *
 * Maintains a per-session risk score that is updated on every request.
 * When the score exceeds a threshold, a step-up authentication challenge
 * is triggered before sensitive operations can proceed.
 *
 * Risk factors (each contributes delta to the score):
 *   - Anomalies detected by SessionAnomalyDetector
 *   - Geo-IP change / blocked country
 *   - New/unrecognised device fingerprint
 *   - High-value action without recent re-auth
 *   - Long session without activity
 *
 * Thresholds:
 *   - score < 30  → LOW RISK   — allow all actions
 *   - 30-59       → MEDIUM     — warn, allow; flag for monitoring
 *   - 60-79       → HIGH       — require step-up for sensitive ops
 *   - >= 80       → CRITICAL   — block + require re-auth immediately
 */

import { redisClients }  from "../config/redis.js";
import { auditSecurity } from "../services/auditService.js";
import logger            from "../config/logger.js";

// How much each signal adds to the risk score
const RISK_DELTAS = {
  IMPOSSIBLE_TRAVEL:        50,
  RAPID_IP_SWITCH:          35,
  CONCURRENT_MULTI_LOCATION:35,
  UNUSUAL_HOUR:             15,
  GEO_BLOCKED_COUNTRY:      80,
  GEO_COUNTRY_CHANGE:       20,
  NEW_DEVICE:               25,
  LOW_DEVICE_TRUST:         20,   // trust score < 40
  HIGH_VALUE_ACTION:        30,
  LONG_IDLE:                10,   // > 4 hours without activity
};

// Risk score decays over time (per minute of clean activity)
const DECAY_PER_MINUTE = 2;

// High-value action identifiers (req.path patterns)
const HIGH_VALUE_PATHS = [
  /\/api\/wallet\/withdraw/,
  /\/api\/transfer/,
  /\/api\/order.*side.*sell/,
  /\/api\/security\/api-keys/,
  /\/api\/kyc\/submit/,
];

const SESSION_RISK_KEY = "cauth:risk:";
const SESSION_TTL       = 86_400;  // 24 h

export class ContinuousAuthEngine {
  /**
   * Evaluate risk for the current request.
   * Returns { riskScore, riskLevel, requireStepUp, blockRequest, reasons }.
   */
  async evaluate(req, userId, sessionId, context = {}) {
    const uid    = String(userId);
    const sid    = String(sessionId || "default");
    const key    = `${SESSION_RISK_KEY}${uid}:${sid}`;

    const redis = redisClients.cache;
    let state = await this._loadState(key, redis);

    // Apply time decay
    const minutesElapsed = state.updatedAt
      ? (Date.now() - state.updatedAt) / 60_000
      : 0;
    const decayed = Math.max(0, state.score - minutesElapsed * DECAY_PER_MINUTE);
    state.score = decayed;

    // Accumulate risk deltas from anomalies / context
    const reasons = [];

    // Anomalies from SessionAnomalyDetector
    for (const anomaly of (context.anomalies || [])) {
      const delta = RISK_DELTAS[anomaly.type] || 10;
      state.score += delta;
      reasons.push({ type: anomaly.type, delta });
    }

    // Geo issues
    if (context.geoBlocked) {
      state.score += RISK_DELTAS.GEO_BLOCKED_COUNTRY;
      reasons.push({ type: "GEO_BLOCKED_COUNTRY", delta: RISK_DELTAS.GEO_BLOCKED_COUNTRY });
    }
    if (context.geoAlert?.type === "COUNTRY_CHANGE") {
      state.score += RISK_DELTAS.GEO_COUNTRY_CHANGE;
      reasons.push({ type: "GEO_COUNTRY_CHANGE", delta: RISK_DELTAS.GEO_COUNTRY_CHANGE });
    }

    // Device trust
    if (context.deviceTrustScore !== undefined) {
      if (context.deviceTrustScore < 40) {
        state.score += RISK_DELTAS.LOW_DEVICE_TRUST;
        reasons.push({ type: "LOW_DEVICE_TRUST", delta: RISK_DELTAS.LOW_DEVICE_TRUST });
      } else if (!context.isKnownDevice) {
        state.score += RISK_DELTAS.NEW_DEVICE;
        reasons.push({ type: "NEW_DEVICE", delta: RISK_DELTAS.NEW_DEVICE });
      }
    }

    // High-value action
    if (this._isHighValuePath(req.path, req.method)) {
      const lastHva = state.lastHighValueAction || 0;
      if (Date.now() - lastHva > 15 * 60_000) {
        // Hasn't done a high-value action recently — treat as elevated
        state.score += RISK_DELTAS.HIGH_VALUE_ACTION;
        reasons.push({ type: "HIGH_VALUE_ACTION", delta: RISK_DELTAS.HIGH_VALUE_ACTION });
      }
      state.lastHighValueAction = Date.now();
    }

    // Long idle
    const idleMs = state.lastActivity ? Date.now() - state.lastActivity : 0;
    if (idleMs > 4 * 3_600_000) {
      state.score += RISK_DELTAS.LONG_IDLE;
      reasons.push({ type: "LONG_IDLE", delta: RISK_DELTAS.LONG_IDLE });
    }

    // Cap
    state.score      = Math.min(100, Math.max(0, Math.round(state.score)));
    state.updatedAt  = Date.now();
    state.lastActivity = Date.now();

    await this._saveState(key, state, redis);

    const { riskLevel, requireStepUp, blockRequest } = this._classify(state.score);

    // Emit audit event only on high/critical
    if (state.score >= 60 && reasons.length > 0) {
      await auditSecurity(req, "CONTINUOUS_AUTH_ELEVATED", {
        severity: state.score >= 80 ? "critical" : "warn",
        metadata: { userId: uid, sessionId: sid, riskScore: state.score, reasons },
      }).catch((err) => logger.warn({ err: err.message }, "[ContAuth] Audit failed."));
    }

    return {
      riskScore:    state.score,
      riskLevel,
      requireStepUp,
      blockRequest,
      reasons,
    };
  }

  /**
   * Reset session risk after successful step-up authentication.
   */
  async resetRisk(userId, sessionId) {
    const key   = `${SESSION_RISK_KEY}${String(userId)}:${String(sessionId)}`;
    const redis = redisClients.cache;
    if (!redis) return;
    await redis.setex(key, SESSION_TTL, JSON.stringify({ score: 0, updatedAt: Date.now() }));
  }

  /**
   * Record that a step-up challenge was issued and completed.
   */
  async recordStepUp(userId, sessionId, method = "totp") {
    const uid = String(userId);
    const sid = String(sessionId);
    const key = `${SESSION_RISK_KEY}${uid}:${sid}`;
    const redis = redisClients.cache;
    if (!redis) return;

    const raw   = await redis.get(key).catch(() => null);
    const state = raw ? JSON.parse(raw) : {};
    state.lastStepUp = Date.now();
    state.stepUpMethod = method;
    // Reset score after successful step-up
    state.score = 0;
    await redis.setex(key, SESSION_TTL, JSON.stringify(state));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  _classify(score) {
    if (score >= 80) return { riskLevel: "CRITICAL", requireStepUp: true,  blockRequest: true };
    if (score >= 60) return { riskLevel: "HIGH",     requireStepUp: true,  blockRequest: false };
    if (score >= 30) return { riskLevel: "MEDIUM",   requireStepUp: false, blockRequest: false };
    return              { riskLevel: "LOW",      requireStepUp: false, blockRequest: false };
  }

  _isHighValuePath(path = "", method = "") {
    if (method === "GET") return false;
    return HIGH_VALUE_PATHS.some((rx) => rx.test(path));
  }

  async _loadState(key, redis) {
    if (!redis) return { score: 0 };
    try {
      const raw = await redis.get(key);
      return raw ? JSON.parse(raw) : { score: 0 };
    } catch { return { score: 0 }; }
  }

  async _saveState(key, state, redis) {
    if (!redis) return;
    try {
      await redis.setex(key, SESSION_TTL, JSON.stringify(state));
    } catch (err) {
      logger.warn({ err: err.message }, "[ContAuth] State save failed.");
    }
  }
}

export const continuousAuthEngine = new ContinuousAuthEngine();
