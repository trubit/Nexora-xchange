import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpSecure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

const mailerConfigured = Boolean(smtpUser && smtpPass);

const transporter = mailerConfigured
  ? nodemailer.createTransport(
      smtpHost
        ? {
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure,
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
          }
        : {
            service: "gmail",
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
          },
    )
  : null;

const SUPPORT_INBOX = process.env.SUPPORT_EMAIL || "nexora@gmail.com";

export const CONTACT_RECEIVER =
  process.env.CONTACT_RECEIVER ||
  process.env.SMTP_REPLY_TO ||
  process.env.SMTP_FROM_EMAIL ||
  SUPPORT_INBOX;

export const sendContactEmail = async ({ fromEmail, subject, text, html }) => {
  if (!transporter) {
    throw new Error(
      "Contact mailer is not configured. Set SMTP_USER/SMTP_PASS (or EMAIL_USER/EMAIL_PASS).",
    );
  }

  const fromAddress =
    process.env.SMTP_FROM ||
    `"Nexora Contact" <${process.env.SMTP_FROM_EMAIL || smtpUser}>`;

  await transporter.sendMail({
    from: fromAddress,
    to: CONTACT_RECEIVER,
    cc:
      CONTACT_RECEIVER.toLowerCase() === SUPPORT_INBOX
        ? undefined
        : SUPPORT_INBOX,
    replyTo: fromEmail,
    subject,
    text,
    html,
  });
};
