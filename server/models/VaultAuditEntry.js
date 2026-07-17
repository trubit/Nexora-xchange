import mongoose from "mongoose";

/**
 * VaultAuditEntry — immutable custody vault audit trail.
 * Every vault action (create, lock, transfer initiation, approval, execution) is logged here.
 */
const VaultAuditEntrySchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      enum: [
        "VAULT_CREATED",
        "VAULT_LOCKED",
        "VAULT_UNLOCKED",
        "VAULT_SUSPENDED",
        "TX_INITIATED",
        "TX_APPROVED",
        "TX_REJECTED",
        "TX_EXECUTED",
        "TX_COMPLETED",
        "TX_FAILED",
        "TX_CANCELLED",
        "POLICY_CREATED",
        "POLICY_UPDATED",
        "BALANCE_UPDATED",
        "REBALANCE_TRIGGERED",
      ],
      required: true,
      index: true,
    },

    vaultId:   { type: String, default: null, index: true },
    txId:      { type: String, default: null },
    policyId:  { type: String, default: null },
    actorId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actor:     { type: String, default: "system" },

    description:    { type: String, required: true },
    previousStatus: { type: String, default: null },
    newStatus:      { type: String, default: null },
    metadata:       { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

VaultAuditEntrySchema.index({ eventType: 1, createdAt: -1 });
VaultAuditEntrySchema.index({ vaultId: 1, createdAt: -1 });

export default mongoose.model("VaultAuditEntry", VaultAuditEntrySchema);
