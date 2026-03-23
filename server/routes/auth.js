import express from "express";
import {
  googleAuth,
  googleOAuthCallback,
  login,
  me,
  register,
  requestPasswordReset,
  resetPassword,
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import {
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
} from "../middleware/security.js";

const router = express.Router();

// Signup + login endpoints.
router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);
router.post("/google", loginLimiter, googleAuth);
router.get("/google", googleOAuthCallback);
// Step 1: request a reset link via email.
router.post("/forgot-password", forgotPasswordLimiter, requestPasswordReset);
// Step 2: reset password using the token from the email.
router.post("/reset-password", resetPasswordLimiter, resetPassword);
router.get("/me", requireAuth, me);

export default router;

