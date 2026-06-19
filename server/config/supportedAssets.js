/**
 * SINGLE SOURCE OF TRUTH for all supported assets and auto-generated trading pairs.
 * Adding a coin here makes it available platform-wide: wallets, trading, matching engine,
 * deposits, withdrawals, market data, and all API/WebSocket services.
 */

export const ASSETS = {
  // ── Major cryptocurrencies ──────────────────────────────────────────────────
  BTC:   { name: "Bitcoin",     network: "Bitcoin",        decimals: 8, price: 80350 },
  ETH:   { name: "Ethereum",    network: "Ethereum",       decimals: 8, price: 2315  },
  BNB:   { name: "BNB",         network: "BNB Chain",      decimals: 8, price: 645   },
  SOL:   { name: "Solana",      network: "Solana",         decimals: 8, price: 173.2 },
  XRP:   { name: "XRP",         network: "XRP Ledger",     decimals: 6, price: 0.61  },
  ADA:   { name: "Cardano",     network: "Cardano",        decimals: 6, price: 0.47  },
  DOGE:  { name: "Dogecoin",    network: "Dogecoin",       decimals: 8, price: 0.17  },
  LINK:  { name: "Chainlink",   network: "Ethereum",       decimals: 8, price: 10.2  },
  DOT:   { name: "Polkadot",    network: "Polkadot",       decimals: 8, price: 6.5   },
  AVAX:  { name: "Avalanche",   network: "Avalanche C-Chain", decimals: 8, price: 26.5 },
  MATIC: { name: "Polygon",     network: "Polygon",        decimals: 8, price: 0.45  },
  TRX:   { name: "TRON",        network: "TRON",           decimals: 6, price: 0.12  },
  LTC:   { name: "Litecoin",    network: "Litecoin",       decimals: 8, price: 75    },
  UNI:   { name: "Uniswap",     network: "Ethereum",       decimals: 8, price: 6.8   },
  ATOM:  { name: "Cosmos",      network: "Cosmos Hub",     decimals: 6, price: 6.2   },
  NEAR:  { name: "NEAR Protocol", network: "NEAR",         decimals: 8, price: 4.5   },
  OP:    { name: "Optimism",    network: "Optimism",       decimals: 8, price: 1.8   },
  ARB:   { name: "Arbitrum",    network: "Arbitrum One",   decimals: 8, price: 0.85  },
  // ── Stablecoins ─────────────────────────────────────────────────────────────
  USDT:  { name: "Tether",      network: "Tron (TRC-20)",  decimals: 2, price: 1.0   },
  USDC:  { name: "USD Coin",    network: "Ethereum",       decimals: 2, price: 1.0   },
  // ── TrusonCoin ─────────────────────────────────────────────────────────────
  TRUSON:{ name: "TrusonCoin",  network: "TrusonChain",    decimals: 6, price: 1.0   },
};

/** Assets that can be on the RIGHT side of a trading pair (quote assets). */
export const QUOTE_ASSETS = ["USDT", "BTC", "ETH"];

/**
 * Pure stablecoins that can only appear on the right side of a pair.
 * BTC and ETH are also quote assets but CAN be base assets (BTCUSDT, ETHUSDT, ETHBTC).
 */
const BASE_ASSET_EXCLUSIONS = new Set(["USDT", "USDC"]);

/**
 * Auto-generated trading pairs.
 * All assets except pure stablecoins can be on the left side.
 * All QUOTE_ASSETS (USDT, BTC, ETH) can be on the right side.
 * Self-pairings (BTC/BTC) are skipped automatically.
 */
export const PAIRS = (() => {
  const pairs = [];
  for (const [sym, meta] of Object.entries(ASSETS)) {
    if (BASE_ASSET_EXCLUSIONS.has(sym)) continue; // stablecoins never on the left
    for (const quote of QUOTE_ASSETS) {
      if (sym === quote) continue; // no self-pairing
      const quotePrice =
        quote === "USDT" ? meta.price :
        quote === "BTC"  ? (meta.price / ASSETS.BTC.price) :
        quote === "ETH"  ? (meta.price / ASSETS.ETH.price) :
        meta.price;
      pairs.push({
        symbol:     `${sym}${quote}`,
        baseAsset:  sym,
        quoteAsset: quote,
        price:      quotePrice,
      });
    }
  }
  return pairs;
})();

/** Set of all valid asset symbols for O(1) lookup. */
export const ASSET_SET = new Set(Object.keys(ASSETS));

/** Check if a symbol is a supported asset. */
export const isSupported = (symbol) => ASSET_SET.has(String(symbol || "").toUpperCase());

/** Get metadata for an asset, or null if not found. */
export const getMeta = (symbol) => ASSETS[String(symbol || "").toUpperCase()] ?? null;

/** TrusonCoin seed — ensures it exists in the Coin collection on startup. */
export const TRUSON_COIN_SEED = {
  symbol:      "TRUSON",
  name:        "TrusonCoin",
  description: "The native token of the TrusonXchanger platform.",
  decimals:    6,
  priceUsd:    1.0,
  change24h:   0,
  volume24h:   0,
  totalSupply: 100_000_000,
  isActive:    true,
};
