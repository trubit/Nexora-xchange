 import express from "express";
import {
  login,
  me,
  register,
  resendVerification,
  verifyEmail,
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/verify", verifyEmail);
router.post("/resend-verification", resendVerification);
router.get("/me", requireAuth, me);

export default router; 

