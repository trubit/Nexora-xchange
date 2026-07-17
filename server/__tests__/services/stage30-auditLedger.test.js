/**
 * Stage 30 — Global Financial Audit + Immutable Ledger System
 *
 * Tests:
 *   AuditLedgerService    — append, voidEntry, verifyChain, getEntries, getStats
 *   ComplianceReportingEngine — generateReport, listReports, submitReport
 *   ReconciliationEngine  — run, getSnapshot, resolveSnapshot
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── hoisted mocks ─────────────────────────────────────────────────────────────
const {
  mockImmutableLedgerEntry,
  mockComplianceReport,
  mockReconciliationSnapshot,
} = vi.hoisted(() => {
  const makeModel = (extras = {}) => ({
    findOne:            vi.fn(),
    find:               vi.fn(),
    findById:           vi.fn(),
    findByIdAndUpdate:  vi.fn(),
    create:             vi.fn(),
    countDocuments:     vi.fn(),
    aggregate:          vi.fn(),
    computeHash:        vi.fn(() => "fakehash"),
    ...extras,
  });
  return {
    mockImmutableLedgerEntry:   makeModel(),
    mockComplianceReport:       makeModel(),
    mockReconciliationSnapshot: makeModel(),
  };
});

vi.mock("../../models/ImmutableLedgerEntry.js", () => ({
  default: mockImmutableLedgerEntry,
}));
vi.mock("../../models/ComplianceReport.js", () => ({
  default: mockComplianceReport,
}));
vi.mock("../../models/ReconciliationSnapshot.js", () => ({
  default: mockReconciliationSnapshot,
}));
vi.mock("../../config/logger.js", () => ({
  default: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── imports ────────────────────────────────────────────────────────────────────
import { AuditLedgerService }        from "../../services/auditLedgerService.js";
import { ComplianceReportingEngine } from "../../services/complianceReportingEngine.js";
import { ReconciliationEngine }      from "../../services/reconciliationEngine.js";

// ── helpers ────────────────────────────────────────────────────────────────────
function mockSort(returnValue) {
  return { sort: vi.fn().mockReturnValue(returnValue) };
}
function mockSortLean(returnValue) {
  return { sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(returnValue) }) };
}
function mockSkipLimit(returnValue) {
  return {
    sort:   vi.fn().mockReturnThis(),
    skip:   vi.fn().mockReturnThis(),
    limit:  vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(returnValue) }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  AuditLedgerService
// ─────────────────────────────────────────────────────────────────────────────

describe("AuditLedgerService", () => {
  let service;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new AuditLedgerService();
    // Default: computeHash always returns "fakehash"
    mockImmutableLedgerEntry.computeHash.mockReturnValue("fakehash");
  });

  // ── initialize ──────────────────────────────────────────────────────────────

  describe("initialize()", () => {
    it("sets lastEntryId=0 and GENESIS_HASH when no entries exist", async () => {
      mockImmutableLedgerEntry.findOne.mockReturnValue(
        mockSortLean(null)
      );
      await service.initialize();
      expect(service._lastEntryId).toBe(0);
      expect(service._lastHash).toMatch(/^0{64}$/);
      expect(service._initialized).toBe(true);
    });

    it("resumes from last DB entry", async () => {
      mockImmutableLedgerEntry.findOne.mockReturnValue(
        mockSortLean({ entryId: 7, hash: "hash7" })
      );
      await service.initialize();
      expect(service._lastEntryId).toBe(7);
      expect(service._lastHash).toBe("hash7");
    });
  });

  // ── append ─────────────────────────────────────────────────────────────────

  describe("append()", () => {
    it("creates a ledger entry and increments lastEntryId", async () => {
      const docObj = { entryId: 1, hash: "fakehash", toObject: () => ({ entryId: 1 }) };
      mockImmutableLedgerEntry.create.mockResolvedValue(docObj);

      const result = await service.append({
        type: "DEPOSIT", asset: "BTC", amount: 0.5, description: "test deposit",
      });

      expect(mockImmutableLedgerEntry.create).toHaveBeenCalledOnce();
      const callArgs = mockImmutableLedgerEntry.create.mock.calls[0][0];
      expect(callArgs.entryId).toBe(1);
      expect(callArgs.type).toBe("DEPOSIT");
      expect(service._lastEntryId).toBe(1);
      expect(result.entryId).toBe(1);
    });

    it("increments entryId on consecutive appends", async () => {
      let idCounter = 0;
      mockImmutableLedgerEntry.create.mockImplementation((data) => {
        idCounter++;
        return Promise.resolve({ entryId: data.entryId, hash: "hash" + idCounter, toObject: () => data });
      });

      await service.append({ type: "DEPOSIT",    asset: "ETH", amount: 1, description: "a" });
      await service.append({ type: "WITHDRAWAL", asset: "ETH", amount: 0.5, description: "b" });

      expect(mockImmutableLedgerEntry.create).toHaveBeenCalledTimes(2);
      const calls = mockImmutableLedgerEntry.create.mock.calls;
      expect(calls[0][0].entryId).toBe(1);
      expect(calls[1][0].entryId).toBe(2);
    });

    it("uses prevHash chaining", async () => {
      service._lastHash = "aabbcc";
      mockImmutableLedgerEntry.create.mockImplementation((data) =>
        Promise.resolve({ ...data, toObject: () => data })
      );
      await service.append({ type: "TRADE", asset: "BTC", amount: 0.1, description: "trade" });
      const callArgs = mockImmutableLedgerEntry.create.mock.calls[0][0];
      expect(callArgs.prevHash).toBe("aabbcc");
    });
  });

  // ── voidEntry ──────────────────────────────────────────────────────────────

  describe("voidEntry()", () => {
    it("creates a VOID entry referencing the original", async () => {
      const original = {
        entryId: 5, type: "DEPOSIT", asset: "BTC", amount: 1,
        currency: "USD", balanceBefore: 0, balanceAfter: 1,
        userId: "user1", relatedId: null,
      };
      mockImmutableLedgerEntry.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue(original),
      });
      mockImmutableLedgerEntry.create.mockImplementation((data) =>
        Promise.resolve({ ...data, toObject: () => data })
      );

      const result = await service.voidEntry(5, { reason: "error", recordedBy: "admin" });
      expect(result.type).toBe("VOID");
      expect(result.amount).toBe(-1);
      expect(result.relatedId).toBe("5");
    });

    it("throws when original entry not found", async () => {
      mockImmutableLedgerEntry.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      });
      await expect(service.voidEntry(999, {})).rejects.toThrow("not found");
    });

    it("throws when trying to void a VOID entry", async () => {
      mockImmutableLedgerEntry.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue({ entryId: 3, type: "VOID", asset: "BTC", amount: -1 }),
      });
      await expect(service.voidEntry(3, {})).rejects.toThrow("Cannot void a VOID");
    });
  });

  // ── verifyChain ────────────────────────────────────────────────────────────

  describe("verifyChain()", () => {
    it("returns valid=true, checkedCount=0 when no entries", async () => {
      mockImmutableLedgerEntry.find.mockReturnValue(
        mockSort({ lean: vi.fn().mockResolvedValue([]) })
      );
      const result = await service.verifyChain();
      expect(result).toEqual({ valid: true, checkedCount: 0, firstBadId: null });
    });

    it("returns valid=true when hashes match", async () => {
      const genesis = "0".repeat(64);
      const hash1   = "fakehash";
      // computeHash always returns "fakehash" in this suite
      const entries = [
        { entryId: 1, prevHash: genesis, hash: "fakehash",
          type: "DEPOSIT", userId: null, relatedId: null,
          asset: "BTC", amount: 1, description: "d", createdAt: new Date("2025-01-01") },
      ];
      mockImmutableLedgerEntry.find.mockReturnValue(
        mockSort({ lean: vi.fn().mockResolvedValue(entries) })
      );
      const result = await service.verifyChain();
      expect(result.valid).toBe(true);
      expect(result.checkedCount).toBe(1);
    });

    it("returns valid=false and firstBadId when hash mismatch", async () => {
      const genesis = "0".repeat(64);
      const entries = [
        { entryId: 1, prevHash: genesis, hash: "WRONG",
          type: "DEPOSIT", userId: null, relatedId: null,
          asset: "BTC", amount: 1, description: "d", createdAt: new Date("2025-01-01") },
      ];
      mockImmutableLedgerEntry.find.mockReturnValue(
        mockSort({ lean: vi.fn().mockResolvedValue(entries) })
      );
      const result = await service.verifyChain();
      expect(result.valid).toBe(false);
      expect(result.firstBadId).toBe(1);
    });
  });

  // ── getEntries / getEntry / getStats ───────────────────────────────────────

  describe("getEntries()", () => {
    it("returns entries array", async () => {
      mockImmutableLedgerEntry.find.mockReturnValue(mockSkipLimit([{ entryId: 1 }]));
      const result = await service.getEntries({ asset: "BTC" });
      expect(result).toEqual([{ entryId: 1 }]);
    });
  });

  describe("getEntry()", () => {
    it("returns entry by entryId", async () => {
      mockImmutableLedgerEntry.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue({ entryId: 3, type: "TRADE" }),
      });
      const result = await service.getEntry(3);
      expect(result.entryId).toBe(3);
    });
  });

  describe("getStats()", () => {
    it("returns total, lastEntryId, lastHash, byType", async () => {
      mockImmutableLedgerEntry.countDocuments.mockResolvedValue(10);
      mockImmutableLedgerEntry.aggregate.mockResolvedValue([
        { _id: "DEPOSIT", count: 5 },
        { _id: "TRADE",   count: 5 },
      ]);
      mockImmutableLedgerEntry.findOne.mockReturnValue(
        mockSortLean({ entryId: 10, hash: "lasthash" })
      );
      const stats = await service.getStats();
      expect(stats.total).toBe(10);
      expect(stats.lastEntryId).toBe(10);
      expect(stats.lastHash).toBe("lasthash");
      expect(stats.byType.DEPOSIT).toBe(5);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  ComplianceReportingEngine
// ─────────────────────────────────────────────────────────────────────────────

describe("ComplianceReportingEngine", () => {
  let engine;

  beforeEach(() => {
    vi.resetAllMocks();
    engine = new ComplianceReportingEngine();
  });

  const period = { periodStart: "2025-01-01", periodEnd: "2025-01-31" };

  describe("generateReport()", () => {
    it("creates a finalized report with summary", async () => {
      const created = { _id: "id1", save: vi.fn() };
      mockComplianceReport.create.mockResolvedValue(created);
      mockImmutableLedgerEntry.find.mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { type: "DEPOSIT",    amount: 100, userId: "u1", asset: "BTC" },
          { type: "WITHDRAWAL", amount: 50,  userId: "u2", asset: "ETH" },
          { type: "TRADE",      amount: 0,   userId: "u1", asset: "BTC" },
          { type: "FEE",        amount: 2,   userId: "u1", asset: "USD" },
        ]),
      });
      mockImmutableLedgerEntry.findOne.mockReturnValue(
        mockSortLean({ hash: "endchainHash" })
      );
      mockComplianceReport.findByIdAndUpdate.mockResolvedValue({});
      mockComplianceReport.findById.mockReturnValue({
        lean: vi.fn().mockResolvedValue({ reportId: "RPT-001", status: "finalized" }),
      });

      const report = await engine.generateReport({ ...period, type: "MONTHLY" });
      expect(report.status).toBe("finalized");
      expect(mockComplianceReport.findByIdAndUpdate).toHaveBeenCalledWith(
        "id1",
        expect.objectContaining({ status: "finalized" })
      );
    });

    it("throws if DB write fails", async () => {
      mockComplianceReport.create.mockResolvedValue({ _id: "id2" });
      mockImmutableLedgerEntry.find.mockReturnValue({
        lean: vi.fn().mockRejectedValue(new Error("DB error")),
      });
      await expect(engine.generateReport(period)).rejects.toThrow("DB error");
    });
  });

  describe("listReports()", () => {
    it("returns list with query filters", async () => {
      mockComplianceReport.find.mockReturnValue(mockSkipLimit([{ reportId: "RPT-001" }]));
      const result = await engine.listReports({ type: "DAILY" });
      expect(result).toEqual([{ reportId: "RPT-001" }]);
      expect(mockComplianceReport.find).toHaveBeenCalledWith({ type: "DAILY" });
    });
  });

  describe("getReport()", () => {
    it("returns report by reportId", async () => {
      mockComplianceReport.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue({ reportId: "RPT-X", status: "finalized" }),
      });
      const r = await engine.getReport("RPT-X");
      expect(r.reportId).toBe("RPT-X");
    });
  });

  describe("submitReport()", () => {
    it("marks a finalized report as submitted", async () => {
      const mockDoc = {
        status: "finalized",
        metadata: {},
        save: vi.fn().mockResolvedValue(true),
        toObject: () => ({ status: "submitted" }),
      };
      mockComplianceReport.findOne.mockResolvedValue(mockDoc);
      const result = await engine.submitReport("RPT-001", { signature: "sig", submittedBy: "admin" });
      expect(mockDoc.save).toHaveBeenCalledOnce();
      expect(result.status).toBe("submitted");
    });

    it("throws if report not found", async () => {
      mockComplianceReport.findOne.mockResolvedValue(null);
      await expect(engine.submitReport("MISSING", {})).rejects.toThrow("not found");
    });

    it("throws if report is not finalized", async () => {
      mockComplianceReport.findOne.mockResolvedValue({ status: "generating" });
      await expect(engine.submitReport("RPT-002", {})).rejects.toThrow("finalized");
    });

    it("is idempotent when already submitted", async () => {
      const mockDoc = {
        status: "submitted",
        toObject: () => ({ status: "submitted" }),
      };
      mockComplianceReport.findOne.mockResolvedValue(mockDoc);
      const result = await engine.submitReport("RPT-001", {});
      expect(result.status).toBe("submitted");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  ReconciliationEngine
// ─────────────────────────────────────────────────────────────────────────────

describe("ReconciliationEngine", () => {
  let recon;

  beforeEach(() => {
    vi.resetAllMocks();
    recon = new ReconciliationEngine();
  });

  describe("run()", () => {
    it("creates a clean snapshot when no discrepancies", async () => {
      const created = { _id: "snap1" };
      mockReconciliationSnapshot.create.mockResolvedValue(created);
      mockReconciliationSnapshot.findByIdAndUpdate.mockResolvedValue({});
      mockReconciliationSnapshot.findById.mockReturnValue({
        lean: vi.fn().mockResolvedValue({ snapshotId: "RECON-001", status: "clean" }),
      });
      // No entries → no discrepancies
      mockImmutableLedgerEntry.find.mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      });

      const snap = await recon.run({ type: "SPOT" });
      expect(snap.status).toBe("clean");
      expect(mockReconciliationSnapshot.findByIdAndUpdate).toHaveBeenCalledWith(
        "snap1",
        expect.objectContaining({ status: "clean", discrepancies: [] })
      );
    });

    it("marks snapshot discrepant when settlement/deposit totals mismatch", async () => {
      const created = { _id: "snap2" };
      mockReconciliationSnapshot.create.mockResolvedValue(created);
      mockReconciliationSnapshot.findByIdAndUpdate.mockResolvedValue({});
      mockReconciliationSnapshot.findById.mockReturnValue({
        lean: vi.fn().mockResolvedValue({ snapshotId: "RECON-002", status: "discrepant" }),
      });
      // Settlement 100, Deposit 80 on same relatedId → mismatch
      mockImmutableLedgerEntry.find.mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { entryId: 1, type: "SETTLEMENT", relatedId: "txA", asset: "BTC", amount: 100, userId: "u1" },
          { entryId: 2, type: "DEPOSIT",    relatedId: "txA", asset: "BTC", amount: 80,  userId: "u1" },
        ]),
      });

      const snap = await recon.run({ type: "SPOT" });
      expect(snap.status).toBe("discrepant");
      const updateArgs = mockReconciliationSnapshot.findByIdAndUpdate.mock.calls[0][1];
      expect(updateArgs.discrepancies.length).toBeGreaterThan(0);
      expect(updateArgs.discrepancies[0].type).toBe("AMOUNT_MISMATCH");
    });

    it("detects orphan VOID entries", async () => {
      const created = { _id: "snap3" };
      mockReconciliationSnapshot.create.mockResolvedValue(created);
      mockReconciliationSnapshot.findByIdAndUpdate.mockResolvedValue({});
      mockReconciliationSnapshot.findById.mockReturnValue({
        lean: vi.fn().mockResolvedValue({ snapshotId: "RECON-003", status: "discrepant" }),
      });
      // VOID referencing entryId=999 which does not exist
      mockImmutableLedgerEntry.find.mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { entryId: 5, type: "VOID", relatedId: "999", asset: "ETH", amount: -10, userId: "u1" },
        ]),
      });

      await recon.run({ type: "SPOT" });
      const updateArgs = mockReconciliationSnapshot.findByIdAndUpdate.mock.calls[0][1];
      const orphan = updateArgs.discrepancies.find((d) => d.type === "VOID_ORPHAN");
      expect(orphan).toBeTruthy();
    });
  });

  describe("getSnapshot()", () => {
    it("returns snapshot by snapshotId", async () => {
      mockReconciliationSnapshot.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue({ snapshotId: "RECON-X", status: "clean" }),
      });
      const snap = await recon.getSnapshot("RECON-X");
      expect(snap.snapshotId).toBe("RECON-X");
    });
  });

  describe("listSnapshots()", () => {
    it("returns list", async () => {
      mockReconciliationSnapshot.find.mockReturnValue(mockSkipLimit([{ snapshotId: "RECON-1" }]));
      const list = await recon.listSnapshots({ status: "clean" });
      expect(list).toHaveLength(1);
    });
  });

  describe("resolveSnapshot()", () => {
    it("marks discrepant snapshot as clean", async () => {
      const snap = {
        status: "discrepant",
        save: vi.fn().mockResolvedValue(true),
        toObject: () => ({ status: "clean" }),
      };
      mockReconciliationSnapshot.findOne.mockResolvedValue(snap);
      const result = await recon.resolveSnapshot("RECON-001");
      expect(snap.save).toHaveBeenCalledOnce();
      expect(result.status).toBe("clean");
    });

    it("throws when snapshot not found", async () => {
      mockReconciliationSnapshot.findOne.mockResolvedValue(null);
      await expect(recon.resolveSnapshot("MISSING")).rejects.toThrow("not found");
    });

    it("is idempotent for already-clean snapshots", async () => {
      const snap = {
        status: "clean",
        toObject: () => ({ status: "clean" }),
      };
      mockReconciliationSnapshot.findOne.mockResolvedValue(snap);
      const result = await recon.resolveSnapshot("RECON-001");
      expect(result.status).toBe("clean");
    });
  });
});
