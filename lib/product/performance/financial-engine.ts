/**
 * Product Performance V2.0 — Financial Engine
 * Task ID: ADM-SALES-PERF-003-R1
 * Location: lib/product/performance/financial-engine.ts
 *
 * Implements:
 * - B2B Net Sales (excluding outbound freight/tax; handling refunds & cancellations)
 * - Landed COGS (respecting historical landed cost vs override cost; no double counting)
 * - Gross Profit (Net Sales - Landed COGS)
 * - Gross Margin ((Gross Profit / Net Sales) * 100)
 * - Exchange Credit settlement distinction (settlement method, not merchandise discount)
 */

import type {
  FinancialEngineInput,
  FinancialKpis,
  FinancialOrderLine,
  LandedCostRecord,
  KpiResult,
} from "./types";
import { isWithinPeriod, safeDiv, safeRound } from "./helpers";

interface ResolvedLineCost {
  unitCost: number;
  costSource: "override_landed_cost" | "historical_layer" | "fallback" | "missing";
  isOverride: boolean;
}

/**
 * Resolves the unit landed cost for a specific order line based on date and policy.
 *
 * OWNER-APPROVED RULE:
 * 1. Historical COGS must use verifiable historical landed cost on or prior to order_date.
 * 2. Today's products.override_landed_cost must NEVER silently override past transactions
 *    unless an effective historical override record on or prior to order_date is proven.
 * 3. If historical landed cost is unavailable, return null (Gross Profit & Margin = N/A).
 */
function resolveLineLandedCost(
  line: FinancialOrderLine,
  costRecords: LandedCostRecord[],
  overrideCost?: number | null,
  overrideEffectiveDate?: string | null
): ResolvedLineCost | null {
  // 1. Proven historical override: only valid if overrideEffectiveDate is explicitly known AND <= order_date
  if (
    overrideCost !== undefined &&
    overrideCost !== null &&
    Number.isFinite(overrideCost) &&
    overrideCost > 0 &&
    overrideEffectiveDate &&
    overrideEffectiveDate <= line.order_date
  ) {
    return {
      unitCost: overrideCost,
      costSource: "override_landed_cost",
      isOverride: true,
    };
  }

  // 2. Search verifiable historical landed cost records (from landed_cost_results or inventory_cost_layers)
  // Strictly filter for records established ON OR BEFORE the order date
  const historicalCosts = (costRecords || [])
    .filter(
      (c) =>
        c.product_id === line.product_id &&
        c.unit_landed_cost > 0 &&
        c.effective_date <= line.order_date
    )
    .sort((a, b) => b.effective_date.localeCompare(a.effective_date));

  if (historicalCosts.length > 0) {
    const selectedCost = historicalCosts[0]; // Most recent cost on or prior to order_date
    return {
      unitCost: selectedCost.unit_landed_cost,
      costSource: selectedCost.source === "override_landed_cost" ? "override_landed_cost" : "historical_layer",
      isOverride: selectedCost.source === "override_landed_cost" || selectedCost.cost_status === "OVERRIDE",
    };
  }

  // 3. If no verifiable cost exists on or prior to order_date, do NOT guess or substitute future overrides!
  return null;
}

export function calculateFinancialKpis(input: FinancialEngineInput): FinancialKpis {
  const { period, product_id, orderLines, costRecords, costMaster } = input;

  const periodObj = {
    start: period.periodStart,
    end: period.periodEnd,
  };

  // 1. Filter lines matching product, date range, and valid order status
  const seenLineIds = new Set<string>();
  const validLines: FinancialOrderLine[] = [];

  for (const line of orderLines) {
    if (line.product_id !== product_id) continue;
    if (!isWithinPeriod(line.order_date, period)) continue;

    // Deduplicate identical line IDs (e.g. if order and fulfillment joins duplicate records)
    if (seenLineIds.has(line.id)) continue;
    seenLineIds.add(line.id);

    // Cancelled orders produce 0 sales and 0 COGS
    if (line.order_status.toUpperCase() === "CANCELLED") continue;

    validLines.push(line);
  }

  // 2. Accumulate Financial Totals
  let totalGrossSubtotal = 0;
  let totalDiscounts = 0;
  let totalRefunds = 0;
  let totalCreditRedeemed = 0;
  let totalNetSales = 0;
  let totalUnitsSold = 0;

  let totalCogs = 0;
  let hasMissingCost = false;
  let costOverrideApplied = false;

  for (const line of validLines) {
    // Effective sold units: shipped_qty if fulfilled, else ordered_qty
    const grossUnits = Math.max(0, line.shipped_qty > 0 ? line.shipped_qty : line.ordered_qty);
    const refundedUnits = Math.max(0, line.refunded_qty || 0);
    const netUnits = Math.max(0, grossUnits - refundedUnits);

    const lineGross = grossUnits * line.unit_price;
    const discount = Math.max(0, line.merchandise_discount || 0);
    const refund = Math.max(0, line.refunded_amount || 0);
    const credit = Math.max(0, line.credit_redeemed_allocated || 0);

    // B2B Net Sales = Gross Merchandise - Merchandise Discount - Refund
    // NOTE: Shipping and Tax are NEVER added. Credit redemption is payment settlement, NOT discount!
    const lineNet = Math.max(0, lineGross - discount - refund);

    totalGrossSubtotal += lineGross;
    totalDiscounts += discount;
    totalRefunds += refund;
    totalCreditRedeemed += credit;
    totalNetSales += lineNet;
    totalUnitsSold += netUnits;

    // Calculate Landed COGS for this line
    if (netUnits > 0) {
      const resolvedCost = resolveLineLandedCost(
        line,
        costRecords,
        costMaster?.override_landed_cost,
        costMaster?.override_effective_date
      );
      if (!resolvedCost) {
        hasMissingCost = true;
      } else {
        totalCogs += netUnits * resolvedCost.unitCost;
        if (resolvedCost.isOverride) {
          costOverrideApplied = true;
        }
      }
    }
  }

  // Round results safely
  const roundedNetSales = safeRound(totalNetSales, 2) ?? 0;
  const roundedRefunds = safeRound(totalRefunds, 2) ?? 0;
  const roundedDiscounts = safeRound(totalDiscounts, 2) ?? 0;
  const roundedCreditSettlement = safeRound(totalCreditRedeemed, 2) ?? 0;

  // 3. Build B2B Net Sales KPI
  const b2bNetSales: KpiResult<number> = {
    value: roundedNetSales,
    unit: "USD",
    period: periodObj,
    status: validLines.length > 0 ? "ACTUAL" : "ACTUAL",
    dataConfidence: 1.0,
    sourceBasis: `Aggregated from ${validLines.length} verified B2B order lines in retailer_orders/fulfillments.`,
    metadata: {
      grossMerchandiseSubtotal: safeRound(totalGrossSubtotal, 2),
      merchandiseDiscounts: roundedDiscounts,
      merchandiseRefunds: roundedRefunds,
      creditSettlementRedeemed: roundedCreditSettlement,
      validOrderLinesCount: validLines.length,
    },
  };

  // 4. Build Landed COGS KPI
  let landedCogs: KpiResult<number>;
  if (totalUnitsSold === 0) {
    landedCogs = {
      value: 0,
      unit: "USD",
      period: periodObj,
      status: "ACTUAL",
      dataConfidence: 1.0,
      sourceBasis: "Zero units sold in evaluation period.",
    };
  } else if (hasMissingCost) {
    landedCogs = {
      value: null,
      unit: "USD",
      period: periodObj,
      status: "UNAVAILABLE",
      dataConfidence: 0.0,
      sourceBasis: "Landed cost records missing in landed_cost_results and inventory_cost_layers.",
      missingInputReason: "No active landed cost or override cost found for one or more fulfilled order lines.",
    };
  } else {
    landedCogs = {
      value: safeRound(totalCogs, 2),
      unit: "USD",
      period: periodObj,
      status: "ACTUAL",
      dataConfidence: 1.0,
      sourceBasis: costOverrideApplied
        ? "Computed using product override landed cost."
        : "Computed from historical landed_cost_results and FIFO inventory_cost_layers.",
      metadata: {
        costOverrideApplied,
        unitsCosted: totalUnitsSold,
      },
    };
  }

  // 5. Build Gross Profit KPI
  let grossProfit: KpiResult<number>;
  if (landedCogs.value === null) {
    grossProfit = {
      value: null,
      unit: "USD",
      period: periodObj,
      status: "UNAVAILABLE",
      dataConfidence: 0.0,
      sourceBasis: "Gross Profit cannot be calculated without valid Landed COGS.",
      missingInputReason: landedCogs.missingInputReason,
    };
  } else {
    const profitVal = roundedNetSales - landedCogs.value;
    grossProfit = {
      value: safeRound(profitVal, 2),
      unit: "USD",
      period: periodObj,
      status: "ACTUAL",
      dataConfidence: 1.0,
      sourceBasis: "B2B Net Sales minus Landed COGS.",
    };
  }

  // 6. Build Gross Margin KPI
  let grossMargin: KpiResult<number>;
  if (grossProfit.value === null || roundedNetSales <= 0) {
    grossMargin = {
      value: null,
      unit: "PERCENT",
      period: periodObj,
      status: "UNAVAILABLE",
      dataConfidence: 0.0,
      sourceBasis: roundedNetSales <= 0
        ? "Gross Margin is undefined when Net Sales is zero."
        : "Gross Margin cannot be calculated without valid Gross Profit.",
      missingInputReason: roundedNetSales <= 0 ? "Zero B2B Net Sales" : grossProfit.missingInputReason,
    };
  } else {
    const marginRatio = safeDiv(grossProfit.value, roundedNetSales);
    grossMargin = {
      value: marginRatio !== null ? safeRound(marginRatio * 100, 2) : null,
      unit: "PERCENT",
      period: periodObj,
      status: "ACTUAL",
      dataConfidence: 1.0,
      sourceBasis: "((Gross Profit / B2B Net Sales) * 100)",
    };
  }

  // 7. Auxiliary KPIs
  const totalUnitsSoldKpi: KpiResult<number> = {
    value: totalUnitsSold,
    unit: "UNITS",
    period: periodObj,
    status: "ACTUAL",
    dataConfidence: 1.0,
    sourceBasis: "Net units shipped minus refunded units across valid order lines.",
  };

  const refundedAmountKpi: KpiResult<number> = {
    value: roundedRefunds,
    unit: "USD",
    period: periodObj,
    status: "ACTUAL",
    dataConfidence: 1.0,
    sourceBasis: "Total merchandise refund deductions.",
  };

  const merchandiseDiscountKpi: KpiResult<number> = {
    value: roundedDiscounts,
    unit: "USD",
    period: periodObj,
    status: "ACTUAL",
    dataConfidence: 1.0,
    sourceBasis: "Total merchandise promotional discounts.",
  };

  const creditSettlementKpi: KpiResult<number> = {
    value: roundedCreditSettlement,
    unit: "USD",
    period: periodObj,
    status: "ACTUAL",
    dataConfidence: 1.0,
    sourceBasis: "Exchange Credit redeemed at checkout (settlement Tender, not discount).",
  };

  return {
    b2bNetSales,
    landedCogs,
    grossProfit,
    grossMargin,
    totalUnitsSold: totalUnitsSoldKpi,
    refundedAmount: refundedAmountKpi,
    merchandiseDiscountAmount: merchandiseDiscountKpi,
    creditSettlementAmount: creditSettlementKpi,
  };
}
