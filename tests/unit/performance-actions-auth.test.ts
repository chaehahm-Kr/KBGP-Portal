import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DAL auth module
vi.mock("@/lib/auth/dal", () => ({
  verifyAdminSession: vi.fn(),
}));

// Mock the Supabase admin client
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
  })),
}));

// Mock the performance-service
vi.mock("@/lib/product/performance/performance-service", () => ({
  queryProductPerformanceList: vi.fn(() =>
    Promise.resolve({
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 25,
      totalPages: 0,
      period: { asOfDate: "2026-10-18", lookbackDays: 60, timezone: "America/New_York" },
      benchmarkMs: 10,
      kpiSummary: {
        totalB2bNetSales: 0,
        totalGrossProfit: null,
        aggregateGrossMargin: null,
        totalHqInventoryValue: null,
        totalAvailableUnits: 0,
        uniqueExchangeClaimingStores: 0,
        productsNeedingAction: "POLICY PENDING",
        hasMissingCostProvenance: true,
        hasMissingInventoryCost: true,
      },
    })
  ),
  getProductPerformanceById: vi.fn(() => Promise.resolve(null)),
}));

import { verifyAdminSession } from "@/lib/auth/dal";
import {
  fetchProductPerformancePageAction,
  fetchProductPerformanceByIdAction,
  fetchPerformanceFilterOptionsAction,
} from "@/lib/product/performance/performance-actions";

describe("Performance Actions Authorization Security Verification (ADM-GRADING-DATA-003-R3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Direct Unauthenticated Access", () => {
    it("rejects fetchProductPerformancePageAction when unauthenticated", async () => {
      vi.mocked(verifyAdminSession).mockRejectedValueOnce(new Error("NEXT_REDIRECT: /admin/login?reason=session_expired"));

      const res = await fetchProductPerformancePageAction();
      expect(res.success).toBe(false);
      expect(res.data).toBeUndefined();
      expect(res.error).toContain("session_expired");
    });

    it("rejects fetchProductPerformanceByIdAction when unauthenticated", async () => {
      vi.mocked(verifyAdminSession).mockRejectedValueOnce(new Error("NEXT_REDIRECT: /admin/login?reason=session_expired"));

      const res = await fetchProductPerformanceByIdAction("test-prod-id");
      expect(res.success).toBe(false);
      expect(res.data).toBeUndefined();
      expect(res.error).toContain("session_expired");
    });

    it("rejects fetchPerformanceFilterOptionsAction when unauthenticated", async () => {
      vi.mocked(verifyAdminSession).mockRejectedValueOnce(new Error("NEXT_REDIRECT: /admin/login?reason=session_expired"));

      const res = await fetchPerformanceFilterOptionsAction();
      expect(res.success).toBe(false);
      expect(res.data).toBeUndefined();
      expect(res.error).toContain("session_expired");
    });
  });

  describe("Brand Portal (Role: portal) Access Rejection", () => {
    it("rejects fetchProductPerformancePageAction for Brand user", async () => {
      vi.mocked(verifyAdminSession).mockRejectedValueOnce(new Error("NEXT_REDIRECT: /admin/login?reason=role_mismatch"));

      const res = await fetchProductPerformancePageAction();
      expect(res.success).toBe(false);
      expect(res.data).toBeUndefined();
      expect(res.error).toContain("role_mismatch");
    });
  });

  describe("Retailer Portal (Role: retailer) Access Rejection", () => {
    it("rejects fetchProductPerformancePageAction for Retailer user", async () => {
      vi.mocked(verifyAdminSession).mockRejectedValueOnce(new Error("NEXT_REDIRECT: /admin/login?reason=role_mismatch"));

      const res = await fetchProductPerformancePageAction();
      expect(res.success).toBe(false);
      expect(res.data).toBeUndefined();
      expect(res.error).toContain("role_mismatch");
    });
  });

  describe("Authorized Admin User Access", () => {
    it("allows fetchProductPerformancePageAction for verified Admin session", async () => {
      vi.mocked(verifyAdminSession).mockResolvedValueOnce({
        userId: "admin-uuid-1234",
        email: "qa-admin-test@letusto.com",
        role: "admin",
      });

      const res = await fetchProductPerformancePageAction();
      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.error).toBeUndefined();
      expect(verifyAdminSession).toHaveBeenCalledTimes(1);
    });

    it("allows fetchProductPerformanceByIdAction for verified Admin session", async () => {
      vi.mocked(verifyAdminSession).mockResolvedValueOnce({
        userId: "admin-uuid-1234",
        email: "qa-admin-test@letusto.com",
        role: "admin",
      });

      const res = await fetchProductPerformanceByIdAction("test-prod-id");
      expect(res.success).toBe(true);
      expect(verifyAdminSession).toHaveBeenCalledTimes(1);
    });
  });
});
