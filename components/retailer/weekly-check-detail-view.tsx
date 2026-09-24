"use client";

import React from "react";
import Link from "next/link";
import { WeeklyCheckSession } from "@/lib/retailer/weekly-check";

interface WeeklyCheckDetailViewProps {
  session: WeeklyCheckSession;
}

export function RetailerWeeklyCheckDetailView({ session }: WeeklyCheckDetailViewProps) {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/check"
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              ← Back to Weekly Checks
            </Link>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <span className="text-xs font-bold text-zinc-900 dark:text-white">{session.storeName}</span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white tracking-tight">
              Weekly Product Check Summary
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              {session.status === "submitted" ? "Submitted ✓" : "Draft"}
            </span>
          </div>
        </div>

        <div className="text-xs text-zinc-500 dark:text-zinc-400 text-right">
          <div>Week: <strong className="text-zinc-900 dark:text-white">{session.reportingWeek}</strong></div>
          <div>Date: {session.submittedAt ? new Date(session.submittedAt).toLocaleString() : session.reportDate}</div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total Catalog</div>
          <div className="text-xl font-bold text-zinc-900 dark:text-white mt-0.5">{session.totalProductsCount} SKUs</div>
        </div>

        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Products Counted</div>
          <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">{session.totalCountedProducts} SKUs</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total Remaining Units</div>
          <div className="text-xl font-bold text-zinc-900 dark:text-white mt-0.5">{session.totalRemainingUnits} units</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Store Destination</div>
          <div className="text-sm font-bold text-zinc-900 dark:text-white mt-1 truncate">{session.storeName}</div>
        </div>
      </div>

      {/* Notes if any */}
      {session.notes && (
        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-300 space-y-1">
          <div className="font-bold text-zinc-900 dark:text-white">Store Audit Notes:</div>
          <p>{session.notes}</p>
        </div>
      )}

      {/* Line Items Table */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-semibold">
              <tr>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4 text-right">Previous Count</th>
                <th className="py-3 px-4 text-right">Reported Remaining</th>
                <th className="py-3 px-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {session.items.map((it) => (
                <tr key={it.productId} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                  <td className="py-3.5 px-4 font-semibold text-zinc-900 dark:text-white">
                    <div className="flex items-center gap-3">
                      {it.thumbnailUrl && (
                        <img
                          src={it.thumbnailUrl}
                          alt={it.productName}
                          className="w-8 h-8 rounded-lg object-contain bg-zinc-100 dark:bg-zinc-800 p-0.5 shrink-0"
                        />
                      )}
                      <div>
                        <div>{it.productName}</div>
                        <div className="text-[10px] text-zinc-400 font-normal">{it.brandName}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-zinc-400">{it.sku}</td>
                  <td className="py-3.5 px-4 text-right text-zinc-500">
                    {it.previousReportedQty !== null ? `${it.previousReportedQty} units` : "-"}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-zinc-900 dark:text-white">
                    {it.reportedRemainingQty} units
                  </td>
                  <td className="py-3.5 px-4 text-zinc-500">{it.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
