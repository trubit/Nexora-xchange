/**
 * Stage 34 — HADR API service tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { hadrApi } from "../../../services/api/hadr";

vi.mock("../../../api/client.js", () => ({
  requestWithRetry: vi.fn(),
}));

import { requestWithRetry } from "../../../api/client.js";

const ok = (data) => Promise.resolve({ data });

describe("hadrApi", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("statistics() calls GET /api/hadr/statistics", async () => {
    requestWithRetry.mockReturnValue(ok({ stats: {} }));
    await hadrApi.statistics();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/hadr/statistics" });
  });

  it("getHealthChecks() calls GET /api/hadr/health with empty params", async () => {
    requestWithRetry.mockReturnValue(ok({ checks: [], total: 0 }));
    await hadrApi.getHealthChecks();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/hadr/health", params: {} });
  });

  it("getHealthChecks() passes params correctly", async () => {
    requestWithRetry.mockReturnValue(ok({ checks: [], total: 0 }));
    await hadrApi.getHealthChecks({ nodeId: "node-a", status: "healthy" });
    expect(requestWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({ params: { nodeId: "node-a", status: "healthy" } })
    );
  });

  it("getFailoverEvents() calls GET /api/hadr/failover", async () => {
    requestWithRetry.mockReturnValue(ok({ events: [], total: 0 }));
    await hadrApi.getFailoverEvents();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/hadr/failover", params: {} });
  });

  it("triggerFailover() calls POST /api/hadr/failover with body", async () => {
    const body = { fromNode: "a", toNode: "b", reason: "test" };
    requestWithRetry.mockReturnValue(ok({ event: { eventId: "FO-1" } }));
    await hadrApi.triggerFailover(body);
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "post", url: "/api/hadr/failover", data: body,
    });
  });

  it("getBackups() calls GET /api/hadr/backups", async () => {
    requestWithRetry.mockReturnValue(ok({ snapshots: [], total: 0 }));
    await hadrApi.getBackups();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/hadr/backups", params: {} });
  });

  it("getBackups() passes type filter", async () => {
    requestWithRetry.mockReturnValue(ok({ snapshots: [], total: 0 }));
    await hadrApi.getBackups({ type: "full" });
    expect(requestWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({ params: { type: "full" } })
    );
  });

  it("triggerBackup() calls POST /api/hadr/backups/trigger", async () => {
    requestWithRetry.mockReturnValue(ok({ snapshot: { snapshotId: "BK-1" } }));
    await hadrApi.triggerBackup({ type: "full" });
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "post", url: "/api/hadr/backups/trigger", data: { type: "full" },
    });
  });

  it("getDrPlans() calls GET /api/hadr/dr-plans", async () => {
    requestWithRetry.mockReturnValue(ok({ plans: [], total: 0 }));
    await hadrApi.getDrPlans();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/hadr/dr-plans", params: {} });
  });

  it("createDrPlan() calls POST /api/hadr/dr-plans", async () => {
    const body = { name: "DR Plan A", scenario: "DB failure", rtoMinutes: 15, rpoMinutes: 5 };
    requestWithRetry.mockReturnValue(ok({ plan: { planId: "DRP-1" } }));
    await hadrApi.createDrPlan(body);
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "post", url: "/api/hadr/dr-plans", data: body,
    });
  });

  it("recordDrTest() calls POST /api/hadr/dr-plans/:planId/test", async () => {
    requestWithRetry.mockReturnValue(ok({ plan: {} }));
    await hadrApi.recordDrTest("DRP-1", { outcome: "pass", notes: "OK" });
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "post", url: "/api/hadr/dr-plans/DRP-1/test",
      data: { outcome: "pass", notes: "OK" },
    });
  });

  it("statistics() returns response data", async () => {
    const payload = { stats: { health: { total: 100 } } };
    requestWithRetry.mockReturnValue(ok(payload));
    const res = await hadrApi.statistics();
    expect(res.data).toEqual(payload);
  });

  it("triggerFailover() returns the created event", async () => {
    const payload = { event: { eventId: "FO-99", status: "in_progress" } };
    requestWithRetry.mockReturnValue(ok(payload));
    const res = await hadrApi.triggerFailover({ fromNode: "a", toNode: "b", reason: "test" });
    expect(res.data.event.eventId).toBe("FO-99");
  });

  it("triggerBackup() returns the created snapshot", async () => {
    const payload = { snapshot: { snapshotId: "BK-99", type: "full" } };
    requestWithRetry.mockReturnValue(ok(payload));
    const res = await hadrApi.triggerBackup({ type: "full" });
    expect(res.data.snapshot.type).toBe("full");
  });

  it("createDrPlan() returns the created plan", async () => {
    const payload = { plan: { planId: "DRP-99", rtoMinutes: 30 } };
    requestWithRetry.mockReturnValue(ok(payload));
    const res = await hadrApi.createDrPlan({ name: "P", scenario: "S", rtoMinutes: 30, rpoMinutes: 10 });
    expect(res.data.plan.rtoMinutes).toBe(30);
  });

  it("getDrPlans() passes status filter", async () => {
    requestWithRetry.mockReturnValue(ok({ plans: [], total: 0 }));
    await hadrApi.getDrPlans({ status: "active" });
    expect(requestWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({ params: { status: "active" } })
    );
  });
});
