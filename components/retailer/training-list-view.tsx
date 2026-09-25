"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { TrainingProductSummary, TrainingProgressStats } from "@/lib/retailer/training";

interface TrainingListViewProps {
  products: TrainingProductSummary[];
  stats: TrainingProgressStats;
  stores: Array<{ id: string; name: string }>;
  selectedStoreId: string | null;
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
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [activeTab, setActiveTab] = useState<"all" | "not_completed" | "completed">("all");
  const [isPending, startTransition] = useTransition();

  const handleStoreChange = (storeId: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("storeId", storeId);
      router.push(`?${params.toString()}`);
    });
  };

  // Filter products by search query and active tab
  const filteredProducts = products.filter((p) => {
    if (activeTab === "completed" && !p.isCompleted) return false;
    if (activeTab === "not_completed" && p.isCompleted) return false;

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

  const notCompletedCount = stats.totalCount - stats.completedCount;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header & Store Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎓</span>
            <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
              Product Training & Staff Guides
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Learn key benefits, how to use, selling points, and customer talk-tracks for products carried in your store.
          </p>
        </div>

        {stores.length > 1 && (
          <div className="flex items-center gap-2 self-start sm:self-auto bg-zinc-100 dark:bg-zinc-800/80 p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 pl-2">
              Store:
            </span>
            <select
              value={selectedStoreId || ""}
              onChange={(e) => handleStoreChange(e.target.value)}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs font-bold text-zinc-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Progress Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-800 text-white p-6 shadow-md">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white backdrop-blur-sm">
                Store Assortment Training
              </span>
              <span className="text-xs text-blue-100 font-medium">
                {stores.find((s) => s.id === selectedStoreId)?.name || "Current Store"}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black">
              {stats.completedCount === stats.totalCount && stats.totalCount > 0
                ? "🎉 All Store Products Completed!"
                : `${stats.completedCount} of ${stats.totalCount} Products Completed`}
            </h2>
            <p className="text-xs sm:text-sm text-blue-100 max-w-xl leading-relaxed">
              {stats.completedCount === stats.totalCount && stats.totalCount > 0
                ? "Excellent job! You have completed staff training for all active products carried by your store."
                : "Complete each quick 1-minute product guide to feel confident answering customer questions and recommending K-Beauty essentials."}
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end gap-1.5 min-w-[160px]">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl sm:text-4xl font-black">{stats.percent}%</span>
              <span className="text-xs text-blue-200 font-semibold">Done</span>
            </div>
            <div className="w-full md:w-48 bg-white/20 rounded-full h-3 overflow-hidden backdrop-blur-sm">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${stats.percent}%` }}
              />
            </div>
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
            All ({stats.totalCount})
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
            To Learn ({notCompletedCount})
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
            Completed ({stats.completedCount})
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

      {/* Product Training Grid */}
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
              ? "You haven't completed any product training modules yet. Choose a product below to get started!"
              : "All products in this category have been completed!"}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredProducts.map((product) => {
            const detailUrl = `/training/${product.id}${selectedStoreId ? `?storeId=${selectedStoreId}` : ""}`;

            return (
              <div
                key={product.id}
                className={`group rounded-2xl border transition-all duration-200 flex flex-col bg-white dark:bg-zinc-900 overflow-hidden shadow-sm hover:shadow-md ${
                  product.isCompleted
                    ? "border-emerald-200 dark:border-emerald-900/40"
                    : "border-zinc-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-800"
                }`}
              >
                {/* Image & Badges */}
                <div className="relative aspect-[4/3] bg-zinc-50 dark:bg-zinc-800/40 p-4 flex items-center justify-center border-b border-zinc-100 dark:border-zinc-800/60 overflow-hidden">
                  {product.thumbnailUrl ? (
                    <img
                      src={product.thumbnailUrl}
                      alt={product.name}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="text-3xl text-zinc-300 dark:text-zinc-600">📦</div>
                  )}

                  {/* Brand & Category pill */}
                  <div className="absolute top-3 left-3 flex flex-col gap-1 items-start">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold tracking-wider uppercase bg-zinc-900/80 text-white backdrop-blur-sm">
                      {product.brandName}
                    </span>
                  </div>

                  {/* Completion badge */}
                  <div className="absolute top-3 right-3">
                    {product.isCompleted ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-500 text-white shadow-sm">
                        ✓ Completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        To Learn
                      </span>
                    )}
                  </div>
                </div>

                {/* Content info */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                        {product.categoryLabel}
                      </span>
                      <span className="text-[11px] font-mono text-zinc-400">
                        {product.sku}
                      </span>
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white line-clamp-2 leading-snug">
                      {product.name}
                    </h3>

                    {product.volume && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Size: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{product.volume}</span>
                      </p>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                    <Link
                      href={detailUrl}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                        product.isCompleted
                          ? "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200"
                          : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20"
                      }`}
                    >
                      {product.isCompleted ? (
                        <>
                          <span>Review Training</span>
                          <span>→</span>
                        </>
                      ) : (
                        <>
                          <span>Start Training (1 min)</span>
                          <span>→</span>
                        </>
                      )}
                    </Link>
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
