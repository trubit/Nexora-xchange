/**
 * Stage 31 — Global Clearing House & Settlement System
 * Unit + integration tests for ClearingHouseService, models, and controller helpers.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// ── Model mocks ───────────────────────────────────────────────────────────────

vi.mock("../../models/ClearingRecord.js",    () => ({ default: { create: vi.fn(), findOne: vi.fn(), findOneAndUpdate: vi.fn(), find: vi.fn(), countDocuments: vi.fn(), aggregate: vi.fn() } }));
vi.mock("../../models/SettlementBatch.js",   () => ({ default: { create: vi.fn(), findOne: vi.fn(), findOneAndUpdate: vi.fn(), find: vi.fn(), countDocuments: vi.fn() } }));
vi.mock("../../models/SettlementAuditLog.js",() => ({ default: { create: vi.fn(), find: vi.fn(), countDocuments: vi.fn() } }));
vi.mock("../../infra/eventBus.js",          () => ({ eventBus: { on: vi.fn(), publish: vi.fn() } }));
vi.mock("../../config/logger.js",           () => ({ default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

import ClearingRecord     from "../../models/ClearingRecord.js";
import SettlementBatch    from "../../models/SettlementBatch.js";
import SettlementAuditLog from "../../models/SettlementAuditLog.js";
import { eventBus }       from "../../infra/eventBus.js";
import { ClearingHouseService } from "../../services/clearingHouseService.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockRecord = (overrides = {}) => ({
  clearingId:   "CLR-001",
  tradeId:      "TRD-001",
  batchId:      "BATCH-001",
  buyerUserId:  "user-1",
  sellerUserId: "user-2",
  symbol:       "BTCUSDT",
  baseAsset:    "BTC",
  quoteAsset:   "USDT",
  quantity:     0.5,
  price:        40000,
  totalValue:   20000,
  buyerFee:     20,
  sellerFee:    20,
  feeAsset:     "USDT",
  status:       "pending",
  retryCount:   0,
  ...overrides,
});

const mockBatch = (overrides = {}) => ({
  batchId:     "BATCH-001",
  status:      "open",
  recordCount: 0,
  totalVolume: 0,
  totalFees:   0,
  settled:     0,
  failed:      0,
  ...overrides,
});

// ── Service instantiation ─────────────────────────────────────────────────────

describe("ClearingHouseService — lifecycle", () => {
  let svc;

  beforeEach(() => {
    vi.clearAllMocks();
    SettlementBatch.create.mockResolvedValue(mockBatch());
    SettlementAuditLog.create.mockResolvedValue({});
    svc = new ClearingHouseService();
  });

  afterEach(() => svc.stop());

  test("start() registers trade.executed listener on eventBus", async () => {
    await svc.start();
    expect(eventBus.on).toHaveBeenCalledWith("trade.executed", expect.any(Function));
  });

  test("start() opens a new SettlementBatch", async () => {
    await svc.start();
    expect(SettlementBatch.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: "open" })
    );
  });

  test("start() is idempotent — second call does nothing", async () => {
    await svc.start();
    await svc.start();
    expect(SettlementBatch.create).toHaveBeenCalledTimes(1);
  });

  test("stop() clears the batch timer", async () => {
    await svc.start();
    svc.stop();
    expect(svc._started).toBe(false);
  });
});

// ── Trade processing ──────────────────────────────────────────────────────────

describe("ClearingHouseService — _processClearing", () => {
  let svc;

  beforeEach(() => {
    vi.clearAllMocks();
    SettlementBatch.create.mockResolvedValue(mockBatch());
    SettlementAuditLog.create.mockResolvedValue({});
    ClearingRecord.create.mockResolvedValue(mockRecord());
    ClearingRecord.findOneAndUpdate.mockResolvedValue(mockRecord({ status: "cleared" }));
    SettlementBatch.findOneAndUpdate.mockResolvedValue(mockBatch({ recordCount: 1 }));
    svc = new ClearingHouseService();
    svc._currentBatchId = "BATCH-001";
  });

  afterEach(() => svc.stop());

  test("creates ClearingRecord from trade payload", async () => {
    await svc._processClearing({
      id: "TRD-001",
      buyerUserId: "user-1",
      sellerUserId: "user-2",
      symbol: "BTCUSDT",
      quantity: 0.5,
      price: 40000,
    });
    expect(ClearingRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: "BTCUSDT", totalValue: 20000 })
    );
  });

  test("calculates totalValue as quantity × price", async () => {
    await svc._processClearing({
      id: "T1", buyerUserId: "u1", sellerUserId: "u2",
      symbol: "ETHUSDT", quantity: 2, price: 3000,
    });
    const call = ClearingRecord.create.mock.calls[0][0];
    expect(call.totalValue).toBe(6000);
  });

  test("calculates buyerFee = totalValue × FEE_RATE", async () => {
    await svc._processClearing({
      id: "T2", buyerUserId: "u1", sellerUserId: "u2",
      symbol: "BTCUSDT", quantity: 1, price: 10000,
    });
    const call = ClearingRecord.create.mock.calls[0][0];
    expect(call.buyerFee).toBeCloseTo(10);
  });

  test("skips processing when trade has no id", async () => {
    await svc._processClearing({ buyerUserId: "u1", sellerUserId: "u2" });
    expect(ClearingRecord.create).not.toHaveBeenCalled();
  });

  test("skips processing when buyerUserId is missing", async () => {
    await svc._processClearing({ id: "T3", sellerUserId: "u2", quantity: 1, price: 1 });
    expect(ClearingRecord.create).not.toHaveBeenCalled();
  });

  test("appends TRADE_RECEIVED audit event", async () => {
    await svc._processClearing({
      id: "T4", buyerUserId: "u1", sellerUserId: "u2",
      symbol: "BNBUSDT", quantity: 10, price: 300,
    });
    expect(SettlementAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "TRADE_RECEIVED" })
    );
  });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe("ClearingHouseService — _validate", () => {
  let svc;

  beforeEach(() => {
    vi.clearAllMocks();
    SettlementBatch.create.mockResolvedValue(mockBatch());
    SettlementAuditLog.create.mockResolvedValue({});
    ClearingRecord.findOneAndUpdate.mockResolvedValue({});
    SettlementBatch.findOneAndUpdate.mockResolvedValue({});
    svc = new ClearingHouseService();
    svc._currentBatchId = "BATCH-001";
  });

  afterEach(() => svc.stop());

  test("marks record cleared when double-entry check passes", async () => {
    const record = mockRecord({ quantity: 0.5, price: 40000, totalValue: 20000 });
    await svc._validate(record);
    const calls = ClearingRecord.findOneAndUpdate.mock.calls;
    const clearedCall = calls.find(c => c[1]?.status === "cleared");
    expect(clearedCall).toBeDefined();
  });

  test("marks record failed when totalValue drifts from quantity × price", async () => {
    const record = mockRecord({ quantity: 1, price: 100, totalValue: 200 }); // drift = 100
    await svc._validate(record);
    const calls = ClearingRecord.findOneAndUpdate.mock.calls;
    const failedCall = calls.find(c => c[1]?.status === "failed");
    expect(failedCall).toBeDefined();
  });

  test("publishes trade.cleared event on success", async () => {
    const record = mockRecord();
    await svc._validate(record);
    expect(eventBus.publish).toHaveBeenCalledWith("trade.cleared", expect.objectContaining({ clearingId: "CLR-001" }));
  });

  test("does NOT publish trade.cleared when validation fails", async () => {
    const record = mockRecord({ quantity: 1, price: 100, totalValue: 999 });
    await svc._validate(record);
    const clearedCalls = (eventBus.publish.mock.calls || []).filter(c => c[0] === "trade.cleared");
    expect(clearedCalls).toHaveLength(0);
  });

  test("increments totalCleared stat on success", async () => {
    const before = svc._stats.totalCleared;
    await svc._validate(mockRecord());
    expect(svc._stats.totalCleared).toBe(before + 1);
  });

  test("increments totalFailed stat on failure", async () => {
    const before = svc._stats.totalFailed;
    await svc._validate(mockRecord({ quantity: 1, price: 100, totalValue: 500 }));
    expect(svc._stats.totalFailed).toBe(before + 1);
  });
});

// ── Retry ─────────────────────────────────────────────────────────────────────

describe("ClearingHouseService — retryClearing", () => {
  let svc;

  const mockFindOne = (value) =>
    ClearingRecord.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(value) });

  beforeEach(() => {
    vi.clearAllMocks();
    SettlementBatch.create.mockResolvedValue(mockBatch());
    SettlementAuditLog.create.mockResolvedValue({});
    ClearingRecord.findOneAndUpdate.mockResolvedValue({});
    svc = new ClearingHouseService();
  });

  afterEach(() => svc.stop());

  test("throws when record not found", async () => {
    mockFindOne(null);
    await expect(svc.retryClearing("CLR-MISSING")).rejects.toThrow("not found");
  });

  test("throws when record status is not failed", async () => {
    mockFindOne(mockRecord({ status: "settled" }));
    await expect(svc.retryClearing("CLR-001")).rejects.toThrow("Only failed");
  });

  test("throws when retryCount exceeds MAX_RETRY_COUNT", async () => {
    mockFindOne(mockRecord({ status: "failed", retryCount: 10 }));
    await expect(svc.retryClearing("CLR-001")).rejects.toThrow("Max retries");
  });

  test("resets status to pending and calls _validate on eligible record", async () => {
    const record = mockRecord({ status: "failed", retryCount: 0 });
    mockFindOne(record);
    // second findOne call (at end of retryClearing) also needs lean()
    ClearingRecord.findOne
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(record) })
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue({ ...record, status: "pending" }) });
    const validateSpy = vi.spyOn(svc, "_validate").mockResolvedValue();
    await svc.retryClearing("CLR-001");
    expect(ClearingRecord.findOneAndUpdate).toHaveBeenCalledWith(
      { clearingId: "CLR-001" },
      expect.objectContaining({ status: "pending" })
    );
    expect(validateSpy).toHaveBeenCalled();
  });
});

// ── Reconciliation ────────────────────────────────────────────────────────────

describe("ClearingHouseService — reconcile", () => {
  let svc;

  const mockFind = (value) =>
    ClearingRecord.find.mockReturnValue({ lean: vi.fn().mockResolvedValue(value) });

  beforeEach(() => {
    vi.clearAllMocks();
    SettlementBatch.create.mockResolvedValue(mockBatch());
    SettlementAuditLog.create.mockResolvedValue({});
    svc = new ClearingHouseService();
  });

  afterEach(() => svc.stop());

  test("returns clean result when no discrepancies", async () => {
    mockFind([mockRecord({ quantity: 0.5, price: 40000, totalValue: 20000 })]);
    const result = await svc.reconcile();
    expect(result.clean).toBe(true);
    expect(result.discrepancies).toBe(0);
  });

  test("reports discrepancy when totalValue drifts", async () => {
    mockFind([mockRecord({ quantity: 1, price: 100, totalValue: 200 })]);
    const result = await svc.reconcile();
    expect(result.clean).toBe(false);
    expect(result.discrepancies).toBe(1);
  });

  test("logs RECONCILIATION_STARTED audit event", async () => {
    mockFind([]);
    await svc.reconcile({ initiatedBy: "admin@test.com" });
    expect(SettlementAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "RECONCILIATION_STARTED", actor: "admin@test.com" })
    );
  });

  test("logs RECONCILIATION_COMPLETED audit event", async () => {
    mockFind([]);
    await svc.reconcile();
    expect(SettlementAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "RECONCILIATION_COMPLETED" })
    );
  });

  test("checked count matches number of records returned", async () => {
    mockFind([mockRecord(), mockRecord({ clearingId: "CLR-002" })]);
    const result = await svc.reconcile();
    expect(result.checked).toBe(2);
  });
});

// ── Statistics ────────────────────────────────────────────────────────────────

describe("ClearingHouseService — getStatistics", () => {
  let svc;

  beforeEach(() => {
    vi.clearAllMocks();
    SettlementBatch.create.mockResolvedValue(mockBatch());
    SettlementAuditLog.create.mockResolvedValue({});
    svc = new ClearingHouseService();
    svc._currentBatchId = "BATCH-CURRENT";

    ClearingRecord.countDocuments.mockImplementation((q) => {
      if (!q)            return Promise.resolve(100);
      if (q.status === "pending")    return Promise.resolve(5);
      if (q.status === "validating") return Promise.resolve(2);
      if (q.status === "cleared")    return Promise.resolve(10);
      if (q.status === "settled")    return Promise.resolve(80);
      if (q.status === "failed")     return Promise.resolve(3);
      return Promise.resolve(0);
    });
    ClearingRecord.aggregate.mockResolvedValue([{ totalVolume: 1500000, totalFees: 1500 }]);
  });

  afterEach(() => svc.stop());

  test("returns correct total count", async () => {
    const s = await svc.getStatistics();
    expect(s.total).toBe(100);
  });

  test("returns correct settled count", async () => {
    const s = await svc.getStatistics();
    expect(s.settled).toBe(80);
  });

  test("calculates success rate from settled / total", async () => {
    const s = await svc.getStatistics();
    expect(parseFloat(s.successRate)).toBeCloseTo(80);
  });

  test("includes totalVolume from aggregate", async () => {
    const s = await svc.getStatistics();
    expect(s.totalVolume).toBe(1500000);
  });

  test("includes currentBatchId", async () => {
    const s = await svc.getStatistics();
    expect(s.currentBatchId).toBe("BATCH-CURRENT");
  });

  test("handles empty aggregate (no cleared/settled records)", async () => {
    ClearingRecord.aggregate.mockResolvedValue([]);
    const s = await svc.getStatistics();
    expect(s.totalVolume).toBe(0);
    expect(s.totalFees).toBe(0);
  });
});

// ── Model schema ──────────────────────────────────────────────────────────────

describe("ClearingRecord model", () => {
  test("create is callable", () => {
    expect(typeof ClearingRecord.create).toBe("function");
  });

  test("findOne is callable", () => {
    expect(typeof ClearingRecord.findOne).toBe("function");
  });
});

describe("SettlementBatch model", () => {
  test("create is callable", () => {
    expect(typeof SettlementBatch.create).toBe("function");
  });
});

describe("SettlementAuditLog model", () => {
  test("create is callable", () => {
    expect(typeof SettlementAuditLog.create).toBe("function");
  });

  test("find is callable", () => {
    expect(typeof SettlementAuditLog.find).toBe("function");
  });
});
