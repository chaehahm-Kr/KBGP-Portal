import { describe, it, expect } from "vitest";
import {
  ADMIN_LAYOUT_MAX_WIDTH_PX,
  ADMIN_LAYOUT_MAX_WIDTH_CLASS,
  ADMIN_AUTH_ROUTES,
  isAdminAuthRoute,
  isAdminShellRoute,
  getAdminShellMetrics,
  isPilotMaxWidthRoute,
  PILOT_MAX_WIDTH_PREFIXES,
} from "@/lib/admin/layout-config";

describe("ADM-LAYOUT-MAXWIDTH-002: Global Admin 1800px Responsive Shell Standardization", () => {
  it("defines the global 1800px max width configuration constants", () => {
    expect(ADMIN_LAYOUT_MAX_WIDTH_PX).toBe(1800);
    expect(ADMIN_LAYOUT_MAX_WIDTH_CLASS).toBe("max-w-[1800px]");
  });

  describe("Admin Auth Routes Detection (Bypasses Admin Shell)", () => {
    it("identifies all auth routes that use standalone auth layout", () => {
      expect(ADMIN_AUTH_ROUTES).toContain("/admin/login");
      expect(ADMIN_AUTH_ROUTES).toContain("/admin/forgot-password");
      expect(ADMIN_AUTH_ROUTES).toContain("/admin/reset-password");
      expect(ADMIN_AUTH_ROUTES).toContain("/admin/invite/accept");

      expect(isAdminAuthRoute("/admin/login")).toBe(true);
      expect(isAdminAuthRoute("/admin/forgot-password")).toBe(true);
      expect(isAdminAuthRoute("/admin/reset-password")).toBe(true);
      expect(isAdminAuthRoute("/admin/invite/accept")).toBe(true);
      expect(isAdminAuthRoute("/admin/invite/accept/token-123")).toBe(true);
    });

    it("returns false for non-auth admin routes", () => {
      expect(isAdminAuthRoute("/admin")).toBe(false);
      expect(isAdminAuthRoute("/admin/dashboard")).toBe(false);
      expect(isAdminAuthRoute("/admin/retailers")).toBe(false);
      expect(isAdminAuthRoute(null)).toBe(false);
      expect(isAdminAuthRoute(undefined as unknown as string)).toBe(false);
    });
  });

  describe("Global Admin Shell Route Coverage (All Admin routes covered by 1800px Shell)", () => {
    const adminRoutes = [
      // Core & Dashboard
      "/admin",
      "/admin/dashboard",

      // K SELECT BRAND
      "/admin/applications",
      "/admin/companies",
      "/admin/brands",
      "/admin/products",
      "/admin/products/new",
      "/admin/products/curation",
      "/admin/products/6fc6e1ab-508e-465e-b59a-33ef7b41d145",
      "/admin/purchasing",
      "/admin/finance",
      "/admin/inquiries",

      // K SELECT HUB
      "/admin/retailers",
      "/admin/retailers/02ef5da7-5ffc-40ad-a5df-ef740263fca6",
      "/admin/store-operations",
      "/admin/exchange-credit",
      "/admin/exchange-credit/rma",
      "/admin/protection-reviews",
      "/admin/protection-reviews/6fc6e1ab-508e-465e-b59a-33ef7b41d145",
      "/admin/trading-products",
      "/admin/trading-products/prd-123",
      "/admin/sales/orders",
      "/admin/sales/performance",
      "/admin/finance/receivables",
      "/admin/knowledge",

      // General Operations & Settings
      "/admin/tasks",
      "/admin/reports",
      "/admin/insights",
      "/admin/simulator",
      "/admin/settings",
      "/admin/settings/warehouse",
      "/admin/staff",
    ];

    it.each(adminRoutes)("applies global 1800px shell to '%s'", (path) => {
      expect(isAdminShellRoute(path)).toBe(true);
      // Backwards-compatibility alias check
      expect(isPilotMaxWidthRoute(path)).toBe(true);
    });

    it("excludes non-admin routes and auth routes from admin shell", () => {
      expect(isAdminShellRoute("/admin/login")).toBe(false);
      expect(isAdminShellRoute("/admin/forgot-password")).toBe(false);
      expect(isAdminShellRoute("/portal")).toBe(false);
      expect(isAdminShellRoute("/portal/products")).toBe(false);
      expect(isAdminShellRoute("/")).toBe(false);
      expect(isAdminShellRoute(null)).toBe(false);
      expect(isAdminShellRoute(undefined as unknown as string)).toBe(false);
    });
  });

  describe("Responsive Viewport Metrics Calculation (Expected Shell Width & Balanced Margins)", () => {
    const testCases = [
      { viewport: 390, expectedShell: 390, expectedMargin: 0, isCapped: false },
      { viewport: 768, expectedShell: 768, expectedMargin: 0, isCapped: false },
      { viewport: 1024, expectedShell: 1024, expectedMargin: 0, isCapped: false },
      { viewport: 1280, expectedShell: 1280, expectedMargin: 0, isCapped: false },
      { viewport: 1440, expectedShell: 1440, expectedMargin: 0, isCapped: false },
      { viewport: 1600, expectedShell: 1600, expectedMargin: 0, isCapped: false },
      { viewport: 1800, expectedShell: 1800, expectedMargin: 0, isCapped: false },
      { viewport: 1920, expectedShell: 1800, expectedMargin: 60, isCapped: true },
      { viewport: 2560, expectedShell: 1800, expectedMargin: 380, isCapped: true },
    ];

    it.each(testCases)(
      "viewport $viewport px -> shell $expectedShell px, outer margin $expectedMargin px each, capped: $isCapped",
      ({ viewport, expectedShell, expectedMargin, isCapped }) => {
        const metrics = getAdminShellMetrics(viewport);
        expect(metrics.shellWidth).toBe(expectedShell);
        expect(metrics.outerMarginEach).toBe(expectedMargin);
        expect(metrics.isCapped).toBe(isCapped);
      }
    );
  });

  describe("Backwards Compatibility Preservation", () => {
    it("maintains PILOT_MAX_WIDTH_PREFIXES for legacy references", () => {
      expect(PILOT_MAX_WIDTH_PREFIXES).toContain("/admin/retailers");
      expect(PILOT_MAX_WIDTH_PREFIXES).toContain("/admin/store-operations");
      expect(PILOT_MAX_WIDTH_PREFIXES).toContain("/admin/exchange-credit");
      expect(PILOT_MAX_WIDTH_PREFIXES).toContain("/admin/protection-reviews");
      expect(PILOT_MAX_WIDTH_PREFIXES).toContain("/admin/stores");
    });
  });
});
