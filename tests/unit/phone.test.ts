import { describe, expect, it } from "vitest";
import { formatPhoneNumber, parsePhoneNumber } from "@/lib/utils/phone";

describe("parsePhoneNumber", () => {
  it("defaults empty input to +82", () => {
    expect(parsePhoneNumber("")).toEqual({ callingCode: "+82", localNumber: "", fullNumber: "" });
  });

  it("keeps an explicit calling code and local formatting", () => {
    expect(parsePhoneNumber("+82 10-1234-5678")).toEqual({
      callingCode: "+82",
      localNumber: "10-1234-5678",
      fullNumber: "+82 10-1234-5678",
    });
    expect(parsePhoneNumber("+1 856-555-1234").callingCode).toBe("+1");
  });

  it("converts a domestic Korean number by dropping the trunk 0", () => {
    expect(parsePhoneNumber("010-1234-5678")).toEqual({
      callingCode: "+82",
      localNumber: "10-1234-5678",
      fullNumber: "+82 10-1234-5678",
    });
  });
});

describe("formatPhoneNumber", () => {
  it("joins code and local number, or returns empty without a number", () => {
    expect(formatPhoneNumber("+1", " 856-555-1234 ")).toBe("+1 856-555-1234");
    expect(formatPhoneNumber("+82", "  ")).toBe("");
  });
});
