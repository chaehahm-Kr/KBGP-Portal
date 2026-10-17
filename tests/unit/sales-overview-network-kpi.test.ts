/**
 * Sales Overview V1.0 — Canonical Network KPI Integration Unit Tests
 * Task ID: ADM-SALES-PERF-004-R1
 * Location: tests/unit/sales-overview-network-kpi.test.ts
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import {
  getSalesOverviewPeriodET,
  isTimestampInEtWindow,
  aggregateSalesOverviewData,
  type RawStoreRecord,
  type RawOrderRecord,
  type RawOrderItemRecord,
  type RawRefundRecord,
  type RawCostRecord,
  type RawProductRecord,
  type RawInventoryLayerRecord,
  type RawExchangeClaimRecord,
  type RawWeeklyCheckRecord,
} from "../../lib/sales-overview";

describe("Sales Overview V1.0 — Canonical Network KPI Integration", () => {
  const TEST_AS_OF_DATE = "2026-10-17";

  // Mock Master Records
  const mockStores: RawStoreRecord[] = [
    {
      id: "store-001",
      name: "Manhattan Flagship",
      storeCode: "ST-NY-01",
      companyId: "comp-001",
      companyName: "Empire Retail LLC",
      city: "New York",
      state: "NY",
      status: "active",
      createdAt: "2025-01-01T00:00:00Z",
    },
    {
      id: "store-002",
      name: "Brooklyn Heights",
      storeCode: "ST-NY-02",
      companyId: "comp-001",
      companyName: "Empire Retail LLC",
      city: "Brooklyn",
      state: "NY",
      status: "active",
      createdAt: "2025-06-01T00:00:00Z",
    },
    {
      id: "store-003",
      name: "Queens Center",
      storeCode: "ST-NY-03",
      companyId: "comp-002",
      companyName: "Queens Goods Co",
      city: "Queens",
      state: "NY",
      status: "active",
      createdAt: "2026-02-01T00:00:00Z",
    },
    {
      id: "store-004",
      name: "Staten Island Outlet",
      storeCode: "ST-NY-04",
      companyId: "comp-003",
      companyName: "Island Retail Corp",
      city: "Staten Island",
      state: "NY",
      status: "inactive",
      createdAt: "2025-03-01T00:00:00Z",
    },
  ];

  const mockProducts: RawProductRecord[] = [
    {
      id: "prod-001",
      sku: "SKU-BEAUTY-01",
      name: "Hydrating Facial Serum",
      brandId: "brand-001",
      brandName: "GlowLab",
      categoryId: "cat-001",
      categoryName: "Skincare",
    },
    {
      id: "prod-002",
      sku: "SKU-BEAUTY-02",
      name: "Revitalizing Toner",
      brandId: "brand-001",
      brandName: "GlowLab",
      categoryId: "cat-001",
      categoryName: "Skincare",
    },
    {
      id: "prod-003",
      sku: "SKU-SNACK-01",
      name: "Organic Dried Mango Crisps",
      brandId: "brand-002",
      brandName: "NatureBites",
      categoryId: "cat-002",
      categoryName: "Food & Beverage",
    },
  ];

  // -------------------------------------------------------------------------
  // 1. EVALUATION PERIOD & AMERICA/NEW_YORK TIME BOUNDARIES
  // -------------------------------------------------------------------------
  describe("1. Time Boundary & Evaluation Period Contract", () => {
    it("computes exact completed 30-calendar-day window in America/New_York", () => {
      const period = getSalesOverviewPeriodET(TEST_AS_OF_DATE);

      expect(period.timezone).toBe("America/New_York");
      expect(period.asOfDate).toBe("2026-10-17");
      // Current: [T-30, T) = [2026-09-17, 2026-10-17)
      expect(period.currentPeriodStart).toBe("2026-09-17");
      expect(period.currentPeriodEnd).toBe("2026-10-17");
      // Previous: [T-60, T-30) = [2026-08-18, 2026-09-17)
      expect(period.previousPeriodStart).toBe("2026-08-18");
      expect(period.previousPeriodEnd).toBe("2026-09-17");
      expect(period.daysInPeriod).toBe(30);
    });

    it("verifies [start, end) half-open interval excluding incomplete current day", () => {
      // 2026-10-17 10:00:00 EDT should be excluded from completed period [2026-09-17, 2026-10-17)
      expect(isTimestampInEtWindow("2026-10-17T14:00:00Z", "2026-09-17", "2026-10-17")).toBe(false);
      // 2026-10-16 23:59:00 EDT (2026-10-17 03:59:00 UTC) is within completed period
      expect(isTimestampInEtWindow("2026-10-17T03:59:00Z", "2026-09-17", "2026-10-17")).toBe(true);
      // 2026-09-17 00:01:00 EDT is within completed period
      expect(isTimestampInEtWindow("2026-09-17T04:01:00Z", "2026-09-17", "2026-10-17")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 2. NETWORK SCOPE, TEST ORDER & CANCELLATION EXCLUSION
  // -------------------------------------------------------------------------
  describe("2. Network Scope & Order Validation", () => {
    it("excludes test orders, cancelled orders, and draft orders from B2B Net Sales", () => {
      const orders: RawOrderRecord[] = [
        {
          id: "ord-test-01",
          orderNumber: "ORD-TEST-001",
          companyId: "comp-001",
          storeId: "store-001",
          orderStatus: "completed",
          paymentStatus: "paid",
          subtotalAmount: 1000,
          discountAmount: 0,
          totalAmount: 1000,
          isTest: true, // Should be excluded
          createdAt: "2026-10-01T12:00:00Z",
        },
        {
          id: "ord-cancel-01",
          orderNumber: "ORD-CAN-001",
          companyId: "comp-001",
          storeId: "store-001",
          orderStatus: "cancelled", // Should be excluded
          paymentStatus: "cancelled",
          subtotalAmount: 1500,
          discountAmount: 0,
          totalAmount: 1500,
          isTest: false,
          createdAt: "2026-10-02T12:00:00Z",
        },
        {
          id: "ord-valid-01",
          orderNumber: "ORD-VAL-001",
          companyId: "comp-001",
          storeId: "store-001",
          orderStatus: "delivered",
          paymentStatus: "paid",
          subtotalAmount: 2000,
          discountAmount: 200,
          totalAmount: 1800,
          isTest: false,
          createdAt: "2026-10-03T12:00:00Z",
        },
      ];

      const res = aggregateSalesOverviewData({
        asOfDate: TEST_AS_OF_DATE,
        stores: mockStores,
        orders,
        orderItems: [],
        refunds: [],
        costs: [],
        products: mockProducts,
        inventoryLayers: [],
        claims: [],
        weeklyChecks: [],
      });

      // Only ord-valid-01 counts: 2000 subtotal - 200 discount = 1800
      expect(res.kpis.b2bNetSales.value).toBe(1800);
      expect(res.kpis.orderingStores.value).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // 3. REFUND & DISCOUNT HANDLING
  // -------------------------------------------------------------------------
  describe("3. Refund and Discount Handling", () => {
    it("deducts merchandise refunds and order-level discounts from Gross Subtotal", () => {
      const orders: RawOrderRecord[] = [
        {
          id: "ord-ref-01",
          orderNumber: "ORD-REF-001",
          companyId: "comp-001",
          storeId: "store-001",
          orderStatus: "delivered",
          paymentStatus: "paid",
          subtotalAmount: 5000,
          discountAmount: 500,
          totalAmount: 4500,
          isTest: false,
          createdAt: "2026-10-05T12:00:00Z",
        },
      ];

      const refunds: RawRefundRecord[] = [
        {
          id: "ref-01",
          orderId: "ord-ref-01",
          merchandiseAmount: 300,
          status: "completed",
          createdAt: "2026-10-08T12:00:00Z",
        },
      ];

      const res = aggregateSalesOverviewData({
        asOfDate: TEST_AS_OF_DATE,
        stores: mockStores,
        orders,
        orderItems: [],
        refunds,
        costs: [],
        products: mockProducts,
        inventoryLayers: [],
        claims: [],
        weeklyChecks: [],
      });

      // 5000 - 500 - 300 = 4200
      expect(res.kpis.b2bNetSales.value).toBe(4200);
      expect(res.kpis.b2bNetSales.metadata?.discounts).toBe(500);
      expect(res.kpis.b2bNetSales.metadata?.refunds).toBe(300);
    });
  });

  // -------------------------------------------------------------------------
  // 4. STORE / SKU AGGREGATION PARITY & UNALLOCATED ORDERS
  // -------------------------------------------------------------------------
  describe("4. Store / SKU Reconciliation & Unallocated Orders", () => {
    it("reconciles Store-Attributed Sales + Company-Unallocated Sales with Network Net Sales", () => {
      const orders: RawOrderRecord[] = [
        // Store allocated order
        {
          id: "ord-st-01",
          orderNumber: "ORD-ST-001",
          companyId: "comp-001",
          storeId: "store-001",
          orderStatus: "delivered",
          paymentStatus: "paid",
          subtotalAmount: 3000,
          discountAmount: 300,
          totalAmount: 2700,
          isTest: false,
          createdAt: "2026-10-04T12:00:00Z",
        },
        // Company unallocated order (storeId is null)
        {
          id: "ord-comp-01",
          orderNumber: "ORD-HQ-001",
          companyId: "comp-002",
          storeId: null,
          orderStatus: "delivered",
          paymentStatus: "paid",
          subtotalAmount: 1500,
          discountAmount: 100,
          totalAmount: 1400,
          isTest: false,
          createdAt: "2026-10-06T12:00:00Z",
        },
      ];

      const res = aggregateSalesOverviewData({
        asOfDate: TEST_AS_OF_DATE,
        stores: mockStores,
        orders,
        orderItems: [],
        refunds: [],
        costs: [],
        products: mockProducts,
        inventoryLayers: [],
        claims: [],
        weeklyChecks: [],
      });

      // Network Sales = 2700 + 1400 = 4100
      expect(res.kpis.b2bNetSales.value).toBe(4100);
      expect(res.reconciliation.storeAttributedSales).toBe(2700);
      expect(res.reconciliation.companyUnallocatedSales).toBe(1400);
      expect(res.reconciliation.storeDiscrepancyDollars).toBe(0);
      expect(res.reconciliation.isStoreReconciled).toBe(true);

      // Ordering stores should only count store-001 (not unallocated company order)
      expect(res.kpis.orderingStores.value).toBe(1);
      expect(res.kpis.dataCompleteness.unallocatedOrdersCount).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // 5. HISTORICAL LANDED COGS, GROSS PROFIT & N/A POLICY
  // -------------------------------------------------------------------------
  describe("5. Historical COGS, Gross Profit & N/A Policy", () => {
    it("calculates Gross Profit and Gross Margin accurately when 100% cost coverage exists", () => {
      const orders: RawOrderRecord[] = [
        {
          id: "ord-cogs-01",
          orderNumber: "ORD-CG-001",
          companyId: "comp-001",
          storeId: "store-001",
          orderStatus: "delivered",
          paymentStatus: "paid",
          subtotalAmount: 2000,
          discountAmount: 0,
          totalAmount: 2000,
          isTest: false,
          createdAt: "2026-10-05T12:00:00Z",
        },
      ];

      const orderItems: RawOrderItemRecord[] = [
        {
          id: "item-01",
          orderId: "ord-cogs-01",
          productId: "prod-001",
          quantity: 100,
          unitPrice: 20, // 100 * 20 = 2000
          subtotal: 2000,
        },
      ];

      const costs: RawCostRecord[] = [
        {
          productId: "prod-001",
          effectiveDate: "2026-09-01", // Prior to order date
          unitLandedCost: 12, // 100 * 12 = 1200 COGS
        },
      ];

      const res = aggregateSalesOverviewData({
        asOfDate: TEST_AS_OF_DATE,
        stores: mockStores,
        orders,
        orderItems,
        refunds: [],
        costs,
        products: mockProducts,
        inventoryLayers: [],
        claims: [],
        weeklyChecks: [],
      });

      expect(res.kpis.b2bNetSales.value).toBe(2000);
      expect(res.kpis.dataCompleteness.costCoveragePercent).toBe(100.0);
      expect(res.kpis.grossProfit.status).toBe("ACTUAL");
      expect(res.kpis.grossProfit.value).toBe(800); // 2000 - 1200
      expect(res.kpis.grossMargin.status).toBe("ACTUAL");
      expect(res.kpis.grossMargin.value).toBe(40.0); // (800 / 2000) * 100
      expect(res.kpis.grossMargin.formatted).toBe("40.0%");
    });

    it("returns Gross Profit and Margin as N/A when historical cost is incomplete", () => {
      const orders: RawOrderRecord[] = [
        {
          id: "ord-missing-cogs",
          orderNumber: "ORD-MISS-01",
          companyId: "comp-001",
          storeId: "store-001",
          orderStatus: "delivered",
          paymentStatus: "paid",
          subtotalAmount: 1000,
          discountAmount: 0,
          totalAmount: 1000,
          isTest: false,
          createdAt: "2026-10-05T12:00:00Z",
        },
      ];

      const orderItems: RawOrderItemRecord[] = [
        {
          id: "item-missing",
          orderId: "ord-missing-cogs",
          productId: "prod-003", // Has no historical cost record
          quantity: 50,
          unitPrice: 20,
          subtotal: 1000,
        },
      ];

      const res = aggregateSalesOverviewData({
        asOfDate: TEST_AS_OF_DATE,
        stores: mockStores,
        orders,
        orderItems,
        refunds: [],
        costs: [], // Missing cost!
        products: mockProducts,
        inventoryLayers: [],
        claims: [],
        weeklyChecks: [],
      });

      expect(res.kpis.b2bNetSales.value).toBe(1000);
      expect(res.kpis.dataCompleteness.costCoveragePercent).toBe(0.0);
      expect(res.kpis.dataCompleteness.orderLinesMissingCostCount).toBe(1);
      expect(res.kpis.grossProfit.status).toBe("UNAVAILABLE");
      expect(res.kpis.grossProfit.value).toBeNull();
      expect(res.kpis.grossProfit.formatted).toBe("N/A");
      expect(res.kpis.grossMargin.status).toBe("UNAVAILABLE");
      expect(res.kpis.grossMargin.value).toBeNull();
      expect(res.kpis.grossMargin.formatted).toBe("N/A");
      // Action center lists the missing cost product fact
      expect(res.actionCenter.missingCostProducts.length).toBe(1);
      expect(res.actionCenter.missingCostProducts[0].productId).toBe("prod-003");
    });
  });

  // -------------------------------------------------------------------------
  // 6. ORDERING STORES, REORDER STORES & REORDER RATE
  // -------------------------------------------------------------------------
  describe("6. Ordering Stores, Reorder Stores & Rate Deduplication", () => {
    it("accurately computes Reorder Stores and Reorder Rate with distinct store deduplication", () => {
      const orders: RawOrderRecord[] = [
        // Store 001 first lifetime order (placed back in August)
        {
          id: "ord-st1-initial",
          orderNumber: "ORD-ST1-01",
          companyId: "comp-001",
          storeId: "store-001",
          orderStatus: "delivered",
          paymentStatus: "paid",
          subtotalAmount: 1000,
          discountAmount: 0,
          totalAmount: 1000,
          isTest: false,
          createdAt: "2026-08-20T12:00:00Z", // In previous period
        },
        // Store 001 second order (placed in current period => Confirmed Reorder!)
        {
          id: "ord-st1-reorder",
          orderNumber: "ORD-ST1-02",
          companyId: "comp-001",
          storeId: "store-001",
          orderStatus: "delivered",
          paymentStatus: "paid",
          subtotalAmount: 1200,
          discountAmount: 0,
          totalAmount: 1200,
          isTest: false,
          createdAt: "2026-09-25T12:00:00Z", // In current period
        },
        // Store 001 third order (also in current period => should not double count reorder store)
        {
          id: "ord-st1-reorder2",
          orderNumber: "ORD-ST1-03",
          companyId: "comp-001",
          storeId: "store-001",
          orderStatus: "delivered",
          paymentStatus: "paid",
          subtotalAmount: 800,
          discountAmount: 0,
          totalAmount: 800,
          isTest: false,
          createdAt: "2026-10-02T12:00:00Z",
        },
        // Store 002 initial lifetime order in current period (NOT a reorder store)
        {
          id: "ord-st2-first",
          orderNumber: "ORD-ST2-01",
          companyId: "comp-001",
          storeId: "store-002",
          orderStatus: "delivered",
          paymentStatus: "paid",
          subtotalAmount: 1500,
          discountAmount: 0,
          totalAmount: 1500,
          isTest: false,
          createdAt: "2026-10-01T12:00:00Z",
        },
      ];

      const res = aggregateSalesOverviewData({
        asOfDate: TEST_AS_OF_DATE,
        stores: mockStores,
        orders,
        orderItems: [],
        refunds: [],
        costs: [],
        products: mockProducts,
        inventoryLayers: [],
        claims: [],
        weeklyChecks: [],
      });

      // Current period orders: Store 001 and Store 002 => 2 ordering stores
      expect(res.kpis.orderingStores.value).toBe(2);
      // Reordering stores: Only Store 001 => 1 reorder store
      expect(res.kpis.reorderStores.value).toBe(1);
      // Reorder rate: 1 / 2 = 50.0%
      expect(res.kpis.reorderRate.value).toBe(50.0);
      expect(res.kpis.reorderRate.formatted).toBe("50.0%");
      // Active stores count is 3 (store-001, store-002, store-003) and kept separate
      expect(res.activeStoresCount).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // 7. SALES GROWTH COMPARISON & ZERO PRIOR PERIOD HANDLING
  // -------------------------------------------------------------------------
  describe("7. Sales Growth Comparison & Zero Prior Period Handling", () => {
    it("handles zero prior period revenue as New Revenue without NaN or Infinity", () => {
      const orders: RawOrderRecord[] = [
        {
          id: "ord-new-rev",
          orderNumber: "ORD-NR-01",
          companyId: "comp-001",
          storeId: "store-001",
          orderStatus: "delivered",
          paymentStatus: "paid",
          subtotalAmount: 3500,
          discountAmount: 0,
          totalAmount: 3500,
          isTest: false,
          createdAt: "2026-10-05T12:00:00Z", // Current period
        },
      ];

      const res = aggregateSalesOverviewData({
        asOfDate: TEST_AS_OF_DATE,
        stores: mockStores,
        orders,
        orderItems: [],
        refunds: [],
        costs: [],
        products: mockProducts,
        inventoryLayers: [],
        claims: [],
        weeklyChecks: [],
      });

      expect(res.kpis.salesGrowth.currentSales).toBe(3500);
      expect(res.kpis.salesGrowth.previousSales).toBe(0);
      expect(res.kpis.salesGrowth.percent).toBeNull();
      expect(res.kpis.salesGrowth.label).toBe("New Revenue");
    });

    it("calculates positive growth accurately between two 30-day periods", () => {
      const orders: RawOrderRecord[] = [
        // Previous period order (T - 40 days)
        {
          id: "ord-prev-01",
          orderNumber: "ORD-PRV-01",
          companyId: "comp-001",
          storeId: "store-001",
          orderStatus: "delivered",
          paymentStatus: "paid",
          subtotalAmount: 2000,
          discountAmount: 0,
          totalAmount: 2000,
          isTest: false,
          createdAt: "2026-09-05T12:00:00Z",
        },
        // Current period order (T - 10 days)
        {
          id: "ord-cur-01",
          orderNumber: "ORD-CUR-01",
          companyId: "comp-001",
          storeId: "store-001",
          orderStatus: "delivered",
          paymentStatus: "paid",
          subtotalAmount: 2500,
          discountAmount: 0,
          totalAmount: 2500,
          isTest: false,
          createdAt: "2026-10-07T12:00:00Z",
        },
      ];

      const res = aggregateSalesOverviewData({
        asOfDate: TEST_AS_OF_DATE,
        stores: mockStores,
        orders,
        orderItems: [],
        refunds: [],
        costs: [],
        products: mockProducts,
        inventoryLayers: [],
        claims: [],
        weeklyChecks: [],
      });

      expect(res.kpis.salesGrowth.currentSales).toBe(2500);
      expect(res.kpis.salesGrowth.previousSales).toBe(2000);
      // (2500 - 2000) / 2000 * 100 = +25.0%
      expect(res.kpis.salesGrowth.percent).toBe(25.0);
      expect(res.kpis.salesGrowth.label).toBe("+25.0%");
    });
  });

  // -------------------------------------------------------------------------
  // 8. HQ INVENTORY AS-OF-DATE SNAPSHOT
  // -------------------------------------------------------------------------
  describe("8. HQ Inventory Value As-of-Date Snapshot", () => {
    it("computes current HQ inventory valuation as-of-date and excludes depleted layers", () => {
      const inventoryLayers: RawInventoryLayerRecord[] = [
        {
          productId: "prod-001",
          remainingQty: 50,
          unitLandedCost: 10,
          status: "ACTIVE", // 50 * 10 = 500
        },
        {
          productId: "prod-002",
          remainingQty: 100,
          unitLandedCost: 15,
          status: "ACTIVE", // 100 * 15 = 1500
        },
        {
          productId: "prod-003",
          remainingQty: 0,
          unitLandedCost: 8,
          status: "DEPLETED", // Excluded
        },
      ];

      const res = aggregateSalesOverviewData({
        asOfDate: TEST_AS_OF_DATE,
        stores: mockStores,
        orders: [],
        orderItems: [],
        refunds: [],
        costs: [],
        products: mockProducts,
        inventoryLayers,
        claims: [],
        weeklyChecks: [],
      });

      // 500 + 1500 = 2000
      expect(res.kpis.hqInventoryValue.value).toBe(2000);
      expect(res.kpis.hqInventoryValue.formatted).toBe("$2,000.00");
      expect(res.kpis.hqInventoryValue.status).toBe("ACTUAL");
    });
  });

  // -------------------------------------------------------------------------
  // 9. ACTION CENTER FACTUAL INDICATORS
  // -------------------------------------------------------------------------
  describe("9. Action Center Factual Indicators (No Arbitrary Thresholds)", () => {
    it("identifies declining stores and dormant stores factually", () => {
      const orders: RawOrderRecord[] = [
        // Store 001 ordered 3000 in previous, 1000 in current => Declining
        {
          id: "ord-st1-p",
          orderNumber: "ORD-ST1-P",
          companyId: "comp-001",
          storeId: "store-001",
          orderStatus: "delivered",
          paymentStatus: "paid",
          subtotalAmount: 3000,
          discountAmount: 0,
          totalAmount: 3000,
          isTest: false,
          createdAt: "2026-09-01T12:00:00Z",
        },
        {
          id: "ord-st1-c",
          orderNumber: "ORD-ST1-C",
          companyId: "comp-001",
          storeId: "store-001",
          orderStatus: "delivered",
          paymentStatus: "paid",
          subtotalAmount: 1000,
          discountAmount: 0,
          totalAmount: 1000,
          isTest: false,
          createdAt: "2026-10-01T12:00:00Z",
        },
        // Store 002 ordered 2000 in previous, 0 in current => Dormant
        {
          id: "ord-st2-p",
          orderNumber: "ORD-ST2-P",
          companyId: "comp-001",
          storeId: "store-002",
          orderStatus: "delivered",
          paymentStatus: "paid",
          subtotalAmount: 2000,
          discountAmount: 0,
          totalAmount: 2000,
          isTest: false,
          createdAt: "2026-09-05T12:00:00Z",
        },
      ];

      const res = aggregateSalesOverviewData({
        asOfDate: TEST_AS_OF_DATE,
        stores: mockStores,
        orders,
        orderItems: [],
        refunds: [],
        costs: [],
        products: mockProducts,
        inventoryLayers: [],
        claims: [],
        weeklyChecks: [],
      });

      // Declining stores
      expect(res.actionCenter.decliningStores.length).toBe(1);
      expect(res.actionCenter.decliningStores[0].storeId).toBe("store-001");
      expect(res.actionCenter.decliningStores[0].declineDollars).toBe(2000);
      expect(res.actionCenter.decliningStores[0].declinePercent).toBe(66.7);

      // Dormant stores
      expect(res.actionCenter.dormantStores.length).toBe(1);
      expect(res.actionCenter.dormantStores[0].storeId).toBe("store-002");
      expect(res.actionCenter.dormantStores[0].previousSalesDollars).toBe(2000);
    });
  });

  // -------------------------------------------------------------------------
  // 10. EMPTY / MISSING RECORDS GRACEFUL HANDLING
  // -------------------------------------------------------------------------
  describe("10. Empty Source Records & Safe Fallback", () => {
    it("handles completely empty source datasets gracefully without errors or NaN", () => {
      const res = aggregateSalesOverviewData({
        asOfDate: TEST_AS_OF_DATE,
        stores: [],
        orders: [],
        orderItems: [],
        refunds: [],
        costs: [],
        products: [],
        inventoryLayers: [],
        claims: [],
        weeklyChecks: [],
      });

      expect(res.kpis.b2bNetSales.value).toBe(0);
      expect(res.kpis.b2bNetSales.formatted).toBe("$0.00");
      expect(res.kpis.grossProfit.value).toBeNull();
      expect(res.kpis.grossProfit.formatted).toBe("N/A");
      expect(res.kpis.grossMargin.value).toBeNull();
      expect(res.kpis.grossMargin.formatted).toBe("N/A");
      expect(res.kpis.orderingStores.value).toBe(0);
      expect(res.kpis.reorderStores.value).toBe(0);
      expect(res.kpis.reorderRate.value).toBeNull();
      expect(res.kpis.reorderRate.formatted).toBe("N/A");
      expect(res.kpis.hqInventoryValue.value).toBe(0);
      expect(res.kpis.salesGrowth.label).toBe("N/A");
      expect(res.reconciliation.isStoreReconciled).toBe(true);
      expect(res.reconciliation.isSkuReconciled).toBe(true);
      expect(res.actionCenter.decliningStores).toEqual([]);
      expect(res.actionCenter.dormantStores).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // 11. DYNAMIC PERIOD SUPPORT (7D, 30D, 60D, 90D, CUSTOM RANGE)
  // -------------------------------------------------------------------------
  describe("11. Dynamic Period Support & Daily Trend Slicing", () => {
    it("correctly generates 7-day period and daily trend points", () => {
      const p7 = getSalesOverviewPeriodET(TEST_AS_OF_DATE, 7);
      expect(p7.daysInPeriod).toBe(7);
      expect(p7.currentPeriodEnd).toBe("2026-10-17");
      expect(p7.currentPeriodStart).toBe("2026-10-10");
      expect(p7.previousPeriodEnd).toBe("2026-10-10");
      expect(p7.previousPeriodStart).toBe("2026-10-03");

      const res = aggregateSalesOverviewData({
        asOfDate: TEST_AS_OF_DATE,
        lookbackDays: 7,
        stores: [],
        orders: [],
        orderItems: [],
        refunds: [],
        costs: [],
        products: [],
        inventoryLayers: [],
        claims: [],
        weeklyChecks: [],
      });
      expect(res.period.daysInPeriod).toBe(7);
      expect(res.kpis.dailySalesTrend.length).toBe(7);
    });

    it("correctly generates 60-day and 90-day periods and trend points", () => {
      const p60 = getSalesOverviewPeriodET(TEST_AS_OF_DATE, 60);
      expect(p60.daysInPeriod).toBe(60);
      expect(p60.currentPeriodStart).toBe("2026-08-18");

      const res60 = aggregateSalesOverviewData({
        asOfDate: TEST_AS_OF_DATE,
        lookbackDays: 60,
        stores: [],
        orders: [],
        orderItems: [],
        refunds: [],
        costs: [],
        products: [],
        inventoryLayers: [],
        claims: [],
        weeklyChecks: [],
      });
      expect(res60.kpis.dailySalesTrend.length).toBe(60);

      const p90 = getSalesOverviewPeriodET(TEST_AS_OF_DATE, 90);
      expect(p90.daysInPeriod).toBe(90);

      const res90 = aggregateSalesOverviewData({
        asOfDate: TEST_AS_OF_DATE,
        lookbackDays: 90,
        stores: [],
        orders: [],
        orderItems: [],
        refunds: [],
        costs: [],
        products: [],
        inventoryLayers: [],
        claims: [],
        weeklyChecks: [],
      });
      expect(res90.kpis.dailySalesTrend.length).toBe(90);
    });

    it("correctly generates custom date range and matching equal-length prior period", () => {
      const customRange = { start: "2026-09-01", end: "2026-09-15" };
      const pCustom = getSalesOverviewPeriodET(TEST_AS_OF_DATE, 30, customRange);
      expect(pCustom.currentPeriodStart).toBe("2026-09-01");
      expect(pCustom.currentPeriodEnd).toBe("2026-09-15");
      expect(pCustom.daysInPeriod).toBe(14);
      expect(pCustom.previousPeriodEnd).toBe("2026-09-01");
      expect(pCustom.previousPeriodStart).toBe("2026-08-18");

      const resCustom = aggregateSalesOverviewData({
        asOfDate: TEST_AS_OF_DATE,
        customRange,
        stores: [],
        orders: [],
        orderItems: [],
        refunds: [],
        costs: [],
        products: [],
        inventoryLayers: [],
        claims: [],
        weeklyChecks: [],
      });
    });
  });

  // -------------------------------------------------------------------------
  // 9. ZERO-SALES & MISSING-COST COVERAGE UX (ADM-SALES-PERF-004-R4)
  // -------------------------------------------------------------------------
  describe("9. Zero-Sales & Missing-Cost Coverage UX (ADM-SALES-PERF-004-R4)", () => {
    it("returns null (for N/A display) for costCoveragePercent and storeAttributionRatePercent when no eligible sales exist", () => {
      const res = aggregateSalesOverviewData({
        asOfDate: TEST_AS_OF_DATE,
        stores: mockStores,
        orders: [], // Zero sales
        orderItems: [],
        refunds: [],
        costs: [],
        products: mockProducts,
        inventoryLayers: [],
        claims: [],
        weeklyChecks: [],
      });

      expect(res.kpis.b2bNetSales.value).toBe(0);
      expect(res.kpis.dataCompleteness.costCoveragePercent).toBeNull();
      expect(res.kpis.dataCompleteness.storeAttributionRatePercent).toBeNull();
      expect(res.kpis.grossProfit.status).toBe("UNAVAILABLE");
      expect(res.kpis.grossProfit.formatted).toBe("N/A");
      expect(res.kpis.grossMargin.status).toBe("UNAVAILABLE");
      expect(res.kpis.grossMargin.formatted).toBe("N/A");
      expect(res.kpis.orderingStores.value).toBe(0);
      expect(res.kpis.reorderRate.value).toBeNull();
      expect(res.kpis.reorderRate.formatted).toBe("N/A");
    });

    it("returns accurate 100% metrics when eligible sales with verified costs exist", () => {
      const orders: RawOrderRecord[] = [
        {
          id: "ord-cov-01",
          orderNumber: "ORD-COV-01",
          companyId: "comp-001",
          storeId: "store-001",
          orderStatus: "delivered",
          paymentStatus: "paid",
          subtotalAmount: 1500,
          discountAmount: 0,
          totalAmount: 1500,
          isTest: false,
          createdAt: "2026-10-05T12:00:00Z",
        },
      ];

      const orderItems: RawOrderItemRecord[] = [
        {
          id: "item-cov-01",
          orderId: "ord-cov-01",
          productId: "prod-001",
          quantity: 75,
          unitPrice: 20,
          subtotal: 1500,
        },
      ];

      const costs: RawCostRecord[] = [
        {
          productId: "prod-001",
          effectiveDate: "2026-09-01",
          unitLandedCost: 10,
        },
      ];

      const res = aggregateSalesOverviewData({
        asOfDate: TEST_AS_OF_DATE,
        stores: mockStores,
        orders,
        orderItems,
        refunds: [],
        costs,
        products: mockProducts,
        inventoryLayers: [],
        claims: [],
        weeklyChecks: [],
      });

      expect(res.kpis.b2bNetSales.value).toBe(1500);
      expect(res.kpis.dataCompleteness.costCoveragePercent).toBe(100.0);
      expect(res.kpis.dataCompleteness.storeAttributionRatePercent).toBe(100.0);
      expect(res.kpis.grossProfit.status).toBe("ACTUAL");
      expect(res.kpis.grossProfit.value).toBe(750); // 1500 - 750
      expect(res.kpis.grossMargin.value).toBe(50.0);
    });

    it("correctly computes partial cost coverage and unallocated store attribution", () => {
      const orders: RawOrderRecord[] = [
        {
          id: "ord-partial-01",
          orderNumber: "ORD-P-01",
          companyId: "comp-001",
          storeId: "store-001", // Store attributed
          orderStatus: "delivered",
          paymentStatus: "paid",
          subtotalAmount: 1000,
          discountAmount: 0,
          totalAmount: 1000,
          isTest: false,
          createdAt: "2026-10-05T12:00:00Z",
        },
        {
          id: "ord-partial-02",
          orderNumber: "ORD-P-02",
          companyId: "comp-002",
          storeId: null, // Company unallocated
          orderStatus: "delivered",
          paymentStatus: "paid",
          subtotalAmount: 1000,
          discountAmount: 0,
          totalAmount: 1000,
          isTest: false,
          createdAt: "2026-10-06T12:00:00Z",
        },
      ];

      const orderItems: RawOrderItemRecord[] = [
        {
          id: "item-p-01",
          orderId: "ord-partial-01",
          productId: "prod-001", // Has cost
          quantity: 50,
          unitPrice: 20,
          subtotal: 1000,
        },
        {
          id: "item-p-02",
          orderId: "ord-partial-02",
          productId: "prod-003", // Missing cost
          quantity: 50,
          unitPrice: 20,
          subtotal: 1000,
        },
      ];

      const costs: RawCostRecord[] = [
        {
          productId: "prod-001",
          effectiveDate: "2026-09-01",
          unitLandedCost: 10,
        },
      ];

      const res = aggregateSalesOverviewData({
        asOfDate: TEST_AS_OF_DATE,
        stores: mockStores,
        orders,
        orderItems,
        refunds: [],
        costs,
        products: mockProducts,
        inventoryLayers: [],
        claims: [],
        weeklyChecks: [],
      });

      expect(res.kpis.b2bNetSales.value).toBe(2000);
      expect(res.kpis.dataCompleteness.costCoveragePercent).toBe(50.0);
      expect(res.kpis.dataCompleteness.storeAttributionRatePercent).toBe(50.0);
      expect(res.kpis.grossProfit.status).toBe("UNAVAILABLE");
      expect(res.kpis.grossProfit.formatted).toBe("N/A");
      expect(res.kpis.grossMargin.status).toBe("UNAVAILABLE");
      expect(res.kpis.grossMargin.formatted).toBe("N/A");
      expect(res.actionCenter.missingCostProducts.length).toBe(1);
    });
  });
});
