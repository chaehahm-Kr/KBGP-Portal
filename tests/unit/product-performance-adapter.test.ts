/**
 * Product Performance V2.0 — Canonical Data Adapter & Service Integration Tests
 * Task ID: ADM-SALES-PERF-003-R5
 * Location: tests/unit/product-performance-adapter.test.ts
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));
import {
  adaptProductCostMaster,
  adaptLandedCostRecords,
  adaptFifoInventoryLayers,
  adaptHqInventoryBalances,
  adaptFinancialOrderLines,
  adaptRetailerWeeklyReports,
  adaptExchangeClaims,
  adaptStoreCohortEligibilityRecords,
  adaptStoreCoverageTargets,
  buildMasterProductPerformanceInput,
  mapClaimLifecycleStatus,
} from "../../lib/product/performance/data-adapter";
import {
  queryProductPerformanceList,
  getProductPerformanceById,
  sanitizeRetailerPerformanceView,
} from "../../lib/product/performance/performance-service";
import { resolveEvaluationPeriod } from "../../lib/product/performance/helpers";
import type {
  RawDbProduct,
  RawDbLandedCostResult,
  RawDbInventoryCostLayer,
  RawDbInventoryBalance,
  RawDbRetailerOrder,
  RawDbRetailerOrderItem,
  RawDbRetailerOrderFulfillment,
  RawDbRetailerOrderFulfillmentItem,
  RawDbRetailerOrderRefundRecord,
  RawDbRetailerWeeklyCheck,
  RawDbRetailerWeeklyCheckItem,
  RawDbRetailerExchangeClaim,
  RawDbRetailerExchangeClaimItem,
  RawDbRetailerProtectedSupplyCohort,
  RawDbStore,
  RawDbRetailerStoreProduct,
} from "../../lib/product/performance/types";

describe("Product Performance V2.0 — Canonical Data Adapter & Service (R5)", () => {
  const mockPeriod = resolveEvaluationPeriod("2026-10-15", 60);
  const PROD_ID = "prod_centella_101";

  const sampleProduct: RawDbProduct = {
    id: PROD_ID,
    name: "Centella Calming Ampoule",
    name_en: "Centella Calming Ampoule 50ml",
    letusto_sku: "KSEL-CTL-101",
    brand_id: "brand_kbeauty",
    category: "Skincare",
    category_code: "CAT_SKIN",
    status: "active",
    created_at: "2026-05-01T10:00:00Z",
    first_shipment_date: "2026-05-01",
    override_landed_cost: 12.5,
    override_landed_cost_updated_at: "2026-08-01T12:00:00Z",
    override_landed_cost_reason: "Direct air freight renegotiation",
    price_usd_fob: 10.0,
    price_krw_wholesale: 13000,
    brands: { id: "brand_kbeauty", name: "K-Beauty Lab" },
    categories: { id: "cat_skin", name: "Skincare", code: "CAT_SKIN" },
  };

  // =========================================================================
  // 1. DATA ADAPTER TESTS
  // =========================================================================
  describe("1. Data Adapter Unit Transformations", () => {
    it("adapts Product Cost Master and respects override provenance timestamp", () => {
      const costMaster = adaptProductCostMaster(sampleProduct);

      expect(costMaster.product_id).toBe(PROD_ID);
      expect(costMaster.sku).toBe("KSEL-CTL-101");
      expect(costMaster.override_landed_cost).toBe(12.5);
      expect(costMaster.override_effective_date).toBe("2026-08-01");
      expect(costMaster.override_reason).toBe("Direct air freight renegotiation");
      expect(costMaster.base_wholesale_price).toBe(10.0);
    });

    it("adapts Landed Cost Records from landed_cost_results and inventory_cost_layers in descending date order", () => {
      const results: RawDbLandedCostResult[] = [
        {
          id: "res_1",
          product_id: PROD_ID,
          received_date: "2026-07-15",
          unit_landed_cost: 11.0,
          cost_status: "FINAL",
          supplier_acquisition_cost: 8.0,
          freight_cost: 2.0,
          duty_cost: 1.0,
        },
      ];

      const layers: RawDbInventoryCostLayer[] = [
        {
          id: "lay_1",
          product_id: PROD_ID,
          warehouse_id: "wh_nj",
          received_date: "2026-09-01",
          original_qty: 100,
          remaining_qty: 60,
          unit_landed_cost: 12.0,
          status: "ACTIVE",
        },
      ];

      const adapted = adaptLandedCostRecords(PROD_ID, results, layers, sampleProduct);

      expect(adapted.length).toBe(3);
      // Descending by effective_date: 2026-09-01 (layer), 2026-08-01 (override), 2026-07-15 (result)
      expect(adapted[0].effective_date).toBe("2026-09-01");
      expect(adapted[0].source).toBe("inventory_cost_layers");
      expect(adapted[0].unit_landed_cost).toBe(12.0);

      expect(adapted[1].effective_date).toBe("2026-08-01");
      expect(adapted[1].source).toBe("override_landed_cost");
      expect(adapted[1].unit_landed_cost).toBe(12.5);

      expect(adapted[2].effective_date).toBe("2026-07-15");
      expect(adapted[2].source).toBe("landed_cost_results");
      expect(adapted[2].unit_landed_cost).toBe(11.0);
    });

    it("adapts HQ inventory balances segregating on-hand, hold, and damaged stock", () => {
      const balances: RawDbInventoryBalance[] = [
        {
          product_id: PROD_ID,
          warehouse_id: "wh_nj",
          qty_on_hand: 200,
          qty_hold: 20,
          qty_damaged: 5,
        },
        {
          product_id: PROD_ID,
          warehouse_id: "wh_ca",
          qty_on_hand: 150,
          qty_hold: 10,
          qty_damaged: 0,
        },
      ];

      const adapted = adaptHqInventoryBalances(PROD_ID, balances);
      expect(adapted.totalOnHand).toBe(350);
      expect(adapted.totalHold).toBe(30);
      expect(adapted.totalDamaged).toBe(5);
      // Available = 350 - 30 - 5 = 315
      expect(adapted.currentAvailableUnits).toBe(315);
    });

    it("adapts B2B order lines with partial shipments, discounts, and merchandise refunds allocated proportionally", () => {
      const ordersMap = new Map<string, RawDbRetailerOrder>([
        [
          "ord_1",
          {
            id: "ord_1",
            order_number: "PO-2026-001",
            company_id: "comp_1",
            store_id: "store_1",
            order_status: "DELIVERED",
            subtotal_amount: 1000.0,
            discount_amount: 100.0, // 10% discount
            shipping_amount: 50.0,
            tax_amount: 30.0,
            total_amount: 980.0,
            is_test: false,
            created_at: "2026-09-10T14:00:00Z",
          },
        ],
      ]);

      const orderItems: RawDbRetailerOrderItem[] = [
        {
          id: "item_1",
          order_id: "ord_1",
          product_id: PROD_ID,
          sku: "KSEL-CTL-101",
          quantity: 20,
          unit_wholesale_price: 25.0,
          line_total: 500.0, // 50% of order subtotal
        },
      ];

      const fulfillmentItems: RawDbRetailerOrderFulfillmentItem[] = [
        {
          id: "fi_1",
          fulfillment_id: "ful_1",
          order_item_id: "item_1",
          product_id: PROD_ID,
          quantity_shipped: 15, // Partial shipment: 15 of 20
        },
      ];

      const refunds: RawDbRetailerOrderRefundRecord[] = [
        {
          id: "ref_1",
          order_id: "ord_1",
          company_id: "comp_1",
          merchandise_amount: 50.0, // Order has $50 refund
          total_refund_amount: 50.0,
          refund_status: "completed",
        },
      ];

      const adapted = adaptFinancialOrderLines({
        productId: PROD_ID,
        orderItems,
        ordersMap,
        fulfillmentItems,
        refunds,
      });

      expect(adapted.length).toBe(1);
      const line = adapted[0];
      expect(line.ordered_qty).toBe(20);
      expect(line.shipped_qty).toBe(15); // Explicit partial fulfillment respected
      expect(line.unit_price).toBe(25.0);
      // 50% ratio on $100 discount = $50
      expect(line.merchandise_discount).toBe(50.0);
      // 50% ratio on $50 refund = $25
      expect(line.refunded_amount).toBe(25.0);
      // 25 / 25 = 1 refunded unit
      expect(line.refunded_qty).toBe(1);
    });

    it("maps Exchange Claim lifecycle status correctly across all enum states", () => {
      expect(mapClaimLifecycleStatus("submitted")).toBe("SUBMITTED");
      expect(mapClaimLifecycleStatus("under_review")).toBe("UNDER_REVIEW");
      expect(mapClaimLifecycleStatus("approved", "A")).toBe("APPROVED_OPTION_A");
      expect(mapClaimLifecycleStatus("approved", "B")).toBe("APPROVED_OPTION_B");
      expect(mapClaimLifecycleStatus("awaiting_return")).toBe("RMA_INSPECTED");
      expect(mapClaimLifecycleStatus("resolved")).toBe("SETTLED");
      expect(mapClaimLifecycleStatus("rejected")).toBe("REJECTED");
      expect(mapClaimLifecycleStatus("cancelled")).toBe("CANCELLED");
    });

    it("adapts Supply Cohorts distinguishing active 90-day protection from Day-100 maturity", () => {
      const cohorts: RawDbRetailerProtectedSupplyCohort[] = [
        {
          id: "coh_active",
          cohort_code: "COH-001",
          company_id: "comp_1",
          store_id: "store_1",
          product_id: PROD_ID,
          source_order_id: "ord_1",
          total_protected_quantity: 50,
          status: "active_protection",
          first_shipment_date: "2026-09-01",
          trial_end_date: "2026-11-30",
          evaluation_date: "2026-12-10",
          created_at: "2026-09-01T00:00:00Z",
        },
        {
          id: "coh_matured",
          cohort_code: "COH-002",
          company_id: "comp_2",
          store_id: "store_2",
          product_id: PROD_ID,
          source_order_id: "ord_2",
          total_protected_quantity: 30,
          status: "claim_window_open",
          first_shipment_date: "2026-06-01",
          trial_end_date: "2026-08-30",
          evaluation_date: "2026-09-09",
          created_at: "2026-06-01T00:00:00Z",
        },
      ];

      const adapted = adaptStoreCohortEligibilityRecords(PROD_ID, cohorts, mockPeriod);

      expect(adapted.length).toBe(2);
      const coh1 = adapted.find((c) => c.cohort_id === "coh_active")!;
      expect(coh1.is_in_active_protection_window).toBe(true);
      expect(coh1.is_matured_day_100).toBe(false);

      const coh2 = adapted.find((c) => c.cohort_id === "coh_matured")!;
      expect(coh2.is_in_active_protection_window).toBe(false);
      expect(coh2.is_matured_day_100).toBe(true);
    });
  });

  // =========================================================================
  // 2. QUERY SERVICE & BOUNDARY TESTS (WITH MOCK CLIENT)
  // =========================================================================
  describe("2. Performance Service Query & Boundary Enforcement", () => {
    function createMockSupabase(mockData: {
      products?: RawDbProduct[];
      costResults?: RawDbLandedCostResult[];
      costLayers?: RawDbInventoryCostLayer[];
      balances?: RawDbInventoryBalance[];
      orders?: RawDbRetailerOrder[];
      orderItems?: RawDbRetailerOrderItem[];
      fulfillmentItems?: RawDbRetailerOrderFulfillmentItem[];
      refunds?: RawDbRetailerOrderRefundRecord[];
      weeklyChecks?: RawDbRetailerWeeklyCheck[];
      weeklyCheckItems?: RawDbRetailerWeeklyCheckItem[];
      claims?: RawDbRetailerExchangeClaim[];
      claimItems?: RawDbRetailerExchangeClaimItem[];
      cohorts?: RawDbRetailerProtectedSupplyCohort[];
      stores?: RawDbStore[];
      storeProducts?: RawDbRetailerStoreProduct[];
    }) {
      const mockQueryBuilder = (tableName: string) => {
        let currentData: any[] = [];
        switch (tableName) {
          case "products":
            currentData = mockData.products || [];
            break;
          case "landed_cost_results":
            currentData = mockData.costResults || [];
            break;
          case "inventory_cost_layers":
            currentData = mockData.costLayers || [];
            break;
          case "inventory_balances":
            currentData = mockData.balances || [];
            break;
          case "retailer_orders":
            currentData = mockData.orders || [];
            break;
          case "retailer_order_items":
            currentData = mockData.orderItems || [];
            break;
          case "retailer_order_fulfillments":
            currentData = [];
            break;
          case "retailer_order_fulfillment_items":
            currentData = mockData.fulfillmentItems || [];
            break;
          case "retailer_order_refund_records":
            currentData = mockData.refunds || [];
            break;
          case "retailer_weekly_checks":
            currentData = mockData.weeklyChecks || [];
            break;
          case "retailer_weekly_check_items":
            currentData = mockData.weeklyCheckItems || [];
            break;
          case "retailer_exchange_claims":
            currentData = mockData.claims || [];
            break;
          case "retailer_exchange_claim_items":
            currentData = mockData.claimItems || [];
            break;
          case "retailer_protected_supply_cohorts":
            currentData = mockData.cohorts || [];
            break;
          case "stores":
            currentData = mockData.stores || [];
            break;
          case "retailer_store_products":
            currentData = mockData.storeProducts || [];
            break;
          default:
            currentData = [];
        }

        const builder: any = {
          select: () => builder,
          eq: (field: string, val: any) => {
            currentData = currentData.filter((row) => row[field] === val);
            return builder;
          },
          in: (field: string, vals: any[]) => {
            currentData = currentData.filter((row) => vals.includes(row[field]));
            return builder;
          },
          or: () => builder,
          order: () => builder,
          range: (from: number, to: number) => {
            const sliced = currentData.slice(from, to + 1);
            return Promise.resolve({ data: sliced, count: currentData.length, error: null });
          },
          then: (resolve: any) => resolve({ data: currentData, count: currentData.length, error: null }),
        };
        return builder;
      };

      return {
        from: (table: string) => mockQueryBuilder(table),
      } as any;
    }

    it("executes full canonical query pipeline and computes deterministic KPIs for admin", async () => {
      const mockClient = createMockSupabase({
        products: [sampleProduct],
        costResults: [
          {
            id: "r1",
            product_id: PROD_ID,
            received_date: "2026-08-01",
            unit_landed_cost: 10.0,
            cost_status: "FINAL",
          },
        ],
        costLayers: [
          {
            id: "l1",
            product_id: PROD_ID,
            warehouse_id: "wh1",
            received_date: "2026-08-01",
            original_qty: 100,
            remaining_qty: 100,
            unit_landed_cost: 10.0,
            status: "ACTIVE",
          },
        ],
        balances: [
          {
            product_id: PROD_ID,
            warehouse_id: "wh1",
            qty_on_hand: 100,
            qty_hold: 0,
            qty_damaged: 0,
          },
        ],
        orders: [
          {
            id: "o1",
            order_number: "PO-100",
            company_id: "c1",
            store_id: "s1",
            order_status: "DELIVERED",
            subtotal_amount: 500.0,
            total_amount: 500.0,
            created_at: "2026-09-01T10:00:00Z",
          },
        ],
        orderItems: [
          {
            id: "oi1",
            order_id: "o1",
            product_id: PROD_ID,
            sku: "KSEL-CTL-101",
            quantity: 20,
            unit_wholesale_price: 25.0,
            line_total: 500.0,
          },
        ],
        cohorts: [
          {
            id: "coh1",
            cohort_code: "COH-1",
            company_id: "c1",
            store_id: "s1",
            product_id: PROD_ID,
            source_order_id: "o1",
            total_protected_quantity: 20,
            status: "active_protection",
            first_shipment_date: "2026-09-01",
            trial_end_date: "2026-11-30",
            created_at: "2026-09-01T00:00:00Z",
          },
        ],
        stores: [{ id: "s1", name: "Store 1", status: "active", company_id: "c1" }],
      });

      const res = await queryProductPerformanceList(
        {
          productId: PROD_ID,
          asOfDate: "2026-10-15",
          lookbackDays: 60,
        },
        mockClient
      );

      expect(res.items.length).toBe(1);
      const item = res.items[0];

      // Identification
      expect(item.productId).toBe(PROD_ID);
      expect(item.sku).toBe("KSEL-CTL-101");
      expect(item.brand.name).toBe("K-Beauty Lab");

      // Financial: 20 * $25 = $500 Net Sales
      expect(item.kpis.financial.b2bNetSales.value).toBe(500.0);
      expect(item.kpis.financial.totalUnitsSold.value).toBe(20);

      // Landed COGS: 20 * $12.50 override = $250.0 (override was effective 2026-08-01 <= order 2026-09-01)
      expect(item.kpis.financial.landedCogs.value).toBe(250.0);
      expect(item.kpis.financial.grossProfit.value).toBe(250.0);
      expect(item.kpis.financial.grossMargin.value).toBe(50.0);

      // Grade readiness evaluation (R3 safety gate)
      expect(item.gradeReadiness.policyGate.automaticGradingEnabled).toBe(false);
      expect(item.gradeReadiness.metrics.completedOrdersCount).toBe(1);
      expect(item.gradeReadiness.metrics.distinctStoresCount).toBe(1);
      // Min orders is 3, min stores is 3 -> NOT_RATED
      expect(item.gradeReadiness.isEligible).toBe(false);
      expect(item.gradeReadiness.evaluationStatus).toBe("NOT_RATED");
    });

    it("sanitizes confidential cost data when isRetailerView is true", async () => {
      const mockClient = createMockSupabase({
        products: [sampleProduct],
        orders: [
          {
            id: "o1",
            order_number: "PO-100",
            company_id: "c1",
            store_id: "s1",
            order_status: "DELIVERED",
            subtotal_amount: 500.0,
            total_amount: 500.0,
            created_at: "2026-09-01T10:00:00Z",
          },
        ],
        orderItems: [
          {
            id: "oi1",
            order_id: "o1",
            product_id: PROD_ID,
            sku: "KSEL-CTL-101",
            quantity: 20,
            unit_wholesale_price: 25.0,
            line_total: 500.0,
          },
        ],
      });

      const res = await queryProductPerformanceList(
        {
          productId: PROD_ID,
          asOfDate: "2026-10-15",
          lookbackDays: 60,
          isRetailerView: true, // Retailer boundary requested
        },
        mockClient
      );

      const item = res.items[0];
      // Retailer sees Net Sales
      expect(item.kpis.financial.b2bNetSales.value).toBe(500.0);
      // But Landed COGS, Gross Profit, Gross Margin are strictly sanitized!
      expect(item.kpis.financial.landedCogs.value).toBe(null);
      expect(item.kpis.financial.landedCogs.status).toBe("UNAVAILABLE");
      expect(item.kpis.financial.landedCogs.missingInputReason).toContain("Restricted access");

      expect(item.kpis.financial.grossProfit.value).toBe(null);
      expect(item.kpis.financial.grossProfit.status).toBe("UNAVAILABLE");

      expect(item.kpis.financial.grossMargin.value).toBe(null);
      expect(item.kpis.financial.grossMargin.status).toBe("UNAVAILABLE");

      // HQ inventory value sanitized
      expect(item.kpis.inventory.hqInventoryValue.value).toBe(null);
      expect(item.kpis.inventory.averageInventoryValue.value).toBe(null);
      expect(item.kpis.inventory.gmroi.value).toBe(null);
    });

    it("derives risk flags accurately for low stock and excess inventory", async () => {
      // Setup product with 10 available units and 2 units/day velocity -> 5 days of supply (< 14 days)
      const mockClient = createMockSupabase({
        products: [sampleProduct],
        balances: [{ product_id: PROD_ID, warehouse_id: "wh1", qty_on_hand: 10, qty_hold: 0, qty_damaged: 0 }],
        costLayers: [
          {
            id: "l1",
            product_id: PROD_ID,
            warehouse_id: "wh1",
            received_date: "2026-08-01",
            original_qty: 10,
            remaining_qty: 10,
            unit_landed_cost: 10,
            status: "ACTIVE",
          },
        ],
        orders: [
          {
            id: "o1",
            order_number: "PO-1",
            company_id: "c1",
            store_id: "s1",
            order_status: "DELIVERED",
            subtotal_amount: 3000,
            total_amount: 3000,
            created_at: "2026-09-01T00:00:00Z",
          },
        ],
        orderItems: [
          {
            id: "oi1",
            order_id: "o1",
            product_id: PROD_ID,
            sku: "KSEL-CTL-101",
            quantity: 120, // 120 units in 60 days = 2.0 units/day
            unit_wholesale_price: 25,
            line_total: 3000,
          },
        ],
      });

      const res = await queryProductPerformanceList(
        { productId: PROD_ID, asOfDate: "2026-10-15", lookbackDays: 60 },
        mockClient
      );

      const item = res.items[0];
      // 10 units / 2.0 units/day = 5.0 days of supply
      expect(item.kpis.inventory.daysOfSupply.value).toBe(5.0);
      expect(item.riskFlags).toContain("LOW_STOCK_RISK");
    });

    it("handles missing historical cost gracefully with UNAVAILABLE status and reason", async () => {
      // Product with no cost records and no valid override
      const productNoCost: RawDbProduct = {
        ...sampleProduct,
        id: "prod_no_cost",
        override_landed_cost: null,
        override_landed_cost_updated_at: null,
      };

      const mockClient = createMockSupabase({
        products: [productNoCost],
        costResults: [],
        costLayers: [],
        orders: [
          {
            id: "o1",
            order_number: "PO-1",
            company_id: "c1",
            store_id: "s1",
            order_status: "DELIVERED",
            subtotal_amount: 100,
            total_amount: 100,
            created_at: "2026-09-01T00:00:00Z",
          },
        ],
        orderItems: [
          {
            id: "oi1",
            order_id: "o1",
            product_id: "prod_no_cost",
            sku: "SKU-NO-COST",
            quantity: 4,
            unit_wholesale_price: 25,
            line_total: 100,
          },
        ],
      });

      const res = await queryProductPerformanceList(
        { productId: "prod_no_cost", asOfDate: "2026-10-15", lookbackDays: 60 },
        mockClient
      );

      const item = res.items[0];
      expect(item.kpis.financial.landedCogs.value).toBe(null);
      expect(item.kpis.financial.landedCogs.status).toBe("UNAVAILABLE");
      expect(item.kpis.financial.landedCogs.missingInputReason).toBeDefined();
      expect(item.kpis.financial.grossProfit.value).toBe(null);
      expect(item.kpis.financial.grossProfit.status).toBe("UNAVAILABLE");
      expect(item.riskFlags).toContain("UNCOSTED_INVENTORY_RISK");
      // Grade eligibility checks historical cost -> NOT_RATED
      expect(item.gradeReadiness.metrics.hasHistoricalCost).toBe(false);
      expect(item.gradeReadiness.isEligible).toBe(false);
    });

    it("evaluates retailer weekly reporting compliance and applies data confidence penalty", async () => {
      // 2 submitted checks out of 8 weeks expected
      const mockClient = createMockSupabase({
        products: [sampleProduct],
        weeklyChecks: [
          {
            id: "chk_1",
            company_id: "c1",
            store_id: "s1",
            reporting_week: "2026-W36",
            report_date: "2026-09-07",
            status: "submitted",
          },
          {
            id: "chk_2",
            company_id: "c1",
            store_id: "s1",
            reporting_week: "2026-W37",
            report_date: "2026-09-14",
            status: "submitted",
          },
        ],
        weeklyCheckItems: [
          { id: "ci_1", check_id: "chk_1", product_id: PROD_ID, reported_remaining_qty: 15, estimated_movement: 5 },
          { id: "ci_2", check_id: "chk_2", product_id: PROD_ID, reported_remaining_qty: 10, estimated_movement: 5 },
        ],
        stores: [{ id: "s1", name: "Store 1", status: "active", company_id: "c1" }],
        storeProducts: [{ store_id: "s1", product_id: PROD_ID, is_active: true }],
      });

      const res = await queryProductPerformanceList(
        { productId: PROD_ID, asOfDate: "2026-10-15", lookbackDays: 60 },
        mockClient
      );

      const item = res.items[0];
      const qual = item.kpis.velocity.reportingQualification.value!;
      expect(qual.actualReportsCount).toBe(2);
      expect(qual.complianceRate).toBeLessThan(0.5);
      expect(item.riskFlags).toContain("LOW_REPORTING_COMPLIANCE");
      // Data confidence on velocity should be penalized
      expect(item.kpis.velocity.estimatedRetailerSellThroughUnits.dataConfidence).toBeLessThan(1.0);
    });

    it("supports pagination and brand filtering correctly across multi-product lists", async () => {
      const prodA: RawDbProduct = { ...sampleProduct, id: "prod_a", name: "Alpha Cream", brand_id: "brand_a" };
      const prodB: RawDbProduct = { ...sampleProduct, id: "prod_b", name: "Beta Serum", brand_id: "brand_b" };
      const prodC: RawDbProduct = { ...sampleProduct, id: "prod_c", name: "Gamma Toner", brand_id: "brand_a" };

      const mockClient = createMockSupabase({
        products: [prodA, prodB, prodC],
      });

      // Filter by brand_a
      const brandFiltered = await queryProductPerformanceList(
        { brandId: "brand_a", asOfDate: "2026-10-15" },
        mockClient
      );

      expect(brandFiltered.items.length).toBe(2);
      expect(brandFiltered.items.map((i) => i.productId)).toEqual(["prod_a", "prod_c"]);

      // Pagination: page 1, pageSize 1
      const paged = await queryProductPerformanceList(
        { page: 1, pageSize: 1, asOfDate: "2026-10-15" },
        mockClient
      );

      expect(paged.items.length).toBe(1);
      expect(paged.page).toBe(1);
      expect(paged.pageSize).toBe(1);
      expect(paged.totalCount).toBe(3);
      expect(paged.totalPages).toBe(3);
    });

    it("retrieves a single product using getProductPerformanceById helper", async () => {
      const mockClient = createMockSupabase({
        products: [sampleProduct],
      });

      const single = await getProductPerformanceById(PROD_ID, { asOfDate: "2026-10-15" }, mockClient);
      expect(single).not.toBeNull();
      expect(single?.productId).toBe(PROD_ID);
      expect(single?.sku).toBe("KSEL-CTL-101");

      const notFound = await getProductPerformanceById("non_existent_id", { asOfDate: "2026-10-15" }, mockClient);
      expect(notFound).toBeNull();
    });
  });
});
