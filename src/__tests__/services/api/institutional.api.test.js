import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("../../../api/client.js", () => ({ requestWithRetry: vi.fn() }));

import { requestWithRetry } from "../../../api/client.js";
import { institutionalApi } from "../../../services/api/institutional.js";

beforeEach(() => vi.clearAllMocks());

const OK = { data: {} };

describe("institutionalApi.tiers", () => {
  test("calls GET /api/institutional/tiers", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await institutionalApi.tiers();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/institutional/tiers" });
  });

  test("returns tier config", async () => {
    const payload = { data: { gold: { rateLimitRpm: 1000 } } };
    vi.mocked(requestWithRetry).mockResolvedValue(payload);
    expect(await institutionalApi.tiers()).toEqual(payload);
  });
});

describe("institutionalApi.myKeys", () => {
  test("calls GET /api/institutional/keys", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: [] });
    await institutionalApi.myKeys();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/institutional/keys" });
  });
});

describe("institutionalApi.issueKey", () => {
  test("calls POST /api/institutional/keys with body", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ secret: "sk_test_abc" });
    const body = { name: "Trading Bot", permissions: ["read", "trade"] };
    await institutionalApi.issueKey(body);
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "post", url: "/api/institutional/keys", data: body });
  });

  test("returns the issued key with secret", async () => {
    const payload = { data: { key: "pk_test_abc", secret: "sk_test_abc" } };
    vi.mocked(requestWithRetry).mockResolvedValue(payload);
    expect(await institutionalApi.issueKey({ name: "Bot" })).toEqual(payload);
  });

  test("propagates rejection when quota exceeded", async () => {
    vi.mocked(requestWithRetry).mockRejectedValue(new Error("Key limit reached"));
    await expect(institutionalApi.issueKey({ name: "X" })).rejects.toThrow("Key limit reached");
  });
});

describe("institutionalApi.revokeKey", () => {
  test("calls DELETE /api/institutional/keys/:id", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await institutionalApi.revokeKey("key-001");
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "delete", url: "/api/institutional/keys/key-001" });
  });

  test("interpolates the id into the URL", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await institutionalApi.revokeKey("abc123");
    const call = vi.mocked(requestWithRetry).mock.calls[0][0];
    expect(call.url).toBe("/api/institutional/keys/abc123");
    expect(call.method).toBe("delete");
  });
});

describe("institutionalApi.clients", () => {
  test("calls GET /api/institutional/clients with no params by default", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: [] });
    await institutionalApi.clients();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/institutional/clients", params: {} });
  });

  test("forwards filter params", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: [] });
    await institutionalApi.clients({ tier: "gold" });
    const call = vi.mocked(requestWithRetry).mock.calls[0][0];
    expect(call.params).toEqual({ tier: "gold" });
  });
});

describe("institutionalApi.myClient", () => {
  test("calls GET /api/institutional/my", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await institutionalApi.myClient();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/institutional/my" });
  });
});

describe("institutionalApi.subAccounts", () => {
  test("calls GET /api/institutional/clients/:id/sub-accounts", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: [] });
    await institutionalApi.subAccounts("client-007");
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/institutional/clients/client-007/sub-accounts" });
  });

  test("interpolates the client id correctly", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: [] });
    await institutionalApi.subAccounts("enterprise-42");
    const call = vi.mocked(requestWithRetry).mock.calls[0][0];
    expect(call.url).toContain("enterprise-42");
    expect(call.url).toContain("sub-accounts");
  });
});
