/**
 * Stage 36 — Global Financial Ecosystem Platform
 * Tests: GlobalEcosystemService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GlobalEcosystemService } from "../../services/globalEcosystemService.js";

vi.mock("../../models/EcosystemPartner.js", () => ({
  default: {
    create:          vi.fn(),
    find:            vi.fn(),
    findOneAndUpdate:vi.fn(),
    countDocuments:  vi.fn(),
  },
}));

vi.mock("../../models/CrossBorderPayment.js", () => ({
  default: {
    create:          vi.fn(),
    find:            vi.fn(),
    findOneAndUpdate:vi.fn(),
    countDocuments:  vi.fn(),
  },
}));

vi.mock("../../models/EcosystemIntegration.js", () => ({
  default: {
    create:          vi.fn(),
    find:            vi.fn(),
    findOneAndUpdate:vi.fn(),
    countDocuments:  vi.fn(),
  },
}));

vi.mock("../../infra/eventBus.js", () => ({
  eventBus: { on: vi.fn(), publish: vi.fn() },
}));

vi.mock("../../config/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import EcosystemPartner     from "../../models/EcosystemPartner.js";
import CrossBorderPayment   from "../../models/CrossBorderPayment.js";
import EcosystemIntegration from "../../models/EcosystemIntegration.js";
import { eventBus }         from "../../infra/eventBus.js";

describe("GlobalEcosystemService", () => {
  let svc;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new GlobalEcosystemService();
  });

  afterEach(() => {
    svc.stop();
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────

  describe("start() / stop()", () => {
    it("sets _started to true", async () => {
      EcosystemIntegration.countDocuments.mockResolvedValue(0);
      await svc.start();
      expect(svc._started).toBe(true);
    });

    it("is idempotent", async () => {
      await svc.start();
      const t = svc._healthTimer;
      await svc.start();
      expect(svc._healthTimer).toBe(t);
    });

    it("clears timer on stop", async () => {
      await svc.start();
      svc.stop();
      expect(svc._healthTimer).toBeNull();
      expect(svc._started).toBe(false);
    });
  });

  // ── Partner registry ──────────────────────────────────────────────────────

  describe("onboardPartner()", () => {
    it("throws if name or type missing", async () => {
      await expect(svc.onboardPartner({ name: "Acme" })).rejects.toThrow("name and type required");
    });

    it("throws for invalid type", async () => {
      await expect(svc.onboardPartner({ name: "X", type: "hedge_fund" }))
        .rejects.toThrow("Invalid type");
    });

    it("creates partner with pending status", async () => {
      const fake = { partnerId: "PRT-1", name: "Binance", type: "exchange", status: "pending" };
      EcosystemPartner.create.mockResolvedValue(fake);

      const result = await svc.onboardPartner({ name: "Binance", type: "exchange" });
      expect(result.status).toBe("pending");
      expect(EcosystemPartner.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: "pending", type: "exchange" })
      );
    });

    it("increments partnerOnboarded stat", async () => {
      EcosystemPartner.create.mockResolvedValue({ partnerId: "PRT-1" });
      await svc.onboardPartner({ name: "X", type: "bank" });
      expect(svc._stats.partnerOnboarded).toBe(1);
    });
  });

  describe("activatePartner()", () => {
    it("throws if partner not found", async () => {
      EcosystemPartner.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
      await expect(svc.activatePartner("PRT-missing")).rejects.toThrow("Partner not found");
    });

    it("activates partner and publishes event", async () => {
      const partner = { partnerId: "PRT-1", name: "Binance", status: "active" };
      EcosystemPartner.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(partner) });

      const result = await svc.activatePartner("PRT-1");
      expect(result.status).toBe("active");
      expect(eventBus.publish).toHaveBeenCalledWith("ecosystem.partner.activated", expect.any(Object));
    });
  });

  describe("updatePartnerRating()", () => {
    it("throws for score out of range", async () => {
      await expect(svc.updatePartnerRating("PRT-1", 150)).rejects.toThrow("Score must be between 0 and 100");
    });

    it("throws for negative score", async () => {
      await expect(svc.updatePartnerRating("PRT-1", -5)).rejects.toThrow("Score must be between 0 and 100");
    });

    it("throws if partner not found", async () => {
      EcosystemPartner.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
      await expect(svc.updatePartnerRating("PRT-missing", 75)).rejects.toThrow("Partner not found");
    });

    it("updates rating score", async () => {
      const partner = { partnerId: "PRT-1", ratingScore: 85 };
      EcosystemPartner.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(partner) });

      const result = await svc.updatePartnerRating("PRT-1", 85);
      expect(result.ratingScore).toBe(85);
    });
  });

  describe("getPartners()", () => {
    it("returns paginated partners", async () => {
      const mockPartners = [{ partnerId: "PRT-1" }];
      EcosystemPartner.find.mockReturnValue({
        sort: () => ({ skip: () => ({ limit: () => ({ lean: vi.fn().mockResolvedValue(mockPartners) }) }) }),
      });
      EcosystemPartner.countDocuments.mockResolvedValue(1);

      const result = await svc.getPartners();
      expect(result.partners).toEqual(mockPartners);
      expect(result.total).toBe(1);
    });
  });

  // ── Cross-border payments ─────────────────────────────────────────────────

  describe("initiatePayment()", () => {
    it("throws if required fields missing", async () => {
      await expect(svc.initiatePayment({ sourceCurrency: "USD" })).rejects.toThrow(
        "sourceCurrency, targetCurrency, and sourceAmount required"
      );
    });

    it("creates payment with processing status", async () => {
      const fakePayment = { paymentId: "PAY-1", status: "processing" };
      CrossBorderPayment.create.mockResolvedValue(fakePayment);
      CrossBorderPayment.findOneAndUpdate.mockResolvedValue({});

      const result = await svc.initiatePayment({
        sourceCurrency: "USD", targetCurrency: "EUR", sourceAmount: 1000,
      });
      expect(result.status).toBe("processing");
      expect(svc._stats.paymentsProcessed).toBe(1);
    });

    it("calculates target amount from FX rate", async () => {
      CrossBorderPayment.create.mockResolvedValue({ paymentId: "PAY-2", status: "processing" });
      CrossBorderPayment.findOneAndUpdate.mockResolvedValue({});

      await svc.initiatePayment({ sourceCurrency: "USD", targetCurrency: "EUR", sourceAmount: 1000 });
      expect(CrossBorderPayment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceCurrency: "USD",
          targetCurrency: "EUR",
          sourceAmount: 1000,
          targetAmount: expect.any(Number),
        })
      );
    });

    it("marks payment completed via setImmediate", async () => {
      CrossBorderPayment.create.mockResolvedValue({ paymentId: "PAY-3" });
      CrossBorderPayment.findOneAndUpdate.mockResolvedValue({});

      await svc.initiatePayment({ sourceCurrency: "USD", targetCurrency: "GBP", sourceAmount: 500 });
      await new Promise((r) => setImmediate(r));
      expect(CrossBorderPayment.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ paymentId: expect.stringContaining("PAY-") }),
        expect.objectContaining({ status: "completed" })
      );
    });

    it("same-currency payment has rate of ~1", async () => {
      CrossBorderPayment.create.mockResolvedValue({ paymentId: "PAY-4" });
      CrossBorderPayment.findOneAndUpdate.mockResolvedValue({});

      await svc.initiatePayment({ sourceCurrency: "USD", targetCurrency: "USD", sourceAmount: 100 });
      expect(CrossBorderPayment.create).toHaveBeenCalledWith(
        expect.objectContaining({ exchangeRate: expect.closeTo(1, 1) })
      );
    });
  });

  describe("getPayments()", () => {
    it("returns paginated payments", async () => {
      const mockPayments = [{ paymentId: "PAY-1" }];
      CrossBorderPayment.find.mockReturnValue({
        sort: () => ({ skip: () => ({ limit: () => ({ lean: vi.fn().mockResolvedValue(mockPayments) }) }) }),
      });
      CrossBorderPayment.countDocuments.mockResolvedValue(1);

      const result = await svc.getPayments();
      expect(result.payments).toEqual(mockPayments);
      expect(result.total).toBe(1);
    });
  });

  // ── Integrations ──────────────────────────────────────────────────────────

  describe("createIntegration()", () => {
    it("throws if required fields missing", async () => {
      await expect(svc.createIntegration({ partnerId: "PRT-1" })).rejects.toThrow(
        "partnerId and type required"
      );
    });

    it("throws for invalid type", async () => {
      await expect(svc.createIntegration({ partnerId: "PRT-1", type: "ftp_push" }))
        .rejects.toThrow("Invalid integration type");
    });

    it("creates integration with configured status", async () => {
      const fakeInt = { integrationId: "INT-1", status: "configured", type: "webhook" };
      EcosystemIntegration.create.mockResolvedValue(fakeInt);

      const result = await svc.createIntegration({ partnerId: "PRT-1", type: "webhook" });
      expect(result.status).toBe("configured");
      expect(svc._stats.integrationsActive).toBe(1);
    });
  });

  describe("recordIntegrationCall()", () => {
    it("throws if integration not found", async () => {
      EcosystemIntegration.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
      await expect(svc.recordIntegrationCall("INT-missing", { success: true }))
        .rejects.toThrow("Integration not found");
    });

    it("increments callCount on success", async () => {
      const int = { integrationId: "INT-1", callCount: 5, status: "active" };
      EcosystemIntegration.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(int) });

      const result = await svc.recordIntegrationCall("INT-1", { success: true });
      expect(EcosystemIntegration.findOneAndUpdate).toHaveBeenCalledWith(
        { integrationId: "INT-1" },
        expect.objectContaining({ $inc: { callCount: 1 }, status: "active" }),
        { new: true }
      );
    });

    it("increments errorCount and sets status failing on error", async () => {
      const int = { integrationId: "INT-2", callCount: 3, errorCount: 1, status: "failing" };
      EcosystemIntegration.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(int) });

      await svc.recordIntegrationCall("INT-2", { success: false, errorMessage: "Timeout" });
      expect(EcosystemIntegration.findOneAndUpdate).toHaveBeenCalledWith(
        { integrationId: "INT-2" },
        expect.objectContaining({ $inc: { callCount: 1, errorCount: 1 }, status: "failing" }),
        { new: true }
      );
    });
  });

  describe("getIntegrations()", () => {
    it("returns paginated integrations", async () => {
      const mockInts = [{ integrationId: "INT-1" }];
      EcosystemIntegration.find.mockReturnValue({
        sort: () => ({ skip: () => ({ limit: () => ({ lean: vi.fn().mockResolvedValue(mockInts) }) }) }),
      });
      EcosystemIntegration.countDocuments.mockResolvedValue(1);

      const result = await svc.getIntegrations();
      expect(result.integrations).toEqual(mockInts);
      expect(result.total).toBe(1);
    });
  });

  // ── Statistics ────────────────────────────────────────────────────────────

  describe("getStatistics()", () => {
    it("returns aggregated stats from DB", async () => {
      EcosystemPartner.countDocuments
        .mockResolvedValueOnce(10)   // total
        .mockResolvedValueOnce(7);   // active
      CrossBorderPayment.countDocuments
        .mockResolvedValueOnce(100)  // total
        .mockResolvedValueOnce(95);  // completed
      EcosystemIntegration.countDocuments
        .mockResolvedValueOnce(20)   // total
        .mockResolvedValueOnce(18)   // active
        .mockResolvedValueOnce(2);   // failing

      const stats = await svc.getStatistics();
      expect(stats.partners.total).toBe(10);
      expect(stats.partners.active).toBe(7);
      expect(stats.payments.completed).toBe(95);
      expect(stats.integrations.failing).toBe(2);
    });
  });
});
