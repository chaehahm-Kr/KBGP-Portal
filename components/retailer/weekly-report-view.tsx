"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WeeklyReportData, WeeklyReportItem } from "@/lib/retailer/weekly-report-types";
import { useCart } from "@/components/retailer/cart-context";

interface Props {
  initialData: WeeklyReportData;
}

/**
 * Resilient thumbnail component with onError fallback to a clean SVG placeholder.
 * Prevents broken image icons when external or CMS assets fail to load.
 */
function ReportProductThumbnail({
  src,
  alt,
  sku,
}: {
  src?: string | null;
  alt: string;
  sku: string;
}) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-400 p-1 text-center select-none">
        <svg
          className="w-4 h-4 text-zinc-400 dark:text-zinc-500 mb-0.5 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
        <span className="text-[8px] font-mono leading-none truncate max-w-full text-zinc-400 dark:text-zinc-500">
          {sku.slice(-6)}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setHasError(true)}
      className="w-full h-full object-cover"
      loading="lazy"
    />
  );
}

export function WeeklyReportView({ initialData }: Props) {
  const router = useRouter();
  const { addItem } = useCart();

  const [activeTab, setActiveTab] = useState<"all" | "reorder">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showMethodology, setShowMethodology] = useState(false);
  const [addingProductIds, setAddingProductIds] = useState<Record<string, number>>({});
  const [cartSuccessFeedback, setCartSuccessFeedback] = useState<string | null>(null);

  const {
    reportingWeek,
    formattedWeekLabel,
    availableWeeks,
    selectedStoreId,
    accessibleStores,
    coverageStatus,
    totalStores,
    submittedStoresCount,
    storeStatuses,
    summary,
    items,
    isFinancialsHidden,
  } = initialData;

  // Handle changing week or store via query parameters
  const handleFilterChange = (newWeek?: string, newStore?: string) => {
    const targetWeek = newWeek !== undefined ? newWeek : reportingWeek;
    const targetStore = newStore !== undefined ? newStore : selectedStoreId;

    const params = new URLSearchParams();
    if (targetWeek) params.set("week", targetWeek);
    if (targetStore && targetStore !== "all") params.set("store", targetStore);

    router.push(`/reports/weekly?${params.toString()}`);
  };

  // Categories list for filter
  const categories = useMemo(() => {
    const cats = new Set<string>();
    items.forEach((i) => {
      if (i.categoryLabel) cats.add(i.categoryLabel);
    });
    return Array.from(cats).sort();
  }, [items]);

  // Filtered products
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (activeTab === "reorder" && !item.reorderNeeded) return false;
      if (selectedCategory !== "all" && item.categoryLabel !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.productName.toLowerCase().includes(q);
        const matchesNameEn = item.productNameEn?.toLowerCase().includes(q);
        const matchesSku = item.sku.toLowerCase().includes(q);
        const matchesBrand = item.brandName.toLowerCase().includes(q);
        if (!matchesName && !matchesNameEn && !matchesSku && !matchesBrand) return false;
      }
      return true;
    });
  }, [items, activeTab, selectedCategory, searchQuery]);

  // Handle quantity changes in reorder stepper
  const getProductOrderQty = (item: WeeklyReportItem) => {
    if (addingProductIds[item.productId] !== undefined) {
      return addingProductIds[item.productId];
    }
    return item.suggestedReorderQty > 0 ? item.suggestedReorderQty : (item.moq || 6);
  };

  const setProductOrderQty = (productId: string, qty: number, item: WeeklyReportItem) => {
    const min = item.moq || 1;
    const cleanQty = Math.max(min, qty);
    setAddingProductIds((prev) => ({ ...prev, [productId]: cleanQty }));
  };

  // Add product to Cart using CartContext
  const handleAddToCart = (item: WeeklyReportItem) => {
    const qty = getProductOrderQty(item);
    addItem(
      {
        id: item.productId,
        name: item.productName,
        nameEn: item.productNameEn,
        brandName: item.brandName,
        sku: item.sku,
        thumbnailUrl: item.thumbnailUrl,
        wholesalePrice: item.wholesalePrice,
        msrp: item.retailPrice,
        cartonPackQty: item.cartonPackQty,
        moq: item.moq,
        orderMultiple: item.orderMultiple,
        targetStoreId: selectedStoreId !== "all" ? selectedStoreId : undefined,
      },
      qty
    );

    setCartSuccessFeedback(`Added ${qty} units of ${item.productName} to cart.`);
    setTimeout(() => setCartSuccessFeedback(null), 3500);
  };

  return (
    <div className="w-full space-y-5 pb-12">
      {/* Header & Title (Left-Aligned) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📋</span>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Weekly Performance & Reorder Report
            </h1>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Authoritative weekly store sales estimates, physical stock levels, and automated replenishment recommendations.
          </p>
        </div>

        {/* Action Link to Weekly Inventory */}
        <Link
          href="/check"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 shadow-xs transition-colors self-start md:self-auto cursor-pointer"
        >
          <span>📱</span>
          <span>Submit Weekly Inventory</span>
        </Link>
      </div>

      {/* Cart Feedback Notification */}
      {cartSuccessFeedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-emerald-500 font-bold">✓</span>
            <span>{cartSuccessFeedback}</span>
          </div>
          <Link
            href="/checkout"
            className="text-xs font-bold text-emerald-700 dark:text-emerald-300 underline hover:no-underline"
          >
            Go to Cart & Checkout →
          </Link>
        </div>
      )}

      {/* Filter & Selector Controls Bar */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Week Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
              Week:
            </label>
            <select
              value={reportingWeek}
              onChange={(e) => handleFilterChange(e.target.value, undefined)}
              className="text-xs font-semibold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {availableWeeks.map((w) => (
                <option key={w.week} value={w.week}>
                  {w.label} {w.isCurrent ? "· Current" : ""} {w.hasSubmissions ? "✓" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Store Selector (if multi-store accessible) */}
          {accessibleStores.length > 1 && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                Store:
              </label>
              <select
                value={selectedStoreId}
                onChange={(e) => handleFilterChange(undefined, e.target.value)}
                className="text-xs font-semibold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">All Stores (Company Overview)</option>
                {accessibleStores.map((s) => (
                  <option key={s.id} value={s.id}>
                    🏪 {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Coverage Badge */}
        <div className="flex items-center gap-2 self-start lg:self-auto">
          {coverageStatus === "full" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Full Coverage ({submittedStoresCount}/{totalStores} Stores Submitted)
            </span>
          )}

          {coverageStatus === "partial" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Partial Coverage ({submittedStoresCount}/{totalStores} Stores Submitted)
            </span>
          )}

          {coverageStatus === "none" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400">
              <span className="w-2 h-2 rounded-full bg-zinc-400" />
              No Checks Submitted for {reportingWeek}
            </span>
          )}
        </div>
      </div>

      {/* Compact Partial Coverage Warning Banner */}
      {coverageStatus === "partial" && selectedStoreId === "all" && (
        <div className="py-2.5 px-4 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2.5 shadow-2xs">
          <span className="text-sm shrink-0">⚠️</span>
          <div className="flex-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <strong className="text-amber-950 dark:text-amber-100 font-semibold">Partial Coverage:</strong>
            <span>
              {submittedStoresCount} of {totalStores} stores submitted for {reportingWeek}. Unsubmitted store stock is not assumed zero. Summary metrics reflect submitted counts only.
            </span>
          </div>
        </div>
      )}

      {/* 4 Top Authoritative Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Estimated Retail Sales */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Est. Retail Sales
            </span>
            <span className="text-base">💵</span>
          </div>
          <div className="my-3">
            {isFinancialsHidden ? (
              <span className="text-xs font-semibold text-zinc-400">Restricted (Staff Role)</span>
            ) : summary.totalEstimatedRetailSales !== null ? (
              <div className="text-2xl lg:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
                ${summary.totalEstimatedRetailSales.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            ) : (
              <div className="space-y-1">
                <span className="text-2xl font-bold text-zinc-400">—</span>
                <div className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                  Insufficient Baseline Data
                </div>
              </div>
            )}
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Based on store SRP × verified delta
          </p>
        </div>

        {/* 2. Estimated Gross Profit */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Est. Gross Profit
            </span>
            <span className="text-base">📈</span>
          </div>
          <div className="my-3">
            {isFinancialsHidden ? (
              <span className="text-xs font-semibold text-zinc-400">Restricted (Staff Role)</span>
            ) : summary.totalEstimatedGrossProfit !== null ? (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl lg:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
                  ${summary.totalEstimatedGrossProfit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {summary.averageGrossMargin !== null && (
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                    {summary.averageGrossMargin}%
                  </span>
                )}
              </div>
            ) : (
              <span className="text-2xl font-bold text-zinc-400">—</span>
            )}
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Retail Revenue - Wholesale Cost
          </p>
        </div>

        {/* 3. Estimated Units Sold */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Est. Units Sold
            </span>
            <span className="text-base">📦</span>
          </div>
          <div className="my-3">
            {summary.totalEstimatedUnitsSold !== null ? (
              <div className="text-2xl lg:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
                {summary.totalEstimatedUnitsSold.toLocaleString()} <span className="text-sm font-normal text-zinc-500">units</span>
              </div>
            ) : (
              <div className="space-y-1">
                <span className="text-2xl font-bold text-zinc-400">—</span>
                <span className="text-[10px] text-zinc-400 block">Baseline Established</span>
              </div>
            )}
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Physical stock delta + receipts
          </p>
        </div>

        {/* 4. Reorder Recommended (Stock & Velocity Distinction) */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 p-5 shadow-xs flex flex-col justify-between bg-gradient-to-br from-white to-indigo-50/20 dark:from-zinc-900 dark:to-indigo-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Reorder Needed
            </span>
            <span className="text-base">🛒</span>
          </div>
          <div className="my-3">
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl lg:text-3xl font-extrabold tracking-tight ${summary.productsNeedingReorderCount > 0 ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-900 dark:text-white"}`}>
                {summary.productsNeedingReorderCount}
              </span>
              <span className="text-sm font-medium text-zinc-500">products</span>
            </div>
            {summary.totalSuggestedReorderUnits > 0 && (
              <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 block">
                {summary.totalSuggestedReorderUnits.toLocaleString()} units suggested
              </span>
            )}
          </div>
          <div className="pt-2 border-t border-indigo-100/60 dark:border-indigo-950/40 flex items-center justify-between text-[10px]">
            <span className="text-zinc-500 dark:text-zinc-400">Demand Target</span>
            <span
              title="Calculated using 4-week sales velocity where baseline exists, or shelf minimum stock target (MOQ/Pack) for new products."
              className="inline-flex items-center gap-1 font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded cursor-help"
            >
              Stock & Velocity Rules ℹ️
            </span>
          </div>
        </div>
      </div>

      {/* Product List Section (Positioned Higher Directly Under KPIs) */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
        {/* Product Filters & Search Bar */}
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === "all"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              All Products ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("reorder")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === "reorder"
                  ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <span>Reorder Needed</span>
              {summary.productsNeedingReorderCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                  {summary.productsNeedingReorderCount}
                </span>
              )}
            </button>
          </div>

          {/* Search & Category Filter */}
          <div className="flex items-center gap-2">
            {categories.length > 0 && (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-zinc-700 dark:text-zinc-300 focus:outline-hidden"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}

            <input
              type="text"
              placeholder="Search product or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 w-full sm:w-48"
            />
          </div>
        </div>

        {/* Product Table (Desktop) */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-100 dark:border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase">
              <tr>
                <th className="py-3 px-4">Product / SKU</th>
                <th className="py-3 px-3 text-right">SRP / Cost</th>
                <th className="py-3 px-3 text-right">Remaining</th>
                <th className="py-3 px-3 text-right">Est. Units Sold</th>
                {!isFinancialsHidden && (
                  <>
                    <th className="py-3 px-3 text-right">Est. Sales</th>
                    <th className="py-3 px-3 text-right">Est. Gross Profit</th>
                  </>
                )}
                <th className="py-3 px-3 text-right">Incoming</th>
                <th className="py-3 px-4 text-center">Suggested Reorder & Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={isFinancialsHidden ? 6 : 8} className="py-8 text-center text-zinc-400">
                    No products match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const currentQty = getProductOrderQty(item);

                  return (
                    <tr
                      key={item.productId}
                      className={`hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors ${
                        item.reorderNeeded ? "bg-indigo-50/20 dark:bg-indigo-950/10" : ""
                      }`}
                    >
                      {/* Product */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 relative">
                            <ReportProductThumbnail
                              src={item.thumbnailUrl}
                              alt={item.productName}
                              sku={item.sku}
                            />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                              {item.brandName}
                            </span>
                            <span className="font-semibold text-zinc-900 dark:text-white line-clamp-1 block">
                              {item.productName}
                            </span>
                            <span className="font-mono text-[10px] text-zinc-500">
                              {item.sku}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* SRP / Cost */}
                      <td className="py-3 px-3 text-right tabular-nums">
                        <div className="font-bold text-zinc-900 dark:text-white">
                          ${item.retailPrice.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          Cost: ${item.wholesalePrice.toFixed(2)}
                        </div>
                      </td>

                      {/* Remaining */}
                      <td className="py-3 px-3 text-right tabular-nums">
                        <span className="font-bold text-zinc-900 dark:text-white text-sm">
                          {item.reportedRemaining !== null ? item.reportedRemaining : "—"}
                        </span>
                        <span className="text-[10px] text-zinc-400 block">units</span>
                      </td>

                      {/* Est. Units Sold */}
                      <td className="py-3 px-3 text-right tabular-nums">
                        {item.estimatedUnitsSold !== null ? (
                          <>
                            <span className="font-bold text-zinc-900 dark:text-white text-sm">
                              {item.estimatedUnitsSold}
                            </span>
                            <span className="text-[10px] text-zinc-400 block">sold</span>
                          </>
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 rounded-sm text-[9px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                            Baseline
                          </span>
                        )}
                      </td>

                      {/* Financials (if not hidden) */}
                      {!isFinancialsHidden && (
                        <>
                          <td className="py-3 px-3 text-right tabular-nums font-bold text-zinc-900 dark:text-white">
                            {item.estimatedRetailSales !== null ? (
                              `$${item.estimatedRetailSales.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            ) : (
                              <span className="text-zinc-400 font-normal">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums">
                            {item.estimatedGrossProfit !== null ? (
                              <div>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  ${item.estimatedGrossProfit.toFixed(2)}
                                </span>
                                {item.grossMarginPercent !== null && (
                                  <span className="text-[10px] text-zinc-400 block">
                                    {item.grossMarginPercent}% margin
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                          </td>
                        </>
                      )}

                      {/* Incoming */}
                      <td className="py-3 px-3 text-right tabular-nums">
                        {item.incomingQty > 0 ? (
                          <div>
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                              +{item.incomingQty}
                            </span>
                            <span className="text-[9px] text-zinc-400 block">
                              {item.inTransitQty > 0 ? `${item.inTransitQty} transit` : "pending"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-zinc-400">0</span>
                        )}
                      </td>

                      {/* Suggested Reorder & Action */}
                      <td className="py-3 px-4 text-center">
                        {item.reorderNeeded ? (
                          <div className="flex items-center justify-end gap-2">
                            <div className="text-right">
                              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 block">
                                Reorder {item.suggestedReorderQty} units
                              </span>
                              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                                <span className="text-[10px] text-zinc-400 block">
                                  ({item.suggestedCases} {item.suggestedCases === 1 ? "case" : "cases"} · MOQ {item.moq})
                                </span>
                                {item.estimatedUnitsSold !== null && item.estimatedUnitsSold > 0 ? (
                                  <span
                                    title="Velocity-based reorder: Target demand calculated from recent weekly sales movement × 4-week safety stock"
                                    className="px-1.5 py-0.2 rounded-md text-[9px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 cursor-help"
                                  >
                                    Velocity (4w)
                                  </span>
                                ) : (
                                  <span
                                    title="Stock-based reorder: Target demand calculated to replenish shelf minimum stock and carton pack multiples"
                                    className="px-1.5 py-0.2 rounded-md text-[9px] font-bold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 cursor-help"
                                  >
                                    Stock Target (MOQ)
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Stepper + Add Button */}
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={item.moq || 1}
                                step={item.orderMultiple || 1}
                                value={currentQty}
                                onChange={(e) =>
                                  setProductOrderQty(item.productId, parseInt(e.target.value, 10) || item.moq, item)
                                }
                                className="w-16 px-2 py-1 text-xs font-bold text-center border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800"
                              />
                              <button
                                type="button"
                                onClick={() => handleAddToCart(item)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors shrink-0 cursor-pointer"
                              >
                                + Add to Cart
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Sufficient Stock
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Product Cards (Mobile View) */}
        <div className="lg:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-400">
              No products match the selected filters.
            </div>
          ) : (
            filteredItems.map((item) => {
              const currentQty = getProductOrderQty(item);

              return (
                <div
                  key={item.productId}
                  className={`p-4 space-y-3 ${
                    item.reorderNeeded ? "bg-indigo-50/15 dark:bg-indigo-950/10" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 relative">
                      <ReportProductThumbnail
                        src={item.thumbnailUrl}
                        alt={item.productName}
                        sku={item.sku}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                          {item.brandName}
                        </span>
                        {item.reorderNeeded ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            Reorder Needed
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Stocked
                          </span>
                        )}
                      </div>
                      <h4 className="font-semibold text-xs text-zinc-900 dark:text-white line-clamp-2 mt-0.5">
                        {item.productName}
                      </h4>
                      <p className="font-mono text-[10px] text-zinc-500 mt-0.5">
                        {item.sku}
                      </p>
                    </div>
                  </div>

                  {/* Stock & Movement Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-zinc-400 block uppercase font-bold">Remaining</span>
                      <span className="font-bold text-zinc-900 dark:text-white">
                        {item.reportedRemaining !== null ? `${item.reportedRemaining} units` : "—"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-zinc-400 block uppercase font-bold">Est. Sold</span>
                      <span className="font-bold text-zinc-900 dark:text-white">
                        {item.estimatedUnitsSold !== null ? `${item.estimatedUnitsSold} sold` : "Baseline"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-zinc-400 block uppercase font-bold">Incoming</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        {item.incomingQty > 0 ? `+${item.incomingQty}` : "0"}
                      </span>
                    </div>
                  </div>

                  {/* Financials (if not hidden) */}
                  {!isFinancialsHidden && item.estimatedRetailSales !== null && (
                    <div className="flex items-center justify-between text-xs px-1">
                      <span className="text-zinc-500">
                        Est. Sales: <strong className="text-zinc-900 dark:text-white">${item.estimatedRetailSales.toFixed(2)}</strong>
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        GP: ${item.estimatedGrossProfit?.toFixed(2)} ({item.grossMarginPercent}%)
                      </span>
                    </div>
                  )}

                  {/* Reorder Action Box */}
                  {item.reorderNeeded && (
                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                            Suggested: {item.suggestedReorderQty} units
                          </span>
                          {item.estimatedUnitsSold !== null && item.estimatedUnitsSold > 0 ? (
                            <span className="px-1.5 py-0.2 rounded-md text-[9px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80">
                              Velocity (4w)
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded-md text-[9px] font-bold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                              Stock Target
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-400 block">
                          MOQ {item.moq} · Pack {item.cartonPackQty}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={item.moq || 1}
                          step={item.orderMultiple || 1}
                          value={currentQty}
                          onChange={(e) =>
                            setProductOrderQty(item.productId, parseInt(e.target.value, 10) || item.moq, item)
                          }
                          className="w-14 px-2 py-1 text-xs font-bold text-center border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddToCart(item)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs cursor-pointer"
                        >
                          Add to Cart
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Multi-Store Submission Breakdown (Company View - Positioned Below Product List) */}
      {selectedStoreId === "all" && accessibleStores.length > 1 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
            Store Check Coverage for {reportingWeek}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-100 dark:border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase">
                <tr>
                  <th className="py-2 px-3">Store Name</th>
                  <th className="py-2 px-3 text-center">Status</th>
                  <th className="py-2 px-3 text-right">Products Counted</th>
                  <th className="py-2 px-3 text-right">Remaining Units</th>
                  <th className="py-2 px-3 text-center">Submitted At</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {storeStatuses.map((st) => (
                  <tr key={st.storeId} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                    <td className="py-2.5 px-3 font-semibold text-zinc-900 dark:text-white">
                      🏪 {st.storeName}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold border capitalize ${
                          st.hasSubmitted
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                            : st.status === "in_progress"
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                        {st.hasSubmitted ? "Submitted" : st.status === "in_progress" ? "In Progress" : "Not Started"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {st.hasSubmitted ? `${st.countedProducts} / ${st.totalProducts}` : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold">
                      {st.hasSubmitted ? `${st.remainingUnits.toLocaleString()} units` : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-center text-zinc-500 text-[11px]">
                      {st.submittedAt ? new Date(st.submittedAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleFilterChange(undefined, st.storeId)}
                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        View Store Report →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Honest Methodology & Calculation Notice Accordion (Positioned Below Product List) */}
      <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-200 dark:border-zinc-700/80 p-4 text-xs space-y-2">
        <div
          onClick={() => setShowMethodology(!showMethodology)}
          className="flex items-center justify-between cursor-pointer select-none"
        >
          <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 font-semibold">
            <span>ℹ️</span>
            <span>Calculation Methodology & Honest Baseline Policy</span>
          </div>
          <span className="text-zinc-400 font-mono text-xs">{showMethodology ? "▲ Hide" : "▼ Learn More"}</span>
        </div>

        {showMethodology && (
          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 space-y-2 text-[11px] leading-relaxed">
            <p>
              • <strong>Physical stock counts vs POS sales:</strong> Weekly Inventory provides shelf counts, NOT real-time POS transaction logs. Derived revenue and profit values are strictly estimates.
            </p>
            <p>
              • <strong>Estimated Units Sold formula:</strong> <code className="bg-zinc-200 dark:bg-zinc-700 px-1 py-0.5 rounded-sm font-mono text-[10px]">(Previous Stock + Confirmed Deliveries) - Current Reported Stock</code>.
            </p>
            <p>
              • <strong>Baseline Count Rule:</strong> The initial stock check establishes a baseline. Delta-based sales calculations require at least 2 consecutive counts. If only 1 check exists, &quot;Insufficient Data&quot; is reported rather than fabricated $0 or positive numbers.
            </p>
            <p>
              • <strong>Reorder Quantity Recommendation:</strong> Calculates 4-week target demand based on observed movement, compares against projected stock (remaining + pending orders), and normalizes to brand Case Pack multiples and Minimum Order Quantities (MOQ).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
