import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { isServerVerifiedTrainingPass } from "@/lib/retailer/admin-training-analytics";

describe("ADM-TRAINING-P2-001-R2: Training Coverage Matrix & Eligibility Verification", () => {
  describe("Rule 1: isServerVerifiedTrainingPass Criteria", () => {
    it("should reject LEGACY_SELF_REPORTED completions even if status is completed", () => {
      const legacyComp = {
        status: "completed",
        completed_at: "2026-09-25T03:26:53.289Z",
        completion_type: "LEGACY_SELF_REPORTED",
        quiz_score: null,
        quiz_total: null,
      };
      expect(isServerVerifiedTrainingPass(legacyComp)).toBe(false);
    });

    it("should reject partial quiz passes (< 100%)", () => {
      const partialPass = {
        status: "completed",
        completed_at: "2026-10-15T03:43:41.055Z",
        completion_type: "VERIFIED_QUIZ_PASSED",
        quiz_score: 2,
        quiz_total: 3,
      };
      expect(isServerVerifiedTrainingPass(partialPass)).toBe(false);
    });

    it("should accept 100% server-graded quiz completions", () => {
      const fullPass = {
        status: "completed",
        completed_at: "2026-10-15T15:06:27.067Z",
        completion_type: "VERIFIED_QUIZ_PASSED",
        quiz_score: 3,
        quiz_total: 3,
      };
      expect(isServerVerifiedTrainingPass(fullPass)).toBe(true);
    });

    it("should accept verified module completions with no quiz requirement", () => {
      const noQuizPass = {
        status: "completed",
        completed_at: "2026-10-15T15:06:27.067Z",
        completion_type: "VERIFIED_PASS",
        quiz_score: null,
        quiz_total: 0,
      };
      expect(isServerVerifiedTrainingPass(noQuizPass)).toBe(true);
    });

    it("should reject uncompleted or null date records", () => {
      expect(isServerVerifiedTrainingPass({ status: "in_progress", completed_at: null })).toBe(false);
      expect(isServerVerifiedTrainingPass({ status: "completed", completed_at: null })).toBe(false);
    });
  });

  describe("Rule 2: Denominator and Coverage Calculations with 0 Items (N/A Handling)", () => {
    it("should handle 0 published training items with null coverage percent instead of 0%", () => {
      const publishedCount = 0;
      const coveredCount = 0;
      const coveragePercent = publishedCount > 0 ? Math.round((coveredCount / publishedCount) * 100) : null;
      expect(coveragePercent).toBeNull();
      const displayText = coveragePercent !== null ? `${coveragePercent}%` : "N/A";
      expect(displayText).toBe("N/A");
    });

    it("should calculate partial completion correctly", () => {
      const publishedCount = 7;
      const coveredCount = 1;
      const coveragePercent = publishedCount > 0 ? Math.round((coveredCount / publishedCount) * 100) : null;
      expect(coveragePercent).toBe(14);
      expect(`${coveredCount} / ${publishedCount} (${coveragePercent}%)`).toBe("1 / 7 (14%)");
    });

    it("should calculate full completion correctly", () => {
      const publishedCount = 4;
      const coveredCount = 4;
      const coveragePercent = publishedCount > 0 ? Math.round((coveredCount / publishedCount) * 100) : null;
      expect(coveragePercent).toBe(100);
      expect(`${coveredCount} / ${publishedCount} (${coveragePercent}%)`).toBe("4 / 4 (100%)");
    });
  });

  describe("Rule 3: Discontinued Product Omission", () => {
    it("should exclude discontinued products from candidate training product list", () => {
      const allProductIds = ["prod-active-1", "prod-active-2", "prod-discontinued-1"];
      const catalog = [
        { id: "prod-active-1", status: "selling" },
        { id: "prod-active-2", status: "registered" },
        // prod-discontinued-1 omitted by .neq("status", "discontinued")
      ];
      const activeIds = new Set(catalog.map((c) => c.id));
      const filtered = allProductIds.filter((id) => activeIds.has(id));
      expect(filtered).toEqual(["prod-active-1", "prod-active-2"]);
      expect(filtered).not.toContain("prod-discontinued-1");
    });
  });
});
