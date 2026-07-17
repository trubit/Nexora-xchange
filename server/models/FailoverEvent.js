import mongoose from "mongoose";

/**
 * FailoverEvent — records every node / region failover action.
 * Status flow: triggered → in_progress → completed | failed | rolled_back
 */
const FailoverEventSchema = new mongoose.Schema(
  {
    eventId:      { type: String, required: true, unique: true, index: true },
    triggerType: {
      type: String,
      enum: ["manual", "health_check", "watchdog", "operator"],
      default: "health_check",
    },
    fromNode:   { type: String, required: true },
    toNode:     { type: String, required: true },
    region:     { type: String, default: "primary" },
    reason:     { type: String, required: true },
    status: {
      type: String,
      enum: ["triggered", "in_progress", "completed", "failed", "rolled_back"],
      default: "triggered",
      index: true,
    },
    duration:   { type: Number, default: null },    // ms
    initiatedBy:{ type: String, default: "system" },
    completedAt:{ type: Date, default: null },
    metadata:   { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model("FailoverEvent", FailoverEventSchema);
