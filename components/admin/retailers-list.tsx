"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { AdminRetailerListItem } from "@/lib/retailer/admin-retailer-actions";

interface RetailersListProps {
  initialRetailers: AdminRetailerListItem[];
}

export function RetailersList({ initialRetailers }: RetailersListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [termsFilter, setTermsFilter] = useState("all");
  const [operationalFilter, setOperationalFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"name_asc" | "name_desc" | "stores_desc" | "orders_desc" | "ar_desc">("name_asc");

  // Filtering & Sorting
  const filtered = useMemo(() => {
    return initialRetailers
      .filter((ret) => {
        // Search across Company Name, Company Code, Tax ID, Store Names, Contact Name
        const q = searchTerm.trim().toLowerCase();
        if (q) {
          const nameMatch = ret.name.toLowerCase().includes(q);
          const codeMatch = ret.companyCode ? ret.companyCode.toLowerCase().includes(q) : false;
          const taxMatch = ret.businessRegistrationNumber ? ret.businessRegistrationNumber.toLowerCase().includes(q) : false;
          const storeMatch = ret.stores.some((s) => s.name.toLowerCase().includes(q));
          const contactMatch = ret.contactName ? ret.contactName.toLowerCase().includes(q) : false;

          if (!nameMatch && !codeMatch && !taxMatch && !storeMatch && !contactMatch) {
            return false;
          }
        }

        // Status Filter
        if (statusFilter !== "all" && ret.status.toLowerCase() !== statusFilter.toLowerCase()) {
          return false;
        }

        // Terms Filter
        if (termsFilter === "net" && ret.approvedTerms === "prepaid") {
          return false;
        }
        if (termsFilter === "prepaid" && ret.approvedTerms !== "prepaid") {
          return false;
        }

        // Operational Filter
        if (operationalFilter === "has_orders" && ret.openOrdersCount <= 0) {
          return false;
        }
        if (operationalFilter === "ready_to_ship" && ret.readyToShipCount <= 0) {
          return false;
        }
        if (operationalFilter === "has_ar" && ret.openAR <= 0) {
          return false;
        }
        if (operationalFilter === "past_due" && !ret.hasPastDue) {
          return false;
        }
        if (operationalFilter === "missing_check") {
          const isMissing = ret.eligibleStoresCount > 0 && ret.reportingStoresCount < ret.eligibleStoresCount;
          if (!isMissing) return false;
        }
        if (operationalFilter === "has_issues" && ret.attentionCount <= 0) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "name_desc":
            return b.name.localeCompare(a.name);
          case "stores_desc":
            return b.storesCount - a.storesCount;
          case "orders_desc":
            return b.openOrdersCount - a.openOrdersCount;
          case "ar_desc":
            return b.openAR - a.openAR;
          case "name_asc":
          default:
            return a.name.localeCompare(b.name);
        }
      });
  }, [initialRetailers, searchTerm, statusFilter, termsFilter, operationalFilter, sortBy]);

  const hasActiveFilters = searchTerm !== "" || statusFilter !== "all" || termsFilter !== "all" || operationalFilter !== "all" || sortBy !== "name_asc";

  const handleResetFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setTermsFilter("all");
    setOperationalFilter("all");
    setSortBy("name_asc");
  };

  return (
    <div className="space-y-4 w-full">
      {/* Search & Filter Toolbar */}
      <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1 max-w-lg">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search by company name, code, tax ID, store, or contact..."
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

          {/* Dropdown Filters & Sort */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 shrink-0">
                Status:
              </span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white font-medium cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="suspended">Suspended</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Terms Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 shrink-0">
                Terms:
              </span>
              <select
                value={termsFilter}
                onChange={(e) => setTermsFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white font-medium cursor-pointer"
              >
                <option value="all">All Terms</option>
                <option value="net">Net Terms</option>
                <option value="prepaid">Prepaid</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 shrink-0">
                Sort:
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white font-medium cursor-pointer"
              >
                <option value="name_asc">Company (A-Z)</option>
                <option value="name_desc">Company (Z-A)</option>
                <option value="stores_desc">Stores (High-Low)</option>
                <option value="orders_desc">Open Orders (High-Low)</option>
                <option value="ar_desc">Open AR (High-Low)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Operational Filter Chips */}
        <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mr-1">
            Quick Filters:
          </span>

          <button
            type="button"
            onClick={() => setOperationalFilter("all")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
              operationalFilter === "all"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            All Organizations ({initialRetailers.length})
          </button>

          <button
            type="button"
            onClick={() => setOperationalFilter(operationalFilter === "has_orders" ? "all" : "has_orders")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
              operationalFilter === "has_orders"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            📦 Open Orders
          </button>

          <button
            type="button"
            onClick={() => setOperationalFilter(operationalFilter === "ready_to_ship" ? "all" : "ready_to_ship")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
              operationalFilter === "ready_to_ship"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            🚚 Ready to Ship
          </button>

          <button
            type="button"
            onClick={() => setOperationalFilter(operationalFilter === "has_ar" ? "all" : "has_ar")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
              operationalFilter === "has_ar"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            💳 Open AR
          </button>

          <button
            type="button"
            onClick={() => setOperationalFilter(operationalFilter === "past_due" ? "all" : "past_due")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
              operationalFilter === "past_due"
                ? "bg-rose-600 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            ⚠️ Past Due
          </button>

          <button
            type="button"
            onClick={() => setOperationalFilter(operationalFilter === "missing_check" ? "all" : "missing_check")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
              operationalFilter === "missing_check"
                ? "bg-amber-600 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            📋 Weekly Check Gap
          </button>

          <button
            type="button"
            onClick={() => setOperationalFilter(operationalFilter === "has_issues" ? "all" : "has_issues")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
              operationalFilter === "has_issues"
                ? "bg-amber-600 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            ⚡ Attention Needed
          </button>
        </div>
      </div>

      {/* Result Count Indicator */}
      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 px-1">
        <span>
          Showing <strong className="text-zinc-900 dark:text-white font-semibold">{filtered.length}</strong> of {initialRetailers.length} retailer organizations
        </span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Retailer Table: Seven Approved Grouped Columns */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/60 font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4 min-w-[200px]">Retailer</th>
                <th className="py-3 px-4 min-w-[130px]">Network</th>
                <th className="py-3 px-4 min-w-[140px]">Commercial</th>
                <th className="py-3 px-4 min-w-[160px]">Orders & AR</th>
                <th className="py-3 px-4 min-w-[150px]">Products & Training</th>
                <th className="py-3 px-4 min-w-[150px]">Operations</th>
                <th className="py-3 px-4 text-right min-w-[100px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-zinc-400 dark:text-zinc-500 text-xs">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                        No retailer companies match your search or filter criteria.
                      </p>
                      <p className="text-zinc-400 text-xs">
                        Try resetting filters or adjusting search queries.
                      </p>
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="mt-2 inline-flex items-center text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        Reset All Filters
                      </button>
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

                  const isNetTerms = ret.approvedTerms !== "prepaid";
                  const formattedTermsName = isNetTerms ? ret.approvedTerms.toUpperCase().replace("NET", "Net ") : "Prepaid";

                  return (
                    <tr
                      key={ret.id}
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors group"
                    >
                      {/* COLUMN 1: RETAILER */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              href={`/admin/retailers/${ret.id}`}
                              className="font-bold text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 text-xs transition-colors"
                            >
                              {ret.name}
                            </Link>
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.2 text-[9px] font-bold border capitalize ${statusClass}`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                              {ret.status.replace(/_/g, " ")}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono">
                            {ret.companyCode && (
                              <span className="font-semibold text-zinc-500 dark:text-zinc-400">
                                {ret.companyCode}
                              </span>
                            )}
                            {ret.companyCode && ret.businessRegistrationNumber && <span>·</span>}
                            {ret.businessRegistrationNumber ? (
                              <span>Tax ID: {ret.businessRegistrationNumber}</span>
                            ) : (
                              <span className="italic">No Tax ID</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* COLUMN 2: NETWORK */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <Link
                            href={`/admin/retailers/${ret.id}?tab=stores`}
                            className="font-bold text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors inline-block"
                            title="View Retailer Store Locations"
                          >
                            {ret.storesCount} {ret.storesCount === 1 ? "Store" : "Stores"}
                          </Link>
                          <div className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                            <Link
                              href={`/admin/retailers/${ret.id}?tab=users`}
                              className="hover:underline"
                              title="View Team Members"
                            >
                              {ret.usersCount} Active Users
                            </Link>
                            {ret.pendingInvitesCount > 0 && (
                              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                · {ret.pendingInvitesCount} Pending
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* COLUMN 3: COMMERCIAL */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <Link
                            href={`/admin/retailers/${ret.id}?tab=payments`}
                            className="inline-block"
                            title="View Commercial Terms & Billing Profile"
                          >
                            <span className="inline-block px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono font-bold text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-700 text-[10px]">
                              {formattedTermsName}
                            </span>
                          </Link>
                          {ret.creditLimit > 0 ? (
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                              Limit:{" "}
                              <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                                ${ret.creditLimit.toLocaleString()}
                              </span>
                            </p>
                          ) : (
                            <p className="text-[10px] text-zinc-400">Prepaid (Card / ACH)</p>
                          )}
                        </div>
                      </td>

                      {/* COLUMN 4: ORDERS & AR */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <Link
                            href={`/admin/retailers/${ret.id}?tab=orders`}
                            className="text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium inline-block text-[11px]"
                            title="View Orders & Fulfillment"
                          >
                            <span className="font-bold">Open: {ret.openOrdersCount}</span>
                            <span className="text-zinc-400"> · </span>
                            <span className={ret.readyToShipCount > 0 ? "font-bold text-blue-600 dark:text-blue-400" : "text-zinc-500"}>
                              Ready: {ret.readyToShipCount}
                            </span>
                          </Link>
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/admin/retailers/${ret.id}?tab=payments`}
                              className="font-mono text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 hover:underline"
                              title="View Invoices & Receivables"
                            >
                              AR: ${ret.openAR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Link>
                            {ret.hasPastDue && (
                              <span className="rounded bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 px-1 py-0.2 text-[9px] font-bold border border-rose-200 dark:border-rose-800">
                                Past Due
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* COLUMN 5: PRODUCTS & TRAINING */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <Link
                            href={`/admin/retailers/${ret.id}?tab=stores`}
                            className="font-bold text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 inline-block text-[11px]"
                            title="Assortment SKUs assigned across stores"
                          >
                            {ret.distinctAssortment > 0 ? `${ret.distinctAssortment} Products` : "0 Products"}
                          </Link>
                          <Link
                            href={`/admin/retailers/${ret.id}?tab=training`}
                            className="block text-[10px] text-zinc-400 dark:text-zinc-500 hover:underline"
                            title="Product Training Coverage Status"
                          >
                            {ret.trainingStatusText}
                          </Link>
                        </div>
                      </td>

                      {/* COLUMN 6: OPERATIONS */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <Link
                            href={`/admin/retailers/${ret.id}?tab=performance`}
                            className="text-[11px] text-zinc-800 dark:text-zinc-200 hover:underline block"
                            title="Weekly Inventory Check Submission Status"
                          >
                            {ret.eligibleStoresCount > 0 ? (
                              <span>
                                Weekly Check:{" "}
                                <strong className={ret.reportingStoresCount === 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}>
                                  {ret.reportingStoresCount}/{ret.eligibleStoresCount} Stores
                                </strong>
                              </span>
                            ) : (
                              <span className="text-zinc-400">Weekly Check: —</span>
                            )}
                          </Link>
                          <Link
                            href={`/admin/retailers/${ret.id}?tab=overview`}
                            className="inline-block"
                            title="Operational Action Center"
                          >
                            {ret.attentionCount > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.2 text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                <span>⚠️</span> Attention: {ret.attentionCount}
                              </span>
                            ) : (
                              <span className="text-[10px] text-zinc-400">
                                0 Issues
                              </span>
                            )}
                          </Link>
                        </div>
                      </td>

                      {/* COLUMN 7: ACTIONS */}
                      <td className="py-3 px-4 text-right">
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
