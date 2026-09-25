"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ProtectionItemSummary,
  ProtectionSummaryStats,
  ProtectionStatus,
} from "@/lib/retailer/protection";

interface ProtectionListViewProps {
  protections: ProtectionItemSummary[];
  stats: ProtectionSummaryStats;
  companyName: string;
  userRole: string;
}

export function ProtectionListView({
  protections,
  stats,
  companyName,
  userRole,
}: ProtectionListViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");

  const filteredItems = protections.filter((item) => {
    if (activeTab !== "all" && item.status !== activeTab) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = item.productName.toLowerCase().includes(q);
      const matchEn = item.productNameEn ? item.productNameEn.toLowerCase().includes(q) : false;
      const matchBrand = item.brandName.toLowerCase().includes(q);
      const matchSku = item.sku.toLowerCase().includes(q);
      return matchName || matchEn || matchBrand || matchSku;
    }
    return true;
  });

  const getStatusBadge = (status: ProtectionStatus) => {
    switch (status) {
      case "threshold_met":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            ✓ Threshold Met (≥50%)
          </span>
        );
      case "review_available":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800 animate-pulse">
            ⚠️ Review Available
          </span>
        );
      case "review_requested":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
            ✓ Review Requested
          </span>
        );
      case "needs_review":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300 border border-orange-300 dark:border-orange-800">
            Needs Data Review
          </span>
        );
      case "active":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            Active Trial
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛡️</span>
            <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
              90-Day Initial Trial Protection
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Initial trial reassurance: New products carried for the first time are protected for 90 days across your company stores.
          </p>
        </div>

        <div className="text-xs font-bold px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 self-start sm:self-auto border border-zinc-200 dark:border-zinc-700">
          Company: <span className="text-zinc-900 dark:text-white">{companyName}</span>
        </div>
      </div>

      {/* Program Summary Hero Banner */}
      <div className="rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-white p-6 sm:p-7 shadow-md border border-zinc-700/50">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-8 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-white backdrop-blur-sm border border-white/15">
              <span>🛡️ Trial Protection Rules</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black tracking-tight">
              90-Day New Product Trial Protection
            </h2>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-2xl">
              When your company trials a new K SELECT product, all store locations are evaluated over a 90-day period. If your company-wide estimated sell-through is below 50% after 90 days, you can request a protection review.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-zinc-300">
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>One Trial per Product × Company</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>50% Sell-Through Threshold</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Aggregated Store Movement</span>
              </div>
            </div>
          </div>

          <div className="md:col-span-4 grid grid-cols-2 gap-3 bg-white/5 p-4 rounded-2xl border border-white/10">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                Active Trials
              </span>
              <span className="text-2xl font-black text-white">{stats.activeCount}</span>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                Threshold Met
              </span>
              <span className="text-2xl font-black text-emerald-400">{stats.thresholdMetCount}</span>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                Review Available
              </span>
              <span className="text-2xl font-black text-amber-400">{stats.reviewAvailableCount}</span>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                Review Requested
              </span>
              <span className="text-2xl font-black text-indigo-400">{stats.reviewRequestedCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
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
            All ({stats.totalProtectedProducts})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("active")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === "active"
                ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            Active ({stats.activeCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("threshold_met")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === "threshold_met"
                ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            Threshold Met ({stats.thresholdMetCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("review_available")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === "review_available"
                ? "bg-white dark:bg-zinc-900 text-amber-600 dark:text-amber-400 shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            Review Available ({stats.reviewAvailableCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("review_requested")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === "review_requested"
                ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            Review Requested ({stats.reviewRequestedCount})
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

      {/* Trial Protections List */}
      {filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl mx-auto">
            🛡️
          </div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
            No Protection Records Found
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
            {searchQuery
              ? `No products match "${searchQuery}". Try a different keyword.`
              : "There are no initial trial protection records under this filter."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {filteredItems.map((item) => {
            const detailUrl = `/protection/${item.id}`;
            const isThresholdMet = item.sellThroughPercent >= 50;

            return (
              <div
                key={item.id}
                className={`rounded-3xl border transition-all flex flex-col bg-white dark:bg-zinc-900 overflow-hidden shadow-sm hover:shadow-md ${
                  item.status === "review_available"
                    ? "border-amber-300 dark:border-amber-800/80 ring-2 ring-amber-500/10"
                    : item.status === "threshold_met"
                    ? "border-emerald-200 dark:border-emerald-900/40"
                    : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                {/* Top Section: Image & Header */}
                <div className="p-5 sm:p-6 border-b border-zinc-100 dark:border-zinc-800/80 flex gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 p-2 shrink-0 border border-zinc-100 dark:border-zinc-800 flex items-center justify-center overflow-hidden">
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.productName}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-2xl text-zinc-300 dark:text-zinc-600">📦</div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-zinc-900 text-white">
                        {item.brandName}
                      </span>
                      {getStatusBadge(item.status)}
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white line-clamp-2 leading-snug">
                      {item.productName}
                    </h3>

                    <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                      <span className="font-mono">{item.sku}</span>
                      <span>•</span>
                      <span>{item.categoryLabel}</span>
                    </div>
                  </div>
                </div>

                {/* Performance Metrics Strip */}
                <div className="p-5 sm:p-6 flex-1 space-y-4">
                  {/* 90-Day Timeline & Sell-Through Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-zinc-600 dark:text-zinc-400">
                        {item.isPeriodEnded
                          ? "90-Day Trial Ended"
                          : `Day ${item.daysElapsed} of 90 (${item.daysRemaining} days remaining)`}
                      </span>
                      <span
                        className={
                          isThresholdMet
                            ? "text-emerald-600 dark:text-emerald-400 font-extrabold"
                            : "text-blue-600 dark:text-blue-400 font-extrabold"
                        }
                      >
                        {item.sellThroughPercent}% Estimated Sell-Through
                      </span>
                    </div>

                    <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-3 overflow-hidden relative">
                      {/* 50% Threshold marker line */}
                      <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-zinc-400 dark:bg-zinc-500 z-10" />
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isThresholdMet ? "bg-emerald-500" : "bg-blue-600"
                        }`}
                        style={{ width: `${item.sellThroughPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-zinc-400 font-medium">
                      <span>0%</span>
                      <span className="text-zinc-500 font-bold">50% Protection Threshold</span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* Metrics 4-Box Grid */}
                  <div className="grid grid-cols-2 gap-2.5 pt-2">
                    <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                        Protected Initial Qty
                      </span>
                      <span className="text-sm font-black text-zinc-900 dark:text-white">
                        {item.protectedQuantity} units
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                        Estimated Movement
                      </span>
                      <span className="text-sm font-black text-zinc-900 dark:text-white">
                        {item.estimatedMovement} units
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                        Trial Start Date
                      </span>
                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                        {item.trialStartDate}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                        Store Reporting Coverage
                      </span>
                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                        {item.dataCoveragePercent}% ({item.storesReporting}/{item.totalStores} stores)
                      </span>
                    </div>
                  </div>

                  {/* Actions Area */}
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-3">
                    <Link
                      href={detailUrl}
                      className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span>View Trial Performance & Store Breakdown</span>
                      <span>→</span>
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
