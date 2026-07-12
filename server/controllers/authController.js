import bcrypt from "bcryptjs";
import crypto from "crypto";
import multer from "multer";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import { signToken, revokeToken, verifyToken, isTokenRevoked } from "../utils/jwt.js";
import { sendEmail } from "../utils/email.js";
import { clearAuthAnomaly, logAuthAnomaly } from "../middleware/security.js";
import { recordLogin } from "../services/riskService.js";
import { auditAuth } from "../services/auditService.js";
import { createSession, isNewDevice } from "../services/securityService.js";
import logger from "../config/logger.js";

// ── Avatar upload ─────────────────────────────────────────────────────────────
import { AVATAR_DIR, deleteUploadedFile } from "../config/uploads.js";

// ── OAuth one-time code store ──────────────────────────────────────────────────
// Stores short-lived codes for the Google redirect flow so the JWT never appears
// in the URL (and therefore never lands in server logs or browser history).
const _oauthCodes = new Map(); // code → { token, expiresAt }
const _storeOAuthCode = (token) => {
  const code = crypto.randomUUID();
  _oauthCodes.set(code, { token, expiresAt: Date.now() + 60_000 }); // 60 s TTL
  // Evict expired codes lazily on each write to keep the map small
  for (const [k, v] of _oauthCodes) {
    if (Date.now() > v.expiresAt) _oauthCodes.delete(k);
  }
  return code;
};
export const exchangeOAuthCode = (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ message: "Code required." });
  const entry = _oauthCodes.get(String(code));
  if (!entry || Date.now() > entry.expiresAt) {
    _oauthCodes.delete(String(code));
    return res.status(400).json({ message: "Invalid or expired code." });
  }
  // Keep the code in the map until it expires (60 s TTL) so React StrictMode's
  // double-effect invocation can re-exchange the same code without failing.
  return res.json({ token: entry.token });
};

const avatarUploader = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
    filename: (req, _file, cb) => {
      const ext = ".jpg";
      cb(null, `avatar_${req.user.id}_${Date.now()}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|jpg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error("Only jpg, png, webp or gif images are allowed."));
  },
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB
}).single("avatar");

export const uploadAvatar = (req, res, next) => {
  avatarUploader(req, res, async (err) => {
    if (err) {
      const msg = err.code === "LIMIT_FILE_SIZE"
        ? "Image is too large. Max size is 3 MB."
        : /^(ENOENT|EACCES|EPERM|ENOTDIR|EMFILE)/.test(err.code || "")
          ? "File storage unavailable. Please try again."
          : err.message;
      return res.status(400).json({ message: msg });
    }
    if (!req.file) return res.status(400).json({ message: "No file received." });
    try {
      const url = `/uploads/avatars/${req.file.filename}`;
      const existing = await User.findById(req.user.id).select("avatarUrl").lean();
      const user = await User.findByIdAndUpdate(
        req.user.id,
        { avatarUrl: url },
        { new: true },
      );
      // Delete old avatar only after the DB update succeeds
      if (existing?.avatarUrl) deleteUploadedFile(existing.avatarUrl);
      return res.json({ avatarUrl: url, user: toSafeUser(user) });
    } catch (e) {
      next(e);
    }
  });
};

// Password rule: minimum 8 characters with upper, lower, number, and symbol.
const PASSWORD_POLICY =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
const PHONE_POLICY = /^\+?[0-9()\-\s]{7,20}$/;
// How many rounds to use when hashing passwords.
const HASH_ROUNDS = 12;
// Reset links expire after 1 hour for safety.
const RESET_TOKEN_TTL_MS = 1000 * 60 * 60;
// Email verification codes expire after 10 minutes.
const EMAIL_VERIFY_CODE_TTL_MS = 1000 * 60 * 10;
// Frontend base URL used in reset-password links.
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
// Public frontend URL to force for production emails/redirects (recommended).
const PUBLIC_FRONTEND_URL = process.env.PUBLIC_FRONTEND_URL || "";
// Allowed frontend origins (comma-separated), shared with CORS config.
const CORS_ORIGIN = process.env.CORS_ORIGIN || "";
// Generate a unique 8-digit UID (retries on collision).
const generateUid = async () => {
  for (let i = 0; i < 10; i++) {
    const uid = String(Math.floor(10000000 + Math.random() * 90000000));
    const exists = await User.exists({ uid });
    if (!exists) return uid;
  }
  throw new Error("UID generation failed — retry later.");
};

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

const encodeGoogleState = (value) =>
  Buffer.from(JSON.stringify(value), "utf8").toString("base64url");

const decodeGoogleState = (value) => {
  try {
    if (!value || typeof value !== "string") {
      return {};
    }
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
};

const parseUrl = (value) => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const parseOrigins = (value) => {
  if (!value || value === "*") {
    return [];
  }

  return String(value)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => parseUrl(origin)?.origin)
    .filter(Boolean);
};

const configuredFrontendOrigins = new Set(
  [
    parseUrl(FRONTEND_URL)?.origin,
    parseUrl(PUBLIC_FRONTEND_URL)?.origin,
    ...parseOrigins(CORS_ORIGIN),
  ].filter(Boolean),
);

const isSafeFrontendUrl = (value) => {
  const parsed = parseUrl(value);
  if (!parsed) {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  return configuredFrontendOrigins.has(parsed.origin);
};

const isLocalHostName = (hostname = "") =>
  hostname === "localhost" || hostname === "127.0.0.1";

const isPrivateHostName = (hostname = "") =>
  isLocalHostName(hostname) ||
  hostname.startsWith("10.") ||
  hostname.startsWith("192.168.") ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);

const resolveFrontendUrl = (...candidates) => {
  // If PUBLIC_FRONTEND_URL is configured, always prefer it for multi-device compatibility.
  const publicUrl = parseUrl(PUBLIC_FRONTEND_URL);
  if (publicUrl && !isPrivateHostName(publicUrl.hostname)) {
    return PUBLIC_FRONTEND_URL;
  }

  // If FRONTEND_URL itself is public, use it as canonical fallback.
  const envUrl = parseUrl(FRONTEND_URL);
  if (envUrl && !isPrivateHostName(envUrl.hostname)) {
    return FRONTEND_URL;
  }

  for (const candidate of candidates) {
    if (typeof candidate === "string" && isSafeFrontendUrl(candidate)) {
      return candidate;
    }
  }
  return FRONTEND_URL;
};

const toShortText = (value, max = 140) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const buildGoogleErrorRedirect = (frontendUrl, reason, description = "") => {
  const params = new URLSearchParams({ error: "google_failed" });
  if (reason) {
    params.set("reason", toShortText(reason, 80));
  }
  if (description) {
    params.set("desc", toShortText(description, 180));
  }
  return `${frontendUrl}/login?${params.toString()}`;
};
// Emails that always get admin role — stored lowercase, comma-separated in env.
// No hardcoded fallback: leave SUPER_ADMIN_EMAILS unset to disable auto-promotion.
const SUPER_ADMIN_EMAILS = new Set(
  (process.env.SUPER_ADMIN_EMAILS || "")
    .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
);

// If the user's email is in the super-admin list, promote them to admin.
// Returns true when a DB write was needed.
const promoteIfSuperAdmin = async (user) => {
  if (!SUPER_ADMIN_EMAILS.has((user.email || "").toLowerCase())) return false;
  if (user.role === "admin") return false;
  await User.findByIdAndUpdate(user._id, { $set: { role: "admin" } });
  user.role = "admin";
  return true;
};

// Remove sensitive fields before sending user data to the client.
const toSafeUser = (user) => (user ? user.toJSON() : null);
// Normalize inputs to avoid case and whitespace issues.
const normalizeEmail = (value) => value?.toLowerCase().trim();
const normalizeText = (value) => value?.trim() ?? "";
// Build reset link for the frontend reset-password page.
const buildResetUrl = (token, frontendUrl = FRONTEND_URL) =>
  `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
// Create a reset token and store only its hash in the database.
const createResetToken = () => {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  return { token, tokenHash, expires };
};

// Create a 6-digit email verification code and store only its hash.
const createEmailVerifyCode = () => {
  const code = crypto.randomInt(100000, 1000000).toString();
  const codeHash = crypto.createHash("sha256").update(code).digest("hex");
  const expires = new Date(Date.now() + EMAIL_VERIFY_CODE_TTL_MS);
  return { code, codeHash, expires };
};

// Send a reset link email (HTML + plain text).
const sendPasswordResetEmail = async (user, token, frontendUrl = FRONTEND_URL) => {
  const resetUrl = buildResetUrl(token, frontendUrl);
  const subject = "Reset your Nexora password";
  const text = [
    "You requested a password reset for your Nexora account.",
    "",
    "Reset your password using this link:",
    resetUrl,
    "",
    "If you did not request this, you can ignore this message.",
  ].join("\n");
  const html = `
    <p>You requested a password reset for your Nexora account.</p>
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

// Send a verification code email (HTML + plain text).
const sendEmailVerificationEmail = async (user, code) => {
  const subject = "Your Nexora verification code";
  const text = [
    "Welcome to Nexora!",
    "",
    "Use this verification code to confirm your email address:",
    code,
    "",
    "This code expires in 10 minutes.",
    "If you did not create this account, you can ignore this message.",
  ].join("\n");
  const html = `
    <p>Welcome to Nexora!</p>
    <p>Use this verification code to confirm your email address:</p>
    <p style="font-size:24px;font-weight:700;letter-spacing:3px;margin:16px 0;">
      ${code}
    </p>
    <p>This code expires in <strong>10 minutes</strong>.</p>
    <p>If you did not create this account, you can ignore this message.</p>
  `;

  await sendEmail({ to: user.email, subject, text, html });
};

// Signup: validate input, hash password, create user, return safe profile.
export const register = async (req, res) => {
  // Read submitted fields.
  const { name, email, phone, password, referralId } = req.body;
  // Require email + phone + password.
  if (!email || !phone || !password) {
    return res.status(400).json({
      message: "Email, phone number, and password are required.",
    });
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
  const cleanedPhone = normalizeText(phone);
  const cleanedReferral = normalizeText(referralId);

  if (!PHONE_POLICY.test(cleanedPhone)) {
    return res.status(400).json({ message: "Enter a valid phone number." });
  }

  // Ensure email is not already registered.
  const existing = await User.exists({ email: normalizedEmail });
  if (existing) {
    return res.status(409).json({ message: "Email already in use." });
  }

  // Hash the password before storing it.
  const passwordHash = await bcrypt.hash(password, HASH_ROUNDS);

  // Create a verification code for local signups.
  const { code, codeHash, expires } = createEmailVerifyCode();

  // Create a new user.
  const uid = await generateUid();
  const user = await User.create({
    name: cleanedName,
    email: normalizedEmail,
    phone: cleanedPhone,
    passwordHash,
    referralId: cleanedReferral,
    authProvider: "local",
    emailVerified: false,
    emailVerifyCodeHash: codeHash,
    emailVerifyCodeExpires: expires,
    uid,
  });

  void sendEmailVerificationEmail(user, code).catch((error) => {
    logger.error({ err: error }, "Email verification send failed.");
  });

  // Return a safe version of the user (no password).
  return res.status(201).json({
    user: toSafeUser(user),
    message: "Registration successful. Please check your email for a code.",
  });
};

// Resend verification email for local accounts.
export const resendEmailVerification = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }

  const normalizedEmail = normalizeEmail(email);
  const user = await User.findOne({ email: normalizedEmail }).select(
    "+emailVerifyCodeHash",
  );

  // Always respond the same to avoid leaking account state.
  if (!user) {
    logAuthAnomaly(req, "verify-user-not-found");
    return res.json({
      message:
        "If that email matches an account, a verification code has been sent.",
    });
  }

  if (user.authProvider === "google") {
    logAuthAnomaly(req, "verify-google-user");
    return res.json({
      message:
        "If that email matches an account, a verification code has been sent.",
    });
  }

  // Only resend for accounts explicitly marked unverified.
  if (user.emailVerified !== false) {
    return res.json({
      message:
        "If that email matches an account, a verification code has been sent.",
    });
  }

  const { code, codeHash, expires } = createEmailVerifyCode();
  user.emailVerifyCodeHash = codeHash;
  user.emailVerifyCodeExpires = expires;
  await user.save();

  void sendEmailVerificationEmail(user, code)
    .then(() => {
      clearAuthAnomaly(req);
    })
    .catch((error) => {
      logger.error({ err: error }, "Email verification resend failed.");
    });

  return res.json({
      message:
        "If that email matches an account, a verification code has been sent.",
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

  // Block local sign-in until the email is verified.
  if (user.authProvider !== "google" && user.emailVerified === false) {
    logAuthAnomaly(req, "email-unverified");
    return res.status(403).json({
      message: "Email not verified. Please check your inbox.",
    });
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
    auditAuth(req, "LOGIN_FAILED", {
      severity: "warning",
      metadata: { reason: "invalid-password" },
      userId: user._id, userEmail: user.email,
    });
    return res.status(401).json({ message: "Invalid credentials." });
  }

  // Credentials are valid; promote to admin if this is the super-admin email.
  clearAuthAnomaly(req);
  await promoteIfSuperAdmin(user);

  // Create device session + detect new device
  const [sessionId, newDevice] = await Promise.all([
    createSession(req, user._id),
    isNewDevice(user._id, req),
  ]);

  const token = signToken({ sub: user.id, role: user.role, sessionId });
  recordLogin(user._id, req.ip, req.headers["user-agent"]).catch(() => {});

  // Immutable audit entry
  auditAuth({ ...req, sessionId }, "LOGIN_SUCCESS", {
    severity: newDevice ? "warning" : "info",
    metadata: { newDevice, ip: req.ip || req.socket?.remoteAddress },
    userId: user._id, userEmail: user.email,
  });

  return res.json({ user: toSafeUser(user), token, sessionId });
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

    // Success: promote to admin if super-admin email, then issue a JWT.
    clearAuthAnomaly(req);
    await promoteIfSuperAdmin(user);
    const token = signToken({ sub: user.id, role: user.role });
    return res.json({ user: toSafeUser(user), token });
  } catch (error) {
    logger.error({ err: error }, "Google auth failed.");
    logAuthAnomaly(req, "google-verify-failed");
    const rawMessage = String(error?.message || "").toLowerCase();
    const hasAudienceIssue =
      rawMessage.includes("audience") ||
      rawMessage.includes("recipient") ||
      rawMessage.includes("client id");

    if (hasAudienceIssue) {
      return res.status(401).json({
        message:
          "Google client mismatch detected. Ensure your frontend and backend Google client IDs match and add this app URL to Authorized JavaScript origins in Google Cloud.",
      });
    }

    return res.status(401).json({ message: "Google authentication failed." });
  }
};

// Google OAuth redirect start endpoint (server-side flow).
export const googleOAuthStart = async (req, res) => {
  const frontendUrl = resolveFrontendUrl(
    req.query?.frontendUrl,
    req.headers.origin,
    FRONTEND_URL,
  );

  if (!googleOAuthClient) {
    return res.redirect(`${frontendUrl}/login?error=google_not_configured`);
  }

  const mode = req.query?.mode === "signup" ? "signup" : "signin";
  const referralId =
    mode === "signup" ? normalizeText(req.query?.referralId || "") : "";
  const state = encodeGoogleState({ mode, referralId, frontendUrl });

  const authUrl = googleOAuthClient.generateAuthUrl({
    access_type: "offline",
    scope: ["openid", "email", "profile"],
    prompt: "select_account",
    state,
  });

  return res.redirect(authUrl);
};


// Google OAuth callback: exchange code for tokens, then issue a JWT and redirect.
export const googleOAuthCallback = async (req, res) => {
  const code = req.query.code;
  const providerError = normalizeText(req.query?.error || "");
  const providerErrorDescription = normalizeText(
    req.query?.error_description || "",
  );
  const decodedState = decodeGoogleState(req.query?.state);
  const requestedMode = req.query?.mode === "signup" ? "signup" : "signin";
  const requestedReferralId =
    requestedMode === "signup" ? normalizeText(req.query?.referralId || "") : "";
  const requestedFrontendUrl = resolveFrontendUrl(
    req.query?.frontendUrl,
    req.headers.origin,
    decodedState?.frontendUrl,
    FRONTEND_URL,
  );

  if (providerError) {
    return res.redirect(
      buildGoogleErrorRedirect(
        requestedFrontendUrl,
        providerError,
        providerErrorDescription,
      ),
    );
  }

  // If no code is provided, treat this as "start OAuth" on the same endpoint.
  if (!code) {
    // Start flow only when this request explicitly asked to start.
    if (!req.query?.mode) {
      return res.redirect(
        buildGoogleErrorRedirect(
          requestedFrontendUrl,
          "missing_code",
          "No authorization code returned by Google.",
        ),
      );
    }

    if (!googleOAuthClient) {
      return res.redirect(`${requestedFrontendUrl}/login?error=google_not_configured`);
    }

    const state = encodeGoogleState({
      mode: requestedMode,
      referralId: requestedReferralId,
      frontendUrl: requestedFrontendUrl,
    });

    const authUrl = googleOAuthClient.generateAuthUrl({
      access_type: "offline",
      scope: ["openid", "email", "profile"],
      prompt: "select_account",
      state,
    });

    return res.redirect(authUrl);
  }

  const mode = decodedState?.mode === "signup" ? "signup" : "signin";
  const referralId =
    mode === "signup" ? normalizeText(decodedState?.referralId || "") : "";
  const frontendUrl = resolveFrontendUrl(
    decodedState?.frontendUrl,
    requestedFrontendUrl,
    FRONTEND_URL,
  );

  if (!googleOAuthClient) {
    return res.redirect(`${frontendUrl}/login?error=google_not_configured`);
  }

  try {
    const { tokens } = await googleOAuthClient.getToken(code);
    if (!tokens?.id_token) {
      return res.redirect(
        buildGoogleErrorRedirect(
          frontendUrl,
          "missing_id_token",
          "Google token exchange succeeded but no ID token was returned.",
        ),
      );
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const user = await upsertGoogleUser(payload, referralId, req);
    clearAuthAnomaly(req);
    await promoteIfSuperAdmin(user);
    const token = signToken({ sub: user.id, role: user.role });

    if (mode === "signup") {
      return res.redirect(`${frontendUrl}/login?google=signup_success`);
    }

    // Use a short-lived one-time code instead of putting the JWT in the URL
    // (URL tokens leak into server logs, browser history, and Referer headers).
    const oauthCode = _storeOAuthCode(token);
    return res.redirect(
      `${frontendUrl}/login?code=${encodeURIComponent(oauthCode)}&redirect=${encodeURIComponent("/Dashboard")}`,
    );
  } catch (error) {
    logger.error({ err: error }, "Google OAuth callback failed.");
    logAuthAnomaly(req, "google-callback-failed");
    const reason =
      error?.response?.data?.error ||
      error?.code ||
      "oauth_callback_failed";
    const description =
      error?.response?.data?.error_description ||
      error?.message ||
      "Google OAuth callback failed.";
    return res.redirect(
      buildGoogleErrorRedirect(frontendUrl, reason, description),
    );
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
    const uid = await generateUid();
    user = await User.create({
      name: normalizeText(payload?.name),
      email: normalizedEmail,
      authProvider: "google",
      googleId,
      avatarUrl: payload?.picture || "",
      referralId: cleanedReferral,
      emailVerified: true,
      uid,
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

  // Mark email as verified when Google confirms it.
  if (user.emailVerified === false) {
    user.emailVerified = true;
    user.emailVerifyTokenHash = "";
    user.emailVerifyExpires = null;
  }

  // Save updates to the user.
  await user.save();
  return user;
};
// Return the currently authenticated user.
export const me = async (req, res) => {
  let user = req.user;
  // Backfill: assign a UID to any existing user who doesn't have one yet.
  if (!user.uid) {
    try {
      const uid = await generateUid();
      user = await User.findByIdAndUpdate(user._id, { uid }, { new: true });
    } catch { /* non-fatal — user still gets a response */ }
  }
  return res.json({ user: toSafeUser(user) });
};

// Change password: verify current password then set a new one (authenticated).
export const logout = async (req, res) => {
  // req.decoded is set by requireAuth — revoke this specific token
  await revokeToken(req.decoded, "logout").catch(() => {});
  return res.json({ message: "Logged out successfully." });
};

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Current password and new password are required." });
  }

  if (!PASSWORD_POLICY.test(newPassword)) {
    return res.status(400).json({
      message: "New password must be at least 8 characters and include upper/lower case letters, a number, and a symbol.",
    });
  }

  // Reload the user with the password hash so we can verify.
  const user = await User.findById(req.user._id).select("+passwordHash");
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  // Google-only accounts have no local password.
  if (user.authProvider === "google" && !user.passwordHash) {
    return res.status(400).json({ message: "This account uses Google sign-in and has no local password to change." });
  }

  const matches = await bcrypt.compare(currentPassword, user.passwordHash || "");
  if (!matches) {
    return res.status(401).json({ message: "Current password is incorrect." });
  }

  user.passwordHash      = await bcrypt.hash(newPassword, HASH_ROUNDS);
  // Stamp the change time — requireAuth rejects any token issued before this moment,
  // invalidating all sessions on all devices without needing to enumerate them.
  user.passwordChangedAt = new Date();
  await user.save();

  return res.json({ message: "Password changed successfully." });
};

// Step 1: send a password reset link to the user's email.
export const requestPasswordReset = async (req, res) => {
  // Read submitted email.
  const { email, frontendUrl } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }
  const safeFrontendUrl = resolveFrontendUrl(
    frontendUrl,
    req.headers["x-frontend-origin"],
    req.headers.origin,
    req.headers.referer,
    FRONTEND_URL,
  );

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

  // Send reset email in background to avoid blocking API response on SMTP latency.
  void sendPasswordResetEmail(user, token, safeFrontendUrl).catch((error) => {
    logger.error({ err: error }, "Password reset email failed.");
  });

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

// Verify email using a token sent to the user.
export const verifyEmail = async (req, res) => {
  const code = req.body?.code || req.query.code || req.body?.token || req.query.token;
  if (!code) {
    return res.status(400).json({ message: "Verification code is required." });
  }

  const codeHash = crypto.createHash("sha256").update(code).digest("hex");
  const user = await User.findOne({
    emailVerifyCodeHash: codeHash,
    emailVerifyCodeExpires: { $gt: new Date() },
  }).select("+emailVerifyCodeHash");

  if (!user) {
    logAuthAnomaly(req, "verify-token-invalid");
    return res
      .status(400)
      .json({ message: "Invalid or expired verification code." });
  }

  user.emailVerified = true;
  user.emailVerifyTokenHash = "";
  user.emailVerifyExpires = null;
  user.emailVerifyCodeHash = "";
  user.emailVerifyCodeExpires = null;
  await user.save();

  clearAuthAnomaly(req);
  return res.json({ message: "Email verified successfully." });
};

// POST /api/auth/verify-email/resend-me — authenticated; resends code to logged-in user's email.
export const resendEmailVerificationMe = async (req, res) => {
  const user = req.user;

  if (user.emailVerified === true) {
    return res.json({ message: "Your email is already verified." });
  }

  const { code, codeHash, expires } = createEmailVerifyCode();
  user.emailVerifyCodeHash    = codeHash;
  user.emailVerifyCodeExpires = expires;
  await user.save();

  void sendEmailVerificationEmail(user, code).catch((err) => {
    logger.error({ err }, "Email verification send failed.");
  });

  return res.json({ message: "Verification code sent. Check your inbox." });
};

// POST /api/auth/refresh — exchange a valid token for a fresh one.
// The client stores the access token under "refreshToken" key (there is no
// separate refresh token in this system). We verify it, check it is not
// revoked, and issue a replacement with a new jti.
export const refreshToken = async (req, res) => {
  const incoming = req.body?.refreshToken;
  if (!incoming) {
    return res.status(400).json({ message: "Refresh token is required." });
  }

  let decoded;
  try {
    decoded = verifyToken(incoming);
  } catch {
    return res.status(401).json({ message: "Invalid or expired token." });
  }

  if (await isTokenRevoked(decoded.jti)) {
    return res.status(401).json({ message: "Token has been revoked." });
  }

  const user = await User.findById(decoded.sub).lean();
  if (!user || user.status === "frozen") {
    return res.status(401).json({ message: "Account is not active." });
  }

  // Invalidate the old token so it cannot be reused.
  await revokeToken(decoded, "refresh");

  const newToken = signToken({ sub: user._id, role: user.role });
  return res.json({ token: newToken, refreshToken: newToken });
};

