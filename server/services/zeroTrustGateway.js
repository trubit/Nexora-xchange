/**
 * Zero-Trust Gateway
 *
 * Express middleware that enforces "never trust, always verify" on every
 * authenticated request by running the full zero-trust pipeline:
 *
 *   1. Device fingerprint extraction + trust scoring
 *   2. Geo-IP verification (block list + country change detection)
 *   3. Session anomaly detection (impossible travel, rapid IP, unusual hour)
 *   4. Continuous authentication risk scoring
 *   5. Decision: ALLOW / STEP-UP / BLOCK
 *
 * Attaches `req.zeroTrust` for downstream handlers to inspect.
 *
 * Usage:
 *   router.use(requireAuth, zeroTrustMiddleware);
 *   router.post("/withdraw", zeroTrustMiddleware, requireStepUp, handler);
 */

import { deviceFingerprintEngine } from "./deviceFingerprintEngine.js";
import { sessionAnomalyDetector }  from "./sessionAnomalyDetector.js";
import { geoIpVerifier }           from "./geoIpVerifier.js";
import { continuousAuthEngine }    from "./continuousAuthEngine.js";
import logger                      from "../config/logger.js";

// Paths that are exempt from zero-trust (public endpoints)
const EXEMPT_PREFIXES = ["/api/health", "/api/auth/login", "/api/auth/signup", "/api/auth/refresh"];

export const zeroTrustMiddleware = async (req, res, next) => {
  // Skip if not authenticated or if on an exempt path
  if (!req.user || EXEMPT_PREFIXES.some((p) => req.path.startsWith(p))) {
    req.zeroTrust = { skipped: true };
    return next();
  }

  try {
    const userId    = req.user._id;
    const sessionId = req.sessionId || req.headers["x-session-id"] || "unknown";

    // Step 1: Device fingerprint
    const fingerprint   = deviceFingerprintEngine.extract(req);
    const deviceTrust   = await deviceFingerprintEngine.computeTrustScore(userId, fingerprint);

    // Step 2: Geo-IP
    const geoResult     = await geoIpVerifier.verify(req, userId);

    // Block immediately on geo restriction
    if (!geoResult.allowed) {
      req.zeroTrust = { blocked: true, reason: geoResult.reason };
      return res.status(403).json({
        success: false,
        code:    "GEO_BLOCKED",
        message: "Access denied from your location.",
      });
    }

    // Step 3: Session anomaly detection
    const anomalies = await sessionAnomalyDetector.detect(req, userId, sessionId);

    // Step 4: Continuous auth risk scoring
    const authEval = await continuousAuthEngine.evaluate(req, userId, sessionId, {
      anomalies,
      geoBlocked:       !geoResult.allowed,
      geoAlert:         geoResult.alert,
      deviceTrustScore: deviceTrust.score,
      isKnownDevice:    deviceTrust.isKnown,
    });

    // Step 5: Decision
    req.zeroTrust = {
      fingerprint:      fingerprint.composite,
      deviceTrustScore: deviceTrust.score,
      isKnownDevice:    deviceTrust.isKnown,
      geoCountry:       geoResult.geoContext?.country,
      isVpn:            geoResult.geoContext?.isVpn,
      anomalies,
      riskScore:        authEval.riskScore,
      riskLevel:        authEval.riskLevel,
      requireStepUp:    authEval.requireStepUp,
      blocked:          authEval.blockRequest,
    };

    if (authEval.blockRequest) {
      logger.warn({
        userId,
        riskScore: authEval.riskScore,
        reasons:   authEval.reasons,
      }, "[ZeroTrust] Request blocked — critical risk score.");

      return res.status(403).json({
        success: false,
        code:    "ZERO_TRUST_BLOCK",
        message: "Request blocked by Zero-Trust security policy. Please re-authenticate.",
        riskLevel: authEval.riskLevel,
      });
    }

    if (authEval.requireStepUp) {
      // Attach step-up flag — the requireStepUp middleware can check this
      res.setHeader("X-Step-Up-Required", "true");
    }

    // Attach geo/device signals as response headers for client awareness
    if (geoResult.alert) {
      res.setHeader("X-Geo-Alert", geoResult.alert.type);
    }
    if (anomalies.length > 0) {
      res.setHeader("X-Security-Anomaly", anomalies.map((a) => a.type).join(","));
    }

    next();
  } catch (err) {
    // Never fail-closed on internal error — log and let through
    logger.error({ err: err.message, path: req.path }, "[ZeroTrust] Pipeline error (fail-open).");
    req.zeroTrust = { error: err.message };
    next();
  }
};

/**
 * requireStepUp — middleware to enforce step-up auth for sensitive routes.
 * Responds with 401 + step-up token if continuous auth score is too high.
 */
export const requireStepUp = (req, res, next) => {
  const zt = req.zeroTrust;
  if (!zt || !zt.requireStepUp) return next();

  return res.status(401).json({
    success:  false,
    code:     "STEP_UP_REQUIRED",
    message:  "This action requires additional authentication.",
    riskLevel: zt.riskLevel,
    riskScore: zt.riskScore,
  });
};
