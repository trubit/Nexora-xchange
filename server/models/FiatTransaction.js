import mongoose from "mongoose";

// Immutable fiat ledger — every balance mutation has a corresponding row here.
// This is the audit trail; records are never deleted, only status-updated.
const FiatTransactionSchema = new mongoose.Schema(
  {
    // Human-readable unique ID, e.g. "FT-1718910000000-A3F2"
    txId: { type: String, required: true, unique: true, index: true },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["deposit", "withdrawal", "fee", "adjustment", "reversal"],
      required: true,
    },

    // credit = money in; debit = money out
    direction: { type: String, enum: ["credit", "debit"], required: true },

    currency: { type: String, enum: ["USD", "EUR", "NGN"], required: true },

    // Gross amount (before fee)
    amount: { type: Number, required: true, min: 0 },
    // Platform fee deducted from amount
    fee: { type: Number, default: 0, min: 0 },
    // amount - fee (what the user actually receives / loses)
    netAmount: { type: Number, required: true },

    // Wallet snapshot at time of transaction — mandatory for audit
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },

    status: {
      type: String,
      enum: [
        "pending",    // initiated, not yet confirmed
        "processing", // gateway processing
        "completed",  // funds settled
        "failed",     // gateway/bank rejected
        "cancelled",  // user/admin cancelled before processing
        "reversed",   // completed then reversed
      ],
      default: "pending",
    },

    // Set for withdrawals: which bank account was debited to
    bankAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BankAccount",
      default: null,
    },

    // Internal idempotency key / external gateway reference
    reference: { type: String, default: "", index: true },
    // Reference returned by external payment gateway
    gatewayRef: { type: String, default: "" },
    // If this tx reverses another tx
    reversalOfTxId: { type: String, default: "" },

    description: { type: String, default: "", maxlength: 300 },

    // Arbitrary gateway/webhook payload stored for reconciliation
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Lifecycle timestamps
    completedAt: { type: Date, default: null },
    failedAt:    { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    reversedAt:  { type: Date, default: null },
    failedReason: { type: String, default: "" },
  },
  { timestamps: true },
);

FiatTransactionSchema.index({ user: 1, createdAt: -1 });
FiatTransactionSchema.index({ user: 1, type: 1, createdAt: -1 });
FiatTransactionSchema.index({ user: 1, currency: 1, createdAt: -1 });
FiatTransactionSchema.index({ user: 1, status: 1 });

FiatTransactionSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
  },
});

const FiatTransaction = mongoose.model("FiatTransaction", FiatTransactionSchema);
export default FiatTransaction;
