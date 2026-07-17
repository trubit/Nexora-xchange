/**
 * Stage 29 — Institutional Client Layer
 * Tests: ClientManagementService (tiers, sub-accounts, rate limiting)
 *        InstitutionalApiGateway (key issuance, FIX protocol)
 *        FixProtocolAdapter (encode/decode)
 */

import { describe, test, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const { mockInstClient, mockSubAccount, mockApiKeyUsage, mockApiKey } = vi.hoisted(() => ({
  mockInstClient: {
    create:            vi.fn(),
    findById:          vi.fn(),
    findOne:           vi.fn(),
    findByIdAndUpdate: vi.fn(),
    find:              vi.fn(),
    countDocuments:    vi.fn(),
  },
  mockSubAccount: {
    create:            vi.fn(),
    find:              vi.fn(),
    findByIdAndUpdate: vi.fn(),
    countDocuments:    vi.fn(),
  },
  mockApiKeyUsage: {
    findOne: vi.fn(),
  },
  mockApiKey: {
    create:            vi.fn(),
    findOne:           vi.fn(),
    findOneAndUpdate:  vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findById:          vi.fn(),
    find:              vi.fn(),
  },
}));

vi.mock("../../config/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("../../models/InstitutionalClient.js", () => ({ default: mockInstClient }));
vi.mock("../../models/SubAccount.js",          () => ({ default: mockSubAccount }));
vi.mock("../../models/ApiKeyUsage.js",         () => ({ default: mockApiKeyUsage }));
vi.mock("../../models/ApiKey.js",              () => ({ default: mockApiKey }));

import { ClientManagementService, TIER_LIMITS } from "../../services/clientManagementService.js";
import { InstitutionalApiGateway, FixProtocolAdapter } from "../../services/institutionalApiGateway.js";

// ── TIER_LIMITS ───────────────────────────────────────────────────────────────

describe("TIER_LIMITS", () => {
  test("defines 4 tiers", () => {
    expect(Object.keys(TIER_LIMITS)).toHaveLength(4);
    expect(TIER_LIMITS).toHaveProperty("bronze");
    expect(TIER_LIMITS).toHaveProperty("platinum");
  });

  test("platinum has highest rateLimitRpm", () => {
    expect(TIER_LIMITS.platinum.rateLimitRpm).toBeGreaterThan(TIER_LIMITS.gold.rateLimitRpm);
  });

  test("each tier has required fields", () => {
    for (const [, limits] of Object.entries(TIER_LIMITS)) {
      expect(limits).toHaveProperty("rateLimitRpm");
      expect(limits).toHaveProperty("maxSubAccounts");
      expect(limits).toHaveProperty("maxOrderUsd");
      expect(limits).toHaveProperty("maxPositionUsd");
    }
  });
});

// ── ClientManagementService.registerClient ────────────────────────────────────

describe("ClientManagementService.registerClient", () => {
  beforeEach(() => vi.resetAllMocks());

  test("creates client with tier limits applied", async () => {
    const doc = { _id: "c1", name: "HedgeCo", tier: "silver", toObject: () => ({ _id: "c1", tier: "silver" }) };
    mockInstClient.create.mockResolvedValueOnce(doc);
    const svc = new ClientManagementService();
    const result = await svc.registerClient({ name: "HedgeCo", userId: "u1", contactEmail: "hco@example.com", tier: "silver" });
    expect(mockInstClient.create).toHaveBeenCalledOnce();
    const payload = mockInstClient.create.mock.calls[0][0];
    expect(payload.rateLimitRpm).toBe(TIER_LIMITS.silver.rateLimitRpm);
    expect(payload.maxSubAccounts).toBe(TIER_LIMITS.silver.maxSubAccounts);
    expect(result._id).toBe("c1");
  });

  test("defaults to bronze tier when no tier specified", async () => {
    const doc = { _id: "c2", toObject: () => ({ _id: "c2" }) };
    mockInstClient.create.mockResolvedValueOnce(doc);
    const svc = new ClientManagementService();
    await svc.registerClient({ name: "SmallFund", userId: "u2", contactEmail: "sf@example.com" });
    const payload = mockInstClient.create.mock.calls[0][0];
    expect(payload.tier).toBe("bronze");
  });
});

describe("ClientManagementService.updateClientTier", () => {
  beforeEach(() => vi.resetAllMocks());

  test("updates tier with new limits", async () => {
    const updated = { _id: "c1", tier: "gold" };
    mockInstClient.findByIdAndUpdate.mockReturnValueOnce({ lean: () => Promise.resolve(updated) });
    const svc = new ClientManagementService();
    const result = await svc.updateClientTier("c1", "gold");
    expect(result.tier).toBe("gold");
    const [id, payload] = mockInstClient.findByIdAndUpdate.mock.calls[0];
    expect(payload.rateLimitRpm).toBe(TIER_LIMITS.gold.rateLimitRpm);
  });

  test("throws for invalid tier", async () => {
    const svc = new ClientManagementService();
    await expect(svc.updateClientTier("c1", "diamond")).rejects.toThrow("Invalid tier");
  });
});

// ── ClientManagementService.createSubAccount ──────────────────────────────────

describe("ClientManagementService.createSubAccount", () => {
  beforeEach(() => vi.resetAllMocks());

  test("creates sub-account within limits", async () => {
    const client = { _id: "inst1", maxSubAccounts: 10, maxOrderUsd: 100_000, maxPositionUsd: 500_000 };
    mockInstClient.findById.mockReturnValueOnce({ lean: () => Promise.resolve(client) });
    mockSubAccount.countDocuments.mockResolvedValueOnce(2);  // 2 existing, max 10
    const subDoc = { _id: "sub1", name: "Desk A", toObject: () => ({ _id: "sub1", name: "Desk A" }) };
    mockSubAccount.create.mockResolvedValueOnce(subDoc);

    const svc = new ClientManagementService();
    const result = await svc.createSubAccount({ institutionId: "inst1", name: "Desk A" });
    expect(result.name).toBe("Desk A");
    expect(mockSubAccount.create).toHaveBeenCalledOnce();
  });

  test("throws when sub-account limit is reached", async () => {
    const client = { _id: "inst1", maxSubAccounts: 5, maxOrderUsd: 100_000, maxPositionUsd: 500_000 };
    mockInstClient.findById.mockReturnValueOnce({ lean: () => Promise.resolve(client) });
    mockSubAccount.countDocuments.mockResolvedValueOnce(5);  // at limit

    const svc = new ClientManagementService();
    await expect(svc.createSubAccount({ institutionId: "inst1", name: "Desk B" }))
      .rejects.toThrow("Sub-account limit reached");
  });

  test("throws when institution not found", async () => {
    mockInstClient.findById.mockReturnValueOnce({ lean: () => Promise.resolve(null) });
    mockSubAccount.countDocuments.mockResolvedValueOnce(0);
    const svc = new ClientManagementService();
    await expect(svc.createSubAccount({ institutionId: "bad", name: "Test" }))
      .rejects.toThrow("not found");
  });

  test("sub-account maxOrderUsd is capped to parent limit", async () => {
    const client = { _id: "inst1", maxSubAccounts: 10, maxOrderUsd: 100_000, maxPositionUsd: 500_000 };
    mockInstClient.findById.mockReturnValueOnce({ lean: () => Promise.resolve(client) });
    mockSubAccount.countDocuments.mockResolvedValueOnce(0);
    const subDoc = { _id: "sub1", toObject: () => ({}) };
    mockSubAccount.create.mockResolvedValueOnce(subDoc);

    const svc = new ClientManagementService();
    await svc.createSubAccount({ institutionId: "inst1", name: "Desk C", maxOrderUsd: 999_999 });
    const payload = mockSubAccount.create.mock.calls[0][0];
    expect(payload.maxOrderUsd).toBe(100_000);  // capped to parent
  });
});

// ── ClientManagementService.validateOrderSize ─────────────────────────────────

describe("ClientManagementService.validateOrderSize", () => {
  const svc = new ClientManagementService();

  test("returns valid=true when order is within limit", () => {
    const result = svc.validateOrderSize({ maxOrderUsd: 100_000 }, 50_000);
    expect(result.valid).toBe(true);
  });

  test("returns valid=false when order exceeds limit", () => {
    const result = svc.validateOrderSize({ maxOrderUsd: 100_000 }, 200_000);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("exceeds limit");
  });

  test("returns valid=true when order equals limit exactly", () => {
    const result = svc.validateOrderSize({ maxOrderUsd: 100_000 }, 100_000);
    expect(result.valid).toBe(true);
  });
});

// ── ClientManagementService.checkRateLimit ────────────────────────────────────

describe("ClientManagementService.checkRateLimit", () => {
  beforeEach(() => vi.resetAllMocks());

  test("returns allowed=false for disabled client", async () => {
    mockInstClient.findById.mockReturnValueOnce({ lean: () => Promise.resolve({ enabled: false, rateLimitRpm: 120 }) });
    const svc = new ClientManagementService();
    const result = await svc.checkRateLimit("inst1");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("disabled");
  });

  test("returns allowed=true when under rate limit", async () => {
    const client = { enabled: true, rateLimitRpm: 120, orderRateLimit: 60 };
    mockInstClient.findById.mockReturnValueOnce({ lean: () => Promise.resolve(client) });
    mockApiKeyUsage.findOne.mockReturnValueOnce({ lean: () => Promise.resolve({ requests: 50, orders: 5 }) });
    const svc = new ClientManagementService();
    const result = await svc.checkRateLimit("inst1", { requests: 1 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(120 - 51);
  });

  test("returns allowed=false when rpm exceeded", async () => {
    const client = { enabled: true, rateLimitRpm: 10, orderRateLimit: 60 };
    mockInstClient.findById.mockReturnValueOnce({ lean: () => Promise.resolve(client) });
    mockApiKeyUsage.findOne.mockReturnValueOnce({ lean: () => Promise.resolve({ requests: 10, orders: 0 }) });
    const svc = new ClientManagementService();
    const result = await svc.checkRateLimit("inst1", { requests: 1 });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("rpm_exceeded");
  });
});

// ── FixProtocolAdapter ────────────────────────────────────────────────────────

describe("FixProtocolAdapter.encode / decode", () => {
  const fix = new FixProtocolAdapter();

  test("encode produces a pipe-delimited string with tag=value pairs", () => {
    const msg = fix.encode("D", { "11": "order1", "55": "BTC/USDT" });
    expect(msg).toContain("35=D");
    expect(msg).toContain("11=order1");
    expect(msg).toContain("55=BTC/USDT");
  });

  test("decode recovers all fields from encoded message", () => {
    const msg    = "8=FIXT.1.1|35=D|11=order1|55=BTC/USDT";
    const fields = fix.decode(msg);
    expect(fields["8"]).toBe("FIXT.1.1");
    expect(fields["35"]).toBe("D");
    expect(fields["11"]).toBe("order1");
    expect(fields["55"]).toBe("BTC/USDT");
  });

  test("decode returns null for empty message", () => {
    expect(fix.decode("")).toBeNull();
  });

  test("decode returns null for null input", () => {
    expect(fix.decode(null)).toBeNull();
  });

  test("encodeNewOrder produces tag 55 (symbol) and 54 (side)", () => {
    const msg = fix.encodeNewOrder({ clOrdId: "c1", symbol: "BTC/USDT", side: "buy", quantity: 1, price: 60000 });
    const fields = fix.decode(msg);
    expect(fields["55"]).toBe("BTC/USDT");
    expect(fields["54"]).toBe("1");   // buy = "1"
    expect(fields["38"]).toBe("1");   // quantity
  });

  test("encodeNewOrder maps sell side to FIX '2'", () => {
    const msg    = fix.encodeNewOrder({ clOrdId: "c2", symbol: "ETH/USDT", side: "sell", quantity: 5 });
    const fields = fix.decode(msg);
    expect(fields["54"]).toBe("2");
  });

  test("encodeExecutionReport includes orderId (37) and execType (150)", () => {
    const msg = fix.encodeExecutionReport({
      clOrdId: "c1", orderId: "o1", execType: "F", side: "buy",
      symbol: "BTC/USDT", filledQty: 1, price: 60000, status: "2",
    });
    const fields = fix.decode(msg);
    expect(fields["37"]).toBe("o1");
    expect(fields["150"]).toBe("F");
  });

  test("encode/decode roundtrip is lossless for standard fields", () => {
    const original = { "11": "ord123", "55": "ETH/USDT", "38": "2.5", "44": "3500" };
    const encoded  = fix.encode("D", original);
    const decoded  = fix.decode(encoded);
    expect(decoded["11"]).toBe("ord123");
    expect(decoded["38"]).toBe("2.5");
  });
});

// ── InstitutionalApiGateway.issueApiKey ───────────────────────────────────────

describe("InstitutionalApiGateway.issueApiKey", () => {
  beforeEach(() => vi.resetAllMocks());

  test("creates an API key with TSRX- prefix", async () => {
    const doc = {
      _id: "k1", key: "TSRX-ABCDEF", enabled: true, permissions: ["read", "trade"],
      toObject: () => ({ _id: "k1", key: "TSRX-ABCDEF", permissions: ["read", "trade"] }),
    };
    mockApiKey.create.mockResolvedValueOnce(doc);
    const gw     = new InstitutionalApiGateway();
    const result = await gw.issueApiKey({ userId: "u1", institutionId: "i1", name: "Trading Key" });
    expect(result.key).toMatch(/^TSRX-/);
    expect(result).toHaveProperty("secret");    // one-time secret returned
  });

  test("stores hashed secret, not plaintext", async () => {
    const doc = { _id: "k2", toObject: () => ({ _id: "k2", key: "TSRX-TEST" }) };
    mockApiKey.create.mockResolvedValueOnce(doc);
    const gw = new InstitutionalApiGateway();
    await gw.issueApiKey({ userId: "u1", institutionId: "i1", name: "Key B" });
    const payload = mockApiKey.create.mock.calls[0][0];
    expect(payload).toHaveProperty("hashedSecret");
    expect(payload).not.toHaveProperty("secret");
  });
});

describe("InstitutionalApiGateway.revokeApiKey", () => {
  beforeEach(() => vi.resetAllMocks());

  test("sets enabled=false for the key", async () => {
    const updated = { _id: "k1", enabled: false };
    mockApiKey.findOneAndUpdate.mockReturnValueOnce({ lean: () => Promise.resolve(updated) });
    const gw = new InstitutionalApiGateway();
    const result = await gw.revokeApiKey("k1", "u1");
    expect(result.enabled).toBe(false);
  });

  test("returns null when key not found", async () => {
    mockApiKey.findOneAndUpdate.mockReturnValueOnce({ lean: () => Promise.resolve(null) });
    const gw = new InstitutionalApiGateway();
    const result = await gw.revokeApiKey("nonexistent", "u1");
    expect(result).toBeNull();
  });
});

describe("InstitutionalApiGateway.listApiKeys", () => {
  beforeEach(() => vi.resetAllMocks());

  test("queries enabled keys for user without hashedSecret", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      sort:   vi.fn().mockReturnThis(),
      lean:   vi.fn().mockResolvedValue([{ _id: "k1", key: "TSRX-ABC" }]),
    };
    mockApiKey.find.mockReturnValueOnce(chain);
    const gw   = new InstitutionalApiGateway();
    const list = await gw.listApiKeys("u1");
    expect(mockApiKey.find).toHaveBeenCalledWith({ userId: "u1", enabled: true });
    expect(chain.select).toHaveBeenCalledWith("-hashedSecret");
    expect(list).toHaveLength(1);
  });
});
