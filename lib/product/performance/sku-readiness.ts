/**
 * Product Performance — SKU Data Readiness Engine & Contract
 * Task ID: ADM-GRADING-DATA-003
 * Location: lib/product/performance/sku-readiness.ts
 *
 * Implements the authoritative data readiness evaluation contract established
 * in ADM-GRADING-DATA-002-readiness-spec.md for Letusto internal investment support.
 *
 * CORE DATA RULES:
 * 1. First fulfilled B2B shipment is the operating-age anchor (Decision D1).
 * 2. Missing shipment evidence must NEVER default to product created_at.
 * 3. Historical landed cost (Tier 1/2) must be distinguished from static override (Tier 3).
 * 4. Missing inventory valuation must be shown as UNAVAILABLE, not $0.00 (Zero-Valuation Safeguard).
 * 5. Estimated retailer velocity must never be presented as POS data.
 * 6. Unobserved Exchange Risk remains UNOBSERVED before Day 100 (Decision D5).
 * 7. Missing data cannot produce a fabricated A/B/C/D grade.
 */

import { daysBetween } from "./helpers";
import type {
  LandedCostRecord,
  FifoInventoryLayer,
  ProductPerformanceKpis,
} from "./types";

export type CostProvenanceTier =
  | "TIER_1_VERIFIED"
  | "TIER_2_LAYER"
  | "TIER_3_OVERRIDE"
  | "TIER_4_UNAVAILABLE";

export type SkuOperatingStatus = "START_DATE_UNVERIFIED" | "NEW" | "MATURE";

export type SkuReadinessGate =
  | "START_DATE_UNVERIFIED"
  | "NEW_INCUBATION"
  | "BLOCKED_GAPS"
  | "READY_SIMULATION"
  | "READY_GRADING";

export interface SkuRemediationAction {
  team: "Procurement & Finance" | "Logistics & Ops" | "Merchandising & Retail Ops" | "Sales & BD";
  action: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  sla: string;
}

export interface SkuDataReadiness {
  // Operating Age & Commercial Lifecycle (Decision D1)
  operatingStatus: SkuOperatingStatus;
  firstShipmentDate: string | null;
  operatingAgeDays: number | null;
  isOperatingAnchorVerified: boolean;
  anchorNote: string;

  // Cost Provenance & Inventory Valuation (Decision D2 & Zero-Valuation Safeguard)
  costProvenanceTier: CostProvenanceTier;
  costProvenanceLabel: string;
  unitLandedCost: number | null;
  isCostOverride: boolean;
  isHistoricalCostVerified: boolean;
  inventoryUnitsOnHand: number;
  inventoryValuationUsd: number | null;
  inventoryValuationDisplay: string;
  isInventoryValuationPending: boolean;

  // Wholesale B2B Eligibility Gates
  completedOrdersCount: number;
  requiredOrders: number;
  isOrdersThresholdMet: boolean;
  distinctStoresCount: number;
  requiredStores: number;
  isStoresThresholdMet: boolean;

  // Retail Velocity & Exchange Risk
  weeklyStoreChecksCount: number;
  velocityLabel: string;
  isVelocityEstimated: boolean;
  exchangeRiskCohortAgeDays: number | null;
  isExchangeRiskObserved: boolean;
  exchangeRiskStatusDisplay: string;

  // Active Reason Codes & Overall Readiness Gate
  reasonCodes: string[];
  readinessGate: SkuReadinessGate;
  gateLabel: string;
  gateBadgeColor: string;

  // Quantitative Integrity Gauges
  dataCoveragePercent: number; // 0 - 100
  dataConfidencePercent: number; // 0 - 100

  // Actionable Remediation Plan
  remediationActions: SkuRemediationAction[];
}

export interface EvaluateReadinessParams {
  productId: string;
  firstShipmentDateOnProduct?: string | null;
  earliestFulfilledShipmentDate?: string | null;
  costRecords?: LandedCostRecord[];
  activeLayers?: FifoInventoryLayer[];
  overrideLandedCost?: number | null;
  overrideUpdatedAt?: string | null;
  onHandUnits?: number;
  kpis?: ProductPerformanceKpis;
  completedOrdersCount?: number;
  distinctStoresCount?: number;
  weeklyChecksCount?: number;
  maturedCohortDays?: number | null;
  asOfDate: string;
}

/**
 * Pure evaluator for SKU Data Readiness.
 */
export function evaluateSkuDataReadiness(params: EvaluateReadinessParams): SkuDataReadiness {
  const {
    firstShipmentDateOnProduct,
    earliestFulfilledShipmentDate,
    costRecords = [],
    activeLayers = [],
    overrideLandedCost,
    onHandUnits = 0,
    kpis,
    completedOrdersCount = 0,
    distinctStoresCount = 0,
    weeklyChecksCount = 0,
    maturedCohortDays = null,
    asOfDate,
  } = params;

  // 1. Operating Age & Anchor (DATA RULE 1 & 2)
  // First fulfilled B2B shipment is the anchor. Missing shipment NEVER defaults to created_at.
  let firstShipmentDate: string | null = null;
  let isAnchorVerified = false;
  let anchorNote = "";

  if (firstShipmentDateOnProduct && firstShipmentDateOnProduct.trim()) {
    firstShipmentDate = firstShipmentDateOnProduct.slice(0, 10);
    isAnchorVerified = true;
    anchorNote = `Verified first B2B shipment date stamped on product (${firstShipmentDate}).`;
  } else if (earliestFulfilledShipmentDate && earliestFulfilledShipmentDate.trim()) {
    firstShipmentDate = earliestFulfilledShipmentDate.slice(0, 10);
    isAnchorVerified = true;
    anchorNote = `Derived from earliest fulfilled B2B shipment record (${firstShipmentDate}). Linkage pending product header stamp.`;
  } else {
    firstShipmentDate = null;
    isAnchorVerified = false;
    anchorNote = "Unverified: Zero completed wholesale B2B shipments recorded in database. Operating age cannot be calculated (N/A) until first completed shipment occurs. Non-negotiable rule: Missing wholesale shipment records NEVER default to product catalog creation date.";
  }

  const operatingAgeDays = isAnchorVerified && firstShipmentDate ? Math.max(0, daysBetween(firstShipmentDate, asOfDate)) : null;

  let operatingStatus: SkuOperatingStatus = "START_DATE_UNVERIFIED";
  if (!isAnchorVerified || operatingAgeDays === null) {
    operatingStatus = "START_DATE_UNVERIFIED";
  } else if (operatingAgeDays < 60) {
    operatingStatus = "NEW";
  } else {
    operatingStatus = "MATURE";
  }

  // 2. Cost Provenance Tiers (DATA RULE 3)
  let costProvenanceTier: CostProvenanceTier = "TIER_4_UNAVAILABLE";
  let costProvenanceLabel = "Missing Cost (Tier 4)";
  let unitLandedCost: number | null = null;
  let isCostOverride = false;
  let isHistoricalCostVerified = false;

  const verifiedFinal = costRecords.find((r) => r.cost_status === "FINAL" && r.unit_landed_cost > 0);
  const activeLayerWithCost = activeLayers.find((l) => l.unit_landed_cost > 0);

  if (verifiedFinal) {
    costProvenanceTier = "TIER_1_VERIFIED";
    costProvenanceLabel = `Tier 1: Verified Historical Landed Cost ($${verifiedFinal.unit_landed_cost.toFixed(2)})`;
    unitLandedCost = verifiedFinal.unit_landed_cost;
    isHistoricalCostVerified = true;
  } else if (activeLayerWithCost) {
    costProvenanceTier = "TIER_2_LAYER";
    costProvenanceLabel = `Tier 2: Current Inventory Layer Cost ($${activeLayerWithCost.unit_landed_cost.toFixed(2)})`;
    unitLandedCost = activeLayerWithCost.unit_landed_cost;
    isHistoricalCostVerified = false; // Current layer reflects holding cost, not proof of historical transaction cost
  } else if (overrideLandedCost !== null && overrideLandedCost !== undefined && Number(overrideLandedCost) > 0) {
    costProvenanceTier = "TIER_3_OVERRIDE";
    costProvenanceLabel = `Tier 3: Provisional Product Override ($${Number(overrideLandedCost).toFixed(2)})`;
    unitLandedCost = Number(overrideLandedCost);
    isCostOverride = true;
    isHistoricalCostVerified = false; // Catalog override is provisional, not proof of historical transaction cost
  } else {
    costProvenanceTier = "TIER_4_UNAVAILABLE";
    costProvenanceLabel = "Tier 4: Landed Cost Missing ($0.00 / Pending)";
    unitLandedCost = null;
    isCostOverride = false;
    isHistoricalCostVerified = false;
  }

  // 3. Inventory Valuation & Zero-Valuation Safeguard (DATA RULE 4)
  const actualOnHand = kpis?.inventory?.hqAvailableUnits?.value ?? onHandUnits;
  const kpiValuation = kpis?.inventory?.hqInventoryValue?.value;
  let inventoryValuationUsd: number | null = null;
  let inventoryValuationDisplay = "$0.00";
  let isInventoryValuationPending = false;

  if (actualOnHand === 0) {
    inventoryValuationUsd = 0;
    inventoryValuationDisplay = "$0.00 (Zero Stock)";
    isInventoryValuationPending = false;
  } else if (costProvenanceTier === "TIER_4_UNAVAILABLE") {
    // Zero-Valuation Safeguard: NEVER report $0.00 for on-hand stock with missing cost
    inventoryValuationUsd = null;
    inventoryValuationDisplay = "PENDING COST VERIFICATION (N/A)";
    isInventoryValuationPending = true;
  } else if (kpiValuation !== null && kpiValuation !== undefined) {
    inventoryValuationUsd = kpiValuation;
    inventoryValuationDisplay = `$${kpiValuation.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (costProvenanceTier === "TIER_3_OVERRIDE") {
      inventoryValuationDisplay += " (Provisional)";
    }
  } else if (unitLandedCost !== null) {
    inventoryValuationUsd = actualOnHand * unitLandedCost;
    inventoryValuationDisplay = `$${inventoryValuationUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (costProvenanceTier === "TIER_3_OVERRIDE") {
      inventoryValuationDisplay += " (Provisional)";
    }
  } else {
    inventoryValuationUsd = null;
    inventoryValuationDisplay = "PENDING COST VERIFICATION (N/A)";
    isInventoryValuationPending = true;
  }

  // 4. Wholesale B2B Eligibility Gates
  const requiredOrders = 3;
  const requiredStores = 3;
  const isOrdersThresholdMet = completedOrdersCount >= requiredOrders;
  const isStoresThresholdMet = distinctStoresCount >= requiredStores;

  // 5. Retail Velocity & Exchange Risk (DATA RULES 5 & 6)
  const velocityLabel = "Estimated Retail Movement (Store Checks — Not POS Data)";
  const isVelocityEstimated = true;

  let isExchangeRiskObserved = false;
  let exchangeRiskStatusDisplay = "UNOBSERVED (Trial Window Active; Day 100 Pending)";

  if (maturedCohortDays !== null && maturedCohortDays >= 100) {
    isExchangeRiskObserved = true;
    const storeCount = kpis?.exchange?.uniqueClaimingStoreCount?.value ?? 0;
    exchangeRiskStatusDisplay = `${storeCount} claiming stores (Matured Cohort >= 100d)`;
  }

  // 6. Active Reason Codes
  const reasonCodes: string[] = [];

  if (!isAnchorVerified) {
    reasonCodes.push("ERR_START_DATE_UNVERIFIED");
  } else if (!firstShipmentDateOnProduct && earliestFulfilledShipmentDate) {
    reasonCodes.push("ERR_SHIPMENT_UNLINKED");
  }

  if (costProvenanceTier === "TIER_4_UNAVAILABLE") {
    reasonCodes.push("ERR_COST_MISSING");
  } else if (costProvenanceTier === "TIER_3_OVERRIDE") {
    reasonCodes.push("ERR_COST_OVERRIDE_UNBOUND");
  } else if (costProvenanceTier === "TIER_2_LAYER") {
    reasonCodes.push("ERR_HISTORICAL_COST_UNLINKED");
  }

  if (completedOrdersCount < requiredOrders) {
    reasonCodes.push("ERR_INSUFFICIENT_ORDERS");
  }

  if (distinctStoresCount < requiredStores) {
    reasonCodes.push("ERR_INSUFFICIENT_STORES");
  }

  if (weeklyChecksCount < 4) {
    reasonCodes.push("ERR_WEEKLY_CHECKS_SPARSE");
  }

  if (!isExchangeRiskObserved) {
    reasonCodes.push("ERR_COHORT_PRE_MATURE");
  }

  // 7. Overall Readiness Gate
  let readinessGate: SkuReadinessGate = "BLOCKED_GAPS";
  let gateLabel = "BLOCKED: DATA GAPS";
  let gateBadgeColor = "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50";

  if (operatingStatus === "START_DATE_UNVERIFIED") {
    readinessGate = "START_DATE_UNVERIFIED";
    gateLabel = "START_DATE_UNVERIFIED (N/A)";
    gateBadgeColor = "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700";
  } else if (operatingStatus === "NEW") {
    readinessGate = "NEW_INCUBATION";
    gateLabel = `NEW (${operatingAgeDays}d)`;
    gateBadgeColor = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50";
  } else if (
    isHistoricalCostVerified &&
    isOrdersThresholdMet &&
    isStoresThresholdMet &&
    weeklyChecksCount >= 4
  ) {
    readinessGate = "READY_GRADING";
    gateLabel = "READY FOR GRADING";
    gateBadgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50";
  } else if (costProvenanceTier !== "TIER_4_UNAVAILABLE" && completedOrdersCount >= 1) {
    readinessGate = "READY_SIMULATION";
    gateLabel = "READY: SIMULATION ONLY";
    gateBadgeColor = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50";
  } else {
    readinessGate = "BLOCKED_GAPS";
    if (costProvenanceTier === "TIER_4_UNAVAILABLE") {
      gateLabel = "BLOCKED: MISSING COST";
      gateBadgeColor = "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50";
    } else {
      gateLabel = "BLOCKED: ORDERS/STORES";
      gateBadgeColor = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50";
    }
  }

  // 8. Quantitative Integrity Gauges
  // Data Coverage: 6 dimensions (Anchor 15%, Cost 25%, Inventory 20%, Orders 15%, Stores 15%, Checks 10%)
  let coverage = 0;
  if (isAnchorVerified) coverage += 15;
  if (costProvenanceTier === "TIER_1_VERIFIED" || costProvenanceTier === "TIER_2_LAYER") {
    coverage += 25;
  } else if (costProvenanceTier === "TIER_3_OVERRIDE") {
    coverage += 10;
  }

  if (actualOnHand === 0) {
    coverage += 20; // 0 units is a completely verified zero balance
  } else if (!isInventoryValuationPending) {
    coverage += 20;
  }

  if (completedOrdersCount >= requiredOrders) {
    coverage += 15;
  } else if (completedOrdersCount > 0) {
    coverage += Math.round((completedOrdersCount / requiredOrders) * 15);
  }

  if (distinctStoresCount >= requiredStores) {
    coverage += 15;
  } else if (distinctStoresCount > 0) {
    coverage += Math.round((distinctStoresCount / requiredStores) * 15);
  }

  if (weeklyChecksCount >= 4) {
    coverage += 10;
  } else if (weeklyChecksCount > 0) {
    coverage += Math.round((weeklyChecksCount / 4) * 10);
  }

  const dataCoveragePercent = Math.min(100, Math.max(0, coverage));
  const dataConfidencePercent = Math.round(
    ((kpis?.asOfTimestamp ? 0.95 : 0.85) * (dataCoveragePercent / 100)) * 100
  );

  // 9. Actionable Remediation Plan
  const remediationActions: SkuRemediationAction[] = [];

  if (reasonCodes.includes("ERR_COST_MISSING")) {
    remediationActions.push({
      team: "Procurement & Finance",
      action: "Ingest verified supplier bill of lading and customs invoice into landed_cost_results.",
      priority: "CRITICAL",
      sla: "10 Business Days",
    });
  }

  if (reasonCodes.includes("ERR_COST_OVERRIDE_UNBOUND")) {
    remediationActions.push({
      team: "Procurement & Finance",
      action: "Audit static override landed cost effective date against historical B2B orders.",
      priority: "HIGH",
      sla: "5 Business Days",
    });
  }

  if (reasonCodes.includes("ERR_SHIPMENT_UNLINKED")) {
    remediationActions.push({
      team: "Logistics & Ops",
      action: "Stamp products.first_shipment_date from earliest retailer_order_fulfillments record.",
      priority: "HIGH",
      sla: "3 Business Days",
    });
  }

  if (reasonCodes.includes("ERR_INSUFFICIENT_ORDERS")) {
    remediationActions.push({
      team: "Sales & BD",
      action: `Secure ${requiredOrders - completedOrdersCount} additional completed B2B purchase orders.`,
      priority: "HIGH",
      sla: "30-Day Cycle",
    });
  }

  if (reasonCodes.includes("ERR_INSUFFICIENT_STORES")) {
    remediationActions.push({
      team: "Sales & BD",
      action: `Expand retail door distribution to ${requiredStores - distinctStoresCount} additional distinct stores.`,
      priority: "HIGH",
      sla: "30-Day Cycle",
    });
  }

  if (reasonCodes.includes("ERR_WEEKLY_CHECKS_SPARSE")) {
    remediationActions.push({
      team: "Merchandising & Retail Ops",
      action: "Collect weekly store inventory check submissions from active retail accounts.",
      priority: "MEDIUM",
      sla: "Weekly Recurring",
    });
  }

  if (reasonCodes.includes("ERR_HISTORICAL_COST_UNLINKED")) {
    remediationActions.push({
      team: "Procurement & Finance",
      action: "Link current inventory layer to historical customs and freight documentation.",
      priority: "HIGH",
      sla: "5 Business Days",
    });
  }

  if (reasonCodes.includes("ERR_START_DATE_UNVERIFIED")) {
    remediationActions.push({
      team: "Sales & BD",
      action: "Initiate wholesale retailer sampling and promotional outreach to commence commercial life.",
      priority: "MEDIUM",
      sla: "Planned Launch",
    });
  }

  return {
    operatingStatus,
    firstShipmentDate,
    operatingAgeDays,
    isOperatingAnchorVerified: isAnchorVerified,
    anchorNote,

    costProvenanceTier,
    costProvenanceLabel,
    unitLandedCost,
    isCostOverride,
    isHistoricalCostVerified,
    inventoryUnitsOnHand: actualOnHand,
    inventoryValuationUsd,
    inventoryValuationDisplay,
    isInventoryValuationPending,

    completedOrdersCount,
    requiredOrders,
    isOrdersThresholdMet,
    distinctStoresCount,
    requiredStores,
    isStoresThresholdMet,

    weeklyStoreChecksCount: weeklyChecksCount,
    velocityLabel,
    isVelocityEstimated,
    exchangeRiskCohortAgeDays: maturedCohortDays,
    isExchangeRiskObserved,
    exchangeRiskStatusDisplay,

    reasonCodes,
    readinessGate,
    gateLabel,
    gateBadgeColor,

    dataCoveragePercent,
    dataConfidencePercent,
    remediationActions,
  };
}

/**
 * Filter predicate helper for readiness-based table filtering.
 */
export function matchesReadinessFilter(readiness: SkuDataReadiness, filterKey: string): boolean {
  if (!filterKey || filterKey === "ALL") return true;

  switch (filterKey) {
    case "COST_MISSING":
      return readiness.costProvenanceTier === "TIER_4_UNAVAILABLE";
    case "COST_OVERRIDE":
      return readiness.costProvenanceTier === "TIER_3_OVERRIDE";
    case "START_DATE_UNVERIFIED":
    case "UNCOMMENCED":
      return readiness.operatingStatus === "START_DATE_UNVERIFIED";
    case "NEW_INCUBATION":
      return readiness.operatingStatus === "NEW";
    case "INSUFFICIENT_ORDERS":
      return !readiness.isOrdersThresholdMet;
    case "INSUFFICIENT_STORES":
      return !readiness.isStoresThresholdMet;
    case "VALUATION_PENDING":
      return readiness.isInventoryValuationPending;
    case "READY_SIMULATION":
      return readiness.readinessGate === "READY_SIMULATION" || readiness.readinessGate === "READY_GRADING";
    default:
      return true;
  }
}
