/**
 * Product Performance V2.0 — Exchange Frequency Engine
 * Task ID: ADM-SALES-PERF-003-R1
 * Location: lib/product/performance/exchange-frequency-engine.ts
 *
 * Implements:
 * - Unique claiming Store count (distinct store_id with valid claims)
 * - Eligible Store cohort count (distinct stores eligible >= 100 days)
 * - Claiming Store rate (Unique Claiming Stores / Eligible Store Cohort Count)
 * - Claim quantity & total claimed dollar value
 * - Exposure by lifecycle status (SUBMITTED, UNDER_REVIEW, APPROVED, RMA_INSPECTED, SETTLED, REJECTED, CANCELLED)
 * - Separation of frequency (counts/rates) from financial exposure (dollar amounts)
 */

import type {
  ExchangeFrequencyInput,
  ExchangeFrequencyKpis,
  ExposureStatusBreakdown,
  ClaimLifecycleStatus,
  ExchangeClaimRecord,
  KpiResult,
} from "./types";
import { isWithinPeriod, safeDiv, safeRound } from "./helpers";

const ALL_LIFECYCLE_STATUSES: ClaimLifecycleStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED_OPTION_A",
  "APPROVED_OPTION_B",
  "RMA_INSPECTED",
  "SETTLED",
  "REJECTED",
  "CANCELLED",
];

export function calculateExchangeFrequencyKpis(
  input: ExchangeFrequencyInput
): ExchangeFrequencyKpis {
  const { period, product_id, claimRecords, eligibilityRecords } = input;

  const periodObj = {
    start: period.periodStart,
    end: period.periodEnd,
  };

  // 1. Filter claim lines for this product within evaluation period
  const seenLineIds = new Set<string>();
  const productClaims: ExchangeClaimRecord[] = [];

  for (const claim of claimRecords || []) {
    if (claim.product_id !== product_id) continue;
    if (!isWithinPeriod(claim.claim_date, period)) continue;

    // Deduplicate identical claim line IDs
    if (seenLineIds.has(claim.id)) continue;
    seenLineIds.add(claim.id);

    productClaims.push(claim);
  }

  // 2. Distinguish:
  // (A) 90-Day Exchange Protection Window
  // (B) Day-100 Claim Eligibility Maturity
  // (C) Evaluation Reporting Period attribution
  const protectedStoreIds = new Set<string>();
  const eligibleMaturedStoreIds = new Set<string>();
  let hasCohortHistory = Array.isArray(eligibilityRecords) && eligibilityRecords.length > 0;

  for (const el of eligibilityRecords || []) {
    if (el.product_id !== product_id) continue;

    // (A) Check active 90-day protection window (as of evaluation date)
    const isIn90DayProtection =
      typeof el.is_in_active_protection_window === "boolean"
        ? el.is_in_active_protection_window
        : el.cohort_date <= period.asOfDate &&
          (!el.protection_end_date || el.protection_end_date >= period.asOfDate);

    if (isIn90DayProtection) {
      protectedStoreIds.add(el.store_id);
    }

    // (B) Check Day-100 Maturity (Claim submission eligibility on or before periodEnd)
    const isMatured =
      typeof el.is_matured_day_100 === "boolean"
        ? el.is_matured_day_100
        : el.is_eligible === true ||
          Boolean(el.claim_eligibility_date && el.claim_eligibility_date <= period.periodEnd);

    if (isMatured) {
      eligibleMaturedStoreIds.add(el.store_id);
    }
  }

  const protectedStoresCount = protectedStoreIds.size;
  const eligibleStoreCohortCount = eligibleMaturedStoreIds.size;

  // 3. Unique Claiming Stores (Active claims, excluding CANCELLED and REJECTED)
  const activeClaimingStoreIds = new Set<string>();
  let totalRequestedUnits = 0;
  let totalClaimedDollarValue = 0;

  // Track status breakdown
  const statusMap = new Map<ClaimLifecycleStatus, { count: number; units: number; dollars: number }>();
  for (const st of ALL_LIFECYCLE_STATUSES) {
    statusMap.set(st, { count: 0, units: 0, dollars: 0 });
  }

  for (const claim of productClaims) {
    const entry = statusMap.get(claim.status) || { count: 0, units: 0, dollars: 0 };
    entry.count += 1;
    entry.units += claim.requested_units;
    entry.dollars += claim.claimed_dollar_value;
    statusMap.set(claim.status, entry);

    if (claim.status !== "CANCELLED" && claim.status !== "REJECTED") {
      activeClaimingStoreIds.add(claim.store_id);
      totalRequestedUnits += claim.requested_units;
      totalClaimedDollarValue += claim.claimed_dollar_value;
    }
  }

  const uniqueClaimingStoreCount = activeClaimingStoreIds.size;

  const uniqueClaimingStoreCountKpi: KpiResult<number> = {
    value: uniqueClaimingStoreCount,
    unit: "COUNT",
    period: periodObj,
    status: "ACTUAL",
    dataConfidence: 1.0,
    sourceBasis: "Distinct stores that submitted at least one active claim in period.",
  };

  // 4. Claiming Store Rate: Unique Claiming Stores / Eligible Store Cohort Count
  let claimingStoreRateKpi: KpiResult<number>;
  if (!hasCohortHistory) {
    // Missing cohort history entirely: denominator cannot be proven
    claimingStoreRateKpi = {
      value: null,
      unit: "PERCENT",
      period: periodObj,
      status: "UNAVAILABLE",
      dataConfidence: 0.0,
      sourceBasis: "Authoritative cohort records missing for this product.",
      missingInputReason: `Missing cohort eligibility records: Cannot establish eligible store denominator for SKU ${product_id}.`,
    };
  } else if (eligibleStoreCohortCount === 0) {
    // Cohorts exist, but none have reached Day-100 maturity yet
    claimingStoreRateKpi = {
      value: null,
      unit: "PERCENT",
      period: periodObj,
      status: "UNAVAILABLE",
      dataConfidence: 1.0,
      sourceBasis:
        "Zero stores have reached the Day-100 claim maturity threshold for this product during the evaluation period (cohorts remain in 90-day active protection).",
      missingInputReason: "Zero stores have reached Day-100 claim maturity during the evaluation period.",
      metadata: {
        protectedStoresIn90DayWindow: protectedStoresCount,
      },
    };
  } else {
    const rateRatio = safeDiv(uniqueClaimingStoreCount, eligibleStoreCohortCount);
    claimingStoreRateKpi = {
      value: rateRatio !== null ? safeRound(rateRatio * 100, 1) : null,
      unit: "PERCENT",
      period: periodObj,
      status: "ACTUAL",
      dataConfidence: 1.0,
      sourceBasis:
        "Unique claiming stores divided by distinct stores with eligible Day-100 cohorts (retailer_exchange_claims / store_cohorts).",
      metadata: {
        uniqueClaimingStores: uniqueClaimingStoreCount,
        eligibleStoreCohortsDay100: eligibleStoreCohortCount,
        activeProtectedStoresDay90: protectedStoresCount,
      },
    };
  }

  // 5. Protected Stores Count (90-Day Window)
  const protectedStoresCountKpi: KpiResult<number> = {
    value: protectedStoresCount,
    unit: "COUNT",
    period: periodObj,
    status: hasCohortHistory ? "ACTUAL" : "UNAVAILABLE",
    dataConfidence: hasCohortHistory ? 1.0 : 0.0,
    sourceBasis: "Distinct stores holding supply cohorts in the active 90-day protection window.",
    missingInputReason: !hasCohortHistory ? "Missing cohort eligibility records" : undefined,
  };

  // 6. Eligible Store Cohort Count KPI (Day-100 Maturity)
  const eligibleStoreCohortCountKpi: KpiResult<number> = {
    value: hasCohortHistory ? eligibleStoreCohortCount : null,
    unit: "COUNT",
    period: periodObj,
    status: hasCohortHistory ? "ACTUAL" : "UNAVAILABLE",
    dataConfidence: hasCohortHistory ? 1.0 : 0.0,
    sourceBasis: "Distinct stores holding a verified Day-100 matured supply cohort.",
    missingInputReason: !hasCohortHistory ? "Missing cohort eligibility records" : undefined,
  };

  // 7. Claim Quantity KPI
  const totalClaimRequestedUnitsKpi: KpiResult<number> = {
    value: totalRequestedUnits,
    unit: "UNITS",
    period: periodObj,
    status: "ACTUAL",
    dataConfidence: 1.0,
    sourceBasis: "Sum of requested_units across active exchange claims.",
  };

  // 8. Claim Total Dollar Value KPI
  const totalClaimDollarValueKpi: KpiResult<number> = {
    value: safeRound(totalClaimedDollarValue, 2),
    unit: "USD",
    period: periodObj,
    status: "ACTUAL",
    dataConfidence: 1.0,
    sourceBasis: "Sum of claimed_dollar_value across active exchange claims.",
  };

  // 9. Exposure by Lifecycle Status Breakdown
  const exposureBreakdown: ExposureStatusBreakdown[] = ALL_LIFECYCLE_STATUSES.map((status) => {
    const entry = statusMap.get(status)!;
    return {
      status,
      claimsCount: entry.count,
      units: entry.units,
      dollarValue: safeRound(entry.dollars, 2) ?? 0,
    };
  });

  const exposureByStatusKpi: KpiResult<ExposureStatusBreakdown[]> = {
    value: exposureBreakdown,
    unit: "USD",
    period: periodObj,
    status: "ACTUAL",
    dataConfidence: 1.0,
    sourceBasis: "Financial exposure and claim volumes segmented by authoritative lifecycle state.",
  };

  return {
    uniqueClaimingStoreCount: uniqueClaimingStoreCountKpi,
    eligibleStoreCohortCount: eligibleStoreCohortCountKpi,
    claimingStoreRate: claimingStoreRateKpi,
    protectedStoresCount: protectedStoresCountKpi,
    totalClaimRequestedUnits: totalClaimRequestedUnitsKpi,
    totalClaimDollarValue: totalClaimDollarValueKpi,
    exposureByStatus: exposureByStatusKpi,
  };
}
