import { describe, it, expect } from "vitest";
import {
  evaluateSkuDataReadiness,
  matchesReadinessFilter,
  type SkuDataReadiness,
} from "@/lib/product/performance/sku-readiness";

describe("Product Performance — SKU Data Readiness Engine (ADM-GRADING-DATA-003-R3)", () => {
  const asOfDate = "2026-10-18";

  it("Rule 1 & 2: Correctly anchors operating age on first fulfilled B2B shipment and treats missing shipment as START_DATE_UNVERIFIED (operating age null, no created_at default)", () => {
    // Unverified start date product: 0 shipments, 0 orders
    const unverified = evaluateSkuDataReadiness({
      productId: "prod-unverified",
      firstShipmentDateOnProduct: null,
      earliestFulfilledShipmentDate: null,
      onHandUnits: 0,
      completedOrdersCount: 0,
      distinctStoresCount: 0,
      weeklyChecksCount: 0,
      asOfDate,
    });

    expect(unverified.operatingStatus).toBe("START_DATE_UNVERIFIED");
    expect(unverified.operatingAgeDays).toBeNull();
    expect(unverified.firstShipmentDate).toBeNull();
    expect(unverified.isOperatingAnchorVerified).toBe(false);
    expect(unverified.reasonCodes).toContain("ERR_START_DATE_UNVERIFIED");
    expect(unverified.anchorNote).toContain("Operating age cannot be calculated (N/A)");
    expect(unverified.gateLabel).toBe("START_DATE_UNVERIFIED (N/A)");
    expect(unverified.readinessGate).toBe("START_DATE_UNVERIFIED");

    // Fulfilled product: 16 days active
    const activeNew = evaluateSkuDataReadiness({
      productId: "prod-active-new",
      firstShipmentDateOnProduct: null,
      earliestFulfilledShipmentDate: "2026-10-02",
      onHandUnits: 100,
      completedOrdersCount: 1,
      distinctStoresCount: 1,
      weeklyChecksCount: 1,
      asOfDate,
    });

    expect(activeNew.operatingStatus).toBe("NEW");
    expect(activeNew.operatingAgeDays).toBe(16);
    expect(activeNew.firstShipmentDate).toBe("2026-10-02");
    expect(activeNew.isOperatingAnchorVerified).toBe(true);
    expect(activeNew.readinessGate).toBe("NEW_INCUBATION");
    expect(activeNew.gateLabel).toBe("NEW (16d)");
  });

  it("Rule 3: Correctly distinguishes Tier 1 Verified Landed Cost from Tier 2 Current Layer, Tier 3 Override, and Tier 4 Unavailable", () => {
    // Tier 1: Verified Historical Landed Cost
    const tier1 = evaluateSkuDataReadiness({
      productId: "prod-t1",
      costRecords: [
        {
          product_id: "prod-t1",
          effective_date: "2026-09-01",
          unit_landed_cost: 27.0,
          cost_status: "FINAL",
          source: "landed_cost_results",
        },
      ],
      asOfDate,
    });
    expect(tier1.costProvenanceTier).toBe("TIER_1_VERIFIED");
    expect(tier1.isHistoricalCostVerified).toBe(true);
    expect(tier1.isCostOverride).toBe(false);
    expect(tier1.unitLandedCost).toBe(27.0);

    // Tier 2: Current Inventory Layer Cost (Holding cost only; NOT historical transaction cost)
    const tier2 = evaluateSkuDataReadiness({
      productId: "prod-t2",
      activeLayers: [
        {
          id: "layer-001",
          product_id: "prod-t2",
          warehouse_id: "wh-1",
          received_date: "2026-10-01",
          unit_landed_cost: 18.5,
          original_qty: 100,
          remaining_qty: 100,
          status: "ACTIVE",
        },
      ],
      asOfDate,
    });
    expect(tier2.costProvenanceTier).toBe("TIER_2_LAYER");
    expect(tier2.isHistoricalCostVerified).toBe(false);
    expect(tier2.unitLandedCost).toBe(18.5);
    expect(tier2.costProvenanceLabel).toContain("Current Inventory Layer Cost");
    expect(tier2.reasonCodes).toContain("ERR_HISTORICAL_COST_UNLINKED");

    // Tier 3: Static Override
    const tier3 = evaluateSkuDataReadiness({
      productId: "prod-t3",
      overrideLandedCost: 5.25,
      asOfDate,
    });
    expect(tier3.costProvenanceTier).toBe("TIER_3_OVERRIDE");
    expect(tier3.isHistoricalCostVerified).toBe(false);
    expect(tier3.isCostOverride).toBe(true);
    expect(tier3.unitLandedCost).toBe(5.25);
    expect(tier3.reasonCodes).toContain("ERR_COST_OVERRIDE_UNBOUND");

    // Tier 4: Missing Cost
    const tier4 = evaluateSkuDataReadiness({
      productId: "prod-t4",
      asOfDate,
    });
    expect(tier4.costProvenanceTier).toBe("TIER_4_UNAVAILABLE");
    expect(tier4.isHistoricalCostVerified).toBe(false);
    expect(tier4.unitLandedCost).toBeNull();
    expect(tier4.reasonCodes).toContain("ERR_COST_MISSING");
  });

  it("Rule 4: Enforces Non-Negotiable Zero-Valuation Safeguard (Stock with missing cost is NEVER evaluated at $0.00)", () => {
    const uncostedStock = evaluateSkuDataReadiness({
      productId: "prod-dr120",
      onHandUnits: 200, // 200 units on hand, but no cost
      asOfDate,
    });

    expect(uncostedStock.inventoryUnitsOnHand).toBe(200);
    expect(uncostedStock.isInventoryValuationPending).toBe(true);
    expect(uncostedStock.inventoryValuationUsd).toBeNull();
    expect(uncostedStock.inventoryValuationDisplay).toBe("PENDING COST VERIFICATION (N/A)");

    // True zero units stock evaluates safely to $0.00
    const zeroStock = evaluateSkuDataReadiness({
      productId: "prod-empty",
      onHandUnits: 0,
      asOfDate,
    });
    expect(zeroStock.isInventoryValuationPending).toBe(false);
    expect(zeroStock.inventoryValuationUsd).toBe(0);
    expect(zeroStock.inventoryValuationDisplay).toBe("$0.00 (Zero Stock)");
  });

  it("Rule 5 & 6: Velocity is labeled as estimated (Not POS data) and exchange risk is UNOBSERVED before Day 100", () => {
    const readiness = evaluateSkuDataReadiness({
      productId: "prod-sample",
      weeklyChecksCount: 2,
      maturedCohortDays: 45, // Day 45: inside 90-day protection window
      asOfDate,
    });

    expect(readiness.isVelocityEstimated).toBe(true);
    expect(readiness.velocityLabel).toContain("Not POS Data");
    expect(readiness.isExchangeRiskObserved).toBe(false);
    expect(readiness.exchangeRiskStatusDisplay).toContain("UNOBSERVED");
    expect(readiness.reasonCodes).toContain("ERR_COHORT_PRE_MATURE");
  });

  it("Wholesale B2B Eligibility Gates: requires >= 3 orders and >= 3 distinct stores", () => {
    const insufficient = evaluateSkuDataReadiness({
      productId: "prod-insufficient",
      completedOrdersCount: 2,
      distinctStoresCount: 1,
      asOfDate,
    });

    expect(insufficient.isOrdersThresholdMet).toBe(false);
    expect(insufficient.isStoresThresholdMet).toBe(false);
    expect(insufficient.reasonCodes).toContain("ERR_INSUFFICIENT_ORDERS");
    expect(insufficient.reasonCodes).toContain("ERR_INSUFFICIENT_STORES");

    // Action plan includes specific deficit counts
    const orderAction = insufficient.remediationActions.find((a) =>
      a.action.includes("additional completed B2B purchase orders")
    );
    expect(orderAction).toBeDefined();
    expect(orderAction?.action).toContain("1 additional");

    const storeAction = insufficient.remediationActions.find((a) =>
      a.action.includes("additional distinct stores")
    );
    expect(storeAction).toBeDefined();
    expect(storeAction?.action).toContain("2 additional");
  });

  it("Data Coverage and Confidence calculations reflect quantitative completeness", () => {
    // Completely empty unverified SKU
    const empty = evaluateSkuDataReadiness({
      productId: "prod-empty",
      onHandUnits: 0, // zero units is known
      asOfDate,
    });
    // Anchor 0% + Cost 0% + Inventory 20% (known zero) + Orders 0% + Stores 0% + Checks 0% = 20%
    expect(empty.dataCoveragePercent).toBe(20);

    // Fully satisfied mature SKU
    const complete = evaluateSkuDataReadiness({
      productId: "prod-complete",
      firstShipmentDateOnProduct: "2026-06-01",
      costRecords: [
        {
          product_id: "prod-complete",
          effective_date: "2026-05-01",
          unit_landed_cost: 15.0,
          cost_status: "FINAL",
          source: "landed_cost_results",
        },
      ],
      onHandUnits: 50,
      completedOrdersCount: 5,
      distinctStoresCount: 4,
      weeklyChecksCount: 6,
      maturedCohortDays: 120,
      asOfDate,
    });
    expect(complete.dataCoveragePercent).toBe(100);
    expect(complete.operatingStatus).toBe("MATURE");
    expect(complete.readinessGate).toBe("READY_GRADING");
    expect(complete.reasonCodes).toEqual([]);
  });

  it("matchesReadinessFilter correctly filters SKUs by data gap type and START_DATE_UNVERIFIED", () => {
    const unverified = evaluateSkuDataReadiness({
      productId: "prod-1",
      asOfDate,
    });
    expect(matchesReadinessFilter(unverified, "ALL")).toBe(true);
    expect(matchesReadinessFilter(unverified, "START_DATE_UNVERIFIED")).toBe(true);
    expect(matchesReadinessFilter(unverified, "UNCOMMENCED")).toBe(true);
    expect(matchesReadinessFilter(unverified, "COST_MISSING")).toBe(true);
    expect(matchesReadinessFilter(unverified, "NEW_INCUBATION")).toBe(false);

    const newIncubator = evaluateSkuDataReadiness({
      productId: "prod-2",
      earliestFulfilledShipmentDate: "2026-10-01",
      overrideLandedCost: 10.0,
      onHandUnits: 20,
      asOfDate,
    });
    expect(matchesReadinessFilter(newIncubator, "NEW_INCUBATION")).toBe(true);
    expect(matchesReadinessFilter(newIncubator, "COST_OVERRIDE")).toBe(true);
    expect(matchesReadinessFilter(newIncubator, "COST_MISSING")).toBe(false);
  });
});
