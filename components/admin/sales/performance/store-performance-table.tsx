"use client";

import React from "react";
import {
  StorePerformanceRecord,
  CompanyPerformanceRecord,
  HqFollowUpStatus,
  RecommendedProgramType,
} from "@/lib/retailer/sales-performance/performance-types";
import {
  BuildingIcon as Building2,
  StoreIcon as Store,
  ChevronRightIcon as ChevronRight,
  TrendingUpIcon as TrendingUp,
  TrendingDownIcon as TrendingDown,
  MinusIcon as Minus,
  CheckCircleIcon as CheckCircle2,
  AlertTriangleIcon as AlertTriangle,
  HelpCircleIcon as HelpCircle,
  ShieldCheckIcon as ShieldCheck,
  PackageIcon as Package,
  GraduationCapIcon as GraduationCap,
  SparklesIcon as Sparkles,
  ArrowUpDownIcon as ArrowUpDown,
  ArrowUpIcon as ArrowUp,
  ArrowDownIcon as ArrowDown,
  AlertCircleIcon as AlertCircle,
} from "./performance-icons";

interface StorePerformanceTableProps {
  viewMode: "store" | "company";
  stores: StorePerformanceRecord[];
  companies: CompanyPerformanceRecord[];
  onSelectStore: (store: StorePerformanceRecord) => void;
  onSelectCompany?: (company: CompanyPerformanceRecord) => void;
  sortKey: string;
  sortOrder: "asc" | "desc";
  onSortChange: (key: string) => void;
}

export function StorePerformanceTable({
  viewMode,
  stores,
  companies,
  onSelectStore,
  onSelectCompany,
  sortKey,
  sortOrder,
  onSortChange,
}: StorePerformanceTableProps) {
  // Format currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  // Render sort header icon
  const renderSortIcon = (columnKey: string) => {
    if (sortKey !== columnKey) {
      return <ArrowUpDown className="w-3 h-3 text-zinc-600 inline ml-1" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="w-3 h-3 text-cyan-400 inline ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 text-cyan-400 inline ml-1" />
    );
  };

  // Render HQ Status Badge
  const renderHqStatusBadge = (status: HqFollowUpStatus) => {
    switch (status) {
      case "on_track":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> On Track
          </span>
        );
      case "attention":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3 h-3" /> Attention
          </span>
        );
      case "action_required":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-3 h-3" /> Action Required
          </span>
        );
      case "data_review":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
            <HelpCircle className="w-3 h-3" /> Data Review
          </span>
        );
    }
  };

  // Render Growth Badge
  const renderGrowthBadge = (growthLabel: string, growthPct: number | null) => {
    if (growthLabel === "New Store") {
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
          New Store
        </span>
      );
    }
    if (growthLabel === "New Revenue") {
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <TrendingUp className="w-2.5 h-2.5" /> New Revenue
        </span>
      );
    }
    if (growthLabel === "N/A" || growthPct === null) {
      return <span className="text-zinc-500 text-xs">N/A</span>;
    }
    if (growthPct > 0) {
      return (
        <span className="inline-flex items-center gap-0.5 font-medium text-emerald-400 text-xs">
          <TrendingUp className="w-3 h-3" />
          {growthLabel}
        </span>
      );
    }
    if (growthPct < 0) {
      return (
        <span className="inline-flex items-center gap-0.5 font-medium text-rose-400 text-xs">
          <TrendingDown className="w-3 h-3" />
          {growthLabel}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-0.5 text-zinc-400 text-xs">
        <Minus className="w-3 h-3" /> 0.0%
      </span>
    );
  };

  // Render Program Badge
  const renderProgramBadge = (programType: RecommendedProgramType, title: string) => {
    let colorClass = "bg-zinc-800 text-zinc-300 border-zinc-700";
    if (programType === "display_compliance_review") {
      colorClass = "bg-amber-500/10 text-amber-300 border-amber-500/20";
    } else if (programType === "inventory_reporting_recovery") {
      colorClass = "bg-blue-500/10 text-blue-300 border-blue-500/20";
    } else if (programType === "training_support") {
      colorClass = "bg-purple-500/10 text-purple-300 border-purple-500/20";
    } else if (programType === "growth_expansion") {
      colorClass = "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";
    } else if (programType === "sales_improvement") {
      colorClass = "bg-pink-500/10 text-pink-300 border-pink-500/20";
    }

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${colorClass}`}
      >
        <Sparkles className="w-2.5 h-2.5 opacity-75" />
        {title}
      </span>
    );
  };

  // Unallocated orders across all companies
  const unallocatedCompanies = companies.filter((c) => c.unallocatedOrdersCount > 0);

  // ==========================================
  // 1. STORE VIEW
  // ==========================================
  if (viewMode === "store") {
    return (
      <div className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/80 text-zinc-400 uppercase text-[10px] tracking-wider font-semibold">
                <th
                  className="py-3 px-4 cursor-pointer select-none hover:text-white transition-colors"
                  onClick={() => onSortChange("storeName")}
                >
                  Store & Location
                  {renderSortIcon("storeName")}
                </th>
                <th
                  className="py-3 px-3 cursor-pointer select-none hover:text-white transition-colors"
                  onClick={() => onSortChange("companyName")}
                >
                  Company
                  {renderSortIcon("companyName")}
                </th>
                <th
                  className="py-3 px-3 text-center cursor-pointer select-none hover:text-white transition-colors"
                  onClick={() => onSortChange("storeAgeDays")}
                >
                  Store Age & Eval
                  {renderSortIcon("storeAgeDays")}
                </th>
                <th
                  className="py-3 px-3 text-right cursor-pointer select-none hover:text-white transition-colors"
                  onClick={() => onSortChange("currentNetSalesDollars")}
                >
                  60D Net Sales
                  {renderSortIcon("currentNetSalesDollars")}
                </th>
                <th className="py-3 px-3 text-center">Sales Growth</th>
                <th
                  className="py-3 px-3 text-center cursor-pointer select-none hover:text-white transition-colors"
                  onClick={() => onSortChange("confirmedReordersCount")}
                >
                  60D Orders
                  {renderSortIcon("confirmedReordersCount")}
                </th>
                <th className="py-3 px-4 text-center">Partnership Compliance</th>
                <th className="py-3 px-3 text-center">HQ Follow-up</th>
                <th className="py-3 px-4 text-left">Recommended Program</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {stores.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-zinc-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Store className="w-8 h-8 text-zinc-600" />
                      <p className="text-sm font-semibold text-zinc-400">
                        No stores found matching your criteria
                      </p>
                      <p className="text-xs text-zinc-500">
                        Try clearing or adjusting search query, follow-up filter, or company selection.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                stores.map((store) => {
                  const comp = store.compliance;
                  const primaryRec = store.recommendedPrograms[0];

                  return (
                    <tr
                      key={store.storeId}
                      onClick={() => onSelectStore(store)}
                      className="hover:bg-zinc-800/40 cursor-pointer transition-colors group"
                    >
                      {/* Store & Location */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 p-1.5 rounded-lg bg-zinc-800/80 border border-zinc-700/60 text-zinc-400 group-hover:text-cyan-400 group-hover:border-cyan-500/40 transition-colors">
                            <Store className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-zinc-200 group-hover:text-white transition-colors">
                                {store.storeName}
                              </span>
                              {store.status === "active" ? (
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" title="Active Store" />
                              ) : (
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-zinc-500" title="Inactive Store" />
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-400 mt-0.5">
                              {[store.city, store.state].filter(Boolean).join(", ") || "Location unassigned"}
                            </div>
                            {store.storeCode && (
                              <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                                #{store.storeCode}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Company */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3 h-3 text-zinc-500 shrink-0" />
                          <span className="text-zinc-300 font-medium truncate max-w-[140px]" title={store.companyName}>
                            {store.companyName}
                          </span>
                        </div>
                      </td>

                      {/* Store Age & Evaluation Status */}
                      <td className="py-3.5 px-3 text-center">
                        <div>
                          <span className="font-semibold text-zinc-200">
                            Day {store.sales.storeAgeDays}
                          </span>
                          <div className="mt-1">
                            {store.evaluationStatus === "new" ? (
                              <span
                                className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                                title="Day 0–59 New Store period. Performance observed; grade benchmarks pending Day 60+."
                              >
                                New (Day 0–59)
                              </span>
                            ) : (
                              <span
                                className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700"
                                title="Day 60+ mature store. Pending Owner grade benchmark approval."
                              >
                                Not Rated
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 60D Net Sales */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="font-bold text-zinc-100 text-sm">
                          {formatCurrency(store.sales.currentNetSalesDollars)}
                        </div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">
                          Prev: {formatCurrency(store.sales.previousNetSalesDollars)}
                        </div>
                      </td>

                      {/* Sales Growth */}
                      <td className="py-3.5 px-3 text-center">
                        {renderGrowthBadge(store.sales.salesGrowthLabel, store.sales.salesGrowthPercent)}
                      </td>

                      {/* 60D Orders */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="font-semibold text-zinc-200">
                          {store.sales.confirmedReordersCount}
                        </div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">
                          {store.sales.currentValidOrdersCount} in 60D
                        </div>
                      </td>

                      {/* Partnership Compliance (3 Pillars) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-2">
                          {/* Display */}
                          <div
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-zinc-950 border border-zinc-800"
                            title={`Display: ${comp.display.status.toUpperCase()} (${comp.display.fixturesCount} fixtures, ${comp.display.placementsCount} placements)`}
                          >
                            <ShieldCheck className="w-2.5 h-2.5 text-zinc-400" />
                            {comp.display.status === "compliant" ? (
                              <span className="text-emerald-400 font-semibold">OK</span>
                            ) : comp.display.status === "violation" ? (
                              <span className="text-rose-400 font-semibold">Issue</span>
                            ) : (
                              <span className="text-zinc-500 font-semibold">—</span>
                            )}
                          </div>

                          {/* Inventory */}
                          <div
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-zinc-950 border border-zinc-800"
                            title={`Weekly Inventory: ${comp.weeklyInventory.status.toUpperCase()} (${comp.weeklyInventory.submittedWeeksCount}/${comp.weeklyInventory.eligibleWeeksCount} weeks)`}
                          >
                            <Package className="w-2.5 h-2.5 text-zinc-400" />
                            {comp.weeklyInventory.status === "compliant" ? (
                              <span className="text-emerald-400 font-semibold">OK</span>
                            ) : comp.weeklyInventory.status === "partial" ? (
                              <span className="text-amber-400 font-semibold">Partial</span>
                            ) : comp.weeklyInventory.status === "non_compliant" ? (
                              <span className="text-rose-400 font-semibold">Missed</span>
                            ) : (
                              <span className="text-zinc-500 font-semibold">—</span>
                            )}
                          </div>

                          {/* Training */}
                          <div
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-zinc-950 border border-zinc-800"
                            title={`Product Training: ${comp.productTraining.status.toUpperCase()} (${comp.productTraining.coveragePercent ?? 0}% covered)`}
                          >
                            <GraduationCap className="w-2.5 h-2.5 text-zinc-400" />
                            {comp.productTraining.status === "compliant" ? (
                              <span className="text-emerald-400 font-semibold">100%</span>
                            ) : comp.productTraining.status === "partial" ? (
                              <span className="text-blue-400 font-semibold">
                                {comp.productTraining.coveragePercent ?? 0}%
                              </span>
                            ) : comp.productTraining.status === "non_compliant" ? (
                              <span className="text-rose-400 font-semibold">0%</span>
                            ) : (
                              <span className="text-zinc-500 font-semibold">—</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* HQ Follow-up */}
                      <td className="py-3.5 px-3 text-center">
                        <div>
                          {renderHqStatusBadge(store.followUp.status)}
                          {store.followUp.lastActivityType && (
                            <div className="text-[10px] text-zinc-400 mt-1 max-w-[130px] truncate mx-auto" title={store.followUp.lastActivityType}>
                              {store.followUp.lastActivityType}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Recommended Program */}
                      <td className="py-3.5 px-4 text-left">
                        {primaryRec ? (
                          renderProgramBadge(primaryRec.programType, primaryRec.title)
                        ) : (
                          <span className="text-zinc-500 text-xs">—</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectStore(store);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white transition-colors border border-zinc-700/60"
                        >
                          Detail <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ==========================================
  // 2. COMPANY VIEW
  // ==========================================
  return (
    <div className="w-full space-y-4">
      {/* Unallocated Orders Alert if present */}
      {unallocatedCompanies.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <h4 className="font-semibold text-amber-300 text-sm">
                Unallocated Company Orders Detected
              </h4>
              <p className="text-zinc-300 mt-1">
                The following completed orders were placed at the company level without an assigned store ID.
                To prevent distortion or accidental double-counting, these orders are quarantined from individual
                store evaluations and accounted for strictly at the company level:
              </p>
              <div className="mt-2.5 space-y-1.5">
                {unallocatedCompanies.map((u) => (
                  <div
                    key={u.companyId}
                    className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-zinc-900/90 border border-amber-500/20"
                  >
                    <span className="font-medium text-white">{u.companyName}</span>
                    <span className="text-amber-300 font-semibold">
                      {formatCurrency(u.unallocatedSalesDollars)} ({u.unallocatedOrdersCount} unallocated orders)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Company Table */}
      <div className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/80 text-zinc-400 uppercase text-[10px] tracking-wider font-semibold">
                <th className="py-3 px-4">Company Name</th>
                <th className="py-3 px-3 text-center">Store Count</th>
                <th className="py-3 px-4 text-right">Allocated Store Sales</th>
                <th className="py-3 px-4 text-right">Unallocated Orders</th>
                <th className="py-3 px-4 text-right">Total Net 60D Sales</th>
                <th className="py-3 px-4 text-center">Follow-up Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {companies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Building2 className="w-8 h-8 text-zinc-600" />
                      <p className="text-sm font-semibold text-zinc-400">No companies found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                companies.map((comp) => {
                  return (
                    <tr
                      key={comp.companyId}
                      onClick={() => onSelectCompany?.(comp)}
                      className="hover:bg-zinc-800/40 transition-colors"
                    >
                      {/* Company Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700/60 text-zinc-300">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-zinc-100 text-sm">
                              {comp.companyName}
                            </div>
                            <div className="text-[10px] text-zinc-500 font-mono">
                              ID: {comp.companyId.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Store Count */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="font-semibold text-zinc-200">
                          {comp.activeStoresCount} / {comp.storesCount}
                        </span>
                        <div className="text-[10px] text-zinc-400 mt-0.5">Active Stores</div>
                      </td>

                      {/* Allocated Store Sales */}
                      <td className="py-3.5 px-4 text-right font-medium text-zinc-300">
                        {formatCurrency(comp.allocatedStoreSalesDollars)}
                      </td>

                      {/* Unallocated Orders */}
                      <td className="py-3.5 px-4 text-right">
                        {comp.unallocatedOrdersCount > 0 ? (
                          <div>
                            <span className="font-semibold text-amber-400">
                              {formatCurrency(comp.unallocatedSalesDollars)}
                            </span>
                            <div className="text-[10px] text-amber-500/80">
                              {comp.unallocatedOrdersCount} unallocated
                            </div>
                          </div>
                        ) : (
                          <span className="text-zinc-500 text-xs">$0.00</span>
                        )}
                      </td>

                      {/* Total Net 60D Sales */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-bold text-zinc-100 text-sm">
                          {formatCurrency(comp.totalNetSalesDollars)}
                        </div>
                      </td>

                      {/* Follow-up Flags */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {comp.actionRequiredStoresCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              {comp.actionRequiredStoresCount} Action
                            </span>
                          )}
                          {comp.supportRequiredStoresCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              {comp.supportRequiredStoresCount} Support
                            </span>
                          )}
                          {comp.actionRequiredStoresCount === 0 && comp.supportRequiredStoresCount === 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              On Track
                            </span>
                          )}
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
  );
}
