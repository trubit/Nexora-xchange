/**
 * GlobalEcosystemService — Phase 36: Global Financial Ecosystem Platform.
 *
 * Responsibilities:
 *   - Partner registry: onboard, score, and manage ecosystem participants
 *   - Cross-border payments: initiate, route, and settle via multiple rails
 *   - Integration management: track API call health for all partner connections
 *   - Ecosystem analytics: volume, partner health, network topology
 */

import crypto                from "crypto";
import EcosystemPartner      from "../models/EcosystemPartner.js";
import CrossBorderPayment    from "../models/CrossBorderPayment.js";
import EcosystemIntegration  from "../models/EcosystemIntegration.js";
import { eventBus }          from "../infra/eventBus.js";
import logger                from "../config/logger.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const HEALTH_POLL_MS  = parseInt(process.env.ECOSYSTEM_HEALTH_MS ?? "120000", 10);
const FX_SPREAD       = parseFloat(process.env.ECOSYSTEM_FX_SPREAD ?? "0.005"); // 0.5%

const genId = (prefix) => `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

// Simulated FX rates (in production: real-time feed)
const FX_RATES = {
  "USD-EUR": 0.92, "USD-GBP": 0.79, "USD-JPY": 148.5,
  "EUR-USD": 1.09, "GBP-USD": 1.27, "JPY-USD": 0.0067,
};
const getRate = (from, to) => {
  if (from === to) return 1;
  const key = `${from}-${to}`;
  return FX_RATES[key] ?? 1.0;
};

// ── Service ───────────────────────────────────────────────────────────────────

export class GlobalEcosystemService {
  constructor() {
    this._started       = false;
    this._healthTimer   = null;
    this._stats = {
      partnerOnboarded:   0,
      paymentsProcessed:  0,
      integrationsActive: 0,
    };
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async start() {
    if (this._started) return;
    this._started = true;

    this._healthTimer = setInterval(() => this._pollIntegrationHealth().catch(() => {}), HEALTH_POLL_MS);

    logger.info("[Ecosystem] Global ecosystem service started.");
  }

  stop() {
    if (this._healthTimer) { clearInterval(this._healthTimer); this._healthTimer = null; }
    this._started = false;
    logger.info("[Ecosystem] Service stopped.");
  }

  // ── Partner registry ──────────────────────────────────────────────────────

  async onboardPartner({ name, type, region, apiEndpoint, capabilities = [] } = {}) {
    if (!name || !type) throw new Error("name and type required.");
    const validTypes = ["exchange","bank","payment_processor","defi_protocol","custodian","data_provider"];
    if (!validTypes.includes(type)) throw new Error(`Invalid type. Must be one of: ${validTypes.join(", ")}.`);

    const partnerId = genId("PRT");
    const partner = await EcosystemPartner.create({
      partnerId, name, type, region: region || "global",
      apiEndpoint, capabilities,
      ratingScore: 50, // default neutral score
      status: "pending",
    });

    this._stats.partnerOnboarded++;
    logger.info({ partnerId, name, type }, "[Ecosystem] Partner onboarded.");
    return partner;
  }

  async activatePartner(partnerId) {
    const partner = await EcosystemPartner.findOneAndUpdate(
      { partnerId },
      { status: "active", contractedAt: new Date() },
      { new: true }
    ).lean();
    if (!partner) throw new Error("Partner not found.");

    eventBus.publish("ecosystem.partner.activated", { partnerId, name: partner.name });
    return partner;
  }

  async updatePartnerRating(partnerId, score) {
    if (score < 0 || score > 100) throw new Error("Score must be between 0 and 100.");
    const partner = await EcosystemPartner.findOneAndUpdate(
      { partnerId },
      { ratingScore: score },
      { new: true }
    ).lean();
    if (!partner) throw new Error("Partner not found.");
    return partner;
  }

  async getPartners({ type, status, page = 1, limit = 20 } = {}) {
    const q = {};
    if (type)   q.type   = type;
    if (status) q.status = status;
    const skip = (page - 1) * limit;
    const [partners, total] = await Promise.all([
      EcosystemPartner.find(q).sort({ ratingScore: -1 }).skip(skip).limit(limit).lean(),
      EcosystemPartner.countDocuments(q),
    ]);
    return { partners, total };
  }

  // ── Cross-border payments ─────────────────────────────────────────────────

  async initiatePayment({ fromUserId, fromPartnerId, toPartnerId,
    sourceCurrency, targetCurrency, sourceAmount, rail = "internal" } = {}) {
    if (!sourceCurrency || !targetCurrency || !sourceAmount) {
      throw new Error("sourceCurrency, targetCurrency, and sourceAmount required.");
    }

    const rate        = getRate(sourceCurrency, targetCurrency) * (1 - FX_SPREAD);
    const targetAmount = parseFloat((sourceAmount * rate).toFixed(8));
    const feeAmount    = parseFloat((sourceAmount * 0.0015).toFixed(8));

    const paymentId = genId("PAY");
    const payment = await CrossBorderPayment.create({
      paymentId, fromUserId, fromPartnerId, toPartnerId,
      sourceCurrency, targetCurrency,
      sourceAmount, targetAmount, exchangeRate: rate,
      feeAmount, rail, status: "processing",
    });

    this._stats.paymentsProcessed++;

    setImmediate(async () => {
      try {
        await CrossBorderPayment.findOneAndUpdate(
          { paymentId },
          { status: "completed", completedAt: new Date() }
        );
        eventBus.publish("ecosystem.payment.completed", { paymentId, sourceCurrency, targetCurrency, targetAmount });
      } catch { /* non-fatal */ }
    });

    return payment;
  }

  async getPayments({ status, rail, page = 1, limit = 50 } = {}) {
    const q = {};
    if (status) q.status = status;
    if (rail)   q.rail   = rail;
    const skip = (page - 1) * limit;
    const [payments, total] = await Promise.all([
      CrossBorderPayment.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      CrossBorderPayment.countDocuments(q),
    ]);
    return { payments, total };
  }

  // ── Integration management ────────────────────────────────────────────────

  async createIntegration({ partnerId, type, direction, dataTypes = [] } = {}) {
    if (!partnerId || !type) throw new Error("partnerId and type required.");
    const validTypes = ["webhook","rest_pull","websocket","sftp","batch"];
    if (!validTypes.includes(type)) throw new Error("Invalid integration type.");

    const integrationId = genId("INT");
    const integration = await EcosystemIntegration.create({
      integrationId, partnerId, type, direction: direction || "bidirectional",
      dataTypes, status: "configured",
    });

    this._stats.integrationsActive++;
    return integration;
  }

  async recordIntegrationCall(integrationId, { success, errorMessage = null } = {}) {
    const update = success
      ? { $inc: { callCount: 1 }, lastSuccessAt: new Date(), status: "active" }
      : { $inc: { callCount: 1, errorCount: 1 }, lastErrorAt: new Date(), lastError: errorMessage, status: "failing" };

    const integration = await EcosystemIntegration.findOneAndUpdate(
      { integrationId }, update, { new: true }
    ).lean();
    if (!integration) throw new Error("Integration not found.");
    return integration;
  }

  async getIntegrations({ partnerId, status, page = 1, limit = 50 } = {}) {
    const q = {};
    if (partnerId) q.partnerId = partnerId;
    if (status)    q.status    = status;
    const skip = (page - 1) * limit;
    const [integrations, total] = await Promise.all([
      EcosystemIntegration.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      EcosystemIntegration.countDocuments(q),
    ]);
    return { integrations, total };
  }

  // ── Health polling ────────────────────────────────────────────────────────

  async _pollIntegrationHealth() {
    const failingCount = await EcosystemIntegration.countDocuments({ status: "failing" });
    if (failingCount > 0) {
      logger.warn({ failingCount }, "[Ecosystem] Failing integrations detected.");
    }
  }

  // ── Statistics ────────────────────────────────────────────────────────────

  async getStatistics() {
    const [
      totalPartners, activePartners,
      totalPayments, completedPayments,
      totalIntegrations, activeIntegrations,
      failingIntegrations,
    ] = await Promise.all([
      EcosystemPartner.countDocuments(),
      EcosystemPartner.countDocuments({ status: "active" }),
      CrossBorderPayment.countDocuments(),
      CrossBorderPayment.countDocuments({ status: "completed" }),
      EcosystemIntegration.countDocuments(),
      EcosystemIntegration.countDocuments({ status: "active" }),
      EcosystemIntegration.countDocuments({ status: "failing" }),
    ]);

    return {
      partners:     { total: totalPartners, active: activePartners },
      payments:     { total: totalPayments, completed: completedPayments },
      integrations: { total: totalIntegrations, active: activeIntegrations, failing: failingIntegrations },
      inMemory:     { ...this._stats },
    };
  }
}

export const globalEcosystemService = new GlobalEcosystemService();
