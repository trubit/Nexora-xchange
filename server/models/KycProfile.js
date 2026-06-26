import mongoose from "mongoose";

const KycProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    documentType: {
      type: String,
      enum: ["passport", "national_id", "drivers_license"],
      default: "passport",
    },
    personalInfo: {
      firstName:   { type: String, default: "" },
      lastName:    { type: String, default: "" },
      dateOfBirth: { type: String, default: "" },
      nationality: { type: String, default: "" },
      country:     { type: String, default: "" },
      address:     { type: String, default: "" },
      city:        { type: String, default: "" },
      postalCode:  { type: String, default: "" },
      phone:       { type: String, default: "" },
    },
    documents: [
      {
        side:       { type: String, enum: ["front", "back", "selfie"], required: true },
        url:        { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    submittedAt:  { type: Date },
    reviewedAt:   { type: Date },
    reviewerNote: { type: String, default: "" },
  },
  { timestamps: true }
);

KycProfileSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
  },
});

export default mongoose.model("KycProfile", KycProfileSchema);
