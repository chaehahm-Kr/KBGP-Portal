/**
 * Product Performance V2.0 — Phase 1 Master KPI Calculation Engine
 * Task ID: ADM-SALES-PERF-003-R1
 * Location: lib/product/performance/master-engine.ts
 */

import type {
  EvaluationPeriod,
  FinancialOrderLine,
  LandedCostRecord,
  ProductCostMaster,
  FifoInventoryLayer,
  HqInventorySnapshot,
  RetailerWeeklyReportLine,
  StoreCoverageTarget,
  ExchangeClaimRecord,
  StoreCohortEligibilityRecord,
  ProductPerformanceKpis,
} from "./types";

import { calculateFinancialKpis } from "./financial-engine";
import { calculateInventoryKpis } from "./inventory-engine";
import { calculateVelocityKpis } from "./velocity-engine";
import { calculateExchangeFrequencyKpis } from "./exchange-frequency-engine";

export interface MasterProductPerformanceInput {
  period: EvaluationPeriod;
  product_id: string;
  financial: {
    orderLines: FinancialOrderLine[];
    costRecords: LandedCostRecord[];
    costMaster?: ProductCostMaster;
  };
  inventory: {
    activeLayers: FifoInventoryLayer[];
    historicalSnapshots?: HqInventorySnapshot[];
    currentAvailableUnits?: number | null;
    fallbackUnitLandedCost?: number | null;
  };
  velocity: {
    weeklyReports: RetailerWeeklyReportLine[];
    storesTarget?: StoreCoverageTarget[];
  };
  exchange: {
    claimRecords: ExchangeClaimRecord[];
    eligibilityRecords: StoreCohortEligibilityRecord[];
  };
}

/**
 * Master calculation function for Product Performance V2.0.
 * Coordinates Financial, Velocity, Inventory, and Exchange engines deterministically.
 */
export function calculateProductPerformanceKpis(
  input: MasterProductPerformanceInput
): ProductPerformanceKpis {
  const { period, product_id, financial, inventory, velocity, exchange } = input;

  // 1. Calculate Financial KPIs
  const financialKpis = calculateFinancialKpis({
    period,
    product_id,
    orderLines: financial.orderLines,
    costRecords: financial.costRecords,
    costMaster: financial.costMaster,
  });

  // 2. Calculate Velocity KPIs
  const velocityKpis = calculateVelocityKpis({
    period,
    product_id,
    orderLines: financial.orderLines,
    weeklyReports: velocity.weeklyReports,
    storesTarget: velocity.storesTarget,
  });

  // 3. Calculate Inventory KPIs (linking Landed COGS and Daily Velocity)
  const inventoryKpis = calculateInventoryKpis({
    period,
    product_id,
    activeLayers: inventory.activeLayers,
    historicalSnapshots: inventory.historicalSnapshots,
    currentAvailableUnits: inventory.currentAvailableUnits,
    periodLandedCogs: financialKpis.landedCogs.value,
    periodGrossProfit: financialKpis.grossProfit.value,
    dailyShipmentVelocity: velocityKpis.b2bShipmentVelocityDaily.value,
    fallbackUnitLandedCost: inventory.fallbackUnitLandedCost,
  });

  // 4. Calculate Exchange Frequency KPIs
  const exchangeKpis = calculateExchangeFrequencyKpis({
    period,
    product_id,
    claimRecords: exchange.claimRecords,
    eligibilityRecords: exchange.eligibilityRecords,
  });

  return {
    product_id,
    period,
    financial: financialKpis,
    inventory: inventoryKpis,
    velocity: velocityKpis,
    exchange: exchangeKpis,
    asOfTimestamp: new Date().toISOString(),
  };
}
