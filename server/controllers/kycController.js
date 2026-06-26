import path from "path";
import fs from "fs";
import multer from "multer";
import KycProfile from "../models/KycProfile.js";
import User from "../models/User.js";

// ── Multer — KYC document uploads ─────────────────────────────────────────────
import { KYC_DIR, deleteUploadedFile } from "../config/uploads.js";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, KYC_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `kyc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (/^image\/(jpeg|jpg|png|webp)$/.test(file.mimetype)) cb(null, true);
  else cb(new Error("Only image files are allowed (jpg, png, webp)."));
};

const uploader = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
}).single("document");

// POST /api/kyc/upload — upload one document image, returns its URL
export const uploadKycDocument = (req, res) => {
  uploader(req, res, (err) => {
    if (err) {
      const msg = err.code === "LIMIT_FILE_SIZE"
        ? "File is too large. Max size is 5 MB."
        : /^(ENOENT|EACCES|EPERM|ENOTDIR|EMFILE)/.test(err.code || "")
          ? "File storage unavailable. Please try again."
          : err.message;
      return res.status(400).json({ message: msg });
    }
    if (!req.file) return res.status(400).json({ message: "No file received." });
    res.json({ url: `/uploads/kyc/${req.file.filename}` });
  });
};

// GET /api/kyc/me — fetch current user's KYC profile
export const getMyKyc = async (req, res) => {
  const profile = await KycProfile.findOne({ user: req.user.id });
  if (!profile) return res.status(404).json({ message: "No KYC submission found." });
  return res.json({ profile });
};

// GET /api/kyc — admin: list all submissions
export const listKyc = async (_req, res) => {
  const profiles = await KycProfile.find()
    .populate("user", "email name kycStatus createdAt")
    .sort({ createdAt: -1 });
  res.json({ profiles });
};

// POST /api/kyc/submit — create or re-submit KYC
export const submitKyc = async (req, res) => {
  const { personalInfo, documentType, documents } = req.body;

  if (!personalInfo?.firstName?.trim() || !personalInfo?.lastName?.trim()) {
    return res.status(400).json({ message: "First name and last name are required." });
  }
  if (!personalInfo?.dateOfBirth) {
    return res.status(400).json({ message: "Date of birth is required." });
  }
  if (!documentType) {
    return res.status(400).json({ message: "Document type is required." });
  }
  if (!Array.isArray(documents) || documents.length === 0) {
    return res.status(400).json({ message: "At least one document image is required." });
  }
  const hasFront = documents.some((d) => d.side === "front");
  if (!hasFront) {
    return res.status(400).json({ message: "Front image of the document is required." });
  }
  // Validate that every document URL is a server-generated upload path (no traversal)
  const validUrl = /^\/uploads\/kyc\/[^/\\]+$/;
  if (documents.some((d) => !validUrl.test(d.url))) {
    return res.status(400).json({ message: "Invalid document URL." });
  }

  // Fetch old docs now so we can clean them up after a successful upsert
  const oldProfile = await KycProfile.findOne({ user: req.user.id }).select("documents").lean();

  const profile = await KycProfile.findOneAndUpdate(
    { user: req.user.id },
    {
      user: req.user.id,
      personalInfo,
      documentType,
      documents,
      status: "pending",
      submittedAt: new Date(),
      reviewedAt: null,
      reviewerNote: "",
    },
    { new: true, upsert: true, runValidators: true }
  );

  // Keep User.kycStatus in sync
  await User.findByIdAndUpdate(req.user.id, { kycStatus: "pending" });

  // Delete old document files only after the DB write succeeded
  if (oldProfile?.documents?.length) {
    for (const doc of oldProfile.documents) {
      if (doc.url) deleteUploadedFile(doc.url);
    }
  }

  return res.status(201).json({ profile });
};

// PUT /api/kyc/:id — admin: approve or reject a submission
export const reviewKyc = async (req, res) => {
  const { status, reviewerNote } = req.body;
  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ message: "Status must be 'approved' or 'rejected'." });
  }

  const profile = await KycProfile.findByIdAndUpdate(
    req.params.id,
    { status, reviewerNote: reviewerNote || "", reviewedAt: new Date() },
    { new: true, runValidators: true }
  ).populate("user", "email name");

  if (!profile) return res.status(404).json({ message: "KYC profile not found." });

  // Sync User.kycStatus with the review outcome
  const userId = profile.user?._id || profile.user;
  await User.findByIdAndUpdate(userId, {
    kycStatus: status === "approved" ? "approved" : "rejected",
  });

  return res.json({ profile });
};
