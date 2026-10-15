"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  RetailerTrainingAnalyticsData,
  Retailer360StoreCoverageItem,
  Retailer360EmployeeTrainingItem,
  Retailer360TrainingGapItem,
  Retailer360StoreProductDetail,
} from "@/lib/retailer/admin-training-analytics";

interface Props {
  training: RetailerTrainingAnalyticsData;
  companyName: string;
}

type SubTab = "stores" | "employees" | "gaps";

export function Retailer360TrainingView({ training, companyName }: Props) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("stores");
  const [searchQuery, setSearchQuery] = useState("");
  const [gapFilter, setGapFilter] = useState<"all" | "needs_training" | "covered" | "unavailable">("all");
  const [expandedStoreId, setExpandedStoreId] = useState<string | null>(null);
  const [storeProductFilter, setStoreProductFilter] = useState<"all" | "covered" | "needs_training" | "not_available">("all");
  const [selectedEmployee, setSelectedEmployee] = useState<Retailer360EmployeeTrainingItem | null>(null);

  const { summary, stores, employees, gaps } = training;

  // Filtered employees for search
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    const q = searchQuery.toLowerCase().trim();
    return employees.filter(
      (e) =>
        e.userName.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.role.toLowerCase().includes(q) ||
        e.assignedStores.some((s) => s.name.toLowerCase().includes(q))
    );
  }, [employees, searchQuery]);

  // Filtered gaps
  const filteredGaps = useMemo(() => {
    return gaps.filter((g) => {
      if (gapFilter === "needs_training" && (g.status !== "needs_training" && g.status !== "partial")) return false;
      if (gapFilter === "covered" && g.status !== "covered") return false;
      if (gapFilter === "unavailable" && g.status !== "unavailable") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = g.productName.toLowerCase().includes(q);
        const matchSku = g.sku.toLowerCase().includes(q);
        const matchBrand = g.brandName.toLowerCase().includes(q);
        const matchCategory = g.category.toLowerCase().includes(q);
        return matchName || matchSku || matchBrand || matchCategory;
      }
      return true;
    });
  }, [gaps, gapFilter, searchQuery]);

  const needsTrainingGapsCount = gaps.filter((g) => g.status === "needs_training" || g.status === "partial").length;
  const coveredGapsCount = gaps.filter((g) => g.status === "covered").length;
  const unavailableGapsCount = gaps.filter((g) => g.status === "unavailable").length;

  return (
    <div className="space-y-6 w-full text-left">
      {/* 1. Header & Summary Section */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🎓</span>
              <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                Product Training Completion & Store Coverage
              </h3>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Authoritative staff learning analytics, verified quiz completions, and multi-store coverage tracking for {companyName}.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
              ✓ Server-Verified Quiz Passes Only
            </span>
          </div>
        </div>

        {/* Methodology Explainer Callout */}
        <div className="mt-4 p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-xs text-indigo-950 dark:text-indigo-200 flex items-start gap-2.5">
          <span className="text-base shrink-0 mt-0.5">ℹ️</span>
          <div>
            <span className="font-bold">Coverage Methodology: </span>
            A Store is considered <span className="font-semibold text-emerald-700 dark:text-emerald-400">Covered</span> for a product when at least ONE qualifying assigned employee passes the verified knowledge quiz. 
            Company Coverage is the ratio of covered (Store × Published Product) pairs to all eligible pairs across active stores carrying published products.
          </div>
        </div>

        {/* 4 Summary KPI Cards (Section 6) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 pt-5">
          {/* KPI 1: Store Coverage */}
          <div className="p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/40 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
              Training Coverage (%)
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                {summary.storeCoveragePercent !== null ? `${summary.storeCoveragePercent}%` : "N/A"}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {summary.eligiblePairsCount > 0
                ? `${summary.coveredPairsCount} / ${summary.eligiblePairsCount} Eligible Pairs`
                : "No Published Training"}
            </p>
          </div>

          {/* KPI 2: Covered Store/Product Pairs */}
          <div className="p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/40 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
              Covered Store/Product Pairs
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {summary.coveredPairsCount} / {summary.eligiblePairsCount}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {summary.coveredProductsCount} of {summary.eligiblePublishedProductsCount} distinct products covered
            </p>
          </div>

          {/* KPI 3: Employees with Verified Passes */}
          <div className="p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/40 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
              Employees with Verified Passes
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-zinc-900 dark:text-white">
                {summary.employeesTrainedCount} / {summary.totalEmployeesCount}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {summary.totalEmployeesCount > 0
                ? `${Math.round((summary.employeesTrainedCount / summary.totalEmployeesCount) * 100)}% of staff certified`
                : "No staff registered"}
            </p>
          </div>

          {/* KPI 4: Training Gaps */}
          <div className="p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/40 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
              Training Gaps
            </span>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-2xl font-black ${
                  summary.trainingGapsCount > 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {summary.trainingGapsCount}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {summary.trainingGapsCount === 0 ? "All carried products covered" : "Eligible pairs needing store staff training"}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Sub-View Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="inline-flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700/60">
          <button
            type="button"
            onClick={() => {
              setActiveSubTab("stores");
              setSearchQuery("");
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === "stores"
                ? "bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            🏪 Store Coverage ({stores.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveSubTab("employees");
              setSearchQuery("");
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === "employees"
                ? "bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            👥 Employee Completion ({employees.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveSubTab("gaps");
              setSearchQuery("");
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === "gaps"
                ? "bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            📦 Product Training Gaps ({gaps.length})
          </button>
        </div>

        {/* Search input for sub-tabs */}
        {(activeSubTab === "employees" || activeSubTab === "gaps") && (
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeSubTab === "employees" ? "Search employee, role, store..." : "Search product, SKU, brand..."}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
            />
            <span className="absolute left-2.5 top-2 text-zinc-400 text-xs">🔍</span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-2 text-zinc-400 hover:text-zinc-600 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3. SUB-VIEW: STORE COVERAGE WITH DRILL-DOWN (Section 9) */}
      {activeSubTab === "stores" && (
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs overflow-hidden dark:border-zinc-800 dark:bg-zinc-900">
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                Store-by-Store Training Coverage Matrix
              </h4>
              <p className="text-[11px] text-zinc-500">
                A store is considered covered for a product when at least ONE assigned staff member has passed the verified module.
              </p>
            </div>
            <span className="text-[10px] font-mono text-zinc-400">
              {stores.length} Store Location{stores.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/40 text-[11px] uppercase font-bold text-zinc-500 tracking-wider">
                  <th className="py-3 px-4">Store</th>
                  <th className="py-3 px-4">Assigned Staff</th>
                  <th className="py-3 px-3 text-center">Eligible Trainings</th>
                  <th className="py-3 px-3 text-center">Covered</th>
                  <th className="py-3 px-3 text-center">Needs Training</th>
                  <th className="py-3 px-4 text-center">Coverage %</th>
                  <th className="py-3 px-4 text-center">Last Completion</th>
                  <th className="py-3 px-4 text-right">Drill-down</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {stores.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-zinc-500">
                      No authorized store locations recorded for this retailer.
                    </td>
                  </tr>
                ) : (
                  stores.map((st) => {
                    const isExpanded = expandedStoreId === st.storeId;
                    const storeProducts = st.products || [];
                    const filteredStoreProducts = storeProducts.filter((p) => {
                      if (storeProductFilter === "covered") return p.coverageStatus === "covered";
                      if (storeProductFilter === "needs_training") return p.coverageStatus === "needs_training";
                      if (storeProductFilter === "not_available") return p.coverageStatus === "not_available";
                      return true;
                    });

                    return (
                      <React.Fragment key={st.storeId}>
                        <tr className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-bold text-zinc-900 dark:text-white block">
                              🏪 {st.storeName}
                            </span>
                            {(st.city || st.state) && (
                              <span className="text-[10px] text-zinc-400">
                                {[st.city, st.state].filter(Boolean).join(", ")}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {st.assignedEmployeeNames.length === 0 ? (
                                <span className="text-[10px] text-rose-500 font-semibold bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900">
                                  ⚠️ Unassigned / Needs Review
                                </span>
                              ) : (
                                st.assignedEmployeeNames.map((name, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2 py-0.5 rounded"
                                  >
                                    👤 {name}
                                  </span>
                                ))
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3 text-center font-mono font-bold text-zinc-700 dark:text-zinc-300">
                            {st.publishedProductsCount}
                          </td>

                          <td className="py-3 px-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {st.coveredProductsCount}
                          </td>

                          <td className="py-3 px-3 text-center font-mono font-bold">
                            {st.needsTrainingCount > 0 ? (
                              <span className="text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded font-bold">
                                {st.needsTrainingCount}
                              </span>
                            ) : (
                              <span className="text-zinc-400">0</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    (st.coveragePercent || 0) >= 80
                                      ? "bg-emerald-500"
                                      : (st.coveragePercent || 0) > 0
                                      ? "bg-indigo-500"
                                      : "bg-zinc-300 dark:bg-zinc-700"
                                  }`}
                                  style={{ width: `${st.coveragePercent || 0}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-mono font-bold min-w-[36px] text-right">
                                {st.coveragePercent !== null ? `${st.coveragePercent}%` : "N/A"}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-center text-[11px] font-mono text-zinc-500">
                            {st.lastCompletedAt ? new Date(st.lastCompletedAt).toLocaleDateString() : "—"}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedStoreId(isExpanded ? null : st.storeId);
                                setStoreProductFilter("all");
                              }}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900 transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              <span>{isExpanded ? "▲ Hide" : "▼ Products"}</span>
                              <span className="text-[10px] text-zinc-400">({storeProducts.length})</span>
                            </button>
                          </td>
                        </tr>

                        {/* STORE DRILL-DOWN SUB-VIEW (Section 9) */}
                        {isExpanded && (
                          <tr className="bg-zinc-50/80 dark:bg-zinc-950/40 border-b border-zinc-200 dark:border-zinc-800">
                            <td colSpan={8} className="p-4 sm:p-5">
                              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-3 shadow-xs">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                                  <div>
                                    <h5 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                      <span>🏪 {st.storeName} — Product Coverage Drill-Down</span>
                                    </h5>
                                    <p className="text-[11px] text-zinc-500 mt-0.5">
                                      Detailed staff training status for all products carried at this store.
                                    </p>
                                  </div>

                                  {/* Filter Buttons: All, Covered, Needs Training, Not Available */}
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setStoreProductFilter("all")}
                                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                                        storeProductFilter === "all"
                                          ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200"
                                      }`}
                                    >
                                      All ({storeProducts.length})
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setStoreProductFilter("covered")}
                                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                                        storeProductFilter === "covered"
                                          ? "bg-emerald-600 text-white"
                                          : "bg-zinc-100 dark:bg-zinc-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50"
                                      }`}
                                    >
                                      Covered ({storeProducts.filter((p) => p.coverageStatus === "covered").length})
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setStoreProductFilter("needs_training")}
                                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                                        storeProductFilter === "needs_training"
                                          ? "bg-rose-600 text-white"
                                          : "bg-zinc-100 dark:bg-zinc-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50"
                                      }`}
                                    >
                                      Needs Training ({storeProducts.filter((p) => p.coverageStatus === "needs_training").length})
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setStoreProductFilter("not_available")}
                                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                                        storeProductFilter === "not_available"
                                          ? "bg-zinc-600 text-white"
                                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200"
                                      }`}
                                    >
                                      Not Available ({storeProducts.filter((p) => p.coverageStatus === "not_available").length})
                                    </button>
                                  </div>
                                </div>

                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="border-b border-zinc-100 dark:border-zinc-800 text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                                        <th className="py-2 px-3">Product</th>
                                        <th className="py-2 px-3">SKU / Brand</th>
                                        <th className="py-2 px-2 text-center">Training Status</th>
                                        <th className="py-2 px-2 text-center">Coverage Status</th>
                                        <th className="py-2 px-3">Qualified Employee</th>
                                        <th className="py-2 px-3 text-right">Latest Pass Date</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                      {filteredStoreProducts.length === 0 ? (
                                        <tr>
                                          <td colSpan={6} className="py-4 text-center text-zinc-400 text-xs">
                                            No products match this filter.
                                          </td>
                                        </tr>
                                      ) : (
                                        filteredStoreProducts.map((p) => (
                                          <tr key={p.productId} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20">
                                            <td className="py-2.5 px-3">
                                              <span className="font-bold text-zinc-900 dark:text-white block">
                                                {p.productName}
                                              </span>
                                              <span className="text-[10px] text-zinc-400">{p.category}</span>
                                            </td>

                                            <td className="py-2.5 px-3">
                                              <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400 block">
                                                {p.sku}
                                              </span>
                                              <span className="text-[10px] text-zinc-400">{p.brandName}</span>
                                            </td>

                                            <td className="py-2.5 px-2 text-center">
                                              {p.trainingStatus === "published" ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                  Published (v{p.trainingVersion})
                                                </span>
                                              ) : p.trainingStatus === "draft" ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                                  Draft
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-500 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                                                  Unavailable
                                                </span>
                                              )}
                                            </td>

                                            <td className="py-2.5 px-2 text-center">
                                              {p.coverageStatus === "covered" ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                                  ✓ Covered
                                                </span>
                                              ) : p.coverageStatus === "needs_training" ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                                  ⚠ Needs Training
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-500 dark:bg-zinc-800">
                                                  Not Available
                                                </span>
                                              )}
                                            </td>

                                            <td className="py-2.5 px-3">
                                              {p.qualifiedEmployees.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                  {p.qualifiedEmployees.map((name, i) => (
                                                    <span
                                                      key={i}
                                                      className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded"
                                                    >
                                                      👤 {name}
                                                    </span>
                                                  ))}
                                                </div>
                                              ) : (
                                                <span className="text-[11px] text-zinc-400">None yet</span>
                                              )}
                                            </td>

                                            <td className="py-2.5 px-3 text-right text-[11px] font-mono text-zinc-500">
                                              {p.latestPassDate ? new Date(p.latestPassDate).toLocaleDateString() : "—"}
                                            </td>
                                          </tr>
                                        ))
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. SUB-VIEW: EMPLOYEE COMPLETION (Section 10) */}
      {activeSubTab === "employees" && (
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs overflow-hidden dark:border-zinc-800 dark:bg-zinc-900">
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                Staff Training Certification Status
              </h4>
              <p className="text-[11px] text-zinc-500">
                Individual employee assessment completions for products carried at their assigned stores.
              </p>
            </div>
            <span className="text-[10px] font-mono text-zinc-400">
              {filteredEmployees.length} Staff Member{filteredEmployees.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/40 text-[11px] uppercase font-bold text-zinc-500 tracking-wider">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-4">Store Assignment(s)</th>
                  <th className="py-3 px-3 text-center">Completed Trainings</th>
                  <th className="py-3 px-3 text-center">Available Trainings</th>
                  <th className="py-3 px-4 text-center">Completion %</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Latest Completion</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-zinc-500">
                      {searchQuery ? `No staff members match "${searchQuery}".` : "No staff members enrolled."}
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr key={emp.userId} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-bold text-zinc-900 dark:text-white block">
                          👤 {emp.userName}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {emp.email}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                          {emp.role}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {emp.hasAllStoresAccess || emp.role === "owner" ? (
                            <span className="text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900">
                              🌐 All Stores ({stores.length})
                            </span>
                          ) : emp.assignedStores.length === 0 ? (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900">
                              ⚠️ Unassigned / Needs Review
                            </span>
                          ) : (
                            emp.assignedStores.map((st) => (
                              <span
                                key={st.id}
                                className="text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2 py-0.5 rounded"
                              >
                                🏪 {st.name}
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {emp.productsCompletedCount}
                      </td>

                      <td className="py-3 px-3 text-center font-mono font-bold text-zinc-700 dark:text-zinc-300">
                        {emp.availablePublishedCount}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                emp.completionPercent === 100
                                  ? "bg-emerald-500"
                                  : emp.completionPercent > 0
                                  ? "bg-indigo-500"
                                  : "bg-zinc-300 dark:bg-zinc-700"
                              }`}
                              style={{ width: `${emp.completionPercent}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono font-bold min-w-[36px] text-right">
                            {emp.completionPercent}%
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center">
                        {emp.status === "certified" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            ✓ Certified
                          </span>
                        ) : emp.status === "in_progress" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            In Progress
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                            Not Started
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center text-[11px] font-mono text-zinc-500">
                        {emp.latestCompletionAt ? new Date(emp.latestCompletionAt).toLocaleDateString() : "—"}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedEmployee(emp)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900 transition-colors cursor-pointer"
                        >
                          View Detail →
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. SUB-VIEW: PRODUCT TRAINING GAPS (Section 11) */}
      {activeSubTab === "gaps" && (
        <div className="space-y-4">
          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setGapFilter("all")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                gapFilter === "all"
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50"
              }`}
            >
              All Products ({gaps.length})
            </button>
            <button
              type="button"
              onClick={() => setGapFilter("needs_training")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                gapFilter === "needs_training"
                  ? "bg-rose-600 text-white"
                  : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50"
              }`}
            >
              Needs Training ({needsTrainingGapsCount})
            </button>
            <button
              type="button"
              onClick={() => setGapFilter("covered")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                gapFilter === "covered"
                  ? "bg-emerald-600 text-white"
                  : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50"
              }`}
            >
              Covered ({coveredGapsCount})
            </button>
            <button
              type="button"
              onClick={() => setGapFilter("unavailable")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                gapFilter === "unavailable"
                  ? "bg-zinc-600 text-white"
                  : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50"
              }`}
            >
              Unavailable / Draft ({unavailableGapsCount})
            </button>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs overflow-hidden dark:border-zinc-800 dark:bg-zinc-900">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                  Product Training Gap Analysis
                </h4>
                <p className="text-[11px] text-zinc-500">
                  Identifies which products carried by retail stores still lack staff certification.
                </p>
              </div>
              <span className="text-[10px] font-mono text-zinc-400">
                {filteredGaps.length} Product{filteredGaps.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/40 text-[11px] uppercase font-bold text-zinc-500 tracking-wider">
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-3">SKU / Brand</th>
                    <th className="py-3 px-3 text-center">Publication Status</th>
                    <th className="py-3 px-4 text-center">Eligible Stores</th>
                    <th className="py-3 px-3 text-center">Covered Stores</th>
                    <th className="py-3 px-3 text-center">Stores Needing Training</th>
                    <th className="py-3 px-4">Store Breakdown</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filteredGaps.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-zinc-500">
                        {searchQuery ? `No products match "${searchQuery}".` : "No products found in this category."}
                      </td>
                    </tr>
                  ) : (
                    filteredGaps.map((g) => {
                      const uncoveredStores = g.eligibleStores.filter((s) => !s.isCovered);
                      return (
                        <tr key={g.productId} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-bold text-zinc-900 dark:text-white block">
                              {g.productName}
                            </span>
                            <span className="text-[10px] text-zinc-400">
                              {g.category}
                            </span>
                          </td>

                          <td className="py-3 px-3">
                            <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400 block">
                              {g.sku}
                            </span>
                            <span className="text-[10px] text-zinc-400">
                              {g.brandName}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-center">
                            {g.trainingStatus === "published" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                Published (v{g.trainingVersion})
                              </span>
                            ) : g.trainingStatus === "draft" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                Draft
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                Unavailable
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center font-mono font-bold text-zinc-800 dark:text-zinc-200">
                            {g.eligibleStoresCount}
                          </td>

                          <td className="py-3 px-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {g.coveredStoresCount}
                          </td>

                          <td className="py-3 px-3 text-center font-mono font-bold">
                            {uncoveredStores.length > 0 ? (
                              <span className="text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded">
                                {uncoveredStores.length}
                              </span>
                            ) : (
                              <span className="text-zinc-400">0</span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1.5 max-w-sm">
                              {g.eligibleStores.map((st) => (
                                <div
                                  key={st.storeId}
                                  className={`text-[10px] px-2 py-0.5 rounded flex items-center gap-1 border ${
                                    st.isCovered
                                      ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
                                      : "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300"
                                  }`}
                                  title={
                                    st.isCovered
                                      ? `Covered by: ${st.coveringEmployees.join(", ")}`
                                      : "No assigned staff has passed this module"
                                  }
                                >
                                  <span>{st.isCovered ? "✓" : "✕"}</span>
                                  <span className="font-semibold">{st.storeName}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. Employee Completion Breakdown Modal (Section 10) */}
      {selectedEmployee && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Staff Training Record: {selectedEmployee.userName}
                </h3>
                <p className="text-xs text-zinc-500">
                  {selectedEmployee.email} · {selectedEmployee.role} ·{" "}
                  {selectedEmployee.hasAllStoresAccess || selectedEmployee.role === "owner"
                    ? "All Stores"
                    : selectedEmployee.assignedStores.length > 0
                    ? selectedEmployee.assignedStores.map((s) => s.name).join(", ")
                    : "Unassigned"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEmployee(null)}
                className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-800 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                Personal Progress: {selectedEmployee.productsCompletedCount} of {selectedEmployee.availablePublishedCount} Completed ({selectedEmployee.completionPercent}%)
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  selectedEmployee.status === "certified"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                }`}
              >
                {selectedEmployee.status === "certified" ? "✓ Fully Certified" : "In Progress"}
              </span>
            </div>

            {/* Store attribution note */}
            <div className="p-3 rounded-xl bg-zinc-100/70 dark:bg-zinc-800/40 text-[11px] text-zinc-600 dark:text-zinc-400">
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">Relevant Store Coverage: </span>
              {selectedEmployee.hasAllStoresAccess || selectedEmployee.role === "owner"
                ? `Qualifying passes contribute to all ${stores.length} store locations in the company.`
                : selectedEmployee.assignedStores.length > 0
                ? `Qualifying passes contribute to: ${selectedEmployee.assignedStores.map((s) => s.name).join(", ")}.`
                : "⚠️ This employee has no store assignment. Passes are preserved for individual certification, but do not contribute to any store coverage."}
            </div>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {selectedEmployee.completions.map((c) => (
                <div
                  key={c.productId}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                    c.isCompleted
                      ? "bg-emerald-50/40 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800"
                      : "bg-zinc-50/40 border-zinc-200 dark:bg-zinc-800/20 dark:border-zinc-800"
                  }`}
                >
                  <div>
                    <span className="font-bold text-zinc-900 dark:text-white block">
                      {c.productName}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {c.sku} · {c.brandName} · v{c.trainingVersion}
                    </span>
                  </div>

                  <div className="text-right shrink-0">
                    {c.isCompleted ? (
                      <div>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          <span>✓</span> Verified Pass
                        </span>
                        {c.completedAt && (
                          <span className="block text-[10px] font-mono text-zinc-400">
                            {new Date(c.completedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] font-semibold text-zinc-400">
                        Not Completed
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Zero answer key exposure security note (Section 15) */}
            <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
              <span>🛡️</span>
              <span>Strict Security: Knowledge assessment quiz questions and answer keys are protected server-side and never exposed to reporting clients.</span>
            </div>

            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedEmployee(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Versioning & Retraining Policy Notice (Section 12) */}
      <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/60 p-4 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400 flex items-start gap-3">
        <span className="text-base shrink-0 mt-0.5">📋</span>
        <div className="space-y-1">
          <span className="font-bold text-zinc-900 dark:text-white">
            Training Versioning & Retraining Policy
          </span>
          <p className="text-[11px] leading-relaxed">
            Minor updates (<code className="font-mono text-[10px] bg-zinc-200/70 dark:bg-zinc-800 px-1 py-0.5 rounded">minor</code>) retain certified pass status for existing staff. 
            For Major updates (<code className="font-mono text-[10px] bg-zinc-200/70 dark:bg-zinc-800 px-1 py-0.5 rounded">major</code>), owner retraining policy is pending decision (<span className="font-semibold text-amber-700 dark:text-amber-400">NEEDS OWNER DECISION</span>). All historical verified completions currently remain honored.
          </p>
        </div>
      </div>
    </div>
  );
}
