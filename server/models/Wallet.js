 import mongoose from "mongoose";

const WalletSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    asset: { type: String, required: true },
    balance: { type: Number, default: 0 },
    available: { type: Number, default: 0 },
    locked: { type: Number, default: 0 },
    address: { type: String, default: "" },
    network: { type: String, default: "" },
  },
  { timestamps: true }
);

WalletSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
  },
});

const Wallet = mongoose.model("Wallet", WalletSchema);

export default Wallet; 

