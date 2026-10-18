"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { ProductPerformanceSummary } from "@/lib/product/performance/types";
import { SkuReadinessDrawer } from "./sku-readiness-drawer";
import {
  evaluateSkuDataReadiness,
  type SkuDataReadiness,
} from "@/lib/product/performance/sku-readiness";

interface SkuDetailViewProps {
  summary: ProductPerformanceSummary;
  lookbackDays: number;
}

function formatCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

export function SkuDetailView({ summary, lookbackDays: initialDays }: SkuDetailViewProps) {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<
    "overview" | "sales" | "profit" | "inventory" | "exchange" | "stores" | "actions" | "readiness"
  >("overview");
  const [lookbackDays, setLookbackDays] = useState(initialDays);
  const [isReadinessDrawerOpen, setIsReadinessDrawerOpen] = useState(false);

  const { kpis, gradeReadiness, overallDataConfidence, riskFlags } = summary;

  const readiness: SkuDataReadiness =
    summary.dataReadiness ||
    evaluateSkuDataReadiness({
      productId: summary.productId,
      onHandUnits: kpis?.inventory?.hqAvailableUnits?.value ?? 0,
      kpis,
      completedOrdersCount: gradeReadiness.metrics.completedOrdersCount,
      distinctStoresCount: gradeReadiness.metrics.distinctStoresCount,
      weeklyChecksCount: kpis?.velocity?.weeklyReportsCount?.value ?? 0,
      asOfDate: new Date().toISOString().split("T")[0],
    });

  const handlePeriodChange = (days: number) => {
    setLookbackDays(days);
    router.push(`/admin/sales/sku/${summary.productId}?days=${days}`);
  };

  const sections = [
    { key: "overview", label: "1. Overview" },
    { key: "sales", label: "2. Sales & Velocity" },
    { key: "profit", label: "3. Profitability" },
    { key: "inventory", label: "4. Inventory & Forecast" },
    { key: "exchange", label: "5. Exchange & Risk" },
    { key: "stores", label: "6. Stores & Growth" },
    { key: "actions", label: "7. Actions & History" },
    { key: "readiness", label: "8. Data Readiness & Remediation" },
  ];

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <Link href="/admin/sales" className="hover:text-zinc-900 dark:hover:text-white">
          Sales &amp; Performance
        </Link>
        <span>/</span>
        <Link href="/admin/sales?tab=sku" className="hover:text-zinc-900 dark:hover:text-white">
          SKU Performance
        </Link>
        <span>/</span>
        <span className="font-semibold text-zinc-900 dark:text-white truncate max-w-[300px]">
          {summary.productName}
        </span>
      </nav>

      {/* SKU Header Hero Banner */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            {/* Image Thumbnail */}
            <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
              {summary.imageUrl ? (
                <Image
                  src={summary.imageUrl}
                  alt={summary.productName}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-bold text-zinc-400 dark:text-zinc-500 text-2xl">
                  {summary.productName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-md bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                  {summary.brand.name}
                </span>
                <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  {summary.category.name}
                </span>
                <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 capitalize">
                  {summary.status}
                </span>
              </div>

              <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
                {summary.productName}
              </h1>

              {summary.productNameEn && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  English Title: {summary.productNameEn}
                </p>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs font-mono text-zinc-600 dark:text-zinc-400">
                <span>Letusto SKU: <strong>{summary.sku}</strong></span>
                {summary.manufactureSku && (
                  <span>Mfg SKU: <strong>{summary.manufactureSku}</strong></span>
                )}
                <span className="font-sans">Created: {summary.createdAt.slice(0, 10)}</span>
              </div>
            </div>
          </div>

          {/* Right Control & Safety Gate Box */}
          <div className="flex flex-col items-start lg:items-end gap-3">
            {/* Period Selector Pills */}
            <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-800">
              {[30, 60, 90, 180].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handlePeriodChange(d)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    lookbackDays === d
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm"
                      : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>

            {/* Data Readiness Indicator & Drawer Trigger */}
            <div className="flex flex-col items-start lg:items-end gap-1.5">
              <div className="flex items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-xs font-bold border ${readiness.gateBadgeColor}`}>
                  {readiness.gateLabel}
                </span>
                <button
                  type="button"
                  onClick={() => setIsReadinessDrawerOpen(true)}
                  className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-500 shadow-xs transition-colors cursor-pointer"
                >
                  Inspect Readiness &rarr;
                </button>
              </div>
              <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                Coverage: <strong>{readiness.dataCoveragePercent}%</strong> · Confidence: <strong>{readiness.dataConfidencePercent}%</strong>
              </div>
            </div>

            {/* Business Grade & Gate Indicator */}
            <div className="rounded-lg border border-amber-200/80 bg-amber-50/70 p-2.5 text-right dark:border-amber-900/40 dark:bg-amber-950/20">
              <div className="flex items-center justify-end gap-1.5 text-amber-800 dark:text-amber-300">
                <span className="text-xs">🔒</span>
                <span className="text-xs font-bold uppercase tracking-wider">Business Grade:</span>
                <span className="rounded bg-amber-200/70 px-1.5 py-0.5 text-xs font-extrabold text-amber-900 dark:bg-amber-900/70 dark:text-amber-200">
                  POLICY PENDING
                </span>
              </div>
              <p className="mt-1 text-[10px] text-amber-700/80 dark:text-amber-400/80 max-w-[260px] leading-tight">
                Automatic A/B/C/D grading disabled pending Owner scoring normalization approval.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section Tab Navigation */}
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex space-x-1 overflow-x-auto pb-px">
          {sections.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setActiveSection(s.key as any)}
              className={`whitespace-nowrap px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                activeSection === s.key
                  ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-300"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* SECTION 1: OVERVIEW */}
      {/* ==================================================================== */}
      {activeSection === "overview" && (
        <div className="space-y-6">
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">B2B Net Sales</span>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
                {formatCurrency(kpis.financial.b2bNetSales.value)}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                {kpis.financial.totalUnitsSold.value ?? 0} units shipped to network
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Gross Margin</span>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
                {kpis.financial.grossMargin.value !== null ? `${kpis.financial.grossMargin.value}%` : "N/A"}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                Profit: {formatCurrency(kpis.financial.grossProfit.value)}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">HQ Available Units</span>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
                {kpis.inventory.hqAvailableUnits.value ?? 0}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                Valuation:{" "}
                {readiness.isInventoryValuationPending ? (
                  <span className="font-semibold text-rose-600 dark:text-rose-400">
                    PENDING COST (N/A)
                  </span>
                ) : (
                  formatCurrency(kpis.inventory.hqInventoryValue.value)
                )}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Overall Data Confidence</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-zinc-900 dark:text-white">
                  {Math.round(overallDataConfidence * 100)}%
                </span>
                <span className="text-xs font-semibold text-zinc-500">
                  {overallDataConfidence >= 0.8 ? "High" : overallDataConfidence >= 0.5 ? "Partial" : "Low"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                {riskFlags.length > 0 ? `${riskFlags.length} risk flags active` : "No risk flags"}
              </p>
            </div>
          </div>

          {/* Master Details Table */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-3">
              SKU Master Information &amp; Lifecycle
            </h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                <dt className="text-zinc-500 dark:text-zinc-400">Commercial Operating Age</dt>
                <dd className="mt-1 font-semibold text-zinc-900 dark:text-white">
                  {readiness.firstShipmentDate
                    ? `${readiness.operatingAgeDays} days (First B2B Shipment: ${readiness.firstShipmentDate})`
                    : "N/A (Start Date Unverified — Zero B2B Shipments; Does Not Default to Created Date)"}
                </dd>
              </div>

              <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                <dt className="text-zinc-500 dark:text-zinc-400">Grade Eligibility Audit</dt>
                <dd className="mt-1 font-semibold text-zinc-900 dark:text-white">
                  {gradeReadiness.isEligible ? "Eligible" : "Not Eligible"} ({gradeReadiness.evaluationStatus})
                </dd>
              </div>

              <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                <dt className="text-zinc-500 dark:text-zinc-400">Completed Orders (Trial)</dt>
                <dd className="mt-1 font-semibold text-zinc-900 dark:text-white">
                  {gradeReadiness.metrics.completedOrdersCount} orders (Min 3 required)
                </dd>
              </div>

              <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                <dt className="text-zinc-500 dark:text-zinc-400">Distinct Ordering Stores</dt>
                <dd className="mt-1 font-semibold text-zinc-900 dark:text-white">
                  {gradeReadiness.metrics.distinctStoresCount} stores (Min 2 required)
                </dd>
              </div>

              <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                <dt className="text-zinc-500 dark:text-zinc-400">Landed Cost Provenance</dt>
                <dd className="mt-1 font-semibold text-zinc-900 dark:text-white">
                  {gradeReadiness.metrics.hasHistoricalCost ? "Verified Historical Cost" : "Missing Historical Cost"}
                </dd>
              </div>

              <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                <dt className="text-zinc-500 dark:text-zinc-400">Active Risk Flags</dt>
                <dd className="mt-1 font-semibold text-zinc-900 dark:text-white">
                  {riskFlags.join(", ") || "None"}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SECTION 2: SALES & VELOCITY */}
      {/* ==================================================================== */}
      {activeSection === "sales" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-3">
              B2B Sales Breakdown ({lookbackDays}-Day Window)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                <span className="text-zinc-500 dark:text-zinc-400">Gross Merchandise Subtotal</span>
                <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">
                  {formatCurrency(kpis.financial.b2bNetSales.metadata?.grossMerchandiseSubtotal ?? 0)}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                <span className="text-zinc-500 dark:text-zinc-400">Merchandise Discounts</span>
                <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">
                  -{formatCurrency(kpis.financial.b2bNetSales.metadata?.merchandiseDiscounts ?? 0)}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                <span className="text-zinc-500 dark:text-zinc-400">Merchandise Refunds</span>
                <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">
                  -{formatCurrency(kpis.financial.b2bNetSales.metadata?.merchandiseRefunds ?? 0)}
                </p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">B2B Net Sales</span>
                <p className="mt-1 text-lg font-bold text-emerald-800 dark:text-emerald-300">
                  {formatCurrency(kpis.financial.b2bNetSales.value)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-3">
              Shipment Velocity &amp; Store Sell-Through
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                <span className="text-zinc-500 dark:text-zinc-400">Daily B2B Shipment Velocity</span>
                <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">
                  {kpis.velocity.b2bShipmentVelocityDaily.value ?? 0} units / day
                </p>
                <p className="text-[10px] text-zinc-400 mt-1">Based on fulfilled shipments</p>
              </div>

              <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Retailer Weekly Sell-Through</span>
                  <span className="rounded bg-zinc-200 px-1 text-[9px] font-bold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                    ESTIMATED
                  </span>
                </div>
                <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">
                  {kpis.velocity.estimatedRetailerSellThroughUnits.value !== null
                    ? `${kpis.velocity.estimatedRetailerSellThroughUnits.value} units`
                    : "N/A"}
                </p>
                <p className="text-[10px] text-zinc-400 mt-1">Derived from retailer weekly checks</p>
              </div>

              <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                <span className="text-zinc-500 dark:text-zinc-400">Weekly Check Reporting Stores</span>
                <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">
                  {kpis.velocity.reportingQualification.value?.reportingStoresCount ?? 0} stores
                </p>
                <p className="text-[10px] text-zinc-400 mt-1">Submitting periodic counts</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SECTION 3: PROFITABILITY */}
      {/* ==================================================================== */}
      {activeSection === "profit" && (
        <div className="space-y-6">
          {/* Owner Policy Banner */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 text-xs text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300">
            <p className="font-bold">Authoritative Landed Cost Policy (R4 Standard):</p>
            <p className="mt-1 leading-relaxed">
              Historical COGS and margins strictly require verifiable historical landed cost records.
              Future override landed cost is never back-cast onto historical shipments.
              If cost records are absent, Gross Profit and Landed COGS strictly resolve to <strong>N/A</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Landed COGS</span>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
                {kpis.financial.landedCogs.status === "UNAVAILABLE"
                  ? "N/A (Cost Missing)"
                  : formatCurrency(kpis.financial.landedCogs.value)}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                Status: {kpis.financial.landedCogs.status}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Gross Profit</span>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
                {kpis.financial.grossProfit.status === "UNAVAILABLE"
                  ? "N/A"
                  : formatCurrency(kpis.financial.grossProfit.value)}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                Net Sales - Landed COGS
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Gross Margin %</span>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
                {kpis.financial.grossMargin.value !== null ? `${kpis.financial.grossMargin.value}%` : "N/A"}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                Gross Profit / B2B Net Sales
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SECTION 4: INVENTORY & FORECAST */}
      {/* ==================================================================== */}
      {activeSection === "inventory" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-3">
              HQ Warehouse Inventory Positions
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                <span className="text-zinc-500 dark:text-zinc-400">Available Units (Net)</span>
                <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-white">
                  {kpis.inventory.hqAvailableUnits.value ?? 0}
                </p>
              </div>

              <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                <span className="text-zinc-500 dark:text-zinc-400">HQ Inventory Valuation</span>
                <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-white">
                  {kpis.inventory.hqInventoryValue.status === "UNAVAILABLE"
                    ? "N/A (Cost Missing)"
                    : formatCurrency(kpis.inventory.hqInventoryValue.value)}
                </p>
              </div>

              <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                <span className="text-zinc-500 dark:text-zinc-400">Days of Supply (DOS)</span>
                <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-white">
                  {kpis.inventory.daysOfSupply.value !== null
                    ? `${kpis.inventory.daysOfSupply.value} days`
                    : "N/A"}
                </p>
              </div>

              <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                <span className="text-zinc-500 dark:text-zinc-400">Ending Inventory Proxy</span>
                <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-white">
                  {formatCurrency(kpis.inventory.averageInventoryValue.metadata?.endingInventoryValuationProxy)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-2">
              Official Turnover, DIO &amp; GMROI Status
            </h3>
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
              <p className="font-semibold">Turnover Metrics Status: UNAVAILABLE</p>
              <p className="mt-1">
                Owner policy strictly requires ≥ 2 periodic average inventory snapshots across the evaluation period.
                Single-point ending inventory is not substituted to prevent artificial turnover distortion.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-2">
              Demand Forecast &amp; Replenishment Advice
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Status: <span className="font-semibold text-zinc-700 dark:text-zinc-300">UNAVAILABLE / PENDING RUN-RATE MODEL</span>
            </p>
            <p className="mt-1 text-[11px] text-zinc-400">
              Future demand forecast models will be integrated upon completion of 90-day seasonal baseline run-rates.
            </p>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SECTION 5: EXCHANGE & RISK */}
      {/* ==================================================================== */}
      {activeSection === "exchange" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-zinc-500 dark:text-zinc-400">Active Protected Stores</span>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
                {kpis.exchange.protectedStoresCount.value ?? 0}
              </p>
              <p className="mt-1 text-[11px] text-zinc-400">Within active 90-day trial</p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-zinc-500 dark:text-zinc-400">Matured Day-100 Cohorts</span>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
                {kpis.exchange.eligibleStoreCohortCount.value ?? 0}
              </p>
              <p className="mt-1 text-[11px] text-zinc-400">Eligible for exchange evaluation</p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-zinc-500 dark:text-zinc-400">Claiming Stores Count</span>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
                {kpis.exchange.uniqueClaimingStoreCount.value ?? 0}
              </p>
              <p className="mt-1 text-[11px] text-zinc-400">Unique applicant stores</p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-zinc-500 dark:text-zinc-400">Claiming Store Rate</span>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
                {kpis.exchange.claimingStoreRate.value !== null
                  ? `${kpis.exchange.claimingStoreRate.value}%`
                  : "N/A"}
              </p>
              <p className="mt-1 text-[11px] text-zinc-400">Status: {kpis.exchange.claimingStoreRate.status}</p>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-3">Active Risk Diagnosis</h3>
            {riskFlags.length === 0 ? (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                ✅ No critical risk flags active for this SKU.
              </p>
            ) : (
              <div className="space-y-2">
                {riskFlags.map((rf) => (
                  <div
                    key={rf}
                    className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-2.5 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
                  >
                    <span>⚠️</span>
                    <span className="font-semibold">{rf}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SECTION 6: STORES & GROWTH */}
      {/* ==================================================================== */}
      {activeSection === "stores" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-zinc-500 dark:text-zinc-400">Total Network Target Stores</span>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
                {kpis.velocity.reportingQualification.value?.totalTargetStoresCount ?? 0}
              </p>
              <p className="mt-1 text-[11px] text-zinc-400">Active retail accounts</p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-zinc-500 dark:text-zinc-400">Active Reporting Stores</span>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
                {kpis.velocity.reportingQualification.value?.reportingStoresCount ?? 0}
              </p>
              <p className="mt-1 text-[11px] text-zinc-400">Submitting periodic counts</p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-zinc-500 dark:text-zinc-400">Store Reporting Compliance</span>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
                {kpis.velocity.reportingQualification.value?.complianceRate !== undefined &&
                kpis.velocity.reportingQualification.value?.complianceRate !== null
                  ? `${Math.round(kpis.velocity.reportingQualification.value.complianceRate * 100)}%`
                  : "N/A"}
              </p>
              <p className="mt-1 text-[11px] text-zinc-400">Weekly check adherence</p>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SECTION 7: ACTIONS & HISTORY */}
      {/* ==================================================================== */}
      {activeSection === "actions" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-5 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
            <h3 className="text-sm font-bold text-amber-900 dark:text-amber-300 mb-2">
              Recommended Business Actions
            </h3>
            <p className="text-xs text-amber-800 dark:text-amber-400 font-semibold">
              POLICY PENDING — AUTOMATIC ACTION RULES AWAITING OWNER APPROVAL
            </p>
            <p className="mt-1 text-[11px] text-amber-700/80 dark:text-amber-400/80">
              Under Owner Policy STD-001, automated business action triggers (e.g. discontinue, reorder, discount) require explicit owner policy gate sign-off.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-3">Audit Trail &amp; Verification</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Evaluation Timestamp</span>
                <span className="font-mono text-zinc-800 dark:text-zinc-200">{kpis.asOfTimestamp}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Evaluation Window</span>
                <span className="font-mono text-zinc-800 dark:text-zinc-200">
                  {kpis.period.periodStart} ~ {kpis.period.periodEnd} ({kpis.period.daysInPeriod} days)
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-zinc-500">Target Supabase Environment</span>
                <span className="font-mono text-zinc-800 dark:text-zinc-200">shzfrppdobpmrstcjfqu</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SECTION 8: DATA READINESS & REMEDIATION */}
      {/* ==================================================================== */}
      {activeSection === "readiness" && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold border ${readiness.gateBadgeColor}`}>
                  {readiness.gateLabel}
                </span>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white mt-1">
                  Product Data Readiness &amp; Investment Remediation Contract
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Authoritative review under Owner Decision D1, D2, and ADM-GRADING-DATA-002 specification.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsReadinessDrawerOpen(true)}
                className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-500 shadow-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                Open Slide-Over Evidence Drawer &rarr;
              </button>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs">
              <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/40">
                <span className="text-zinc-500 dark:text-zinc-400">Data Coverage</span>
                <p className="text-xl font-bold text-zinc-900 dark:text-white mt-1">
                  {readiness.dataCoveragePercent}%
                </p>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                  <div
                    style={{ width: `${readiness.dataCoveragePercent}%` }}
                    className={`h-full rounded-full ${
                      readiness.dataCoveragePercent >= 80
                        ? "bg-emerald-500"
                        : readiness.dataCoveragePercent >= 40
                        ? "bg-amber-500"
                        : "bg-rose-500"
                    }`}
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/40">
                <span className="text-zinc-500 dark:text-zinc-400">Cost Provenance</span>
                <p className="text-sm font-bold text-zinc-900 dark:text-white mt-1">
                  {readiness.costProvenanceLabel}
                </p>
                <span className="text-[10px] text-zinc-400 mt-1 block">
                  {readiness.isHistoricalCostVerified
                    ? "Verified Historical Cost (COGS/Margin)"
                    : "Provisional / Unverified Historical Cost"}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/40">
                <span className="text-zinc-500 dark:text-zinc-400">HQ Stock Valuation</span>
                <p className={`text-sm font-bold mt-1 ${readiness.isInventoryValuationPending ? "text-rose-600 dark:text-rose-400" : "text-zinc-900 dark:text-white"}`}>
                  {readiness.inventoryValuationDisplay}
                </p>
                <span className="text-[10px] text-zinc-400 mt-1 block">
                  {readiness.inventoryUnitsOnHand} units on hand
                </span>
              </div>
            </div>
          </div>

          {/* Active Deficiency Codes */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-3">
              Active Data Deficiency Reason Codes ({readiness.reasonCodes.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {readiness.reasonCodes.map((code) => (
                <div
                  key={code}
                  className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex items-center justify-between"
                >
                  <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{code}</span>
                  <span className="text-[10px] text-zinc-400">Action Required</span>
                </div>
              ))}
            </div>
          </div>

          {/* Remediation Action Plan */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-3">
              Actionable Remediation Plan ({readiness.remediationActions.length} Actions)
            </h3>
            <div className="space-y-2.5">
              {readiness.remediationActions.map((act, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-600 dark:text-blue-400 uppercase text-[10px]">
                      {act.team}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                        act.priority === "CRITICAL"
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                          : act.priority === "HIGH"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                      }`}>
                        {act.priority}
                      </span>
                      <span className="text-[10px] text-zinc-400">SLA: {act.sla}</span>
                    </div>
                  </div>
                  <p className="font-medium text-zinc-900 dark:text-white">{act.action}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sku Readiness Detail Drawer */}
      <SkuReadinessDrawer
        item={summary}
        isOpen={isReadinessDrawerOpen}
        onClose={() => setIsReadinessDrawerOpen(false)}
        asOfDate={new Date().toISOString().split("T")[0]}
      />
    </div>
  );
}
