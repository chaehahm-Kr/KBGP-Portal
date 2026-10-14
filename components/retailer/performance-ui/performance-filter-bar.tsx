"use client";

import React from "react";
import { PerformanceFilterBarProps, PerformancePeriod, ReorderCoverageTarget } from "./types";

export function PerformanceFilterBar({
  stores,
  selectedStoreId,
  onStoreChange,
  selectedPeriod,
  onPeriodChange,
  selectedCoverage,
  onCoverageChange,
  searchQuery,
  onSearchChange,
  activeFilterTab,
  onFilterTabChange,
  reorderNeededCount,
  needsReviewCount,
}: PerformanceFilterBarProps) {
  const periodOptions: Array<{ key: PerformancePeriod; label: string }> = [
    { key: "7d", label: "7 Days" },
    { key: "30d", label: "30 Days" },
    { key: "90d", label: "90 Days" },
    { key: "all", label: "All Time" },
  ];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4 shadow-sm">
      {/* Top Row: Store Selector & Two Distinct Toggles (Analysis Period vs Reorder Target) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Store Selector Dropdown */}
        <div className="flex items-center gap-2.5">
          <label htmlFor="store-select" className="text-xs font-semibold text-zinc-400 whitespace-nowrap">
            Location Scope:
          </label>
          <select
            id="store-select"
            value={selectedStoreId}
            onChange={(e) => onStoreChange(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 min-w-[200px]"
          >
            <option value="all">Company-Wide (All Stores)</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                📍 {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Toggles Container: Clearly separated */}
        <div className="flex flex-wrap items-center gap-4">
          {/* 1. Historical Analysis Period */}
          <div className="flex items-center gap-1.5 p-1 bg-zinc-800/80 rounded-lg border border-zinc-700/60">
            <span className="text-[11px] font-semibold text-zinc-400 px-2 uppercase tracking-wider">
              Sales Window:
            </span>
            {periodOptions.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => onPeriodChange(opt.key)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  selectedPeriod === opt.key
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* 2. Future Reorder Target Coverage */}
          <div className="flex items-center gap-1.5 p-1 bg-zinc-800/80 rounded-lg border border-zinc-700/60">
            <span className="text-[11px] font-semibold text-zinc-400 px-2 uppercase tracking-wider">
              Reorder Target:
            </span>
            {(["30d", "60d"] as ReorderCoverageTarget[]).map((cov) => (
              <button
                key={cov}
                type="button"
                onClick={() => onCoverageChange(cov)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  selectedCoverage === cov
                    ? "bg-teal-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {cov === "30d" ? "30 Days" : "60 Days"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row: Search Input and Status Filter Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-zinc-800/60">
        {/* Search Bar */}
        <div className="relative w-full sm:w-80">
          <svg
            className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clipRule="evenodd"
            />
          </svg>
          <input
            type="text"
            placeholder="Search SKU, Product, Brand..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-zinc-800/60 border border-zinc-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => onFilterTabChange("all")}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              activeFilterTab === "all"
                ? "bg-zinc-100 text-zinc-900"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            All Products
          </button>

          <button
            type="button"
            onClick={() => onFilterTabChange("reorder_needed")}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              activeFilterTab === "reorder_needed"
                ? "bg-rose-500 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span>Reorder Needed</span>
            {reorderNeededCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-900/60 text-rose-200">
                {reorderNeededCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onFilterTabChange("needs_review")}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              activeFilterTab === "needs_review"
                ? "bg-amber-500 text-zinc-950 font-bold"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span>Needs Review</span>
            {needsReviewCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-900/60 text-amber-200">
                {needsReviewCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onFilterTabChange("has_incoming")}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              activeFilterTab === "has_incoming"
                ? "bg-sky-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Has Incoming Stock
          </button>
        </div>
      </div>
    </div>
  );
}
