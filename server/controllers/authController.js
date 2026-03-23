import bcrypt from "bcryptjs";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import { signToken } from "../utils/jwt.js";
import { sendEmail } from "../utils/email.js";
import { clearAuthAnomaly, logAuthAnomaly } from "../middleware/security.js";

// Password rule: minimum 8 characters with upper, lower, number, and symbol.
const PASSWORD_POLICY =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
// How many rounds to use when hashing passwords.
const HASH_ROUNDS = 12;
// Reset links expire after 1 hour for safety.
const RESET_TOKEN_TTL_MS = 1000 * 60 * 60;
// Frontend base URL used in reset-password links.
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
// Google OAuth client ID (must match the one used on the frontend).
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
// Google OAuth client secret + redirect URI (required for auth-code callback flow).
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "";
// Google client instance used to verify ID tokens.
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
// OAuth client used for auth-code exchange (redirect flow).
const googleOAuthClient =
  GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
    ? new OAuth2Client(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI || undefined,
      )
    : null;
// Remove sensitive fields before sending user data to the client.
const toSafeUser = (user) => (user ? user.toJSON() : null);
// Normalize inputs to avoid case and whitespace issues.
const normalizeEmail = (value) => value?.toLowerCase().trim();
const normalizeText = (value) => value?.trim() ?? "";
// Build reset link for the frontend reset-password page.
const buildResetUrl = (token) =>
  `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;

// Create a reset token and store only its hash in the database.
const createResetToken = () => {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  return { token, tokenHash, expires };
};

// Send a reset link email (HTML + plain text).
const sendPasswordResetEmail = async (user, token) => {
  const resetUrl = buildResetUrl(token);
  const subject = "Reset your TrusonXchanger password";
  const text = [
    "You requested a password reset for your TrusonXchanger account.",
    "",
    "Reset your password using this link:",
    resetUrl,
    "",
    "If you did not request this, you can ignore this message.",
  ].join("\n");
  const html = `
    <p>You requested a password reset for your TrusonXchanger account.</p>
    <p>Use the button or copy/paste the full link below:</p>
    <p style="margin:16px 0;">
      <a href="${resetUrl}" style="display:inline-block;padding:12px 18px;background:#198754;color:#fff;text-decoration:none;border-radius:6px;">
        Reset password
      </a>
    </p>
    <p style="word-break:break-all;"><a href="${resetUrl}">${resetUrl}</a></p>
    <p>If you did not request this, you can ignore this message.</p>
  `;

  await sendEmail({ to: user.email, subject, text, html });
};

// Signup: validate input, hash password, create user, return safe profile.
export const register = async (req, res) => {
  // Read submitted fields.
  const { name, email, password, referralId } = req.body;
  // Require email + password.
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  // Enforce password strength.
  if (!PASSWORD_POLICY.test(password)) {
    return res.status(400).json({
      message:
        "Password must be at least 8 characters long and include upper/lower case letters, a number, and a symbol.",
    });
  }

  // Normalize inputs.
  const normalizedEmail = normalizeEmail(email);
  const cleanedName = normalizeText(name);
  const cleanedReferral = normalizeText(referralId);

  // Ensure email is not already registered.
  const existing = await User.exists({ email: normalizedEmail });
  if (existing) {
    return res.status(409).json({ message: "Email already in use." });
  }

  // Hash the password before storing it.
  const passwordHash = await bcrypt.hash(password, HASH_ROUNDS);

  // Create a new user.
  const user = await User.create({
    name: cleanedName,
    email: normalizedEmail,
    passwordHash,
    referralId: cleanedReferral,
    authProvider: "local",
  });

  // Return a safe version of the user (no password).
  return res.status(201).json({
    user: toSafeUser(user),
    message: "Registration successful.",
  });
};

// Login: verify email + password, then issue a JWT.
export const login = async (req, res) => {
  // Read submitted credentials.
  const { email, password } = req.body;
  // Require both fields.
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  // Normalize email and look up active account.
  const normalizedEmail = normalizeEmail(email);
  const user = await User.findOne({
    email: normalizedEmail,
    status: "active",
  }).select("+passwordHash");

  // Avoid leaking whether the email exists by returning the same error.
  if (!user) {
    logAuthAnomaly(req, "user-not-found");
    return res.status(401).json({ message: "Invalid credentials." });
  }

  // Google-only accounts have no password hash.
  if (!user.passwordHash) {
    logAuthAnomaly(req, "password-missing");
    return res.status(401).json({
      message: "This account uses Google sign-in. Continue with Google.",
    });
  }

  // Compare the submitted password with the stored hash.
  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    logAuthAnomaly(req, "invalid-password");
    return res.status(401).json({ message: "Invalid credentials." });
  }

  // Credentials are valid; issue a token.
  clearAuthAnomaly(req);
  const token = signToken({ sub: user.id, role: user.role });
  return res.json({ user: toSafeUser(user), token });
};

// Google login/signup: verify the ID token and create or link a user.
export const googleAuth = async (req, res) => {
  // Read Google credential from request body.
  const { credential, referralId } = req.body;
  if (!credential) {
    return res.status(400).json({ message: "Google credential is required." });
  }

  // Ensure the server has been configured with a Google client ID.
  if (!googleClient) {
    return res.status(500).json({
      message:
        "Google login is not configured. Missing GOOGLE_CLIENT_ID on the server.",
    });
  }

  try {
    // Verify the Google ID token.
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    // Read user info from the verified token.
    const payload = ticket.getPayload();
    const user = await upsertGoogleUser(payload, referralId, req);

    // Success: issue a JWT.
    clearAuthAnomaly(req);
    const token = signToken({ sub: user.id, role: user.role });
    return res.json({ user: toSafeUser(user), token });
  } catch (error) {
    // Token verification failed.
    console.error("Google auth failed:", error?.message || error);
    logAuthAnomaly(req, "google-verify-failed");
    return res.status(401).json({ message: "Google authentication failed." });
  }
};


// Google OAuth callback: exchange code for tokens, then issue a JWT and redirect.
export const googleOAuthCallback = async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.redirect(`${FRONTEND_URL}/login?error=google_failed`);
  }

  if (!googleOAuthClient) {
    return res.redirect(`${FRONTEND_URL}/login?error=google_not_configured`);
  }

  try {
    const { tokens } = await googleOAuthClient.getToken(code);
    if (!tokens?.id_token) {
      return res.redirect(`${FRONTEND_URL}/login?error=google_failed`);
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const user = await upsertGoogleUser(payload, "", req);
    clearAuthAnomaly(req);
    const token = signToken({ sub: user.id, role: user.role });
    return res.redirect(`${FRONTEND_URL}/login?token=${encodeURIComponent(token)}`);
  } catch (error) {
    console.error("Google OAuth callback failed:", error?.message || error);
    logAuthAnomaly(req, "google-callback-failed");
    return res.redirect(`${FRONTEND_URL}/login?error=google_failed`);
  }
};

const upsertGoogleUser = async (payload, referralId, req) => {
  const email = payload?.email;
  const emailVerified = payload?.email_verified;
  const googleId = payload?.sub;

  // Ensure the token has the fields we need.
  if (!email || !googleId) {
    logAuthAnomaly(req, "google-payload-missing");
    throw new Error("Invalid Google credential.");
  }

  // Only allow verified Google emails.
  if (!emailVerified) {
    logAuthAnomaly(req, "google-email-unverified");
    throw new Error("Google email not verified.");
  }

  // Normalize email and referral id.
  const normalizedEmail = normalizeEmail(email);
  const cleanedReferral = normalizeText(referralId);
  // Try to find an existing user account.
  let user = await User.findOne({ email: normalizedEmail }).select(
    "+passwordHash",
  );

  // Block login if the account is not active.
  if (user && user.status !== "active") {
    logAuthAnomaly(req, "google-user-inactive");
    throw new Error("Account is not active.");
  }

  // If no user exists, create a new Google user.
  if (!user) {
    user = await User.create({
      name: normalizeText(payload?.name),
      email: normalizedEmail,
      authProvider: "google",
      googleId,
      avatarUrl: payload?.picture || "",
      referralId: cleanedReferral,
    });
    return user;
  }

  // If a different Google account is linked, block the login.
  if (user.googleId && user.googleId !== googleId) {
    logAuthAnomaly(req, "google-id-mismatch");
    throw new Error("Google account mismatch.");
  }

  // Link the Google ID if missing.
  if (!user.googleId) {
    user.googleId = googleId;
  }

  // Update the auth provider state.
  const currentProvider = user.authProvider || "local";
  if (currentProvider === "local") {
    user.authProvider = "both";
  } else if (currentProvider !== "both") {
    user.authProvider = "google";
  }

  // Fill missing profile details.
  if (!user.name && payload?.name) {
    user.name = normalizeText(payload.name);
  }

  if (!user.avatarUrl && payload?.picture) {
    user.avatarUrl = payload.picture;
  }

  // Save updates to the user.
  await user.save();
  return user;
};
// Return the currently authenticated user.
export const me = async (req, res) => {
  return res.json({ user: toSafeUser(req.user) });
};

// Step 1: send a password reset link to the user's email.
export const requestPasswordReset = async (req, res) => {
  // Read submitted email.
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }

  // Normalize email and look up user.
  const normalizedEmail = normalizeEmail(email);
  // We respond the same either way so we don’t leak whether the email exists.
  const user = await User.findOne({
    email: normalizedEmail,
    status: "active",
  });

  // If no user, respond with the same message.
  if (!user) {
    logAuthAnomaly(req, "forgot-user-not-found");
    return res.json({
      message:
        "If that email matches an account, reset instructions have been sent.",
    });
  }

  // Google-only users do not have local passwords to reset.
  if (user.authProvider === "google") {
    logAuthAnomaly(req, "forgot-google-user");
    return res.json({
      message:
        "If that email matches an account, reset instructions have been sent.",
    });
  }

  // Save a hashed token + expiry on the user record.
  const { token, tokenHash, expires } = createResetToken();
  user.resetPasswordTokenHash = tokenHash;
  user.resetPasswordExpires = expires;
  await user.save();

  try {
    // Send reset email.
    await sendPasswordResetEmail(user, token);
  } catch (error) {
    console.error(
      "Password reset email failed:",
      error?.message || error,
    );
  }

  // Always return the same success message.
  return res.json({
    message:
      "If that email matches an account, reset instructions have been sent.",
  });
};

// Step 2: accept reset token + new password and update the account.
export const resetPassword = async (req, res) => {
  // Read submitted token + password.
  const { token, password } = req.body;
  if (!token || !password) {
    return res
      .status(400)
      .json({ message: "Token and password are required." });
  }

  // Enforce password strength.
  if (!PASSWORD_POLICY.test(password)) {
    return res.status(400).json({
      message:
        "Password must be at least 8 characters long and include upper/lower case letters, a number, and a symbol.",
    });
  }

  // Hash the incoming token and match it against what we stored.
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({
    resetPasswordTokenHash: tokenHash,
    resetPasswordExpires: { $gt: new Date() },
    status: "active",
  }).select("+resetPasswordTokenHash");

  // If token is invalid or expired, stop.
  if (!user) {
    logAuthAnomaly(req, "reset-token-invalid");
    return res
      .status(400)
      .json({ message: "Invalid or expired password reset token." });
  }

  // Update password and clear reset fields so the token can’t be reused.
  user.passwordHash = await bcrypt.hash(password, HASH_ROUNDS);
  user.resetPasswordTokenHash = "";
  user.resetPasswordExpires = null;
  await user.save();

  // Clear any anomaly tracking and return success.
  clearAuthAnomaly(req);
  return res.json({ message: "Password reset successfully." });
};
