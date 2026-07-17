import mongoose from "mongoose";

/**
 * ClearingRecord — one trade clearing entry.
 * Created when a trade is executed; updated as it moves through
 * Pending → Validating → Cleared → Settled → Failed → Reversed.
 */
const ClearingRecordSchema = new mongoose.Schema(
  {
    clearingId:    { type: String, required: true, unique: true, index: true },
    tradeId:       { type: String, required: true, index: true },
    batchId:       { type: String, default: null, index: true },

    buyerUserId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sellerUserId:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    symbol:        { type: String, required: true },
    baseAsset:     { type: String, required: true },
    quoteAsset:    { type: String, required: true },
    quantity:      { type: Number, required: true },
    price:         { type: Number, required: true },
    totalValue:    { type: Number, required: true },

    buyerFee:      { type: Number, default: 0 },
    sellerFee:     { type: Number, default: 0 },
    feeAsset:      { type: String, default: "USDT" },

    status: {
      type: String,
      enum: ["pending", "validating", "cleared", "settled", "failed", "reversed"],
      default: "pending",
      index: true,
    },

    validatedAt:   { type: Date, default: null },
    clearedAt:     { type: Date, default: null },
    settledAt:     { type: Date, default: null },
    failedAt:      { type: Date, default: null },

    failureReason: { type: String, default: null },
    retryCount:    { type: Number, default: 0 },

    ledgerDebit:   { type: Boolean, default: false },
    ledgerCredit:  { type: Boolean, default: false },

    metadata:      { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

ClearingRecordSchema.index({ status: 1, createdAt: -1 });
ClearingRecordSchema.index({ buyerUserId: 1, createdAt: -1 });
ClearingRecordSchema.index({ sellerUserId: 1, createdAt: -1 });

export default mongoose.model("ClearingRecord", ClearingRecordSchema);
