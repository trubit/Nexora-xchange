/**
 * RegulatoryComplianceService — Phase 33: Global Regulatory Compliance Platform.
 *
 * Responsibilities:
 *   - Sanctions screening (OFAC / EU / UN / HMT)
 *   - FATF Travel Rule compliance for VASP-to-VASP transfers (≥$1,000)
 *   - SAR (Suspicious Activity Report) workflow: draft → review → file
 *   - Regulatory report generation (FinCEN CTR, GDPR data requests, MiCA)
 *   - Real-time AML event monitoring and escalation
 */

import crypto             from "crypto";
import SanctionHit        from "../models/SanctionHit.js";
import TravelRuleRecord   from "../models/TravelRuleRecord.js";
import SuspiciousActivityReport from "../models/SuspiciousActivityReport.js";
import ComplianceReport   from "../models/ComplianceReport.js";
import AmlAlert           from "../models/AmlAlert.js";
import { eventBus }       from "../infra/eventBus.js";
import logger             from "../config/logger.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const TRAVEL_RULE_THRESHOLD_USD = parseFloat(process.env.TRAVEL_RULE_THRESHOLD_USD ?? "1000");
const SANCTIONS_SCREEN_INTERVAL = parseInt(process.env.SANCTIONS_SCREEN_MS ?? "60000", 10);

const genId = (prefix) => `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

// ── Simulated sanctions lists (in production: live API feeds) ─────────────────

const SANCTIONS_INDICATORS = [
  "OFAC_SDN", "EU_SANCTIONS", "UN_SANCTIONS", "HMT_UK", "INTERNAL_BLACKLIST",
];

// Simple name-based fuzzy match: score based on string similarity
const fuzzyScore = (a, b) => {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const na = norm(a), nb = norm(b);
  if (na === nb) return 100;
  if (na.includes(nb) || nb.includes(na)) return 80;
  return 0;
};

// ── Main service ──────────────────────────────────────────────────────────────

export class RegulatoryComplianceService {
  constructor() {
    this._started        = false;
    this._screenTimer    = null;
    this._stats = {
      sanctionScreenings: 0,
      hitsFound:          0,
      travelRuleRecords:  0,
      sarsFiled:          0,
      reportsGenerated:   0,
    };
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async start() {
    if (this._started) return;
    this._started = true;

    // Subscribe to AML alerts for auto-SAR escalation
    eventBus.on("aml.alert", (payload) => this._onAmlAlert(payload).catch((e) =>
      logger.error({ err: e.message }, "[RegCompliance] AML handler error.")
    ));

    // Periodic pending-review screening
    this._screenTimer = setInterval(() => this._screenPendingAlerts().catch(() => {}), SANCTIONS_SCREEN_INTERVAL);

    logger.info("[RegCompliance] Regulatory compliance service started.");
  }

  stop() {
    if (this._screenTimer) { clearInterval(this._screenTimer); this._screenTimer = null; }
    this._started = false;
    logger.info("[RegCompliance] Service stopped.");
  }

  // ── Sanctions screening ───────────────────────────────────────────────────

  /**
   * Screen a name or wallet address against all active sanctions lists.
   * @returns {object[]} hits array (empty = clean)
   */
  async screenEntity({ name, address, userId = null } = {}) {
    if (!name && !address) throw new Error("name or address required.");

    this._stats.sanctionScreenings++;
    const hits = [];

    for (const list of SANCTIONS_INDICATORS) {
      if (name) {
        const score = fuzzyScore(name, list.split("_").join(" "));
        if (score >= 80) {
          const hit = await SanctionHit.create({
            hitId:        genId("SHT"),
            userId,
            matchedValue: name,
            listName:     list,
            matchType:    "fuzzy",
            matchScore:   score,
            status:       "pending_review",
          });
          hits.push(hit);
          this._stats.hitsFound++;
        }
      }
    }

    // Address screening: check internal blacklist pattern (0x0000... = blacklisted)
    if (address && address.startsWith("0x0000")) {
      const hit = await SanctionHit.create({
        hitId:        genId("SHT"),
        userId,
        address,
        matchedValue: address,
        listName:     "INTERNAL_BLACKLIST",
        matchType:    "address",
        matchScore:   100,
        status:       "pending_review",
      });
      hits.push(hit);
      this._stats.hitsFound++;
    }

    return hits;
  }

  async reviewSanctionHit(hitId, { reviewedBy, status, notes } = {}) {
    if (!["confirmed", "false_positive", "escalated"].includes(status)) {
      throw new Error("Invalid status. Must be confirmed, false_positive, or escalated.");
    }
    const hit = await SanctionHit.findOneAndUpdate(
      { hitId },
      { status, reviewedBy, reviewNotes: notes, reviewedAt: new Date() },
      { new: true }
    ).lean();
    if (!hit) throw new Error("Sanction hit not found.");
    return hit;
  }

  async getSanctionHits({ status, userId, page = 1, limit = 50 } = {}) {
    const q = {};
    if (status) q.status = status;
    if (userId) q.userId = userId;
    const skip = (page - 1) * limit;
    const [hits, total] = await Promise.all([
      SanctionHit.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      SanctionHit.countDocuments(q),
    ]);
    return { hits, total };
  }

  // ── Travel Rule ───────────────────────────────────────────────────────────

  async createTravelRuleRecord(data) {
    const { transactionId, asset, amount, amountUsd,
      originatorVasp, originatorName, originatorWallet,
      beneficiaryVasp, beneficiaryName, beneficiaryWallet,
    } = data;

    if (!transactionId || !asset || !amount) throw new Error("transactionId, asset, amount required.");

    if (amountUsd < TRAVEL_RULE_THRESHOLD_USD) {
      return null; // below threshold — no Travel Rule required
    }

    const recordId = genId("TR");
    const record = await TravelRuleRecord.create({
      recordId, transactionId, asset, amount, amountUsd,
      originatorVasp, originatorName, originatorWallet,
      beneficiaryVasp, beneficiaryName, beneficiaryWallet,
      status: "pending",
    });

    this._stats.travelRuleRecords++;
    logger.info({ recordId, amountUsd }, "[RegCompliance] Travel Rule record created.");

    // Simulate sending the VASP message
    setImmediate(async () => {
      try {
        await TravelRuleRecord.findOneAndUpdate(
          { recordId },
          { status: "sent", sentAt: new Date(), messageId: genId("MSG") }
        );
      } catch { /* non-fatal */ }
    });

    return record;
  }

  async getTravelRuleRecords({ status, page = 1, limit = 50 } = {}) {
    const q = status ? { status } : {};
    const skip = (page - 1) * limit;
    const [records, total] = await Promise.all([
      TravelRuleRecord.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      TravelRuleRecord.countDocuments(q),
    ]);
    return { records, total };
  }

  // ── SAR workflow ──────────────────────────────────────────────────────────

  async createSar({ userId, alertIds, activityType, description, totalAmountUsd, periodStart, periodEnd, preparedBy } = {}) {
    if (!activityType || !description || !periodStart || !periodEnd) {
      throw new Error("activityType, description, periodStart, periodEnd required.");
    }

    const sarId = genId("SAR");
    const sar = await SuspiciousActivityReport.create({
      sarId, userId, alertIds, activityType, description,
      totalAmountUsd, periodStart, periodEnd,
      preparedBy, status: "draft",
    });

    logger.info({ sarId, activityType }, "[RegCompliance] SAR created.");
    return sar;
  }

  async submitSar(sarId, { approvedBy, filedWith = "FinCEN" } = {}) {
    const sar = await SuspiciousActivityReport.findOne({ sarId }).lean();
    if (!sar) throw new Error("SAR not found.");
    if (!["draft", "under_review", "approved"].includes(sar.status)) {
      throw new Error("SAR cannot be filed from its current status.");
    }

    const refNum = `FINCEN-${Date.now()}`;
    const updated = await SuspiciousActivityReport.findOneAndUpdate(
      { sarId },
      { status: "filed", approvedBy, filedWith, referenceNumber: refNum, filedAt: new Date() },
      { new: true }
    ).lean();

    this._stats.sarsFiled++;
    eventBus.publish("compliance.sar.filed", { sarId, activityType: sar.activityType, filedWith });
    return updated;
  }

  async getSars({ status, userId, page = 1, limit = 50 } = {}) {
    const q = {};
    if (status) q.status = status;
    if (userId) q.userId = userId;
    const skip = (page - 1) * limit;
    const [sars, total] = await Promise.all([
      SuspiciousActivityReport.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      SuspiciousActivityReport.countDocuments(q),
    ]);
    return { sars, total };
  }

  // ── Regulatory reports ────────────────────────────────────────────────────

  async generateReport({ type, periodStart, periodEnd, generatedBy = "system" } = {}) {
    if (!type || !periodStart || !periodEnd) throw new Error("type, periodStart, periodEnd required.");

    const reportId = genId("RPT");
    const report = await ComplianceReport.create({
      reportId, type,
      periodStart: new Date(periodStart),
      periodEnd:   new Date(periodEnd),
      generatedBy,
      status:      "generating",
    });

    this._stats.reportsGenerated++;

    setImmediate(async () => {
      try {
        const [alerts, sars, travelRules] = await Promise.all([
          AmlAlert.countDocuments({ createdAt: { $gte: new Date(periodStart), $lte: new Date(periodEnd) } }),
          SuspiciousActivityReport.countDocuments({ createdAt: { $gte: new Date(periodStart), $lte: new Date(periodEnd) } }),
          TravelRuleRecord.countDocuments({ createdAt: { $gte: new Date(periodStart), $lte: new Date(periodEnd) } }),
        ]);

        await ComplianceReport.findOneAndUpdate(
          { reportId },
          {
            status: "finalized",
            "summary.totalEntries": alerts,
            metadata: { amlAlerts: alerts, sars, travelRules },
          }
        );
      } catch (err) {
        logger.error({ err: err.message, reportId }, "[RegCompliance] Report finalization failed.");
      }
    });

    return report;
  }

  async getReports({ status, type, page = 1, limit = 20 } = {}) {
    const q = {};
    if (status) q.status = status;
    if (type)   q.type   = type;
    const skip = (page - 1) * limit;
    const [reports, total] = await Promise.all([
      ComplianceReport.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ComplianceReport.countDocuments(q),
    ]);
    return { reports, total };
  }

  // ── AML event handler ─────────────────────────────────────────────────────

  async _onAmlAlert(payload) {
    if (payload?.riskScore >= 90) {
      // Auto-create draft SAR for critical alerts
      await this.createSar({
        userId:        payload.userId,
        alertIds:      [payload.alertId],
        activityType:  payload.alertType?.toUpperCase() || "OTHER",
        description:   `Auto-generated from AML alert: ${payload.description}`,
        totalAmountUsd:payload.amountUsd || 0,
        periodStart:   new Date(),
        periodEnd:     new Date(),
        preparedBy:    null,
      });
    }
  }

  async _screenPendingAlerts() {
    // Log pending sanction hits that need review
    const pendingCount = await SanctionHit.countDocuments({ status: "pending_review" });
    if (pendingCount > 0) {
      logger.warn({ pendingCount }, "[RegCompliance] Sanctions hits pending review.");
    }
  }

  // ── Statistics ────────────────────────────────────────────────────────────

  async getStatistics() {
    const [
      totalHits, pendingHits, confirmedHits, falsePosHits,
      travelRuleRecords, draftSars, filedSars, totalReports,
    ] = await Promise.all([
      SanctionHit.countDocuments(),
      SanctionHit.countDocuments({ status: "pending_review" }),
      SanctionHit.countDocuments({ status: "confirmed" }),
      SanctionHit.countDocuments({ status: "false_positive" }),
      TravelRuleRecord.countDocuments(),
      SuspiciousActivityReport.countDocuments({ status: "draft" }),
      SuspiciousActivityReport.countDocuments({ status: "filed" }),
      ComplianceReport.countDocuments(),
    ]);

    return {
      sanctions: { total: totalHits, pending: pendingHits, confirmed: confirmedHits, falsePositive: falsePosHits },
      travelRule: { total: travelRuleRecords },
      sar:        { draft: draftSars, filed: filedSars },
      reports:    { total: totalReports },
      inMemory:   { ...this._stats },
    };
  }
}

export const regulatoryComplianceService = new RegulatoryComplianceService();
