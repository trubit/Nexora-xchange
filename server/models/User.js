import mongoose from "mongoose";

// User schema: defines how user data is stored in MongoDB.
const UserSchema = new mongoose.Schema(
  {
    // Full name (optional).
    name: { type: String, trim: true, default: "" },
    // Email is required and must be unique per account.
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: {
      type: String,
      // Password hash is required only for local (email/password) users.
      required: function requiredPasswordHash() {
        return this.authProvider === "local";
      },
      select: false,
    },
    authProvider: {
      type: String,
      enum: ["local", "google", "both"],
      default: "local",
    },
    // Google account ID (used when signing in with Google).
    googleId: { type: String, default: "" },
    // Profile photo URL from Google (optional).
    avatarUrl: { type: String, default: "" },
    resetPasswordTokenHash: { type: String, default: "", select: false },
    resetPasswordExpires: { type: Date },
    // Email verification state for local signups.
    emailVerified: { type: Boolean, default: undefined },
    emailVerifyTokenHash: { type: String, default: "", select: false },
    emailVerifyExpires: { type: Date },
    // Email verification code (OTP) for local signups.
    emailVerifyCodeHash: { type: String, default: "", select: false },
    emailVerifyCodeExpires: { type: Date },
    // Authorization role for access control.
    role: { type: String, enum: ["user", "admin"], default: "user" },
    // Set whenever the password changes — any token issued before this moment is rejected.
    passwordChangedAt: { type: Date },
    // Contact phone is required for local (email/password) account creation.
    phone: {
      type: String,
      default: "",
      required: function requiredPhone() {
        return this.authProvider === "local";
      },
    },
    // Unique numeric UID shown to the user (8 digits, like Bybit/Bitget).
    uid: { type: String, unique: true, sparse: true, index: true },
    // Referral code used during signup (optional).
    referralId: { type: String, default: "" },
    // Account status controls whether user can log in.
    status: { type: String, enum: ["active", "suspended"], default: "active" },
    kycStatus: {
      type: String,
      enum: ["unverified", "pending", "approved", "rejected"],
      default: "unverified",
    },
  },
  { timestamps: true }
);

// When sending user data to the client, remove sensitive fields.
UserSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    // Convert MongoDB _id to a friendly id string.
    ret.id = ret._id.toString();
    // Remove internal Mongo fields and secrets.
    delete ret._id;
    delete ret.passwordHash;
    delete ret.googleId;
  },
});

// Create the User model (collection will be "users").
const User = mongoose.model("User", UserSchema);

export default User; 

