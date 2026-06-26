/**
 * Middleware: authenticate via API key (X-API-Key header).
 * Falls through to next() if no API key header is present — use after requireAuth
 * on routes that should accept BOTH JWT and API key.
 *
 * For API-key-only routes:
 *   router.get("/...", requireApiKey("read"), handler)
 *
 * For routes that accept either JWT or API key:
 *   router.post("/...", requireAuth, handler)  — JWT
 *   — or attach apiKeyAuth before requireAuth to allow both
 */

import User            from "../models/User.js";
import { validateApiKey } from "../services/securityService.js";
import { auditSecurity }  from "../services/auditService.js";

// Use Express's trust-proxy-aware req.ip instead of reading the raw
// X-Forwarded-For header directly — the raw header is trivially spoofed.
const parseIp = (req) => req.ip || req?.socket?.remoteAddress || "unknown";

export const requireApiKey =
  (scope = "read") =>
  async (req, res, next) => {
    const rawKey = req.headers["x-api-key"] || req.query.api_key;
    if (!rawKey) return res.status(401).json({ message: "API key required." });

    const ip  = parseIp(req);
    const key = await validateApiKey(rawKey, scope, ip);
    if (!key) return res.status(401).json({ message: "Invalid or expired API key." });

    const user = await User.findById(key.userId);
    if (!user || user.status !== "active") {
      return res.status(403).json({ message: "Account is not active." });
    }

    req.user     = user;
    req.apiKeyId = key._id;
    req.apiScopes = key.scopes;

    await auditSecurity(req, "API_KEY_USED", {
      severity: "info",
      metadata: { keyPrefix: key.prefix, scope, ip, endpoint: req.path },
    });

    next();
  };
