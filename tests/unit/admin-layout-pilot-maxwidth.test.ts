import { describe, it, expect } from "vitest";
import { isPilotMaxWidthRoute, PILOT_MAX_WIDTH_PREFIXES } from "@/lib/admin/layout-config";

describe("ADM-LAYOUT-MAXWIDTH-001: Pilot Max-Width Layout Route Detection", () => {
  it("defines the exact four Retail Network pilot route prefixes plus stores legacy redirect", () => {
    expect(PILOT_MAX_WIDTH_PREFIXES).toEqual([
      "/admin/retailers",
      "/admin/store-operations",
      "/admin/exchange-credit",
      "/admin/protection-reviews",
      "/admin/stores",
    ]);
  });

  describe("Pilot routes (Target: 1600px Max-Width Centered Shell)", () => {
    const pilotCases = [
      // 1. Retailers
      "/admin/retailers",
      "/admin/retailers/new",
      "/admin/retailers/02ef5da7-5ffc-40ad-a5df-ef740263fca6",
      "/admin/retailers/02ef5da7-5ffc-40ad-a5df-ef740263fca6/stores",

      // 2. Store Operations
      "/admin/store-operations",
      "/admin/store-operations/details",
      "/admin/stores",

      // 3. 90-Day Exchange Credit
      "/admin/exchange-credit",
      "/admin/exchange-credit/rma",
      "/admin/exchange-credit/history",

      // 4. Initial Trial Reviews
      "/admin/protection-reviews",
      "/admin/protection-reviews/6fc6e1ab-508e-465e-b59a-33ef7b41d145",
      "/admin/protection-reviews/any-dynamic-id",
    ];

    it.each(pilotCases)("identifies '%s' as a pilot max-width route", (path) => {
      expect(isPilotMaxWidthRoute(path)).toBe(true);
    });
  });

  describe("Non-Pilot routes (Preserve standard Rule 27 full-width layout)", () => {
    const nonPilotCases = [
      // Core Admin & Dashboard
      "/admin",
      "/admin/dashboard",

      // Brand Operations
      "/admin/applications",
      "/admin/companies",
      "/admin/brands",
      "/admin/products",
      "/admin/products/new",
      "/admin/products/curation",
      "/admin/purchasing",
      "/admin/inquiries",

      // Commercial & Sales
      "/admin/sales/orders",
      "/admin/sales/performance",
      "/admin/finance/receivables",
      "/admin/amazon",

      // General Operations
      "/admin/tasks",
      "/admin/reports",
      "/admin/knowledge",
      "/admin/insights",
      "/admin/simulator",
      "/admin/settings",
      "/admin/staff",

      // Auth / Edge Cases
      "/admin/login",
      "/admin/forgot-password",
      "/",
      "",
    ];

    it.each(nonPilotCases)("identifies '%s' as standard full-width layout (non-pilot)", (path) => {
      expect(isPilotMaxWidthRoute(path)).toBe(false);
    });

    it("returns false for null or undefined", () => {
      expect(isPilotMaxWidthRoute(null)).toBe(false);
      expect(isPilotMaxWidthRoute(undefined as unknown as string)).toBe(false);
    });
  });
});
