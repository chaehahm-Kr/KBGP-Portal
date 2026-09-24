import React from "react";
import Link from "next/link";
import { verifyRetailerSession } from "@/lib/auth/dal";

export const dynamic = "force-dynamic";

export default async function RetailerSalesPage() {
  await verifyRetailerSession();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
            Sales & Reorder Analytics
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Store velocity suggestions, estimated stock runout, and automated reorder alerts.
          </p>
        </div>
      </div>

      {/* Placeholder State */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-8 sm:p-12 text-center space-y-4 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 mx-auto flex items-center justify-center text-2xl font-bold">
          📊
        </div>
        <div className="max-w-md mx-auto space-y-1.5">
          <h2 className="text-base font-bold text-zinc-900 dark:text-white">
            Sales Velocity & Restock Intelligence
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Reorder calculations, 90-day return protection tracking, and store sales estimation will be available in upcoming feature rollout.
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
