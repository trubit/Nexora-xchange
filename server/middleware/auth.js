import User from "../models/User.js";
import { verifyToken } from "../utils/jwt.js";

// requireAuth: checks the JWT in the Authorization header and loads the user.
export const requireAuth = async (req, res, next) => {
  try {
    // Read "Authorization: Bearer <token>" from the request headers.
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Verify the token signature and read the payload.
    const decoded = verifyToken(token);
    // Fetch the user record using the user id stored in the token.
    const user = await User.findById(decoded.sub);
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Attach user to the request so controllers can use req.user.
    req.user = user;
    return next();
  } catch {
    // Any error means the token is invalid or expired.
    return res.status(401).json({ message: "Unauthorized" });
  }
};

// requireRole: allows access only if req.user.role is in the allowed roles list.
export const requireRole =
  (...roles) =>
  (req, res, next) => {
    // If user is missing or role is not allowed, block the request.
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    // User has the required role, continue.
    return next();
  }; 

