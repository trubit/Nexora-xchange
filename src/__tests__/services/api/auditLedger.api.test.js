import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("../../../api/client.js", () => ({ requestWithRetry: vi.fn() }));

import { requestWithRetry } from "../../../api/client.js";
import { auditLedgerApi }   from "../../../services/api/auditLedger.js";

beforeEach(() => vi.clearAllMocks());

const OK = { data: {} };

describe("auditLedgerApi.stats", () => {
  test("calls GET /api/audit-ledger/stats", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await auditLedgerApi.stats();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/audit-ledger/stats" });
  });

  test("returns stats object", async () => {
    const payload = { data: { total: 100, lastEntryId: 100 } };
    vi.mocked(requestWithRetry).mockResolvedValue(payload);
    expect(await auditLedgerApi.stats()).toEqual(payload);
  });

  test("propagates rejection", async () => {
    vi.mocked(requestWithRetry).mockRejectedValue(new Error("403 Forbidden"));
    await expect(auditLedgerApi.stats()).rejects.toThrow("403 Forbidden");
  });
});

describe("auditLedgerApi.entries", () => {
  test("calls GET /api/audit-ledger/entries with no params by default", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: [] });
    await auditLedgerApi.entries();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/audit-ledger/entries", params: {} });
  });

  test("forwards pagination and type filter params", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: [] });
    await auditLedgerApi.entries({ page: 2, type: "DEPOSIT" });
    const call = vi.mocked(requestWithRetry).mock.calls[0][0];
    expect(call.params).toEqual({ page: 2, type: "DEPOSIT" });
  });
});

describe("auditLedgerApi.verifyChain", () => {
  test("calls GET /api/audit-ledger/verify-chain with no params by default", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: { valid: true } });
    await auditLedgerApi.verifyChain();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/audit-ledger/verify-chain", params: {} });
  });

  test("returns chain validity result", async () => {
    const payload = { data: { valid: true, checkedCount: 50 } };
    vi.mocked(requestWithRetry).mockResolvedValue(payload);
    expect(await auditLedgerApi.verifyChain()).toEqual(payload);
  });
});

describe("auditLedgerApi.reports", () => {
  test("calls GET /api/audit-ledger/reports with no params by default", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: [] });
    await auditLedgerApi.reports();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/audit-ledger/reports", params: {} });
  });

  test("forwards filter params", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: [] });
    await auditLedgerApi.reports({ status: "finalized" });
    const call = vi.mocked(requestWithRetry).mock.calls[0][0];
    expect(call.params.status).toBe("finalized");
  });
});

describe("auditLedgerApi.reconciliation", () => {
  test("calls GET /api/audit-ledger/reconciliation with no params by default", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: [] });
    await auditLedgerApi.reconciliation();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/audit-ledger/reconciliation", params: {} });
  });
});

describe("auditLedgerApi.runReconciliation", () => {
  test("calls POST /api/audit-ledger/reconciliation/run with body", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    const body = { type: "SPOT" };
    await auditLedgerApi.runReconciliation(body);
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "post",
      url: "/api/audit-ledger/reconciliation/run",
      data: body,
    });
  });

  test("uses POST method (not GET)", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await auditLedgerApi.runReconciliation({ type: "SPOT" });
    const call = vi.mocked(requestWithRetry).mock.calls[0][0];
    expect(call.method).toBe("post");
  });

  test("propagates rejection on run failure", async () => {
    vi.mocked(requestWithRetry).mockRejectedValue(new Error("Reconciliation already running"));
    await expect(auditLedgerApi.runReconciliation({ type: "SPOT" })).rejects.toThrow("Reconciliation already running");
  });
});

describe("auditLedgerApi.generateReport", () => {
  test("calls POST /api/audit-ledger/reports with body", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    const body = { type: "ON_DEMAND", periodStart: "2024-01-01", periodEnd: "2024-01-31" };
    await auditLedgerApi.generateReport(body);
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "post",
      url: "/api/audit-ledger/reports",
      data: body,
    });
  });

  test("uses POST method (not GET)", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await auditLedgerApi.generateReport({ type: "ON_DEMAND" });
    const call = vi.mocked(requestWithRetry).mock.calls[0][0];
    expect(call.method).toBe("post");
  });

  test("returns the generated report", async () => {
    const payload = { data: { reportId: "RPT-001", status: "finalized" } };
    vi.mocked(requestWithRetry).mockResolvedValue(payload);
    expect(await auditLedgerApi.generateReport({ type: "ON_DEMAND" })).toEqual(payload);
  });
});
