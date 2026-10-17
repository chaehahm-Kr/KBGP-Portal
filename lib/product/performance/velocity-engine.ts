/**
 * Product Performance V2.0 — Velocity Engine
 * Task ID: ADM-SALES-PERF-003-R1
 * Location: lib/product/performance/velocity-engine.ts
 *
 * Implements:
 * - Actual B2B shipment velocity (Daily and Weekly run-rates from HQ fulfillments)
 * - Estimated Retailer sell-through (derived from weekly reports; strictly labeled ESTIMATED)
 * - Reporting interval qualification (expected vs actual reports, compliance rate, gaps)
 * - Replenishment adjustment (accounting for store receipts)
 * - Data confidence scoring (based on reporting compliance)
 */

import type {
  VelocityEngineInput,
  VelocityKpis,
  ReportingQualification,
  KpiResult,
} from "./types";
import { isWithinPeriod, safeDiv, safeRound } from "./helpers";

export function calculateVelocityKpis(input: VelocityEngineInput): VelocityKpis {
  const { period, product_id, orderLines, weeklyReports, storesTarget } = input;

  const periodObj = {
    start: period.periodStart,
    end: period.periodEnd,
  };

  const daysInPeriod = Math.max(1, period.daysInPeriod);
  const weeksInPeriod = Math.max(1, Math.round((daysInPeriod / 7) * 10) / 10);

  // -----------------------------------------------------------
  // 1. Actual B2B Shipment Velocity
  // -----------------------------------------------------------
  let totalB2bShippedUnits = 0;
  const seenLineIds = new Set<string>();

  for (const line of orderLines) {
    if (line.product_id !== product_id) continue;
    if (!isWithinPeriod(line.order_date, period)) continue;
    if (line.order_status.toUpperCase() === "CANCELLED") continue;

    if (seenLineIds.has(line.id)) continue;
    seenLineIds.add(line.id);

    const shipped = line.shipped_qty > 0 ? line.shipped_qty : line.ordered_qty;
    const refunded = line.refunded_qty || 0;
    totalB2bShippedUnits += Math.max(0, shipped - refunded);
  }

  const dailyVelocity = totalB2bShippedUnits / daysInPeriod;
  const weeklyVelocity = dailyVelocity * 7;

  const b2bShipmentVelocityDaily: KpiResult<number> = {
    value: safeRound(dailyVelocity, 2),
    unit: "UNITS",
    period: periodObj,
    status: "ACTUAL",
    dataConfidence: 1.0,
    sourceBasis: "Verified units fulfilled and shipped from HQ warehouse per calendar day.",
    metadata: {
      totalShippedUnitsInPeriod: totalB2bShippedUnits,
      daysInPeriod,
    },
  };

  const b2bShipmentVelocityWeekly: KpiResult<number> = {
    value: safeRound(weeklyVelocity, 2),
    unit: "UNITS",
    period: periodObj,
    status: "ACTUAL",
    dataConfidence: 1.0,
    sourceBasis: "Daily shipment velocity scaled to 7-day run rate.",
    metadata: {
      totalShippedUnitsInPeriod: totalB2bShippedUnits,
      weeksInPeriod,
    },
  };

  // -----------------------------------------------------------
  // 2. Reporting Interval Qualification
  // -----------------------------------------------------------
  // Determine target stores carrying this product
  let targetStoreIds = new Set<string>();
  if (storesTarget && storesTarget.length > 0) {
    storesTarget
      .filter((s) => s.is_active && s.carries_sku)
      .forEach((s) => targetStoreIds.add(s.store_id));
  } else {
    // If no target list is provided, infer target stores from weekly reports and order recipients
    weeklyReports
      .filter((r) => r.product_id === product_id)
      .forEach((r) => targetStoreIds.add(r.store_id));
  }

  const targetStoresCount = targetStoreIds.size;
  const numCalendarWeeks = Math.max(1, Math.ceil(daysInPeriod / 7));
  const expectedReportsCount = targetStoresCount * numCalendarWeeks;

  // Filter weekly reports within period for this product
  const validReports = weeklyReports.filter(
    (r) =>
      r.product_id === product_id &&
      r.week_start_date >= period.periodStart &&
      r.week_end_date <= period.periodEnd
  );

  const reportingStoreIds = new Set<string>();
  validReports.forEach((r) => reportingStoreIds.add(r.store_id));
  const reportingStoresCount = reportingStoreIds.size;

  const actualReportsCount = validReports.length;
  const complianceRateRaw = safeDiv(actualReportsCount, expectedReportsCount) ?? 0;
  const complianceRate = Math.min(1.0, Math.max(0, complianceRateRaw));
  const missingWeeksCount = Math.max(0, expectedReportsCount - actualReportsCount);

  // Confidence based on reporting compliance
  let dataConfidence = 1.0;
  let sellThroughStatus: "ESTIMATED" | "PARTIAL" | "UNAVAILABLE" = "ESTIMATED";

  if (actualReportsCount === 0 || targetStoresCount === 0) {
    dataConfidence = 0.0;
    sellThroughStatus = "UNAVAILABLE";
  } else if (complianceRate < 0.5) {
    dataConfidence = 0.3;
    sellThroughStatus = "PARTIAL";
  } else if (complianceRate < 0.85) {
    dataConfidence = 0.7;
    sellThroughStatus = "PARTIAL";
  } else {
    dataConfidence = 1.0;
    sellThroughStatus = "ESTIMATED";
  }

  const reportingQualification: KpiResult<ReportingQualification> = {
    value: {
      expectedReportsCount,
      actualReportsCount,
      complianceRate: safeRound(complianceRate, 2) ?? 0,
      missingWeeksCount,
      reportingStoresCount,
      totalTargetStoresCount: targetStoresCount,
    },
    unit: "COUNT",
    period: periodObj,
    status: "ACTUAL",
    dataConfidence: 1.0,
    sourceBasis: "Evaluated from submitted retailer_weekly_checks item intervals.",
  };

  // -----------------------------------------------------------
  // 3. Estimated Retailer Sell-Through & Replenishment
  // -----------------------------------------------------------
  let totalEstimatedSellThroughUnits = 0;
  let totalReplenishmentReceivedUnits = 0;

  for (const report of validReports) {
    const received = Math.max(0, report.received_units || 0);
    totalReplenishmentReceivedUnits += received;

    // Calculate store sell-through:
    // 1) Explicit sales_units reported
    // 2) Or stock balance change: beginning + received - ending
    if (report.sales_units !== null && report.sales_units !== undefined && report.sales_units >= 0) {
      totalEstimatedSellThroughUnits += report.sales_units;
    } else if (
      report.beginning_stock !== null &&
      report.beginning_stock !== undefined &&
      report.ending_stock !== null &&
      report.ending_stock !== undefined
    ) {
      const derivedSales = report.beginning_stock + received - report.ending_stock;
      totalEstimatedSellThroughUnits += Math.max(0, derivedSales);
    }
  }

  const replenishmentAdjustmentUnits: KpiResult<number> = {
    value: totalReplenishmentReceivedUnits,
    unit: "UNITS",
    period: periodObj,
    status: actualReportsCount > 0 ? "ACTUAL" : "UNAVAILABLE",
    dataConfidence,
    sourceBasis: "Total replenishment units received by stores reported in weekly inventory checks.",
    missingInputReason: actualReportsCount === 0 ? "No weekly reports submitted in period" : undefined,
  };

  let estimatedRetailerSellThroughUnits: KpiResult<number>;
  let estimatedRetailerSellThroughWeeklyRate: KpiResult<number>;

  if (sellThroughStatus === "UNAVAILABLE") {
    estimatedRetailerSellThroughUnits = {
      value: null,
      unit: "UNITS",
      period: periodObj,
      status: "UNAVAILABLE",
      dataConfidence: 0.0,
      sourceBasis: "No retailer weekly check submissions found for this product in evaluation period.",
      missingInputReason: "Missing retailer_weekly_checks submissions.",
    };

    estimatedRetailerSellThroughWeeklyRate = {
      value: null,
      unit: "UNITS",
      period: periodObj,
      status: "UNAVAILABLE",
      dataConfidence: 0.0,
      sourceBasis: "Cannot compute sell-through rate without weekly check submissions.",
      missingInputReason: "Missing retailer_weekly_checks submissions.",
    };
  } else {
    const weeklyRate = safeDiv(totalEstimatedSellThroughUnits, weeksInPeriod);

    estimatedRetailerSellThroughUnits = {
      value: totalEstimatedSellThroughUnits,
      unit: "UNITS",
      period: periodObj,
      status: sellThroughStatus,
      dataConfidence,
      sourceBasis:
        "Estimated from retailer weekly checks (inventory count delta adjusted for replenishment; not direct POS).",
      metadata: {
        reportingComplianceRate: safeRound(complianceRate * 100, 1),
        reportingStoresCount,
      },
    };

    estimatedRetailerSellThroughWeeklyRate = {
      value: weeklyRate !== null ? safeRound(weeklyRate, 1) : null,
      unit: "UNITS",
      period: periodObj,
      status: sellThroughStatus,
      dataConfidence,
      sourceBasis: "Estimated store sell-through units divided by number of reporting weeks in period.",
    };
  }

  return {
    b2bShipmentVelocityDaily,
    b2bShipmentVelocityWeekly,
    estimatedRetailerSellThroughUnits,
    estimatedRetailerSellThroughWeeklyRate,
    reportingQualification,
    replenishmentAdjustmentUnits,
  };
}
