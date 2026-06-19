import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema(
  {
    user:          { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    symbol:        { type: String, required: true, uppercase: true, trim: true },
    baseAsset:     { type: String, required: true, uppercase: true, trim: true },
    quoteAsset:    { type: String, required: true, uppercase: true, trim: true },
    side:          { type: String, enum: ["buy", "sell"], required: true },

    orderType: {
      type: String,
      enum: ["market", "limit", "stop_limit", "stop_market", "trailing_stop", "oco"],
      required: true,
    },

    // Execution price (limit / stop_limit)
    price:         { type: Number, min: 0 },

    // Conditional order fields
    stopPrice:     { type: Number, min: 0 },     // price that fires the trigger
    trailPercent:  { type: Number, min: 0.01 },  // trailing stop callback %
    peakPrice:     { type: Number },             // best price seen since placement
    triggerCondition: { type: String, enum: ["gte", "lte"] }, // price >= or <= stopPrice

    // OCO — points to the partner order; partner has no locked funds
    linkedOrderId:    { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    linkedFundsHeld:  { type: Boolean, default: true }, // false for OCO secondary leg

    // Fill tracking
    amount:          { type: Number, required: true, min: 0.00000001 },
    remainingAmount: { type: Number, required: true, min: 0 },
    filledAmount:    { type: Number, default: 0, min: 0 },
    averagePrice:    { type: Number, default: 0, min: 0 },

    status: {
      type: String,
      enum: ["pending_trigger", "open", "partially_filled", "filled", "cancelled"],
      default: "open",
    },

    triggeredAt: { type: Date },
  },
  { timestamps: true },
);

OrderSchema.index({ symbol: 1, side: 1, status: 1, price: 1, createdAt: 1 });
OrderSchema.index({ user: 1, status: 1, createdAt: -1 });
OrderSchema.index({ status: 1, orderType: 1 }); // for conditional processor scan

OrderSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
  },
});

export default mongoose.model("Order", OrderSchema);
