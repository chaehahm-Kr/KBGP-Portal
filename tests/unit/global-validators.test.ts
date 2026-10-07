import { describe, expect, it } from "vitest";
import {
  isNumericPrice,
  isPureEnglishName,
  normalizePrice,
  validateEnglishName,
  validatePrice,
} from "@/lib/validation/global-validators";

describe("isPureEnglishName", () => {
  it("accepts letters, spaces, apostrophes and hyphens", () => {
    expect(isPureEnglishName("Mary-Jane O'Neil")).toBe(true);
  });

  it("rejects Korean, digits, and empty input", () => {
    expect(isPureEnglishName("홍길동")).toBe(false);
    expect(isPureEnglishName("John2")).toBe(false);
    expect(isPureEnglishName("   ")).toBe(false);
    expect(isPureEnglishName(null)).toBe(false);
  });
});

describe("validateEnglishName", () => {
  it("trims and returns the sanitized value", () => {
    expect(validateEnglishName("  Kim  ")).toEqual({ valid: true, sanitizedValue: "Kim" });
  });

  it("requires a value by default", () => {
    expect(validateEnglishName("").valid).toBe(false);
  });

  it("allows empty when not required", () => {
    expect(validateEnglishName("", { required: false })).toEqual({ valid: true, sanitizedValue: "" });
  });

  it("returns an English error message when language is en", () => {
    const result = validateEnglishName("김", { language: "en" });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("English letters only");
  });
});

describe("price validation", () => {
  it.each(["0", "10", "12.99", "0.50"])("accepts %s", (value) => {
    expect(isNumericPrice(value)).toBe(true);
  });

  it.each(["$10", "1,000", "-5", "01", "abc", "", "1."])("rejects %s", (value) => {
    expect(isNumericPrice(value)).toBe(false);
  });

  it("rejects zero when allowZero is false", () => {
    expect(isNumericPrice("0", false)).toBe(false);
  });

  it("normalizes valid prices and returns null otherwise", () => {
    expect(normalizePrice(" 7.5 ")).toBe(7.5);
    expect(normalizePrice("₩100")).toBeNull();
    expect(normalizePrice(undefined)).toBeNull();
  });

  it("validatePrice enforces integer-only when allowDecimal is false", () => {
    expect(validatePrice("12.5", { allowDecimal: false }).valid).toBe(false);
    expect(validatePrice("12", { allowDecimal: false })).toEqual({ valid: true, value: 12 });
  });

  it("validatePrice explains currency symbols as non-numeric input", () => {
    expect(validatePrice("$12").error).toContain("숫자만");
  });
});
