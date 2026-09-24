"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WeeklyCheckHistorySummary } from "@/lib/retailer/weekly-check";

interface WeeklyCheckDashboardProps {
  stores: Array<{ id: string; name: string; address?: string; city?: string; state?: string }>;
  currentWeek: string;
  activeCheck: {
    id: string;
    storeId: string;
    status: "draft" | "submitted";
    totalProductsCount: number;
    totalCountedProducts: number;
    totalRemainingUnits: number;
    submittedAt?: string | null;
  } | null;
  history: WeeklyCheckHistorySummary[];
  selectedStoreId: string;
}

export function RetailerWeeklyCheckDashboard({
  stores,
  currentWeek,
  activeCheck,
  history,
  selectedStoreId,
}: WeeklyCheckDashboardProps) {
  const router = useRouter();
  const [storeId, setStoreId] = useState(selectedStoreId || (stores.length > 0 ? stores[0].id : ""));
  const [isStarting, setIsStarting] = useState(false);

  const handleStoreChange = (newStoreId: string) => {
    setStoreId(newStoreId);
    router.push(`/check?storeId=${newStoreId}`);
  };

  const isCompleted = activeCheck?.status === "submitted";
  const isDraft = activeCheck?.status === "draft";
  const progressPercent = activeCheck && activeCheck.totalProductsCount > 0
    ? Math.round((activeCheck.totalCountedProducts / activeCheck.totalProductsCount) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              Weekly Product Check
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              {currentWeek}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Store periodic stock count for K SELECT products to calculate estimated movement and reorders.
          </p>
        </div>

        {/* Store Selector (if multi-store) */}
        {stores.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 font-medium">Store:</span>
            <select
              value={storeId}
              onChange={(e) => handleStoreChange(e.target.value)}
              className="text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main Status & Action Card */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📋</span>
              <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white">
                {isCompleted
                  ? "This Week's Check is Completed"
                  : isDraft
                  ? "Weekly Check in Progress"
                  : "Weekly Product Check Due"}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {isCompleted
                ? `You have already submitted the product count for ${currentWeek}. Results have been locked and recorded.`
                : isDraft
                ? `You have counted ${activeCheck?.totalCountedProducts || 0} of ${activeCheck?.totalProductsCount || 0} products. You can resume at any time.`
                : "Count the approximate remaining quantity on the shelf for each product to update weekly movement."}
            </p>
          </div>

          {/* Action Button */}
          <div>
            {isCompleted ? (
              <Link
                href={`/check/${activeCheck?.id}`}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:opacity-95 shadow-sm transition-all"
              >
                <span>View Submitted Check →</span>
              </Link>
            ) : (
              <Link
                href={`/check/${activeCheck?.id || "start"}?storeId=${storeId}`}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all cursor-pointer"
              >
                <span>{isDraft ? "Resume Weekly Check →" : "Start Weekly Check →"}</span>
              </Link>
            )}
          </div>
        </div>

        {/* Progress Bar for Draft */}
        {isDraft && (
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-zinc-600 dark:text-zinc-300">
                Count Progress ({activeCheck?.totalCountedProducts} / {activeCheck?.totalProductsCount} items)
              </span>
              <span className="text-indigo-600 dark:text-indigo-400 font-bold">{progressPercent}%</span>
            </div>
            <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Submission History Section */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
            Submission History
          </h3>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {history.length} {history.length === 1 ? "report" : "reports"}
          </span>
        </div>

        {history.length > 0 ? (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Reporting Week</th>
                    <th className="py-3 px-4">Store</th>
                    <th className="py-3 px-4">Products Counted</th>
                    <th className="py-3 px-4">Total Units</th>
                    <th className="py-3 px-4">Submitted Date</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
                  {history.map((h) => (
                    <tr key={h.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-zinc-900 dark:text-white font-mono">
                        {h.reportingWeek}
                      </td>
                      <td className="py-3.5 px-4 font-medium">{h.storeName}</td>
                      <td className="py-3.5 px-4">
                        {h.totalCountedProducts} / {h.totalProductsCount} SKUs
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-zinc-900 dark:text-white">
                        {h.totalRemainingUnits} units
                      </td>
                      <td className="py-3.5 px-4 text-zinc-500 dark:text-zinc-400">
                        {h.submittedAt ? new Date(h.submittedAt).toLocaleDateString() : h.reportDate}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/check/${h.id}`}
                          className="inline-flex items-center text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          View Report →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
            No historical weekly checks submitted yet.
          </div>
        )}
      </div>
    </div>
  );
}
