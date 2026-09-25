"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  AdminProtectionReviewItem,
  AdminProtectionReviewCounts,
  AdminProtectionDecision,
} from "@/lib/protection/types";

interface AdminProtectionReviewsListProps {
  initialReviews: AdminProtectionReviewItem[];
  initialCounts: AdminProtectionReviewCounts;
}

export function AdminProtectionReviewsList({
  initialReviews,
  initialCounts,
}: AdminProtectionReviewsListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("pending");

  const filteredReviews = initialReviews.filter((item) => {
    if (activeTab === "pending" && !(item.decision === "pending" && (item.status === "review_requested" || item.requestedAt !== null))) {
      return false;
    }
    if (activeTab !== "all" && activeTab !== "pending" && item.decision !== activeTab) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchCompany = item.companyName.toLowerCase().includes(q);
      const matchProduct = item.productName.toLowerCase().includes(q);
      const matchEn = item.productNameEn ? item.productNameEn.toLowerCase().includes(q) : false;
      const matchBrand = item.brandName.toLowerCase().includes(q);
      const matchSku = item.sku.toLowerCase().includes(q);
      return matchCompany || matchProduct || matchEn || matchBrand || matchSku;
    }
    return true;
  });

  const getDecisionBadge = (decision: AdminProtectionDecision, status: string) => {
    if (decision === "approved" || status === "approved") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
          ✓ Approved
        </span>
      );
    }
    if (decision === "rejected" || status === "rejected") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700">
          ✕ Not Approved
        </span>
      );
    }
    if (decision === "needs_information" || status === "needs_information") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
          💬 Needs Info
        </span>
      );
    }
    if (status === "review_requested" || decision === "pending") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800 animate-pulse">
          ⚠️ Pending Review
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛡️</span>
            <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
              90-Day Initial Trial Protection Reviews
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Evaluate retailer sell-through performance, inspect store-level counts, and record authorized resolution decisions.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
          <span>K SELECT Admin Resolution Queue</span>
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div
          onClick={() => setActiveTab("all")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === "all"
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-zinc-900 shadow-sm"
              : "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
          }`}
        >
          <span className="text-[11px] font-bold opacity-70 uppercase tracking-wider block">
            All Records
          </span>
          <span className="text-2xl font-black mt-1 block">{initialCounts.all}</span>
        </div>

        <div
          onClick={() => setActiveTab("pending")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === "pending"
              ? "bg-amber-500 text-white border-amber-500 shadow-sm"
              : "bg-white dark:bg-zinc-900 text-amber-600 dark:text-amber-400 border-zinc-200 dark:border-zinc-800 hover:border-amber-300"
          }`}
        >
          <span className="text-[11px] font-bold opacity-80 uppercase tracking-wider block">
            Pending Review
          </span>
          <span className="text-2xl font-black mt-1 block">{initialCounts.pending}</span>
        </div>

        <div
          onClick={() => setActiveTab("needs_information")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === "needs_information"
              ? "bg-blue-600 text-white border-blue-600 shadow-sm"
              : "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 border-zinc-200 dark:border-zinc-800 hover:border-blue-300"
          }`}
        >
          <span className="text-[11px] font-bold opacity-80 uppercase tracking-wider block">
            Needs Info
          </span>
          <span className="text-2xl font-black mt-1 block">{initialCounts.needs_information}</span>
        </div>

        <div
          onClick={() => setActiveTab("approved")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === "approved"
              ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
              : "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 border-zinc-200 dark:border-zinc-800 hover:border-emerald-300"
          }`}
        >
          <span className="text-[11px] font-bold opacity-80 uppercase tracking-wider block">
            Approved
          </span>
          <span className="text-2xl font-black mt-1 block">{initialCounts.approved}</span>
        </div>

        <div
          onClick={() => setActiveTab("rejected")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === "rejected"
              ? "bg-zinc-700 text-white border-zinc-700 shadow-sm"
              : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
          }`}
        >
          <span className="text-[11px] font-bold opacity-80 uppercase tracking-wider block">
            Not Approved
          </span>
          <span className="text-2xl font-black mt-1 block">{initialCounts.rejected}</span>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl border border-zinc-200 dark:border-zinc-700/60 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === "pending"
                ? "bg-white dark:bg-zinc-900 text-amber-700 dark:text-amber-400 shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            Pending Review ({initialCounts.pending})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("needs_information")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === "needs_information"
                ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            Needs Info ({initialCounts.needs_information})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("approved")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === "approved"
                ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            Approved ({initialCounts.approved})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("rejected")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === "rejected"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            Not Approved ({initialCounts.rejected})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === "all"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            All ({initialCounts.all})
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative flex-1 sm:max-w-xs">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Retailer, Product, SKU..."
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

      {/* Reviews Table / List */}
      {filteredReviews.length === 0 ? (
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl mx-auto">
            🛡️
          </div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
            No Protection Reviews Found
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
            {searchQuery
              ? `No protection records match "${searchQuery}".`
              : "There are currently no reviews matching this filter queue."}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Retailer Company</th>
                  <th className="py-3 px-4">Product / SKU</th>
                  <th className="py-3 px-4">Requested At</th>
                  <th className="py-3 px-4 text-center">Initial Trial</th>
                  <th className="py-3 px-4 text-right">Movement & Sell-Through</th>
                  <th className="py-3 px-4 text-center">Status / Decision</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredReviews.map((r) => {
                  const detailUrl = `/admin/protection-reviews/${r.id}`;
                  const isThresholdMet = r.sellThroughPercent >= 50;

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      {/* Retailer Company */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <span className="font-bold text-zinc-900 dark:text-white block">
                            {r.companyName}
                          </span>
                          <span className="text-[10px] text-zinc-500 block">
                            {r.totalStores} Store{r.totalStores > 1 ? "s" : ""} • {r.dataCoveragePercent}% Reporting
                          </span>
                        </div>
                      </td>

                      {/* Product */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-800 p-1 shrink-0 border border-zinc-100 dark:border-zinc-800 flex items-center justify-center overflow-hidden">
                            {r.thumbnailUrl ? (
                              <img
                                src={r.thumbnailUrl}
                                alt={r.productName}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <span className="text-base">📦</span>
                            )}
                          </div>
                          <div className="min-w-0 max-w-xs space-y-0.5">
                            <span className="font-bold text-zinc-900 dark:text-white block truncate">
                              {r.productName}
                            </span>
                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono">
                              <span className="font-sans font-bold text-zinc-700 dark:text-zinc-300">
                                {r.brandName}
                              </span>
                              <span>•</span>
                              <span>{r.sku}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Requested At */}
                      <td className="py-3.5 px-4 text-zinc-600 dark:text-zinc-400">
                        {r.requestedAt ? (
                          <div className="space-y-0.5">
                            <span className="font-bold text-zinc-900 dark:text-white block">
                              {new Date(r.requestedAt).toLocaleDateString()}
                            </span>
                            <span className="text-[10px] text-zinc-400 block">
                              {r.requestedByEmail || "Retailer User"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-zinc-400 italic">Not requested</span>
                        )}
                      </td>

                      {/* Initial Trial */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="space-y-0.5">
                          <span className="font-bold text-zinc-900 dark:text-white block">
                            {r.protectedQuantity} units
                          </span>
                          <span className="text-[10px] text-zinc-500 block">
                            {r.isPeriodEnded ? "Day 90+ (Ended)" : `Day ${r.daysElapsed} of 90`}
                          </span>
                        </div>
                      </td>

                      {/* Movement & Sell-Through */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="space-y-0.5">
                          <span
                            className={`font-black block ${
                              isThresholdMet
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {r.sellThroughPercent}% ({r.estimatedMovement}/{r.protectedQuantity} units)
                          </span>
                          <span className="text-[10px] text-zinc-400 block">
                            50% threshold: {Math.ceil(r.protectedQuantity * 0.5)} units
                          </span>
                        </div>
                      </td>

                      {/* Status / Decision */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="space-y-1">
                          {getDecisionBadge(r.decision, r.status)}
                          {r.decision === "approved" && r.approvedQuantity !== null && (
                            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 block">
                              Approved: {r.approvedQuantity} units {r.approvedCreditAmount !== null ? `($${r.approvedCreditAmount.toFixed(2)})` : ""}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={detailUrl}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors shadow-sm"
                        >
                          <span>Inspect & Decide</span>
                          <span>→</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
