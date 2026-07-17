import mongoose from "mongoose";

/**
 * HealthCheckRecord — periodic health probe results for every node/service.
 * Status: healthy | degraded | unhealthy | unknown
 */
const ServiceStatusSchema = new mongoose.Schema(
  {
    name:       { type: String, required: true },
    status:     { type: String, enum: ["healthy", "degraded", "unhealthy", "unknown"], default: "unknown" },
    latencyMs:  { type: Number, default: null },
    message:    { type: String, default: null },
  },
  { _id: false }
);

const HealthCheckRecordSchema = new mongoose.Schema(
  {
    checkId:  { type: String, required: true, unique: true, index: true },
    nodeId:   { type: String, required: true, index: true },
    region:   { type: String, default: "primary" },
    overallStatus: {
      type: String,
      enum: ["healthy", "degraded", "unhealthy", "unknown"],
      default: "unknown",
      index: true,
    },
    services: { type: [ServiceStatusSchema], default: [] },
    cpuPct:   { type: Number, default: null },
    memPct:   { type: Number, default: null },
    diskPct:  { type: Number, default: null },
    uptimeSec:{ type: Number, default: 0 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model("HealthCheckRecord", HealthCheckRecordSchema);
