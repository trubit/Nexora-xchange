 import mongoose from "mongoose";

const KycProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    level: { type: String, default: "basic" },
    documents: [
      {
        type: { type: String, default: "" },
        url: { type: String, default: "" },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    submittedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date },
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

const KycProfile = mongoose.model("KycProfile", KycProfileSchema);

export default KycProfile; 

