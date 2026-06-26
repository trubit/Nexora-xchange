import mongoose from "mongoose";

/**
 * Canonical record of every on-chain transaction the system observes.
 * Both deposits (incoming) and withdrawals (outgoing) are tracked here.
 * The internal ledger (Transaction model) remains the source of truth;
 * this model is the blockchain settlement audit trail.
 */
const BlockchainTxSchema = new mongoose.Schema(
  {
    // On-chain identity
    txHash:       { type: String, required: true },
    chain:        { type: String, required: true },   // "ethereum" | "bsc" | "bitcoin" …
    blockNumber:  { type: Number, default: null },
    blockHash:    { type: String, default: "" },
    fromAddress:  { type: String, default: "" },
    toAddress:    { type: String, required: true },

    // Asset
    asset:        { type: String, required: true },
    amount:       { type: Number, required: true },
    fee:          { type: Number, default: 0 },

    // Classification
    direction:    { type: String, enum: ["in", "out"], required: true },
    confirmations:{ type: Number, default: 0 },
    requiredConfirmations: { type: Number, default: 1 },

    // Lifecycle
    status: {
      type: String,
      enum: ["detected", "confirming", "confirmed", "failed", "reorged"],
      default: "detected",
    },
    settlementStatus: {
      type: String,
      enum: ["pending", "settled", "failed", "skipped"],
      default: "pending",
    },

    // Linkage to internal systems
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    internalTxId:  { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },
    depositAddressId: { type: mongoose.Schema.Types.ObjectId, ref: "BlockchainDeposit", default: null },

    // Raw receipt for audit
    rawData:      { type: mongoose.Schema.Types.Mixed, default: {} },
    settledAt:    { type: Date, default: null },
    failReason:   { type: String, default: "" },
  },
  { timestamps: true }
);

BlockchainTxSchema.index({ txHash: 1, chain: 1 }, { unique: true });
BlockchainTxSchema.index({ status: 1, settlementStatus: 1 });
BlockchainTxSchema.index({ userId: 1, createdAt: -1 });
BlockchainTxSchema.index({ toAddress: 1, chain: 1 });

BlockchainTxSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => { ret.id = ret._id?.toString(); delete ret._id; },
});

export default mongoose.model("BlockchainTx", BlockchainTxSchema);
