import crypto from "crypto";
import jwt from "jsonwebtoken";
import RevokedToken from "../models/RevokedToken.js";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === "change-me") {
  throw new Error(
    "JWT_SECRET environment variable must be set to a strong random secret (not the default 'change-me')."
  );
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

export const signToken = (payload) =>
  jwt.sign({ jti: crypto.randomUUID(), ...payload }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

export const verifyToken = (token) => jwt.verify(token, JWT_SECRET);

/**
 * Blacklist a specific token so it is rejected on all future requests,
 * even before its natural expiry.
 *
 * @param {object} decoded  — already-verified JWT payload (must have jti + sub + exp)
 * @param {string} reason   — "logout" | "password_change" | "admin_revoke"
 */
export async function revokeToken(decoded, reason = "logout") {
  if (!decoded?.jti) return; // legacy token without jti — cannot revoke individually
  await RevokedToken.create({
    jti:      decoded.jti,
    userId:   decoded.sub,
    reason,
    expiresAt: new Date(decoded.exp * 1000),
  });
}

/**
 * Returns true if the token's jti appears in the revocation list.
 * Missing jti (legacy tokens) are treated as NOT revoked — they rely on
 * the passwordChangedAt check in requireAuth instead.
 */
export async function isTokenRevoked(jti) {
  if (!jti) return false;
  const hit = await RevokedToken.findOne({ jti }).lean();
  return !!hit;
}
