import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("../../../api/client.js", () => ({ requestWithRetry: vi.fn() }));

import { requestWithRetry } from "../../../api/client.js";
import { creditRiskApi }    from "../../../services/api/creditRisk.js";

beforeEach(() => vi.clearAllMocks());

const OK = { data: {} };

describe("creditRiskApi.summary", () => {
  test("calls GET /api/credit-risk/my/summary", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await creditRiskApi.summary();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/credit-risk/my/summary" });
  });

  test("returns response data", async () => {
    const payload = { data: { creditScore: 780 } };
    vi.mocked(requestWithRetry).mockResolvedValue(payload);
    expect(await creditRiskApi.summary()).toEqual(payload);
  });

  test("propagates network error", async () => {
    vi.mocked(requestWithRetry).mockRejectedValue(new Error("timeout"));
    await expect(creditRiskApi.summary()).rejects.toThrow("timeout");
  });
});

describe("creditRiskApi.credit", () => {
  test("calls GET /api/credit-risk/my/credit", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await creditRiskApi.credit();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/credit-risk/my/credit" });
  });
});

describe("creditRiskApi.behavior", () => {
  test("calls GET /api/credit-risk/my/behavior", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await creditRiskApi.behavior();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/credit-risk/my/behavior" });
  });
});

describe("creditRiskApi.exposure", () => {
  test("calls GET /api/credit-risk/my/exposure", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await creditRiskApi.exposure();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/credit-risk/my/exposure" });
  });
});

describe("creditRiskApi.heatmap", () => {
  test("calls GET /api/credit-risk/my/heatmap", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await creditRiskApi.heatmap();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/credit-risk/my/heatmap" });
  });
});

describe("creditRiskApi.history", () => {
  test("calls GET /api/credit-risk/my/history", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await creditRiskApi.history();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/credit-risk/my/history" });
  });
});

describe("creditRiskApi.liquidity", () => {
  test("calls GET /api/credit-risk/liquidity", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await creditRiskApi.liquidity();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/credit-risk/liquidity" });
  });
});
