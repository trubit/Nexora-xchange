/**
 * Stage 35 — Autonomous Ops API service tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { autonomousOpsApi } from "../../../services/api/autonomousOps";

vi.mock("../../../api/client.js", () => ({
  requestWithRetry: vi.fn(),
}));

import { requestWithRetry } from "../../../api/client.js";

const ok = (data) => Promise.resolve({ data });

describe("autonomousOpsApi", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("statistics() calls GET /api/autonomous-ops/statistics", async () => {
    requestWithRetry.mockReturnValue(ok({ stats: {} }));
    await autonomousOpsApi.statistics();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/autonomous-ops/statistics" });
  });

  it("getScalingEvents() calls GET /api/autonomous-ops/scaling with empty params", async () => {
    requestWithRetry.mockReturnValue(ok({ events: [], total: 0 }));
    await autonomousOpsApi.getScalingEvents();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/autonomous-ops/scaling", params: {} });
  });

  it("getScalingEvents() passes direction filter", async () => {
    requestWithRetry.mockReturnValue(ok({ events: [], total: 0 }));
    await autonomousOpsApi.getScalingEvents({ direction: "scale_out" });
    expect(requestWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({ params: { direction: "scale_out" } })
    );
  });

  it("triggerScale() calls POST /api/autonomous-ops/scaling/trigger", async () => {
    const body = { direction: "scale_out", service: "api", toReplicas: 3 };
    requestWithRetry.mockReturnValue(ok({ event: { eventId: "SC-1" } }));
    await autonomousOpsApi.triggerScale(body);
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "post", url: "/api/autonomous-ops/scaling/trigger", data: body,
    });
  });

  it("getIncidents() calls GET /api/autonomous-ops/incidents", async () => {
    requestWithRetry.mockReturnValue(ok({ incidents: [], total: 0 }));
    await autonomousOpsApi.getIncidents();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/autonomous-ops/incidents", params: {} });
  });

  it("getIncidents() passes status and severity filters", async () => {
    requestWithRetry.mockReturnValue(ok({ incidents: [], total: 0 }));
    await autonomousOpsApi.getIncidents({ status: "open", severity: "critical" });
    expect(requestWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({ params: { status: "open", severity: "critical" } })
    );
  });

  it("createIncident() calls POST /api/autonomous-ops/incidents", async () => {
    const body = { title: "DB slow", severity: "high", service: "db" };
    requestWithRetry.mockReturnValue(ok({ incident: { incidentId: "INC-1" } }));
    await autonomousOpsApi.createIncident(body);
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "post", url: "/api/autonomous-ops/incidents", data: body,
    });
  });

  it("updateIncident() calls PATCH /api/autonomous-ops/incidents/:id", async () => {
    requestWithRetry.mockReturnValue(ok({ incident: {} }));
    await autonomousOpsApi.updateIncident("INC-1", { status: "resolved" });
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "patch", url: "/api/autonomous-ops/incidents/INC-1", data: { status: "resolved" },
    });
  });

  it("getDeployments() calls GET /api/autonomous-ops/deployments", async () => {
    requestWithRetry.mockReturnValue(ok({ deployments: [], total: 0 }));
    await autonomousOpsApi.getDeployments();
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "get", url: "/api/autonomous-ops/deployments", params: {},
    });
  });

  it("getDeployments() passes service filter", async () => {
    requestWithRetry.mockReturnValue(ok({ deployments: [], total: 0 }));
    await autonomousOpsApi.getDeployments({ service: "api" });
    expect(requestWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({ params: { service: "api" } })
    );
  });

  it("recordDeployment() calls POST /api/autonomous-ops/deployments", async () => {
    const body = { service: "api", version: "v2.0.0", type: "rolling" };
    requestWithRetry.mockReturnValue(ok({ deployment: { deploymentId: "DEP-1" } }));
    await autonomousOpsApi.recordDeployment(body);
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "post", url: "/api/autonomous-ops/deployments", data: body,
    });
  });

  it("rollback() calls POST /api/autonomous-ops/deployments/:id/rollback", async () => {
    requestWithRetry.mockReturnValue(ok({ deployment: {} }));
    await autonomousOpsApi.rollback("DEP-1");
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "post", url: "/api/autonomous-ops/deployments/DEP-1/rollback",
    });
  });

  it("statistics() returns the response data", async () => {
    const payload = { stats: { scaling: { total: 20 } } };
    requestWithRetry.mockReturnValue(ok(payload));
    const res = await autonomousOpsApi.statistics();
    expect(res.data).toEqual(payload);
  });

  it("createIncident() returns the created incident", async () => {
    const payload = { incident: { incidentId: "INC-99", severity: "critical" } };
    requestWithRetry.mockReturnValue(ok(payload));
    const res = await autonomousOpsApi.createIncident({ title: "X", severity: "critical", service: "api" });
    expect(res.data.incident.severity).toBe("critical");
  });

  it("triggerScale() returns the created event", async () => {
    const payload = { event: { eventId: "SC-99", direction: "scale_out" } };
    requestWithRetry.mockReturnValue(ok(payload));
    const res = await autonomousOpsApi.triggerScale({ direction: "scale_out", service: "api" });
    expect(res.data.event.direction).toBe("scale_out");
  });
});
