"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { TrainingProductSummary, TrainingProgressStats } from "@/lib/retailer/training";

interface TrainingListViewProps {
  products: TrainingProductSummary[];
  stats: TrainingProgressStats;
  stores: Array<{ id: string; name: string }>;
  selectedStoreId: string;
  userRole: string;
}

export function TrainingListView({
  products,
  stats,
  stores,
  selectedStoreId,
  userRole,
}: TrainingListViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [activeTab, setActiveTab] = useState<"all" | "not_completed" | "completed">("all");
  const [isPending, startTransition] = useTransition();

  const handleStoreChange = (storeId: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (storeId === "all") {
        params.delete("store");
        params.delete("storeId");
      } else {
        params.set("store", storeId);
        params.delete("storeId");
      }
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  // Filter products by search query and active tab
  const filteredProducts = products.filter((p) => {
    if (activeTab === "completed" && p.completionStatus !== "verified") return false;
    if (activeTab === "not_completed") {
      // Actionable published modules that are not yet verified (includes not_started and legacy_needs_verification)
      if (p.trainingStatus !== "published" || p.completionStatus === "verified") return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = p.name.toLowerCase().includes(q);
      const matchEn = p.nameEn ? p.nameEn.toLowerCase().includes(q) : false;
      const matchBrand = p.brandName.toLowerCase().includes(q);
      const matchSku = p.sku.toLowerCase().includes(q);
      return matchName || matchEn || matchBrand || matchSku;
    }
    return true;
  });

  return (
    <div className="w-full space-y-5 pb-12">
      {/* Header & Store Button Selector */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎓</span>
            <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
              Learning Center
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Company-wide product knowledge, verified benefits, customer talk-tracks, and quick staff assessments.
          </p>
        </div>

        {/* Store Selector: All Stores / Store 01 / Store 02 */}
        {stores.length > 0 && (
          <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl border border-zinc-200 dark:border-zinc-700/60 overflow-x-auto no-scrollbar max-w-full">
            <button
              type="button"
              onClick={() => handleStoreChange("all")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                selectedStoreId === "all"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              All Stores
            </button>
            {stores.map((s) => {
              const isSelected = selectedStoreId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleStoreChange(s.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Compact Progress Banner (Phase 2 & Phase 1) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-600 to-indigo-800 text-white p-4 sm:p-5 shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-white/20 text-white backdrop-blur-sm">
                🎓 Staff Training Progress
              </span>
              <span className="text-xs text-blue-100 font-medium">
                {selectedStoreId === "all"
                  ? "All Stores (Company View)"
                  : stores.find((s) => s.id === selectedStoreId)?.name || "Selected Store"}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white/10 text-blue-100 border border-white/15">
                {stats.totalCount} {selectedStoreId === "all" ? "Company" : "Store"} Products Eligible
              </span>
            </div>

            <h2 className="text-base sm:text-lg font-black tracking-tight">
              {stats.availableCount > 0 && stats.completedCount === stats.availableCount
                ? "🎉 All Available Modules Verified Complete!"
                : `${stats.completedCount} of ${stats.availableCount} Modules Verified Complete`}
            </h2>

            {/* Note if legacy unverified completions exist */}
            {stats.legacyCount > 0 && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/25 border border-amber-300/40 text-amber-100 text-xs font-semibold backdrop-blur-xs">
                <span>⚠️</span>
                <span>
                  {stats.legacyCount} {stats.legacyCount === 1 ? "module has" : "modules have"} legacy self-reported completion. Pass the quiz to earn certified coverage.
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col items-start md:items-end gap-1.5 min-w-[170px] shrink-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black">{stats.percent}%</span>
              <span className="text-xs text-blue-200 font-semibold">Certified</span>
            </div>
            <div className="w-full md:w-44 bg-white/20 rounded-full h-2.5 overflow-hidden backdrop-blur-sm">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${stats.percent}%` }}
              />
            </div>
            <span className="text-[10px] text-blue-200/80">
              {stats.completedCount} verified / {stats.availableCount} published
            </span>
          </div>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl border border-zinc-200 dark:border-zinc-700/60 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === "all"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            All Products ({stats.totalCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("not_completed")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === "not_completed"
                ? "bg-white dark:bg-zinc-900 text-amber-600 dark:text-amber-400 shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            To Learn ({stats.toLearnCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("completed")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === "completed"
                ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            Verified Complete ({stats.completedCount})
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative flex-1 sm:max-w-xs">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search product, SKU, brand..."
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
          />
          <span className="absolute left-3 top-2.5 text-zinc-400 text-xs">🔍</span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Product Training Grid: Responsive 5 cols at 2xl, 4 cols at lg, 3 cols at md, 2 cols at sm, 1 col mobile */}
      {filteredProducts.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl mx-auto">
            🔍
          </div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
            No Training Products Found
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
            {searchQuery
              ? `No products match "${searchQuery}". Try a different keyword.`
              : activeTab === "completed"
              ? "No verified completed modules yet. Pass the quiz on an available module to verify completion!"
              : "All products in this category have been verified completed!"}
          </p>
          {(searchQuery || activeTab !== "all") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setActiveTab("all");
              }}
              className="mt-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3.5 sm:gap-4">
          {filteredProducts.map((product) => {
            const detailUrl = `/training/${product.id}${selectedStoreId && selectedStoreId !== "all" ? `?storeId=${selectedStoreId}` : ""}`;

            return (
              <div
                key={product.id}
                className={`group rounded-2xl border transition-all duration-200 flex flex-col bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs hover:shadow-md ${
                  product.completionStatus === "verified"
                    ? "border-emerald-200 dark:border-emerald-900/40"
                    : product.completionStatus === "legacy_needs_verification"
                    ? "border-amber-200 dark:border-amber-800/60"
                    : "border-zinc-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-800"
                }`}
              >
                {/* Compact Image Area with Neutral Placeholder (Phase 2 & Phase 3) */}
                <div className="relative h-40 sm:h-44 bg-zinc-50 dark:bg-zinc-800/40 p-3 flex items-center justify-center border-b border-zinc-100 dark:border-zinc-800/60 overflow-hidden">
                  {product.thumbnailUrl ? (
                    <img
                      src={product.thumbnailUrl}
                      alt={product.name}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        const fallback = e.currentTarget.parentElement?.querySelector(".fallback-placeholder");
                        if (fallback) (fallback as HTMLElement).style.display = "flex";
                      }}
                    />
                  ) : null}

                  {/* Official Neutral K SELECT Branded Placeholder (Phase 3) */}
                  <div
                    className={`fallback-placeholder w-full h-full flex-col items-center justify-center text-center p-3 space-y-1.5 bg-gradient-to-b from-zinc-50 to-zinc-100/90 dark:from-zinc-800/40 dark:to-zinc-900/60 ${
                      product.thumbnailUrl ? "hidden" : "flex"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80 flex items-center justify-center shadow-2xs">
                      <svg className="w-4 h-4 text-zinc-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                      </svg>
                    </div>
                    <div className="space-y-0.5 max-w-[130px]">
                      <span className="text-[9px] font-extrabold tracking-wider text-zinc-400 dark:text-zinc-500 uppercase block">K SELECT</span>
                      <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 line-clamp-1 block">{product.brandName}</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-200/60 dark:bg-zinc-800/80 border border-zinc-300/40 dark:border-zinc-700/40">
                      {product.sku}
                    </span>
                  </div>

                  {/* Brand pill */}
                  <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold tracking-wider uppercase bg-zinc-900/80 text-white backdrop-blur-xs">
                      {product.brandName}
                    </span>
                  </div>

                  {/* Completion / Training Status badge (Phase 1) */}
                  <div className="absolute top-2.5 right-2.5">
                    {product.completionStatus === "verified" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-white shadow-xs">
                        ✓ Verified
                      </span>
                    ) : product.completionStatus === "legacy_needs_verification" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/90 dark:text-amber-200 border border-amber-300 dark:border-amber-700 shadow-xs">
                        ⚠️ Verify Quiz
                      </span>
                    ) : product.trainingStatus === "preparing" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/90 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        ⏳ Preparing
                      </span>
                    ) : product.trainingStatus === "unavailable" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-500 dark:bg-zinc-800/90 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                        Unavailable
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        To Learn
                      </span>
                    )}
                  </div>
                </div>

                {/* Content info */}
                <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] sm:text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                        {product.categoryLabel}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400">
                        {product.sku}
                      </span>
                    </div>

                    <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white line-clamp-2 leading-snug">
                      {product.name}
                    </h3>

                    {product.volume && (
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Size: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{product.volume}</span>
                      </p>
                    )}
                  </div>

                  {/* Action Button aligned to bottom */}
                  <div className="pt-2 mt-auto border-t border-zinc-100 dark:border-zinc-800/80">
                    {product.trainingStatus === "unavailable" ? (
                      <button
                        type="button"
                        disabled
                        className="w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 bg-zinc-100 dark:bg-zinc-800/60 text-zinc-400 dark:text-zinc-500 cursor-not-allowed border border-zinc-200/80 dark:border-zinc-700/60"
                      >
                        <span>Unavailable</span>
                      </button>
                    ) : product.trainingStatus === "preparing" ? (
                      <button
                        type="button"
                        disabled
                        className="w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 bg-purple-50/60 dark:bg-purple-950/30 text-purple-400 dark:text-purple-400/80 cursor-not-allowed border border-purple-200/60 dark:border-purple-900/40"
                      >
                        <span>⏳ Preparing</span>
                      </button>
                    ) : product.completionStatus === "verified" ? (
                      <Link
                        href={detailUrl}
                        className="w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors"
                      >
                        <span>Review Guide</span>
                        <span>→</span>
                      </Link>
                    ) : product.completionStatus === "legacy_needs_verification" ? (
                      <Link
                        href={detailUrl}
                        className="w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white shadow-xs shadow-amber-600/20 transition-colors"
                      >
                        <span>Take Quiz to Verify</span>
                        <span>→</span>
                      </Link>
                    ) : (
                      <Link
                        href={detailUrl}
                        className="w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-xs shadow-blue-500/20 transition-colors"
                      >
                        <span>Start Training</span>
                        <span>→</span>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
