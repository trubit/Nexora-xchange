import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ── Mocks must be declared before any imports that trigger them ───────────────

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock("../../utils/cache.js", () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
}));

// Redis and logger are transitive deps — mock them to avoid connection
// attempts and noisy stderr output during tests.
vi.mock("../../config/redis.js", () => ({
  redisClients: {},
  redisEnabled: false,
}));

vi.mock("../../config/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import axios from "axios";
import { cacheGet, cacheSet } from "../../utils/cache.js";
import currencyRouter from "../../routes/currency.js";

// ── Minimal Express app mounting just the currency router ─────────────────────

const app = express();
app.use(express.json());
app.use("/api/currency", currencyRouter);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const USD_RATES = {
  amount: 1,
  base: "USD",
  date: "2024-01-01",
  rates: { EUR: 0.92, GBP: 0.79, NGN: 1500, JPY: 155 },
};

const EUR_RATES = {
  amount: 1,
  base: "EUR",
  date: "2024-01-01",
  rates: { USD: 1.09, GBP: 0.86 },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/currency/latest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cacheGet).mockResolvedValue(null); // cold cache by default
  });

  test("returns 200 with currency rates from Frankfurter", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: USD_RATES });

    const res = await request(app).get("/api/currency/latest?from=USD");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(USD_RATES);
  });

  test("calls the new Frankfurter v1 endpoint (not the old .app domain)", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: USD_RATES });
    await request(app).get("/api/currency/latest?from=USD");

    const calledUrl = vi.mocked(axios.get).mock.calls[0][0];
    expect(calledUrl).toContain("frankfurter.dev");
    expect(calledUrl).not.toContain("frankfurter.app");
  });

  test("encodes the from parameter in the URL", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: EUR_RATES });
    await request(app).get("/api/currency/latest?from=EUR");

    const calledUrl = vi.mocked(axios.get).mock.calls[0][0];
    expect(calledUrl).toContain("from=EUR");
  });

  test("defaults the from parameter to USD when omitted", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: USD_RATES });
    await request(app).get("/api/currency/latest");

    const calledUrl = vi.mocked(axios.get).mock.calls[0][0];
    expect(calledUrl).toContain("from=USD");
  });

  test("serves a cached response without calling the upstream API", async () => {
    vi.mocked(cacheGet).mockResolvedValue(USD_RATES);

    const res = await request(app).get("/api/currency/latest?from=USD");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(USD_RATES);
    expect(axios.get).not.toHaveBeenCalled();
  });

  test("uses the correct cache key", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: EUR_RATES });
    await request(app).get("/api/currency/latest?from=eur"); // lowercase

    expect(cacheGet).toHaveBeenCalledWith("currency:latest:EUR"); // uppercased
  });

  test("stores the response in cache after a successful fetch", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: USD_RATES });
    await request(app).get("/api/currency/latest?from=USD");

    expect(cacheSet).toHaveBeenCalledWith("currency:latest:USD", USD_RATES, 300);
  });

  test("returns the upstream HTTP status code on API error", async () => {
    const err = Object.assign(new Error("Not Found"), {
      response: { status: 404, data: { message: "Currency not found" } },
    });
    vi.mocked(axios.get).mockRejectedValue(err);

    const res = await request(app).get("/api/currency/latest?from=INVALID");
    expect(res.status).toBe(404);
  });

  test("returns 500 on a network-level failure (no response object)", async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error("ECONNREFUSED"));

    const res = await request(app).get("/api/currency/latest?from=USD");
    expect(res.status).toBe(500);
  });

  test("response body contains a message field on error", async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error("timeout"));
    const res = await request(app).get("/api/currency/latest?from=USD");
    expect(res.body).toHaveProperty("message");
  });

  test("does not store a failed response in cache", async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error("upstream error"));
    await request(app).get("/api/currency/latest?from=USD");
    expect(cacheSet).not.toHaveBeenCalled();
  });
});
