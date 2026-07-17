import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("../../../api/client.js", () => ({ requestWithRetry: vi.fn() }));

import { requestWithRetry } from "../../../api/client.js";
import { clearingApi }      from "../../../services/api/clearing.js";

beforeEach(() => vi.clearAllMocks());

const OK = { data: {} };

describe("clearingApi.settlements", () => {
  test("calls GET /api/clearing/settlements with no params by default", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: { records: [] } });
    await clearingApi.settlements();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/clearing/settlements", params: {} });
  });

  test("forwards status filter", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: [] });
    await clearingApi.settlements({ status: "settled" });
    const call = vi.mocked(requestWithRetry).mock.calls[0][0];
    expect(call.params.status).toBe("settled");
  });

  test("forwards pagination params", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: [] });
    await clearingApi.settlements({ page: 2, limit: 20 });
    const call = vi.mocked(requestWithRetry).mock.calls[0][0];
    expect(call.params.page).toBe(2);
    expect(call.params.limit).toBe(20);
  });

  test("propagates rejection", async () => {
    vi.mocked(requestWithRetry).mockRejectedValue(new Error("403 Forbidden"));
    await expect(clearingApi.settlements()).rejects.toThrow("403 Forbidden");
  });
});

describe("clearingApi.settlementById", () => {
  test("calls GET /api/clearing/settlements/:id", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: { record: {} } });
    await clearingApi.settlementById("CLR-001");
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/clearing/settlements/CLR-001" });
  });

  test("interpolates id into URL", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await clearingApi.settlementById("CLR-XYZ");
    expect(vi.mocked(requestWithRetry).mock.calls[0][0].url).toBe("/api/clearing/settlements/CLR-XYZ");
  });

  test("propagates 404 rejection", async () => {
    vi.mocked(requestWithRetry).mockRejectedValue(new Error("404 Not Found"));
    await expect(clearingApi.settlementById("BAD")).rejects.toThrow("404");
  });
});

describe("clearingApi.history", () => {
  test("calls GET /api/clearing/history with no params by default", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: [] });
    await clearingApi.history();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/clearing/history", params: {} });
  });

  test("forwards page param", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: [] });
    await clearingApi.history({ page: 3 });
    expect(vi.mocked(requestWithRetry).mock.calls[0][0].params.page).toBe(3);
  });
});

describe("clearingApi.statistics", () => {
  test("calls GET /api/clearing/statistics", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: { stats: {} } });
    await clearingApi.statistics();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/clearing/statistics" });
  });

  test("returns stats payload", async () => {
    const payload = { data: { stats: { total: 100, settled: 90 } } };
    vi.mocked(requestWithRetry).mockResolvedValue(payload);
    expect(await clearingApi.statistics()).toEqual(payload);
  });

  test("propagates network error", async () => {
    vi.mocked(requestWithRetry).mockRejectedValue(new Error("timeout"));
    await expect(clearingApi.statistics()).rejects.toThrow("timeout");
  });
});

describe("clearingApi.batches", () => {
  test("calls GET /api/clearing/batches with no params by default", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: { batches: [] } });
    await clearingApi.batches();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/clearing/batches", params: {} });
  });

  test("forwards status filter", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await clearingApi.batches({ status: "completed" });
    expect(vi.mocked(requestWithRetry).mock.calls[0][0].params.status).toBe("completed");
  });
});

describe("clearingApi.auditLogs", () => {
  test("calls GET /api/clearing/audit with no params by default", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: { logs: [] } });
    await clearingApi.auditLogs();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/clearing/audit", params: {} });
  });

  test("forwards eventType filter", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await clearingApi.auditLogs({ eventType: "TRADE_CLEARED" });
    expect(vi.mocked(requestWithRetry).mock.calls[0][0].params.eventType).toBe("TRADE_CLEARED");
  });

  test("forwards clearingId filter", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await clearingApi.auditLogs({ clearingId: "CLR-001" });
    expect(vi.mocked(requestWithRetry).mock.calls[0][0].params.clearingId).toBe("CLR-001");
  });
});

describe("clearingApi.reconcile", () => {
  test("calls POST /api/clearing/reconcile with body", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    const body = { fromDate: "2024-01-01", toDate: "2024-01-31" };
    await clearingApi.reconcile(body);
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "post", url: "/api/clearing/reconcile", data: body });
  });

  test("uses POST method", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await clearingApi.reconcile({});
    expect(vi.mocked(requestWithRetry).mock.calls[0][0].method).toBe("post");
  });

  test("propagates reconciliation failure", async () => {
    vi.mocked(requestWithRetry).mockRejectedValue(new Error("Reconciliation already running"));
    await expect(clearingApi.reconcile({})).rejects.toThrow("Reconciliation already running");
  });
});

describe("clearingApi.retry", () => {
  test("calls POST /api/clearing/retry/:id", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await clearingApi.retry("CLR-001");
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "post", url: "/api/clearing/retry/CLR-001" });
  });

  test("interpolates id into URL", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await clearingApi.retry("CLR-XYZ");
    expect(vi.mocked(requestWithRetry).mock.calls[0][0].url).toBe("/api/clearing/retry/CLR-XYZ");
  });

  test("propagates max-retry error", async () => {
    vi.mocked(requestWithRetry).mockRejectedValue(new Error("Max retries exceeded"));
    await expect(clearingApi.retry("CLR-001")).rejects.toThrow("Max retries");
  });
});
