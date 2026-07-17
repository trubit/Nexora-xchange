/**
 * Stage 36 — Global Financial Ecosystem Platform
 * Tests: globalEcosystemApi (frontend API service)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { globalEcosystemApi } from "../../../services/api/globalEcosystem.js";

vi.mock("../../../api/client.js", () => ({
  requestWithRetry: vi.fn(),
}));

import { requestWithRetry } from "../../../api/client.js";

describe("globalEcosystemApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestWithRetry.mockResolvedValue({ data: {} });
  });

  it("statistics() → GET /api/ecosystem/statistics", async () => {
    await globalEcosystemApi.statistics();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/ecosystem/statistics" });
  });

  it("getPartners() → GET /api/ecosystem/partners (no params)", async () => {
    await globalEcosystemApi.getPartners();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/ecosystem/partners", params: {} });
  });

  it("getPartners({ type: 'exchange' }) → includes params", async () => {
    await globalEcosystemApi.getPartners({ type: "exchange" });
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "get",
      url: "/api/ecosystem/partners",
      params: { type: "exchange" },
    });
  });

  it("onboardPartner(body) → POST /api/ecosystem/partners", async () => {
    const body = { name: "Binance", type: "exchange" };
    await globalEcosystemApi.onboardPartner(body);
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "post", url: "/api/ecosystem/partners", data: body });
  });

  it("activatePartner(id) → PATCH /api/ecosystem/partners/:id/activate", async () => {
    await globalEcosystemApi.activatePartner("PRT-123");
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "patch",
      url: "/api/ecosystem/partners/PRT-123/activate",
    });
  });

  it("ratePartner(id, score) → PATCH /api/ecosystem/partners/:id/rating", async () => {
    await globalEcosystemApi.ratePartner("PRT-456", 90);
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "patch",
      url: "/api/ecosystem/partners/PRT-456/rating",
      data: { score: 90 },
    });
  });

  it("getPayments() → GET /api/ecosystem/payments (no params)", async () => {
    await globalEcosystemApi.getPayments();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/ecosystem/payments", params: {} });
  });

  it("getPayments({ status: 'completed' }) → includes params", async () => {
    await globalEcosystemApi.getPayments({ status: "completed" });
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "get",
      url: "/api/ecosystem/payments",
      params: { status: "completed" },
    });
  });

  it("initiatePayment(body) → POST /api/ecosystem/payments", async () => {
    const body = { sourceCurrency: "USD", targetCurrency: "EUR", sourceAmount: 500 };
    await globalEcosystemApi.initiatePayment(body);
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "post", url: "/api/ecosystem/payments", data: body });
  });

  it("getIntegrations() → GET /api/ecosystem/integrations (no params)", async () => {
    await globalEcosystemApi.getIntegrations();
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "get",
      url: "/api/ecosystem/integrations",
      params: {},
    });
  });

  it("getIntegrations({ partnerId: 'PRT-1' }) → includes params", async () => {
    await globalEcosystemApi.getIntegrations({ partnerId: "PRT-1" });
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "get",
      url: "/api/ecosystem/integrations",
      params: { partnerId: "PRT-1" },
    });
  });

  it("createIntegration(body) → POST /api/ecosystem/integrations", async () => {
    const body = { partnerId: "PRT-1", type: "webhook", direction: "outbound" };
    await globalEcosystemApi.createIntegration(body);
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "post", url: "/api/ecosystem/integrations", data: body });
  });

  it("recordCall(id, body) → POST /api/ecosystem/integrations/:id/call", async () => {
    const body = { success: true };
    await globalEcosystemApi.recordCall("INT-99", body);
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "post",
      url: "/api/ecosystem/integrations/INT-99/call",
      data: body,
    });
  });

  it("returns resolved value from requestWithRetry", async () => {
    requestWithRetry.mockResolvedValue({ data: { partners: [] } });
    const result = await globalEcosystemApi.getPartners();
    expect(result).toEqual({ data: { partners: [] } });
  });

  it("propagates rejection from requestWithRetry", async () => {
    requestWithRetry.mockRejectedValue(new Error("Network error"));
    await expect(globalEcosystemApi.statistics()).rejects.toThrow("Network error");
  });
});
