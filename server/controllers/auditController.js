import AuditLog      from "../models/AuditLog.js";
import { verifyChain } from "../services/auditService.js";

// ── User: get own audit log ────────────────────────────────────────────────────

export const getMyAuditLog = async (req, res) => {
  const { page = 1, limit = 50, category, severity } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const filter = { userId: req.user._id };
  if (category) filter.category = category;
  if (severity) filter.severity = severity;

  const [logs, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    AuditLog.countDocuments(filter),
  ]);

  res.json({ logs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
};

// ── Admin: query all audit logs ────────────────────────────────────────────────

export const getAuditLogs = async (req, res) => {
  const { page = 1, limit = 100, userId, category, severity, action, from, to } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const filter = {};
  if (userId)   filter.userId   = userId;
  if (category) filter.category = category;
  if (severity) filter.severity = severity;
  if (action)   filter.action   = new RegExp(action, "i");
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to)   filter.createdAt.$lte = new Date(to);
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    AuditLog.countDocuments(filter),
  ]);

  res.json({ logs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
};

// ── Admin: verify chain integrity for a user ──────────────────────────────────

export const verifyUserChain = async (req, res) => {
  const result = await verifyChain(req.params.userId);
  res.json(result);
};

// ── Admin: security event summary (dashboard stats) ───────────────────────────

export const getAuditStats = async (req, res) => {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7d  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [total, critical24h, warning24h, byCategory, topActions] = await Promise.all([
    AuditLog.countDocuments(),
    AuditLog.countDocuments({ severity: "critical", createdAt: { $gte: since24h } }),
    AuditLog.countDocuments({ severity: "warning",  createdAt: { $gte: since24h } }),
    AuditLog.aggregate([
      { $match: { createdAt: { $gte: since7d } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]),
    AuditLog.aggregate([
      { $match: { createdAt: { $gte: since24h } } },
      { $group: { _id: "$action", count: { $sum: 1 } } },
      { $sort: { count: -1 } }, { $limit: 10 },
    ]),
  ]);

  res.json({ total, critical24h, warning24h, byCategory, topActions });
};
