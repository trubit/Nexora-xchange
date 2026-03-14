 import mongoose from "mongoose";

const TradeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["spot", "futures"], required: true },
    side: { type: String, enum: ["buy", "sell"], required: true },
    symbol: { type: String, required: true },
    amount: { type: Number, required: true },
    price: { type: Number, required: true },
    fee: { type: Number, default: 0 },
    pnl: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["open", "closed", "cancelled"],
      default: "open",
    },
    executedAt: { type: Date },
  },
  { timestamps: true }
);

TradeSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
  },
});

const Trade = mongoose.model("Trade", TradeSchema);

export default Trade; 

