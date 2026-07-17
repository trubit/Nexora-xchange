/**
 * ClientManagementService — institutional client onboarding and management.
 *
 * Responsibilities:
 *   - Register and onboard institutional clients
 *   - Manage sub-account hierarchy
 *   - Enforce per-tier rate limits and position caps
 *   - Report usage and quota status
 *
 * Rule: strict security and quotas enforced (Stage 29 mandate).
 */

import InstitutionalClient from "../models/InstitutionalClient.js";
import SubAccount          from "../models/SubAccount.js";
import ApiKeyUsage         from "../models/ApiKeyUsage.js";
import logger              from "../config/logger.js";

// ── Tier definitions ──────────────────────────────────────────────────────────

export const TIER_LIMITS = {
  bronze:   { rateLimitRpm: 120,  maxSubAccounts: 5,   maxOrderUsd: 100_000,   maxPositionUsd: 1_000_000 },
  silver:   { rateLimitRpm: 500,  maxSubAccounts: 20,  maxOrderUsd: 500_000,   maxPositionUsd: 5_000_000 },
  gold:     { rateLimitRpm: 2000, maxSubAccounts: 50,  maxOrderUsd: 2_000_000, maxPositionUsd: 20_000_000 },
  platinum: { rateLimitRpm: 9999, maxSubAccounts: 200, maxOrderUsd: 10_000_000,maxPositionUsd: 100_000_000 },
};

// ── Service ───────────────────────────────────────────────────────────────────

export class ClientManagementService {
  // ── Client management ──────────────────────────────────────────────────────

  async registerClient({ name, userId, contactEmail, tier = "bronze", jurisdiction = "US" }) {
    const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.bronze;
    const client = await InstitutionalClient.create({
      name, userId, contactEmail, tier, jurisdiction, ...limits,
    });
    logger.info({ clientId: client._id, name, tier }, "[ClientMgmt] Institutional client registered.");
    return client.toObject();
  }

  async getClient(clientId) {
    return InstitutionalClient.findById(clientId).lean();
  }

  async getClientByUser(userId) {
    return InstitutionalClient.findOne({ userId }).lean();
  }

  async updateClientTier(clientId, tier) {
    if (!TIER_LIMITS[tier]) throw new Error(`Invalid tier: ${tier}`);
    const limits = TIER_LIMITS[tier];
    const client = await InstitutionalClient.findByIdAndUpdate(
      clientId, { tier, ...limits }, { new: true }
    ).lean();
    return client;
  }

  async disableClient(clientId) {
    return InstitutionalClient.findByIdAndUpdate(clientId, { enabled: false }, { new: true }).lean();
  }

  async listClients({ enabled, tier, limit = 50, skip = 0 } = {}) {
    const q = {};
    if (enabled !== undefined) q.enabled = enabled;
    if (tier)                  q.tier    = tier;
    return InstitutionalClient.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  }

  // ── Sub-account management ─────────────────────────────────────────────────

  async createSubAccount({ institutionId, name, userId = null, permissions = ["trade", "read"],
    maxOrderUsd, maxPositionUsd }) {
    // Enforce sub-account cap
    const count  = await SubAccount.countDocuments({ institutionId, enabled: true });
    const client = await InstitutionalClient.findById(institutionId).lean();
    if (!client) throw new Error("Institutional client not found.");
    if (count >= client.maxSubAccounts) {
      throw new Error(`Sub-account limit reached (max ${client.maxSubAccounts}).`);
    }

    // Sub-account limits cannot exceed parent limits
    const safeOrder    = Math.min(maxOrderUsd    ?? client.maxOrderUsd,    client.maxOrderUsd);
    const safePosition = Math.min(maxPositionUsd ?? client.maxPositionUsd, client.maxPositionUsd);

    const sub = await SubAccount.create({
      institutionId, name, userId, permissions,
      maxOrderUsd:    safeOrder,
      maxPositionUsd: safePosition,
    });
    return sub.toObject();
  }

  async listSubAccounts(institutionId) {
    return SubAccount.find({ institutionId }).sort({ createdAt: -1 }).lean();
  }

  async disableSubAccount(subAccountId) {
    return SubAccount.findByIdAndUpdate(subAccountId, { enabled: false }, { new: true }).lean();
  }

  // ── Rate limiting ──────────────────────────────────────────────────────────

  /**
   * Check whether a client is within their current-minute API quota.
   * Returns { allowed, remaining, limit, windowStart }
   */
  async checkRateLimit(institutionId, { requests = 1, orders = 0 } = {}) {
    const client = await InstitutionalClient.findById(institutionId).lean();
    if (!client || !client.enabled) return { allowed: false, reason: "disabled" };

    const now         = new Date();
    const windowStart = new Date(now - (now % 60000));   // floor to minute

    const usage = await ApiKeyUsage.findOne({ institutionId, windowStart }).lean() ?? {
      requests: 0, orders: 0,
    };

    const projReqs   = (usage.requests ?? 0) + requests;
    const projOrders = (usage.orders   ?? 0) + orders;

    if (projReqs   > client.rateLimitRpm)   return { allowed: false, reason: "rpm_exceeded",   limit: client.rateLimitRpm };
    if (projOrders > client.orderRateLimit) return { allowed: false, reason: "order_rate_exceeded", limit: client.orderRateLimit };

    return { allowed: true, remaining: client.rateLimitRpm - projReqs, limit: client.rateLimitRpm };
  }

  // ── Quota validation ───────────────────────────────────────────────────────

  validateOrderSize(client, orderUsd) {
    if (orderUsd > client.maxOrderUsd) {
      return { valid: false, reason: `Order size $${orderUsd} exceeds limit $${client.maxOrderUsd}` };
    }
    return { valid: true };
  }
}

export const clientManagementService = new ClientManagementService();
