import mongoose from "mongoose";

/**
 * AggregatedBook — snapshot of the merged order book for a trading pair.
 *
 * Stored periodically so historical depth data is available for analytics.
 * Live lookups use the in-memory aggregator cache.
 */
const PriceLevelSchema = new mongoose.Schema(
  {
    price:     { type: Number, required: true },
    quantity:  { type: Number, required: true },
    providers: { type: [String], default: [] },
  },
  { _id: false }
);

const AggregatedBookSchema = new mongoose.Schema(
  {
    pair:          { type: String, required: true, index: true },
    timestamp:     { type: Date,   required: true, index: true },
    bids:          { type: [PriceLevelSchema], default: [] },
    asks:          { type: [PriceLevelSchema], default: [] },
    bestBid:       { type: Number, default: null },
    bestAsk:       { type: Number, default: null },
    spreadPct:     { type: Number, default: null },
    totalBidDepth: { type: Number, default: 0 },
    totalAskDepth: { type: Number, default: 0 },
    providerCount: { type: Number, default: 0 },
    slippage1pct:  { type: Number, default: null },   // estimated USD slippage for 1% of depth
  },
  { timestamps: true, versionKey: false }
);

AggregatedBookSchema.index({ pair: 1, timestamp: -1 });

export default mongoose.model("AggregatedBook", AggregatedBookSchema);
