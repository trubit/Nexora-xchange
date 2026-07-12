import rateLimit from "express-rate-limit";
import logger from "../config/logger.js";

// NOTE: Rate limiting + lightweight anomaly tracking for auth endpoints.
const WINDOW_MS = 10 * 60 * 1000;
const THRESHOLD = 4;
const anomalyTracker = new Map();

const normalizeEmail = (value) =>
  typeof value === "string" ? value.toLowerCase().trim() : "unknown";
const trackerKey = (req) =>
  `${req.ip}:${normalizeEmail(req.body?.email ?? req.query?.email)}`;

// NOTE: Drop very old entries so the tracker doesn't grow forever.
const cleanupOldEntries = (now) => {
  for (const [key, entry] of anomalyTracker.entries()) {
    if (now - entry.firstSeen > WINDOW_MS * 3) {
      anomalyTracker.delete(key);
    }
  }
};

// NOTE: Record suspicious auth activity and log when it crosses a threshold.
export const logAuthAnomaly = (req, reason) => {
  const key = trackerKey(req);
  const now = Date.now();
  cleanupOldEntries(now);

  const entry = anomalyTracker.get(key) ?? {
    count: 0,
    firstSeen: now,
    email: normalizeEmail(req.body?.email),
  };
  if (now - entry.firstSeen > WINDOW_MS) {
    entry.count = 0;
    entry.firstSeen = now;
  }
  entry.count += 1;
  entry.lastSeen = now;
  anomalyTracker.set(key, entry);

  if (entry.count >= THRESHOLD) {
    logger.warn(
      { ip: req.ip, email: entry.email, attempts: entry.count, route: req.path },
      `[AUTH ANOMALY] ${reason}`,
    );
  } else {
    logger.info(
      { ip: req.ip, email: entry.email, attempts: entry.count },
      `[AUTH NOTICE] ${reason}`,
    );
  }
};

// NOTE: Clear the anomaly tracker once a user succeeds.
export const clearAuthAnomaly = (req) => {
  anomalyTracker.delete(trackerKey(req));
};

// NOTE: Helper to build a rate limiter with standard headers.
const createLimiter = (options) =>
  rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: { message: options.message },
    skipSuccessfulRequests: Boolean(options.skipSuccessfulRequests),
    keyGenerator: options.keyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
  });

const passthroughLimiter = (_req, _res, next) => next();

// NOTE: Limit login attempts per window to reduce brute-force attacks.
export const loginLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: "Too many login attempts; try again shortly.",
});

// NOTE: Limit signup attempts per window to reduce spam accounts.
const registerLimiterBase = createLimiter({
  windowMs: Number(process.env.REGISTER_RATE_LIMIT_WINDOW_MS || 2 * 60 * 1000),
  max: Number(process.env.REGISTER_RATE_LIMIT_MAX || 10),
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const email = normalizeEmail(req.body?.email);
    return `${req.ip}:${email}`;
  },
  message: "Too many signup attempts; please wait and try again.",
});

export const registerLimiter = (req, res, next) => {
  const disabledByEnv =
    String(process.env.DISABLE_REGISTER_RATE_LIMIT || "").toLowerCase() ===
    "true";
  const isNonProd = process.env.NODE_ENV !== "production";

  if (disabledByEnv || isNonProd) {
    return passthroughLimiter(req, res, next);
  }
  return registerLimiterBase(req, res, next);
};

// NOTE: Limit how often reset links can be requested.
export const forgotPasswordLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  max: 4,
  message: "Too many password reset requests; wait a bit and try again.",
});

// NOTE: Limit how often reset tokens can be tried.
export const resetPasswordLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  max: 6,
  message: "Too many password reset attempts; wait before retrying.",
});

// NOTE: Limit how often verification emails can be resent.
export const resendVerificationLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  max: 4,
  message: "Too many verification requests; wait a bit and try again.",
});
