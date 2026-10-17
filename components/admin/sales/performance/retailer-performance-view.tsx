"use client";

import React, { useState, useMemo, useTransition } from "react";
import {
  RetailerPerformanceOverview,
  StorePerformanceRecord,
  CompanyPerformanceRecord,
  HqFollowUpStatus,
} from "@/lib/retailer/sales-performance/performance-types";
import { getRetailerPerformanceData } from "@/lib/retailer/sales-performance/performance-actions";
import { StorePerformanceTable } from "./store-performance-table";
import { StoreDetailDrawer } from "./store-detail-drawer";
import {
  StoreIcon as Store,
  BuildingIcon as Building2,
  TrendingUpIcon as TrendingUp,
  TrendingDownIcon as TrendingDown,
  AlertTriangleIcon as AlertTriangle,
  ShieldCheckIcon as ShieldCheck,
  SearchIcon as Search,
  RotateCcwIcon as RotateCcw,
  CalendarIcon as Calendar,
  ZapIcon as Zap,
  ClockIcon as Clock,
} from "./performance-icons";

interface RetailerPerformanceViewProps {
  initialData: RetailerPerformanceOverview;
  initialBenchmarkMs?: number;
}

export function RetailerPerformanceView({
  initialData,
  initialBenchmarkMs,
}: RetailerPerformanceViewProps) {
  const [data, setData] = useState<RetailerPerformanceOverview>(initialData);
  const [benchmarkMs, setBenchmarkMs] = useState<number | undefined>(initialBenchmarkMs);
  const [isPending, startTransition] = useTransition();

  // Selected Store for Right-Side Detail Drawer
  const [selectedStore, setSelectedStore] = useState<StorePerformanceRecord | null>(null);

  // View Mode: Store (Default) vs Company
  const [viewMode, setViewMode] = useState<"store" | "company">("store");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedHqStatus, setSelectedHqStatus] = useState<string>("all");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("all");
  const [selectedEvalStatus, setSelectedEvalStatus] = useState<string>("all");
  const [includeTestOrders, setIncludeTestOrders] = useState<boolean>(initialData.isTestModeActive || false);

  // Sorting
  const [sortKey, setSortKey] = useState<string>("currentNetSalesDollars");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Format currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Toggle QA Mode (includeTestOrders)
  const handleToggleTestMode = (checked: boolean) => {
    setIncludeTestOrders(checked);
    startTransition(async () => {
      const res = await getRetailerPerformanceData({ includeTestOrders: checked });
      if (res.success && res.data) {
        setData(res.data);
        if (res.benchmarkMs !== undefined) {
          setBenchmarkMs(res.benchmarkMs);
        }
      }
    });
  };

  // Refresh data
  const handleRefresh = () => {
    startTransition(async () => {
      const res = await getRetailerPerformanceData({ includeTestOrders });
      if (res.success && res.data) {
        setData(res.data);
        if (res.benchmarkMs !== undefined) {
          setBenchmarkMs(res.benchmarkMs);
        }
      }
    });
  };

  // Handle Sort Change
  const handleSortChange = (key: string) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
  };

  // Unique companies for dropdown
  const uniqueCompanies = useMemo(() => {
    const map = new Map<string, string>();
    data.stores.forEach((s) => {
      if (!map.has(s.companyId)) {
        map.set(s.companyId, s.companyName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [data.stores]);

  // Filtered and Sorted Stores
  const filteredStores = useMemo(() => {
    let result = [...data.stores];

    // 1. Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.storeName.toLowerCase().includes(q) ||
          s.companyName.toLowerCase().includes(q) ||
          (s.city && s.city.toLowerCase().includes(q)) ||
          (s.state && s.state.toLowerCase().includes(q)) ||
          (s.storeCode && s.storeCode.toLowerCase().includes(q))
      );
    }

    // 2. HQ Follow-up filter
    if (selectedHqStatus !== "all") {
      result = result.filter((s) => s.followUp.status === selectedHqStatus);
    }

    // 3. Company filter
    if (selectedCompanyId !== "all") {
      result = result.filter((s) => s.companyId === selectedCompanyId);
    }

    // 4. Eval status filter
    if (selectedEvalStatus === "new") {
      result = result.filter((s) => s.evaluationStatus === "new");
    } else if (selectedEvalStatus === "mature") {
      result = result.filter((s) => s.evaluationStatus === "not_rated" || s.evaluationStatus === "graded");
    }

    // 5. Sorting
    result.sort((a, b) => {
      let comparison = 0;
      if (sortKey === "storeName") {
        comparison = a.storeName.localeCompare(b.storeName);
      } else if (sortKey === "companyName") {
        comparison = a.companyName.localeCompare(b.companyName);
      } else if (sortKey === "storeAgeDays") {
        comparison = a.sales.storeAgeDays - b.sales.storeAgeDays;
      } else if (sortKey === "currentNetSalesDollars") {
        comparison = a.sales.currentNetSalesDollars - b.sales.currentNetSalesDollars;
      } else if (sortKey === "confirmedReordersCount") {
        comparison = a.sales.confirmedReordersCount - b.sales.confirmedReordersCount;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [
    data.stores,
    searchQuery,
    selectedHqStatus,
    selectedCompanyId,
    selectedEvalStatus,
    sortKey,
    sortOrder,
  ]);

  // Filtered Companies
  const filteredCompanies = useMemo(() => {
    let result = [...data.companies];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((c) => c.companyName.toLowerCase().includes(q));
    }

    if (selectedCompanyId !== "all") {
      result = result.filter((c) => c.companyId === selectedCompanyId);
    }

    return result;
  }, [data.companies, searchQuery, selectedCompanyId]);

  // Active filters count
  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    selectedHqStatus !== "all" ||
    selectedCompanyId !== "all" ||
    selectedEvalStatus !== "all";

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedHqStatus("all");
    setSelectedCompanyId("all");
    setSelectedEvalStatus("all");
  };

  const kpis = data.kpis;
  const newStoresCount = data.stores.filter((s) => s.evaluationStatus === "new").length;
  const totalUnallocatedDollars = data.companies.reduce((sum, c) => sum + c.unallocatedSalesDollars, 0);

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* 1. Header (Left-aligned, full width) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Retailer Performance
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              V2.0 · Store-First Intelligence
            </span>
            {benchmarkMs !== undefined && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800">
                <Zap className="w-2.5 h-2.5 text-amber-400" />
                {benchmarkMs}ms (5 batched queries)
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Store-level net product sales, calendar 60D growth, 3 partnership compliance obligations, and actionable HQ support diagnosis.
          </p>
        </div>

        {/* Action Controls & QA Mode */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* QA Toggle */}
          <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 cursor-pointer text-xs transition-colors">
            <input
              type="checkbox"
              checked={includeTestOrders}
              onChange={(e) => handleToggleTestMode(e.target.checked)}
              disabled={isPending}
              className="rounded bg-zinc-950 border-zinc-700 text-cyan-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-zinc-300 font-medium select-none">
              Include Test Orders (QA Mode)
            </span>
          </label>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700/80 transition-colors disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* QA Mode Active Banner: Clearly separates test data from authoritative business KPIs */}
      {includeTestOrders && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-500 text-black uppercase tracking-wider shrink-0">
              TEST DATA INCLUDED
            </span>
            <span className="text-zinc-200">
              <strong className="text-white">Admin QA Mode Active:</strong> Performance metrics, sales cards, and order counts currently include test orders (<code>is_test = true</code>) for verification. Default business view strictly excludes test records.
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleToggleTestMode(false)}
            className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-bold shrink-0 transition-colors self-start sm:self-auto"
          >
            Revert to Official KPIs
          </button>
        </div>
      )}

      {/* 2. Evaluation Window & Store Scope Secondary Summary Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40 text-xs text-zinc-400">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-zinc-300">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold text-white">Current 60D:</span>{" "}
            {kpis.evaluationPeriod.currentPeriodStart} – {kpis.evaluationPeriod.currentPeriodEnd}
          </div>
          <span className="text-zinc-600 hidden sm:inline">|</span>
          <div className="text-zinc-400">
            <span className="font-medium text-zinc-300">Previous 60D:</span>{" "}
            {kpis.evaluationPeriod.previousPeriodStart} – {kpis.evaluationPeriod.previousPeriodEnd}
          </div>
          <span className="text-zinc-600 hidden sm:inline">|</span>
          <div className="flex items-center gap-1.5 text-zinc-300">
            <Store className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-medium text-white">Evaluated Stores:</span>{" "}
            <span className="text-white font-bold">{kpis.totalActiveStoresCount} active</span>
            <span className="text-zinc-500">/ {data.stores.length} total</span>
            {newStoresCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                {newStoresCount} New (Day 0–59)
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-zinc-500 font-mono">
          <Clock className="w-3 h-3 text-zinc-400" />
          Timezone: {kpis.evaluationPeriod.timezone} (ET)
        </div>
      </div>

      {/* 3. Top 4 Primary KPI Summary Cards (Owner Approved Order) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: B2B Net Sales */}
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold uppercase tracking-wider">
            <span>B2B Net Sales</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">
              {formatCurrency(kpis.totalNetSalesDollars)}
            </span>
            <span className="text-xs text-zinc-500">
              60D Net Sales
            </span>
          </div>
          <div className="mt-1.5 text-xs text-zinc-400">
            {totalUnallocatedDollars > 0 ? (
              <span className="text-amber-400 font-medium">
                Includes {formatCurrency(totalUnallocatedDollars)} unallocated
              </span>
            ) : (
              <span>100% orders store-attributed</span>
            )}
          </div>
        </div>

        {/* KPI 2: Sales Growth */}
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold uppercase tracking-wider">
            <span>Sales Growth</span>
            {kpis.salesGrowthPercent !== null && kpis.salesGrowthPercent < 0 ? (
              <TrendingDown className="w-4 h-4 text-rose-400" />
            ) : (
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            {kpis.salesGrowthLabel === "New Revenue" ? (
              <span className="text-2xl font-bold text-emerald-400">New Revenue</span>
            ) : kpis.salesGrowthPercent !== null && kpis.salesGrowthPercent > 0 ? (
              <span className="text-2xl font-bold text-emerald-400">{kpis.salesGrowthLabel}</span>
            ) : kpis.salesGrowthPercent !== null && kpis.salesGrowthPercent < 0 ? (
              <span className="text-2xl font-bold text-rose-400">{kpis.salesGrowthLabel}</span>
            ) : (
              <span className="text-2xl font-bold text-zinc-400">{kpis.salesGrowthLabel}</span>
            )}
            <span className="text-xs text-zinc-500">
              vs prev 60D
            </span>
          </div>
          <div className="mt-1.5 text-xs text-zinc-400">
            Prev: {formatCurrency(kpis.previousNetSalesDollars)} (non-overlapping)
          </div>
        </div>

        {/* KPI 3: Support Required Stores */}
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold uppercase tracking-wider">
            <span>Support Required Stores</span>
            <ShieldCheck className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">
              {kpis.supportRequiredStoresCount}
            </span>
            <span className="text-xs text-zinc-500">
              distinct stores diagnosed
            </span>
          </div>
          <div className="mt-1.5 text-xs text-zinc-400">
            Tailored programs diagnosed from store metrics
          </div>
        </div>

        {/* KPI 4: HQ Follow-up Gaps */}
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold uppercase tracking-wider">
            <span>HQ Follow-up Gaps</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-400">
              {kpis.hqFollowUpGapsCount}
            </span>
            <span className="text-xs text-zinc-500">
              stores requiring follow-up
            </span>
          </div>
          <div className="mt-1.5 text-xs text-zinc-400">
            Overdue tasks or unrecorded engagement
          </div>
        </div>
      </div>

      {/* 4. View Mode Switcher & Filter Toolbar */}
      <div className="flex flex-col gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-900/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* View Mode Toggle: Store View vs Company View */}
          <div className="flex items-center gap-1 p-1 bg-zinc-950 border border-zinc-800 rounded-lg shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("store")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                viewMode === "store"
                  ? "bg-cyan-600 text-white shadow-xs"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              Store View (Default)
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-900/60 text-cyan-200">
                {filteredStores.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("company")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                viewMode === "company"
                  ? "bg-cyan-600 text-white shadow-xs"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Company View
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-900/60 text-cyan-200">
                {filteredCompanies.length}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
            <input
              type="text"
              placeholder={
                viewMode === "store"
                  ? "Search by store name, company, city, state, code..."
                  : "Search companies..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Filter Row (Only for Store View) */}
        {viewMode === "store" && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800/60">
            {/* HQ Status Filter */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-semibold text-zinc-400 mr-1">HQ Status:</span>
              {(
                [
                  { id: "all", label: "All" },
                  { id: "action_required", label: "Action Required" },
                  { id: "attention", label: "Attention" },
                  { id: "on_track", label: "On Track" },
                  { id: "data_review", label: "Data Review" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedHqStatus(f.id)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    selectedHqStatus === f.id
                      ? "bg-zinc-700 text-white font-semibold"
                      : "bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Evaluation Status Filter */}
            <div className="flex items-center gap-1 sm:ml-4">
              <span className="text-[11px] font-semibold text-zinc-400 mr-1">Eval:</span>
              {(
                [
                  { id: "all", label: "All" },
                  { id: "new", label: "New (0–59D)" },
                  { id: "mature", label: "Mature (60D+)" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedEvalStatus(f.id)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    selectedEvalStatus === f.id
                      ? "bg-zinc-700 text-white font-semibold"
                      : "bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Company Dropdown Filter if multiple companies */}
            {uniqueCompanies.length > 1 && (
              <div className="flex items-center gap-1 sm:ml-4">
                <span className="text-[11px] font-semibold text-zinc-400 mr-1">Company:</span>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="px-2 py-1 text-[11px] bg-zinc-950 border border-zinc-800 rounded text-zinc-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">All Companies</option>
                  {uniqueCompanies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Reset Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white px-2 py-1 rounded hover:bg-zinc-800 transition-colors ml-auto"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* 5. Main Table (Store View or Company View) */}
      <StorePerformanceTable
        viewMode={viewMode}
        stores={filteredStores}
        companies={filteredCompanies}
        onSelectStore={(store) => setSelectedStore(store)}
        sortKey={sortKey}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
      />

      {/* 6. Right-Side Detail Drawer */}
      <StoreDetailDrawer
        store={selectedStore}
        isOpen={selectedStore !== null}
        onClose={() => setSelectedStore(null)}
      />
    </div>
  );
}
