/**
 * NodeListener — per-chain block polling service.
 *
 * Polls each connected chain for new blocks at the configured interval
 * (CHAIN_{PREFIX}_POLL_MS). For each new block range, emits "block_range"
 * events that DepositDetector subscribes to.
 *
 * Design:
 *   - One interval timer per chain (no shared state between chains)
 *   - Idempotent: tracks lastProcessedBlock per chain in-memory + persisted in DB
 *   - Does not crash the server if a chain's RPC is temporarily unreachable
 *   - Back-fills missed blocks on restart (capped at BLOCKCHAIN_CATCHUP_BLOCKS)
 */

import { EventEmitter } from "events";
import BlockchainTx     from "../models/BlockchainTx.js";
import { ChainRegistry } from "./ChainRegistry.js";
import logger            from "../config/logger.js";

const CATCHUP_LIMIT = parseInt(process.env.BLOCKCHAIN_CATCHUP_BLOCKS ?? "100", 10);

class NodeListenerClass extends EventEmitter {
  constructor() {
    super();
    this._timers       = new Map(); // chainId → intervalId
    this._lastBlock    = new Map(); // chainId → number
    this._running      = false;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  async start() {
    if (this._running) return;
    this._running = true;

    const chains = ChainRegistry.all();
    if (!chains.length) {
      logger.info("[NodeListener] No connected chains — listener idle.");
      return;
    }

    // Load last-processed block per chain from a recent confirmed tx
    await this._loadCheckpoints();

    for (const adapter of chains) {
      const chain = adapter._chain;
      this._startChainTimer(chain, adapter);
    }

    logger.info(
      { chains: chains.map((a) => a._chain.id) },
      "[NodeListener] Started."
    );
  }

  async stop() {
    this._running = false;
    for (const [chainId, timer] of this._timers) {
      clearInterval(timer);
      logger.info({ chain: chainId }, "[NodeListener] Stopped timer.");
    }
    this._timers.clear();
  }

  // ── Per-chain timer ───────────────────────────────────────────────────────────

  _startChainTimer(chain, adapter) {
    const tick = () => this._poll(chain, adapter).catch((err) =>
      logger.error({ chain: chain.id, err: err.message }, "[NodeListener] Poll error.")
    );

    // First tick immediately, then on interval
    tick();
    const timer = setInterval(tick, chain.pollMs);
    timer.unref?.(); // don't prevent process exit
    this._timers.set(chain.id, timer);
  }

  // ── Block polling ─────────────────────────────────────────────────────────────

  async _poll(chain, adapter) {
    if (!this._running) return;

    let latest;
    try {
      latest = await adapter.getLatestBlock();
    } catch (err) {
      logger.warn({ chain: chain.id, err: err.message }, "[NodeListener] getLatestBlock failed.");
      return;
    }

    // Subtract required confirmations so we only process fully-confirmed blocks
    const safeBlock = latest - chain.confirmations;
    if (safeBlock < 0) return;

    const last = this._lastBlock.get(chain.id) ?? safeBlock;

    if (safeBlock <= last) return; // nothing new

    // Cap catch-up to avoid scanning thousands of blocks on restart
    const from = Math.max(last + 1, safeBlock - CATCHUP_LIMIT);
    const to   = safeBlock;

    logger.debug(
      { chain: chain.id, from, to },
      "[NodeListener] New block range."
    );

    this.emit("block_range", { chain, adapter, fromBlock: from, toBlock: to });

    this._lastBlock.set(chain.id, to);
  }

  // ── Checkpoint persistence ────────────────────────────────────────────────────

  async _loadCheckpoints() {
    // Find the latest confirmed BlockchainTx per chain to resume from
    for (const adapter of ChainRegistry.all()) {
      const chainId = adapter._chain.id;
      try {
        const latest = await BlockchainTx.findOne(
          { chain: chainId, status: "confirmed" },
          { blockNumber: 1 },
          { sort: { blockNumber: -1 } }
        ).lean();

        if (latest?.blockNumber) {
          this._lastBlock.set(chainId, latest.blockNumber);
          logger.info(
            { chain: chainId, resumeFrom: latest.blockNumber },
            "[NodeListener] Resumed from checkpoint."
          );
        }
      } catch (err) {
        logger.warn({ chain: chainId, err: err.message }, "[NodeListener] Checkpoint load failed.");
      }
    }
  }

  get isRunning() { return this._running; }
}

export const NodeListener = new NodeListenerClass();
