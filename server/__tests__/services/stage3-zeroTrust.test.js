/**
 * Stage 3 — Zero-Trust Security
 * Tests: DeviceFingerprintEngine, GeoIpVerifier, ContinuousAuthEngine
 */

import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("../../config/redis.js", () => ({
  redisClients: { cache: null },
  redisEnabled: false,
}));
vi.mock("../../models/DeviceSession.js", () => ({
  default: {
    findOne:          vi.fn().mockResolvedValue(null),
    findOneAndUpdate: vi.fn().mockResolvedValue({}),
    create:           vi.fn().mockResolvedValue({}),
  },
}));
vi.mock("../../models/AuditLog.js", () => ({
  default: { create: vi.fn().mockResolvedValue({}) },
}));
vi.mock("../../models/User.js", () => ({
  default: { findByIdAndUpdate: vi.fn().mockResolvedValue({}) },
}));
vi.mock("../../services/auditService.js", () => ({
  auditSecurity: vi.fn().mockResolvedValue({}),
}));

import { DeviceFingerprintEngine } from "../../services/deviceFingerprintEngine.js";
import { GeoIpVerifier }           from "../../services/geoIpVerifier.js";
import { ContinuousAuthEngine }    from "../../services/continuousAuthEngine.js";

// ── DeviceFingerprintEngine ───────────────────────────────────────────────────

const makeReq = (overrides = {}) => ({
  headers: {
    "user-agent":        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "accept":            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language":   "en-US,en;q=0.5",
    "accept-encoding":   "gzip, deflate, br",
    "x-client-timezone": "America/New_York",
  },
  ip: "192.168.1.100",
  ...overrides,
});

describe("DeviceFingerprintEngine.extract", () => {
  const engine = new DeviceFingerprintEngine();

  test("returns an object with composite and factors", () => {
    const fp = engine.extract(makeReq());
    expect(fp).toHaveProperty("composite");
    expect(fp).toHaveProperty("factors");
    expect(typeof fp.composite).toBe("string");
    expect(fp.composite.length).toBeGreaterThan(0);
  });

  test("same request produces the same fingerprint (deterministic)", () => {
    const req = makeReq();
    expect(engine.extract(req).composite).toBe(engine.extract(req).composite);
  });

  test("different user-agents produce different fingerprints", () => {
    const fp1 = engine.extract(makeReq());
    const fp2 = engine.extract(makeReq({
      headers: { ...makeReq().headers, "user-agent": "curl/7.64.1" },
    }));
    expect(fp1.composite).not.toBe(fp2.composite);
  });

  test("different IPs produce different fingerprints", () => {
    const fp1 = engine.extract(makeReq({ ip: "10.0.0.1" }));
    const fp2 = engine.extract(makeReq({ ip: "172.16.0.1" }));
    expect(fp1.composite).not.toBe(fp2.composite);
  });
});

describe("DeviceFingerprintEngine._ipSubnet", () => {
  const engine = new DeviceFingerprintEngine();

  test("extracts /16 subnet (first two octets) from IPv4", () => {
    expect(engine._ipSubnet("192.168.1.100")).toBe("192.168");
    expect(engine._ipSubnet("10.0.0.1")).toBe("10.0");
  });

  test("handles non-standard IP gracefully without throwing", () => {
    expect(() => engine._ipSubnet("not-an-ip")).not.toThrow();
  });
});

// ── GeoIpVerifier ─────────────────────────────────────────────────────────────
// NOTE: lookup() is async (checks Redis cache first)

describe("GeoIpVerifier.lookup", () => {
  const verifier = new GeoIpVerifier();

  test("returns a country code for a known IP range", async () => {
    const result = await verifier.lookup("4.0.0.1");  // prefix "4.0.0" → US
    expect(result).toHaveProperty("country");
    expect(typeof result.country).toBe("string");
  });

  test("private IPs return isLocal=true", async () => {
    const result = await verifier.lookup("192.168.1.1");
    expect(result.isLocal).toBe(true);
  });

  test("loopback returns isLocal=true", async () => {
    const result = await verifier.lookup("127.0.0.1");
    expect(result.isLocal).toBe(true);
  });

  test("lookup does not throw for any well-formed IPv4", async () => {
    const ips = ["8.8.8.8", "1.0.0.1", "104.16.0.0", "203.0.113.0"];
    for (const ip of ips) {
      await expect(verifier.lookup(ip)).resolves.toHaveProperty("country");
    }
  });

  test("result includes ip, isBlocked, and isVpn fields", async () => {
    const result = await verifier.lookup("8.8.8.8");
    expect(result).toHaveProperty("ip");
    expect(result).toHaveProperty("isBlocked");
    expect(result).toHaveProperty("isVpn");
  });
});

describe("GeoIpVerifier._isDatacenter", () => {
  const verifier = new GeoIpVerifier();

  test("Cloudflare prefix (104.16.x.x) is flagged as datacenter", () => {
    expect(verifier._isDatacenter("104.16.0.1")).toBe(true);
  });

  test("AWS CloudFront prefix (13.32.x.x) is flagged as datacenter", () => {
    expect(verifier._isDatacenter("13.32.0.1")).toBe(true);
  });

  test("private address 192.168.x.x is NOT a datacenter prefix", () => {
    expect(verifier._isDatacenter("192.168.100.5")).toBe(false);
  });
});

describe("GeoIpVerifier._isPrivate", () => {
  const verifier = new GeoIpVerifier();

  test("10.x.x.x is private", ()   => { expect(verifier._isPrivate("10.0.0.1")).toBe(true); });
  test("192.168.x.x is private",   () => { expect(verifier._isPrivate("192.168.1.1")).toBe(true); });
  test("172.16.x.x is private",    () => { expect(verifier._isPrivate("172.16.0.1")).toBe(true); });
  test("172.31.x.x is private",    () => { expect(verifier._isPrivate("172.31.255.255")).toBe(true); });
  test("172.32.x.x is NOT private",() => { expect(verifier._isPrivate("172.32.0.1")).toBe(false); });
  test("8.8.8.8 is NOT private",   () => { expect(verifier._isPrivate("8.8.8.8")).toBe(false); });
});

// ── ContinuousAuthEngine ──────────────────────────────────────────────────────
// NOTE: _classify returns { riskLevel, requireStepUp, blockRequest }

describe("ContinuousAuthEngine._classify", () => {
  const engine = new ContinuousAuthEngine();

  const cases = [
    [0,   "LOW",      false, false],
    [29,  "LOW",      false, false],
    [30,  "MEDIUM",   false, false],
    [59,  "MEDIUM",   false, false],
    [60,  "HIGH",     true,  false],
    [79,  "HIGH",     true,  false],
    [80,  "CRITICAL", true,  true],
    [100, "CRITICAL", true,  true],
  ];

  test.each(cases)("score %i → level %s, stepUp=%s, block=%s", (score, level, stepUp, block) => {
    const result = engine._classify(score);
    expect(result.riskLevel).toBe(level);
    expect(result.requireStepUp).toBe(stepUp);
    expect(result.blockRequest).toBe(block);
  });
});

describe("ContinuousAuthEngine._isHighValuePath", () => {
  const engine = new ContinuousAuthEngine();

  test("GET requests are never high-value regardless of path", () => {
    expect(engine._isHighValuePath("/api/transfer/withdraw", "GET")).toBe(false);
  });

  test("/api/transfer/* is high-value for non-GET methods", () => {
    expect(engine._isHighValuePath("/api/transfer/withdraw", "POST")).toBe(true);
  });

  test("/api/wallet/withdraw is high-value", () => {
    expect(engine._isHighValuePath("/api/wallet/withdraw", "POST")).toBe(true);
  });

  test("/api/kyc/submit is high-value", () => {
    expect(engine._isHighValuePath("/api/kyc/submit", "POST")).toBe(true);
  });

  test("/api/auth/login is NOT high-value", () => {
    expect(engine._isHighValuePath("/api/auth/login", "POST")).toBe(false);
  });

  test("/api/coins market data is NOT high-value", () => {
    expect(engine._isHighValuePath("/api/coins", "POST")).toBe(false);
  });
});
