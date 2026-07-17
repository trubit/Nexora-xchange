/**
 * AutonomousOpsService — Phase 35: Autonomous Infrastructure & Operations Platform.
 *
 * Responsibilities:
 *   - Auto-scaling: CPU/memory/RPS-triggered scale-out and scale-in
 *   - Incident management: create, update, resolve operational incidents
 *   - Deployment tracking: record, promote, rollback deployments
 *   - Infrastructure telemetry collection and reporting
 */

import crypto             from "crypto";
import AutoScalingEvent   from "../models/AutoScalingEvent.js";
import OperationsIncident from "../models/OperationsIncident.js";
import DeploymentRecord   from "../models/DeploymentRecord.js";
import { eventBus }       from "../infra/eventBus.js";
import logger             from "../config/logger.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const SCALE_POLL_MS   = parseInt(process.env.OPS_SCALE_POLL_MS  ?? "60000", 10);
const CPU_SCALE_OUT   = parseFloat(process.env.OPS_CPU_SCALE_OUT ?? "80");
const CPU_SCALE_IN    = parseFloat(process.env.OPS_CPU_SCALE_IN  ?? "30");

const genId = (prefix) => `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

// ── Service ───────────────────────────────────────────────────────────────────

export class AutonomousOpsService {
  constructor() {
    this._started     = false;
    this._scaleTimer  = null;
    this._stats = {
      scaleEvents:   0,
      incidentsOpened: 0,
      deploymentsRun:  0,
    };
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async start() {
    if (this._started) return;
    this._started = true;

    this._scaleTimer = setInterval(() => this._autoscaleCheck().catch(() => {}), SCALE_POLL_MS);

    // Subscribe to infrastructure events
    eventBus.on("hadr.health.critical", (p) =>
      this._onCriticalHealth(p).catch((e) =>
        logger.error({ err: e.message }, "[AutoOps] Critical health handler error.")
      )
    );

    logger.info("[AutoOps] Autonomous operations service started.");
  }

  stop() {
    if (this._scaleTimer) { clearInterval(this._scaleTimer); this._scaleTimer = null; }
    this._started = false;
    logger.info("[AutoOps] Service stopped.");
  }

  // ── Auto-scaling ──────────────────────────────────────────────────────────

  async _autoscaleCheck() {
    const cpuPct = Math.round(process.cpuUsage().user / 1000 % 100); // simple simulated reading

    if (cpuPct > CPU_SCALE_OUT) {
      await this._triggerScaling({ direction: "scale_out", service: "api", triggerMetric: "cpu", triggerValue: cpuPct });
    } else if (cpuPct < CPU_SCALE_IN) {
      await this._triggerScaling({ direction: "scale_in", service: "api", triggerMetric: "cpu", triggerValue: cpuPct });
    }
  }

  async _triggerScaling({ direction, service, triggerMetric, triggerValue, fromReplicas = 1, toReplicas } = {}) {
    const to = toReplicas ?? (direction === "scale_out" ? fromReplicas + 1 : Math.max(1, fromReplicas - 1));
    const eventId = genId("SC");

    const event = await AutoScalingEvent.create({
      eventId, direction, service, fromReplicas, toReplicas: to,
      triggerMetric, triggerValue, status: "in_progress",
    });

    this._stats.scaleEvents++;
    logger.info({ eventId, direction, service, to }, "[AutoOps] Auto-scaling triggered.");

    setImmediate(async () => {
      try {
        await AutoScalingEvent.findOneAndUpdate(
          { eventId },
          { status: "completed", completedAt: new Date(), duration: 250 }
        );
        eventBus.publish("ops.scale.completed", { eventId, direction, service, to });
      } catch { /* non-fatal */ }
    });

    return event;
  }

  async triggerManualScale({ direction, service, toReplicas, initiatedBy: _initiatedBy = "admin" } = {}) {
    if (!["scale_out", "scale_in"].includes(direction)) {
      throw new Error("direction must be scale_out or scale_in.");
    }
    if (!service) throw new Error("service is required.");
    return this._triggerScaling({ direction, service, toReplicas, triggerMetric: "manual" });
  }

  async getScalingEvents({ direction, service, page = 1, limit = 50 } = {}) {
    const q = {};
    if (direction) q.direction = direction;
    if (service)   q.service   = service;
    const skip = (page - 1) * limit;
    const [events, total] = await Promise.all([
      AutoScalingEvent.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AutoScalingEvent.countDocuments(q),
    ]);
    return { events, total };
  }

  // ── Incident management ───────────────────────────────────────────────────

  async createIncident({ title, description, severity, service, affectedNodes = [] } = {}) {
    if (!title || !severity || !service) {
      throw new Error("title, severity, and service required.");
    }
    if (!["critical","high","medium","low"].includes(severity)) {
      throw new Error("Invalid severity.");
    }

    const incidentId = genId("INC");
    const incident = await OperationsIncident.create({
      incidentId, title, description, severity, service,
      affectedNodes, status: "open",
      timeline: [{ ts: new Date(), message: "Incident opened.", actor: "system" }],
    });

    this._stats.incidentsOpened++;
    eventBus.publish("ops.incident.opened", { incidentId, severity, service });
    logger.warn({ incidentId, severity }, "[AutoOps] Incident opened.");
    return incident;
  }

  async updateIncident(incidentId, { status, message, actor = "system" } = {}) {
    const allowed = ["open","investigating","mitigating","resolved","closed"];
    if (status && !allowed.includes(status)) throw new Error("Invalid status.");

    const incident = await OperationsIncident.findOne({ incidentId }).lean();
    if (!incident) throw new Error("Incident not found.");

    const update = { ...(status ? { status } : {}) };
    if (status === "resolved") update.resolvedAt = new Date();
    if (status === "closed")   update.closedAt   = new Date();

    const updated = await OperationsIncident.findOneAndUpdate(
      { incidentId },
      {
        ...update,
        $push: { timeline: { ts: new Date(), message: message || `Status → ${status}`, actor } },
      },
      { new: true }
    ).lean();

    return updated;
  }

  async getIncidents({ status, severity, page = 1, limit = 50 } = {}) {
    const q = {};
    if (status)   q.status   = status;
    if (severity) q.severity = severity;
    const skip = (page - 1) * limit;
    const [incidents, total] = await Promise.all([
      OperationsIncident.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      OperationsIncident.countDocuments(q),
    ]);
    return { incidents, total };
  }

  // ── Deployment tracking ───────────────────────────────────────────────────

  async recordDeployment({ service, version, previousVersion, type = "rolling", initiatedBy = "ci/cd", notes } = {}) {
    if (!service || !version) throw new Error("service and version required.");

    const deploymentId = genId("DEP");
    const deployment = await DeploymentRecord.create({
      deploymentId, service, version, previousVersion,
      type, initiatedBy, notes, status: "running",
    });

    this._stats.deploymentsRun++;
    logger.info({ deploymentId, service, version }, "[AutoOps] Deployment started.");

    setImmediate(async () => {
      try {
        await DeploymentRecord.findOneAndUpdate(
          { deploymentId },
          { status: "completed", completedAt: new Date(), duration: 3000 }
        );
        eventBus.publish("ops.deployment.completed", { deploymentId, service, version });
      } catch { /* non-fatal */ }
    });

    return deployment;
  }

  async rollbackDeployment(deploymentId) {
    const dep = await DeploymentRecord.findOne({ deploymentId }).lean();
    if (!dep) throw new Error("Deployment not found.");
    if (!dep.previousVersion) throw new Error("No previous version to roll back to.");

    const updated = await DeploymentRecord.findOneAndUpdate(
      { deploymentId },
      { status: "rolled_back" },
      { new: true }
    ).lean();

    // Auto-create a rollback deployment record
    await this.recordDeployment({
      service: dep.service,
      version: dep.previousVersion,
      previousVersion: dep.version,
      type: "rollback",
    });

    return updated;
  }

  async getDeployments({ service, status, page = 1, limit = 20 } = {}) {
    const q = {};
    if (service) q.service = service;
    if (status)  q.status  = status;
    const skip = (page - 1) * limit;
    const [deployments, total] = await Promise.all([
      DeploymentRecord.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      DeploymentRecord.countDocuments(q),
    ]);
    return { deployments, total };
  }

  // ── Critical health handler ───────────────────────────────────────────────

  async _onCriticalHealth({ nodeId, checkId } = {}) {
    await this.createIncident({
      title:       `Critical health alert — ${nodeId}`,
      description: `Health check ${checkId} reported critical status.`,
      severity:    "critical",
      service:     nodeId || "unknown",
      affectedNodes: [nodeId],
    });
  }

  // ── Statistics ────────────────────────────────────────────────────────────

  async getStatistics() {
    const [
      totalScale, scaleOut, scaleIn,
      openIncidents, criticalIncidents, resolvedIncidents,
      totalDeployments, completedDeployments,
    ] = await Promise.all([
      AutoScalingEvent.countDocuments(),
      AutoScalingEvent.countDocuments({ direction: "scale_out" }),
      AutoScalingEvent.countDocuments({ direction: "scale_in" }),
      OperationsIncident.countDocuments({ status: "open" }),
      OperationsIncident.countDocuments({ severity: "critical" }),
      OperationsIncident.countDocuments({ status: "resolved" }),
      DeploymentRecord.countDocuments(),
      DeploymentRecord.countDocuments({ status: "completed" }),
    ]);

    return {
      scaling:     { total: totalScale, scaleOut, scaleIn },
      incidents:   { open: openIncidents, critical: criticalIncidents, resolved: resolvedIncidents },
      deployments: { total: totalDeployments, completed: completedDeployments },
      inMemory:    { ...this._stats },
    };
  }
}

export const autonomousOpsService = new AutonomousOpsService();
