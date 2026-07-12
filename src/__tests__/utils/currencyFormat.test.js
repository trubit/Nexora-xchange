import { describe, test, expect } from "vitest";
import {
  normalizeCurrencyCode,
  getCurrencyRate,
  convertUsdAmount,
  formatCurrencyAmount,
  formatPriceAmount,
  formatCompactCurrencyAmount,
} from "../../utils/currencyFormat";

const SAMPLE_RATES = { EUR: 0.92, GBP: 0.79, NGN: 1500, JPY: 155 };

describe("normalizeCurrencyCode", () => {
  test("uppercases a lowercase code", () => {
    expect(normalizeCurrencyCode("eur")).toBe("EUR");
  });

  test("returns USD when given empty string", () => {
    expect(normalizeCurrencyCode("")).toBe("USD");
  });

  test("returns USD when given null", () => {
    expect(normalizeCurrencyCode(null)).toBe("USD");
  });

  test("returns USD when given undefined", () => {
    expect(normalizeCurrencyCode(undefined)).toBe("USD");
  });

  test("preserves already-uppercase code", () => {
    expect(normalizeCurrencyCode("GBP")).toBe("GBP");
  });
});

describe("getCurrencyRate", () => {
  test("returns 1 for USD (base currency)", () => {
    expect(getCurrencyRate("USD", SAMPLE_RATES)).toBe(1);
  });

  test("returns the correct rate for a known currency", () => {
    expect(getCurrencyRate("EUR", SAMPLE_RATES)).toBe(0.92);
  });

  test("returns null for a currency not in the rates map", () => {
    expect(getCurrencyRate("XYZ", SAMPLE_RATES)).toBeNull();
  });

  test("returns null when rates is undefined", () => {
    expect(getCurrencyRate("EUR", undefined)).toBeNull();
  });

  test("returns null when rates is null", () => {
    expect(getCurrencyRate("EUR", null)).toBeNull();
  });

  test("returns null for a zero rate (would be division by zero territory)", () => {
    expect(getCurrencyRate("EUR", { EUR: 0 })).toBeNull();
  });

  test("handles lowercase currency code by normalizing it", () => {
    expect(getCurrencyRate("eur", SAMPLE_RATES)).toBe(0.92);
  });
});

describe("convertUsdAmount", () => {
  test("returns the amount unchanged for USD", () => {
    expect(convertUsdAmount(100, "USD", SAMPLE_RATES)).toBe(100);
  });

  test("converts a USD amount to EUR correctly", () => {
    expect(convertUsdAmount(100, "EUR", SAMPLE_RATES)).toBeCloseTo(92);
  });

  test("converts a USD amount to NGN correctly", () => {
    expect(convertUsdAmount(1, "NGN", SAMPLE_RATES)).toBe(1500);
  });

  test("returns original amount when currency is unknown (no rate)", () => {
    expect(convertUsdAmount(100, "XYZ", SAMPLE_RATES)).toBe(100);
  });

  test("returns 0 for non-numeric string input", () => {
    expect(convertUsdAmount("abc", "USD", SAMPLE_RATES)).toBe(0);
  });

  test("handles zero amount", () => {
    expect(convertUsdAmount(0, "EUR", SAMPLE_RATES)).toBe(0);
  });

  test("handles negative amount", () => {
    expect(convertUsdAmount(-50, "EUR", SAMPLE_RATES)).toBeCloseTo(-46);
  });
});

describe("formatCurrencyAmount", () => {
  test("formats USD with $ symbol", () => {
    const result = formatCurrencyAmount(1000, "USD", null);
    expect(result).toMatch(/\$1,000\.00|\$1000\.00/);
  });

  test("formats EUR with currency symbol", () => {
    const result = formatCurrencyAmount(100, "EUR", SAMPLE_RATES);
    expect(result).toContain("92");
  });

  test("returns a fallback string for an unknown currency code", () => {
    const result = formatCurrencyAmount(100, "INVALID_CODE", null);
    expect(result).toContain("100");
  });

  test("respects custom fraction digits", () => {
    const result = formatCurrencyAmount(1.5, "USD", null, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
    expect(result).toContain("1.5000");
  });
});

describe("formatPriceAmount", () => {
  test("uses 2 decimal places for amounts >= 100", () => {
    const result = formatPriceAmount(1500, "USD", null);
    expect(result).toMatch(/\d+\.\d{2}$/);
  });

  test("uses up to 4 decimal places for amounts between 1 and 100", () => {
    // 5.1234 needs exactly 4 decimal places — should not be rounded to 2.
    const result = formatPriceAmount(5.1234, "USD", null);
    expect(result).toContain("5.1234");
  });

  test("uses 6 decimal places for amounts below 1", () => {
    const result = formatPriceAmount(0.0001234, "USD", null);
    expect(result).toMatch(/\d+\.\d{6}$/);
  });

  test("handles zero", () => {
    const result = formatPriceAmount(0, "USD", null);
    expect(result).toContain("0");
  });
});

describe("formatCompactCurrencyAmount", () => {
  test("formats large amounts in compact notation", () => {
    const result = formatCompactCurrencyAmount(1_000_000, "USD", null);
    expect(result).toMatch(/M|million/i);
  });

  test("handles unknown currency by falling back gracefully", () => {
    const result = formatCompactCurrencyAmount(500, "BOGUS", null);
    expect(result).toContain("500");
  });
});
