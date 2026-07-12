import { describe, test, expect, vi, beforeEach } from "vitest";

// Mock the RevokedToken Mongoose model — no real DB in unit tests.
vi.mock("../../models/RevokedToken.js", () => ({
  default: {
    create: vi.fn().mockResolvedValue({}),
    findOne: vi.fn(),
  },
}));

// JWT_SECRET is set in vitest.server.config.js env block before this module loads.
import { signToken, verifyToken, revokeToken, isTokenRevoked } from "../../utils/jwt.js";
import RevokedToken from "../../models/RevokedToken.js";

// isTokenRevoked calls findOne(...).lean(), so we need a chainable query mock.
const makeQuery = (result) => {
  const q = {};
  q.lean = vi.fn().mockResolvedValue(result);
  q.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  q.catch = (onReject) => Promise.resolve(result).catch(onReject);
  q.finally = (cb) => Promise.resolve(result).finally(cb);
  return q;
};

describe("signToken / verifyToken", () => {
  test("creates a token that verifies successfully", () => {
    const token = signToken({ sub: "user-001", role: "user" });
    expect(typeof token).toBe("string");
    const decoded = verifyToken(token);
    expect(decoded.sub).toBe("user-001");
    expect(decoded.role).toBe("user");
  });

  test("adds a unique jti field to every token", () => {
    const token = signToken({ sub: "user-001" });
    const decoded = verifyToken(token);
    expect(decoded.jti).toBeTruthy();
    expect(typeof decoded.jti).toBe("string");
  });

  test("each call produces a different jti", () => {
    const a = verifyToken(signToken({ sub: "user-001" }));
    const b = verifyToken(signToken({ sub: "user-001" }));
    expect(a.jti).not.toBe(b.jti);
  });

  test("preserves all payload fields", () => {
    const payload = { sub: "user-abc", role: "admin", uid: "uid-xyz" };
    const decoded = verifyToken(signToken(payload));
    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.role).toBe(payload.role);
    expect(decoded.uid).toBe(payload.uid);
  });

  test("verifyToken throws on a garbage string", () => {
    expect(() => verifyToken("not.a.valid.token")).toThrow();
  });

  test("verifyToken throws on a tampered signature", () => {
    const token = signToken({ sub: "user-001" });
    const parts = token.split(".");
    parts[2] = parts[2].split("").reverse().join(""); // flip the signature
    expect(() => verifyToken(parts.join("."))).toThrow();
  });

  test("verifyToken throws on a token signed with a different secret", async () => {
    const { default: jsonwebtoken } = await import("jsonwebtoken");
    const foreign = jsonwebtoken.sign({ sub: "attacker" }, "a-different-secret");
    expect(() => verifyToken(foreign)).toThrow();
  });
});

describe("revokeToken", () => {
  beforeEach(() => vi.clearAllMocks());

  test("creates a RevokedToken document with the correct fields", async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const decoded = { jti: "jti-abc-123", sub: "user-001", exp: futureExp };

    await revokeToken(decoded, "logout");

    expect(RevokedToken.create).toHaveBeenCalledOnce();
    expect(RevokedToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        jti: "jti-abc-123",
        userId: "user-001",
        reason: "logout",
        expiresAt: new Date(futureExp * 1000),
      }),
    );
  });

  test("does nothing when the decoded payload has no jti", async () => {
    await revokeToken({ sub: "user-001", exp: 9999999999 });
    expect(RevokedToken.create).not.toHaveBeenCalled();
  });

  test("defaults reason to logout when not specified", async () => {
    await revokeToken({ jti: "jti-xyz", sub: "u1", exp: 9999999999 });
    expect(RevokedToken.create).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "logout" }),
    );
  });
});

describe("isTokenRevoked", () => {
  beforeEach(() => vi.clearAllMocks());

  test("returns false when jti is not in the blacklist", async () => {
    vi.mocked(RevokedToken.findOne).mockReturnValueOnce(makeQuery(null));
    expect(await isTokenRevoked("clean-jti")).toBe(false);
  });

  test("returns true when jti is found in the blacklist", async () => {
    vi.mocked(RevokedToken.findOne).mockReturnValueOnce(makeQuery({ jti: "revoked-jti" }));
    expect(await isTokenRevoked("revoked-jti")).toBe(true);
  });

  test("returns false for null jti without hitting the DB", async () => {
    expect(await isTokenRevoked(null)).toBe(false);
    expect(RevokedToken.findOne).not.toHaveBeenCalled();
  });

  test("returns false for undefined jti without hitting the DB", async () => {
    expect(await isTokenRevoked(undefined)).toBe(false);
    expect(RevokedToken.findOne).not.toHaveBeenCalled();
  });
});
