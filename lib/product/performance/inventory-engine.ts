/**
 * Product Performance V2.0 — Inventory Engine
 * Task ID: ADM-SALES-PERF-003-R1
 * Location: lib/product/performance/inventory-engine.ts
 *
 * Implements:
 * - HQ Inventory Value (active FIFO layers; strictly HQ warehouse, no retailer stock)
 * - FIFO-assumed Inventory Aging (weighted average days and bracket distribution)
 * - Inventory Turnover (COGS / Average Inventory Value)
 * - DIO (Days Inventory Outstanding: Average Inventory / COGS * daysInPeriod)
 * - Days of Supply (Current Available Units / Daily Shipment Velocity)
 * - GMROI (Gross Profit / Average Inventory Value)
 */

import type {
  InventoryEngineInput,
  InventoryKpis,
  InventoryAgingBracket,
  InventoryAgingProfile,
  FifoInventoryLayer,
  KpiResult,
} from "./types";
import { daysBetween, safeDiv, safeRound } from "./helpers";

const BRACKET_DEFINITIONS = [
  { label: "0-30 days", minDays: 0, maxDays: 30 },
  { label: "31-60 days", minDays: 31, maxDays: 60 },
  { label: "61-90 days", minDays: 61, maxDays: 90 },
  { label: "91-120 days", minDays: 91, maxDays: 120 },
  { label: "121+ days", minDays: 121, maxDays: null },
];

export function calculateInventoryKpis(input: InventoryEngineInput): InventoryKpis {
  const {
    period,
    product_id,
    activeLayers,
    historicalSnapshots,
    currentAvailableUnits,
    periodLandedCogs,
    periodGrossProfit,
    dailyShipmentVelocity,
    fallbackUnitLandedCost,
  } = input;

  const periodObj = {
    start: period.periodStart,
    end: period.periodEnd,
  };

  // Filter active layers for this product with remaining_qty > 0
  const productLayers = (activeLayers || []).filter(
    (l) => l.product_id === product_id && l.remaining_qty > 0 && l.status.toUpperCase() !== "DEPLETED"
  );

  // 1. HQ Inventory Units & Value
  let totalAvailableUnits = 0;
  let totalHqInventoryValue = 0;
  let hasValidLayerCosts = productLayers.length > 0;

  if (productLayers.length > 0) {
    for (const layer of productLayers) {
      totalAvailableUnits += layer.remaining_qty;
      const unitCost = layer.unit_landed_cost > 0 ? layer.unit_landed_cost : (fallbackUnitLandedCost || 0);
      if (unitCost <= 0) {
        hasValidLayerCosts = false;
      }
      totalHqInventoryValue += layer.remaining_qty * unitCost;
    }
  } else if (currentAvailableUnits !== null && currentAvailableUnits !== undefined && currentAvailableUnits > 0) {
    totalAvailableUnits = currentAvailableUnits;
    if (fallbackUnitLandedCost !== null && fallbackUnitLandedCost !== undefined && fallbackUnitLandedCost > 0) {
      totalHqInventoryValue = currentAvailableUnits * fallbackUnitLandedCost;
      hasValidLayerCosts = true;
    } else {
      hasValidLayerCosts = false;
    }
  }

  const hqAvailableUnitsKpi: KpiResult<number> = {
    value: totalAvailableUnits,
    unit: "UNITS",
    period: periodObj,
    status: "ACTUAL",
    dataConfidence: 1.0,
    sourceBasis: "Sum of remaining_qty across active HQ warehouse inventory layers (inventory_balances).",
  };

  let hqInventoryValueKpi: KpiResult<number>;
  if (totalAvailableUnits === 0) {
    hqInventoryValueKpi = {
      value: 0,
      unit: "USD",
      period: periodObj,
      status: "ACTUAL",
      dataConfidence: 1.0,
      sourceBasis: "Zero units currently available in HQ inventory.",
    };
  } else if (!hasValidLayerCosts) {
    hqInventoryValueKpi = {
      value: null,
      unit: "USD",
      period: periodObj,
      status: "UNAVAILABLE",
      dataConfidence: 0.0,
      sourceBasis: "Landed cost missing for available inventory layers in inventory_cost_layers.",
      missingInputReason: "No unit_landed_cost found for active inventory layers.",
    };
  } else {
    hqInventoryValueKpi = {
      value: safeRound(totalHqInventoryValue, 2),
      unit: "USD",
      period: periodObj,
      status: "ACTUAL",
      dataConfidence: 1.0,
      sourceBasis: "Valued using FIFO inventory_cost_layers at HQ warehouse.",
    };
  }

  // 2. FIFO Inventory Aging Calculation
  let fifoInventoryAgingKpi: KpiResult<InventoryAgingProfile>;
  if (productLayers.length === 0 || totalAvailableUnits === 0) {
    const emptyProfile: InventoryAgingProfile = {
      weightedAverageAgeDays: null,
      brackets: BRACKET_DEFINITIONS.map((b) => ({
        label: b.label,
        minDays: b.minDays,
        maxDays: b.maxDays,
        units: 0,
        valueUsd: 0,
        percentOfTotalUnits: 0,
      })),
      oldestLayerAgeDays: null,
      newestLayerAgeDays: null,
    };
    fifoInventoryAgingKpi = {
      value: emptyProfile,
      unit: "DAYS",
      period: periodObj,
      status: totalAvailableUnits === 0 ? "ACTUAL" : "UNAVAILABLE",
      dataConfidence: totalAvailableUnits === 0 ? 1.0 : 0.0,
      sourceBasis: totalAvailableUnits === 0 ? "Zero inventory available to age." : "No layer receipt dates available.",
    };
  } else {
    let totalWeightedDays = 0;
    let oldestAge = -Infinity;
    let newestAge = Infinity;

    const bracketTotals = BRACKET_DEFINITIONS.map((b) => ({
      ...b,
      units: 0,
      valueUsd: 0,
    }));

    for (const layer of productLayers) {
      const ageDays = daysBetween(layer.received_date, period.asOfDate);
      totalWeightedDays += layer.remaining_qty * ageDays;
      if (ageDays > oldestAge) oldestAge = ageDays;
      if (ageDays < newestAge) newestAge = ageDays;

      const layerVal = layer.remaining_qty * (layer.unit_landed_cost || fallbackUnitLandedCost || 0);

      // Bucket into bracket
      for (const b of bracketTotals) {
        if (b.maxDays === null) {
          if (ageDays >= b.minDays) {
            b.units += layer.remaining_qty;
            b.valueUsd += layerVal;
            break;
          }
        } else {
          if (ageDays >= b.minDays && ageDays <= b.maxDays) {
            b.units += layer.remaining_qty;
            b.valueUsd += layerVal;
            break;
          }
        }
      }
    }

    const weightedAvg = safeDiv(totalWeightedDays, totalAvailableUnits);
    const roundedAvg = weightedAvg !== null ? safeRound(weightedAvg, 1) : null;

    const brackets: InventoryAgingBracket[] = bracketTotals.map((b) => ({
      label: b.label,
      minDays: b.minDays,
      maxDays: b.maxDays,
      units: b.units,
      valueUsd: safeRound(b.valueUsd, 2) ?? 0,
      percentOfTotalUnits: safeRound((b.units / totalAvailableUnits) * 100, 1) ?? 0,
    }));

    fifoInventoryAgingKpi = {
      value: {
        weightedAverageAgeDays: roundedAvg,
        brackets,
        oldestLayerAgeDays: oldestAge !== -Infinity ? oldestAge : null,
        newestLayerAgeDays: newestAge !== Infinity ? newestAge : null,
      },
      unit: "DAYS",
      period: periodObj,
      status: "ACTUAL",
      dataConfidence: 1.0,
      sourceBasis: "Computed from FIFO receipt dates in inventory_cost_layers against asOfDate.",
    };
  }

  // 3. Average Inventory Value
  // OWNER-APPROVED RULE:
  // Official Inventory Turnover, DIO, and GMROI require verifiable historical average HQ inventory.
  // Never silently substitute ending inventory for average inventory in official KPIs.
  let averageInventoryValueKpi: KpiResult<number>;
  const validSnapshots = (historicalSnapshots || []).filter(
    (s) => s.valuation_usd !== null && s.valuation_usd !== undefined && s.valuation_usd >= 0
  );

  if (validSnapshots.length >= 2) {
    const sumVal = validSnapshots.reduce((acc, s) => acc + (s.valuation_usd || 0), 0);
    const avg = sumVal / validSnapshots.length;
    averageInventoryValueKpi = {
      value: safeRound(avg, 2),
      unit: "USD",
      period: periodObj,
      status: "ACTUAL",
      dataConfidence: 1.0,
      sourceBasis: `Arithmetic average of ${validSnapshots.length} historical inventory valuation snapshots.`,
    };
  } else {
    averageInventoryValueKpi = {
      value: null,
      unit: "USD",
      period: periodObj,
      status: "UNAVAILABLE",
      dataConfidence: 0.0,
      sourceBasis:
        "Historical average inventory cannot be established without at least 2 periodic valuation snapshots (e.g. beginning and ending).",
      missingInputReason:
        "Insufficient historical inventory snapshots to calculate true average inventory (requires >= 2 periodic snapshots).",
      metadata: {
        endingInventoryValuationProxy: hqInventoryValueKpi.value,
      },
    };
  }

  const avgInvVal = averageInventoryValueKpi.value;

  // 4. Inventory Turnover: Period Landed COGS / Average Inventory Value
  let inventoryTurnoverKpi: KpiResult<number>;
  if (
    periodLandedCogs === null ||
    periodLandedCogs === undefined ||
    avgInvVal === null ||
    avgInvVal <= 0
  ) {
    inventoryTurnoverKpi = {
      value: null,
      unit: "RATIO",
      period: periodObj,
      status: "UNAVAILABLE",
      dataConfidence: 0.0,
      sourceBasis: avgInvVal === 0
        ? "Turnover is undefined when average inventory value is zero."
        : "Turnover cannot be calculated without valid Landed COGS and Average Inventory Value.",
      missingInputReason: avgInvVal === 0 ? "Zero average inventory value" : "Missing COGS or inventory valuation",
    };
  } else {
    const periodTurnover = safeDiv(periodLandedCogs, avgInvVal);
    const annualizedTurnover = periodTurnover !== null ? periodTurnover * (365 / period.daysInPeriod) : null;
    inventoryTurnoverKpi = {
      value: periodTurnover !== null ? safeRound(periodTurnover, 2) : null,
      unit: "RATIO",
      period: periodObj,
      status: "ACTUAL",
      dataConfidence: averageInventoryValueKpi.status === "ACTUAL" ? 1.0 : 0.8,
      sourceBasis: "Period Landed COGS divided by Average Inventory Value.",
      metadata: {
        annualizedTurnover: annualizedTurnover !== null ? safeRound(annualizedTurnover, 2) : null,
        periodDays: period.daysInPeriod,
      },
    };
  }

  // 5. DIO (Days Inventory Outstanding): (Average Inventory Value / Period Landed COGS) * daysInPeriod
  let dioDaysKpi: KpiResult<number>;
  if (
    periodLandedCogs === null ||
    periodLandedCogs === undefined ||
    periodLandedCogs <= 0 ||
    avgInvVal === null
  ) {
    dioDaysKpi = {
      value: null,
      unit: "DAYS",
      period: periodObj,
      status: "UNAVAILABLE",
      dataConfidence: 0.0,
      sourceBasis: periodLandedCogs === 0
        ? "DIO is undefined when Period Landed COGS is zero."
        : "DIO requires valid Landed COGS and Average Inventory Value.",
      missingInputReason: periodLandedCogs === 0 ? "Zero Period Landed COGS" : "Missing COGS or inventory valuation",
    };
  } else {
    const dioRatio = safeDiv(avgInvVal, periodLandedCogs);
    const dioVal = dioRatio !== null ? dioRatio * period.daysInPeriod : null;
    dioDaysKpi = {
      value: dioVal !== null ? safeRound(dioVal, 1) : null,
      unit: "DAYS",
      period: periodObj,
      status: "ACTUAL",
      dataConfidence: averageInventoryValueKpi.status === "ACTUAL" ? 1.0 : 0.8,
      sourceBasis: "(Average Inventory Value / Period Landed COGS) * Days In Period.",
    };
  }

  // 6. Days of Supply: Current Available Units / Daily Run Rate
  let daysOfSupplyKpi: KpiResult<number>;
  if (
    dailyShipmentVelocity === null ||
    dailyShipmentVelocity === undefined ||
    dailyShipmentVelocity <= 0 ||
    totalAvailableUnits <= 0
  ) {
    daysOfSupplyKpi = {
      value: totalAvailableUnits === 0 ? 0 : null,
      unit: "DAYS",
      period: periodObj,
      status: totalAvailableUnits === 0 ? "ACTUAL" : "UNAVAILABLE",
      dataConfidence: totalAvailableUnits === 0 ? 1.0 : 0.0,
      sourceBasis: totalAvailableUnits === 0
        ? "Zero available units in stock (0 days of supply)."
        : "Days of Supply is undefined when daily shipment velocity is zero.",
      missingInputReason: totalAvailableUnits > 0 ? "Zero daily shipment velocity in period" : undefined,
    };
  } else {
    const dos = safeDiv(totalAvailableUnits, dailyShipmentVelocity);
    daysOfSupplyKpi = {
      value: dos !== null ? safeRound(dos, 1) : null,
      unit: "DAYS",
      period: periodObj,
      status: "ACTUAL",
      dataConfidence: 1.0,
      sourceBasis: "Current Available HQ Units divided by Daily B2B Shipment Velocity.",
    };
  }

  // 7. GMROI (Gross Margin Return on Inventory): Period Gross Profit / Average Inventory Value
  let gmroiKpi: KpiResult<number>;
  if (
    periodGrossProfit === null ||
    periodGrossProfit === undefined ||
    avgInvVal === null ||
    avgInvVal <= 0
  ) {
    gmroiKpi = {
      value: null,
      unit: "RATIO",
      period: periodObj,
      status: "UNAVAILABLE",
      dataConfidence: 0.0,
      sourceBasis: avgInvVal === 0
        ? "GMROI is undefined when average inventory value is zero."
        : "GMROI cannot be calculated without valid Gross Profit and Average Inventory Value.",
      missingInputReason: avgInvVal === 0 ? "Zero average inventory value" : "Missing Gross Profit or inventory valuation",
    };
  } else {
    const gmroiVal = safeDiv(periodGrossProfit, avgInvVal);
    gmroiKpi = {
      value: gmroiVal !== null ? safeRound(gmroiVal, 2) : null,
      unit: "RATIO",
      period: periodObj,
      status: "ACTUAL",
      dataConfidence: averageInventoryValueKpi.status === "ACTUAL" ? 1.0 : 0.8,
      sourceBasis: "Period Gross Profit divided by Average Inventory Value.",
    };
  }

  return {
    hqInventoryValue: hqInventoryValueKpi,
    hqAvailableUnits: hqAvailableUnitsKpi,
    averageInventoryValue: averageInventoryValueKpi,
    fifoInventoryAging: fifoInventoryAgingKpi,
    inventoryTurnover: inventoryTurnoverKpi,
    dioDays: dioDaysKpi,
    daysOfSupply: daysOfSupplyKpi,
    gmroi: gmroiKpi,
  };
}
