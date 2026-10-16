"use client";

import React, { useState, useMemo } from "react";
import type { ProtectedSupplyCohort, ProtectedCohortStatus } from "@/lib/retailer/exchange-credit-types";
import { COHORT_STATUS_CONFIG } from "@/lib/retailer/exchange-credit-types";

interface CohortTableProps {
  cohorts: ProtectedSupplyCohort[];
  onSelectCohort?: (cohort: ProtectedSupplyCohort) => void;
  onOpenRegisterModal?: () => void;
  isSchemaAvailable: boolean;
}

export function CohortTable({
  cohorts,
  onSelectCohort,
  onOpenRegisterModal,
  isSchemaAvailable,
}: CohortTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");

  const uniqueCompanies = useMemo(() => {
    const map = new Map<string, string>();
    cohorts.forEach((c) => {
      if (c.companyId && c.companyName) {
        map.set(c.companyId, c.companyName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [cohorts]);

  const filteredCohorts = useMemo(() => {
    return cohorts.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (companyFilter !== "all" && c.companyId !== companyFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesCode = c.cohortCode.toLowerCase().includes(q);
        const matchesProduct = c.productName.toLowerCase().includes(q) || c.productSku.toLowerCase().includes(q);
        const matchesStore = c.storeName.toLowerCase().includes(q);
        const matchesCompany = c.companyName.toLowerCase().includes(q);
        const matchesOrder = c.sourceOrderNumber.toLowerCase().includes(q);
        if (!matchesCode && !matchesProduct && !matchesStore && !matchesCompany && !matchesOrder) {
          return false;
        }
      }
      return true;
    });
  }, [cohorts, statusFilter, companyFilter, searchTerm]);

  return (
    <div className="space-y-4">
      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[220px]">
            <span className="absolute left-3 top-2.5 text-zinc-500 text-xs">🔍</span>
            <input
              type="text"
              placeholder="Search cohort, SKU, store..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-300 focus:outline-none focus:border-cyan-500/50"
          >
            <option value="all">All Protection Statuses</option>
            {Object.entries(COHORT_STATUS_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>
                {config.label}
              </option>
            ))}
          </select>

          {uniqueCompanies.length > 0 && (
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="text-xs bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-300 focus:outline-none focus:border-cyan-500/50"
            >
              <option value="all">All Retailers</option>
              {uniqueCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {onOpenRegisterModal && isSchemaAvailable && (
          <button
            type="button"
            onClick={onOpenRegisterModal}
            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors shrink-0"
          >
            <span>+</span>
            <span>Register Cohort</span>
          </button>
        )}
      </div>

      {/* Cohorts Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400 font-semibold uppercase text-[11px] tracking-wider">
                <th className="py-3 px-4">Cohort Code</th>
                <th className="py-3 px-4">Store & Company</th>
                <th className="py-3 px-4">Protected SKU</th>
                <th className="py-3 px-4 text-center">Protected Qty</th>
                <th className="py-3 px-4 text-right">Wholesale Cost</th>
                <th className="py-3 px-4 text-center">Rate</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Timeline / Day 100</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredCohorts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-zinc-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="text-3xl">📦</span>
                      <p className="text-sm font-semibold text-zinc-400">No protected cohorts found</p>
                      <p className="text-xs text-zinc-500">
                        {isSchemaAvailable
                          ? "Register initial orders to begin 90-Day Exchange Credit tracking."
                          : "Database tables will be available once Owner executes Migration 0175."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCohorts.map((cohort) => {
                  const statusConf = COHORT_STATUS_CONFIG[cohort.status as ProtectedCohortStatus] || {
                    label: cohort.status,
                    bg: "bg-zinc-800",
                    text: "text-zinc-400",
                    border: "border-zinc-700",
                  };

                  return (
                    <tr
                      key={cohort.id}
                      className="hover:bg-zinc-800/30 transition-colors cursor-pointer group"
                      onClick={() => onSelectCohort && onSelectCohort(cohort)}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-cyan-400">
                        {cohort.cohortCode}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-zinc-200">{cohort.storeName}</div>
                        <div className="text-[11px] text-zinc-500">{cohort.companyName}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-zinc-200 max-w-[200px] truncate" title={cohort.productName}>
                          {cohort.productName}
                        </div>
                        <div className="text-[11px] font-mono text-zinc-500">SKU: {cohort.productSku}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-semibold text-zinc-100">
                          {cohort.fulfilledProtectedQuantity} / {cohort.totalProtectedQuantity}
                        </span>
                        <div className="text-[10px] text-zinc-500">units</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-300">
                        ${cohort.frozenUnitWholesalePrice.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-emerald-400">
                        {(cohort.frozenOptionARate * 100).toFixed(0)}%
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusConf.bg} ${statusConf.text} ${statusConf.border}`}
                        >
                          {statusConf.label}
                        </span>
                        {cohort.disqualificationReason && (
                          <div className="text-[9px] text-rose-400 mt-0.5 max-w-[140px] truncate" title={cohort.disqualificationReason}>
                            ⚠️ {cohort.disqualificationReason}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {cohort.evaluationDate ? (
                          <div>
                            <div className="text-[11px] font-semibold text-zinc-300">
                              Eval: {cohort.evaluationDate}
                            </div>
                            <div className="text-[10px] text-zinc-500">
                              Start: {cohort.protectionStartDate || "N/A"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-zinc-600 text-[11px]">Awaiting 1st Delivery</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCohort && onSelectCohort(cohort);
                          }}
                          className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
                        >
                          View ↗
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
    </div>
  );
}
