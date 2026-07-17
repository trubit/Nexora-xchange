/**
 * Stage 33 — Global Regulatory Compliance Platform
 * Tests: RegulatoryComplianceService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RegulatoryComplianceService } from "../../services/regulatoryComplianceService.js";

// ── Model mocks ──────────────────────────────────────────────────────────────

vi.mock("../../models/SanctionHit.js", () => ({
  default: {
    create:          vi.fn(),
    find:            vi.fn(),
    findOneAndUpdate:vi.fn(),
    countDocuments:  vi.fn(),
  },
}));

vi.mock("../../models/TravelRuleRecord.js", () => ({
  default: {
    create:          vi.fn(),
    find:            vi.fn(),
    findOne:         vi.fn(),
    findOneAndUpdate:vi.fn(),
    countDocuments:  vi.fn(),
  },
}));

vi.mock("../../models/SuspiciousActivityReport.js", () => ({
  default: {
    create:          vi.fn(),
    find:            vi.fn(),
    findOne:         vi.fn(),
    findOneAndUpdate:vi.fn(),
    countDocuments:  vi.fn(),
  },
}));

vi.mock("../../models/ComplianceReport.js", () => ({
  default: {
    create:          vi.fn(),
    find:            vi.fn(),
    findOneAndUpdate:vi.fn(),
    countDocuments:  vi.fn(),
  },
}));

vi.mock("../../models/AmlAlert.js", () => ({
  default: {
    countDocuments: vi.fn(),
  },
}));

vi.mock("../../infra/eventBus.js", () => ({
  eventBus: {
    on:      vi.fn(),
    publish: vi.fn(),
  },
}));

vi.mock("../../config/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

import SanctionHit        from "../../models/SanctionHit.js";
import TravelRuleRecord   from "../../models/TravelRuleRecord.js";
import SuspiciousActivityReport from "../../models/SuspiciousActivityReport.js";
import ComplianceReport   from "../../models/ComplianceReport.js";
import AmlAlert           from "../../models/AmlAlert.js";
import { eventBus }       from "../../infra/eventBus.js";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("RegulatoryComplianceService", () => {
  let svc;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new RegulatoryComplianceService();
  });

  afterEach(() => {
    svc.stop();
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────

  describe("start() / stop()", () => {
    it("starts and sets _started to true", async () => {
      SanctionHit.countDocuments.mockResolvedValue(0);
      await svc.start();
      expect(svc._started).toBe(true);
    });

    it("is idempotent — second start() is a no-op", async () => {
      await svc.start();
      const calls = eventBus.on.mock.calls.length;
      await svc.start();
      expect(eventBus.on.mock.calls.length).toBe(calls);
    });

    it("stop() sets _started to false", async () => {
      await svc.start();
      svc.stop();
      expect(svc._started).toBe(false);
    });

    it("subscribes to aml.alert event on start", async () => {
      await svc.start();
      expect(eventBus.on).toHaveBeenCalledWith("aml.alert", expect.any(Function));
    });
  });

  // ── Sanctions screening ──────────────────────────────────────────────────

  describe("screenEntity()", () => {
    it("throws if neither name nor address supplied", async () => {
      await expect(svc.screenEntity({})).rejects.toThrow("name or address required");
    });

    it("screens by name and creates hits for matching list names", async () => {
      const fakeHit = { hitId: "SHT-1", listName: "OFAC_SDN", status: "pending_review" };
      SanctionHit.create.mockResolvedValue(fakeHit);

      const hits = await svc.screenEntity({ name: "ofac sdn match" });
      expect(SanctionHit.create).toHaveBeenCalled();
      expect(svc._stats.sanctionScreenings).toBe(1);
    });

    it("screens by blacklisted address pattern (0x0000...)", async () => {
      const fakeHit = { hitId: "SHT-2", listName: "INTERNAL_BLACKLIST" };
      SanctionHit.create.mockResolvedValue(fakeHit);

      const hits = await svc.screenEntity({ address: "0x0000abc" });
      expect(SanctionHit.create).toHaveBeenCalledWith(
        expect.objectContaining({ listName: "INTERNAL_BLACKLIST", matchType: "address" })
      );
    });

    it("returns empty array for a clean name", async () => {
      const hits = await svc.screenEntity({ name: "completely clean name xyz" });
      expect(hits).toEqual([]);
      expect(SanctionHit.create).not.toHaveBeenCalled();
    });

    it("increments sanctionScreenings stat", async () => {
      await svc.screenEntity({ name: "any name" });
      expect(svc._stats.sanctionScreenings).toBe(1);
    });
  });

  describe("reviewSanctionHit()", () => {
    it("updates hit status and returns the updated hit", async () => {
      const hit = { hitId: "SHT-1", status: "false_positive", reviewNotes: "ok" };
      SanctionHit.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(hit) });

      const result = await svc.reviewSanctionHit("SHT-1", {
        reviewedBy: "user1", status: "false_positive", notes: "ok",
      });
      expect(result).toEqual(hit);
    });

    it("throws for invalid status value", async () => {
      await expect(
        svc.reviewSanctionHit("SHT-1", { status: "unknown" })
      ).rejects.toThrow("Invalid status");
    });

    it("throws if hit not found", async () => {
      SanctionHit.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
      await expect(
        svc.reviewSanctionHit("SHT-missing", { status: "confirmed" })
      ).rejects.toThrow("Sanction hit not found");
    });
  });

  describe("getSanctionHits()", () => {
    it("returns paginated hits and total", async () => {
      const mockHits = [{ hitId: "SHT-1" }];
      SanctionHit.find.mockReturnValue({
        sort: () => ({ skip: () => ({ limit: () => ({ lean: vi.fn().mockResolvedValue(mockHits) }) }) }),
      });
      SanctionHit.countDocuments.mockResolvedValue(1);

      const result = await svc.getSanctionHits({ status: "pending_review" });
      expect(result.hits).toEqual(mockHits);
      expect(result.total).toBe(1);
    });
  });

  // ── Travel Rule ──────────────────────────────────────────────────────────

  describe("createTravelRuleRecord()", () => {
    it("throws if required fields missing", async () => {
      await expect(
        svc.createTravelRuleRecord({ asset: "BTC" })
      ).rejects.toThrow("transactionId, asset, amount required");
    });

    it("returns null for amounts below threshold", async () => {
      const result = await svc.createTravelRuleRecord({
        transactionId: "TX-1", asset: "BTC", amount: 0.001, amountUsd: 50,
        originatorVasp: "V1", originatorName: "Alice", originatorWallet: "0xA",
        beneficiaryVasp: "V2", beneficiaryName: "Bob", beneficiaryWallet: "0xB",
      });
      expect(result).toBeNull();
      expect(TravelRuleRecord.create).not.toHaveBeenCalled();
    });

    it("creates a record for amounts above threshold", async () => {
      const fakeRecord = { recordId: "TR-1", status: "pending" };
      TravelRuleRecord.create.mockResolvedValue(fakeRecord);
      TravelRuleRecord.findOneAndUpdate.mockResolvedValue({});

      const result = await svc.createTravelRuleRecord({
        transactionId: "TX-2", asset: "BTC", amount: 0.1, amountUsd: 5000,
        originatorVasp: "V1", originatorName: "Alice", originatorWallet: "0xA",
        beneficiaryVasp: "V2", beneficiaryName: "Bob", beneficiaryWallet: "0xB",
      });
      expect(result).toEqual(fakeRecord);
      expect(svc._stats.travelRuleRecords).toBe(1);
    });
  });

  describe("getTravelRuleRecords()", () => {
    it("returns paginated records", async () => {
      const mockRecords = [{ recordId: "TR-1" }];
      TravelRuleRecord.find.mockReturnValue({
        sort: () => ({ skip: () => ({ limit: () => ({ lean: vi.fn().mockResolvedValue(mockRecords) }) }) }),
      });
      TravelRuleRecord.countDocuments.mockResolvedValue(1);

      const result = await svc.getTravelRuleRecords();
      expect(result.records).toEqual(mockRecords);
      expect(result.total).toBe(1);
    });
  });

  // ── SAR workflow ─────────────────────────────────────────────────────────

  describe("createSar()", () => {
    it("throws if required fields missing", async () => {
      await expect(svc.createSar({})).rejects.toThrow("activityType, description, periodStart, periodEnd required");
    });

    it("creates a SAR with draft status", async () => {
      const fakeSar = { sarId: "SAR-1", status: "draft", activityType: "STRUCTURING" };
      SuspiciousActivityReport.create.mockResolvedValue(fakeSar);

      const result = await svc.createSar({
        activityType: "STRUCTURING",
        description: "Suspicious pattern",
        periodStart: new Date("2024-01-01"),
        periodEnd: new Date("2024-01-31"),
      });
      expect(result.status).toBe("draft");
      expect(SuspiciousActivityReport.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: "draft", activityType: "STRUCTURING" })
      );
    });
  });

  describe("submitSar()", () => {
    it("throws if SAR not found", async () => {
      SuspiciousActivityReport.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
      await expect(svc.submitSar("SAR-missing")).rejects.toThrow("SAR not found");
    });

    it("throws if SAR status is already filed", async () => {
      SuspiciousActivityReport.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue({ sarId: "SAR-1", status: "filed" }),
      });
      await expect(svc.submitSar("SAR-1")).rejects.toThrow("SAR cannot be filed");
    });

    it("files a draft SAR successfully", async () => {
      const sarBefore = { sarId: "SAR-1", status: "draft", activityType: "STRUCTURING" };
      const sarAfter  = { ...sarBefore, status: "filed", filedWith: "FinCEN" };

      SuspiciousActivityReport.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(sarBefore) });
      SuspiciousActivityReport.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(sarAfter) });

      const result = await svc.submitSar("SAR-1", { filedWith: "FinCEN" });
      expect(result.status).toBe("filed");
      expect(eventBus.publish).toHaveBeenCalledWith("compliance.sar.filed", expect.any(Object));
      expect(svc._stats.sarsFiled).toBe(1);
    });

    it("publishes sar.filed event with correct payload", async () => {
      const sar = { sarId: "SAR-2", status: "approved", activityType: "VELOCITY_BREACH" };
      SuspiciousActivityReport.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(sar) });
      SuspiciousActivityReport.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue({ ...sar, status: "filed" }) });

      await svc.submitSar("SAR-2", { filedWith: "FCA" });
      expect(eventBus.publish).toHaveBeenCalledWith(
        "compliance.sar.filed",
        expect.objectContaining({ sarId: "SAR-2", activityType: "VELOCITY_BREACH", filedWith: "FCA" })
      );
    });
  });

  describe("getSars()", () => {
    it("returns paginated SARs", async () => {
      const mockSars = [{ sarId: "SAR-1" }];
      SuspiciousActivityReport.find.mockReturnValue({
        sort: () => ({ skip: () => ({ limit: () => ({ lean: vi.fn().mockResolvedValue(mockSars) }) }) }),
      });
      SuspiciousActivityReport.countDocuments.mockResolvedValue(1);

      const result = await svc.getSars();
      expect(result.sars).toEqual(mockSars);
      expect(result.total).toBe(1);
    });
  });

  // ── Regulatory reports ────────────────────────────────────────────────────

  describe("generateReport()", () => {
    it("throws if required fields missing", async () => {
      await expect(svc.generateReport({ type: "DAILY" })).rejects.toThrow(
        "type, periodStart, periodEnd required"
      );
    });

    it("creates a report with generating status", async () => {
      const fakeReport = { reportId: "RPT-1", status: "generating", type: "DAILY" };
      ComplianceReport.create.mockResolvedValue(fakeReport);
      AmlAlert.countDocuments.mockResolvedValue(5);
      SuspiciousActivityReport.countDocuments.mockResolvedValue(2);
      TravelRuleRecord.countDocuments.mockResolvedValue(10);
      ComplianceReport.findOneAndUpdate.mockResolvedValue({});

      const result = await svc.generateReport({
        type: "DAILY",
        periodStart: "2024-01-01",
        periodEnd: "2024-01-31",
      });
      expect(result.status).toBe("generating");
      expect(svc._stats.reportsGenerated).toBe(1);
    });
  });

  describe("getReports()", () => {
    it("returns paginated reports", async () => {
      const mockReports = [{ reportId: "RPT-1", type: "WEEKLY" }];
      ComplianceReport.find.mockReturnValue({
        sort: () => ({ skip: () => ({ limit: () => ({ lean: vi.fn().mockResolvedValue(mockReports) }) }) }),
      });
      ComplianceReport.countDocuments.mockResolvedValue(1);

      const result = await svc.getReports({ type: "WEEKLY" });
      expect(result.reports).toEqual(mockReports);
      expect(result.total).toBe(1);
    });
  });

  // ── Statistics ────────────────────────────────────────────────────────────

  describe("getStatistics()", () => {
    it("returns aggregated statistics from DB", async () => {
      SanctionHit.countDocuments
        .mockResolvedValueOnce(10)  // total
        .mockResolvedValueOnce(3)   // pending
        .mockResolvedValueOnce(5)   // confirmed
        .mockResolvedValueOnce(2);  // false_positive
      TravelRuleRecord.countDocuments.mockResolvedValue(20);
      SuspiciousActivityReport.countDocuments
        .mockResolvedValueOnce(4)   // draft
        .mockResolvedValueOnce(1);  // filed
      ComplianceReport.countDocuments.mockResolvedValue(7);

      const stats = await svc.getStatistics();
      expect(stats.sanctions.total).toBe(10);
      expect(stats.sanctions.pending).toBe(3);
      expect(stats.travelRule.total).toBe(20);
      expect(stats.sar.draft).toBe(4);
      expect(stats.reports.total).toBe(7);
    });
  });

  // ── AML auto-SAR escalation ───────────────────────────────────────────────

  describe("_onAmlAlert()", () => {
    it("auto-creates SAR for riskScore >= 90", async () => {
      const fakeSar = { sarId: "SAR-auto-1", status: "draft" };
      SuspiciousActivityReport.create.mockResolvedValue(fakeSar);

      await svc._onAmlAlert({
        riskScore: 95,
        userId: "user1",
        alertId: "ALT-1",
        alertType: "velocity_breach",
        description: "High velocity detected",
        amountUsd: 50000,
      });

      expect(SuspiciousActivityReport.create).toHaveBeenCalledWith(
        expect.objectContaining({ activityType: "VELOCITY_BREACH", status: "draft" })
      );
    });

    it("does NOT create SAR for riskScore < 90", async () => {
      await svc._onAmlAlert({ riskScore: 70, userId: "user2", alertId: "ALT-2" });
      expect(SuspiciousActivityReport.create).not.toHaveBeenCalled();
    });
  });

  // ── Stats counters ────────────────────────────────────────────────────────

  describe("in-memory stats", () => {
    it("initializes all counters to zero", () => {
      expect(svc._stats.sanctionScreenings).toBe(0);
      expect(svc._stats.hitsFound).toBe(0);
      expect(svc._stats.travelRuleRecords).toBe(0);
      expect(svc._stats.sarsFiled).toBe(0);
      expect(svc._stats.reportsGenerated).toBe(0);
    });

    it("increments hitsFound when a sanction hit is created", async () => {
      SanctionHit.create.mockResolvedValue({ hitId: "SHT-1" });
      await svc.screenEntity({ address: "0x0000test" });
      expect(svc._stats.hitsFound).toBe(1);
    });
  });
});
