/**
 * Settlement Controller — REST handlers for the multi-chain settlement layer.
 */

import { multiChainSettlementService }   from "../services/multiChainSettlementService.js";
import { blockchainIndexerService, OnChainVerifier } from "../services/blockchainIndexerService.js";
import { CHAINS } from "../blockchain/config/chains.js";
import logger     from "../config/logger.js";

// ── User-facing ───────────────────────────────────────────────────────────────

export const getMySettlements = async (req, res) => {
  try {
    const { direction, status } = req.query;
    const limit = Math.min(parseInt(req.query.limit ?? "50", 10), 200);
    const skip  = parseInt(req.query.skip ?? "0", 10);
    const records = await multiChainSettlementService.getUserSettlements(
      req.user._id, { direction, status, limit, skip }
    );
    res.json({ settlements: records, count: records.length });
  } catch (err) {
    logger.error({ err: err.message }, "[SettlementCtrl] getMySettlements error");
    res.status(500).json({ message: "Failed to fetch settlements." });
  }
};

export const getSettlementByTxHash = async (req, res) => {
  try {
    const { chain, txHash } = req.params;
    if (!chain || !txHash) return res.status(400).json({ message: "chain and txHash required." });
    const record = await multiChainSettlementService.getByTxHash(chain, txHash);
    if (!record) return res.status(404).json({ message: "Settlement not found." });
    // Users can only view their own settlements
    if (!req.user.role === "admin" && String(record.userId) !== String(req.user._id)) {
      return res.status(403).json({ message: "Forbidden." });
    }
    res.json({ settlement: record });
  } catch (err) {
    logger.error({ err: err.message }, "[SettlementCtrl] getSettlementByTxHash error");
    res.status(500).json({ message: "Failed to fetch settlement." });
  }
};

// ── Verification ──────────────────────────────────────────────────────────────

export const verifyTransaction = async (req, res) => {
  try {
    const { chain, txHash } = req.params;
    if (!chain || !txHash) return res.status(400).json({ message: "chain and txHash required." });
    const result = await OnChainVerifier.verify(chain, txHash);
    res.json({ verification: result });
  } catch (err) {
    logger.error({ err: err.message }, "[SettlementCtrl] verifyTransaction error");
    res.status(500).json({ message: "Verification failed." });
  }
};

export const verifyDeposit = async (req, res) => {
  try {
    const { chain, txHash } = req.params;
    if (!chain || !txHash) return res.status(400).json({ message: "chain and txHash required." });
    const result = await OnChainVerifier.verifyDeposit(chain, txHash);
    res.json({ verification: result });
  } catch (err) {
    logger.error({ err: err.message }, "[SettlementCtrl] verifyDeposit error");
    res.status(500).json({ message: "Deposit verification failed." });
  }
};

// ── Admin-only ────────────────────────────────────────────────────────────────

export const getSettlementStats = async (req, res) => {
  try {
    const stats = await multiChainSettlementService.getStats();
    res.json({ stats });
  } catch (err) {
    logger.error({ err: err.message }, "[SettlementCtrl] getSettlementStats error");
    res.status(500).json({ message: "Failed to fetch stats." });
  }
};

export const getPendingSettlements = async (req, res) => {
  try {
    const { chain } = req.query;
    const records = await multiChainSettlementService.getPendingSettlements(chain ?? null);
    res.json({ settlements: records, count: records.length });
  } catch (err) {
    logger.error({ err: err.message }, "[SettlementCtrl] getPendingSettlements error");
    res.status(500).json({ message: "Failed to fetch pending settlements." });
  }
};

export const getIndexerStatus = async (req, res) => {
  try {
    const stats = blockchainIndexerService.getStats();
    const chains = Object.values(CHAINS).map((c) => ({
      id:      c.id,
      type:    c.type,
      enabled: c.enabled,
      tip:     stats.chainTips[c.id] ?? 0,
    }));
    res.json({ indexer: stats, chains });
  } catch (err) {
    logger.error({ err: err.message }, "[SettlementCtrl] getIndexerStatus error");
    res.status(500).json({ message: "Failed to fetch indexer status." });
  }
};

export const markSettlementFailed = async (req, res) => {
  try {
    const { settlementId } = req.params;
    const { reason }       = req.body;
    if (!settlementId) return res.status(400).json({ message: "settlementId required." });
    const record = await multiChainSettlementService.markFailed(settlementId, reason ?? "admin_override");
    if (!record) return res.status(404).json({ message: "Settlement not found or already finalized." });
    res.json({ settlement: record });
  } catch (err) {
    logger.error({ err: err.message }, "[SettlementCtrl] markSettlementFailed error");
    res.status(500).json({ message: "Failed to mark settlement failed." });
  }
};

export const getSupportedChains = async (_req, res) => {
  const chains = Object.values(CHAINS).map((c) => ({
    id:            c.id,
    label:         c.label,
    type:          c.type,
    nativeAsset:   c.nativeAsset,
    confirmations: c.confirmations,
    enabled:       c.enabled,
    explorerUrl:   c.explorerUrl,
  }));
  res.json({ chains });
};
