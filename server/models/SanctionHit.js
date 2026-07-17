import mongoose from "mongoose";

/**
 * SanctionHit — record of a sanctions list match against a user or address.
 * Stores the match details and review outcome.
 */
const SanctionHitSchema = new mongoose.Schema(
  {
    hitId:        { type: String, required: true, unique: true, index: true },
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    address:      { type: String, default: null },
    matchedValue: { type: String, required: true },
    listName: {
      type: String,
      enum: ["OFAC_SDN", "EU_SANCTIONS", "UN_SANCTIONS", "HMT_UK", "INTERNAL_BLACKLIST"],
      required: true,
    },
    matchType:    { type: String, enum: ["exact", "fuzzy", "address"], required: true },
    matchScore:   { type: Number, default: 100 },
    status: {
      type: String,
      enum: ["pending_review", "confirmed", "false_positive", "escalated"],
      default: "pending_review",
      index: true,
    },
    reviewedBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt:   { type: Date, default: null },
    reviewNotes:  { type: String, default: null },
    autoFrozen:   { type: Boolean, default: false },
    metadata:     { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model("SanctionHit", SanctionHitSchema);
