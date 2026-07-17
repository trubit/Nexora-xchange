import mongoose from "mongoose";

/**
 * VaultTransaction — a custody vault transfer or deposit event.
 * Requires approvals based on vault policy before execution.
 */
const ApprovalSchema = new mongoose.Schema(
  {
    approverUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    action:         { type: String, enum: ["approved", "rejected"] },
    comment:        { type: String, default: null },
    timestamp:      { type: Date, default: Date.now },
  },
  { _id: false }
);

const VaultTransactionSchema = new mongoose.Schema(
  {
    txId:         { type: String, required: true, unique: true, index: true },
    fromVaultId:  { type: String, required: true, index: true },
    toVaultId:    { type: String, default: null },
    toAddress:    { type: String, default: null },

    asset:        { type: String, required: true },
    amount:       { type: Number, required: true },

    type: {
      type: String,
      enum: ["internal_transfer", "withdrawal", "deposit", "rebalance"],
      required: true,
    },

    status: {
      type: String,
      enum: ["pending_approval", "approved", "rejected", "executing", "completed", "failed", "cancelled"],
      default: "pending_approval",
      index: true,
    },

    requiredApprovals: { type: Number, default: 1 },
    approvals:         { type: [ApprovalSchema], default: [] },
    rejections:        { type: Number, default: 0 },

    initiatedBy:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    executedAt:   { type: Date, default: null },
    completedAt:  { type: Date, default: null },
    failedAt:     { type: Date, default: null },
    failureReason:{ type: String, default: null },

    timeLockUntil:{ type: Date, default: null },
    description:  { type: String, default: "" },
    metadata:     { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

VaultTransactionSchema.index({ status: 1, createdAt: -1 });
VaultTransactionSchema.index({ fromVaultId: 1, createdAt: -1 });

export default mongoose.model("VaultTransaction", VaultTransactionSchema);
