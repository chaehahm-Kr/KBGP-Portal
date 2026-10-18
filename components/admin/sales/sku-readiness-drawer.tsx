"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import type { ProductPerformanceSummary } from "@/lib/product/performance/types";
import {
  evaluateSkuDataReadiness,
  type SkuDataReadiness,
} from "@/lib/product/performance/sku-readiness";

interface SkuReadinessDrawerProps {
  item: ProductPerformanceSummary | null;
  isOpen: boolean;
  onClose: () => void;
  asOfDate?: string;
}

export function SkuReadinessDrawer({
  item,
  isOpen,
  onClose,
  asOfDate = new Date().toISOString().split("T")[0],
}: SkuReadinessDrawerProps) {
  if (!isOpen || !item) return null;

  // Use pre-computed dataReadiness or compute on the fly
  const readiness: SkuDataReadiness =
    item.dataReadiness ||
    evaluateSkuDataReadiness({
      productId: item.productId,
      firstShipmentDateOnProduct: null,
      earliestFulfilledShipmentDate: null,
      onHandUnits: item.kpis?.inventory?.hqAvailableUnits?.value ?? 0,
      kpis: item.kpis,
      completedOrdersCount: item.gradeReadiness.metrics.completedOrdersCount,
      distinctStoresCount: item.gradeReadiness.metrics.distinctStoresCount,
      weeklyChecksCount: item.kpis?.velocity?.weeklyReportsCount?.value ?? 0,
      asOfDate,
    });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="readiness-drawer-title"
      className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end animate-fadeIn"
    >
      {/* Backdrop click listener */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      {/* Drawer Panel */}
      <div className="relative w-full sm:w-[560px] h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden z-10 animate-slideInRight">
        {/* 1. Drawer Header */}
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-start justify-between gap-4 bg-zinc-50/80 dark:bg-zinc-950/80">
          <div className="flex items-start gap-3 min-w-0">
            <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.productName}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-bold text-zinc-400 dark:text-zinc-500 text-sm">
                  {item.productName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-800 dark:text-zinc-200">
                  {item.brand.name}
                </span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold border ${readiness.gateBadgeColor}`}>
                  {readiness.gateLabel}
                </span>
              </div>
              <h2
                id="readiness-drawer-title"
                className="text-base font-bold text-zinc-950 dark:text-white tracking-tight mt-1 truncate"
              >
                {item.productName}
              </h2>
              <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
                SKU: {item.sku}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Close drawer"
          >
            ✕
          </button>
        </div>

        {/* 2. Drawer Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs text-zinc-700 dark:text-zinc-300">
          {/* Integrity Gauges Strip */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-semibold">
                  Data Coverage
                </span>
                <span className="font-bold text-zinc-900 dark:text-white">
                  {readiness.dataCoveragePercent}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                <div
                  style={{ width: `${readiness.dataCoveragePercent}%` }}
                  className={`h-full rounded-full transition-all ${
                    readiness.dataCoveragePercent >= 80
                      ? "bg-emerald-500"
                      : readiness.dataCoveragePercent >= 40
                      ? "bg-amber-500"
                      : "bg-rose-500"
                  }`}
                />
              </div>
              <span className="text-[10px] text-zinc-400 mt-1 block">
                Required for simulation: &ge; 40%
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-semibold">
                  Data Confidence
                </span>
                <span className="font-bold text-zinc-900 dark:text-white">
                  {readiness.dataConfidencePercent}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                <div
                  style={{ width: `${readiness.dataConfidencePercent}%` }}
                  className={`h-full rounded-full transition-all ${
                    readiness.dataConfidencePercent >= 80
                      ? "bg-emerald-500"
                      : readiness.dataConfidencePercent >= 50
                      ? "bg-amber-500"
                      : "bg-rose-500"
                  }`}
                />
              </div>
              <span className="text-[10px] text-zinc-400 mt-1 block">
                Evidence freshness &amp; verified provenance
              </span>
            </div>
          </div>

          {/* Section A: Commercial Lifecycle & Operating Age Anchor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                A. Operating Age Anchor (Decision D1)
              </h3>
              <span className="text-[10px] font-semibold text-zinc-400">
                Rule 1 &amp; 2
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400 text-[10px] block">
                    First Fulfilled B2B Shipment
                  </span>
                  <span className="font-semibold text-zinc-900 dark:text-white mt-0.5 block font-mono">
                    {readiness.firstShipmentDate || "Unverified (0 Shipments)"}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400 text-[10px] block">
                    Commercial Operating Age
                  </span>
                  <span className="font-semibold text-zinc-900 dark:text-white mt-0.5 block">
                    {readiness.operatingAgeDays !== null ? `${readiness.operatingAgeDays} days` : "N/A"}
                    <span className="text-zinc-400 text-[10px] font-normal ml-1">
                      {readiness.operatingStatus === "START_DATE_UNVERIFIED"
                        ? "(Unverified Start Date)"
                        : readiness.operatingStatus === "NEW"
                        ? "(<60d New Incubation)"
                        : "(&ge;60d Mature)"}
                    </span>
                  </span>
                </div>
              </div>

              <div className="border-t border-zinc-200/60 dark:border-zinc-800/60 pt-2 text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {readiness.anchorNote}
                <div className="mt-1 text-[10px] text-zinc-400 italic">
                  *Non-negotiable rule: Missing wholesale shipment records NEVER default to product catalog creation date.
                </div>
              </div>
            </div>
          </div>

          {/* Section B: Landed Cost Provenance & Inventory Valuation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                B. Landed Cost Provenance &amp; Valuation (Decision D2)
              </h3>
              <span className="text-[10px] font-semibold text-zinc-400">
                Rule 3 &amp; 4
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400 text-[10px] block">
                    Cost Provenance
                  </span>
                  <span
                    className={`inline-block mt-0.5 font-semibold text-[11px] ${
                      readiness.costProvenanceTier === "TIER_1_VERIFIED"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : readiness.costProvenanceTier === "TIER_2_LAYER"
                        ? "text-blue-600 dark:text-blue-400"
                        : readiness.costProvenanceTier === "TIER_3_OVERRIDE"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {readiness.costProvenanceLabel}
                  </span>
                </div>

                <div>
                  <span className="text-zinc-500 dark:text-zinc-400 text-[10px] block">
                    On-Hand Physical Units
                  </span>
                  <span className="font-semibold text-zinc-900 dark:text-white mt-0.5 block">
                    {readiness.inventoryUnitsOnHand} units
                  </span>
                </div>
              </div>

              <div>
                <span className="text-zinc-500 dark:text-zinc-400 text-[10px] block">
                  Recognized HQ Asset Valuation
                </span>
                <span
                  className={`font-semibold mt-0.5 block text-xs ${
                    readiness.isInventoryValuationPending
                      ? "text-rose-600 dark:text-rose-400 font-bold"
                      : "text-zinc-900 dark:text-white"
                  }`}
                >
                  {readiness.inventoryValuationDisplay}
                </span>
              </div>

              {readiness.isInventoryValuationPending && (
                <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 p-2.5 text-[11px] text-rose-700 dark:text-rose-300 leading-snug">
                  <strong>Zero-Valuation Safeguard:</strong> This SKU has {readiness.inventoryUnitsOnHand} units on hand but lacks verified landed cost layers. The asset value is displayed as <em>PENDING COST VERIFICATION (N/A)</em> and is strictly prohibited from being calculated as $0.00 to prevent false write-offs.
                </div>
              )}
            </div>
          </div>

          {/* Section C: Wholesale B2B Eligibility Gates */}
          <div className="space-y-2">
            <h3 className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
              C. Wholesale B2B Eligibility Gates (60-Day Window)
            </h3>

            <div className="grid grid-cols-3 gap-2.5 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 text-center">
              <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <span className="text-zinc-500 dark:text-zinc-400 text-[10px] block">
                  B2B Orders
                </span>
                <span className="text-base font-bold text-zinc-900 dark:text-white mt-0.5 block">
                  {readiness.completedOrdersCount} / 3
                </span>
                <span
                  className={`inline-block mt-1 text-[9px] font-bold px-1.5 py-0.2 rounded ${
                    readiness.isOrdersThresholdMet
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                  }`}
                >
                  {readiness.isOrdersThresholdMet ? "MET" : "INSUFFICIENT"}
                </span>
              </div>

              <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <span className="text-zinc-500 dark:text-zinc-400 text-[10px] block">
                  Store Doors
                </span>
                <span className="text-base font-bold text-zinc-900 dark:text-white mt-0.5 block">
                  {readiness.distinctStoresCount} / 3
                </span>
                <span
                  className={`inline-block mt-1 text-[9px] font-bold px-1.5 py-0.2 rounded ${
                    readiness.isStoresThresholdMet
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                  }`}
                >
                  {readiness.isStoresThresholdMet ? "MET" : "INSUFFICIENT"}
                </span>
              </div>

              <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <span className="text-zinc-500 dark:text-zinc-400 text-[10px] block">
                  Cost Status
                </span>
                <span className="text-base font-bold text-zinc-900 dark:text-white mt-0.5 block">
                  {readiness.isHistoricalCostVerified ? "Verified" : "Unverified"}
                </span>
                <span
                  className={`inline-block mt-1 text-[9px] font-bold px-1.5 py-0.2 rounded ${
                    readiness.isHistoricalCostVerified
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                  }`}
                >
                  {readiness.isHistoricalCostVerified ? "TIER 1/2" : "UNVERIFIED"}
                </span>
              </div>
            </div>
          </div>

          {/* Section D: Velocity & Exchange Risk Integrity */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                D. Velocity &amp; Risk Integrity (Decisions D4 &amp; D5)
              </h3>
              <span className="text-[10px] font-semibold text-zinc-400">
                Rule 5 &amp; 6
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
              <div>
                <span className="text-zinc-500 dark:text-zinc-400 text-[10px] block">
                  Weekly Store Inventory Checks
                </span>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="font-semibold text-zinc-900 dark:text-white">
                    {readiness.weeklyStoreChecksCount} checks submitted
                  </span>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                    Estimated Movement (Not Store POS)
                  </span>
                </div>
              </div>

              <div className="border-t border-zinc-200/60 dark:border-zinc-800/60 pt-2">
                <span className="text-zinc-500 dark:text-zinc-400 text-[10px] block">
                  90-Day Exchange Risk Anchor
                </span>
                <span className="font-semibold text-zinc-900 dark:text-white mt-0.5 block">
                  {readiness.exchangeRiskStatusDisplay}
                </span>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  Pre-Day 100 cohorts are unobserved and carry zero penalty.
                </p>
              </div>
            </div>
          </div>

          {/* Section E: Active Reason Codes */}
          <div className="space-y-2">
            <h3 className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
              E. Active Data Deficiency Reason Codes ({readiness.reasonCodes.length})
            </h3>

            {readiness.reasonCodes.length === 0 ? (
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300 text-xs">
                ✓ No active data gaps. All baseline data gates are satisfied.
              </div>
            ) : (
              <div className="space-y-1.5">
                {readiness.reasonCodes.map((code) => {
                  let desc = "";
                  let isCrit = false;
                  switch (code) {
                    case "ERR_COST_MISSING":
                      desc = "No landed cost record in landed_cost_results or inventory layers.";
                      isCrit = true;
                      break;
                    case "ERR_COST_OVERRIDE_UNBOUND":
                      desc = "Static product override cost is provisional; effective date unverified against past orders.";
                      break;
                    case "ERR_UNCOMMENCED_LIFECYCLE":
                      desc = "Zero wholesale B2B shipments recorded in database. Lifecycle uncommenced.";
                      break;
                    case "ERR_SHIPMENT_UNLINKED":
                      desc = "Fulfilled wholesale shipments exist in database, but product first_shipment_date header is not stamped.";
                      break;
                    case "ERR_INSUFFICIENT_ORDERS":
                      desc = "Completed wholesale B2B orders < 3 in evaluation period.";
                      break;
                    case "ERR_INSUFFICIENT_STORES":
                      desc = "Distinct purchasing store accounts < 3 in evaluation period.";
                      break;
                    case "ERR_WEEKLY_CHECKS_SPARSE":
                      desc = "Fewer than 4 weekly store inventory checks logged over trailing 60 days.";
                      break;
                    case "ERR_COHORT_PRE_MATURE":
                      desc = "Store placement cohort age < 100 days; exchange claim window not yet open.";
                      break;
                    default:
                      desc = "Data gap condition identified.";
                  }

                  return (
                    <div
                      key={code}
                      className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-start gap-2.5"
                    >
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold whitespace-nowrap ${
                          isCrit
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                            : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                        }`}
                      >
                        {code}
                      </span>
                      <span className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug">
                        {desc}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section F: Actionable Remediation Plan */}
          <div className="space-y-2">
            <h3 className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
              F. Remediation Action Plan ({readiness.remediationActions.length} Actions)
            </h3>

            {readiness.remediationActions.length === 0 ? (
              <p className="text-zinc-500 dark:text-zinc-400 text-xs">
                No remediation required. SKU is fully eligible.
              </p>
            ) : (
              <div className="space-y-2">
                {readiness.remediationActions.map((act, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                        {act.team}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                            act.priority === "CRITICAL"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                              : act.priority === "HIGH"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                          }`}
                        >
                          {act.priority}
                        </span>
                        <span className="text-[10px] text-zinc-400">SLA: {act.sla}</span>
                      </div>
                    </div>
                    <p className="text-xs font-medium text-zinc-900 dark:text-white">
                      {act.action}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 3. Drawer Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between gap-3">
          <Link
            href={`/admin/sales/sku/${item.productId}`}
            className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Open Full SKU Performance &rarr;
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
