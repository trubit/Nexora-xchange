import mongoose from "mongoose";

const DeviceSessionSchema = new mongoose.Schema(
  {
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sessionId:  { type: String, required: true, unique: true },
    // SHA-256 of userAgent+acceptLanguage+screenRes — stable per device
    deviceFingerprint: { type: String, default: "" },
    ipAddress:  { type: String, default: "" },
    userAgent:  { type: String, default: "" },
    // Browser/OS labels parsed from UA
    browser:    { type: String, default: "Unknown" },
    os:         { type: String, default: "Unknown" },
    deviceType: { type: String, enum: ["desktop","mobile","tablet","unknown"], default: "unknown" },
    // Geo — IP-derived (country/city, best-effort)
    country:    { type: String, default: "" },
    city:       { type: String, default: "" },
    lastSeenAt: { type: Date, default: Date.now },
    isActive:   { type: Boolean, default: true, index: true },
    revokedAt:  { type: Date, default: null },
    revokedBy:  { type: String, enum: ["user","admin","system"], default: null },
    // TTL — automatically mark inactive after 30 days of no activity
    expiresAt:  { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  },
  { timestamps: true, versionKey: false }
);

DeviceSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

DeviceSessionSchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id?.toString(); delete ret._id;
  },
});

export default mongoose.model("DeviceSession", DeviceSessionSchema);
