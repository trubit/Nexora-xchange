/**
 * Security Orchestrator
 *
 * Top-level coordinator for the Enterprise Zero-Trust Security Model.
 * Provides a unified interface for all Stage 3 services and handles:
 *
 *   - Full trust evaluation pipeline (fingerprint + geo + anomaly + continuous auth)
 *   - Security event correlation and escalation
 *   - Account suspension on repeated critical violations
 *   - Daily security health summary (for admin dashboards)
 *   - Step-up authentication token issuance + verification
 *
 * All other Stage 3 services are leaf nodes; this is the only coordinator.
 */

import crypto                      from "crypto";
import { deviceFingerprintEngine } from "./deviceFingerprintEngine.js";
import { sessionAnomalyDetector }  from "./sessionAnomalyDetector.js";
import { geoIpVerifier }           from "./geoIpVerifier.js";
import { continuousAuthEngine }    from "./continuousAuthEngine.js";
import { redisClients }            from "../config/redis.js";
import { auditSecurity }           from "../services/auditService.js";
import logger                      from "../config/logger.js";

const STEP_UP_TOKEN_KEY = "zt:stepup:";
const STEP_UP_TTL       = 300;  // 5 min to complete step-up
const VIOLATION_KEY     = "zt:violations:";
const SUSPENSION_THRESHOLD = 5;  // critical violations in 24 h

export class SecurityOrchestrator {
  // ── Full pipeline evaluation ──────────────────────────────────────────────────

  /**
   * Run every zero-trust check for a request+user pair.
   * Returns a unified trust evaluation object.
   */
  async evaluateTrust(req, userId, sessionId) {
    const uid = String(userId);
    const sid = String(sessionId || "");

    const [fingerprint, geoResult] = await Promise.all([
      Promise.resolve(deviceFingerprintEngine.extract(req)),
      geoIpVerifier.verify(req, userId),
    ]);

    const [deviceTrust, anomalies] = await Promise.all([
      deviceFingerprintEngine.computeTrustScore(userId, fingerprint),
      sessionAnomalyDetector.detect(req, userId, sessionId),
    ]);

    const authEval = await continuousAuthEngine.evaluate(req, userId, sessionId, {
      anomalies,
      geoBlocked:       !geoResult.allowed,
      geoAlert:         geoResult.alert,
      deviceTrustScore: deviceTrust.score,
      isKnownDevice:    deviceTrust.isKnown,
    });

    // Escalate critical violations
    if (authEval.blockRequest) {
      await this._recordCriticalViolation(req, uid, sid, authEval);
    }

    return {
      allowed:          !authEval.blockRequest && geoResult.allowed,
      requireStepUp:    authEval.requireStepUp,
      riskScore:        authEval.riskScore,
      riskLevel:        authEval.riskLevel,
      blockedBy:        authEval.blockRequest ? "CONTINUOUS_AUTH" : (!geoResult.allowed ? "GEO_BLOCK" : null),
      geo: {
        country:  geoResult.geoContext?.country,
        isVpn:    geoResult.geoContext?.isVpn,
        blocked:  !geoResult.allowed,
        alert:    geoResult.alert || null,
      },
      device: {
        fingerprint:  fingerprint.composite,
        trustScore:   deviceTrust.score,
        isKnown:      deviceTrust.isKnown,
        meta:         fingerprint.meta,
      },
      session: {
        anomalies,
        anomalyCount: anomalies.length,
        highestSeverity: anomalies.reduce((s, a) => {
          const order = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
          return order.indexOf(a.severity) > order.indexOf(s) ? a.severity : s;
        }, "LOW"),
      },
      evaluatedAt: new Date(),
    };
  }

  // ── Step-up Authentication ─────────────────────────────────────────────────────

  /**
   * Issue a one-time step-up token for a user session.
   * The token must be presented in a subsequent /verify-stepup call.
   */
  async issueStepUpToken(userId, sessionId, method = "totp") {
    const token  = crypto.randomBytes(24).toString("hex");
    const redis  = redisClients.cache;

    if (redis) {
      const key = `${STEP_UP_TOKEN_KEY}${String(userId)}:${String(sessionId)}`;
      await redis.setex(key, STEP_UP_TTL, JSON.stringify({ token, method, issuedAt: Date.now() }))
        .catch((err) => logger.warn({ err: err.message }, "[Orchestrator] Step-up token save failed."));
    }

    return { token, expiresInSeconds: STEP_UP_TTL, method };
  }

  /**
   * Verify a step-up token and reset session risk on success.
   */
  async verifyStepUpToken(userId, sessionId, submittedToken) {
    const redis = redisClients.cache;
    if (!redis) return { valid: false, reason: "Redis unavailable" };

    const key = `${STEP_UP_TOKEN_KEY}${String(userId)}:${String(sessionId)}`;
    try {
      const raw = await redis.get(key);
      if (!raw) return { valid: false, reason: "Token expired or not issued" };

      const { token } = JSON.parse(raw);
      const valid = crypto.timingSafeEqual(
        Buffer.from(token,          "hex"),
        Buffer.from(submittedToken, "hex").slice(0, 24),
      );

      if (valid) {
        await redis.del(key);
        await continuousAuthEngine.resetRisk(userId, sessionId);
        await continuousAuthEngine.recordStepUp(userId, sessionId);
        return { valid: true };
      }

      return { valid: false, reason: "Token mismatch" };
    } catch (err) {
      logger.warn({ err: err.message }, "[Orchestrator] Step-up verify error.");
      return { valid: false, reason: "Verification error" };
    }
  }

  // ── Security health summary ───────────────────────────────────────────────────

  async getSecurityHealthSummary() {
    const AuditLog = (await import("../models/AuditLog.js")).default;

    const since = new Date(Date.now() - 24 * 3_600_000);
    const [critical, geo, stepUp, apiKey] = await Promise.all([
      AuditLog.countDocuments({ action: "SESSION_ANOMALY",        createdAt: { $gte: since } }),
      AuditLog.countDocuments({ action: "GEO_IP_BLOCKED",         createdAt: { $gte: since } }),
      AuditLog.countDocuments({ action: "CONTINUOUS_AUTH_ELEVATED", createdAt: { $gte: since } }),
      AuditLog.countDocuments({ action: "API_KEY_USED",           createdAt: { $gte: since } }),
    ]);

    const totalEvents = critical + geo + stepUp + apiKey;
    const threatScore = Math.min(100, Math.round((critical * 3 + geo * 2 + stepUp) / Math.max(totalEvents, 1) * 100));

    return {
      period:     "last_24h",
      threatScore,
      events: { sessionAnomalies: critical, geoBlocked: geo, continuousAuthElevated: stepUp, apiKeyUsage: apiKey, total: totalEvents },
      health: threatScore < 20 ? "HEALTHY" : threatScore < 50 ? "ELEVATED" : threatScore < 80 ? "HIGH_RISK" : "CRITICAL",
      generatedAt: new Date(),
    };
  }

  // ── Suspension enforcement ────────────────────────────────────────────────────

  async _recordCriticalViolation(req, uid, sid, authEval) {
    const redis = redisClients.cache;
    if (!redis) return;

    const key = `${VIOLATION_KEY}${uid}`;
    try {
      const count = await redis.incr(key);
      await redis.expire(key, 86_400);  // reset after 24 h

      await auditSecurity(req, "ZERO_TRUST_VIOLATION", {
        severity: "critical",
        metadata: { userId: uid, sessionId: sid, riskScore: authEval.riskScore, violationCount: count },
      }).catch(() => {});

      if (count >= SUSPENSION_THRESHOLD) {
        logger.error({ userId: uid, count }, "[Orchestrator] Suspension threshold reached.");
        const User = (await import("../models/User.js")).default;
        await User.findByIdAndUpdate(uid, { status: "suspended" }).catch(() => {});
        await auditSecurity(req, "ACCOUNT_AUTO_SUSPENDED", {
          severity: "critical",
          metadata: { userId: uid, violationCount: count, reason: "Zero-trust threshold exceeded" },
        }).catch(() => {});
      }
    } catch (err) {
      logger.warn({ err: err.message }, "[Orchestrator] Violation recording failed.");
    }
  }
}

export const securityOrchestrator = new SecurityOrchestrator();
