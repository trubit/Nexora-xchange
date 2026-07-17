/**
 * BlockchainIndexerService — on-chain transaction indexing engine.
 *
 * Responsibilities:
 *   - Indexes all observed on-chain transactions into SettlementRecord
 *   - Tracks chain tip (latest indexed block per chain)
 *   - Detects deposit transactions to known addresses
 *   - Feeds confirmation updates to MultiChainSettlementService
 *   - Provides transaction verification by hash
 *
 * Design principles:
 *   - Read-only from blockchain (never signs or broadcasts)
 *   - Idempotent indexing (safe to re-run on same blocks)
 *   - Fail-safe: one chain failure never stops others
 */

import { EventEmitter }   from "events";
import SettlementRecord   from "../models/SettlementRecord.js";
import BlockchainTx       from "../models/BlockchainTx.js";
import BlockchainDeposit  from "../models/BlockchainDeposit.js";
import { CHAINS, BLOCKCHAIN_ENABLED } from "../blockchain/config/chains.js";
import { multiChainSettlementService } from "./multiChainSettlementService.js";
import logger             from "../config/logger.js";
import { redisClients }   from "../config/redis.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const INDEX_STATE_KEY = (chainId) => `bidx:tip:${chainId}`;
const INDEX_STATE_TTL = 86400 * 30;   // 30 days
const BATCH_SIZE      = parseInt(process.env.INDEXER_BATCH_SIZE ?? "50", 10);
const POLL_MS         = parseInt(process.env.INDEXER_POLL_MS    ?? "15000", 10);

// ── Verification engine ───────────────────────────────────────────────────────

export class OnChainVerifier {
  /**
   * Verify a transaction exists and is confirmed on-chain.
   * Returns verification result (does not modify state).
   */
  static async verify(chain, txHash) {
    const chainCfg = CHAINS[chain];
    if (!chainCfg) return { verified: false, reason: "unknown_chain" };
    if (!chainCfg.enabled || !chainCfg.rpcUrl) {
      return { verified: false, reason: "chain_disabled" };
    }

    // Check our local index first
    const local = await BlockchainTx.findOne({ txHash, chain }).lean();
    if (!local) return { verified: false, reason: "not_indexed", txHash, chain };

    const fullyConfirmed = local.confirmations >= local.requiredConfirmations;
    return {
      verified:      fullyConfirmed,
      confirmations: local.confirmations,
      required:      local.requiredConfirmations,
      status:        local.status,
      blockNumber:   local.blockNumber,
      txHash,
      chain,
      asset:         local.asset,
      amount:        local.amount,
    };
  }

  /**
   * Verify a deposit was credited by checking both on-chain and internal records.
   */
  static async verifyDeposit(chain, txHash) {
    const [onChain, settlementRecord] = await Promise.all([
      OnChainVerifier.verify(chain, txHash),
      SettlementRecord.findOne({ chain, txHash, direction: "deposit" }).lean(),
    ]);

    return {
      onChain,
      settled:       !!settlementRecord,
      settlementId:  settlementRecord?.settlementId ?? null,
      status:        settlementRecord?.status ?? "not_found",
      finalizedAt:   settlementRecord?.finalizedAt ?? null,
    };
  }
}

// ── Deposit address watcher ───────────────────────────────────────────────────

class DepositAddressWatcher {
  constructor() {
    this._addresses = new Map();   // address.toLowerCase() → depositRecord
    this._loaded    = false;
  }

  async load() {
    const records = await BlockchainDeposit.find({ active: true }).lean();
    for (const r of records) {
      this._addresses.set(r.address.toLowerCase(), r);
    }
    this._loaded = true;
    logger.info({ count: records.length }, "[IndexerWatcher] Loaded deposit addresses.");
  }

  register(record) {
    this._addresses.set(record.address.toLowerCase(), record);
  }

  lookup(address) {
    return this._addresses.get((address || "").toLowerCase()) ?? null;
  }

  get size() { return this._addresses.size; }
}

// ── Chain tip tracker ─────────────────────────────────────────────────────────

class ChainTipTracker {
  constructor() { this._tips = new Map(); }

  async load(chainId) {
    const redis = redisClients.cache;
    if (redis) {
      try {
        const val = await redis.get(INDEX_STATE_KEY(chainId));
        if (val) { this._tips.set(chainId, parseInt(val, 10)); return; }
      } catch { /* skip */ }
    }
    // Fallback: query DB for highest indexed block
    const latest = await BlockchainTx.findOne({ chain: chainId })
      .sort({ blockNumber: -1 }).select("blockNumber").lean();
    this._tips.set(chainId, latest?.blockNumber ?? 0);
  }

  async set(chainId, blockNumber) {
    this._tips.set(chainId, blockNumber);
    const redis = redisClients.cache;
    if (redis) {
      try { await redis.setex(INDEX_STATE_KEY(chainId), INDEX_STATE_TTL, String(blockNumber)); } catch { /* skip */ }
    }
  }

  get(chainId) { return this._tips.get(chainId) ?? 0; }
}

// ── Main indexer service ──────────────────────────────────────────────────────

export class BlockchainIndexerService extends EventEmitter {
  constructor() {
    super();
    this._started   = false;
    this._timers    = new Map();
    this._watcher   = new DepositAddressWatcher();
    this._tipTracker = new ChainTipTracker();
    this._stats     = {
      txsIndexed:    0,
      depositsFound: 0,
      blocksScanned: 0,
      errors:        0,
    };
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────────

  async start() {
    if (this._started || !BLOCKCHAIN_ENABLED) return;
    this._started = true;

    await this._watcher.load();

    const enabledChains = Object.values(CHAINS).filter((c) => c.enabled && c.rpcUrl);

    for (const chain of enabledChains) {
      await this._tipTracker.load(chain.id);
      const timer = setInterval(
        () => this._indexChain(chain).catch((err) =>
          logger.error({ err: err.message, chain: chain.id }, "[Indexer] Chain poll error.")
        ),
        chain.pollMs || POLL_MS
      );
      this._timers.set(chain.id, timer);
      logger.info({ chain: chain.id, tip: this._tipTracker.get(chain.id) }, "[Indexer] Chain indexer started.");
    }

    if (!enabledChains.length) {
      logger.info("[Indexer] No enabled chains — indexer idle.");
    }
  }

  stop() {
    for (const timer of this._timers.values()) clearInterval(timer);
    this._timers.clear();
    this._started = false;
    logger.info("[Indexer] Blockchain indexer stopped.");
  }

  /** Register a new deposit address to watch without a reload. */
  registerAddress(record) {
    this._watcher.register(record);
  }

  /** Public verification proxy. */
  async verify(chain, txHash) {
    return OnChainVerifier.verify(chain, txHash);
  }

  async verifyDeposit(chain, txHash) {
    return OnChainVerifier.verifyDeposit(chain, txHash);
  }

  getStats() {
    return {
      ...this._stats,
      running:        this._started,
      watchedAddresses: this._watcher.size,
      chainTips: Object.fromEntries(
        Object.keys(CHAINS).map((id) => [id, this._tipTracker.get(id)])
      ),
    };
  }

  // ── Per-chain indexer ─────────────────────────────────────────────────────────

  async _indexChain(chain) {
    // In test/dev mode without a real RPC, we skip actual polling
    if (!chain.rpcUrl) return;

    // We delegate the actual block fetching to the existing ChainRegistry/Adapter.
    // Here we re-index any BlockchainTx records written by NodeListener that
    // haven't yet been promoted to SettlementRecord.
    const indexed = this._tipTracker.get(chain.id);

    const unindexed = await BlockchainTx.find({
      chain:   chain.id,
      blockNumber: { $gt: indexed },
    }).sort({ blockNumber: 1 }).limit(BATCH_SIZE).lean();

    if (!unindexed.length) return;

    let highBlock = indexed;

    for (const btx of unindexed) {
      try {
        await this._processTx(chain, btx);
        if ((btx.blockNumber ?? 0) > highBlock) highBlock = btx.blockNumber;
        this._stats.txsIndexed++;
      } catch (err) {
        logger.error({ err: err.message, txHash: btx.txHash, chain: chain.id }, "[Indexer] TX process error.");
        this._stats.errors++;
      }
    }

    this._stats.blocksScanned += unindexed.length;
    await this._tipTracker.set(chain.id, highBlock);
  }

  async _processTx(chain, btx) {
    const direction = btx.direction === "in" ? "deposit" : "withdrawal";

    // Check if this tx goes to a watched deposit address
    const depositRecord = direction === "deposit"
      ? this._watcher.lookup(btx.toAddress)
      : null;

    if (direction === "deposit" && depositRecord) {
      this._stats.depositsFound++;
    }

    const record = await multiChainSettlementService.recordDetected({
      chain:          chain.id,
      txHash:         btx.txHash,
      fromAddress:    btx.fromAddress,
      toAddress:      btx.toAddress,
      asset:          btx.asset,
      amount:         btx.amount,
      networkFee:     btx.fee ?? 0,
      direction,
      blockNumber:    btx.blockNumber,
      blockHash:      btx.blockHash,
      userId:         btx.userId ?? depositRecord?.user ?? null,
      depositRecordId:depositRecord?._id ?? null,
      rawReceipt:     btx.rawData ?? {},
    });

    // Update confirmation count if already has confirmations
    if (btx.confirmations > 0 && record) {
      await multiChainSettlementService.updateConfirmations(record.settlementId, btx.confirmations);
    }

    this.emit("indexed", { chain: chain.id, txHash: btx.txHash, direction });
  }
}

export const blockchainIndexerService = new BlockchainIndexerService();
