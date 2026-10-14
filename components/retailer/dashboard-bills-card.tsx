import React from "react";
import Link from "next/link";
import { RetailerARStatus } from "@/lib/finance/invoice-types";

interface DashboardBillsCardProps {
  summary: RetailerARStatus;
}

export function DashboardBillsCard({ summary }: DashboardBillsCardProps) {
  const hasPastDue = (summary?.pastDueAmount || 0) > 0;
  const hasDueSoon = (summary?.dueSoonAmount || 0) > 0;
  const isAllCaughtUp = (summary?.openAR || 0) <= 0;

  return (
    <div
      className={`rounded-2xl border p-5 sm:p-6 shadow-xs space-y-4 transition-all ${
        hasPastDue
          ? "border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/15"
          : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
            💳
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white">
              Bills & Payments
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Outstanding wholesale invoices and terms balance
            </p>
          </div>
        </div>

        <Link
          href="/bills"
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        >
          <span>View Bills</span>
          <span>→</span>
        </Link>
      </div>

      {isAllCaughtUp ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/50">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <div>
              <p className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                You're all caught up
              </p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                No outstanding bills or payments due at this time.
              </p>
            </div>
          </div>
          {(summary?.creditLimit || 0) > 0 && (
            <div className="sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-emerald-200/40">
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold block">
                Available Credit
              </span>
              <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                ${Number(summary?.availableCredit || 0).toFixed(2)}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {hasPastDue && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-100/70 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 text-xs font-semibold">
              <span>⚠️</span>
              <span>
                You have {summary?.pastDueInvoiceCount || 0} overdue bill
                {summary?.pastDueInvoiceCount === 1 ? "" : "s"} totaling $
                {Number(summary?.pastDueAmount || 0).toFixed(2)}. Immediate settlement recommended.
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {/* Total Due */}
            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800/60">
              <span className="text-[10px] uppercase font-bold text-zinc-400">Total Due</span>
              <div className="text-lg font-bold text-zinc-900 dark:text-white mt-0.5">
                ${Number(summary?.openAR || 0).toFixed(2)}
              </div>
            </div>

            {/* Past Due */}
            <div
              className={`p-3 rounded-xl border ${
                hasPastDue
                  ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60"
                  : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-800/60"
              }`}
            >
              <span
                className={`text-[10px] uppercase font-bold ${
                  hasPastDue ? "text-rose-700 dark:text-rose-400" : "text-zinc-400"
                }`}
              >
                Past Due
              </span>
              <div
                className={`text-lg font-bold mt-0.5 ${
                  hasPastDue
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-zinc-900 dark:text-white"
                }`}
              >
                ${Number(summary?.pastDueAmount || 0).toFixed(2)}
              </div>
            </div>

            {/* Due Soon */}
            <div
              className={`p-3 rounded-xl border ${
                hasDueSoon
                  ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60"
                  : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-800/60"
              }`}
            >
              <span
                className={`text-[10px] uppercase font-bold ${
                  hasDueSoon ? "text-amber-700 dark:text-amber-400" : "text-zinc-400"
                }`}
              >
                Due Soon
              </span>
              <div
                className={`text-lg font-bold mt-0.5 ${
                  hasDueSoon
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-zinc-900 dark:text-white"
                }`}
              >
                ${Number(summary?.dueSoonAmount || 0).toFixed(2)}
              </div>
            </div>

            {/* Available Credit */}
            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800/60">
              <span className="text-[10px] uppercase font-bold text-zinc-400">Available Credit</span>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                ${Number(summary?.availableCredit || 0).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
