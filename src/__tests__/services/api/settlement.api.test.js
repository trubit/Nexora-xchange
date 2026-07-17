import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("../../../api/client.js", () => ({ requestWithRetry: vi.fn() }));

import { requestWithRetry } from "../../../api/client.js";
import { settlementApi }    from "../../../services/api/settlement.js";

beforeEach(() => vi.clearAllMocks());

const OK = { data: {} };

describe("settlementApi.chains", () => {
  test("calls GET /api/settlement/chains", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await settlementApi.chains();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/settlement/chains" });
  });

  test("returns chain list", async () => {
    const payload = { data: { ethereum: { connected: false } } };
    vi.mocked(requestWithRetry).mockResolvedValue(payload);
    expect(await settlementApi.chains()).toEqual(payload);
  });
});

describe("settlementApi.my", () => {
  test("calls GET /api/settlement/my with no params by default", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await settlementApi.my();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/settlement/my", params: {} });
  });

  test("forwards pagination params", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await settlementApi.my({ page: 2, limit: 10 });
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/settlement/my", params: { page: 2, limit: 10 } });
  });
});

describe("settlementApi.stats", () => {
  test("calls GET /api/settlement/stats", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await settlementApi.stats();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/settlement/stats" });
  });
});

describe("settlementApi.pending", () => {
  test("calls GET /api/settlement/pending", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await settlementApi.pending();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/settlement/pending" });
  });
});

describe("settlementApi.indexer", () => {
  test("calls GET /api/settlement/indexer", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await settlementApi.indexer();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/settlement/indexer" });
  });
});

describe("settlementApi.verify", () => {
  test("calls GET /api/settlement/verify/:chain/:txHash", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await settlementApi.verify("ethereum", "0xabc123");
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/settlement/verify/ethereum/0xabc123" });
  });

  test("interpolates chain and txHash into the URL", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await settlementApi.verify("bsc", "0xdeadbeef");
    const call = vi.mocked(requestWithRetry).mock.calls[0][0];
    expect(call.url).toBe("/api/settlement/verify/bsc/0xdeadbeef");
  });

  test("propagates error when verification fails", async () => {
    vi.mocked(requestWithRetry).mockRejectedValue(new Error("Not found"));
    await expect(settlementApi.verify("polygon", "0x0")).rejects.toThrow("Not found");
  });
});
