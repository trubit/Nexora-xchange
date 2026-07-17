import mongoose from "mongoose";

/**
 * InstitutionalClient — registered institutional trading entity.
 *
 * Governs API access, rate limits, sub-account hierarchy, and compliance tier.
 */
const InstitutionalClientSchema = new mongoose.Schema(
  {
    name:          { type: String, required: true, unique: true },
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    tier:          { type: String, enum: ["bronze", "silver", "gold", "platinum"], default: "bronze" },
    kycVerified:   { type: Boolean, default: false },
    amlCleared:    { type: Boolean, default: false },
    enabled:       { type: Boolean, default: true, index: true },

    // Rate limits (per rolling minute)
    rateLimitRpm:  { type: Number, default: 120 },   // REST API calls/min
    wsStreamLimit: { type: Number, default: 5 },     // concurrent WebSocket streams
    orderRateLimit:{ type: Number, default: 60 },    // orders/min

    // Position / exposure caps
    maxOrderUsd:   { type: Number, default: 1_000_000 },
    maxPositionUsd:{ type: Number, default: 10_000_000 },

    // Sub-account allowance
    maxSubAccounts:{ type: Number, default: 10 },

    // Contact and compliance
    contactEmail:  { type: String, required: true },
    jurisdiction:  { type: String, default: "US" },
    complianceNotes: { type: String, default: "" },

    metadata:      { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model("InstitutionalClient", InstitutionalClientSchema);
