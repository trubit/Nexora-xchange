import express from "express";
import {
  changePassword,
  exchangeOAuthCode,
  googleAuth,
  googleOAuthCallback,
  googleOAuthStart,
  login,
  logout,
  me,
  refreshToken,
  register,
  resendEmailVerification,
  resendEmailVerificationMe,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  uploadAvatar,
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import {
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  resendVerificationLimiter,
} from "../middleware/security.js";

const router = express.Router();

// Signup + login endpoints.
router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);
router.post("/google", loginLimiter, googleAuth);
router.get("/google/start", googleOAuthStart);
router.get("/google", googleOAuthCallback);
router.get("/oauth/token", exchangeOAuthCode);
router.post(
  "/verify-email/resend",
  resendVerificationLimiter,
  resendEmailVerification,
);
// Step 1: request a reset link via email.
router.post("/forgot-password", forgotPasswordLimiter, requestPasswordReset);
// Step 2: reset password using the token from the email.
router.post("/reset-password", resetPasswordLimiter, resetPassword);
// Accept both POST (preferred for OTP) and GET (legacy links).
router.post("/verify-email", verifyEmail);
router.get("/verify-email", verifyEmail);
router.get("/me", requireAuth, me);
router.post("/refresh", loginLimiter, refreshToken);
router.post("/logout", requireAuth, logout);
router.post("/verify-email/resend-me", requireAuth, resendVerificationLimiter, resendEmailVerificationMe);
router.post("/avatar", requireAuth, uploadAvatar);
router.post("/change-password", requireAuth, changePassword);

export default router;
