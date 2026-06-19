import mongoose from "mongoose";

// One wallet per user — holds multi-currency fiat balances.
const FiatWalletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    balances: {
      USD: { type: Number, default: 0, min: 0 },
      EUR: { type: Number, default: 0, min: 0 },
      NGN: { type: Number, default: 0, min: 0 },
    },
    // frozen = no new txns; suspended = admin action; active = normal
    status: {
      type: String,
      enum: ["active", "frozen", "suspended"],
      default: "active",
    },
  },
  { timestamps: true },
);

FiatWalletSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
  },
});

const FiatWallet = mongoose.model("FiatWallet", FiatWalletSchema);
export default FiatWallet;
