"use client";

import React, { useState } from "react";
import Link from "next/link";

interface RetailerRow {
  id: string;
  name: string;
  businessRegistrationNumber?: string;
  country: string;
  status: string;
  paymentTerms: string;
  creditLimit: number;
  storesCount: number;
  stores: Array<{ id: string; name: string; city?: string }>;
  usersCount: number;
  pendingInvitesCount: number;
  internalNote?: string;
  createdAt: string;
}

interface RetailersListProps {
  initialRetailers: RetailerRow[];
}

export function RetailersList({ initialRetailers }: RetailersListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = initialRetailers.filter((ret) => {
    const matchesSearch =
      ret.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ret.businessRegistrationNumber &&
        ret.businessRegistrationNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      ret.stores.some((s) => s.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus =
      statusFilter === "all" ? true : ret.status.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4 w-full">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xs">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative w-full">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search by name, tax ID, or store..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs cursor-pointer"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 shrink-0">
              Status:
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white font-medium cursor-pointer"
            >
              <option value="all">All Statuses ({initialRetailers.length})</option>
              <option value="active">Active</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="suspended">Suspended</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <Link
            href="/admin/retailers/new"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-900 text-xs font-bold transition-all shrink-0 shadow-2xs"
          >
            <span>➕</span>
            <span>Onboard Retailer</span>
          </Link>
        </div>
      </div>

      {/* Result Count Indicator */}
      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 px-1">
        <span>
          Showing <strong className="text-zinc-900 dark:text-white font-semibold">{filtered.length}</strong> of {initialRetailers.length} retailer organizations
        </span>
        {(searchTerm || statusFilter !== "all") && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm("");
              setStatusFilter("all");
            }}
            className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Retailer Table */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/60 font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Retailer Company</th>
                <th className="py-3 px-4">Stores</th>
                <th className="py-3 px-4">Commercial Terms</th>
                <th className="py-3 px-4">Team & Users</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-zinc-400 dark:text-zinc-500 text-xs">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                        No retailer companies match your search.
                      </p>
                      <p className="text-zinc-400 text-xs">
                        Try adjusting your search query or status filter.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((ret) => {
                  const statusClass =
                    ret.status === "active"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                      : ret.status === "pending_approval"
                      ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                      : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700";

                  return (
                    <tr
                      key={ret.id}
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors group"
                    >
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <Link
                            href={`/admin/retailers/${ret.id}`}
                            className="font-bold text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 text-xs transition-colors"
                          >
                            {ret.name}
                          </Link>
                          {ret.businessRegistrationNumber ? (
                            <p className="text-[11px] text-zinc-400 font-mono">
                              Tax ID: {ret.businessRegistrationNumber}
                            </p>
                          ) : (
                            <p className="text-[11px] text-zinc-400 italic">No Tax ID</p>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-zinc-900 dark:text-zinc-100">
                              {ret.storesCount}
                            </span>
                            <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                              {ret.storesCount === 1 ? "store" : "stores"}
                            </span>
                          </div>
                          {ret.stores.length > 0 && (
                            <p
                              className="text-[10px] text-zinc-400 truncate max-w-[220px]"
                              title={ret.stores.map((s) => s.name).join(", ")}
                            >
                              {ret.stores.map((s) => s.name).slice(0, 2).join(", ")}
                              {ret.stores.length > 2 ? ` +${ret.stores.length - 2} more` : ""}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <span className="inline-block px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono font-bold text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-700 text-[11px]">
                            {ret.paymentTerms}
                          </span>
                          {ret.creditLimit > 0 && (
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                              Limit:{" "}
                              <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                                ${ret.creditLimit.toLocaleString()}
                              </span>
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-zinc-800 dark:text-zinc-200 text-xs">
                            {ret.usersCount} Active
                          </span>
                          {ret.pendingInvitesCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                              {ret.pendingInvitesCount} Pending
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-[10px] font-bold border capitalize ${statusClass}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                          {ret.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/admin/retailers/${ret.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-[11px] font-bold text-zinc-700 dark:text-zinc-200 transition-colors shadow-2xs"
                        >
                          Manage <span>→</span>
                        </Link>
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
