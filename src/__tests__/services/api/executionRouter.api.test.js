import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("../../../api/client.js", () => ({ requestWithRetry: vi.fn() }));

import { requestWithRetry }  from "../../../api/client.js";
import { executionRouterApi } from "../../../services/api/executionRouter.js";

beforeEach(() => vi.clearAllMocks());

const OK = { data: {} };

describe("executionRouterApi.stats", () => {
  test("calls GET /api/execution-router/stats", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await executionRouterApi.stats();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/execution-router/stats" });
  });

  test("returns stats", async () => {
    const payload = { data: { totalRoutes: 10, completed: 8 } };
    vi.mocked(requestWithRetry).mockResolvedValue(payload);
    expect(await executionRouterApi.stats()).toEqual(payload);
  });

  test("propagates rejection", async () => {
    vi.mocked(requestWithRetry).mockRejectedValue(new Error("timeout"));
    await expect(executionRouterApi.stats()).rejects.toThrow("timeout");
  });
});

describe("executionRouterApi.latency", () => {
  test("calls GET /api/execution-router/latency", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await executionRouterApi.latency();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/execution-router/latency" });
  });

  test("returns latency map", async () => {
    const payload = { data: { binance: { avg: 42, samples: 100 } } };
    vi.mocked(requestWithRetry).mockResolvedValue(payload);
    expect(await executionRouterApi.latency()).toEqual(payload);
  });
});

describe("executionRouterApi.history", () => {
  test("calls GET /api/execution-router/history with no params by default", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: [] });
    await executionRouterApi.history();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/execution-router/history", params: {} });
  });

  test("forwards pagination params", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: [] });
    await executionRouterApi.history({ page: 1, limit: 20 });
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "get",
      url: "/api/execution-router/history",
      params: { page: 1, limit: 20 },
    });
  });

  test("forwards strategy filter", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: [] });
    await executionRouterApi.history({ strategy: "twap" });
    const call = vi.mocked(requestWithRetry).mock.calls[0][0];
    expect(call.params.strategy).toBe("twap");
  });
});
