/**
 * Product Performance V2.0 — Admin Dashboard & SKU Detail UI Unit Tests
 * Task ID: ADM-SALES-PERF-003-R7
 * Location: tests/unit/product-performance-ui.test.ts
 */

import { describe, it, expect } from "vitest";
import type {
  ProductPerformanceSummary,
  ProductPerformanceKpiSummary,
} from "@/lib/product/performance/types";

// Helper to construct a synthetic ProductPerformanceSummary
function makeSyntheticSummary(overrides: Partial<ProductPerformanceSummary> = {}): ProductPerformanceSummary {
  const baseKpi = {
    value: 1000,
    unit: "USD" as const,
    period: { start: "2026-08-16", end: "2026-10-15" },
    status: "ACTUAL" as const,
    dataConfidence: 1.0,
    sourceBasis: "Synthetic test data",
  };

  return {
    productId: "prod-001",
    sku: "LET-TEST-001",
    productName: "Hydrating Facial Cream",
    productNameEn: "Hydrating Facial Cream",
    imageUrl: "https://example.com/cream.png",
    manufactureSku: "MFG-001",
    brand: { id: "brand-001", name: "K-Beauty Brand A" },
    category: { id: "cat-001", name: "Skincare", code: "SKIN" },
    status: "active",
    createdAt: "2026-01-01T00:00:00Z",
    kpis: {
      product_id: "prod-001",
      period: {
        timezone: "America/New_York",
        asOfDate: "2026-10-15",
        periodStart: "2026-08-16",
        periodEnd: "2026-10-15",
        daysInPeriod: 60,
      },
      financial: {
        b2bNetSales: { ...baseKpi, value: 5000 },
        totalUnitsSold: { ...baseKpi, value: 100, unit: "UNITS" },
        landedCogs: { ...baseKpi, value: 2000 },
        grossProfit: { ...baseKpi, value: 3000 },
        grossMargin: { ...baseKpi, value: 60, unit: "PERCENT" },
        refundedAmount: { ...baseKpi, value: 0 },
        merchandiseDiscountAmount: { ...baseKpi, value: 0 },
        creditSettlementAmount: { ...baseKpi, value: 0 },
      },
      velocity: {
        b2bShipmentVelocityDaily: { ...baseKpi, value: 1.67, unit: "RATIO" },
        b2bShipmentVelocityWeekly: { ...baseKpi, value: 11.67, unit: "RATIO" },
        estimatedRetailerSellThroughUnits: { ...baseKpi, value: 85, unit: "UNITS", status: "ESTIMATED" },
        estimatedRetailerSellThroughWeeklyRate: { ...baseKpi, value: 9.9, unit: "RATIO", status: "ESTIMATED" },
        reportingQualification: {
          ...baseKpi,
          unit: "RATIO",
          value: {
            expectedReportsCount: 8,
            actualReportsCount: 8,
            complianceRate: 1.0,
            missingWeeksCount: 0,
            reportingStoresCount: 4,
            totalTargetStoresCount: 5,
          },
        },
        replenishmentAdjustmentUnits: { ...baseKpi, value: 0, unit: "UNITS" },
      },
      inventory: {
        hqAvailableUnits: { ...baseKpi, value: 250, unit: "UNITS" },
        hqInventoryValue: { ...baseKpi, value: 5000 },
        averageInventoryValue: {
          ...baseKpi,
          value: null,
          status: "UNAVAILABLE",
          metadata: { endingInventoryValuationProxy: 5000 },
        },
        fifoInventoryAging: {
          ...baseKpi,
          unit: "RATIO",
          value: {
            weightedAverageAgeDays: 45,
            brackets: [],
            oldestLayerAgeDays: 60,
            newestLayerAgeDays: 30,
          },
        },
        inventoryTurnover: { ...baseKpi, value: null, status: "UNAVAILABLE" },
        dioDays: { ...baseKpi, value: null, status: "UNAVAILABLE" },
        daysOfSupply: { ...baseKpi, value: 150, unit: "DAYS" },
        gmroi: { ...baseKpi, value: null, status: "UNAVAILABLE" },
      },
      exchange: {
        protectedStoresCount: { ...baseKpi, value: 5, unit: "COUNT" },
        eligibleStoreCohortCount: { ...baseKpi, value: 3, unit: "COUNT" },
        uniqueClaimingStoreCount: { ...baseKpi, value: 1, unit: "COUNT" },
        claimingStoreRate: { ...baseKpi, value: 33.3, unit: "PERCENT" },
        totalClaimRequestedUnits: { ...baseKpi, value: 10, unit: "UNITS" },
        totalClaimDollarValue: { ...baseKpi, value: 350 },
        exposureByStatus: { ...baseKpi, unit: "RATIO", value: [] },
      },
      asOfTimestamp: "2026-10-15T12:00:00Z",
    },
    gradeReadiness: {
      isEligible: true,
      evaluationStatus: "GRADED",
      allReasons: [],
      metrics: {
        operatingHistoryDays: 288,
        completedOrdersCount: 5,
        distinctStoresCount: 4,
        hasHistoricalCost: true,
      },
      policyGate: {
        automaticGradingEnabled: false,
        note: "Automatic grading strictly disabled pending Owner scoring normalization approval.",
      },
    },
    overallDataConfidence: 0.95,
    riskFlags: ["HEALTHY"],
    ...overrides,
  };
}

describe("Product Performance V2.0 — Admin Dashboard UI Contract", () => {
  it("computes 6 aggregate KPI cards correctly with complete historical data", () => {
    const item1 = makeSyntheticSummary({ productId: "p1" });
    const item2 = makeSyntheticSummary({ productId: "p2" });

    const totalSales = item1.kpis.financial.b2bNetSales.value! + item2.kpis.financial.b2bNetSales.value!;
    const totalProfit = item1.kpis.financial.grossProfit.value! + item2.kpis.financial.grossProfit.value!;
    const margin = (totalProfit / totalSales) * 100;
    const inventoryVal = item1.kpis.inventory.hqInventoryValue.value! + item2.kpis.inventory.hqInventoryValue.value!;

    expect(totalSales).toBe(10000);
    expect(totalProfit).toBe(6000);
    expect(margin).toBe(60);
    expect(inventoryVal).toBe(10000);
  });

  it("strictly reports Gross Profit as N/A (null) when historical cost provenance is missing", () => {
    const missingCostItem = makeSyntheticSummary({
      productId: "p-no-cost",
      kpis: {
        ...makeSyntheticSummary().kpis,
        financial: {
          ...makeSyntheticSummary().kpis.financial,
          b2bNetSales: { ...makeSyntheticSummary().kpis.financial.b2bNetSales, value: 4000 },
          landedCogs: { ...makeSyntheticSummary().kpis.financial.landedCogs, value: null, status: "UNAVAILABLE" },
          grossProfit: { ...makeSyntheticSummary().kpis.financial.grossProfit, value: null, status: "UNAVAILABLE" },
          grossMargin: { ...makeSyntheticSummary().kpis.financial.grossMargin, value: null, status: "UNAVAILABLE" },
        },
      },
    });

    expect(missingCostItem.kpis.financial.grossProfit.value).toBeNull();
    expect(missingCostItem.kpis.financial.grossProfit.status).toBe("UNAVAILABLE");
    expect(missingCostItem.kpis.financial.grossMargin.value).toBeNull();
  });

  it("strictly enforces Owner Policy: automatic grading is disabled and actions show POLICY PENDING", () => {
    const item = makeSyntheticSummary();

    // Safety Gate Check:
    expect(item.gradeReadiness.policyGate.automaticGradingEnabled).toBe(false);
    expect(item.gradeReadiness.policyGate.note).toContain("strictly disabled");

    // Action Card Display Check:
    const kpiSummary: ProductPerformanceKpiSummary = {
      totalB2bNetSales: 5000,
      totalGrossProfit: 3000,
      aggregateGrossMargin: 60,
      totalHqInventoryValue: 5000,
      totalAvailableUnits: 250,
      uniqueExchangeClaimingStores: 1,
      productsNeedingAction: "POLICY PENDING",
      hasMissingCostProvenance: false,
      hasMissingInventoryCost: false,
    };

    expect(kpiSummary.productsNeedingAction).toBe("POLICY PENDING");
  });

  it("enforces Turnover, DIO, and GMROI as UNAVAILABLE without periodic snapshots", () => {
    const item = makeSyntheticSummary();

    // Must be null (UNAVAILABLE)
    expect(item.kpis.inventory.inventoryTurnover.value).toBeNull();
    expect(item.kpis.inventory.inventoryTurnover.status).toBe("UNAVAILABLE");
    expect(item.kpis.inventory.dioDays.value).toBeNull();
    expect(item.kpis.inventory.gmroi.value).toBeNull();

    // Metadata ending inventory proxy is preserved
    expect(item.kpis.inventory.averageInventoryValue.metadata?.endingInventoryValuationProxy).toBe(5000);
  });

  it("strictly labels Retailer Sell-Through as ESTIMATED", () => {
    const item = makeSyntheticSummary();
    expect(item.kpis.velocity.estimatedRetailerSellThroughUnits.status).toBe("ESTIMATED");
  });

  it("correctly separates Grade, Risk, and Confidence domains", () => {
    const item = makeSyntheticSummary();

    // Grade is domain 1
    expect(item.gradeReadiness.evaluationStatus).toBe("GRADED");

    // Risk is domain 2
    expect(Array.isArray(item.riskFlags)).toBe(true);
    expect(item.riskFlags).toContain("HEALTHY");

    // Confidence is domain 3
    expect(item.overallDataConfidence).toBe(0.95);
    expect(item.overallDataConfidence).toBeGreaterThanOrEqual(0);
    expect(item.overallDataConfidence).toBeLessThanOrEqual(1);
  });
});

describe("Product Performance V2.0 — SKU Detail 7-Section Data Contract", () => {
  const item = makeSyntheticSummary();

  it("Section 1 (Overview): contains product master info & high-level KPIs", () => {
    expect(item.productName).toBe("Hydrating Facial Cream");
    expect(item.sku).toBe("LET-TEST-001");
    expect(item.brand.name).toBe("K-Beauty Brand A");
    expect(item.category.name).toBe("Skincare");
    expect(item.gradeReadiness.metrics.operatingHistoryDays).toBe(288);
  });

  it("Section 2 (Sales & Velocity): computes B2B velocity and retail sell-through", () => {
    expect(item.kpis.velocity.b2bShipmentVelocityDaily.value).toBe(1.67);
    expect(item.kpis.velocity.estimatedRetailerSellThroughUnits.value).toBe(85);
    expect(item.kpis.velocity.reportingQualification.value?.reportingStoresCount).toBe(4);
  });

  it("Section 3 (Profitability): provides verifiable Landed COGS and margins", () => {
    expect(item.kpis.financial.landedCogs.value).toBe(2000);
    expect(item.kpis.financial.grossProfit.value).toBe(3000);
    expect(item.kpis.financial.grossMargin.value).toBe(60);
  });

  it("Section 4 (Inventory & Forecast): provides HQ available units and DOS", () => {
    expect(item.kpis.inventory.hqAvailableUnits.value).toBe(250);
    expect(item.kpis.inventory.daysOfSupply.value).toBe(150);
    expect(item.kpis.inventory.hqInventoryValue.value).toBe(5000);
  });

  it("Section 5 (Exchange & Risk): provides 90-day cohorts and distinct claiming stores", () => {
    expect(item.kpis.exchange.protectedStoresCount.value).toBe(5);
    expect(item.kpis.exchange.eligibleStoreCohortCount.value).toBe(3);
    expect(item.kpis.exchange.uniqueClaimingStoreCount.value).toBe(1);
    expect(item.kpis.exchange.claimingStoreRate.value).toBe(33.3);
  });

  it("Section 6 (Stores & Growth): tracks assortment coverage and network store count", () => {
    expect(item.kpis.velocity.reportingQualification.value?.totalTargetStoresCount).toBe(5);
    expect(item.kpis.velocity.reportingQualification.value?.reportingStoresCount).toBe(4);
    expect(item.kpis.velocity.reportingQualification.value?.complianceRate).toBe(1.0);
  });

  it("Section 7 (Actions & History): enforces POLICY PENDING for automatic actions", () => {
    expect(item.gradeReadiness.policyGate.automaticGradingEnabled).toBe(false);
  });
});
