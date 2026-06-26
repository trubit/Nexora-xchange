/**
 * SINGLE SOURCE OF TRUTH for all supported assets and auto-generated trading pairs.
 * Adding a coin here makes it available platform-wide: wallets, trading, matching engine,
 * deposits, withdrawals, market data, and all API/WebSocket services.
 */

export const ASSETS = {
  // ── Tier-1 — Market leaders ────────────────────────────────────────────────
  BTC:   { name: "Bitcoin",          network: "Bitcoin",              decimals: 8, price: 105000  },
  ETH:   { name: "Ethereum",         network: "Ethereum",             decimals: 8, price: 3800    },
  BNB:   { name: "BNB",              network: "BNB Chain",            decimals: 8, price: 720     },
  SOL:   { name: "Solana",           network: "Solana",               decimals: 8, price: 195     },
  XRP:   { name: "XRP",              network: "XRP Ledger",           decimals: 6, price: 2.45    },
  ADA:   { name: "Cardano",          network: "Cardano",              decimals: 6, price: 0.78    },
  DOGE:  { name: "Dogecoin",         network: "Dogecoin",             decimals: 8, price: 0.22    },
  TRX:   { name: "TRON",             network: "TRON",                 decimals: 6, price: 0.28    },
  LTC:   { name: "Litecoin",         network: "Litecoin",             decimals: 8, price: 105     },
  BCH:   { name: "Bitcoin Cash",     network: "Bitcoin Cash",         decimals: 8, price: 480     },
  XLM:   { name: "Stellar",          network: "Stellar",              decimals: 7, price: 0.38    },
  XMR:   { name: "Monero",           network: "Monero",               decimals: 12,price: 310     },
  ETC:   { name: "Ethereum Classic", network: "Ethereum Classic",     decimals: 8, price: 28      },
  VET:   { name: "VeChain",          network: "VeChain",              decimals: 8, price: 0.062   },
  ALGO:  { name: "Algorand",         network: "Algorand",             decimals: 6, price: 0.32    },

  // ── Layer 2 & Smart Contract Platforms ────────────────────────────────────
  MATIC: { name: "Polygon",          network: "Polygon",              decimals: 8, price: 0.62    },
  AVAX:  { name: "Avalanche",        network: "Avalanche C-Chain",    decimals: 8, price: 42      },
  DOT:   { name: "Polkadot",         network: "Polkadot",             decimals: 8, price: 9.2     },
  NEAR:  { name: "NEAR Protocol",    network: "NEAR",                 decimals: 8, price: 6.8     },
  ATOM:  { name: "Cosmos",           network: "Cosmos Hub",           decimals: 6, price: 8.5     },
  OP:    { name: "Optimism",         network: "Optimism",             decimals: 8, price: 2.4     },
  ARB:   { name: "Arbitrum",         network: "Arbitrum One",         decimals: 8, price: 1.15    },
  APT:   { name: "Aptos",            network: "Aptos",                decimals: 8, price: 12.5    },
  SUI:   { name: "Sui",              network: "Sui",                  decimals: 9, price: 3.8     },
  SEI:   { name: "Sei",              network: "Sei Network",          decimals: 6, price: 0.52    },
  TIA:   { name: "Celestia",         network: "Celestia",             decimals: 6, price: 6.2     },
  STX:   { name: "Stacks",           network: "Stacks",               decimals: 6, price: 2.1     },
  FTM:   { name: "Fantom",           network: "Fantom Opera",         decimals: 8, price: 1.05    },
  ONE:   { name: "Harmony",          network: "Harmony",              decimals: 8, price: 0.025   },
  EGLD:  { name: "MultiversX",       network: "MultiversX",           decimals: 8, price: 38      },
  FLOW:  { name: "Flow",             network: "Flow",                 decimals: 8, price: 0.75    },
  KAVA:  { name: "Kava",             network: "Kava",                 decimals: 6, price: 0.68    },
  ICP:   { name: "Internet Computer",network: "Internet Computer",    decimals: 8, price: 11.5    },
  FIL:   { name: "Filecoin",         network: "Filecoin",             decimals: 8, price: 5.8     },
  HBAR:  { name: "Hedera",           network: "Hedera",               decimals: 8, price: 0.115   },
  THETA: { name: "Theta Network",    network: "Theta",                decimals: 8, price: 1.85    },

  // ── DeFi ──────────────────────────────────────────────────────────────────
  LINK:  { name: "Chainlink",        network: "Ethereum",             decimals: 8, price: 18.5    },
  UNI:   { name: "Uniswap",          network: "Ethereum",             decimals: 8, price: 9.2     },
  AAVE:  { name: "Aave",             network: "Ethereum",             decimals: 8, price: 285     },
  MKR:   { name: "Maker",            network: "Ethereum",             decimals: 8, price: 1650    },
  CRV:   { name: "Curve DAO",        network: "Ethereum",             decimals: 8, price: 0.85    },
  LDO:   { name: "Lido DAO",         network: "Ethereum",             decimals: 8, price: 1.95    },
  SNX:   { name: "Synthetix",        network: "Ethereum",             decimals: 8, price: 2.8     },
  COMP:  { name: "Compound",         network: "Ethereum",             decimals: 8, price: 68      },
  GRT:   { name: "The Graph",        network: "Ethereum",             decimals: 8, price: 0.22    },
  DYDX:  { name: "dYdX",             network: "dYdX Chain",           decimals: 8, price: 1.35    },
  INJ:   { name: "Injective",        network: "Injective",            decimals: 8, price: 28      },
  JUP:   { name: "Jupiter",          network: "Solana",               decimals: 6, price: 0.92    },
  PENDLE:{ name: "Pendle",           network: "Ethereum",             decimals: 8, price: 5.6     },
  GMX:   { name: "GMX",              network: "Arbitrum One",         decimals: 8, price: 32      },

  // ── AI & Data ─────────────────────────────────────────────────────────────
  FET:   { name: "Fetch.ai",         network: "Ethereum",             decimals: 8, price: 1.65    },
  RNDR:  { name: "Render",           network: "Solana",               decimals: 8, price: 7.2     },
  WLD:   { name: "Worldcoin",        network: "Optimism",             decimals: 8, price: 2.8     },
  TAO:   { name: "Bittensor",        network: "Bittensor",            decimals: 9, price: 420     },
  OCEAN: { name: "Ocean Protocol",   network: "Ethereum",             decimals: 8, price: 0.78    },

  // ── Gaming & Metaverse ────────────────────────────────────────────────────
  AXS:   { name: "Axie Infinity",    network: "Ethereum",             decimals: 8, price: 7.5     },
  SAND:  { name: "The Sandbox",      network: "Ethereum",             decimals: 8, price: 0.52    },
  MANA:  { name: "Decentraland",     network: "Ethereum",             decimals: 8, price: 0.48    },
  GALA:  { name: "Gala",             network: "Ethereum",             decimals: 8, price: 0.038   },
  IMX:   { name: "Immutable",        network: "Immutable zkEVM",      decimals: 8, price: 1.45    },
  ENJ:   { name: "Enjin Coin",       network: "Ethereum",             decimals: 8, price: 0.28    },

  // ── Infrastructure & Oracles ──────────────────────────────────────────────
  QNT:   { name: "Quant",            network: "Ethereum",             decimals: 8, price: 115     },
  HNT:   { name: "Helium",           network: "Solana",               decimals: 8, price: 7.2     },
  ROSE:  { name: "Oasis Network",    network: "Oasis",                decimals: 9, price: 0.085   },
  CHZ:   { name: "Chiliz",           network: "Chiliz Chain",         decimals: 8, price: 0.095   },
  BAT:   { name: "Basic Attention",  network: "Ethereum",             decimals: 8, price: 0.22    },

  // ── Meme coins ────────────────────────────────────────────────────────────
  SHIB:  { name: "Shiba Inu",        network: "Ethereum",             decimals: 8, price: 0.0000175 },
  PEPE:  { name: "Pepe",             network: "Ethereum",             decimals: 8, price: 0.0000138 },
  FLOKI: { name: "FLOKI",            network: "BNB Chain",            decimals: 9, price: 0.000155  },
  BONK:  { name: "Bonk",             network: "Solana",               decimals: 5, price: 0.0000285 },
  WIF:   { name: "dogwifhat",        network: "Solana",               decimals: 6, price: 2.15    },

  // ── Stablecoins ──────────────────────────────────────────────────────────
  USDT:  { name: "Tether",           network: "Tron (TRC-20)",        decimals: 2, price: 1.0     },
  USDC:  { name: "USD Coin",         network: "Ethereum",             decimals: 2, price: 1.0     },

  // ── TrusonCoin ────────────────────────────────────────────────────────────
  TRUSON:{ name: "TrusonCoin",       network: "TrusonChain",          decimals: 6, price: 1.0     },
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
