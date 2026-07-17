import mongoose from "mongoose";

/**
 * EcosystemIntegration — API integration records between TrusonXchanger and partners.
 * type: webhook | rest_pull | websocket | sftp | batch
 * status: configured | active | failing | paused | deprecated
 */
const EcosystemIntegrationSchema = new mongoose.Schema(
  {
    integrationId: { type: String, required: true, unique: true, index: true },
    partnerId:     { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ["webhook", "rest_pull", "websocket", "sftp", "batch"],
      required: true,
    },
    status: {
      type: String,
      enum: ["configured", "active", "failing", "paused", "deprecated"],
      default: "configured",
      index: true,
    },
    direction:     { type: String, enum: ["inbound", "outbound", "bidirectional"], default: "bidirectional" },
    dataTypes:     { type: [String], default: [] },  // e.g. ["price_feed", "order_flow"]
    callCount:     { type: Number, default: 0 },
    errorCount:    { type: Number, default: 0 },
    lastSuccessAt: { type: Date, default: null },
    lastErrorAt:   { type: Date, default: null },
    lastError:     { type: String, default: null },
    metadata:      { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model("EcosystemIntegration", EcosystemIntegrationSchema);
