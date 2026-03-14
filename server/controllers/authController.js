import bcrypt from "bcryptjs";
import crypto from "crypto";
import User from "../models/User.js";
import { signToken } from "../utils/jwt.js";
import { sendEmail } from "../utils/email.js";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const VERIFICATION_TTL_MS = 1000 * 60 * 60 * 24;

const toSafeUser = (user) => (user ? user.toJSON() : null);

const createVerificationToken = () => {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expires = new Date(Date.now() + VERIFICATION_TTL_MS);
  return { token, tokenHash, expires };
};

const sendVerificationEmail = async (user, token) => {
  const verifyUrl = `${FRONTEND_URL}/verify-email?token=${token}`;
  const subject = "Verify your TrusonXchanger email";
  const text = `Welcome to TrusonXchanger!\n\nPlease verify your email by visiting: ${verifyUrl}\n\nIf you did not create this account, you can ignore this email.`;
  const html = `
    <p>Welcome to TrusonXchanger!</p>
    <p>Please verify your email by clicking the link below:</p>
    <p><a href="${verifyUrl}">Verify email</a></p>
    <p>If you did not create this account, you can ignore this email.</p>
  `;

  await sendEmail({ to: user.email, subject, text, html });
};

export const register = async (req, res) => {
  const { name, email, password, referralId } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    return res.status(409).json({ message: "Email already in use." });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const { token, tokenHash, expires } = createVerificationToken();

  const user = await User.create({
    name: name?.trim() ?? "",
    email: normalizedEmail,
    passwordHash,
    referralId: referralId?.trim() ?? "",
    emailVerified: false,
    emailVerificationTokenHash: tokenHash,
    emailVerificationExpires: expires,
  });

  await sendVerificationEmail(user, token);
  return res.status(201).json({
    user: toSafeUser(user),
    message: "Verification email sent. Please check your inbox.",
  });
};

export const verifyEmail = async (req, res) => {
  const token = req.query.token || req.body.token;
  if (!token) {
    return res.status(400).json({ message: "Verification token is required." });
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({
    emailVerificationTokenHash: tokenHash,
    emailVerificationExpires: { $gt: new Date() },
  });

  if (!user) {
    return res.status(400).json({ message: "Invalid or expired token." });
  }

  user.emailVerified = true;
  user.emailVerificationTokenHash = "";
  user.emailVerificationExpires = null;
  await user.save();

  return res.json({ message: "Email verified successfully." });
};

export const resendVerification = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user || user.emailVerified) {
    return res.json({ message: "If the account exists, a new email was sent." });
  }

  const { token, tokenHash, expires } = createVerificationToken();
  user.emailVerificationTokenHash = tokenHash;
  user.emailVerificationExpires = expires;
  await user.save();

  await sendVerificationEmail(user, token);
  return res.json({ message: "Verification email sent." });
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  if (!user.emailVerified) {
    return res.status(403).json({
      message: "Please verify your email before logging in.",
      code: "EMAIL_NOT_VERIFIED",
    });
  }

  const token = signToken({ sub: user.id, role: user.role });
  return res.json({ user: toSafeUser(user), token });
};

export const me = async (req, res) => {
  return res.json({ user: toSafeUser(req.user) });
};
