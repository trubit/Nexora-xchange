import mongoose from "mongoose";

/**
 * Pending on-chain withdrawal queue.
 * The internal ledger (Transaction model) locks funds immediately on request.
 * This model tracks the withdrawal's blockchain execution lifecycle.
 *
 * State machine:
 *   pending → broadcasting → submitted → confirming → completed
 *                                                   ↘ failed
 */
const WithdrawalQueueSchema = new mongoose.Schema(
  {
    // Linkage
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    internalTxId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", required: true },

    // What to send
    asset:       { type: String, required: true },
    chain:       { type: String, required: true },
    network:     { type: String, required: true },
    toAddress:   { type: String, required: true },
    amount:      { type: Number, required: true },      // net amount user receives
    fee:         { type: Number, default: 0 },          // network fee (deducted from reserves)
    grossAmount: { type: Number, required: true },      // amount + fee

    // Execution lifecycle
    status: {
      type: String,
      enum: ["pending", "broadcasting", "submitted", "confirming", "completed", "failed", "cancelled"],
      default: "pending",
    },
    priority:     { type: String, enum: ["low", "normal", "high"], default: "normal" },
    attempts:     { type: Number, default: 0 },
    maxAttempts:  { type: Number, default: 3 },
    nextRetryAt:  { type: Date, default: null },

    // On-chain data (populated after submission)
    txHash:       { type: String, default: "" },
    blockNumber:  { type: Number, default: null },
    confirmations:{ type: Number, default: 0 },
    gasUsed:      { type: Number, default: 0 },
    gasPriceGwei: { type: Number, default: 0 },

    // Audit
    broadcastedAt:{ type: Date, default: null },
    submittedAt:  { type: Date, default: null },
    completedAt:  { type: Date, default: null },
    failReason:   { type: String, default: "" },
    rawReceipt:   { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

WithdrawalQueueSchema.index({ status: 1, nextRetryAt: 1 });
WithdrawalQueueSchema.index({ userId: 1, createdAt: -1 });
WithdrawalQueueSchema.index({ internalTxId: 1 }, { unique: true });
WithdrawalQueueSchema.index({ txHash: 1, chain: 1 });

WithdrawalQueueSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => { ret.id = ret._id?.toString(); delete ret._id; },
});

export default mongoose.model("WithdrawalQueue", WithdrawalQueueSchema);
