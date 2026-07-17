/**
 * CustodyVaultController — REST handlers for Phase 32.
 */

import { custodyVaultService } from "../services/custodyVaultService.js";
import logger from "../config/logger.js";

const guard = (user) => user?.role === "admin";

export const getVaults = async (req, res) => {
  try {
    if (!guard(req.user)) return res.status(403).json({ message: "Forbidden." });
    const { tier, status, page, limit } = req.query;
    const result = await custodyVaultService.getVaults({ tier, status, page: +page || 1, limit: +limit || 20 });
    res.json(result);
  } catch (err) {
    logger.error({ err: err.message }, "[VaultCtrl] getVaults");
    res.status(500).json({ message: "Failed to fetch vaults." });
  }
};

export const getVaultById = async (req, res) => {
  try {
    if (!guard(req.user)) return res.status(403).json({ message: "Forbidden." });
    const vault = await custodyVaultService.getVaultById(req.params.id);
    if (!vault) return res.status(404).json({ message: "Vault not found." });
    res.json({ vault });
  } catch (err) {
    logger.error({ err: err.message }, "[VaultCtrl] getVaultById");
    res.status(500).json({ message: "Failed to fetch vault." });
  }
};

export const createVault = async (req, res) => {
  try {
    if (!guard(req.user)) return res.status(403).json({ message: "Forbidden." });
    const { name, tier, custodian, description, requiredApprovals } = req.body;
    const vault = await custodyVaultService.createVault({
      name, tier, custodian, description, requiredApprovals,
      actor: req.user.email || String(req.user._id),
    });
    res.status(201).json({ vault });
  } catch (err) {
    logger.error({ err: err.message }, "[VaultCtrl] createVault");
    const code = err.message.includes("required") ? 400 : 500;
    res.status(code).json({ message: err.message });
  }
};

export const lockVault = async (req, res) => {
  try {
    if (!guard(req.user)) return res.status(403).json({ message: "Forbidden." });
    const vault = await custodyVaultService.lockVault(req.params.id, {
      reason: req.body.reason,
      actor:  req.user.email || String(req.user._id),
    });
    res.json({ vault });
  } catch (err) {
    logger.error({ err: err.message }, "[VaultCtrl] lockVault");
    const code = err.message.includes("not found") ? 404 : 500;
    res.status(code).json({ message: err.message });
  }
};

export const unlockVault = async (req, res) => {
  try {
    if (!guard(req.user)) return res.status(403).json({ message: "Forbidden." });
    const vault = await custodyVaultService.unlockVault(req.params.id, {
      actor: req.user.email || String(req.user._id),
    });
    res.json({ vault });
  } catch (err) {
    logger.error({ err: err.message }, "[VaultCtrl] unlockVault");
    const code = err.message.includes("not found") ? 404 : 500;
    res.status(code).json({ message: err.message });
  }
};

export const getTransactions = async (req, res) => {
  try {
    if (!guard(req.user)) return res.status(403).json({ message: "Forbidden." });
    const { status, vaultId, type, page, limit } = req.query;
    const result = await custodyVaultService.getTransactions({ status, vaultId, type, page: +page || 1, limit: +limit || 50 });
    res.json(result);
  } catch (err) {
    logger.error({ err: err.message }, "[VaultCtrl] getTransactions");
    res.status(500).json({ message: "Failed to fetch transactions." });
  }
};

export const initiateTransaction = async (req, res) => {
  try {
    if (!guard(req.user)) return res.status(403).json({ message: "Forbidden." });
    const { fromVaultId, toVaultId, toAddress, asset, amount, type, description, timeLockHours } = req.body;
    const tx = await custodyVaultService.initiateTransaction({
      fromVaultId, toVaultId, toAddress, asset, amount: Number(amount), type, description, timeLockHours,
      initiatedBy: req.user._id,
    });
    res.status(201).json({ transaction: tx });
  } catch (err) {
    logger.error({ err: err.message }, "[VaultCtrl] initiateTransaction");
    const code = err.message.includes("required") ? 400 : err.message.includes("not found") ? 404 : 500;
    res.status(code).json({ message: err.message });
  }
};

export const approveTransaction = async (req, res) => {
  try {
    if (!guard(req.user)) return res.status(403).json({ message: "Forbidden." });
    const tx = await custodyVaultService.approveTransaction(req.params.txId, {
      approverId: req.user._id,
      comment:    req.body.comment,
    });
    res.json({ transaction: tx });
  } catch (err) {
    logger.error({ err: err.message }, "[VaultCtrl] approveTransaction");
    const code = err.message.includes("not found") ? 404
                : err.message.includes("not pending") ? 409
                : err.message.includes("Time-lock") ? 423 : 400;
    res.status(code).json({ message: err.message });
  }
};

export const rejectTransaction = async (req, res) => {
  try {
    if (!guard(req.user)) return res.status(403).json({ message: "Forbidden." });
    const tx = await custodyVaultService.rejectTransaction(req.params.txId, {
      rejecterId: req.user._id,
      reason:     req.body.reason,
    });
    res.json({ transaction: tx });
  } catch (err) {
    logger.error({ err: err.message }, "[VaultCtrl] rejectTransaction");
    const code = err.message.includes("not found") ? 404 : 400;
    res.status(code).json({ message: err.message });
  }
};

export const getPendingApprovals = async (req, res) => {
  try {
    if (!guard(req.user)) return res.status(403).json({ message: "Forbidden." });
    const pending = await custodyVaultService.getPendingApprovals();
    res.json({ transactions: pending, count: pending.length });
  } catch (err) {
    logger.error({ err: err.message }, "[VaultCtrl] getPendingApprovals");
    res.status(500).json({ message: "Failed to fetch pending approvals." });
  }
};

export const getStatistics = async (req, res) => {
  try {
    if (!guard(req.user)) return res.status(403).json({ message: "Forbidden." });
    const stats = await custodyVaultService.getStatistics();
    res.json({ stats });
  } catch (err) {
    logger.error({ err: err.message }, "[VaultCtrl] getStatistics");
    res.status(500).json({ message: "Failed to fetch statistics." });
  }
};

export const getPolicies = async (req, res) => {
  try {
    if (!guard(req.user)) return res.status(403).json({ message: "Forbidden." });
    const policies = await custodyVaultService.getPolicies();
    res.json({ policies });
  } catch (err) {
    logger.error({ err: err.message }, "[VaultCtrl] getPolicies");
    res.status(500).json({ message: "Failed to fetch policies." });
  }
};

export const createPolicy = async (req, res) => {
  try {
    if (!guard(req.user)) return res.status(403).json({ message: "Forbidden." });
    const policy = await custodyVaultService.createPolicy({
      ...req.body,
      actor: req.user.email || String(req.user._id),
    });
    res.status(201).json({ policy });
  } catch (err) {
    logger.error({ err: err.message }, "[VaultCtrl] createPolicy");
    res.status(500).json({ message: "Failed to create policy." });
  }
};

export const getAuditLog = async (req, res) => {
  try {
    if (!guard(req.user)) return res.status(403).json({ message: "Forbidden." });
    const { vaultId, eventType, page, limit } = req.query;
    const result = await custodyVaultService.getAuditLog({ vaultId, eventType, page: +page || 1, limit: +limit || 50 });
    res.json(result);
  } catch (err) {
    logger.error({ err: err.message }, "[VaultCtrl] getAuditLog");
    res.status(500).json({ message: "Failed to fetch audit log." });
  }
};
