import mongoose from "mongoose";

/**
 * DeploymentRecord — tracks software deployments and rollbacks.
 * type: rolling | blue_green | canary | rollback
 * status: pending → running → completed | failed | rolled_back
 */
const DeploymentRecordSchema = new mongoose.Schema(
  {
    deploymentId:{ type: String, required: true, unique: true, index: true },
    service:     { type: String, required: true },
    version:     { type: String, required: true },
    previousVersion:{ type: String, default: null },
    type: {
      type: String,
      enum: ["rolling", "blue_green", "canary", "rollback"],
      default: "rolling",
    },
    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed", "rolled_back"],
      default: "pending",
      index: true,
    },
    initiatedBy: { type: String, default: "ci/cd" },
    completedAt: { type: Date, default: null },
    duration:    { type: Number, default: null },  // ms
    notes:       { type: String, default: null },
    metadata:    { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model("DeploymentRecord", DeploymentRecordSchema);
