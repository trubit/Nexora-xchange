import { CONTACT_RECEIVER, sendContactEmail } from "../config/mailer.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sanitizeInput = (value) =>
  String(value || "")
    .replace(/[<>]/g, "")
    .trim();

const escapeHtml = (value) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatMessageText = ({ fullName, email, subject, message }) => {
  return [
    "New Nexora Contact Message",
    "",
    `Name: ${fullName}`,
    `Email: ${email}`,
    `Subject: ${subject}`,
    "",
    "Message:",
    message,
  ].join("\n");
};

const formatMessageHtml = ({ fullName, email, subject, message }) => {
  return `
    <h2>New Nexora Contact Message</h2>
    <p><strong>Name:</strong> ${escapeHtml(fullName)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
    <p><strong>Message:</strong></p>
    <p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>
  `;
};

const WAITLIST_LABELS = {
  arbitrage: "Arbitrage Suite",
  subscription: "Subscription Services",
  futures: "Futures Trading",
  future: "Futures Trading",
  sports: "Sports Trading & Prediction Hub",
  sport: "Sports Trading & Prediction Hub",
};

const formatWaitlistText = ({ email, waitlistType, sourceIp, userAgent }) => {
  const label = WAITLIST_LABELS[waitlistType] || waitlistType;
  return [
    "New Nexora Waitlist Signup",
    "",
    `Program: ${label}`,
    `Email: ${email}`,
    `Submitted At: ${new Date().toISOString()}`,
    `IP Address: ${sourceIp || "unknown"}`,
    `User Agent: ${userAgent || "unknown"}`,
  ].join("\n");
};

const formatWaitlistHtml = ({ email, waitlistType, sourceIp, userAgent }) => {
  const label = WAITLIST_LABELS[waitlistType] || waitlistType;
  return `
    <h2>New Nexora Waitlist Signup</h2>
    <p><strong>Program:</strong> ${escapeHtml(label)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Submitted At:</strong> ${escapeHtml(new Date().toISOString())}</p>
    <p><strong>IP Address:</strong> ${escapeHtml(sourceIp || "unknown")}</p>
    <p><strong>User Agent:</strong> ${escapeHtml(userAgent || "unknown")}</p>
  `;
};

export const submitContactForm = async (req, res) => {
  console.log(`[CONTACT] Form submission attempt from ${req.ip}`);
  try {
    const fullName = sanitizeInput(req.body.fullName);
    const email = sanitizeInput(req.body.email).toLowerCase();
    const subject = sanitizeInput(req.body.subject) || "Contact Form Enquiry";
    const message = sanitizeInput(req.body.message);

    if (!fullName || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "Full name, email, and message are required.",
      });
    }

    if (!EMAIL_PATTERN.test(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Please provide a valid email." });
    }

    if (fullName.length > 100 || subject.length > 150 || message.length > 3000) {
      return res.status(400).json({
        success: false,
        message: "One or more fields exceed the maximum allowed length.",
      });
    }

    const payload = { fullName, email, subject, message };
    const text = formatMessageText(payload);
    const html = formatMessageHtml(payload);

    await sendContactEmail({
      fromEmail: email,
      subject: `Contact: ${subject}`,
      text,
      html,
    });

    return res.status(200).json({
      success: true,
      message: `Message sent successfully to ${CONTACT_RECEIVER}.`,
    });
  } catch (error) {
    console.error("Contact form submission failed:", error?.message || error);
    return res.status(500).json({
      success: false,
      message: "We could not send your message right now. Please try again.",
    });
  }
};

export const submitWaitlistForm = async (req, res) => {
  try {
    const email = sanitizeInput(req.body.email).toLowerCase();
    const waitlistType = sanitizeInput(req.body.waitlistType).toLowerCase();

    if (!email || !waitlistType) {
      return res.status(400).json({
        success: false,
        message: "Email and waitlist type are required.",
      });
    }

    if (!EMAIL_PATTERN.test(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Please provide a valid email." });
    }

    if (!WAITLIST_LABELS[waitlistType]) {
      return res.status(400).json({
        success: false,
        message: "Invalid waitlist type.",
      });
    }

    const sourceIp =
      req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
      req.ip;
    const userAgent = req.headers["user-agent"] || "unknown";

    const payload = { email, waitlistType, sourceIp, userAgent };
    await sendContactEmail({
      fromEmail: email,
      subject: `Waitlist: ${WAITLIST_LABELS[waitlistType]}`,
      text: formatWaitlistText(payload),
      html: formatWaitlistHtml(payload),
    });

    return res.status(200).json({
      success: true,
      message: `Waitlist request sent to ${CONTACT_RECEIVER}.`,
    });
  } catch (error) {
    console.error("Waitlist form submission failed:", error?.message || error);
    return res.status(500).json({
      success: false,
      message:
        "We could not process your waitlist request right now. Please try again.",
    });
  }
};
