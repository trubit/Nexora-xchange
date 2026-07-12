import express from "express";
import {
  getUser,
  listUsers,
  updateUser,
} from "../controllers/usersController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

// Admin — list all users.
router.get("/", requireAuth, requireRole("admin"), listUsers);

// Self-or-admin — fetch a single user's profile.
// The controller enforces the self-or-admin policy internally.
router.get("/:id", requireAuth, getUser);

// Admin-only — update privileged user fields (role, status, kycStatus).
// Regular users must use /api/auth/avatar and /api/auth/change-password for self-service updates.
router.put("/:id", requireAuth, requireRole("admin"), updateUser);

export default router;

