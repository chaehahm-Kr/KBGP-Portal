import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { queryProductPerformanceList } from "@/lib/product/performance/performance-service";
import type {
  RawDbProduct,
  RawDbInventoryBalance,
  RawDbLandedCostResult,
  RawDbInventoryCostLayer,
} from "@/lib/product/performance/types";

function createMockSupabase(mockData: {
  products: RawDbProduct[];
  balances?: RawDbInventoryBalance[];
  costResults?: RawDbLandedCostResult[];
  costLayers?: RawDbInventoryCostLayer[];
  orders?: any[];
  orderItems?: any[];
  weeklyChecks?: any[];
  weeklyCheckItems?: any[];
  claims?: any[];
  claimItems?: any[];
  cohorts?: any[];
  storeProducts?: any[];
  stores?: any[];
  productImages?: any[];
}) {
  const mockQueryBuilder = (table: string) => {
    let currentData: any[] = [];
    switch (table) {
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
      case "retailer_store_products":
        currentData = mockData.storeProducts || [];
        break;
      case "stores":
        currentData = mockData.stores || [];
        break;
      case "product_images":
        currentData = mockData.productImages || [];
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

describe("SKU Performance Pagination & Summary Aggregation (ADM-GRADING-DATA-003-R6)", () => {
  // Generate 38 distinct synthetic products matching the production catalog scale
  const sample38Products: RawDbProduct[] = Array.from({ length: 38 }, (_, i) => {
    const num = String(i + 1).padStart(3, "0");
    return {
      id: `prod_${num}`,
      name: `K-Beauty Product ${num}`,
      name_en: `Product English Title ${num}`,
      letusto_sku: `LETUSTO-${num}`,
      parent_sku: `PARENT-${num}`,
      child_sku: `CHILD-${num}`,
      manufacture_sku: `MFG-${num}`,
      brand_id: i % 2 === 0 ? "brand_alpha" : "brand_beta",
      category: "skincare",
      category_code: "SK_SERUM",
      status: "active",
      created_at: "2026-08-01T00:00:00Z",
      price_usd_fob: 10.0,
      price_krw_wholesale: 12000,
      brands: {
        id: i % 2 === 0 ? "brand_alpha" : "brand_beta",
        name: i % 2 === 0 ? "Alpha Brand" : "Beta Brand",
      },
    };
  });

  // Assign inventory balances: each product has 100 units on hand (total 38 * 100 = 3800 units)
  const balances: RawDbInventoryBalance[] = sample38Products.map((p) => ({
    product_id: p.id,
    warehouse_id: "wh_main",
    qty_on_hand: 100,
    qty_hold: 0,
    qty_damaged: 0,
    updated_at: "2026-10-15T00:00:00Z",
  }));

  it("paginates 38 SKUs with pageSize 25 into Page 1 (25) and Page 2 (13) with no duplicates", async () => {
    const mockClient = createMockSupabase({
      products: sample38Products,
      balances,
    });

    // Page 1 (25 per page)
    const page1 = await queryProductPerformanceList(
      { page: 1, pageSize: 25, asOfDate: "2026-10-15", lookbackDays: 60 },
      mockClient
    );

    expect(page1.totalCount).toBe(38);
    expect(page1.totalPages).toBe(2);
    expect(page1.page).toBe(1);
    expect(page1.pageSize).toBe(25);
    expect(page1.items.length).toBe(25);

    // Page 2 (25 per page)
    const page2 = await queryProductPerformanceList(
      { page: 2, pageSize: 25, asOfDate: "2026-10-15", lookbackDays: 60 },
      mockClient
    );

    expect(page2.totalCount).toBe(38);
    expect(page2.totalPages).toBe(2);
    expect(page2.page).toBe(2);
    expect(page2.pageSize).toBe(25);
    expect(page2.items.length).toBe(13);

    // Verify zero duplicates and zero omitted SKUs across pages
    const page1Ids = new Set(page1.items.map((item) => item.productId));
    const page2Ids = new Set(page2.items.map((item) => item.productId));

    expect(page1Ids.size).toBe(25);
    expect(page2Ids.size).toBe(13);

    for (const id of page2Ids) {
      expect(page1Ids.has(id)).toBe(false); // No overlap
    }

    const allCombined = new Set([...page1Ids, ...page2Ids]);
    expect(allCombined.size).toBe(38); // Full catalog covered
  });

  it("paginates 38 SKUs with pageSize 50 into a single page of 38 products", async () => {
    const mockClient = createMockSupabase({
      products: sample38Products,
      balances,
    });

    const page50 = await queryProductPerformanceList(
      { page: 1, pageSize: 50, asOfDate: "2026-10-15", lookbackDays: 60 },
      mockClient
    );

    expect(page50.totalCount).toBe(38);
    expect(page50.totalPages).toBe(1);
    expect(page50.page).toBe(1);
    expect(page50.pageSize).toBe(50);
    expect(page50.items.length).toBe(38);
  });

  it("preserves identical summary metrics across pages and across different page sizes", async () => {
    const mockClient = createMockSupabase({
      products: sample38Products,
      balances,
    });

    const [p1_25, p2_25, p1_50] = await Promise.all([
      queryProductPerformanceList({ page: 1, pageSize: 25, asOfDate: "2026-10-15" }, mockClient),
      queryProductPerformanceList({ page: 2, pageSize: 25, asOfDate: "2026-10-15" }, mockClient),
      queryProductPerformanceList({ page: 1, pageSize: 50, asOfDate: "2026-10-15" }, mockClient),
    ]);

    // Total available units must represent the complete 38-SKU dataset (38 * 100 = 3800) in all views
    expect(p1_25.kpiSummary?.totalAvailableUnits).toBe(3800);
    expect(p2_25.kpiSummary?.totalAvailableUnits).toBe(3800);
    expect(p1_50.kpiSummary?.totalAvailableUnits).toBe(3800);

    // Summary metrics must match identically
    expect(p1_25.kpiSummary).toEqual(p2_25.kpiSummary);
    expect(p1_25.kpiSummary).toEqual(p1_50.kpiSummary);
  });

  it("filters readiness across the complete dataset before pagination", async () => {
    // Give 30 products no cost (Tier 4 Unavailable) and 8 products an override cost (Tier 3)
    const mixedProducts = sample38Products.map((p, idx) => {
      if (idx < 8) {
        return {
          ...p,
          override_landed_cost: 5.5,
          override_landed_cost_updated_at: "2026-10-01T00:00:00Z",
        };
      }
      return p;
    });

    const mockClient = createMockSupabase({
      products: mixedProducts,
      balances,
    });

    // Query with readinessFilter: COST_MISSING (30 products should match)
    const costMissingPage1 = await queryProductPerformanceList(
      { page: 1, pageSize: 25, readinessFilter: "COST_MISSING", asOfDate: "2026-10-15" },
      mockClient
    );

    expect(costMissingPage1.totalCount).toBe(30);
    expect(costMissingPage1.totalPages).toBe(2);
    expect(costMissingPage1.items.length).toBe(25);
    expect(costMissingPage1.kpiSummary?.totalAvailableUnits).toBe(3000); // 30 * 100

    const costMissingPage2 = await queryProductPerformanceList(
      { page: 2, pageSize: 25, readinessFilter: "COST_MISSING", asOfDate: "2026-10-15" },
      mockClient
    );

    expect(costMissingPage2.totalCount).toBe(30);
    expect(costMissingPage2.totalPages).toBe(2);
    expect(costMissingPage2.items.length).toBe(5);
    expect(costMissingPage2.kpiSummary?.totalAvailableUnits).toBe(3000);
  });

  it("handles empty results and clamps invalid page numbers cleanly", async () => {
    const mockClient = createMockSupabase({
      products: sample38Products,
      balances,
    });

    // Page number < 1 is clamped to 1
    const clampedLow = await queryProductPerformanceList(
      { page: -5, pageSize: 25, asOfDate: "2026-10-15" },
      mockClient
    );
    expect(clampedLow.page).toBe(1);
    expect(clampedLow.items.length).toBe(25);

    // Page number > totalPages is clamped to totalPages (2)
    const clampedHigh = await queryProductPerformanceList(
      { page: 999, pageSize: 25, asOfDate: "2026-10-15" },
      mockClient
    );
    expect(clampedHigh.page).toBe(2);
    expect(clampedHigh.items.length).toBe(13);

    // Empty dataset
    const emptyClient = createMockSupabase({ products: [] });
    const emptyResult = await queryProductPerformanceList(
      { page: 1, pageSize: 25, asOfDate: "2026-10-15" },
      emptyClient
    );
    expect(emptyResult.totalCount).toBe(0);
    expect(emptyResult.totalPages).toBe(0);
    expect(emptyResult.page).toBe(1);
    expect(emptyResult.items.length).toBe(0);
    expect(emptyResult.kpiSummary?.totalAvailableUnits).toBe(0);
    expect(emptyResult.kpiSummary?.totalB2bNetSales).toBe(0);
  });
});
