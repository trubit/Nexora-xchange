/**
 * Stage 32 — Global Digital Asset Custody & Vault System
 * Unit tests for CustodyVaultService, models, and approval workflow.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// ── Model mocks ───────────────────────────────────────────────────────────────

vi.mock("../../models/VaultAccount.js",    () => ({ default: { create: vi.fn(), findOne: vi.fn(), findOneAndUpdate: vi.fn(), find: vi.fn(), countDocuments: vi.fn() } }));
vi.mock("../../models/VaultTransaction.js",() => ({ default: { create: vi.fn(), findOne: vi.fn(), findOneAndUpdate: vi.fn(), find: vi.fn(), countDocuments: vi.fn() } }));
vi.mock("../../models/VaultPolicy.js",     () => ({ default: { create: vi.fn(), find: vi.fn() } }));
vi.mock("../../models/VaultAuditEntry.js", () => ({ default: { create: vi.fn(), find: vi.fn(), countDocuments: vi.fn() } }));
vi.mock("../../infra/eventBus.js",         () => ({ eventBus: { on: vi.fn(), publish: vi.fn() } }));
vi.mock("../../config/logger.js",          () => ({ default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));

import VaultAccount     from "../../models/VaultAccount.js";
import VaultTransaction from "../../models/VaultTransaction.js";
import VaultPolicy      from "../../models/VaultPolicy.js";
import VaultAuditEntry  from "../../models/VaultAuditEntry.js";
import { CustodyVaultService } from "../../services/custodyVaultService.js";

// ── Mock data helpers ─────────────────────────────────────────────────────────

const mockVault = (o = {}) => ({
  vaultId: "VAULT-001",
  name: "Cold Reserve",
  tier: "cold",
  status: "active",
  custodian: "internal",
  requiredApprovals: 3,
  balances: [],
  ...o,
});

const mockTx = (o = {}) => ({
  txId: "VTX-001",
  fromVaultId: "VAULT-001",
  asset: "BTC",
  amount: 1.5,
  type: "internal_transfer",
  status: "pending_approval",
  requiredApprovals: 3,
  approvals: [],
  rejections: 0,
  ...o,
});

// ── Lifecycle ─────────────────────────────────────────────────────────────────

describe("CustodyVaultService — lifecycle", () => {
  let svc;

  beforeEach(() => {
    vi.clearAllMocks();
    VaultAccount.countDocuments.mockResolvedValue(0);
    VaultTransaction.countDocuments.mockResolvedValue(0);
    VaultAuditEntry.create.mockResolvedValue({});
    svc = new CustodyVaultService();
  });

  afterEach(() => svc.stop());

  test("start() loads stats from DB", async () => {
    VaultAccount.countDocuments.mockResolvedValue(5);
    await svc.start();
    expect(VaultAccount.countDocuments).toHaveBeenCalled();
  });

  test("start() is idempotent — second call does nothing", async () => {
    await svc.start();
    const callCount = VaultAccount.countDocuments.mock.calls.length;
    await svc.start();
    expect(VaultAccount.countDocuments.mock.calls.length).toBe(callCount);
  });

  test("stop() sets _started to false", async () => {
    await svc.start();
    svc.stop();
    expect(svc._started).toBe(false);
  });
});

// ── Vault creation ────────────────────────────────────────────────────────────

describe("CustodyVaultService — createVault", () => {
  let svc;

  beforeEach(() => {
    vi.clearAllMocks();
    VaultAccount.countDocuments.mockResolvedValue(0);
    VaultTransaction.countDocuments.mockResolvedValue(0);
    VaultAuditEntry.create.mockResolvedValue({});
    VaultAccount.create.mockResolvedValue(mockVault());
    svc = new CustodyVaultService();
  });

  afterEach(() => svc.stop());

  test("creates a vault with valid tier", async () => {
    const vault = await svc.createVault({ name: "Cold 1", tier: "cold" });
    expect(VaultAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Cold 1", tier: "cold" })
    );
    expect(vault).toBeDefined();
  });

  test("creates vault and logs VAULT_CREATED audit", async () => {
    await svc.createVault({ name: "Hot 1", tier: "hot" });
    expect(VaultAuditEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "VAULT_CREATED" })
    );
  });

  test("throws when name is missing", async () => {
    await expect(svc.createVault({ tier: "cold" })).rejects.toThrow("required");
  });

  test("throws when tier is missing", async () => {
    await expect(svc.createVault({ name: "Test" })).rejects.toThrow("required");
  });

  test("throws on invalid tier", async () => {
    await expect(svc.createVault({ name: "X", tier: "ultra-cold" })).rejects.toThrow("Invalid vault tier");
  });

  test("increments totalVaults stat", async () => {
    const before = svc._stats.totalVaults;
    await svc.createVault({ name: "V", tier: "warm" });
    expect(svc._stats.totalVaults).toBe(before + 1);
  });
});

// ── Vault lock/unlock ─────────────────────────────────────────────────────────

describe("CustodyVaultService — lockVault / unlockVault", () => {
  let svc;

  beforeEach(() => {
    vi.clearAllMocks();
    VaultAccount.countDocuments.mockResolvedValue(0);
    VaultTransaction.countDocuments.mockResolvedValue(0);
    VaultAuditEntry.create.mockResolvedValue({});
    svc = new CustodyVaultService();
  });

  afterEach(() => svc.stop());

  test("lockVault updates status to locked", async () => {
    VaultAccount.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(mockVault({ status: "locked" })) });
    const vault = await svc.lockVault("VAULT-001", { reason: "security audit" });
    expect(VaultAccount.findOneAndUpdate).toHaveBeenCalledWith(
      { vaultId: "VAULT-001", status: "active" },
      { status: "locked" },
      { new: true }
    );
    expect(vault.status).toBe("locked");
  });

  test("lockVault throws when vault not found", async () => {
    VaultAccount.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
    await expect(svc.lockVault("MISSING")).rejects.toThrow("not found or already locked");
  });

  test("lockVault appends VAULT_LOCKED audit entry", async () => {
    VaultAccount.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(mockVault({ status: "locked" })) });
    await svc.lockVault("VAULT-001");
    expect(VaultAuditEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "VAULT_LOCKED" })
    );
  });

  test("unlockVault updates status to active", async () => {
    VaultAccount.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(mockVault({ status: "active" })) });
    await svc.unlockVault("VAULT-001");
    expect(VaultAccount.findOneAndUpdate).toHaveBeenCalledWith(
      { vaultId: "VAULT-001", status: "locked" },
      { status: "active" },
      { new: true }
    );
  });

  test("unlockVault throws when vault not locked", async () => {
    VaultAccount.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
    await expect(svc.unlockVault("VAULT-001")).rejects.toThrow("not found or not locked");
  });
});

// ── Transaction initiation ────────────────────────────────────────────────────

describe("CustodyVaultService — initiateTransaction", () => {
  let svc;

  beforeEach(() => {
    vi.clearAllMocks();
    VaultAccount.countDocuments.mockResolvedValue(0);
    VaultTransaction.countDocuments.mockResolvedValue(0);
    VaultAuditEntry.create.mockResolvedValue({});
    VaultAccount.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(mockVault()) });
    VaultTransaction.create.mockResolvedValue(mockTx());
    svc = new CustodyVaultService();
  });

  afterEach(() => svc.stop());

  test("creates a VaultTransaction", async () => {
    await svc.initiateTransaction({
      fromVaultId: "VAULT-001", asset: "BTC", amount: 1, type: "internal_transfer", initiatedBy: "user-1",
    });
    expect(VaultTransaction.create).toHaveBeenCalled();
  });

  test("throws when required fields are missing", async () => {
    await expect(svc.initiateTransaction({ fromVaultId: "VAULT-001" })).rejects.toThrow("required");
  });

  test("throws when vault not found or inactive", async () => {
    VaultAccount.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
    await expect(svc.initiateTransaction({
      fromVaultId: "MISSING", asset: "BTC", amount: 1, type: "withdrawal", initiatedBy: "u1",
    })).rejects.toThrow("not found or inactive");
  });

  test("sets status to pending_approval when requiredApprovals > 0", async () => {
    const tx = await svc.initiateTransaction({
      fromVaultId: "VAULT-001", asset: "ETH", amount: 5, type: "internal_transfer", initiatedBy: "u1",
    });
    expect(tx.status).toBe("pending_approval");
  });

  test("appends TX_INITIATED audit log", async () => {
    await svc.initiateTransaction({
      fromVaultId: "VAULT-001", asset: "BTC", amount: 2, type: "rebalance", initiatedBy: "u1",
    });
    expect(VaultAuditEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "TX_INITIATED" })
    );
  });
});

// ── Approval workflow ─────────────────────────────────────────────────────────

describe("CustodyVaultService — approveTransaction", () => {
  let svc;

  const mockFindOne = (value) =>
    VaultTransaction.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(value) });

  beforeEach(() => {
    vi.clearAllMocks();
    VaultAccount.countDocuments.mockResolvedValue(0);
    VaultTransaction.countDocuments.mockResolvedValue(0);
    VaultAuditEntry.create.mockResolvedValue({});
    VaultTransaction.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(mockTx({ approvals: [{ approverUserId: "user-2", action: "approved" }] })) });
    svc = new CustodyVaultService();
  });

  afterEach(() => svc.stop());

  test("throws when transaction not found", async () => {
    mockFindOne(null);
    await expect(svc.approveTransaction("VTX-MISSING", { approverId: "u1" })).rejects.toThrow("not found");
  });

  test("throws when transaction is not pending", async () => {
    mockFindOne(mockTx({ status: "completed" }));
    await expect(svc.approveTransaction("VTX-001", { approverId: "u1" })).rejects.toThrow("not pending");
  });

  test("throws when approver has already approved", async () => {
    mockFindOne(mockTx({
      approvals: [{ approverUserId: "user-1", action: "approved" }],
    }));
    await expect(svc.approveTransaction("VTX-001", { approverId: "user-1" })).rejects.toThrow("already approved");
  });

  test("throws when time-lock is still active", async () => {
    const future = new Date(Date.now() + 1000 * 3600);
    mockFindOne(mockTx({ timeLockUntil: future }));
    await expect(svc.approveTransaction("VTX-001", { approverId: "u1" })).rejects.toThrow("Time-lock active");
  });

  test("appends approval to the transaction", async () => {
    mockFindOne(mockTx());
    await svc.approveTransaction("VTX-001", { approverId: "user-2", comment: "OK" });
    expect(VaultTransaction.findOneAndUpdate).toHaveBeenCalledWith(
      { txId: "VTX-001" },
      expect.objectContaining({ $push: expect.any(Object) }),
      { new: true }
    );
  });
});

// ── Rejection workflow ────────────────────────────────────────────────────────

describe("CustodyVaultService — rejectTransaction", () => {
  let svc;

  const mockFindOne = (value) =>
    VaultTransaction.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(value) });

  beforeEach(() => {
    vi.clearAllMocks();
    VaultAccount.countDocuments.mockResolvedValue(0);
    VaultTransaction.countDocuments.mockResolvedValue(0);
    VaultAuditEntry.create.mockResolvedValue({});
    VaultTransaction.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(mockTx({ status: "rejected" })) });
    svc = new CustodyVaultService();
  });

  afterEach(() => svc.stop());

  test("throws when transaction not found", async () => {
    mockFindOne(null);
    await expect(svc.rejectTransaction("VTX-MISSING", { rejecterId: "u1" })).rejects.toThrow("not found");
  });

  test("throws when transaction is not pending", async () => {
    mockFindOne(mockTx({ status: "approved" }));
    await expect(svc.rejectTransaction("VTX-001", { rejecterId: "u1" })).rejects.toThrow("not pending");
  });

  test("marks transaction as rejected", async () => {
    mockFindOne(mockTx());
    await svc.rejectTransaction("VTX-001", { rejecterId: "u2", reason: "risk limit" });
    expect(VaultTransaction.findOneAndUpdate).toHaveBeenCalledWith(
      { txId: "VTX-001" },
      expect.objectContaining({ status: "rejected" }),
    );
  });

  test("appends TX_REJECTED audit entry", async () => {
    mockFindOne(mockTx());
    await svc.rejectTransaction("VTX-001", { rejecterId: "u2" });
    expect(VaultAuditEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "TX_REJECTED" })
    );
  });

  test("decrements pendingApprovals stat", async () => {
    mockFindOne(mockTx());
    svc._stats.pendingApprovals = 5;
    await svc.rejectTransaction("VTX-001", { rejecterId: "u2" });
    expect(svc._stats.pendingApprovals).toBe(4);
  });
});

// ── Statistics ────────────────────────────────────────────────────────────────

describe("CustodyVaultService — getStatistics", () => {
  let svc;

  beforeEach(() => {
    vi.clearAllMocks();
    VaultAuditEntry.create.mockResolvedValue({});

    VaultAccount.countDocuments.mockImplementation((q) => {
      if (!q)             return Promise.resolve(10);
      if (q.tier === "cold") return Promise.resolve(4);
      if (q.tier === "warm") return Promise.resolve(3);
      if (q.tier === "hot")  return Promise.resolve(3);
      return Promise.resolve(0);
    });

    VaultTransaction.countDocuments.mockImplementation((q) => {
      if (!q)                     return Promise.resolve(50);
      if (q.status === "pending_approval") return Promise.resolve(2);
      if (q.status === "completed")        return Promise.resolve(45);
      if (q.status === "failed")           return Promise.resolve(3);
      return Promise.resolve(0);
    });

    svc = new CustodyVaultService();
  });

  afterEach(() => svc.stop());

  test("returns total vault count", async () => {
    const s = await svc.getStatistics();
    expect(s.totalVaults).toBe(10);
  });

  test("returns count per tier", async () => {
    const s = await svc.getStatistics();
    expect(s.coldVaults).toBe(4);
    expect(s.warmVaults).toBe(3);
    expect(s.hotVaults).toBe(3);
  });

  test("calculates success rate", async () => {
    const s = await svc.getStatistics();
    expect(parseFloat(s.successRate)).toBeCloseTo(90); // 45/50 * 100
  });

  test("returns pending approvals count", async () => {
    const s = await svc.getStatistics();
    expect(s.pendingApprovals).toBe(2);
  });
});

// ── Model shape ───────────────────────────────────────────────────────────────

describe("Model shape", () => {
  test("VaultAccount has required methods", () => {
    expect(typeof VaultAccount.create).toBe("function");
    expect(typeof VaultAccount.findOne).toBe("function");
    expect(typeof VaultAccount.findOneAndUpdate).toBe("function");
  });

  test("VaultTransaction has required methods", () => {
    expect(typeof VaultTransaction.create).toBe("function");
    expect(typeof VaultTransaction.findOneAndUpdate).toBe("function");
  });

  test("VaultPolicy has required methods", () => {
    expect(typeof VaultPolicy.create).toBe("function");
    expect(typeof VaultPolicy.find).toBe("function");
  });

  test("VaultAuditEntry has required methods", () => {
    expect(typeof VaultAuditEntry.create).toBe("function");
  });
});
