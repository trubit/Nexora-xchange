import mongoose from "mongoose";

/**
 * WhaleActivity — tracks large-value market participants.
 *
 * A "whale" is an address or entity whose single action moves the market.
 * Records both on-chain large transfers and exchange-level large orders.
 */
const WhaleActivitySchema = new mongoose.Schema(
  {
    source:     { type: String, enum: ["exchange", "blockchain"], required: true },
    pair:       { type: String, required: true, index: true },
    side:       { type: String, enum: ["buy", "sell", "transfer", "unknown"], default: "unknown" },
    amountUsd:  { type: Number, required: true },
    price:      { type: Number, default: null },
    address:    { type: String, default: null },  // on-chain address if source=blockchain
    exchange:   { type: String, default: null },  // exchange name if source=exchange
    txHash:     { type: String, default: null },
    impactPct:  { type: Number, default: null },  // estimated price impact %
    signalId:   { type: mongoose.Schema.Types.ObjectId, ref: "MarketSignal", default: null },
    metadata:   { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

WhaleActivitySchema.index({ pair: 1, createdAt: -1 });
WhaleActivitySchema.index({ amountUsd: -1 });

export default mongoose.model("WhaleActivity", WhaleActivitySchema);
