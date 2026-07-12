import Coin from "../models/Coin.js";

const TRUSON_COIN = {
  symbol: "TRUSON",
  name: "TrusonCoin",
  description: "Internal reward and utility coin for Nexora.",
  decimals: 2,
  priceUsd: 0,
  change24h: 0,
  volume24h: 0,
  totalSupply: 0,
  isActive: true,
};

export const ensureTrusonCoin = async () => {
  await Coin.findOneAndUpdate(
    { symbol: TRUSON_COIN.symbol },
    { $setOnInsert: TRUSON_COIN },
    { upsert: true, new: true }
  );
};
