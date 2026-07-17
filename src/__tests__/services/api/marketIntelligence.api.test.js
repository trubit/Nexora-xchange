import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("../../../api/client.js", () => ({ requestWithRetry: vi.fn() }));

import { requestWithRetry }        from "../../../api/client.js";
import { marketIntelligenceApi }   from "../../../services/api/marketIntelligence.js";

beforeEach(() => vi.clearAllMocks());

const OK = { data: [] };

describe("marketIntelligenceApi.signals", () => {
  test("calls GET /api/market-intelligence/signals with no params by default", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await marketIntelligenceApi.signals();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/market-intelligence/signals", params: {} });
  });

  test("forwards severity filter param", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await marketIntelligenceApi.signals({ severity: "CRITICAL" });
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "get",
      url: "/api/market-intelligence/signals",
      params: { severity: "CRITICAL" },
    });
  });

  test("returns signal list", async () => {
    const payload = { data: [{ type: "ANOMALY", severity: "HIGH" }] };
    vi.mocked(requestWithRetry).mockResolvedValue(payload);
    expect(await marketIntelligenceApi.signals()).toEqual(payload);
  });

  test("propagates network rejection", async () => {
    vi.mocked(requestWithRetry).mockRejectedValue(new Error("503"));
    await expect(marketIntelligenceApi.signals()).rejects.toThrow("503");
  });
});

describe("marketIntelligenceApi.whaleActivity", () => {
  test("calls GET /api/market-intelligence/whale-activity with no params by default", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await marketIntelligenceApi.whaleActivity();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/market-intelligence/whale-activity", params: {} });
  });

  test("forwards pair filter", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await marketIntelligenceApi.whaleActivity({ pair: "BTC-USD" });
    const call = vi.mocked(requestWithRetry).mock.calls[0][0];
    expect(call.params).toEqual({ pair: "BTC-USD" });
  });
});

describe("marketIntelligenceApi.stats", () => {
  test("calls GET /api/market-intelligence/stats", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: { running: true } });
    await marketIntelligenceApi.stats();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/market-intelligence/stats" });
  });

  test("returns stats object", async () => {
    const payload = { data: { scans: 42, trackedPairs: 10 } };
    vi.mocked(requestWithRetry).mockResolvedValue(payload);
    expect(await marketIntelligenceApi.stats()).toEqual(payload);
  });
});
