import mongoose from "mongoose";

/**
 * AutoScalingEvent — records every scale-out or scale-in action.
 * direction: scale_out | scale_in
 * status: triggered → in_progress → completed | failed
 */
const AutoScalingEventSchema = new mongoose.Schema(
  {
    eventId:     { type: String, required: true, unique: true, index: true },
    direction:   { type: String, enum: ["scale_out", "scale_in"], required: true },
    service:     { type: String, required: true },
    fromReplicas:{ type: Number, required: true },
    toReplicas:  { type: Number, required: true },
    triggerMetric: { type: String, default: "cpu" },   // cpu, memory, rps
    triggerValue:{ type: Number, default: null },
    status: {
      type: String,
      enum: ["triggered", "in_progress", "completed", "failed"],
      default: "triggered",
      index: true,
    },
    duration:    { type: Number, default: null },       // ms
    completedAt: { type: Date, default: null },
    metadata:    { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model("AutoScalingEvent", AutoScalingEventSchema);
