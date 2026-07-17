import { autonomousOpsService } from "../services/autonomousOpsService.js";

const isAdmin = (user) => user?.role === "admin";

export async function getStatistics(req, res) {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: "Forbidden." });
    const stats = await autonomousOpsService.getStatistics();
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Scaling
export async function getScalingEvents(req, res) {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: "Forbidden." });
    const { direction, service, page, limit } = req.query;
    const result = await autonomousOpsService.getScalingEvents({
      direction, service,
      page:  parseInt(page  || "1",  10),
      limit: parseInt(limit || "50", 10),
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function triggerScale(req, res) {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: "Forbidden." });
    const event = await autonomousOpsService.triggerManualScale({
      ...req.body, initiatedBy: req.user._id || "admin",
    });
    res.status(201).json({ event });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// Incidents
export async function getIncidents(req, res) {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: "Forbidden." });
    const { status, severity, page, limit } = req.query;
    const result = await autonomousOpsService.getIncidents({
      status, severity,
      page:  parseInt(page  || "1",  10),
      limit: parseInt(limit || "50", 10),
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function createIncident(req, res) {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: "Forbidden." });
    const incident = await autonomousOpsService.createIncident(req.body);
    res.status(201).json({ incident });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function updateIncident(req, res) {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: "Forbidden." });
    const incident = await autonomousOpsService.updateIncident(req.params.incidentId, {
      ...req.body, actor: req.user._id || "admin",
    });
    res.json({ incident });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// Deployments
export async function getDeployments(req, res) {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: "Forbidden." });
    const { service, status, page, limit } = req.query;
    const result = await autonomousOpsService.getDeployments({
      service, status,
      page:  parseInt(page  || "1",  10),
      limit: parseInt(limit || "20", 10),
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function recordDeployment(req, res) {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: "Forbidden." });
    const deployment = await autonomousOpsService.recordDeployment({
      ...req.body, initiatedBy: req.user._id || "admin",
    });
    res.status(201).json({ deployment });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function rollbackDeployment(req, res) {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: "Forbidden." });
    const deployment = await autonomousOpsService.rollbackDeployment(req.params.deploymentId);
    res.json({ deployment });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}
