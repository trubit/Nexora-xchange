import nodemailer from "nodemailer";

// Defaults used when env vars are missing.
const DEFAULT_FROM_NAME = "TrusonXchanger";
const DEFAULT_FROM_EMAIL = "no-reply@trusonxchanger.com";

// Read SMTP config from environment with Brevo defaults.
const getSmtpConfig = () => ({
  host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true" ? true : false,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  fromName: process.env.SMTP_FROM_NAME || DEFAULT_FROM_NAME,
  fromEmail: process.env.SMTP_FROM_EMAIL || DEFAULT_FROM_EMAIL,
  fromRaw: process.env.SMTP_FROM,
  replyTo: process.env.SMTP_REPLY_TO || "",
});

// Prefer a fully-formed From header if provided.
const buildFromHeader = ({ fromName, fromEmail, fromRaw }) => {
  if (fromRaw) {
    return fromRaw;
  }
  return `${fromName} <${fromEmail}>`;
};

// Only enable SMTP when both credentials exist.
const isConfigured = ({ user, pass }) => Boolean(user && pass);

// Create a Brevo SMTP transporter (STARTTLS on port 587).
const createTransporter = ({ host, port, secure, user, pass }) => {
  return nodemailer.createTransport({
    host,
    port,
    secure,
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 20000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 15000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 25000),
    auth: {
      user,
      pass,
    },
  });
};

// Build a single transporter instance (reused for all sends).
const transporterConfig = getSmtpConfig();
const transporter = isConfigured(transporterConfig)
  ? createTransporter(transporterConfig)
  : null;

// Verify connection on startup for fast feedback.
const verifyTransporter = async () => {
  if (!transporter) {
    console.warn(
      "SMTP not configured. Skipping email transport verification.",
    );
    return;
  }

  try {
    await transporter.verify();
    console.log(
      "SMTP connection ready. Emails will be sent through Brevo SMTP.",
    );
  } catch (error) {
    console.error(
      "SMTP verification failed. Check your Brevo SMTP credentials:",
      error?.message || error,
    );
  }
};

void verifyTransporter();

// Basic HTML-to-text fallback without extra dependencies.
const htmlToText = (html = "") => {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<p\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

// Support both object-based and positional arguments.
const normalizeSendArgs = (to, subject, html, text) => {
  if (typeof to === "object" && to !== null) {
    return to;
  }
  return { to, subject, html, text };
};

// Main email sender used across controllers.
export const sendEmail = async (to, subject, html, text) => {
  const args = normalizeSendArgs(to, subject, html, text);
  const { to: recipient, subject: mailSubject, html: htmlBody } = args;
  const smtpConfig = getSmtpConfig();
  const from = buildFromHeader(smtpConfig);
  const replyTo = smtpConfig.replyTo || undefined;
  const resolvedText =
    args.text || (htmlBody ? htmlToText(htmlBody) : undefined);

  if (!transporter) {
    console.warn("SMTP not configured. Email skipped:", {
      to: recipient,
      subject: mailSubject,
    });
    return;
  }

  try {
    await transporter.sendMail({
      from,
      to: recipient,
      subject: mailSubject,
      text: resolvedText,
      html: htmlBody,
      replyTo,
    });
  } catch (error) {
    console.error("Email send failed:", error?.message || error);
    throw error;
  }
};
