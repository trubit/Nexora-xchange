/**
 * Multi-chain configuration — every value sourced from env vars.
 * No defaults contain real wallet addresses or private keys.
 *
 * Required env vars per EVM chain (example for Ethereum):
 *   CHAIN_ETH_RPC_URL          https://mainnet.infura.io/v3/<key>
 *   CHAIN_ETH_WS_URL           wss://mainnet.infura.io/ws/v3/<key>  (optional)
 *   CHAIN_ETH_CHAIN_ID         1
 *   CHAIN_ETH_CONFIRMATIONS    12
 *   CHAIN_ETH_NATIVE_ASSET     ETH
 *   CHAIN_ETH_EXPLORER_URL     https://etherscan.io
 *   CHAIN_ETH_POLL_MS          15000
 *   CHAIN_ETH_HOT_WALLET       0x...   (exchange hot wallet address)
 *
 * For BTC:
 *   CHAIN_BTC_RPC_URL          http://user:pass@localhost:8332
 *   CHAIN_BTC_CONFIRMATIONS    3
 *   CHAIN_BTC_NATIVE_ASSET     BTC
 *   CHAIN_BTC_EXPLORER_URL     https://blockstream.info
 *   CHAIN_BTC_POLL_MS          60000
 *   CHAIN_BTC_HOT_WALLET       bc1q...
 *
 * BLOCKCHAIN_ENABLED=true   — master switch; set false to disable all listeners
 */

const int  = (key, fallback) => parseInt(process.env[key] ?? String(fallback), 10);
const str  = (key, fallback = "") => process.env[key] ?? fallback;
const bool = (key, fallback) => (process.env[key] ?? String(fallback)).toLowerCase() !== "false";

// ── Master switch ─────────────────────────────────────────────────────────────

export const BLOCKCHAIN_ENABLED = bool("BLOCKCHAIN_ENABLED", false);

// ── Chain definitions ─────────────────────────────────────────────────────────

/**
 * Each chain entry:
 * {
 *   id:            string   — canonical key used throughout the system
 *   type:          "evm" | "bitcoin" | "utxo"
 *   chainId:       number   — EVM chain ID (undefined for non-EVM)
 *   rpcUrl:        string   — JSON-RPC HTTP endpoint
 *   wsUrl:         string   — JSON-RPC WebSocket endpoint (optional)
 *   nativeAsset:   string   — symbol of the chain's native gas token
 *   hotWallet:     string   — exchange hot-wallet address (receives deposits)
 *   confirmations: number   — blocks needed before settlement
 *   pollMs:        number   — block poll interval in milliseconds
 *   explorerUrl:   string   — block explorer base URL
 *   enabled:       boolean  — per-chain enable flag
 *   tokens:        Record<symbol, {contractAddress, decimals}>  — ERC-20/BEP-20
 * }
 */

function parseTokens(prefix) {
  const tokens = {};
  // CHAIN_{PREFIX}_TOKEN_{SYMBOL}_ADDRESS and CHAIN_{PREFIX}_TOKEN_{SYMBOL}_DECIMALS
  const envKeys = Object.keys(process.env).filter((k) =>
    k.startsWith(`CHAIN_${prefix}_TOKEN_`) && k.endsWith("_ADDRESS")
  );
  for (const key of envKeys) {
    const sym      = key.slice(`CHAIN_${prefix}_TOKEN_`.length, -"_ADDRESS".length);
    const address  = process.env[key] ?? "";
    const decimals = int(`CHAIN_${prefix}_TOKEN_${sym}_DECIMALS`, 18);
    if (sym && address) tokens[sym] = { contractAddress: address, decimals };
  }
  return tokens;
}

function evmChain(id, prefix, fallbackChainId, fallbackLabel) {
  return {
    id,
    prefix,
    type:          "evm",
    label:         str(`CHAIN_${prefix}_LABEL`, fallbackLabel),
    chainId:       int(`CHAIN_${prefix}_CHAIN_ID`, fallbackChainId),
    rpcUrl:        str(`CHAIN_${prefix}_RPC_URL`),
    wsUrl:         str(`CHAIN_${prefix}_WS_URL`),
    nativeAsset:   str(`CHAIN_${prefix}_NATIVE_ASSET`, id.toUpperCase()),
    hotWallet:     str(`CHAIN_${prefix}_HOT_WALLET`),
    confirmations: int(`CHAIN_${prefix}_CONFIRMATIONS`, 12),
    pollMs:        int(`CHAIN_${prefix}_POLL_MS`, 15_000),
    explorerUrl:   str(`CHAIN_${prefix}_EXPLORER_URL`),
    enabled:       bool(`CHAIN_${prefix}_ENABLED`, false),
    tokens:        parseTokens(prefix),
  };
}

function bitcoinChain(id, prefix, fallbackLabel) {
  return {
    id,
    prefix,
    type:          "bitcoin",
    label:         str(`CHAIN_${prefix}_LABEL`, fallbackLabel),
    chainId:       null,
    rpcUrl:        str(`CHAIN_${prefix}_RPC_URL`),
    wsUrl:         "",
    nativeAsset:   str(`CHAIN_${prefix}_NATIVE_ASSET`, "BTC"),
    hotWallet:     str(`CHAIN_${prefix}_HOT_WALLET`),
    confirmations: int(`CHAIN_${prefix}_CONFIRMATIONS`, 3),
    pollMs:        int(`CHAIN_${prefix}_POLL_MS`, 60_000),
    explorerUrl:   str(`CHAIN_${prefix}_EXPLORER_URL`),
    enabled:       bool(`CHAIN_${prefix}_ENABLED`, false),
    tokens:        {},
  };
}

export const CHAINS = {
  ethereum: evmChain("ethereum", "ETH",  1,     "Ethereum Mainnet"),
  bsc:      evmChain("bsc",      "BSC",  56,    "BNB Chain"),
  polygon:  evmChain("polygon",  "MATIC",137,   "Polygon"),
  arbitrum: evmChain("arbitrum", "ARB",  42161, "Arbitrum One"),
  optimism: evmChain("optimism", "OP",   10,    "Optimism"),
  bitcoin:  bitcoinChain("bitcoin", "BTC",      "Bitcoin"),
};

// ── Asset → chain mapping ─────────────────────────────────────────────────────

/**
 * Maps an asset symbol + network name to a canonical chain entry.
 * Returns undefined if no matching chain is configured and enabled.
 */
export function resolveChain(asset, network) {
  const sym = String(asset || "").toUpperCase();
  const net = String(network || "").toLowerCase();

  for (const chain of Object.values(CHAINS)) {
    if (!chain.enabled) continue;
    // When a network is specified, only consider that exact chain.
    // Without this guard, ETH on Arbitrum/Optimism always resolved to Ethereum
    // because nativeAsset === "ETH" matched first regardless of requested network.
    if (net && chain.id !== net) continue;
    if (chain.nativeAsset === sym) return chain;
    if (chain.tokens[sym]) return chain;
  }
  return undefined;
}

/**
 * Returns all enabled chains.
 */
export function enabledChains() {
  return Object.values(CHAINS).filter((c) => c.enabled && c.rpcUrl);
}

/**
 * Returns the token config (contract + decimals) for an ERC-20/BEP-20 asset,
 * or null if the asset is the chain's native token.
 */
export function getTokenConfig(chain, asset) {
  const sym = String(asset || "").toUpperCase();
  if (chain.nativeAsset === sym) return null;
  return chain.tokens[sym] ?? null;
}
