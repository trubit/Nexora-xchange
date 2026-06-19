import mongoose from "mongoose";

// User-linked bank account for fiat withdrawal destinations.
const BankAccountSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    accountName: { type: String, required: true, trim: true, maxlength: 120 },
    accountNumber: { type: String, required: true, trim: true, maxlength: 40 },
    bankName: { type: String, required: true, trim: true, maxlength: 120 },
    // SWIFT / sort code / routing number — optional, varies by country
    bankCode: { type: String, trim: true, maxlength: 30, default: "" },
    // IBAN for EUR, routing number for USD, etc.
    routingReference: { type: String, trim: true, maxlength: 60, default: "" },
    currency: { type: String, enum: ["USD", "EUR", "NGN"], required: true },
    country: { type: String, trim: true, maxlength: 3, default: "NG" },
    isPrimary: { type: Boolean, default: false },
    // pending = awaiting micro-deposit verify; verified = cleared; rejected = failed check
    status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
    verifiedAt: { type: Date, default: null },
    // Used for payment gateway linkage (e.g. Paystack recipient code)
    gatewayRecipientCode: { type: String, default: "" },
  },
  { timestamps: true },
);

BankAccountSchema.index({ user: 1, status: 1 });

BankAccountSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    // Mask account number for security (show last 4 only)
    if (ret.accountNumber && ret.accountNumber.length > 4) {
      ret.accountNumberMasked =
        "*".repeat(ret.accountNumber.length - 4) + ret.accountNumber.slice(-4);
    } else {
      ret.accountNumberMasked = ret.accountNumber;
    }
  },
});

const BankAccount = mongoose.model("BankAccount", BankAccountSchema);
export default BankAccount;
