import mongoose from "mongoose";

/**
 * EcosystemPartner — registered financial ecosystem participants.
 * type: exchange | bank | payment_processor | defi_protocol | custodian | data_provider
 * status: pending | active | suspended | terminated
 */
const EcosystemPartnerSchema = new mongoose.Schema(
  {
    partnerId:   { type: String, required: true, unique: true, index: true },
    name:        { type: String, required: true },
    type: {
      type: String,
      enum: ["exchange", "bank", "payment_processor", "defi_protocol", "custodian", "data_provider"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "active", "suspended", "terminated"],
      default: "pending",
      index: true,
    },
    region:      { type: String, default: "global" },
    apiEndpoint: { type: String, default: null },
    apiKeyHash:  { type: String, default: null },    // SHA-256 of partner API key
    capabilities:{ type: [String], default: [] },    // e.g. ["spot_trading", "custody"]
    ratingScore: { type: Number, default: null, min: 0, max: 100 },
    contractedAt:{ type: Date, default: null },
    metadata:    { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model("EcosystemPartner", EcosystemPartnerSchema);
