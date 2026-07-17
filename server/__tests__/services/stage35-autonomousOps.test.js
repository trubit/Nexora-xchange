/**
 * Stage 35 — Autonomous Infrastructure & Operations Platform
 * Tests: AutonomousOpsService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AutonomousOpsService } from "../../services/autonomousOpsService.js";

vi.mock("../../models/AutoScalingEvent.js", () => ({
  default: {
    create:          vi.fn(),
    find:            vi.fn(),
    findOneAndUpdate:vi.fn(),
    countDocuments:  vi.fn(),
  },
}));

vi.mock("../../models/OperationsIncident.js", () => ({
  default: {
    create:          vi.fn(),
    find:            vi.fn(),
    findOne:         vi.fn(),
    findOneAndUpdate:vi.fn(),
    countDocuments:  vi.fn(),
  },
}));

vi.mock("../../models/DeploymentRecord.js", () => ({
  default: {
    create:          vi.fn(),
    find:            vi.fn(),
    findOne:         vi.fn(),
    findOneAndUpdate:vi.fn(),
    countDocuments:  vi.fn(),
  },
}));

vi.mock("../../infra/eventBus.js", () => ({
  eventBus: { on: vi.fn(), publish: vi.fn() },
}));

vi.mock("../../config/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import AutoScalingEvent   from "../../models/AutoScalingEvent.js";
import OperationsIncident from "../../models/OperationsIncident.js";
import DeploymentRecord   from "../../models/DeploymentRecord.js";
import { eventBus }       from "../../infra/eventBus.js";

describe("AutonomousOpsService", () => {
  let svc;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new AutonomousOpsService();
  });

  afterEach(() => {
    svc.stop();
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────

  describe("start() / stop()", () => {
    it("sets _started to true", async () => {
      await svc.start();
      expect(svc._started).toBe(true);
    });

    it("is idempotent — second start() does not re-register", async () => {
      await svc.start();
      const t = svc._scaleTimer;
      await svc.start();
      expect(svc._scaleTimer).toBe(t);
    });

    it("stop() clears timers and sets _started to false", async () => {
      await svc.start();
      svc.stop();
      expect(svc._started).toBe(false);
      expect(svc._scaleTimer).toBeNull();
    });

    it("subscribes to hadr.health.critical on start", async () => {
      await svc.start();
      expect(eventBus.on).toHaveBeenCalledWith("hadr.health.critical", expect.any(Function));
    });
  });

  // ── Auto-scaling ──────────────────────────────────────────────────────────

  describe("triggerManualScale()", () => {
    it("throws for invalid direction", async () => {
      await expect(svc.triggerManualScale({ direction: "unknown", service: "api" }))
        .rejects.toThrow("direction must be scale_out or scale_in");
    });

    it("throws if service is missing", async () => {
      await expect(svc.triggerManualScale({ direction: "scale_out" }))
        .rejects.toThrow("service is required");
    });

    it("creates a scaling event with in_progress status", async () => {
      const fakeEvent = { eventId: "SC-1", direction: "scale_out", status: "in_progress" };
      AutoScalingEvent.create.mockResolvedValue(fakeEvent);
      AutoScalingEvent.findOneAndUpdate.mockResolvedValue({});

      const result = await svc.triggerManualScale({ direction: "scale_out", service: "api", toReplicas: 3 });
      expect(result.status).toBe("in_progress");
      expect(AutoScalingEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({ direction: "scale_out", status: "in_progress" })
      );
    });

    it("increments scaleEvents stat", async () => {
      AutoScalingEvent.create.mockResolvedValue({ eventId: "SC-1" });
      AutoScalingEvent.findOneAndUpdate.mockResolvedValue({});

      await svc.triggerManualScale({ direction: "scale_in", service: "worker" });
      expect(svc._stats.scaleEvents).toBe(1);
    });

    it("publishes ops.scale.completed via setImmediate", async () => {
      AutoScalingEvent.create.mockResolvedValue({ eventId: "SC-2" });
      AutoScalingEvent.findOneAndUpdate.mockResolvedValue({});

      await svc.triggerManualScale({ direction: "scale_out", service: "api" });
      await new Promise((r) => setImmediate(r));
      expect(eventBus.publish).toHaveBeenCalledWith("ops.scale.completed", expect.any(Object));
    });
  });

  describe("getScalingEvents()", () => {
    it("returns paginated scaling events", async () => {
      const mockEvents = [{ eventId: "SC-1" }];
      AutoScalingEvent.find.mockReturnValue({
        sort: () => ({ skip: () => ({ limit: () => ({ lean: vi.fn().mockResolvedValue(mockEvents) }) }) }),
      });
      AutoScalingEvent.countDocuments.mockResolvedValue(1);

      const result = await svc.getScalingEvents();
      expect(result.events).toEqual(mockEvents);
      expect(result.total).toBe(1);
    });
  });

  // ── Incidents ─────────────────────────────────────────────────────────────

  describe("createIncident()", () => {
    it("throws if required fields missing", async () => {
      await expect(svc.createIncident({ title: "X" })).rejects.toThrow(
        "title, severity, and service required"
      );
    });

    it("throws for invalid severity", async () => {
      await expect(svc.createIncident({ title: "X", severity: "extreme", service: "api" }))
        .rejects.toThrow("Invalid severity");
    });

    it("creates incident with open status", async () => {
      const fakeIncident = { incidentId: "INC-1", status: "open", severity: "high" };
      OperationsIncident.create.mockResolvedValue(fakeIncident);

      const result = await svc.createIncident({
        title: "DB slowdown", severity: "high", service: "db",
      });
      expect(result.status).toBe("open");
      expect(OperationsIncident.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: "open", severity: "high" })
      );
    });

    it("increments incidentsOpened stat", async () => {
      OperationsIncident.create.mockResolvedValue({ incidentId: "INC-1" });
      await svc.createIncident({ title: "T", severity: "low", service: "api" });
      expect(svc._stats.incidentsOpened).toBe(1);
    });

    it("publishes ops.incident.opened event", async () => {
      OperationsIncident.create.mockResolvedValue({ incidentId: "INC-1" });
      await svc.createIncident({ title: "T", severity: "critical", service: "api" });
      expect(eventBus.publish).toHaveBeenCalledWith("ops.incident.opened", expect.objectContaining({ severity: "critical" }));
    });
  });

  describe("updateIncident()", () => {
    it("throws if incident not found", async () => {
      OperationsIncident.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
      await expect(svc.updateIncident("INC-missing", { status: "resolved" }))
        .rejects.toThrow("Incident not found");
    });

    it("throws for invalid status", async () => {
      await expect(svc.updateIncident("INC-1", { status: "invalid" }))
        .rejects.toThrow("Invalid status");
    });

    it("updates incident status and adds timeline entry", async () => {
      const inc = { incidentId: "INC-1", status: "open" };
      const updated = { ...inc, status: "investigating" };
      OperationsIncident.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(inc) });
      OperationsIncident.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(updated) });

      const result = await svc.updateIncident("INC-1", { status: "investigating", message: "Looking into it" });
      expect(OperationsIncident.findOneAndUpdate).toHaveBeenCalledWith(
        { incidentId: "INC-1" },
        expect.objectContaining({ $push: expect.any(Object) }),
        { new: true }
      );
    });

    it("sets resolvedAt when status is resolved", async () => {
      const inc = { incidentId: "INC-2", status: "mitigating" };
      OperationsIncident.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(inc) });
      OperationsIncident.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue({ ...inc, status: "resolved" }) });

      await svc.updateIncident("INC-2", { status: "resolved" });
      expect(OperationsIncident.findOneAndUpdate).toHaveBeenCalledWith(
        { incidentId: "INC-2" },
        expect.objectContaining({ resolvedAt: expect.any(Date) }),
        { new: true }
      );
    });
  });

  describe("getIncidents()", () => {
    it("returns paginated incidents", async () => {
      const mockIncidents = [{ incidentId: "INC-1" }];
      OperationsIncident.find.mockReturnValue({
        sort: () => ({ skip: () => ({ limit: () => ({ lean: vi.fn().mockResolvedValue(mockIncidents) }) }) }),
      });
      OperationsIncident.countDocuments.mockResolvedValue(1);

      const result = await svc.getIncidents({ status: "open" });
      expect(result.incidents).toEqual(mockIncidents);
      expect(result.total).toBe(1);
    });
  });

  // ── Deployments ───────────────────────────────────────────────────────────

  describe("recordDeployment()", () => {
    it("throws if required fields missing", async () => {
      await expect(svc.recordDeployment({ service: "api" })).rejects.toThrow(
        "service and version required"
      );
    });

    it("creates deployment with running status", async () => {
      const fakeDep = { deploymentId: "DEP-1", status: "running", version: "v2.0.0" };
      DeploymentRecord.create.mockResolvedValue(fakeDep);
      DeploymentRecord.findOneAndUpdate.mockResolvedValue({});

      const result = await svc.recordDeployment({ service: "api", version: "v2.0.0" });
      expect(result.status).toBe("running");
      expect(svc._stats.deploymentsRun).toBe(1);
    });

    it("marks deployment completed via setImmediate", async () => {
      DeploymentRecord.create.mockResolvedValue({ deploymentId: "DEP-2" });
      DeploymentRecord.findOneAndUpdate.mockResolvedValue({});

      await svc.recordDeployment({ service: "api", version: "v3.0.0" });
      await new Promise((r) => setImmediate(r));
      expect(DeploymentRecord.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ deploymentId: expect.stringContaining("DEP-") }),
        expect.objectContaining({ status: "completed" })
      );
    });
  });

  describe("rollbackDeployment()", () => {
    it("throws if deployment not found", async () => {
      DeploymentRecord.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
      await expect(svc.rollbackDeployment("DEP-missing")).rejects.toThrow("Deployment not found");
    });

    it("throws if no previous version", async () => {
      DeploymentRecord.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue({ deploymentId: "DEP-1", previousVersion: null }),
      });
      await expect(svc.rollbackDeployment("DEP-1")).rejects.toThrow("No previous version");
    });

    it("marks deployment as rolled_back and creates rollback record", async () => {
      const dep = { deploymentId: "DEP-1", service: "api", version: "v2.0.0", previousVersion: "v1.0.0" };
      DeploymentRecord.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(dep) });
      DeploymentRecord.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue({ ...dep, status: "rolled_back" }) });
      DeploymentRecord.create.mockResolvedValue({ deploymentId: "DEP-rollback-1", version: "v1.0.0" });

      const result = await svc.rollbackDeployment("DEP-1");
      expect(result.status).toBe("rolled_back");
      // A new rollback deployment record should be created
      expect(DeploymentRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({ version: "v1.0.0", type: "rollback" })
      );
    });
  });

  describe("getDeployments()", () => {
    it("returns paginated deployments", async () => {
      const mockDeps = [{ deploymentId: "DEP-1" }];
      DeploymentRecord.find.mockReturnValue({
        sort: () => ({ skip: () => ({ limit: () => ({ lean: vi.fn().mockResolvedValue(mockDeps) }) }) }),
      });
      DeploymentRecord.countDocuments.mockResolvedValue(1);

      const result = await svc.getDeployments();
      expect(result.deployments).toEqual(mockDeps);
      expect(result.total).toBe(1);
    });
  });

  // ── Critical health handler ───────────────────────────────────────────────

  describe("_onCriticalHealth()", () => {
    it("auto-creates a critical incident when critical health event fires", async () => {
      OperationsIncident.create.mockResolvedValue({ incidentId: "INC-auto-1" });
      await svc._onCriticalHealth({ nodeId: "node-primary", checkId: "HC-1" });
      expect(OperationsIncident.create).toHaveBeenCalledWith(
        expect.objectContaining({ severity: "critical", status: "open" })
      );
    });
  });

  // ── Statistics ────────────────────────────────────────────────────────────

  describe("getStatistics()", () => {
    it("returns aggregated statistics", async () => {
      AutoScalingEvent.countDocuments
        .mockResolvedValueOnce(20)   // total
        .mockResolvedValueOnce(12)   // scale_out
        .mockResolvedValueOnce(8);   // scale_in
      OperationsIncident.countDocuments
        .mockResolvedValueOnce(3)    // open
        .mockResolvedValueOnce(1)    // critical
        .mockResolvedValueOnce(5);   // resolved
      DeploymentRecord.countDocuments
        .mockResolvedValueOnce(15)   // total
        .mockResolvedValueOnce(14);  // completed

      const stats = await svc.getStatistics();
      expect(stats.scaling.total).toBe(20);
      expect(stats.incidents.open).toBe(3);
      expect(stats.deployments.completed).toBe(14);
    });
  });
});
