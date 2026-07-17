import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("../../../api/client.js", () => ({ requestWithRetry: vi.fn() }));

import { requestWithRetry }       from "../../../api/client.js";
import { liquidityAggregatorApi } from "../../../services/api/liquidityAggregator.js";

beforeEach(() => vi.clearAllMocks());

const OK = { data: {} };

describe("liquidityAggregatorApi.providers", () => {
  test("calls GET /api/liquidity-aggregator/providers", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await liquidityAggregatorApi.providers();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/liquidity-aggregator/providers" });
  });

  test("returns provider list", async () => {
    const payload = { data: [{ name: "binance", type: "cex" }] };
    vi.mocked(requestWithRetry).mockResolvedValue(payload);
    expect(await liquidityAggregatorApi.providers()).toEqual(payload);
  });

  test("propagates rejection", async () => {
    vi.mocked(requestWithRetry).mockRejectedValue(new Error("timeout"));
    await expect(liquidityAggregatorApi.providers()).rejects.toThrow("timeout");
  });
});

describe("liquidityAggregatorApi.stats", () => {
  test("calls GET /api/liquidity-aggregator/stats", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await liquidityAggregatorApi.stats();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/liquidity-aggregator/stats" });
  });
});

describe("liquidityAggregatorApi.book", () => {
  test("interpolates pair into the URL", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await liquidityAggregatorApi.book("BTC-USD");
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/liquidity-aggregator/book/BTC-USD" });
  });

  test("uses the correct pair in the URL for ETH-USD", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await liquidityAggregatorApi.book("ETH-USD");
    const call = vi.mocked(requestWithRetry).mock.calls[0][0];
    expect(call.url).toBe("/api/liquidity-aggregator/book/ETH-USD");
  });
});

describe("liquidityAggregatorApi.allBooks", () => {
  test("calls GET /api/liquidity-aggregator/all-books with pair as query param", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await liquidityAggregatorApi.allBooks("SOL-USD");
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/liquidity-aggregator/all-books", params: { pair: "SOL-USD" } });
  });
});

describe("liquidityAggregatorApi.slippage", () => {
  test("calls GET /api/liquidity-aggregator/slippage/:pair with side and usdAmount params", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await liquidityAggregatorApi.slippage("BTC-USD", "buy", 10000);
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "get",
      url: "/api/liquidity-aggregator/slippage/BTC-USD",
      params: { side: "buy", usdAmount: 10000 },
    });
  });

  test("works for sell side", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await liquidityAggregatorApi.slippage("ETH-USD", "sell", 5000);
    const call = vi.mocked(requestWithRetry).mock.calls[0][0];
    expect(call.params.side).toBe("sell");
    expect(call.params.usdAmount).toBe(5000);
  });
});
