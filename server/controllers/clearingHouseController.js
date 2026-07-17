/**
 * ClearingHouseController — REST handlers for Phase 31.
 * All routes require auth. Most require admin / compliance_officer / finance_admin.
 */

import { clearingHouseService } from "../services/clearingHouseService.js";
import logger from "../config/logger.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const CLEARING_ROLES = ["admin", "compliance_officer", "finance_admin"];

const hasAccess = (user) =>
  user && (CLEARING_ROLES.includes(user.role) || user.role === "admin");

// ── Handlers ──────────────────────────────────────────────────────────────────

export const getSettlements = async (req, res) => {
  try {
    if (!hasAccess(req.user)) return res.status(403).json({ message: "Forbidden." });
    const { status, symbol, page, limit } = req.query;
    const result = await clearingHouseService.getSettlements({
      status, symbol,
      page:  parseInt(page  ?? "1",  10),
      limit: parseInt(limit ?? "50", 10),
    });
    res.json(result);
  } catch (err) {
    logger.error({ err: err.message }, "[ClearingCtrl] getSettlements");
    res.status(500).json({ message: "Failed to fetch settlements." });
  }
};

export const getSettlementById = async (req, res) => {
  try {
    if (!hasAccess(req.user)) return res.status(403).json({ message: "Forbidden." });
    const { id } = req.params;
    const record = await clearingHouseService.getSettlementById(id);
    if (!record) return res.status(404).json({ message: "Clearing record not found." });
    res.json({ record });
  } catch (err) {
    logger.error({ err: err.message }, "[ClearingCtrl] getSettlementById");
    res.status(500).json({ message: "Failed to fetch settlement." });
  }
};

export const getSettlementHistory = async (req, res) => {
  try {
    if (!hasAccess(req.user)) return res.status(403).json({ message: "Forbidden." });
    const { page, limit, status } = req.query;
    const result = await clearingHouseService.getSettlements({
      status: status || "settled",
      page:  parseInt(page  ?? "1",  10),
      limit: parseInt(limit ?? "50", 10),
    });
    res.json(result);
  } catch (err) {
    logger.error({ err: err.message }, "[ClearingCtrl] getSettlementHistory");
    res.status(500).json({ message: "Failed to fetch history." });
  }
};

export const reconcile = async (req, res) => {
  try {
    if (!hasAccess(req.user)) return res.status(403).json({ message: "Forbidden." });
    const { fromDate, toDate } = req.body;
    const result = await clearingHouseService.reconcile({
      initiatedBy: req.user.email || String(req.user._id),
      fromDate,
      toDate,
    });
    res.json({ reconciliation: result });
  } catch (err) {
    logger.error({ err: err.message }, "[ClearingCtrl] reconcile");
    res.status(500).json({ message: "Reconciliation failed." });
  }
};

export const retrySettlement = async (req, res) => {
  try {
    if (!hasAccess(req.user)) return res.status(403).json({ message: "Forbidden." });
    const { id } = req.params;
    const record = await clearingHouseService.retryClearing(id);
    res.json({ record });
  } catch (err) {
    logger.error({ err: err.message }, "[ClearingCtrl] retrySettlement");
    const code = err.message.includes("not found") ? 404
                : err.message.includes("Max retries") ? 422
                : err.message.includes("Only failed") ? 400 : 500;
    res.status(code).json({ message: err.message });
  }
};

export const getStatistics = async (req, res) => {
  try {
    if (!hasAccess(req.user)) return res.status(403).json({ message: "Forbidden." });
    const stats = await clearingHouseService.getStatistics();
    res.json({ stats });
  } catch (err) {
    logger.error({ err: err.message }, "[ClearingCtrl] getStatistics");
    res.status(500).json({ message: "Failed to fetch statistics." });
  }
};

export const getBatches = async (req, res) => {
  try {
    if (!hasAccess(req.user)) return res.status(403).json({ message: "Forbidden." });
    const { status, page, limit } = req.query;
    const result = await clearingHouseService.getBatches({
      status,
      page:  parseInt(page  ?? "1",  10),
      limit: parseInt(limit ?? "20", 10),
    });
    res.json(result);
  } catch (err) {
    logger.error({ err: err.message }, "[ClearingCtrl] getBatches");
    res.status(500).json({ message: "Failed to fetch batches." });
  }
};

export const getAuditLogs = async (req, res) => {
  try {
    if (!hasAccess(req.user)) return res.status(403).json({ message: "Forbidden." });
    const { eventType, clearingId, page, limit } = req.query;
    const result = await clearingHouseService.getAuditLogs({
      eventType,
      clearingId,
      page:  parseInt(page  ?? "1",  10),
      limit: parseInt(limit ?? "50", 10),
    });
    res.json(result);
  } catch (err) {
    logger.error({ err: err.message }, "[ClearingCtrl] getAuditLogs");
    res.status(500).json({ message: "Failed to fetch audit logs." });
  }
};
