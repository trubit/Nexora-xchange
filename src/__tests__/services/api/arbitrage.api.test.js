import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("../../../api/client.js", () => ({ requestWithRetry: vi.fn() }));

import { requestWithRetry } from "../../../api/client.js";
import { arbitrageApi }     from "../../../services/api/arbitrage.js";

beforeEach(() => vi.clearAllMocks());

describe("arbitrageApi.live", () => {
  test("calls GET /api/arbitrage/live with no params by default", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: [] });
    await arbitrageApi.live();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/arbitrage/live", params: {} });
  });

  test("forwards query params", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: [] });
    await arbitrageApi.live({ pair: "BTC-USD" });
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/arbitrage/live", params: { pair: "BTC-USD" } });
  });

  test("returns the resolved value from requestWithRetry", async () => {
    const payload = { data: [{ type: "triangular", spreadPct: 1.5 }] };
    vi.mocked(requestWithRetry).mockResolvedValue(payload);
    const result = await arbitrageApi.live();
    expect(result).toEqual(payload);
  });

  test("propagates rejection from requestWithRetry", async () => {
    vi.mocked(requestWithRetry).mockRejectedValue(new Error("Network error"));
    await expect(arbitrageApi.live()).rejects.toThrow("Network error");
  });
});

describe("arbitrageApi.history", () => {
  test("calls GET /api/arbitrage/history with no params by default", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: [] });
    await arbitrageApi.history();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/arbitrage/history", params: {} });
  });

  test("forwards query params", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: [] });
    await arbitrageApi.history({ limit: 50 });
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/arbitrage/history", params: { limit: 50 } });
  });
});

describe("arbitrageApi.snapshot", () => {
  test("calls GET /api/arbitrage/snapshot", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: {} });
    await arbitrageApi.snapshot();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/arbitrage/snapshot" });
  });
});

describe("arbitrageApi.exchanges", () => {
  test("calls GET /api/arbitrage/exchanges", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: ["binance"] });
    await arbitrageApi.exchanges();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/arbitrage/exchanges" });
  });
});

describe("arbitrageApi.symbols", () => {
  test("calls GET /api/arbitrage/symbols", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: ["BTC-USD"] });
    await arbitrageApi.symbols();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/arbitrage/symbols" });
  });
});

describe("arbitrageApi.stats", () => {
  test("calls GET /api/arbitrage/admin/stats", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: { total: 5 } });
    await arbitrageApi.stats();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/arbitrage/admin/stats" });
  });
});

describe("arbitrageApi.simulate", () => {
  test("calls POST /api/arbitrage/simulate with body", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: { profit: 42 } });
    const body = { pair: "BTC-USD", amount: 1000 };
    await arbitrageApi.simulate(body);
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "post", url: "/api/arbitrage/simulate", data: body });
  });

  test("propagates rejection for a failed simulate call", async () => {
    vi.mocked(requestWithRetry).mockRejectedValue(new Error("Bad request"));
    await expect(arbitrageApi.simulate({})).rejects.toThrow("Bad request");
  });
});
