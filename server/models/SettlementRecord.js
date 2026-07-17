import mongoose from "mongoose";

/**
 * SettlementRecord — cross-chain settlement lifecycle tracker.
 *
 * This is distinct from BlockchainTx (which is the raw chain-level event).
 * SettlementRecord is the business-layer view: it links the on-chain event
 * to the internal transaction and tracks all confirmation phases.
 *
 * Finality rules (no deletion, status only progresses forward):
 *   detected → confirming → finalized | failed | reorged
 */
const SettlementRecordSchema = new mongoose.Schema(
  {
    // ── Identity ───────────────────────────────────────────────────────────────
    settlementId: { type: String, required: true, unique: true, index: true },

    // ── Chain context ──────────────────────────────────────────────────────────
    chain:         { type: String, required: true, index: true },   // "ethereum" | "bsc" | "polygon" | "bitcoin"
    chainType:     { type: String, enum: ["evm", "bitcoin", "utxo"], required: true },
    txHash:        { type: String, required: true },
    blockNumber:   { type: Number, default: null },
    blockHash:     { type: String, default: "" },
    fromAddress:   { type: String, default: "" },
    toAddress:     { type: String, required: true },

    // ── Asset ──────────────────────────────────────────────────────────────────
    asset:          { type: String, required: true },
    amount:         { type: Number, required: true, min: 0 },
    networkFee:     { type: Number, default: 0 },
    contractAddress:{ type: String, default: "" },    // ERC-20 / BEP-20 token address

    // ── Direction ─────────────────────────────────────────────────────────────
    direction: { type: String, enum: ["deposit", "withdrawal"], required: true },

    // ── Confirmation tracking ─────────────────────────────────────────────────
    confirmations:          { type: Number, default: 0 },
    requiredConfirmations:  { type: Number, required: true },
    confirmedAt:            { type: Date, default: null },
    finalizedAt:            { type: Date, default: null },

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["detected", "confirming", "finalized", "failed", "reorged"],
      default: "detected",
      index: true,
    },

    // ── Internal linkage ──────────────────────────────────────────────────────
    userId:           { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    internalTxId:     { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },
    blockchainTxId:   { type: mongoose.Schema.Types.ObjectId, ref: "BlockchainTx", default: null },
    depositRecordId:  { type: mongoose.Schema.Types.ObjectId, ref: "BlockchainDeposit", default: null },

    // ── Risk and compliance flags ─────────────────────────────────────────────
    riskFlags:  { type: [String], default: [] },
    amlChecked: { type: Boolean, default: false },

    // ── Failure info ──────────────────────────────────────────────────────────
    failReason: { type: String, default: "" },
    reorgDepth: { type: Number, default: 0 },

    // ── Raw on-chain receipt ──────────────────────────────────────────────────
    rawReceipt: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

SettlementRecordSchema.index({ chain: 1, txHash: 1 }, { unique: true });
SettlementRecordSchema.index({ status: 1, direction: 1 });
SettlementRecordSchema.index({ userId: 1, createdAt: -1 });
SettlementRecordSchema.index({ chain: 1, blockNumber: 1 });

SettlementRecordSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => { ret.id = ret._id?.toString(); delete ret._id; },
});

export default mongoose.model("SettlementRecord", SettlementRecordSchema);
