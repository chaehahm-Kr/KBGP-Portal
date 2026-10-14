"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PerformanceDashboardData,
  ProductPerformanceItem,
  ReportingPeriod,
  ReorderCoverage,
} from "@/lib/retailer/performance";
import {
  PerformanceFilterBar,
  PerformanceKpiCard,
  PerformanceProductRow,
  DataReliabilityBadge,
} from "@/components/retailer/performance-ui";
import {
  PerformancePeriod,
  ReorderCoverageTarget,
  PerformanceProductRowData,
  MetricState,
  ReorderRecommendationSignal,
} from "@/components/retailer/performance-ui/types";

interface SalesPerformanceDashboardProps {
  data: PerformanceDashboardData;
}

export function SalesPerformanceDashboard({ data }: SalesPerformanceDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilterTab, setActiveFilterTab] = useState<
    "all" | "reorder_needed" | "needs_review" | "has_incoming"
  >("all");

  const {
    selectedPeriod,
    selectedCoverage,
    selectedStoreId,
    stores,
    dataCoverage,
    summary,
    products,
  } = data;

  const handlePeriodChange = (period: PerformancePeriod) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", period);
    startTransition(() => {
      router.push(`/sales?${params.toString()}`);
    });
  };

  const handleCoverageChange = (coverage: ReorderCoverageTarget) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("coverage", coverage);
    startTransition(() => {
      router.push(`/sales?${params.toString()}`);
    });
  };

  const handleStoreChange = (storeId: string | "all") => {
    const params = new URLSearchParams(searchParams.toString());
    if (storeId === "all") {
      params.delete("store");
    } else {
      params.set("store", storeId);
    }
    startTransition(() => {
      router.push(`/sales?${params.toString()}`);
    });
  };

  const handleSelectProduct = (productId: string) => {
    const storeParam = selectedStoreId && selectedStoreId !== "all" ? `&store=${selectedStoreId}` : "";
    router.push(`/sales/${productId}?coverage=${selectedCoverage}&period=${selectedPeriod}${storeParam}`);
  };

  // Filter products by search and filter tab
  const filteredProducts = products.filter((p) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        p.productName.toLowerCase().includes(q) ||
        (p.productNameEn && p.productNameEn.toLowerCase().includes(q)) ||
        p.sku.toLowerCase().includes(q) ||
        p.brandName.toLowerCase().includes(q);
      if (!match) return false;
    }

    if (activeFilterTab === "reorder_needed") {
      return p.suggestedReorderQty > 0;
    }
    if (activeFilterTab === "needs_review") {
      return p.financialStatus === "needs_review" || p.reorderSignal === "needs_review" || p.hasNegativeVariance;
    }
    if (activeFilterTab === "has_incoming") {
      return p.incomingQty > 0;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header & Coverage Notice */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              Product Performance
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
              P5/P6 Financial Analytics
            </span>
            {isPending && (
              <span className="text-xs text-zinc-500 animate-pulse flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                Updating...
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Weekly inventory count velocity, estimated retail revenue, gross margins, and MOQ-aligned reorder recommendations.
          </p>
        </div>

        {/* Action / Assurance Links */}
        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <Link
            href="/protection"
            className="py-1.5 px-3 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors inline-flex items-center gap-1.5 shadow-xs"
          >
            <span>🛡️</span>
            <span>90-Day Protection</span>
          </Link>
          <Link
            href="/check"
            className="py-1.5 px-3 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors inline-flex items-center gap-1.5 shadow-xs"
          >
            <span>📋</span>
            <span>Weekly Check</span>
          </Link>
        </div>
      </div>

      {/* Top 7 KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-3.5">
        {/* 1. Est. Units Sold */}
        <PerformanceKpiCard
          label="Est. Units Sold"
          value={summary.totalEstimatedMovement}
          state={summary.financialStatus as MetricState}
          format="units"
          iconName="sales"
          subtext={selectedPeriod === "all" ? "All-time total" : `Last ${selectedPeriod} estimate`}
        />

        {/* 2. Est. Retail Sales */}
        <PerformanceKpiCard
          label="Est. Retail Sales"
          value={summary.totalEstimatedRetailSales}
          state={summary.financialStatus as MetricState}
          format="currency"
          iconName="revenue"
          subtext="At MSRP / Tagged SRP"
        />

        {/* 3. Est. Gross Profit */}
        <PerformanceKpiCard
          label="Est. Gross Profit"
          value={summary.totalEstimatedGrossProfit}
          state={summary.financialStatus as MetricState}
          format="currency"
          iconName="profit"
          subtext="Sales - Wholesale Cost"
        />

        {/* 4. Weighted Gross Margin */}
        <PerformanceKpiCard
          label="Gross Margin"
          value={summary.averageGrossMargin}
          state={summary.financialStatus as MetricState}
          format="percent"
          iconName="margin"
          subtext="GP ÷ Sales (Weighted)"
        />

        {/* 5. Incoming Stock */}
        <PerformanceKpiCard
          label="Incoming Stock"
          value={summary.totalIncomingQty}
          state="available"
          format="units"
          iconName="incoming"
          subtext={`${summary.totalInTransitQty} in transit, ${summary.totalPendingQty} pending`}
        />

        {/* 6. Reorder Needed */}
        <PerformanceKpiCard
          label="Reorder Needed"
          value={summary.productsNeedingReorderCount}
          state="available"
          format="count"
          iconName="reorder"
          subtext={`Target: ${selectedCoverage}`}
        />

        {/* 7. Weekly Reporting Coverage */}
        <PerformanceKpiCard
          label="Reporting Coverage"
          value={dataCoverage.percent}
          state="available"
          format="percent"
          iconName="coverage"
          subtext={`${dataCoverage.reportingStores} of ${dataCoverage.totalStores} stores`}
        />
      </div>

      {/* P6 Integrated Filter Bar */}
      <PerformanceFilterBar
        stores={stores}
        selectedStoreId={selectedStoreId}
        onStoreChange={handleStoreChange}
        selectedPeriod={selectedPeriod as PerformancePeriod}
        onPeriodChange={handlePeriodChange}
        selectedCoverage={selectedCoverage as ReorderCoverageTarget}
        onCoverageChange={handleCoverageChange}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeFilterTab={activeFilterTab}
        onFilterTabChange={setActiveFilterTab}
        reorderNeededCount={summary.productsNeedingReorderCount}
        needsReviewCount={summary.skusNeedsReviewCount}
      />

      {/* Product List Table / Mobile Cards */}
      {filteredProducts.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-12 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl mx-auto">
            📦
          </div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
            No products found matching criteria
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
            {searchQuery
              ? `No products matching "${searchQuery}". Clear your search query to see all items.`
              : "Complete and submit weekly checks on the Weekly Check tab to establish observation intervals and unlock performance analytics."}
          </p>
          <div className="pt-2">
            <Link
              href="/check"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-xs"
            >
              Go to Weekly Check →
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/40 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  <th className="py-3 px-3">Product & SKU</th>
                  <th className="py-3 px-3 text-right">Est. Units Sold</th>
                  <th className="py-3 px-3 text-right">Est. Retail Sales</th>
                  <th className="py-3 px-3 text-right">Est. Gross Profit</th>
                  <th className="py-3 px-3 text-right">Reported Stock</th>
                  <th className="py-3 px-3 text-right">Incoming</th>
                  <th className="py-3 px-3 text-right">Avg Weekly</th>
                  <th className="py-3 px-3 text-right">Suggested Order</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                {filteredProducts.map((p) => {
                  const rowData: PerformanceProductRowData = {
                    productId: p.productId,
                    productName: p.productName,
                    productNameEn: p.productNameEn,
                    brandName: p.brandName,
                    sku: p.sku,
                    thumbnailUrl: p.thumbnailUrl,
                    categoryLabel: p.categoryLabel,
                    cartonPackQty: p.cartonPackQty,
                    wholesalePrice: p.wholesalePrice,
                    msrp: p.msrp,

                    periodEstUnitsSold: p.estimatedUnitsSold,
                    periodEstRetailSales: p.estimatedRetailSales,
                    periodEstGrossProfit: p.estimatedGrossProfit,
                    periodEstGrossMargin: p.estimatedGrossMargin,
                    financialState: p.financialStatus as MetricState,

                    reportedStock: p.totalReportedRemaining,
                    incomingQty: p.incomingQty,
                    avgWeeklySales: p.averageWeeklyMovement,

                    coverageTarget: selectedCoverage as ReorderCoverageTarget,
                    suggestedReorderQty: p.suggestedReorderQty,
                    suggestedCases: p.suggestedCases,
                    reorderSignal: p.reorderSignal as ReorderRecommendationSignal,

                    isOrderable: p.isOrderable,
                  };

                  return (
                    <PerformanceProductRow
                      key={p.productId}
                      product={rowData}
                      onSelectProduct={handleSelectProduct}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer with SKU counts and legal disclosure */}
          <div className="p-3.5 bg-zinc-50/50 dark:bg-zinc-800/20 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span>
              Showing {filteredProducts.length} of {products.length} assorted SKUs
            </span>
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
              *Estimates are calculated from submitted weekly counts and do not replace physical store POS tracking.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
