/**
 * Stage 33 — Regulatory Compliance API service tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { regulatoryComplianceApi } from "../../../services/api/regulatoryCompliance";

vi.mock("../../../api/client.js", () => ({
  requestWithRetry: vi.fn(),
}));

import { requestWithRetry } from "../../../api/client.js";

const ok = (data) => Promise.resolve({ data });

describe("regulatoryComplianceApi", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // Statistics
  it("statistics() calls GET /api/reg-compliance/statistics", async () => {
    requestWithRetry.mockReturnValue(ok({ stats: { sanctions: { total: 5 } } }));
    const res = await regulatoryComplianceApi.statistics();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/reg-compliance/statistics" });
    expect(res.data.stats.sanctions.total).toBe(5);
  });

  // Sanctions
  it("getSanctionHits() calls GET /api/reg-compliance/sanctions", async () => {
    requestWithRetry.mockReturnValue(ok({ hits: [], total: 0 }));
    await regulatoryComplianceApi.getSanctionHits({ status: "pending_review" });
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "get", url: "/api/reg-compliance/sanctions", params: { status: "pending_review" },
    });
  });

  it("getSanctionHits() passes empty params by default", async () => {
    requestWithRetry.mockReturnValue(ok({ hits: [], total: 0 }));
    await regulatoryComplianceApi.getSanctionHits();
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "get", url: "/api/reg-compliance/sanctions", params: {},
    });
  });

  it("screenEntity() calls POST /api/reg-compliance/sanctions/screen", async () => {
    requestWithRetry.mockReturnValue(ok({ hits: [] }));
    await regulatoryComplianceApi.screenEntity({ name: "John Doe" });
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "post", url: "/api/reg-compliance/sanctions/screen", data: { name: "John Doe" },
    });
  });

  it("screenEntity() sends address in body", async () => {
    requestWithRetry.mockReturnValue(ok({ hits: [] }));
    await regulatoryComplianceApi.screenEntity({ address: "0x0000abc" });
    expect(requestWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({ data: { address: "0x0000abc" } })
    );
  });

  it("reviewSanctionHit() calls PATCH /api/reg-compliance/sanctions/:hitId", async () => {
    requestWithRetry.mockReturnValue(ok({ hit: {} }));
    await regulatoryComplianceApi.reviewSanctionHit("SHT-1", { status: "false_positive" });
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "patch", url: "/api/reg-compliance/sanctions/SHT-1",
      data: { status: "false_positive" },
    });
  });

  // Travel Rule
  it("getTravelRuleRecords() calls GET /api/reg-compliance/travel-rule", async () => {
    requestWithRetry.mockReturnValue(ok({ records: [], total: 0 }));
    await regulatoryComplianceApi.getTravelRuleRecords();
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "get", url: "/api/reg-compliance/travel-rule", params: {},
    });
  });

  it("getTravelRuleRecords() passes status filter", async () => {
    requestWithRetry.mockReturnValue(ok({ records: [], total: 0 }));
    await regulatoryComplianceApi.getTravelRuleRecords({ status: "sent" });
    expect(requestWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({ params: { status: "sent" } })
    );
  });

  it("createTravelRuleRecord() calls POST /api/reg-compliance/travel-rule", async () => {
    const body = { transactionId: "TX-1", asset: "BTC", amount: 1, amountUsd: 50000 };
    requestWithRetry.mockReturnValue(ok({ record: { recordId: "TR-1" } }));
    await regulatoryComplianceApi.createTravelRuleRecord(body);
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "post", url: "/api/reg-compliance/travel-rule", data: body,
    });
  });

  // SARs
  it("getSars() calls GET /api/reg-compliance/sar", async () => {
    requestWithRetry.mockReturnValue(ok({ sars: [], total: 0 }));
    await regulatoryComplianceApi.getSars();
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "get", url: "/api/reg-compliance/sar", params: {},
    });
  });

  it("getSars() passes status and userId filters", async () => {
    requestWithRetry.mockReturnValue(ok({ sars: [], total: 0 }));
    await regulatoryComplianceApi.getSars({ status: "draft", userId: "user1" });
    expect(requestWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({ params: { status: "draft", userId: "user1" } })
    );
  });

  it("createSar() calls POST /api/reg-compliance/sar", async () => {
    const body = { activityType: "STRUCTURING", description: "Suspicious", periodStart: "2024-01-01", periodEnd: "2024-01-31" };
    requestWithRetry.mockReturnValue(ok({ sar: { sarId: "SAR-1" } }));
    await regulatoryComplianceApi.createSar(body);
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "post", url: "/api/reg-compliance/sar", data: body,
    });
  });

  it("submitSar() calls POST /api/reg-compliance/sar/:sarId/submit", async () => {
    requestWithRetry.mockReturnValue(ok({ sar: { sarId: "SAR-1", status: "filed" } }));
    await regulatoryComplianceApi.submitSar("SAR-1", { filedWith: "FinCEN" });
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "post", url: "/api/reg-compliance/sar/SAR-1/submit",
      data: { filedWith: "FinCEN" },
    });
  });

  it("submitSar() sends empty body by default", async () => {
    requestWithRetry.mockReturnValue(ok({ sar: {} }));
    await regulatoryComplianceApi.submitSar("SAR-2");
    expect(requestWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({ data: {} })
    );
  });

  // Reports
  it("getReports() calls GET /api/reg-compliance/reports", async () => {
    requestWithRetry.mockReturnValue(ok({ reports: [], total: 0 }));
    await regulatoryComplianceApi.getReports();
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "get", url: "/api/reg-compliance/reports", params: {},
    });
  });

  it("getReports() passes type filter", async () => {
    requestWithRetry.mockReturnValue(ok({ reports: [], total: 0 }));
    await regulatoryComplianceApi.getReports({ type: "MONTHLY" });
    expect(requestWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({ params: { type: "MONTHLY" } })
    );
  });

  it("generateReport() calls POST /api/reg-compliance/reports/generate", async () => {
    const body = { type: "DAILY", periodStart: "2024-01-01", periodEnd: "2024-01-31" };
    requestWithRetry.mockReturnValue(ok({ report: { reportId: "RPT-1" } }));
    await regulatoryComplianceApi.generateReport(body);
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "post", url: "/api/reg-compliance/reports/generate", data: body,
    });
  });

  // Return value propagation
  it("statistics() returns the axios response", async () => {
    const payload = { stats: { sanctions: { total: 10 } } };
    requestWithRetry.mockReturnValue(ok(payload));
    const result = await regulatoryComplianceApi.statistics();
    expect(result.data).toEqual(payload);
  });

  it("createSar() returns the created SAR", async () => {
    const sarPayload = { sar: { sarId: "SAR-99", status: "draft" } };
    requestWithRetry.mockReturnValue(ok(sarPayload));
    const result = await regulatoryComplianceApi.createSar({ activityType: "OTHER", description: "x", periodStart: "2024-01-01", periodEnd: "2024-01-31" });
    expect(result.data.sar.sarId).toBe("SAR-99");
  });

  it("screenEntity() returns hits array", async () => {
    const payload = { hits: [{ hitId: "SHT-1" }] };
    requestWithRetry.mockReturnValue(ok(payload));
    const result = await regulatoryComplianceApi.screenEntity({ name: "test" });
    expect(result.data.hits).toHaveLength(1);
  });
});
