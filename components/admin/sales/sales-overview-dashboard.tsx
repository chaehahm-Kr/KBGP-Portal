"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  SalesOverviewDashboardData,
  DailySalesTrendPoint,
  BrandSalesMixItem,
  CategorySalesMixItem,
  DecliningStoreFact,
  DormantStoreFact,
  MissingCostProductFact,
  InventoryCoverageWarningFact,
  ExchangeActivityFact,
  ReportingGapStoreFact,
} from "@/lib/sales-overview/types";
import { fetchSalesOverviewAction } from "@/lib/sales-overview/overview-actions";

interface SalesOverviewDashboardProps {
  initialData: SalesOverviewDashboardData;
  initialBenchmarkMs?: number;
}

function formatCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(val);
}

function formatCurrencyExact(val: number | null | undefined): string {
  if (val === null || val === undefined) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

function formatPercent(val: number | null | undefined): string {
  if (val === null || val === undefined) return "N/A";
  return `${val.toFixed(1)}%`;
}

export function SalesOverviewDashboard({
  initialData,
  initialBenchmarkMs = 0,
}: SalesOverviewDashboardProps) {
  const router = useRouter();
  const [data, setData] = useState<SalesOverviewDashboardData>(initialData);
  const [benchmarkMs, setBenchmarkMs] = useState(initialBenchmarkMs);
  const [isPending, startTransition] = useTransition();
  const [selectedPeriod, setSelectedPeriod] = useState<"7D" | "30D" | "60D" | "90D" | "CUSTOM">(
    initialData.period.daysInPeriod === 7
      ? "7D"
      : initialData.period.daysInPeriod === 60
      ? "60D"
      : initialData.period.daysInPeriod === 90
      ? "90D"
      : "30D"
  );
  const [customStart, setCustomStart] = useState(initialData.period.currentPeriodStart);
  const [customEnd, setCustomEnd] = useState(initialData.period.currentPeriodEnd);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [activeActionTab, setActiveActionTab] = useState<
    "reorder" | "declining" | "cost" | "stockout" | "claims" | "reporting"
  >("reorder");
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Period change handler
  const handlePeriodChange = (periodKey: "7D" | "30D" | "60D" | "90D" | "CUSTOM") => {
    setSelectedPeriod(periodKey);
    if (periodKey === "CUSTOM") {
      setShowCustomPicker(true);
      return;
    }
    setShowCustomPicker(false);

    const daysMap = { "7D": 7, "30D": 30, "60D": 60, "90D": 90 };
    const lookbackDays = daysMap[periodKey];

    startTransition(async () => {
      setErrorMsg(null);
      const res = await fetchSalesOverviewAction({ lookbackDays });
      if (res.success && res.data) {
        setData(res.data);
        if (res.benchmarkMs) setBenchmarkMs(res.benchmarkMs);
      } else {
        setErrorMsg(res.error || "Failed to reload Sales Overview metrics.");
      }
    });
  };

  const handleCustomApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customStart || !customEnd) return;
    if (customStart >= customEnd) {
      setErrorMsg("Custom start date must precede end date.");
      return;
    }

    startTransition(async () => {
      setErrorMsg(null);
      const res = await fetchSalesOverviewAction({
        customRange: { start: customStart, end: customEnd },
      });
      if (res.success && res.data) {
        setData(res.data);
        if (res.benchmarkMs) setBenchmarkMs(res.benchmarkMs);
      } else {
        setErrorMsg(res.error || "Failed to load custom date range metrics.");
      }
    });
  };

  const { kpis, period, activeStoresCount, reconciliation, actionCenter, lastRefreshedAt } = data;

  const hasQualifiedSales = (kpis.b2bNetSales.value ?? 0) > 0 || kpis.salesGrowth.previousSales > 0;

  // Maximum value for daily sales trend bar chart scaling
  const maxTrendSales = Math.max(
    ...kpis.dailySalesTrend.map((p) => Math.max(p.currentNetSales, p.previousNetSales)),
    100 // Avoid divide by zero
  );

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
              V1.0 Canonical Service
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Evaluation: {period.currentPeriodStart} ~ {period.currentPeriodEnd} ({period.timezone})
            </span>
            {benchmarkMs > 0 && (
              <span className="hidden md:inline text-[11px] text-zinc-400">
                ({benchmarkMs}ms)
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white mt-1">
            Sales Overview (Executive Dashboard &amp; Action Center)
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            B2B Net Sales, verifiable Landed Cost Margins, Network Store Growth, and Factual Action Indicators across K SELECT Retail Network.
          </p>
        </div>

        {/* Period Selector Pills & Quick Links */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
            {(["7D", "30D", "60D", "90D", "CUSTOM"] as const).map((p) => (
              <button
                key={p}
                type="button"
                disabled={isPending}
                onClick={() => handlePeriodChange(p)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  selectedPeriod === p
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                } ${isPending ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {p === "30D" ? "30D (Default)" : p}
              </button>
            ))}
          </div>

          <Link
            href="/admin/sales?tab=sku"
            className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 shadow-sm transition-colors"
          >
            SKU Performance (V2.0) →
          </Link>
        </div>
      </div>

      {/* Custom Range Picker Drawer */}
      {showCustomPicker && (
        <form
          onSubmit={handleCustomApply}
          className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 flex flex-wrap items-center gap-3 text-xs"
        >
          <span className="font-semibold text-zinc-900 dark:text-white">Custom Range (ET):</span>
          <div className="flex items-center gap-1.5">
            <label className="text-zinc-500">From:</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-zinc-500">To:</label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-zinc-900 px-3 py-1 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 font-semibold"
          >
            {isPending ? "Loading..." : "Apply Range"}
          </button>
        </form>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
          <p className="font-semibold text-white">Error updating Sales Overview:</p>
          <p className="mt-1">{errorMsg}</p>
        </div>
      )}

      {/* Phase 2: 6 Executive KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* Card 1: B2B Net Sales */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-medium">B2B Net Sales</span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {kpis.b2bNetSales.status}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white">
              {kpis.b2bNetSales.formatted}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px]">
            <span className="text-zinc-500 dark:text-zinc-400">vs Prior {period.daysInPeriod}D</span>
            <span
              className={`font-semibold ${
                kpis.salesGrowth.percent !== null && kpis.salesGrowth.percent > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : kpis.salesGrowth.percent !== null && kpis.salesGrowth.percent < 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {kpis.salesGrowth.label}
            </span>
          </div>
          <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500 leading-tight">
            Excl. tax, shipping, refunds. Exch credit = payment.
          </p>
        </div>

        {/* Card 2: Gross Profit */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-medium">Gross Profit</span>
            {kpis.grossProfit.status === "ACTUAL" ? (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                ACTUAL
              </span>
            ) : (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-400">
                COST MISSING
              </span>
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white">
              {kpis.grossProfit.formatted}
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            Cost Coverage: {formatPercent(kpis.dataCompleteness.costCoveragePercent)}
          </p>
          <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500 leading-tight">
            Verifiable Landed Cost FIFO. No arbitrary fallback.
          </p>
        </div>

        {/* Card 3: Gross Margin */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-medium">Gross Margin</span>
            <span className="text-xs text-zinc-400">%</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white">
              {kpis.grossMargin.formatted}
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            Weighted Network Margin
          </p>
          <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500 leading-tight">
            Strictly N/A when Landed COGS is incomplete.
          </p>
        </div>

        {/* Card 4: Ordering Stores */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-medium">Ordering Stores</span>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
              {kpis.orderingStores.status}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white">
              {kpis.orderingStores.value ?? 0}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              / {activeStoresCount} active
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            {formatPercent(
              activeStoresCount > 0
                ? ((kpis.orderingStores.value ?? 0) / activeStoresCount) * 100
                : 0
            )}{" "}
            active penetration
          </p>
          <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500 leading-tight">
            Distinct network retail stores ordering in period.
          </p>
        </div>

        {/* Card 5: Reorder Rate */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-medium">Reorder Rate</span>
            <span className="text-xs text-zinc-400">%</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white">
              {kpis.reorderRate.formatted}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              ({kpis.reorderStores.value ?? 0} reordered)
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            Reorder Stores / Ordering Stores
          </p>
          <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500 leading-tight">
            Stores with at least one prior order in history.
          </p>
        </div>

        {/* Card 6: HQ Inventory Value */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-medium">HQ Inventory Value</span>
            <span className="text-[10px] font-semibold text-zinc-400">AS-OF TODAY</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white">
              {kpis.hqInventoryValue.formatted}
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            FIFO Warehouse Stock
          </p>
          <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500 leading-tight">
            Actual on-hand units valued at layer Landed Cost.
          </p>
        </div>
      </div>

      {/* Phase 3: Sales Trend & Comparison Chart */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
              Daily B2B Net Sales Trend &amp; Period Comparison
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Current Period ({period.currentPeriodStart} ~ {period.currentPeriodEnd}) vs Prior Equal-Length Period ({period.previousPeriodStart} ~ {period.previousPeriodEnd})
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-zinc-900 dark:bg-white" />
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Current Period ({kpis.b2bNetSales.formatted})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-zinc-300 dark:bg-zinc-700" />
              <span className="text-zinc-500 dark:text-zinc-400">Prior Period (${kpis.salesGrowth.previousSales.toLocaleString()})</span>
            </div>
          </div>
        </div>

        {/* Interactive Bar Chart Visualization or Compact Empty State */}
        <div className="mt-6">
          {hasQualifiedSales ? (
            <div className="flex h-44 items-end gap-1.5 sm:gap-2 px-1 pb-2 pt-4">
              {kpis.dailySalesTrend.map((pt, idx) => {
                const curHeight = (pt.currentNetSales / maxTrendSales) * 100;
                const prevHeight = (pt.previousNetSales / maxTrendSales) * 100;
                const isHovered = hoveredTrendIndex === idx;

                return (
                  <div
                    key={pt.date}
                    onMouseEnter={() => setHoveredTrendIndex(idx)}
                    onMouseLeave={() => setHoveredTrendIndex(null)}
                    className="group relative flex flex-1 flex-col items-center justify-end h-full cursor-pointer"
                  >
                    {/* Tooltip Popup on Hover */}
                    {isHovered && (
                      <div className="absolute -top-20 z-20 whitespace-nowrap rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-[10px] text-white shadow-xl dark:border-zinc-700 dark:bg-zinc-950 pointer-events-none">
                        <p className="font-bold text-zinc-200">{pt.date}</p>
                        <p className="text-emerald-400">
                          Current: ${pt.currentNetSales.toLocaleString()} ({pt.currentOrdersCount} ord)
                        </p>
                        <p className="text-zinc-400">
                          Prior: ${pt.previousNetSales.toLocaleString()} ({pt.previousOrdersCount} ord)
                        </p>
                      </div>
                    )}

                    {/* Bars side-by-side or stacked */}
                    <div className="flex w-full items-end justify-center gap-0.5 h-36">
                      <div
                        style={{ height: `${Math.max(4, curHeight)}%` }}
                        className={`w-full max-w-[12px] rounded-t transition-all ${
                          pt.currentNetSales > 0
                            ? "bg-zinc-900 hover:bg-zinc-700 dark:bg-white dark:hover:bg-zinc-200"
                            : "bg-zinc-100 dark:bg-zinc-800"
                        }`}
                      />
                      <div
                        style={{ height: `${Math.max(2, prevHeight)}%` }}
                        className={`w-full max-w-[12px] rounded-t transition-all ${
                          pt.previousNetSales > 0
                            ? "bg-zinc-300 hover:bg-zinc-400 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                            : "bg-zinc-50 dark:bg-zinc-900"
                        }`}
                      />
                    </div>
                    <span className="mt-1 text-[9px] text-zinc-400 truncate max-w-full">
                      {idx % Math.ceil(kpis.dailySalesTrend.length / 10) === 0 ? pt.dayLabel : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-[175px] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-6 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="mt-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                No Qualified B2B Sales Activity
              </p>
              <p className="mt-1 max-w-md text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                No non-test qualified B2B sales were completed in the evaluated {period.daysInPeriod}-day period ({period.currentPeriodStart} ~ {period.currentPeriodEnd}) or prior comparison period.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Phase 4 & Phase 5: Two-Column Layout (Network Performance + Brand/Category Mix) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Phase 4: Network Store Performance Card */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                Network Store Performance
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                B2B order participation and store retention metrics
              </p>
            </div>
            <Link
              href="/admin/retailers"
              className="text-xs font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              View Stores →
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 text-xs">
            <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
              <span className="text-zinc-500 dark:text-zinc-400">Active Stores</span>
              <p className="text-lg font-bold text-zinc-900 dark:text-white mt-1">
                {activeStoresCount}
              </p>
              <span className="text-[10px] text-zinc-400">Network Registered</span>
            </div>

            <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
              <span className="text-zinc-500 dark:text-zinc-400">Ordering Stores</span>
              <p className="text-lg font-bold text-zinc-900 dark:text-white mt-1">
                {kpis.orderingStores.value ?? 0}
              </p>
              <span className="text-[10px] text-zinc-400">Ordered in Period</span>
            </div>

            <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
              <span className="text-zinc-500 dark:text-zinc-400">Reorder Stores</span>
              <p className="text-lg font-bold text-zinc-900 dark:text-white mt-1">
                {kpis.reorderStores.value ?? 0}
              </p>
              <span className="text-[10px] text-zinc-400">Repeat Buyers</span>
            </div>

            <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
              <span className="text-zinc-500 dark:text-zinc-400">Reorder Rate</span>
              <p className="text-lg font-bold text-zinc-900 dark:text-white mt-1">
                {kpis.reorderRate.formatted}
              </p>
              <span className="text-[10px] text-zinc-400">Repeat / Ordering</span>
            </div>

            <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
              <span className="text-zinc-500 dark:text-zinc-400">Sales / Ordering Store</span>
              <p className="text-lg font-bold text-zinc-900 dark:text-white mt-1">
                {kpis.orderingStores.value && kpis.orderingStores.value > 0
                  ? formatCurrency((kpis.b2bNetSales.value ?? 0) / kpis.orderingStores.value)
                  : "N/A"}
              </p>
              <span className="text-[10px] text-zinc-400">Period Average</span>
            </div>

            <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
              <span className="text-zinc-500 dark:text-zinc-400">Store Attribution</span>
              <p className="text-lg font-bold text-zinc-900 dark:text-white mt-1">
                {formatPercent(kpis.dataCompleteness.storeAttributionRatePercent)}
              </p>
              <span className="text-[10px] text-zinc-400">Attributed to Stores</span>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/30 text-[11px] text-zinc-500 dark:text-zinc-400">
            <p>
              <strong>Reconciliation Status:</strong> {reconciliation.isStoreReconciled ? "✓ Store Net Sales Reconciled ($0 discrepancy)" : "⚠ Store Sales Discrepancy Detected"}
            </p>
            <p className="mt-0.5 text-[10px] text-zinc-400">
              Store-attributed: ${reconciliation.storeAttributedSales.toLocaleString()} | Unallocated company orders: ${reconciliation.companyUnallocatedSales.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Phase 5: Brand & Category Sales Mix */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                Brand &amp; Category Sales Mix
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Top revenue contributors in selected period
              </p>
            </div>
            <Link
              href="/admin/products"
              className="text-xs font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              View Products →
            </Link>
          </div>

          <div className="mt-4 space-y-4 text-xs">
            {/* Top Brands */}
            <div>
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Top Brands by Net Sales</span>
              {kpis.brandSalesMix.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {kpis.brandSalesMix.slice(0, 4).map((b) => (
                    <div key={b.brandId} className="flex items-center justify-between">
                      <span className="font-medium text-zinc-900 dark:text-white truncate max-w-[180px]">
                        {b.brandName}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-zinc-500">{b.unitsSold} units</span>
                        <span className="font-bold text-zinc-900 dark:text-white">
                          ${b.netSalesDollars.toLocaleString()}
                        </span>
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          {b.sharePercent.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-zinc-400 text-[11px]">No brand sales recorded in this period.</p>
              )}
            </div>

            {/* Top Categories */}
            <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Top Categories</span>
              {kpis.categorySalesMix.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {kpis.categorySalesMix.slice(0, 4).map((c) => (
                    <div key={c.categoryId} className="flex items-center justify-between">
                      <span className="font-medium text-zinc-900 dark:text-white truncate max-w-[180px]">
                        {c.categoryName}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-zinc-500">{c.unitsSold} units</span>
                        <span className="font-bold text-zinc-900 dark:text-white">
                          ${c.netSalesDollars.toLocaleString()}
                        </span>
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          {c.sharePercent.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-zinc-400 text-[11px]">No category sales recorded in this period.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Phase 6: Inventory Position & 90-Day Exchange Exposure */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-100 pb-3 dark:border-zinc-800">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
            Inventory Valuation &amp; 90-Day Exchange Exposure
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Real-time warehouse capital deployment and exchange claim exposure
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40">
            <span className="text-zinc-500 dark:text-zinc-400">HQ Inventory Valuation</span>
            <p className="text-lg font-bold text-zinc-900 dark:text-white mt-1">
              {kpis.hqInventoryValue.formatted}
            </p>
            <span className="text-[10px] text-zinc-400">FIFO Active Warehouse Stock</span>
          </div>

          <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40">
            <span className="text-zinc-500 dark:text-zinc-400">Protected Store Cohorts</span>
            <p className="text-lg font-bold text-zinc-900 dark:text-white mt-1">
              {kpis.exchangeExposure.activeProtectedStoresCount}
            </p>
            <span className="text-[10px] text-zinc-400">90-Day Policy Eligible Stores</span>
          </div>

          <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40">
            <span className="text-zinc-500 dark:text-zinc-400">Submitted Exchange Claims</span>
            <p className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-1">
              ${kpis.exchangeExposure.submittedClaimDollars.toLocaleString()}
            </p>
            <span className="text-[10px] text-zinc-400">
              {kpis.exchangeExposure.submittedClaimsCount} total claims ({kpis.exchangeExposure.pendingReviewClaimsCount} pending review)
            </span>
          </div>

          <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40">
            <span className="text-zinc-500 dark:text-zinc-400">Settled Credit Redemptions</span>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              ${kpis.exchangeExposure.settledClaimDollars.toLocaleString()}
            </p>
            <span className="text-[10px] text-zinc-400">Redeemed in Checkout Tender</span>
          </div>
        </div>

        <p className="mt-3 text-[11px] text-zinc-400 dark:text-zinc-500">
          <strong>Policy Note:</strong> Submitted exchange claims are recorded as potential contingent exposure; only approved and redeemed credits in Checkout are recognized as settled liabilities.
        </p>
      </div>

      {/* Phase 7: Action Center (6 Factual Operational Categories) */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Executive Action Center
                </h2>
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  FACTUAL AUDIT
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Deterministic operational exceptions requiring staff or buyer follow-up.
              </p>
            </div>
            <div className="text-[11px] text-zinc-400">
              Zero automated mutations under Owner Policy STD-001
            </div>
          </div>

          {/* Action Center Tabs */}
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={() => setActiveActionTab("reorder")}
              className={`rounded-lg px-3 py-1.5 font-semibold transition-colors flex items-center gap-1.5 ${
                activeActionTab === "reorder"
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              <span>1. Reorder Attention</span>
              <span className="rounded-full bg-zinc-200 px-1.5 py-0.2 text-[10px] font-bold text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200">
                {actionCenter.dormantStores.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveActionTab("declining")}
              className={`rounded-lg px-3 py-1.5 font-semibold transition-colors flex items-center gap-1.5 ${
                activeActionTab === "declining"
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              <span>2. Declining Stores</span>
              <span className="rounded-full bg-zinc-200 px-1.5 py-0.2 text-[10px] font-bold text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200">
                {actionCenter.decliningStores.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveActionTab("cost")}
              className={`rounded-lg px-3 py-1.5 font-semibold transition-colors flex items-center gap-1.5 ${
                activeActionTab === "cost"
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              <span>3. Missing Cost Provenance</span>
              <span className="rounded-full bg-zinc-200 px-1.5 py-0.2 text-[10px] font-bold text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200">
                {actionCenter.missingCostProducts.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveActionTab("stockout")}
              className={`rounded-lg px-3 py-1.5 font-semibold transition-colors flex items-center gap-1.5 ${
                activeActionTab === "stockout"
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              <span>4. HQ Out-of-Stock / Low DOS</span>
              <span className="rounded-full bg-zinc-200 px-1.5 py-0.2 text-[10px] font-bold text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200">
                {actionCenter.inventoryCoverageWarnings.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveActionTab("claims")}
              className={`rounded-lg px-3 py-1.5 font-semibold transition-colors flex items-center gap-1.5 ${
                activeActionTab === "claims"
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              <span>5. Exchange Claims</span>
              <span className="rounded-full bg-zinc-200 px-1.5 py-0.2 text-[10px] font-bold text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200">
                {actionCenter.exchangeActivities.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveActionTab("reporting")}
              className={`rounded-lg px-3 py-1.5 font-semibold transition-colors flex items-center gap-1.5 ${
                activeActionTab === "reporting"
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              <span>6. Reporting Gaps</span>
              <span className="rounded-full bg-zinc-200 px-1.5 py-0.2 text-[10px] font-bold text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200">
                {actionCenter.reportingGapStores.length}
              </span>
            </button>
          </div>
        </div>

        {/* Action Center Content List */}
        <div className="p-5">
          {activeActionTab === "reorder" && (
            <div>
              <p className="text-xs text-zinc-500 mb-3">
                Stores that ordered in previous periods but have not placed an order in the current {period.daysInPeriod}-day window.
              </p>
              {actionCenter.dormantStores.length > 0 ? (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                  {actionCenter.dormantStores.map((s) => (
                    <div key={s.storeId} className="py-2.5 flex items-center justify-between">
                      <div>
                        <Link
                          href={`/admin/retailers/${s.storeId}`}
                          className="font-bold text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {s.storeName}
                        </Link>
                        <span className="text-zinc-500 dark:text-zinc-400 ml-2">
                          ({s.companyName}{s.city ? ` · ${s.city}, ${s.state}` : ""})
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-zinc-500">
                          Prior Sales: ${s.previousSalesDollars.toLocaleString()}
                        </span>
                        <span className="text-amber-600 dark:text-amber-400">
                          {s.daysSinceLastOrder !== null ? `${s.daysSinceLastOrder}d since last order` : "No order in window"}
                        </span>
                        <Link
                          href={`/admin/retailers/${s.storeId}`}
                          className="rounded bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                        >
                          View Store →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-400">No dormant reorder stores detected.</p>
              )}
            </div>
          )}

          {activeActionTab === "declining" && (
            <div>
              <p className="text-xs text-zinc-500 mb-3">
                Stores whose B2B Net Sales decreased in the current period compared to the preceding equal-length period.
              </p>
              {actionCenter.decliningStores.length > 0 ? (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                  {actionCenter.decliningStores.map((s) => (
                    <div key={s.storeId} className="py-2.5 flex items-center justify-between">
                      <div>
                        <Link
                          href={`/admin/retailers/${s.storeId}`}
                          className="font-bold text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {s.storeName}
                        </Link>
                        <span className="text-zinc-500 dark:text-zinc-400 ml-2">
                          ({s.companyName})
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-zinc-500">
                          ${s.previousSalesDollars.toLocaleString()} → ${s.currentSalesDollars.toLocaleString()}
                        </span>
                        <span className="font-semibold text-rose-600 dark:text-rose-400">
                          -${s.declineDollars.toLocaleString()} (-{s.declinePercent.toFixed(1)}%)
                        </span>
                        <Link
                          href={`/admin/retailers/${s.storeId}`}
                          className="rounded bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                        >
                          View Store →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-400">No declining store sales detected in this period.</p>
              )}
            </div>
          )}

          {activeActionTab === "cost" && (
            <div>
              <p className="text-xs text-zinc-500 mb-3">
                Products ordered in this period that lack verified Landed Cost records, causing Gross Profit to resolve to N/A.
              </p>
              {actionCenter.missingCostProducts.length > 0 ? (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                  {actionCenter.missingCostProducts.map((p) => (
                    <div key={p.productId} className="py-2.5 flex items-center justify-between">
                      <div>
                        <Link
                          href={`/admin/sales/sku/${p.productId}`}
                          className="font-bold text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {p.name}
                        </Link>
                        <span className="font-mono text-zinc-400 ml-2">({p.sku})</span>
                        <span className="text-zinc-500 ml-2">Brand: {p.brandName}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-zinc-500">
                          {p.unitsSoldInPeriod} units sold (${p.netSalesInPeriod.toLocaleString()})
                        </span>
                        <span className="rounded bg-amber-100 px-2 py-0.5 font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-400 text-[10px]">
                          REQUIRES LANDED COST
                        </span>
                        <Link
                          href={`/admin/sales/sku/${p.productId}`}
                          className="rounded bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                        >
                          Inspect SKU →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  ✓ 100% of order lines in this period have verified historical Landed Cost.
                </p>
              )}
            </div>
          )}

          {activeActionTab === "stockout" && (
            <div>
              <p className="text-xs text-zinc-500 mb-3">
                Products with 0 HQ available units or low Days of Supply based on current velocity.
              </p>
              {actionCenter.inventoryCoverageWarnings.length > 0 ? (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                  {actionCenter.inventoryCoverageWarnings.map((item) => (
                    <div key={item.productId} className="py-2.5 flex items-center justify-between">
                      <div>
                        <Link
                          href={`/admin/sales/sku/${item.productId}`}
                          className="font-bold text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {item.name}
                        </Link>
                        <span className="font-mono text-zinc-400 ml-2">({item.sku})</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-semibold text-rose-600 dark:text-rose-400">
                          {item.currentHqAvailableUnits === 0 ? "Out of Stock" : `${item.currentHqAvailableUnits} units available`}
                        </span>
                        <span className="text-zinc-500">
                          {item.daysOfSupply !== null ? `${item.daysOfSupply} DOS` : "Velocity N/A"}
                        </span>
                        <Link
                          href={`/admin/sales/sku/${item.productId}`}
                          className="rounded bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                        >
                          Inspect SKU →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-400">No confirmed HQ stockout alerts for active catalog products.</p>
              )}
            </div>
          )}

          {activeActionTab === "claims" && (
            <div>
              <p className="text-xs text-zinc-500 mb-3">
                Recent retailer 90-day exchange claims pending review or authorization.
              </p>
              {actionCenter.exchangeActivities.length > 0 ? (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                  {actionCenter.exchangeActivities.map((c) => (
                    <div key={c.claimId} className="py-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-zinc-900 dark:text-white">
                          Claim #{c.claimNumber}
                        </span>
                        <span className="text-zinc-500 ml-2">Store: {c.storeName}</span>
                        <span className="text-zinc-400 ml-2">({c.claimDate.slice(0, 10)})</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-amber-600 dark:text-amber-400">
                          ${c.totalClaimAmountDollars.toLocaleString()}
                        </span>
                        <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          {c.status}
                        </span>
                        <Link
                          href="/admin/exchange-credit"
                          className="rounded bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
                        >
                          Review in Claims →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-400">No exchange claims submitted in this evaluation period.</p>
              )}
            </div>
          )}

          {activeActionTab === "reporting" && (
            <div>
              <p className="text-xs text-zinc-500 mb-3">
                Active stores that failed to submit weekly check inventory counts in the evaluation period.
              </p>
              {actionCenter.reportingGapStores.length > 0 ? (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                  {actionCenter.reportingGapStores.map((r) => (
                    <div key={r.storeId} className="py-2.5 flex items-center justify-between">
                      <div>
                        <Link
                          href={`/admin/retailers/${r.storeId}`}
                          className="font-bold text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {r.storeName}
                        </Link>
                        <span className="text-zinc-500 ml-2">({r.companyName})</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-amber-600 dark:text-amber-400">
                          {r.missedWeeksCount} missing weekly reports
                        </span>
                        <Link
                          href={`/admin/retailers/${r.storeId}`}
                          className="rounded bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                        >
                          View Store →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-400">No active store weekly reporting gaps detected.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
