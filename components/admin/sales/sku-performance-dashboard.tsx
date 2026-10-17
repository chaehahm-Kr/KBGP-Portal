"use client";

import React, { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type {
  ProductPerformanceQueryResult,
  ProductPerformanceSummary,
  ProductPerformanceQueryOptions,
} from "@/lib/product/performance/types";
import { fetchProductPerformancePageAction } from "@/lib/product/performance/performance-actions";

interface FilterOption {
  id?: string;
  code?: string;
  name: string;
}

interface SkuPerformanceDashboardProps {
  initialResult: ProductPerformanceQueryResult;
  brands: FilterOption[];
  categories: FilterOption[];
}

// Format currency safely
function formatCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(val);
}

// Risk badge styling
function getRiskBadge(risk: string): { label: string; color: string } {
  switch (risk) {
    case "OUT_OF_STOCK":
      return {
        label: "Out of Stock",
        color: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50",
      };
    case "LOW_STOCK_RISK":
      return {
        label: "Low Stock",
        color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50",
      };
    case "LOW_REPORTING_COMPLIANCE":
      return {
        label: "Low Reporting",
        color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50",
      };
    case "NO_SALES_RECORD":
      return {
        label: "No Orders Yet",
        color: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
      };
    case "EXCHANGE_SPIKE":
      return {
        label: "Exchange Spike",
        color: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50",
      };
    case "HEALTHY":
      return {
        label: "Healthy",
        color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50",
      };
    default:
      return {
        label: risk.replace(/_/g, " "),
        color: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
      };
  }
}

export function SkuPerformanceDashboard({
  initialResult,
  brands,
  categories,
}: SkuPerformanceDashboardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<ProductPerformanceQueryResult>(initialResult);

  // Filter States
  const [search, setSearch] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [lookbackDays, setLookbackDays] = useState(60);
  const [sortBy, setSortBy] = useState<"sales" | "profit" | "inventory" | "confidence" | "name">("sales");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reload data from server action
  const loadData = (options: {
    page?: number;
    days?: number;
    brand?: string;
    cat?: string;
    query?: string;
    size?: number;
  }) => {
    startTransition(async () => {
      setErrorMsg(null);
      const res = await fetchProductPerformancePageAction({
        page: options.page ?? currentPage,
        pageSize: options.size ?? pageSize,
        lookbackDays: options.days ?? lookbackDays,
        brandId: options.brand ?? (selectedBrand || undefined),
        categoryId: options.cat ?? (selectedCategory || undefined),
        searchQuery: options.query !== undefined ? options.query : (search || undefined),
      });

      if (res.success && res.data) {
        setData(res.data);
        if (options.page !== undefined) setCurrentPage(options.page);
      } else {
        setErrorMsg(res.error || "Failed to load performance metrics.");
      }
    });
  };

  const handlePeriodChange = (days: number) => {
    setLookbackDays(days);
    setCurrentPage(1);
    loadData({ days, page: 1 });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadData({ query: search, page: 1 });
  };

  const handleBrandChange = (brandId: string) => {
    setSelectedBrand(brandId);
    setCurrentPage(1);
    loadData({ brand: brandId, page: 1 });
  };

  const handleCategoryChange = (catCode: string) => {
    setSelectedCategory(catCode);
    setCurrentPage(1);
    loadData({ cat: catCode, page: 1 });
  };

  const handleResetFilters = () => {
    setSearch("");
    setSelectedBrand("");
    setSelectedCategory("");
    setCurrentPage(1);
    loadData({ query: "", brand: "", cat: "", page: 1 });
  };

  // Client-side sorting on retrieved page items
  const sortedItems = useMemo(() => {
    const items = [...data.items];
    switch (sortBy) {
      case "sales":
        return items.sort(
          (a, b) => (b.kpis.financial.b2bNetSales.value || 0) - (a.kpis.financial.b2bNetSales.value || 0)
        );
      case "profit":
        return items.sort((a, b) => {
          const profA = a.kpis.financial.grossProfit.value;
          const profB = b.kpis.financial.grossProfit.value;
          if (profA === null && profB === null) return 0;
          if (profA === null) return 1;
          if (profB === null) return -1;
          return profB - profA;
        });
      case "inventory":
        return items.sort(
          (a, b) => (b.kpis.inventory.hqInventoryValue.value || 0) - (a.kpis.inventory.hqInventoryValue.value || 0)
        );
      case "confidence":
        return items.sort((a, b) => b.overallDataConfidence - a.overallDataConfidence);
      case "name":
        return items.sort((a, b) => a.productName.localeCompare(b.productName));
      default:
        return items;
    }
  }, [data.items, sortBy]);

  const kpiSummary = data.kpiSummary;

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
              V2.0 Engine
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Evaluation As Of: {data.period.asOfDate} ({data.period.timezone})
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white mt-1">
            SKU Performance (Product Performance V2.0)
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            B2B Net Sales, verifiable Landed Cost Profitability, HQ Inventory, and 90-Day Exchange Risk across all catalog SKUs.
          </p>
        </div>

        {/* Period Selector Pills */}
        <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
          {[30, 60, 90, 180].map((d) => (
            <button
              key={d}
              type="button"
              disabled={isPending}
              onClick={() => handlePeriodChange(d)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                lookbackDays === d
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              {d === 60 ? `${d}d (Default)` : `${d}d`}
            </button>
          ))}
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
          <p className="font-semibold text-white">Error loading SKU performance:</p>
          <p className="mt-1">{errorMsg}</p>
        </div>
      )}

      {/* 6 KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* Card 1: B2B Net Sales */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-medium">B2B Net Sales</span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">ACTUAL</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white">
              {formatCurrency(kpiSummary?.totalB2bNetSales ?? 0)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            Excludes tax, shipping &amp; refunds
          </p>
        </div>

        {/* Card 2: Gross Profit */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-medium">Gross Profit</span>
            {kpiSummary?.hasMissingCostProvenance ? (
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">PARTIAL</span>
            ) : (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">ACTUAL</span>
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white">
              {kpiSummary?.totalGrossProfit !== null ? formatCurrency(kpiSummary?.totalGrossProfit) : "N/A"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            {kpiSummary?.hasMissingCostProvenance
              ? "Requires historical landed cost"
              : "B2B Net Sales - Landed COGS"}
          </p>
        </div>

        {/* Card 3: Gross Margin */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-medium">Gross Margin</span>
            <span className="text-xs font-bold text-zinc-400">%</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white">
              {kpiSummary?.aggregateGrossMargin !== null && kpiSummary?.aggregateGrossMargin !== undefined
                ? `${kpiSummary.aggregateGrossMargin}%`
                : "N/A"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            Weighted catalog gross margin
          </p>
        </div>

        {/* Card 4: HQ Inventory Value */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-medium">HQ Inventory Value</span>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">FIFO</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white">
              {kpiSummary?.totalHqInventoryValue !== null
                ? formatCurrency(kpiSummary?.totalHqInventoryValue)
                : "N/A"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            {kpiSummary?.totalAvailableUnits ?? 0} available units on-hand
          </p>
        </div>

        {/* Card 5: Unique Exchange Claiming Stores */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-medium">Exchange Stores</span>
            <span className="text-xs font-bold text-zinc-400">90-Day</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white">
              {kpiSummary?.uniqueExchangeClaimingStores ?? 0}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">stores</span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            Distinct claiming store count
          </p>
        </div>

        {/* Card 6: Products Needing Action */}
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-4 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-400">
            <span className="text-xs font-medium">Needing Action</span>
            <span className="rounded bg-amber-200/60 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
              POLICY GATE
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg font-bold tracking-tight text-amber-900 dark:text-amber-300">
              POLICY PENDING
            </span>
          </div>
          <p className="mt-1 text-[10px] text-amber-700/80 dark:text-amber-400/70 leading-tight">
            Grading actions pending Owner normalization
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search Input Form */}
          <form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by product name, Korean title, or SKU..."
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-colors whitespace-nowrap"
            >
              Search
            </button>
          </form>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Brand Filter */}
            <select
              value={selectedBrand}
              onChange={(e) => handleBrandChange(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            >
              <option value="">All Brands ({brands.length})</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            >
              <option value="">All Categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            >
              <option value="sales">Sort: Net Sales (High to Low)</option>
              <option value="profit">Sort: Gross Profit (High to Low)</option>
              <option value="inventory">Sort: HQ Inventory Value (High to Low)</option>
              <option value="confidence">Sort: Data Confidence (High to Low)</option>
              <option value="name">Sort: Product Name (A-Z)</option>
            </select>

            {/* Clear Filters Button */}
            {(search || selectedBrand || selectedCategory) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SKU Performance Table */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
              SKU Performance List ({data.totalCount} Products)
            </span>
            {isPending && (
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 animate-pulse">
                Updating...
              </span>
            )}
          </div>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Page {data.page} of {Math.max(1, data.totalPages)} ({data.benchmarkMs}ms)
          </span>
        </div>

        {/* Local Responsive Table Container (Rule 27 compliance) */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/75 font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-300">
                <th className="py-3 px-4 min-w-[240px]">Product / SKU</th>
                <th className="py-3 px-3 min-w-[120px]">Brand</th>
                <th className="py-3 px-3 text-right min-w-[110px]">B2B Net Sales</th>
                <th className="py-3 px-3 text-right min-w-[120px]">Gross Profit / Margin</th>
                <th className="py-3 px-3 text-right min-w-[120px]">HQ Inventory</th>
                <th className="py-3 px-3 text-center min-w-[100px]">Exchange Stores</th>
                <th className="py-3 px-3 text-center min-w-[110px]">Grade Status</th>
                <th className="py-3 px-3 text-center min-w-[130px]">Risk Flags</th>
                <th className="py-3 px-3 text-center min-w-[100px]">Confidence</th>
                <th className="py-3 px-4 text-right min-w-[110px]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {sortedItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-zinc-500 dark:text-zinc-400">
                    <p className="text-sm font-semibold">No products found</p>
                    <p className="mt-1 text-xs">Try clearing filters or adjusting your search keyword.</p>
                  </td>
                </tr>
              ) : (
                sortedItems.map((item) => {
                  const grossProfitVal = item.kpis.financial.grossProfit.value;
                  const grossMarginVal = item.kpis.financial.grossMargin.value;
                  const hqVal = item.kpis.inventory.hqInventoryValue.value;
                  const availUnits = item.kpis.inventory.hqAvailableUnits.value ?? 0;
                  const claimingStores = item.kpis.exchange.uniqueClaimingStoreCount.value ?? 0;

                  return (
                    <tr
                      key={item.productId}
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      {/* Product Thumbnail & Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
                            {item.imageUrl ? (
                              <Image
                                src={item.imageUrl}
                                alt={item.productName}
                                fill
                                sizes="40px"
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center font-bold text-zinc-400 dark:text-zinc-500 text-xs">
                                {item.productName.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/admin/sales/sku/${item.productId}`}
                              className="font-semibold text-zinc-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400 truncate block text-xs"
                            >
                              {item.productName}
                            </Link>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                              <span>SKU: {item.sku}</span>
                              {item.category.name && (
                                <>
                                  <span>•</span>
                                  <span className="font-sans truncate text-[10px] text-zinc-400">
                                    {item.category.name}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Brand */}
                      <td className="py-3 px-3 text-zinc-700 dark:text-zinc-300 font-medium">
                        <span className="truncate block max-w-[120px]">{item.brand.name}</span>
                      </td>

                      {/* B2B Net Sales */}
                      <td className="py-3 px-3 text-right">
                        <div className="font-semibold text-zinc-900 dark:text-white">
                          {formatCurrency(item.kpis.financial.b2bNetSales.value)}
                        </div>
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                          {item.kpis.financial.totalUnitsSold.value ?? 0} units sold
                        </div>
                      </td>

                      {/* Gross Profit / Margin */}
                      <td className="py-3 px-3 text-right">
                        {grossProfitVal !== null ? (
                          <>
                            <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(grossProfitVal)}
                            </div>
                            <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                              {grossMarginVal !== null ? `${grossMarginVal}% margin` : "N/A"}
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                              Cost Missing
                            </span>
                            <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                              N/A Profit
                            </div>
                          </>
                        )}
                      </td>

                      {/* HQ Inventory */}
                      <td className="py-3 px-3 text-right">
                        {hqVal !== null ? (
                          <>
                            <div className="font-semibold text-zinc-900 dark:text-white">
                              {formatCurrency(hqVal)}
                            </div>
                            <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                              {availUnits} avail units
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="font-semibold text-zinc-900 dark:text-white">
                              {availUnits} units
                            </div>
                            <div className="text-[10px] text-amber-600 dark:text-amber-400">
                              N/A Valuation
                            </div>
                          </>
                        )}
                      </td>

                      {/* Exchange Claiming Stores */}
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          claimingStores > 0
                            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}>
                          {claimingStores} {claimingStores === 1 ? "store" : "stores"}
                        </span>
                      </td>

                      {/* Grade Status */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
                          <span>🔒</span>
                          <span>POLICY PENDING</span>
                        </div>
                        <div className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                          {item.gradeReadiness.evaluationStatus} ({item.gradeReadiness.metrics.operatingHistoryDays}d)
                        </div>
                      </td>

                      {/* Risk Status Badges */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex flex-wrap justify-center gap-1">
                          {item.riskFlags.map((rf) => {
                            const badge = getRiskBadge(rf);
                            return (
                              <span
                                key={rf}
                                className={`rounded px-1.5 py-0.5 text-[10px] font-medium border ${badge.color}`}
                              >
                                {badge.label}
                              </span>
                            );
                          })}
                        </div>
                      </td>

                      {/* Data Confidence */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                            {Math.round(item.overallDataConfidence * 100)}%
                          </span>
                          <div className="h-1.5 w-14 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                            <div
                              style={{ width: `${Math.round(item.overallDataConfidence * 100)}%` }}
                              className={`h-full rounded-full ${
                                item.overallDataConfidence >= 0.8
                                  ? "bg-emerald-500"
                                  : item.overallDataConfidence >= 0.5
                                  ? "bg-amber-500"
                                  : "bg-rose-500"
                              }`}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Link
                          href={`/admin/sales/sku/${item.productId}`}
                          className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                        >
                          View Details →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            <span>
              Showing {data.items.length > 0 ? (data.page - 1) * data.pageSize + 1 : 0} to{" "}
              {Math.min(data.page * data.pageSize, data.totalCount)} of {data.totalCount} products
            </span>
            <div className="flex items-center gap-1">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const newSize = Number(e.target.value);
                  setPageSize(newSize);
                  setCurrentPage(1);
                  loadData({ size: newSize, page: 1 });
                }}
                className="rounded border border-zinc-200 bg-white px-2 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1 || isPending}
              onClick={() => loadData({ page: currentPage - 1 })}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors"
            >
              Previous
            </button>
            <span className="px-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {currentPage} / {Math.max(1, data.totalPages)}
            </span>
            <button
              type="button"
              disabled={currentPage >= data.totalPages || isPending}
              onClick={() => loadData({ page: currentPage + 1 })}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
