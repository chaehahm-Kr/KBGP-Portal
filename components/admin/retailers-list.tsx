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
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-2 w-full sm:w-80">
          <input
            type="text"
            placeholder="Search by name, tax ID, or store..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="suspended">Suspended</option>
            <option value="inactive">Inactive</option>
          </select>

          <Link
            href="/admin/retailers/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-900 text-xs font-bold transition-all shrink-0"
          >
            <span>➕</span>
            <span>Onboard Retailer</span>
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 font-semibold text-zinc-600 dark:text-zinc-400">
                <th className="py-3 px-4">Retailer Company</th>
                <th className="py-3 px-4">Stores</th>
                <th className="py-3 px-4">Commercial Terms</th>
                <th className="py-3 px-4">Team & Users</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-400 text-xs">
                    No retailer companies match your search.
                  </td>
                </tr>
              ) : (
                filtered.map((ret) => {
                  const statusClass =
                    ret.status === "active"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                      : ret.status === "pending_approval"
                      ? "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                      : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700";

                  return (
                    <tr key={ret.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div>
                          <Link
                            href={`/admin/retailers/${ret.id}`}
                            className="font-bold text-zinc-900 dark:text-white hover:underline text-xs"
                          >
                            {ret.name}
                          </Link>
                          {ret.businessRegistrationNumber && (
                            <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                              Tax ID: {ret.businessRegistrationNumber}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-200">
                            {ret.storesCount} {ret.storesCount === 1 ? "Store" : "Stores"}
                          </span>
                          {ret.stores.length > 0 && (
                            <span className="text-[10px] text-zinc-400">
                              ({ret.stores.map((s) => s.name).slice(0, 2).join(", ")}
                              {ret.stores.length > 2 ? "..." : ""})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5 text-[11px]">
                          <span className="inline-block px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                            {ret.paymentTerms}
                          </span>
                          {ret.creditLimit > 0 && (
                            <span className="text-zinc-500 dark:text-zinc-400 ml-2 font-medium">
                              Limit: ${ret.creditLimit.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                            {ret.usersCount} Active
                          </span>
                          {ret.pendingInvitesCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                              {ret.pendingInvitesCount} Invite Pending
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold border capitalize ${statusClass}`}
                        >
                          {ret.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/admin/retailers/${ret.id}`}
                          className="px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] font-semibold text-zinc-700 dark:text-zinc-200 transition-colors"
                        >
                          Manage →
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
