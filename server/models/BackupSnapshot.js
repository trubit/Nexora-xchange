import mongoose from "mongoose";

/**
 * BackupSnapshot — records scheduled and manual data backups.
 * Type: full | incremental | differential
 * Status: pending → running → completed | failed | expired
 */
const BackupSnapshotSchema = new mongoose.Schema(
  {
    snapshotId:  { type: String, required: true, unique: true, index: true },
    type: {
      type: String,
      enum: ["full", "incremental", "differential"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed", "expired"],
      default: "pending",
      index: true,
    },
    region:      { type: String, default: "primary" },
    sizeBytes:   { type: Number, default: 0 },
    collections: { type: [String], default: [] },
    checksum:    { type: String, default: null },
    retentionDays:{ type: Number, default: 30 },
    expiresAt:   { type: Date, default: null },
    completedAt: { type: Date, default: null },
    restoredAt:  { type: Date, default: null },
    metadata:    { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model("BackupSnapshot", BackupSnapshotSchema);
