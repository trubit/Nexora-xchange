import mongoose from "mongoose";

const CoinSchema = new mongoose.Schema(
  {
    symbol:      { type: String, required: true, unique: true, uppercase: true },
    name:        { type: String, required: true },
    description: { type: String, default: "" },
    network:     { type: String, default: "Ethereum" },
    decimals:    { type: Number, default: 8 },
    priceUsd:    { type: Number, default: 0 },
    change24h:   { type: Number, default: 0 },
    volume24h:   { type: Number, default: 0 },
    marketCap:   { type: Number, default: 0 },
    totalSupply: { type: Number, default: 0 },
    logoUrl:     { type: String, default: "" },
    website:     { type: String, default: "" },
    cgId:        { type: String, default: "" },   // CoinGecko coin ID for price syncs
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

CoinSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
  },
});

const Coin = mongoose.model("Coin", CoinSchema);

export default Coin;
