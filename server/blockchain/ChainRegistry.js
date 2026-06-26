/**
 * ChainRegistry — multi-chain abstraction layer.
 *
 * Instantiates and caches one adapter per enabled chain.
 * All upper-layer services (NodeListener, DepositDetector, WithdrawalEngine)
 * interact with chains exclusively through this registry — never instantiating
 * adapters directly.
 *
 * Usage:
 *   const adapter = ChainRegistry.get("ethereum");  // → EVMAdapter | BTCAdapter
 *   const chains  = ChainRegistry.all();            // → adapter[]
 */

import { CHAINS, enabledChains } from "./config/chains.js";
import { EVMAdapter }             from "./adapters/EVMAdapter.js";
import { BTCAdapter }             from "./adapters/BTCAdapter.js";
import logger                     from "../config/logger.js";

function createAdapter(chain) {
  switch (chain.type) {
    case "evm":     return new EVMAdapter(chain);
    case "bitcoin":
    case "utxo":    return new BTCAdapter(chain);
    default:
      throw new Error(`[ChainRegistry] Unknown chain type: ${chain.type} for ${chain.id}`);
  }
}

class ChainRegistryClass {
  constructor() {
    this._adapters = new Map(); // chainId → adapter
    this._ready    = false;
  }

  /**
   * Initialize all enabled chains.
   * Logs a warning for each chain that fails the healthcheck
   * but does not throw — partial initialization is acceptable.
   */
  async init() {
    const chains = enabledChains();
    if (!chains.length) {
      logger.info("[ChainRegistry] No chains enabled (set CHAIN_<ID>_ENABLED=true to activate).");
      this._ready = true;
      return;
    }

    await Promise.all(
      chains.map(async (chain) => {
        try {
          const adapter = createAdapter(chain);
          const alive   = await adapter.ping();
          if (alive) {
            this._adapters.set(chain.id, adapter);
            logger.info({ chain: chain.id }, "[ChainRegistry] Chain connected.");
          } else {
            logger.warn({ chain: chain.id }, "[ChainRegistry] Chain RPC unreachable — skipping.");
          }
        } catch (err) {
          logger.error({ chain: chain.id, err: err.message }, "[ChainRegistry] Chain init failed.");
        }
      })
    );

    this._ready = true;
    logger.info(
      { connected: [...this._adapters.keys()] },
      "[ChainRegistry] Initialization complete."
    );
  }

  /** Returns the adapter for a chain ID, or undefined. */
  get(chainId) {
    return this._adapters.get(String(chainId).toLowerCase());
  }

  /** Returns all connected adapters as an array. */
  all() {
    return [...this._adapters.values()];
  }

  /** Returns all connected chain configs. */
  connectedChains() {
    return [...this._adapters.keys()].map((id) => CHAINS[id]).filter(Boolean);
  }

  /** True after init() completes (even if 0 chains connected). */
  get isReady() { return this._ready; }

  /** Healthcheck — pings all connected chains, returns per-chain results. */
  async health() {
    const results = {};
    await Promise.all(
      [...this._adapters.entries()].map(async ([id, adapter]) => {
        results[id] = { ok: await adapter.ping().catch(() => false) };
      })
    );
    return results;
  }
}

export const ChainRegistry = new ChainRegistryClass();
