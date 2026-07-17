import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("../../../api/client.js", () => ({ requestWithRetry: vi.fn() }));

import { requestWithRetry }  from "../../../api/client.js";
import { custodyVaultApi }   from "../../../services/api/custodyVault.js";

beforeEach(() => vi.clearAllMocks());

const OK = { data: {} };

describe("custodyVaultApi.vaults", () => {
  test("calls GET /api/vault/vaults with no params by default", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: { vaults: [] } });
    await custodyVaultApi.vaults();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/vault/vaults", params: {} });
  });

  test("forwards tier filter", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await custodyVaultApi.vaults({ tier: "cold" });
    expect(vi.mocked(requestWithRetry).mock.calls[0][0].params.tier).toBe("cold");
  });

  test("propagates rejection", async () => {
    vi.mocked(requestWithRetry).mockRejectedValue(new Error("403"));
    await expect(custodyVaultApi.vaults()).rejects.toThrow("403");
  });
});

describe("custodyVaultApi.vaultById", () => {
  test("calls GET /api/vault/vaults/:id", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await custodyVaultApi.vaultById("VAULT-001");
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/vault/vaults/VAULT-001" });
  });

  test("interpolates vault id into URL", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await custodyVaultApi.vaultById("VAULT-ABC");
    expect(vi.mocked(requestWithRetry).mock.calls[0][0].url).toBe("/api/vault/vaults/VAULT-ABC");
  });
});

describe("custodyVaultApi.createVault", () => {
  test("calls POST /api/vault/vaults with body", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    const body = { name: "Cold Reserve", tier: "cold", requiredApprovals: 3 };
    await custodyVaultApi.createVault(body);
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "post", url: "/api/vault/vaults", data: body });
  });

  test("uses POST method", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await custodyVaultApi.createVault({ name: "X", tier: "hot" });
    expect(vi.mocked(requestWithRetry).mock.calls[0][0].method).toBe("post");
  });

  test("propagates validation error", async () => {
    vi.mocked(requestWithRetry).mockRejectedValue(new Error("name and tier are required"));
    await expect(custodyVaultApi.createVault({})).rejects.toThrow("required");
  });
});

describe("custodyVaultApi.lockVault", () => {
  test("calls PATCH /api/vault/vaults/:id/lock", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await custodyVaultApi.lockVault("VAULT-001", { reason: "audit" });
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "patch",
      url: "/api/vault/vaults/VAULT-001/lock",
      data: { reason: "audit" },
    });
  });

  test("interpolates vault id correctly", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await custodyVaultApi.lockVault("VAULT-XYZ");
    expect(vi.mocked(requestWithRetry).mock.calls[0][0].url).toContain("VAULT-XYZ");
  });
});

describe("custodyVaultApi.unlockVault", () => {
  test("calls PATCH /api/vault/vaults/:id/unlock", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await custodyVaultApi.unlockVault("VAULT-001");
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "patch", url: "/api/vault/vaults/VAULT-001/unlock" });
  });
});

describe("custodyVaultApi.transactions", () => {
  test("calls GET /api/vault/transactions with no params by default", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: { transactions: [] } });
    await custodyVaultApi.transactions();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/vault/transactions", params: {} });
  });

  test("forwards status filter", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await custodyVaultApi.transactions({ status: "pending_approval" });
    expect(vi.mocked(requestWithRetry).mock.calls[0][0].params.status).toBe("pending_approval");
  });
});

describe("custodyVaultApi.initiateTransaction", () => {
  test("calls POST /api/vault/transactions with body", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    const body = { fromVaultId: "VAULT-001", asset: "BTC", amount: 1.5, type: "withdrawal" };
    await custodyVaultApi.initiateTransaction(body);
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "post", url: "/api/vault/transactions", data: body });
  });
});

describe("custodyVaultApi.approveTransaction", () => {
  test("calls POST /api/vault/transactions/:txId/approve", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await custodyVaultApi.approveTransaction("VTX-001", { comment: "looks good" });
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "post",
      url: "/api/vault/transactions/VTX-001/approve",
      data: { comment: "looks good" },
    });
  });

  test("propagates time-lock error", async () => {
    vi.mocked(requestWithRetry).mockRejectedValue(new Error("Time-lock active"));
    await expect(custodyVaultApi.approveTransaction("VTX-001")).rejects.toThrow("Time-lock");
  });
});

describe("custodyVaultApi.rejectTransaction", () => {
  test("calls POST /api/vault/transactions/:txId/reject", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await custodyVaultApi.rejectTransaction("VTX-002", { reason: "risk limit exceeded" });
    expect(requestWithRetry).toHaveBeenCalledWith({
      method: "post",
      url: "/api/vault/transactions/VTX-002/reject",
      data: { reason: "risk limit exceeded" },
    });
  });
});

describe("custodyVaultApi.pendingApprovals", () => {
  test("calls GET /api/vault/approvals/pending", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: { transactions: [] } });
    await custodyVaultApi.pendingApprovals();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/vault/approvals/pending" });
  });
});

describe("custodyVaultApi.statistics", () => {
  test("calls GET /api/vault/statistics", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: { stats: {} } });
    await custodyVaultApi.statistics();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/vault/statistics" });
  });

  test("returns statistics payload", async () => {
    const payload = { data: { stats: { totalVaults: 5, coldVaults: 2 } } };
    vi.mocked(requestWithRetry).mockResolvedValue(payload);
    expect(await custodyVaultApi.statistics()).toEqual(payload);
  });

  test("propagates network error", async () => {
    vi.mocked(requestWithRetry).mockRejectedValue(new Error("timeout"));
    await expect(custodyVaultApi.statistics()).rejects.toThrow("timeout");
  });
});

describe("custodyVaultApi.policies", () => {
  test("calls GET /api/vault/policies", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: { policies: [] } });
    await custodyVaultApi.policies();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/vault/policies" });
  });
});

describe("custodyVaultApi.createPolicy", () => {
  test("calls POST /api/vault/policies with body", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    const body = { name: "Cold Policy", tier: "cold", requiredApprovals: 3, timeLockHours: 24 };
    await custodyVaultApi.createPolicy(body);
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "post", url: "/api/vault/policies", data: body });
  });
});

describe("custodyVaultApi.auditLog", () => {
  test("calls GET /api/vault/audit with no params by default", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue({ data: { logs: [] } });
    await custodyVaultApi.auditLog();
    expect(requestWithRetry).toHaveBeenCalledWith({ method: "get", url: "/api/vault/audit", params: {} });
  });

  test("forwards vaultId filter", async () => {
    vi.mocked(requestWithRetry).mockResolvedValue(OK);
    await custodyVaultApi.auditLog({ vaultId: "VAULT-001" });
    expect(vi.mocked(requestWithRetry).mock.calls[0][0].params.vaultId).toBe("VAULT-001");
  });
});
