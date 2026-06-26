import User                        from "../models/User.js";
import { verifyToken, isTokenRevoked } from "../utils/jwt.js";
import { touchSession }              from "../services/securityService.js";

export const requireAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token  = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const decoded = verifyToken(token);

    // Check per-token blacklist (logout / admin revoke)
    if (await isTokenRevoked(decoded.jti)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await User.findById(decoded.sub);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    // Check if token predates a password change — rejects all old tokens at once
    if (user.passwordChangedAt) {
      const issuedAt = decoded.iat * 1000;
      if (issuedAt < user.passwordChangedAt.getTime()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
    }

    // Frozen / suspended — hard block on all authenticated routes
    if (user.status === "suspended") {
      return res.status(403).json({
        message: "Your account has been suspended. Please contact support.",
        code: "ACCOUNT_SUSPENDED",
      });
    }

    req.user    = user;
    req.decoded = decoded;

    // Refresh device session TTL (fire-and-forget — never blocks the request)
    const sessionId = req.headers["x-session-id"] || decoded.sessionId;
    if (sessionId) {
      req.sessionId = sessionId;
      touchSession(sessionId);
    }

    return next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    return next();
  };
