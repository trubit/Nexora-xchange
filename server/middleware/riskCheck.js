import { checkFrozen } from "../services/riskService.js";

/**
 * Middleware: blocks any request from a frozen account.
 * Attach to any route that requires an unfrozen account.
 * Must be placed after requireAuth (needs req.user).
 */
export const requireNotFrozen = async (req, res, next) => {
  if (!req.user) return next();
  try {
    await checkFrozen(req.user._id);
    next();
  } catch (err) {
    res.status(err.statusCode || 403).json({ message: err.message });
  }
};
