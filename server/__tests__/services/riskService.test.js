import { describe, test, expect, vi, beforeEach } from "vitest";

// ── Model mocks — no real MongoDB in unit tests ───────────────────────────────

vi.mock("../../models/User.js", () => ({
  default: { findById: vi.fn(), updateMany: vi.fn() },
}));

vi.mock("../../models/RiskProfile.js", () => ({
  default: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

vi.mock("../../models/RiskEvent.js", () => ({
  default: {
    create: vi.fn().mockResolvedValue({}),
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

import RiskProfile from "../../models/RiskProfile.js";
import RiskEvent from "../../models/RiskEvent.js";
import {
  checkFrozen,
  checkWithdrawalAllowed,
  getRiskStats,
} from "../../services/riskService.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Mongoose's findOne() returns a chainable Query, not a plain Promise.
 * This satisfies both:
 *   await RiskProfile.findOne(...)              → resolves to result (loadProfile)
 *   await RiskProfile.findOne(...).select().lean()  → resolves to result (checkFrozen)
 */
const makeQuery = (result) => {
  const q = {};
  q.select = vi.fn().mockReturnValue(q);
  q.lean = vi.fn().mockResolvedValue(result);
  q.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  q.catch = (onReject) => Promise.resolve(result).catch(onReject);
  q.finally = (cb) => Promise.resolve(result).finally(cb);
  return q;
};

const makeMockProfile = (overrides = {}) => ({
  user: "user-001",
  score: 0,
  level: "low",
  frozen: false,
  frozenReason: undefined,
  flags: [],
  ipHistory: [],
  withdrawalCooldownUntil: null,
  withdrawalCooldownReason: "",
  lastDepositAt: null,
  lastWithdrawalAt: null,
  save: vi.fn().mockResolvedValue({}),
  ...overrides,
});

// ── checkFrozen ───────────────────────────────────────────────────────────────

describe("checkFrozen", () => {
  beforeEach(() => vi.clearAllMocks());

  test("resolves without throwing when the account is not frozen", async () => {
    vi.mocked(RiskProfile.findOne).mockReturnValue(makeQuery({ frozen: false }));
    await expect(checkFrozen("user-001")).resolves.toBeUndefined();
  });

  test("resolves without throwing when no risk profile exists", async () => {
    vi.mocked(RiskProfile.findOne).mockReturnValue(makeQuery(null));
    await expect(checkFrozen("user-001")).resolves.toBeUndefined();
  });

  test("throws a 403 error when the account is frozen", async () => {
    vi.mocked(RiskProfile.findOne).mockReturnValue(
      makeQuery({ frozen: true, frozenReason: "Automated: risk score critical" }),
    );
    await expect(checkFrozen("user-001")).rejects.toMatchObject({ statusCode: 403 });
  });

  test("frozen error message includes the frozenReason", async () => {
    vi.mocked(RiskProfile.findOne).mockReturnValue(
      makeQuery({ frozen: true, frozenReason: "AML flag raised" }),
    );
    await expect(checkFrozen("user-001")).rejects.toMatchObject({
      message: expect.stringContaining("AML flag raised"),
    });
  });

  test("frozen error message includes the support email env var", async () => {
    vi.mocked(RiskProfile.findOne).mockReturnValue(
      makeQuery({ frozen: true, frozenReason: "Suspicious activity" }),
    );
    await expect(checkFrozen("user-001")).rejects.toMatchObject({
      message: expect.stringContaining(process.env.SUPPORT_EMAIL),
    });
  });

  test("frozen error message falls back to default email when env var is missing", async () => {
    const original = process.env.SUPPORT_EMAIL;
    delete process.env.SUPPORT_EMAIL;

    vi.mocked(RiskProfile.findOne).mockReturnValue(
      makeQuery({ frozen: true, frozenReason: "x" }),
    );

    await expect(checkFrozen("user-001")).rejects.toMatchObject({
      message: expect.stringContaining("support@nexora.com"),
    });

    process.env.SUPPORT_EMAIL = original;
  });
});

// ── checkWithdrawalAllowed ────────────────────────────────────────────────────

describe("checkWithdrawalAllowed", () => {
  beforeEach(() => vi.clearAllMocks());

  const setupProfile = (overrides = {}) => {
    const profile = makeMockProfile(overrides);
    vi.mocked(RiskProfile.findOne).mockReturnValue(makeQuery(profile));
    vi.mocked(RiskProfile.findOneAndUpdate).mockResolvedValue(profile);
  };

  test("resolves when the account is in good standing", async () => {
    setupProfile();
    await expect(checkWithdrawalAllowed("user-001")).resolves.toBeUndefined();
  });

  test("throws 403 when the account is frozen", async () => {
    setupProfile({ frozen: true, frozenReason: "Risk score critical" });
    await expect(checkWithdrawalAllowed("user-001")).rejects.toMatchObject({ statusCode: 403 });
  });

  test("throws 403 when an active withdrawal cooldown is in place", async () => {
    const futureDate = new Date(Date.now() + 24 * 3_600_000);
    setupProfile({
      withdrawalCooldownUntil: futureDate,
      withdrawalCooldownReason: "New login IP detected.",
    });
    await expect(checkWithdrawalAllowed("user-001")).rejects.toMatchObject({ statusCode: 403 });
  });

  test("cooldown error message mentions remaining hours", async () => {
    const futureDate = new Date(Date.now() + 24 * 3_600_000);
    setupProfile({
      withdrawalCooldownUntil: futureDate,
      withdrawalCooldownReason: "IP change detected.",
    });
    await expect(checkWithdrawalAllowed("user-001")).rejects.toMatchObject({
      message: expect.stringContaining("hour"),
    });
  });

  test("resolves when the cooldown date is already in the past", async () => {
    const pastDate = new Date(Date.now() - 3_600_000);
    setupProfile({ withdrawalCooldownUntil: pastDate });
    await expect(checkWithdrawalAllowed("user-001")).resolves.toBeUndefined();
  });
});

// ── getRiskStats ──────────────────────────────────────────────────────────────

describe("getRiskStats", () => {
  beforeEach(() => vi.clearAllMocks());

  test("returns counts for each risk tier and recent events", async () => {
    vi.mocked(RiskProfile.countDocuments)
      .mockResolvedValueOnce(3)    // frozen
      .mockResolvedValueOnce(5)    // critical
      .mockResolvedValueOnce(10)   // high
      .mockResolvedValueOnce(20);  // medium
    vi.mocked(RiskEvent.countDocuments).mockResolvedValueOnce(42);

    const stats = await getRiskStats();
    expect(stats).toEqual({ frozen: 3, critical: 5, high: 10, medium: 20, recentEvents: 42 });
  });

  test("returns zeros when all counts are zero", async () => {
    vi.mocked(RiskProfile.countDocuments).mockResolvedValue(0);
    vi.mocked(RiskEvent.countDocuments).mockResolvedValue(0);

    const stats = await getRiskStats();
    expect(stats.frozen).toBe(0);
    expect(stats.recentEvents).toBe(0);
  });
});
