import mongoose from "mongoose";

/**
 * VaultAccount — represents a digital asset custody vault.
 * Storage tiers: cold (offline), warm (semi-offline), hot (online).
 * Each vault tracks balances per asset with policy-enforced limits.
 */
const BalanceSchema = new mongoose.Schema(
  {
    asset:     { type: String, required: true },
    balance:   { type: Number, default: 0 },
    reserved:  { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const VaultAccountSchema = new mongoose.Schema(
  {
    vaultId:     { type: String, required: true, unique: true, index: true },
    name:        { type: String, required: true },
    tier: {
      type: String,
      enum: ["cold", "warm", "hot"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "locked", "suspended", "archived"],
      default: "active",
      index: true,
    },
    custodian:        { type: String, default: "internal" },
    description:      { type: String, default: "" },
    balances:         { type: [BalanceSchema], default: [] },
    policyId:         { type: String, default: null },
    requiredApprovals:{ type: Number, default: 1 },
    totalWithdrawn:   { type: Number, default: 0 },
    totalDeposited:   { type: Number, default: 0 },
    lastActivityAt:   { type: Date, default: null },
    metadata:         { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model("VaultAccount", VaultAccountSchema);
