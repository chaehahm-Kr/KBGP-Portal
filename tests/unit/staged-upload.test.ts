import { describe, expect, it } from "vitest";
import {
  DIRECT_BODY_BUDGET_BYTES,
  decodeStagedFile,
  encodeStagedFile,
  needsStaging,
} from "@/lib/files/staged-upload-shared";

describe("staged file marker", () => {
  const ref = { path: "_staging/u1/abc/report.pdf", name: "보고서.pdf", type: "application/pdf", size: 5_000_000 };

  it("round-trips through encode/decode", () => {
    expect(decodeStagedFile(encodeStagedFile(ref))).toEqual(ref);
  });

  it("ignores ordinary form values and malformed markers", () => {
    expect(decodeStagedFile("hello")).toBeNull();
    expect(decodeStagedFile("__ksn_staged_file__:{not json")).toBeNull();
    expect(decodeStagedFile('__ksn_staged_file__:{"path":1}')).toBeNull();
    expect(decodeStagedFile(new Blob(["x"]))).toBeNull();
  });
});

describe("needsStaging", () => {
  it("keeps small requests on the direct path", () => {
    expect(needsStaging([{ size: 1_000_000 }, { size: 2_000_000 }])).toBe(false);
    expect(needsStaging([{ size: DIRECT_BODY_BUDGET_BYTES }])).toBe(false);
  });

  it("stages when the combined size would exceed the Vercel body limit", () => {
    expect(needsStaging([{ size: 2_000_000 }, { size: 2_000_000 }])).toBe(true);
    expect(needsStaging([{ size: 9 * 1024 * 1024 }])).toBe(true);
  });
});
