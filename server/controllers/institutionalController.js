/**
 * Institutional Controller — REST handlers for Stage 29.
 */

import { clientManagementService, TIER_LIMITS } from "../services/clientManagementService.js";
import { institutionalApiGateway }             from "../services/institutionalApiGateway.js";
import logger                                  from "../config/logger.js";

// ── Client registration ────────────────────────────────────────────────────────

export const registerClient = async (req, res) => {
  try {
    const { name, contactEmail, tier, jurisdiction } = req.body;
    if (!name || !contactEmail) {
      return res.status(400).json({ message: "name and contactEmail are required." });
    }
    const client = await clientManagementService.registerClient({
      name, userId: req.user._id, contactEmail, tier, jurisdiction,
    });
    res.status(201).json({ client });
  } catch (err) {
    logger.error({ err: err.message }, "[InstCtrl] registerClient error");
    if (err.code === 11000) return res.status(409).json({ message: "Client already registered." });
    res.status(500).json({ message: "Failed to register client." });
  }
};

export const getMyClient = async (req, res) => {
  try {
    const client = await clientManagementService.getClientByUser(req.user._id);
    if (!client) return res.status(404).json({ message: "No institutional client found." });
    res.json({ client });
  } catch (err) {
    logger.error({ err: err.message }, "[InstCtrl] getMyClient error");
    res.status(500).json({ message: "Failed to fetch client." });
  }
};

export const getTierLimits = (_req, res) => {
  res.json({ tiers: TIER_LIMITS });
};

// ── Sub-accounts ───────────────────────────────────────────────────────────────

export const createSubAccount = async (req, res) => {
  try {
    const client = await clientManagementService.getClientByUser(req.user._id);
    if (!client) return res.status(404).json({ message: "No institutional client found." });
    const { name, permissions, maxOrderUsd, maxPositionUsd } = req.body;
    if (!name) return res.status(400).json({ message: "name is required." });
    const sub = await clientManagementService.createSubAccount({
      institutionId: client._id, name, permissions, maxOrderUsd, maxPositionUsd,
    });
    res.status(201).json({ subAccount: sub });
  } catch (err) {
    logger.error({ err: err.message }, "[InstCtrl] createSubAccount error");
    if (err.message.includes("limit reached")) return res.status(429).json({ message: err.message });
    res.status(500).json({ message: "Failed to create sub-account." });
  }
};

export const listSubAccounts = async (req, res) => {
  try {
    const client = await clientManagementService.getClientByUser(req.user._id);
    if (!client) return res.status(404).json({ message: "No institutional client found." });
    const subs = await clientManagementService.listSubAccounts(client._id);
    res.json({ subAccounts: subs, count: subs.length });
  } catch (err) {
    logger.error({ err: err.message }, "[InstCtrl] listSubAccounts error");
    res.status(500).json({ message: "Failed to list sub-accounts." });
  }
};

// ── API key management ─────────────────────────────────────────────────────────

export const issueApiKey = async (req, res) => {
  try {
    const client = await clientManagementService.getClientByUser(req.user._id);
    if (!client || !client.enabled) {
      return res.status(403).json({ message: "Institutional account required." });
    }
    const { name, permissions, ipWhitelist, expiresInDays } = req.body;
    if (!name) return res.status(400).json({ message: "name is required." });
    const result = await institutionalApiGateway.issueApiKey({
      userId: req.user._id, institutionId: client._id,
      name, permissions, ipWhitelist, expiresInDays,
    });
    res.status(201).json({ apiKey: result });
  } catch (err) {
    logger.error({ err: err.message }, "[InstCtrl] issueApiKey error");
    res.status(500).json({ message: "Failed to issue API key." });
  }
};

export const listApiKeys = async (req, res) => {
  try {
    const keys = await institutionalApiGateway.listApiKeys(req.user._id);
    res.json({ keys, count: keys.length });
  } catch (err) {
    logger.error({ err: err.message }, "[InstCtrl] listApiKeys error");
    res.status(500).json({ message: "Failed to list API keys." });
  }
};

export const revokeApiKey = async (req, res) => {
  try {
    const { keyId } = req.params;
    const doc = await institutionalApiGateway.revokeApiKey(keyId, req.user._id);
    if (!doc) return res.status(404).json({ message: "API key not found." });
    res.json({ message: "API key revoked." });
  } catch (err) {
    logger.error({ err: err.message }, "[InstCtrl] revokeApiKey error");
    res.status(500).json({ message: "Failed to revoke API key." });
  }
};

export const rotateApiKey = async (req, res) => {
  try {
    const { keyId } = req.params;
    const client = await clientManagementService.getClientByUser(req.user._id);
    const result = await institutionalApiGateway.rotateApiKey(keyId, {
      userId: req.user._id, institutionId: client?._id,
    });
    if (!result) return res.status(404).json({ message: "API key not found." });
    res.status(201).json({ apiKey: result });
  } catch (err) {
    logger.error({ err: err.message }, "[InstCtrl] rotateApiKey error");
    res.status(500).json({ message: "Failed to rotate API key." });
  }
};

// ── Admin ──────────────────────────────────────────────────────────────────────

export const listClients = async (req, res) => {
  try {
    const { tier, enabled } = req.query;
    const limit  = Math.min(parseInt(req.query.limit ?? "50", 10), 200);
    const skip   = parseInt(req.query.skip ?? "0", 10);
    const clients = await clientManagementService.listClients({
      tier, enabled: enabled !== undefined ? enabled === "true" : undefined, limit, skip,
    });
    res.json({ clients, count: clients.length });
  } catch (err) {
    logger.error({ err: err.message }, "[InstCtrl] listClients error");
    res.status(500).json({ message: "Failed to list clients." });
  }
};

export const updateClientTier = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { tier }     = req.body;
    if (!tier) return res.status(400).json({ message: "tier is required." });
    const client = await clientManagementService.updateClientTier(clientId, tier);
    if (!client) return res.status(404).json({ message: "Client not found." });
    res.json({ client });
  } catch (err) {
    logger.error({ err: err.message }, "[InstCtrl] updateClientTier error");
    if (err.message.includes("Invalid tier")) return res.status(400).json({ message: err.message });
    res.status(500).json({ message: "Failed to update tier." });
  }
};
