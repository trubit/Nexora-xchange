import { hadrService } from "../services/hadrService.js";

const isAdmin = (user) => user?.role === "admin";

export async function getStatistics(req, res) {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: "Forbidden." });
    const stats = await hadrService.getStatistics();
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Health
export async function getHealthChecks(req, res) {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: "Forbidden." });
    const { nodeId, status, page, limit } = req.query;
    const result = await hadrService.getHealthChecks({
      nodeId, status,
      page:  parseInt(page  || "1",  10),
      limit: parseInt(limit || "50", 10),
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Failover
export async function triggerFailover(req, res) {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: "Forbidden." });
    const event = await hadrService.triggerFailover({
      ...req.body,
      initiatedBy: req.user._id || "admin",
    });
    res.status(201).json({ event });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function getFailoverEvents(req, res) {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: "Forbidden." });
    const { status, page, limit } = req.query;
    const result = await hadrService.getFailoverEvents({
      status,
      page:  parseInt(page  || "1",  10),
      limit: parseInt(limit || "50", 10),
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Backups
export async function triggerManualBackup(req, res) {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: "Forbidden." });
    const snapshot = await hadrService.triggerManualBackup({
      ...req.body,
      initiatedBy: req.user._id || "admin",
    });
    res.status(201).json({ snapshot });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function getBackupSnapshots(req, res) {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: "Forbidden." });
    const { status, type, page, limit } = req.query;
    const result = await hadrService.getBackupSnapshots({
      status, type,
      page:  parseInt(page  || "1",  10),
      limit: parseInt(limit || "20", 10),
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// DR plans
export async function getDrPlans(req, res) {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: "Forbidden." });
    const { status, page, limit } = req.query;
    const result = await hadrService.getDrPlans({
      status,
      page:  parseInt(page  || "1",  10),
      limit: parseInt(limit || "20", 10),
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function createDrPlan(req, res) {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: "Forbidden." });
    const plan = await hadrService.createDrPlan(req.body);
    res.status(201).json({ plan });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function recordDrTest(req, res) {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: "Forbidden." });
    const plan = await hadrService.recordDrTest(req.params.planId, {
      ...req.body,
      testedBy: req.user._id || "admin",
    });
    res.json({ plan });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}
