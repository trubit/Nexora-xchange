import mongoose from "mongoose";

/**
 * OperationsIncident — tracks infrastructure/operational incidents.
 * severity: critical | high | medium | low
 * status: open → investigating → mitigating → resolved | closed
 */
const TimelineEntrySchema = new mongoose.Schema(
  {
    ts:      { type: Date, required: true },
    message: { type: String, required: true },
    actor:   { type: String, default: "system" },
  },
  { _id: false }
);

const OperationsIncidentSchema = new mongoose.Schema(
  {
    incidentId:  { type: String, required: true, unique: true, index: true },
    title:       { type: String, required: true },
    description: { type: String, default: "" },
    severity: {
      type: String,
      enum: ["critical", "high", "medium", "low"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["open", "investigating", "mitigating", "resolved", "closed"],
      default: "open",
      index: true,
    },
    service:     { type: String, required: true },
    affectedNodes:{ type: [String], default: [] },
    timeline:    { type: [TimelineEntrySchema], default: [] },
    resolvedAt:  { type: Date, default: null },
    closedAt:    { type: Date, default: null },
    assignedTo:  { type: String, default: null },
    metadata:    { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model("OperationsIncident", OperationsIncidentSchema);
