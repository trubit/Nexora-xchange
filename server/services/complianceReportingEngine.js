/**
 * ComplianceReportingEngine — regulatory reporting and snapshot generation.
 *
 * Generates periodic compliance reports from the immutable ledger.
 * Reports are finalized and cannot be retracted once submitted.
 */

import { v4 as uuidv4 }     from "uuid";
import ComplianceReport      from "../models/ComplianceReport.js";
import ImmutableLedgerEntry  from "../models/ImmutableLedgerEntry.js";
import logger                from "../config/logger.js";

export class ComplianceReportingEngine {
  /**
   * Generate a compliance report for a time period.
   */
  async generateReport({ type = "ON_DEMAND", periodStart, periodEnd, generatedBy = "system" } = {}) {
    const reportId = `RPT-${uuidv4().replace(/-/g, "").slice(0, 12).toUpperCase()}`;

    // Create pending report
    const report = await ComplianceReport.create({
      reportId, type,
      periodStart: new Date(periodStart),
      periodEnd:   new Date(periodEnd),
      status:      "generating",
      generatedBy,
    });

    try {
      const summary = await this._summarizePeriod(new Date(periodStart), new Date(periodEnd));
      const lastEntry = await ImmutableLedgerEntry.findOne({
        createdAt: { $lte: new Date(periodEnd) },
      }).sort({ entryId: -1 }).lean();

      await ComplianceReport.findByIdAndUpdate(report._id, {
        status:    "finalized",
        summary,
        chainHash: lastEntry?.hash ?? null,
      });

      logger.info({ reportId, type, periodStart, periodEnd }, "[Compliance] Report generated.");
      return ComplianceReport.findById(report._id).lean();
    } catch (err) {
      logger.error({ err: err.message, reportId }, "[Compliance] Report generation failed.");
      throw err;
    }
  }

  async _summarizePeriod(start, end) {
    const entries = await ImmutableLedgerEntry.find({
      createdAt: { $gte: start, $lte: end },
    }).lean();

    const uniqueUsers = new Set();
    let deposits = 0, withdrawals = 0, trades = 0, fees = 0;

    for (const e of entries) {
      if (e.userId) uniqueUsers.add(String(e.userId));
      if (e.type === "DEPOSIT")    deposits    += Math.abs(e.amount);
      if (e.type === "WITHDRAWAL") withdrawals += Math.abs(e.amount);
      if (e.type === "TRADE")      trades++;
      if (e.type === "FEE")        fees        += Math.abs(e.amount);
    }

    return {
      totalEntries:    entries.length,
      totalDeposits:   deposits,
      totalWithdrawals:withdrawals,
      totalTrades:     trades,
      totalFees:       fees,
      uniqueUsers:     uniqueUsers.size,
    };
  }

  async getReport(reportId) {
    return ComplianceReport.findOne({ reportId }).lean();
  }

  async listReports({ type, status, limit = 50, skip = 0 } = {}) {
    const q = {};
    if (type)   q.type   = type;
    if (status) q.status = status;
    return ComplianceReport.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  }

  /**
   * Mark a report as submitted to a regulator.
   * Once submitted the status is locked.
   */
  async submitReport(reportId, { signature, submittedBy }) {
    const report = await ComplianceReport.findOne({ reportId });
    if (!report) throw new Error("Report not found.");
    if (report.status === "submitted") return report.toObject();
    if (report.status !== "finalized") throw new Error("Can only submit finalized reports.");
    report.status      = "submitted";
    report.signature   = signature ?? null;
    report.submittedAt = new Date();
    report.metadata    = { ...report.metadata, submittedBy };
    await report.save();
    return report.toObject();
  }
}

export const complianceReportingEngine = new ComplianceReportingEngine();
