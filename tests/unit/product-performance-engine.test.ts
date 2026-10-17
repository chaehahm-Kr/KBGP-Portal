/**
 * Product Performance V2.0 — Unit & Boundary Test Suite
 * Task ID: ADM-SALES-PERF-003-R1
 * Location: tests/unit/product-performance-engine.test.ts
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));
import {
  calculateFinancialKpis,
  calculateInventoryKpis,
  calculateVelocityKpis,
  calculateExchangeFrequencyKpis,
  calculateProductPerformanceKpis,
  resolveEvaluationPeriod,
  daysBetween,
  safeDiv,
  safeRound,
  isWithinPeriod,
} from "../../lib/product/performance";

import type {
  EvaluationPeriod,
  FinancialOrderLine,
  LandedCostRecord,
  ProductCostMaster,
  FifoInventoryLayer,
  HqInventorySnapshot,
  RetailerWeeklyReportLine,
  ExchangeClaimRecord,
  StoreCohortEligibilityRecord,
} from "../../lib/product/performance";

describe("Product Performance V2.0 — Calculation Engine", () => {
  const mockPeriod: EvaluationPeriod = {
    timezone: "America/New_York",
    asOfDate: "2026-10-15",
    periodStart: "2026-08-16",
    periodEnd: "2026-10-15",
    daysInPeriod: 60,
  };

  const PROD_ID = "prod_serum_001";
  const SKU = "KSEL-SRM-100";

  // =========================================================================
  // 1. FINANCIAL ENGINE
  // =========================================================================
  describe("1. Financial Engine", () => {
    it("calculates normal completed shipments with Net Sales, Landed COGS, Gross Profit, and Gross Margin", () => {
      const orderLines: FinancialOrderLine[] = [
        {
          id: "line_1",
          order_id: "ord_1",
          product_id: PROD_ID,
          sku: SKU,
          order_date: "2026-09-01",
          order_status: "DELIVERED",
          ordered_qty: 100,
          shipped_qty: 100,
          unit_price: 25.0, // Wholesale price $25
          merchandise_discount: 100.0, // $100 promo discount
          shipping_fee_allocated: 45.0, // Outbound freight (must NOT be in merchandise sales)
          tax_allocated: 20.0,
        },
      ];

      const costRecords: LandedCostRecord[] = [
        {
          product_id: PROD_ID,
          effective_date: "2026-08-01",
          unit_landed_cost: 10.0, // $10 Landed COGS
          cost_status: "FINAL",
          source: "landed_cost_results",
        },
      ];

      const res = calculateFinancialKpis({
        period: mockPeriod,
        product_id: PROD_ID,
        orderLines,
        costRecords,
      });

      // Gross = 100 * $25 = $2,500. Net Sales = $2,500 - $100 discount = $2,400.
      expect(res.b2bNetSales.value).toBe(2400.0);
      expect(res.b2bNetSales.status).toBe("ACTUAL");
      expect(res.totalUnitsSold.value).toBe(100);

      // COGS = 100 units * $10 = $1,000
      expect(res.landedCogs.value).toBe(1000.0);
      expect(res.landedCogs.status).toBe("ACTUAL");

      // Gross Profit = $2,400 - $1,000 = $1,400
      expect(res.grossProfit.value).toBe(1400.0);
      expect(res.grossProfit.status).toBe("ACTUAL");

      // Gross Margin = ($1,400 / $2,400) * 100 = 58.33%
      expect(res.grossMargin.value).toBe(58.33);
      expect(res.grossMargin.status).toBe("ACTUAL");
    });

    it("handles partial shipments where shipped_qty < ordered_qty", () => {
      const orderLines: FinancialOrderLine[] = [
        {
          id: "line_part",
          order_id: "ord_part",
          product_id: PROD_ID,
          sku: SKU,
          order_date: "2026-09-10",
          order_status: "SHIPPED",
          ordered_qty: 50,
          shipped_qty: 30, // Only 30 units fulfilled
          unit_price: 20.0,
        },
      ];

      const costRecords: LandedCostRecord[] = [
        {
          product_id: PROD_ID,
          effective_date: "2026-08-01",
          unit_landed_cost: 8.0,
          cost_status: "FINAL",
          source: "landed_cost_results",
        },
      ];

      const res = calculateFinancialKpis({
        period: mockPeriod,
        product_id: PROD_ID,
        orderLines,
        costRecords,
      });

      // Recognized on shipped 30 units = 30 * $20 = $600
      expect(res.b2bNetSales.value).toBe(600.0);
      expect(res.totalUnitsSold.value).toBe(30);
      // COGS = 30 * $8 = $240
      expect(res.landedCogs.value).toBe(240.0);
      // Profit = $600 - $240 = $360
      expect(res.grossProfit.value).toBe(360.0);
      // Margin = 360 / 600 = 60.0%
      expect(res.grossMargin.value).toBe(60.0);
    });

    it("ignores cancelled orders completely (0 sales, 0 COGS)", () => {
      const orderLines: FinancialOrderLine[] = [
        {
          id: "line_canc",
          order_id: "ord_canc",
          product_id: PROD_ID,
          sku: SKU,
          order_date: "2026-09-05",
          order_status: "CANCELLED",
          ordered_qty: 200,
          shipped_qty: 0,
          unit_price: 30.0,
        },
      ];

      const res = calculateFinancialKpis({
        period: mockPeriod,
        product_id: PROD_ID,
        orderLines,
        costRecords: [{ product_id: PROD_ID, effective_date: "2026-08-01", unit_landed_cost: 12.0, cost_status: "FINAL", source: "landed_cost_results" }],
      });

      expect(res.b2bNetSales.value).toBe(0);
      expect(res.totalUnitsSold.value).toBe(0);
      expect(res.landedCogs.value).toBe(0);
      expect(res.grossProfit.value).toBe(0);
      expect(res.grossMargin.value).toBe(null);
      expect(res.grossMargin.status).toBe("UNAVAILABLE");
    });

    it("deducts merchandise refunds from Net Sales and reverses units", () => {
      const orderLines: FinancialOrderLine[] = [
        {
          id: "line_ref",
          order_id: "ord_ref",
          product_id: PROD_ID,
          sku: SKU,
          order_date: "2026-09-12",
          order_status: "DELIVERED",
          ordered_qty: 50,
          shipped_qty: 50,
          unit_price: 20.0,
          refunded_qty: 10,
          refunded_amount: 200.0, // 10 units refunded
        },
      ];

      const res = calculateFinancialKpis({
        period: mockPeriod,
        product_id: PROD_ID,
        orderLines,
        costRecords: [{ product_id: PROD_ID, effective_date: "2026-08-01", unit_landed_cost: 10.0, cost_status: "FINAL", source: "landed_cost_results" }],
      });

      // Gross = 50 * 20 = $1,000. Net Sales = $1,000 - $200 refund = $800
      expect(res.b2bNetSales.value).toBe(800.0);
      expect(res.refundedAmount.value).toBe(200.0);
      expect(res.totalUnitsSold.value).toBe(40); // 50 - 10 refunded
      // COGS on 40 net units = 40 * $10 = $400
      expect(res.landedCogs.value).toBe(400.0);
      expect(res.grossProfit.value).toBe(400.0);
      expect(res.grossMargin.value).toBe(50.0);
    });

    it("treats Exchange Credit redemption as settlement Tender, NOT merchandise discount", () => {
      const orderLines: FinancialOrderLine[] = [
        {
          id: "line_credit",
          order_id: "ord_credit",
          product_id: PROD_ID,
          sku: SKU,
          order_date: "2026-09-15",
          order_status: "PAID",
          ordered_qty: 10,
          shipped_qty: 10,
          unit_price: 50.0, // $500 merchandise
          credit_redeemed_allocated: 150.0, // $150 paid via Exchange Credit, $350 cash
        },
      ];

      const res = calculateFinancialKpis({
        period: mockPeriod,
        product_id: PROD_ID,
        orderLines,
        costRecords: [{ product_id: PROD_ID, effective_date: "2026-08-01", unit_landed_cost: 20.0, cost_status: "FINAL", source: "landed_cost_results" }],
      });

      // Merchandise Net Sales must be $500, NOT reduced by $150 credit settlement!
      expect(res.b2bNetSales.value).toBe(500.0);
      expect(res.creditSettlementAmount.value).toBe(150.0);
      expect(res.landedCogs.value).toBe(200.0); // 10 * $20
      expect(res.grossProfit.value).toBe(300.0);
    });

    it("returns status UNAVAILABLE with reason when Landed Cost is missing", () => {
      const orderLines: FinancialOrderLine[] = [
        {
          id: "line_nocost",
          order_id: "ord_nocost",
          product_id: PROD_ID,
          sku: SKU,
          order_date: "2026-09-20",
          order_status: "DELIVERED",
          ordered_qty: 25,
          shipped_qty: 25,
          unit_price: 40.0,
        },
      ];

      const res = calculateFinancialKpis({
        period: mockPeriod,
        product_id: PROD_ID,
        orderLines,
        costRecords: [], // No cost records
      });

      expect(res.b2bNetSales.value).toBe(1000.0);
      expect(res.landedCogs.value).toBe(null);
      expect(res.landedCogs.status).toBe("UNAVAILABLE");
      expect(res.landedCogs.missingInputReason).toContain("No active landed cost or override cost found");
      expect(res.grossProfit.value).toBe(null);
      expect(res.grossProfit.status).toBe("UNAVAILABLE");
      expect(res.grossMargin.value).toBe(null);
      expect(res.grossMargin.status).toBe("UNAVAILABLE");
    });

    it("applies product override landed cost when explicitly configured with valid effective date on product master", () => {
      const orderLines: FinancialOrderLine[] = [
        {
          id: "line_override",
          order_id: "ord_override",
          product_id: PROD_ID,
          sku: SKU,
          order_date: "2026-09-22",
          order_status: "DELIVERED",
          ordered_qty: 10,
          shipped_qty: 10,
          unit_price: 30.0,
        },
      ];

      const costRecords: LandedCostRecord[] = [
        { product_id: PROD_ID, effective_date: "2026-08-01", unit_landed_cost: 15.0, cost_status: "FINAL", source: "landed_cost_results" },
      ];

      const costMaster: ProductCostMaster = {
        product_id: PROD_ID,
        sku: SKU,
        override_landed_cost: 11.5, // Explicit override
        override_effective_date: "2026-08-01", // Proven effective on or before order_date
        override_reason: "Owner bulk negotiated landed rate",
      };

      const res = calculateFinancialKpis({
        period: mockPeriod,
        product_id: PROD_ID,
        orderLines,
        costRecords,
        costMaster,
      });

      // COGS = 10 * $11.50 = $115 (override used rather than $15 layer because effective_date <= order_date)
      expect(res.landedCogs.value).toBe(115.0);
      expect(res.landedCogs.sourceBasis).toContain("Computed using product override landed cost");
      expect(res.grossProfit.value).toBe(185.0); // 300 - 115
    });

    it("prohibits today's override from retroactively rewriting historical orders", () => {
      const orderLines: FinancialOrderLine[] = [
        {
          id: "line_past",
          order_id: "ord_past",
          product_id: PROD_ID,
          sku: SKU,
          order_date: "2026-09-10",
          order_status: "DELIVERED",
          ordered_qty: 10,
          shipped_qty: 10,
          unit_price: 30.0,
        },
      ];

      const costRecords: LandedCostRecord[] = [
        { product_id: PROD_ID, effective_date: "2026-08-01", unit_landed_cost: 15.0, cost_status: "FINAL", source: "landed_cost_results" },
      ];

      // Override set on 2026-10-01 (after order date 2026-09-10)
      const costMaster: ProductCostMaster = {
        product_id: PROD_ID,
        sku: SKU,
        override_landed_cost: 8.0,
        override_effective_date: "2026-10-01", // After order date
      };

      const res = calculateFinancialKpis({
        period: mockPeriod,
        product_id: PROD_ID,
        orderLines,
        costRecords,
        costMaster,
      });

      // Must NOT use $8.0 override! Must use historical $15 layer: 10 * $15 = $150
      expect(res.landedCogs.value).toBe(150.0);
      expect(res.landedCogs.sourceBasis).toContain("Computed from historical landed_cost_results");
      expect(res.grossProfit.value).toBe(150.0); // 300 - 150
    });

    it("returns UNAVAILABLE when historical cost is missing and override is only effective in future", () => {
      const orderLines: FinancialOrderLine[] = [
        {
          id: "line_no_hist",
          order_id: "ord_no_hist",
          product_id: PROD_ID,
          sku: SKU,
          order_date: "2026-09-10",
          order_status: "DELIVERED",
          ordered_qty: 10,
          shipped_qty: 10,
          unit_price: 30.0,
        },
      ];

      // No historical cost records on or before 2026-09-10
      const costRecords: LandedCostRecord[] = [];

      const costMaster: ProductCostMaster = {
        product_id: PROD_ID,
        sku: SKU,
        override_landed_cost: 8.0,
        override_effective_date: "2026-10-01", // Future override only
      };

      const res = calculateFinancialKpis({
        period: mockPeriod,
        product_id: PROD_ID,
        orderLines,
        costRecords,
        costMaster,
      });

      // Cannot calculate COGS without verifiable historical cost
      expect(res.landedCogs.value).toBe(null);
      expect(res.landedCogs.status).toBe("UNAVAILABLE");
      expect(res.grossProfit.value).toBe(null);
      expect(res.grossProfit.status).toBe("UNAVAILABLE");
      expect(res.grossMargin.value).toBe(null);
      expect(res.grossMargin.status).toBe("UNAVAILABLE");
    });

    it("selects correct historical landed cost layer based on order date", () => {
      const orderLines: FinancialOrderLine[] = [
        {
          id: "line_early",
          order_id: "ord_early",
          product_id: PROD_ID,
          sku: SKU,
          order_date: "2026-08-20", // Before layer 2
          order_status: "DELIVERED",
          ordered_qty: 10,
          shipped_qty: 10,
          unit_price: 20.0,
        },
        {
          id: "line_late",
          order_id: "ord_late",
          product_id: PROD_ID,
          sku: SKU,
          order_date: "2026-09-25", // After layer 2
          order_status: "DELIVERED",
          ordered_qty: 10,
          shipped_qty: 10,
          unit_price: 20.0,
        },
      ];

      const costRecords: LandedCostRecord[] = [
        { product_id: PROD_ID, effective_date: "2026-08-01", unit_landed_cost: 8.0, cost_status: "FINAL", source: "landed_cost_results" },
        { product_id: PROD_ID, effective_date: "2026-09-01", unit_landed_cost: 12.0, cost_status: "FINAL", source: "landed_cost_results" },
      ];

      const res = calculateFinancialKpis({
        period: mockPeriod,
        product_id: PROD_ID,
        orderLines,
        costRecords,
      });

      // Line early: 10 * $8 = $80. Line late: 10 * $12 = $120. Total COGS = $200.
      expect(res.landedCogs.value).toBe(200.0);
      expect(res.b2bNetSales.value).toBe(400.0);
      expect(res.grossProfit.value).toBe(200.0);
      expect(res.grossMargin.value).toBe(50.0);
    });
  });

  // =========================================================================
  // 2. INVENTORY ENGINE
  // =========================================================================
  describe("2. Inventory Engine", () => {
    it("calculates HQ inventory value and FIFO aging from active layers", () => {
      const activeLayers: FifoInventoryLayer[] = [
        {
          id: "layer_1",
          product_id: PROD_ID,
          warehouse_id: "wh_us_east",
          received_date: "2026-09-25", // 20 days old as of 2026-10-15
          original_qty: 100,
          remaining_qty: 80,
          unit_landed_cost: 12.0,
          status: "ACTIVE",
        },
        {
          id: "layer_2",
          product_id: PROD_ID,
          warehouse_id: "wh_us_east",
          received_date: "2026-08-01", // 75 days old as of 2026-10-15
          original_qty: 50,
          remaining_qty: 20,
          unit_landed_cost: 10.0,
          status: "ACTIVE",
        },
      ];

      const res = calculateInventoryKpis({
        period: mockPeriod,
        product_id: PROD_ID,
        activeLayers,
      });

      expect(res.hqAvailableUnits.value).toBe(100); // 80 + 20
      // Value = (80 * 12) + (20 * 10) = 960 + 200 = $1,160
      expect(res.hqInventoryValue.value).toBe(1160.0);
      expect(res.hqInventoryValue.status).toBe("ACTUAL");

      // Aging: (80 * 20 + 20 * 75) / 100 = (1600 + 1500) / 100 = 31.0 days
      const aging = res.fifoInventoryAging.value!;
      expect(aging.weightedAverageAgeDays).toBe(31.0);
      expect(aging.newestLayerAgeDays).toBe(20);
      expect(aging.oldestLayerAgeDays).toBe(75);

      // Bracket breakdown:
      // Bracket 0-30 days: 80 units ($960)
      const b0_30 = aging.brackets.find((b) => b.label === "0-30 days");
      expect(b0_30?.units).toBe(80);
      expect(b0_30?.valueUsd).toBe(960.0);
      expect(b0_30?.percentOfTotalUnits).toBe(80.0);

      // Bracket 61-90 days: 20 units ($200)
      const b61_90 = aging.brackets.find((b) => b.label === "61-90 days");
      expect(b61_90?.units).toBe(20);
      expect(b61_90?.valueUsd).toBe(200.0);
      expect(b61_90?.percentOfTotalUnits).toBe(20.0);
    });

    it("calculates Turnover, DIO, Days of Supply, and GMROI with valid data", () => {
      const activeLayers: FifoInventoryLayer[] = [
        {
          id: "layer_1",
          product_id: PROD_ID,
          warehouse_id: "wh_1",
          received_date: "2026-09-01",
          original_qty: 200,
          remaining_qty: 200,
          unit_landed_cost: 10.0, // $2,000 inventory
          status: "ACTIVE",
        },
      ];

      const historicalSnapshots: HqInventorySnapshot[] = [
        { date: "2026-08-16", qty_on_hand: 200, qty_available: 200, qty_hold: 0, valuation_usd: 2000.0 },
        { date: "2026-09-15", qty_on_hand: 200, qty_available: 200, qty_hold: 0, valuation_usd: 2000.0 },
        { date: "2026-10-15", qty_on_hand: 200, qty_available: 200, qty_hold: 0, valuation_usd: 2000.0 },
      ];

      const res = calculateInventoryKpis({
        period: mockPeriod,
        product_id: PROD_ID,
        activeLayers,
        historicalSnapshots,
        periodLandedCogs: 4000.0, // $4,000 COGS in 60 days
        periodGrossProfit: 2000.0, // $2,000 Gross Profit
        dailyShipmentVelocity: 5.0, // 5 units shipped per day
      });

      // Average inventory = $2,000
      expect(res.averageInventoryValue.value).toBe(2000.0);
      expect(res.averageInventoryValue.status).toBe("ACTUAL");

      // Turnover = COGS / Avg Inv = 4,000 / 2,000 = 2.0
      expect(res.inventoryTurnover.value).toBe(2.0);
      expect(res.inventoryTurnover.status).toBe("ACTUAL");
      // Annualized turnover = 2.0 * (365 / 60) = 12.17
      expect(res.inventoryTurnover.metadata?.annualizedTurnover).toBe(12.17);

      // DIO = (Avg Inv / COGS) * days = (2000 / 4000) * 60 = 30.0 days
      expect(res.dioDays.value).toBe(30.0);
      expect(res.dioDays.status).toBe("ACTUAL");

      // Days of Supply = Available Units (200) / Daily Velocity (5.0) = 40.0 days
      expect(res.daysOfSupply.value).toBe(40.0);
      expect(res.daysOfSupply.status).toBe("ACTUAL");

      // GMROI = Gross Profit / Avg Inv = 2000 / 2000 = 1.0
      expect(res.gmroi.value).toBe(1.0);
      expect(res.gmroi.status).toBe("ACTUAL");
    });

    it("handles zero denominators safely without producing NaN or Infinity", () => {
      const res = calculateInventoryKpis({
        period: mockPeriod,
        product_id: PROD_ID,
        activeLayers: [], // 0 units, $0 inventory
        periodLandedCogs: 0,
        periodGrossProfit: 0,
        dailyShipmentVelocity: 0,
      });

      expect(res.hqAvailableUnits.value).toBe(0);
      expect(res.hqInventoryValue.value).toBe(0);
      expect(res.inventoryTurnover.value).toBe(null);
      expect(res.inventoryTurnover.status).toBe("UNAVAILABLE");
      expect(res.dioDays.value).toBe(null);
      expect(res.dioDays.status).toBe("UNAVAILABLE");
      expect(res.daysOfSupply.value).toBe(0);
      expect(res.gmroi.value).toBe(null);
      expect(res.gmroi.status).toBe("UNAVAILABLE");
    });

    it("returns UNAVAILABLE for Average Inventory, Turnover, DIO, and GMROI when historical snapshots are missing", () => {
      const activeLayers: FifoInventoryLayer[] = [
        {
          id: "layer_curr",
          product_id: PROD_ID,
          warehouse_id: "wh_1",
          received_date: "2026-09-01",
          original_qty: 50,
          remaining_qty: 50,
          unit_landed_cost: 20.0, // $1,000
          status: "ACTIVE",
        },
      ];

      const res = calculateInventoryKpis({
        period: mockPeriod,
        product_id: PROD_ID,
        activeLayers,
        historicalSnapshots: [], // No snapshots
        periodLandedCogs: 2000.0,
        periodGrossProfit: 1000.0,
      });

      // Average inventory status must be UNAVAILABLE (never silently substitute ending inventory!)
      expect(res.averageInventoryValue.value).toBe(null);
      expect(res.averageInventoryValue.status).toBe("UNAVAILABLE");
      expect(res.averageInventoryValue.missingInputReason).toContain("Insufficient historical inventory snapshots");
      // But ending inventory is preserved as an explicit proxy in metadata
      expect(res.averageInventoryValue.metadata?.endingInventoryValuationProxy).toBe(1000.0);

      // Turnover, DIO, and GMROI cannot be computed without verified average inventory
      expect(res.inventoryTurnover.value).toBe(null);
      expect(res.inventoryTurnover.status).toBe("UNAVAILABLE");
      expect(res.dioDays.value).toBe(null);
      expect(res.dioDays.status).toBe("UNAVAILABLE");
      expect(res.gmroi.value).toBe(null);
      expect(res.gmroi.status).toBe("UNAVAILABLE");
    });

    it("calculates true average inventory, turnover, DIO, and GMROI when >= 2 historical snapshots are present", () => {
      const activeLayers: FifoInventoryLayer[] = [
        {
          id: "layer_curr",
          product_id: PROD_ID,
          warehouse_id: "wh_1",
          received_date: "2026-09-01",
          original_qty: 50,
          remaining_qty: 50,
          unit_landed_cost: 20.0,
          status: "ACTIVE",
        },
      ];

      const historicalSnapshots: HqInventorySnapshot[] = [
        { date: "2026-08-16", qty_on_hand: 60, qty_available: 60, qty_hold: 0, valuation_usd: 1200.0 },
        { date: "2026-09-15", qty_on_hand: 50, qty_available: 50, qty_hold: 0, valuation_usd: 1000.0 },
        { date: "2026-10-15", qty_on_hand: 40, qty_available: 40, qty_hold: 0, valuation_usd: 800.0 },
      ];

      const res = calculateInventoryKpis({
        period: mockPeriod,
        product_id: PROD_ID,
        activeLayers,
        historicalSnapshots,
        periodLandedCogs: 2000.0,
        periodGrossProfit: 1000.0,
      });

      // Average = (1200 + 1000 + 800) / 3 = 1000.0
      expect(res.averageInventoryValue.value).toBe(1000.0);
      expect(res.averageInventoryValue.status).toBe("ACTUAL");
      // Turnover = 2000 / 1000 = 2.0
      expect(res.inventoryTurnover.value).toBe(2.0);
      expect(res.inventoryTurnover.status).toBe("ACTUAL");
      // DIO = (1000 / 2000) * 60 = 30.0 days
      expect(res.dioDays.value).toBe(30.0);
      expect(res.dioDays.status).toBe("ACTUAL");
      // GMROI = 1000 / 1000 = 1.0
      expect(res.gmroi.value).toBe(1.0);
      expect(res.gmroi.status).toBe("ACTUAL");
    });
  });

  // =========================================================================
  // 3. VELOCITY ENGINE
  // =========================================================================
  describe("3. Velocity Engine", () => {
    it("calculates B2B daily and weekly shipment velocities from fulfilled orders", () => {
      const orderLines: FinancialOrderLine[] = [
        {
          id: "l1",
          order_id: "o1",
          product_id: PROD_ID,
          sku: SKU,
          order_date: "2026-08-20",
          order_status: "DELIVERED",
          ordered_qty: 120,
          shipped_qty: 120,
          unit_price: 20.0,
        },
        {
          id: "l2",
          order_id: "o2",
          product_id: PROD_ID,
          sku: SKU,
          order_date: "2026-09-20",
          order_status: "DELIVERED",
          ordered_qty: 180,
          shipped_qty: 180,
          unit_price: 20.0,
        },
      ];

      const res = calculateVelocityKpis({
        period: mockPeriod, // 60 days
        product_id: PROD_ID,
        orderLines,
        weeklyReports: [],
      });

      // Total shipped = 300 units in 60 days
      // Daily = 300 / 60 = 5.0 units/day
      expect(res.b2bShipmentVelocityDaily.value).toBe(5.0);
      expect(res.b2bShipmentVelocityDaily.status).toBe("ACTUAL");
      // Weekly = 5.0 * 7 = 35.0 units/week
      expect(res.b2bShipmentVelocityWeekly.value).toBe(35.0);
      expect(res.b2bShipmentVelocityWeekly.status).toBe("ACTUAL");
    });

    it("calculates Estimated Retailer Sell-Through from weekly reports with ESTIMATED label", () => {
      const weeklyReports: RetailerWeeklyReportLine[] = [
        {
          id: "rep_1",
          report_id: "r1",
          store_id: "store_alpha",
          product_id: PROD_ID,
          week_start_date: "2026-09-01",
          week_end_date: "2026-09-07",
          sales_units: 15,
          beginning_stock: 50,
          ending_stock: 35,
          received_units: 0,
        },
        {
          id: "rep_2",
          report_id: "r2",
          store_id: "store_alpha",
          product_id: PROD_ID,
          week_start_date: "2026-09-08",
          week_end_date: "2026-09-14",
          // Implicit sales via stock delta: 35 + 20 replenishment - 30 ending = 25 sales
          sales_units: null,
          beginning_stock: 35,
          received_units: 20,
          ending_stock: 30,
        },
      ];

      const res = calculateVelocityKpis({
        period: mockPeriod,
        product_id: PROD_ID,
        orderLines: [],
        weeklyReports,
      });

      // Total estimated sell through = 15 + 25 = 40 units
      expect(res.estimatedRetailerSellThroughUnits.value).toBe(40);
      // Status must strictly be ESTIMATED or PARTIAL, NEVER ACTUAL!
      expect(["ESTIMATED", "PARTIAL"]).toContain(res.estimatedRetailerSellThroughUnits.status);
      expect(res.estimatedRetailerSellThroughUnits.sourceBasis).toContain("not direct POS");

      // Replenishment captured
      expect(res.replenishmentAdjustmentUnits.value).toBe(20);
    });

    it("evaluates reporting qualification and penalizes data confidence when reports are missing", () => {
      // 2 target stores expected across ~9 weeks = 18 expected reports
      const storesTarget = [
        { store_id: "store_1", is_active: true, carries_sku: true },
        { store_id: "store_2", is_active: true, carries_sku: true },
      ];

      // Only 3 reports submitted (compliance < 20%)
      const weeklyReports: RetailerWeeklyReportLine[] = [
        { id: "1", report_id: "1", store_id: "store_1", product_id: PROD_ID, week_start_date: "2026-09-01", week_end_date: "2026-09-07", sales_units: 5 },
        { id: "2", report_id: "2", store_id: "store_1", product_id: PROD_ID, week_start_date: "2026-09-08", week_end_date: "2026-09-14", sales_units: 5 },
        { id: "3", report_id: "3", store_id: "store_2", product_id: PROD_ID, week_start_date: "2026-09-01", week_end_date: "2026-09-07", sales_units: 4 },
      ];

      const res = calculateVelocityKpis({
        period: mockPeriod,
        product_id: PROD_ID,
        orderLines: [],
        weeklyReports,
        storesTarget,
      });

      const qual = res.reportingQualification.value!;
      expect(qual.totalTargetStoresCount).toBe(2);
      expect(qual.actualReportsCount).toBe(3);
      expect(qual.complianceRate).toBeLessThan(0.3);

      // Low compliance results in degraded confidence and PARTIAL status
      expect(res.estimatedRetailerSellThroughUnits.status).toBe("PARTIAL");
      expect(res.estimatedRetailerSellThroughUnits.dataConfidence).toBe(0.3);
    });

    it("returns UNAVAILABLE when zero weekly reports are submitted", () => {
      const res = calculateVelocityKpis({
        period: mockPeriod,
        product_id: PROD_ID,
        orderLines: [],
        weeklyReports: [],
      });

      expect(res.estimatedRetailerSellThroughUnits.value).toBe(null);
      expect(res.estimatedRetailerSellThroughUnits.status).toBe("UNAVAILABLE");
      expect(res.estimatedRetailerSellThroughUnits.missingInputReason).toContain("Missing retailer_weekly_checks");
    });
  });

  // =========================================================================
  // 4. EXCHANGE FREQUENCY ENGINE
  // =========================================================================
  describe("4. Exchange Frequency Engine", () => {
    it("deduplicates multiple claims from the same store into 1 unique claiming store", () => {
      const claimRecords: ExchangeClaimRecord[] = [
        {
          id: "claim_line_1",
          claim_id: "cl_1",
          company_id: "comp_1",
          store_id: "store_alpha",
          product_id: PROD_ID,
          cohort_id: "coh_1",
          claim_date: "2026-09-01",
          status: "SUBMITTED",
          requested_units: 5,
          unit_wholesale_price: 20.0,
          claimed_dollar_value: 100.0,
        },
        {
          id: "claim_line_2",
          claim_id: "cl_2",
          company_id: "comp_1",
          store_id: "store_alpha", // SAME STORE
          product_id: PROD_ID,
          cohort_id: "coh_1",
          claim_date: "2026-09-15",
          status: "APPROVED_OPTION_B",
          requested_units: 3,
          unit_wholesale_price: 20.0,
          claimed_dollar_value: 60.0,
        },
        {
          id: "claim_line_3",
          claim_id: "cl_3",
          company_id: "comp_2",
          store_id: "store_beta", // DIFFERENT STORE
          product_id: PROD_ID,
          cohort_id: "coh_2",
          claim_date: "2026-09-20",
          status: "RMA_INSPECTED",
          requested_units: 10,
          unit_wholesale_price: 20.0,
          claimed_dollar_value: 200.0,
        },
      ];

      const eligibilityRecords: StoreCohortEligibilityRecord[] = [
        { store_id: "store_alpha", product_id: PROD_ID, cohort_id: "coh_1", cohort_date: "2026-05-01", initial_order_date: "2026-05-01", is_eligible: true, cohort_units: 50 },
        { store_id: "store_beta", product_id: PROD_ID, cohort_id: "coh_2", cohort_date: "2026-05-15", initial_order_date: "2026-05-15", is_eligible: true, cohort_units: 50 },
        { store_id: "store_gamma", product_id: PROD_ID, cohort_id: "coh_3", cohort_date: "2026-06-01", initial_order_date: "2026-06-01", is_eligible: true, cohort_units: 50 },
        { store_id: "store_delta", product_id: PROD_ID, cohort_id: "coh_4", cohort_date: "2026-06-15", initial_order_date: "2026-06-15", is_eligible: true, cohort_units: 50 },
      ];

      const res = calculateExchangeFrequencyKpis({
        period: mockPeriod,
        product_id: PROD_ID,
        claimRecords,
        eligibilityRecords,
      });

      // 2 unique claiming stores (store_alpha and store_beta)
      expect(res.uniqueClaimingStoreCount.value).toBe(2);
      expect(res.eligibleStoreCohortCount.value).toBe(4);
      // Claiming store rate = 2 / 4 = 50.0%
      expect(res.claimingStoreRate.value).toBe(50.0);
      expect(res.totalClaimRequestedUnits.value).toBe(18); // 5 + 3 + 10
      expect(res.totalClaimDollarValue.value).toBe(360.0); // 100 + 60 + 200
    });

    it("excludes cancelled and rejected claims from unique claiming store count", () => {
      const claimRecords: ExchangeClaimRecord[] = [
        {
          id: "cl_canc",
          claim_id: "cl_canc",
          company_id: "comp_1",
          store_id: "store_only_cancelled",
          product_id: PROD_ID,
          cohort_id: "coh_1",
          claim_date: "2026-09-05",
          status: "CANCELLED",
          requested_units: 5,
          unit_wholesale_price: 20.0,
          claimed_dollar_value: 100.0,
        },
        {
          id: "cl_rej",
          claim_id: "cl_rej",
          company_id: "comp_1",
          store_id: "store_only_rejected",
          product_id: PROD_ID,
          cohort_id: "coh_1",
          claim_date: "2026-09-06",
          status: "REJECTED",
          requested_units: 5,
          unit_wholesale_price: 20.0,
          claimed_dollar_value: 100.0,
        },
      ];

      const eligibilityRecords: StoreCohortEligibilityRecord[] = [
        { store_id: "store_only_cancelled", product_id: PROD_ID, cohort_id: "coh_1", cohort_date: "2026-05-01", initial_order_date: "2026-05-01", is_eligible: true, cohort_units: 20 },
      ];

      const res = calculateExchangeFrequencyKpis({
        period: mockPeriod,
        product_id: PROD_ID,
        claimRecords,
        eligibilityRecords,
      });

      expect(res.uniqueClaimingStoreCount.value).toBe(0);
      expect(res.claimingStoreRate.value).toBe(0.0);
      expect(res.totalClaimRequestedUnits.value).toBe(0);
      expect(res.totalClaimDollarValue.value).toBe(0);

      // But exposure breakdown still tracks rejected/cancelled counts
      const breakdown = res.exposureByStatus.value!;
      const cancEntry = breakdown.find((b) => b.status === "CANCELLED");
      expect(cancEntry?.claimsCount).toBe(1);
      expect(cancEntry?.units).toBe(5);
    });

    it("returns UNAVAILABLE with reason when cohort eligibility history is missing entirely", () => {
      const res = calculateExchangeFrequencyKpis({
        period: mockPeriod,
        product_id: PROD_ID,
        claimRecords: [],
        eligibilityRecords: [], // Missing cohort history
      });

      expect(res.eligibleStoreCohortCount.value).toBe(null);
      expect(res.eligibleStoreCohortCount.status).toBe("UNAVAILABLE");
      expect(res.eligibleStoreCohortCount.missingInputReason).toContain("Missing cohort eligibility records");
      expect(res.uniqueClaimingStoreCount.value).toBe(0);
      expect(res.claimingStoreRate.value).toBe(null);
      expect(res.claimingStoreRate.status).toBe("UNAVAILABLE");
      expect(res.claimingStoreRate.missingInputReason).toContain("Missing cohort eligibility records");
    });

    it("returns UNAVAILABLE claimingStoreRate when cohorts exist but zero have reached Day-100 maturity", () => {
      const eligibilityRecords: StoreCohortEligibilityRecord[] = [
        {
          store_id: "store_in_90_day",
          product_id: PROD_ID,
          cohort_id: "coh_new",
          cohort_date: "2026-09-01",
          protection_end_date: "2026-11-30",
          claim_eligibility_date: "2026-12-10",
          is_matured_day_100: false,
          is_in_active_protection_window: true,
          cohort_units: 50,
        },
      ];

      const res = calculateExchangeFrequencyKpis({
        period: mockPeriod,
        product_id: PROD_ID,
        claimRecords: [],
        eligibilityRecords,
      });

      // 1 store in active 90-day protection window
      expect(res.protectedStoresCount.value).toBe(1);
      // 0 stores matured for Day-100 claims
      expect(res.eligibleStoreCohortCount.value).toBe(0);
      expect(res.eligibleStoreCohortCount.status).toBe("ACTUAL");
      expect(res.uniqueClaimingStoreCount.value).toBe(0);
      // Denominator is 0 -> UNAVAILABLE with explicit reason
      expect(res.claimingStoreRate.value).toBe(null);
      expect(res.claimingStoreRate.status).toBe("UNAVAILABLE");
      expect(res.claimingStoreRate.missingInputReason).toContain("Zero stores have reached Day-100 claim maturity");
      expect(res.claimingStoreRate.metadata?.protectedStoresIn90DayWindow).toBe(1);
    });

    it("strictly distinguishes active 90-day protection stores from Day-100 claim-matured cohorts", () => {
      const eligibilityRecords: StoreCohortEligibilityRecord[] = [
        {
          store_id: "store_protected_only",
          product_id: PROD_ID,
          cohort_id: "coh_prot",
          cohort_date: "2026-09-01",
          protection_end_date: "2026-11-30",
          claim_eligibility_date: "2026-12-10",
          is_matured_day_100: false,
          is_in_active_protection_window: true,
          cohort_units: 50,
        },
        {
          store_id: "store_matured",
          product_id: PROD_ID,
          cohort_id: "coh_mat",
          cohort_date: "2026-06-01",
          protection_end_date: "2026-08-30",
          claim_eligibility_date: "2026-09-09",
          is_matured_day_100: true,
          is_in_active_protection_window: false,
          cohort_units: 30,
        },
      ];

      const claimRecords: ExchangeClaimRecord[] = [
        {
          id: "claim_mat",
          claim_id: "c_mat",
          company_id: "comp_1",
          store_id: "store_matured",
          product_id: PROD_ID,
          cohort_id: "coh_mat",
          claim_date: "2026-09-15",
          status: "APPROVED_OPTION_B",
          requested_units: 5,
          unit_wholesale_price: 20,
          claimed_dollar_value: 100,
        },
      ];

      const res = calculateExchangeFrequencyKpis({
        period: mockPeriod,
        product_id: PROD_ID,
        claimRecords,
        eligibilityRecords,
      });

      // 1 store in active 90-day protection window
      expect(res.protectedStoresCount.value).toBe(1);
      // 1 store reached Day-100 maturity in evaluation period
      expect(res.eligibleStoreCohortCount.value).toBe(1);
      // 1 claiming store out of 1 eligible Day-100 store = 100.0%
      expect(res.uniqueClaimingStoreCount.value).toBe(1);
      expect(res.claimingStoreRate.value).toBe(100.0);
      expect(res.claimingStoreRate.status).toBe("ACTUAL");
    });

    it("breaks down financial exposure across all authoritative lifecycle states", () => {
      const claimRecords: ExchangeClaimRecord[] = [
        { id: "1", claim_id: "1", company_id: "c1", store_id: "s1", product_id: PROD_ID, cohort_id: "coh1", claim_date: "2026-09-01", status: "SUBMITTED", requested_units: 2, unit_wholesale_price: 10, claimed_dollar_value: 20 },
        { id: "2", claim_id: "2", company_id: "c1", store_id: "s1", product_id: PROD_ID, cohort_id: "coh1", claim_date: "2026-09-02", status: "APPROVED_OPTION_A", requested_units: 3, unit_wholesale_price: 10, claimed_dollar_value: 30 },
        { id: "3", claim_id: "3", company_id: "c2", store_id: "s2", product_id: PROD_ID, cohort_id: "coh2", claim_date: "2026-09-03", status: "SETTLED", requested_units: 5, unit_wholesale_price: 10, claimed_dollar_value: 50 },
      ];

      const res = calculateExchangeFrequencyKpis({
        period: mockPeriod,
        product_id: PROD_ID,
        claimRecords,
        eligibilityRecords: [],
      });

      const breakdown = res.exposureByStatus.value!;
      expect(breakdown.find((b) => b.status === "SUBMITTED")?.dollarValue).toBe(20.0);
      expect(breakdown.find((b) => b.status === "APPROVED_OPTION_A")?.dollarValue).toBe(30.0);
      expect(breakdown.find((b) => b.status === "SETTLED")?.dollarValue).toBe(50.0);
      expect(breakdown.find((b) => b.status === "REJECTED")?.dollarValue).toBe(0.0);
    });
  });

  // =========================================================================
  // 5. MASTER ORCHESTRATOR & EDGE CASES
  // =========================================================================
  describe("5. Master Orchestrator & Edge Cases", () => {
    it("runs complete master calculation orchestrating all 4 engines", () => {
      const masterResult = calculateProductPerformanceKpis({
        period: mockPeriod,
        product_id: PROD_ID,
        financial: {
          orderLines: [
            {
              id: "m_ord_1",
              order_id: "o1",
              product_id: PROD_ID,
              sku: SKU,
              order_date: "2026-09-01",
              order_status: "DELIVERED",
              ordered_qty: 60,
              shipped_qty: 60,
              unit_price: 20.0,
            },
          ],
          costRecords: [
            { product_id: PROD_ID, effective_date: "2026-08-01", unit_landed_cost: 10.0, cost_status: "FINAL", source: "landed_cost_results" },
          ],
        },
        inventory: {
          activeLayers: [
            {
              id: "m_lay_1",
              product_id: PROD_ID,
              warehouse_id: "wh_1",
              received_date: "2026-09-15",
              original_qty: 120,
              remaining_qty: 120,
              unit_landed_cost: 10.0,
              status: "ACTIVE",
            },
          ],
          historicalSnapshots: [
            { date: "2026-08-16", qty_on_hand: 120, qty_available: 120, qty_hold: 0, valuation_usd: 1200.0 },
            { date: "2026-10-15", qty_on_hand: 120, qty_available: 120, qty_hold: 0, valuation_usd: 1200.0 },
          ],
        },
        velocity: {
          weeklyReports: [
            { id: "m_rep_1", report_id: "r1", store_id: "s1", product_id: PROD_ID, week_start_date: "2026-09-01", week_end_date: "2026-09-07", sales_units: 10 },
          ],
        },
        exchange: {
          claimRecords: [
            { id: "m_cl_1", claim_id: "c1", company_id: "comp1", store_id: "s1", product_id: PROD_ID, cohort_id: "coh1", claim_date: "2026-09-10", status: "SUBMITTED", requested_units: 4, unit_wholesale_price: 20, claimed_dollar_value: 80 },
          ],
          eligibilityRecords: [
            { store_id: "s1", product_id: PROD_ID, cohort_id: "coh1", cohort_date: "2026-05-01", initial_order_date: "2026-05-01", is_eligible: true, cohort_units: 60 },
          ],
        },
      });

      expect(masterResult.product_id).toBe(PROD_ID);
      expect(masterResult.asOfTimestamp).toBeDefined();

      // Financial
      expect(masterResult.financial.b2bNetSales.value).toBe(1200.0);
      expect(masterResult.financial.landedCogs.value).toBe(600.0);
      expect(masterResult.financial.grossProfit.value).toBe(600.0);
      expect(masterResult.financial.grossMargin.value).toBe(50.0);

      // Velocity
      expect(masterResult.velocity.b2bShipmentVelocityDaily.value).toBe(1.0); // 60 units in 60 days = 1 unit/day
      expect(masterResult.velocity.estimatedRetailerSellThroughUnits.value).toBe(10);

      // Inventory
      expect(masterResult.inventory.hqInventoryValue.value).toBe(1200.0);
      // Turnover = COGS ($600) / Avg Inv ($1200) = 0.5
      expect(masterResult.inventory.inventoryTurnover.value).toBe(0.5);
      // Days of Supply = 120 units / 1.0 unit/day = 120.0 days
      expect(masterResult.inventory.daysOfSupply.value).toBe(120.0);

      // Exchange
      expect(masterResult.exchange.uniqueClaimingStoreCount.value).toBe(1);
      expect(masterResult.exchange.claimingStoreRate.value).toBe(100.0);
      expect(masterResult.exchange.totalClaimRequestedUnits.value).toBe(4);
    });

    it("verifies date boundary inclusiveness and ignores out-of-period events", () => {
      const orderLines: FinancialOrderLine[] = [
        { id: "before", order_id: "o0", product_id: PROD_ID, sku: SKU, order_date: "2026-08-15", order_status: "DELIVERED", ordered_qty: 10, shipped_qty: 10, unit_price: 20 },
        { id: "first_day", order_id: "o1", product_id: PROD_ID, sku: SKU, order_date: "2026-08-16", order_status: "DELIVERED", ordered_qty: 10, shipped_qty: 10, unit_price: 20 },
        { id: "last_day", order_id: "o2", product_id: PROD_ID, sku: SKU, order_date: "2026-10-15", order_status: "DELIVERED", ordered_qty: 10, shipped_qty: 10, unit_price: 20 },
        { id: "after", order_id: "o3", product_id: PROD_ID, sku: SKU, order_date: "2026-10-16", order_status: "DELIVERED", ordered_qty: 10, shipped_qty: 10, unit_price: 20 },
      ];

      const res = calculateFinancialKpis({
        period: mockPeriod,
        product_id: PROD_ID,
        orderLines,
        costRecords: [{ product_id: PROD_ID, effective_date: "2026-08-01", unit_landed_cost: 10, cost_status: "FINAL", source: "landed_cost_results" }],
      });

      // Only first_day and last_day are within [2026-08-16, 2026-10-15] = 20 units * $20 = $400
      expect(res.b2bNetSales.value).toBe(400.0);
      expect(res.totalUnitsSold.value).toBe(20);
    });

    it("prevents NaN and Infinity in math helpers", () => {
      expect(safeDiv(10, 0)).toBe(null);
      expect(safeDiv(0, 0)).toBe(null);
      expect(safeDiv(NaN, 5)).toBe(null);
      expect(safeDiv(5, NaN)).toBe(null);
      expect(safeDiv(Infinity, 5)).toBe(null);
      expect(safeDiv(5, Infinity)).toBe(null);
      expect(safeRound(NaN)).toBe(null);
      expect(safeRound(Infinity)).toBe(null);
      expect(safeRound(undefined)).toBe(null);
      expect(daysBetween("2026-01-01", "2026-01-01")).toBe(0);
      expect(daysBetween("2026-01-10", "2026-01-01")).toBe(0); // Clamped to 0
    });
  });
});
