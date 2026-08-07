import React from "react";
import Link from "next/link";

export default function RetailerDashboardPage() {
  return (
    <div className="space-y-6">
      {/* 타이틀 및 소개 */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Welcome to K-SELECT HUB</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Explore premium verified K-Beauty brands and manage your retail orders in one place.
        </p>
      </div>

      {/* 미니 통계 대시보드 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Active Sourcing Brands</p>
          <p className="text-3xl font-bold text-zinc-900 dark:text-white mt-2">12</p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Verified Partners</p>
        </div>
        <div className="p-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Total Orders Submitted</p>
          <p className="text-3xl font-bold text-zinc-900 dark:text-white mt-2">0</p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Pending Invoice Check</p>
        </div>
        <div className="p-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Sourced Products Qty</p>
          <p className="text-3xl font-bold text-zinc-900 dark:text-white mt-2">0</p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">SKU counts Sourced</p>
        </div>
      </div>

      {/* 빠른 행동 유도 배너 */}
      <div className="p-8 bg-zinc-900 text-white dark:bg-white dark:text-black rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h2 className="text-lg font-bold">Ready to import premium products?</h2>
          <p className="text-sm text-zinc-400 dark:text-zinc-650 mt-1">
            Browse our curated K-Beauty catalog and customize your purchase orders today.
          </p>
        </div>
        <Link
          href="/retailer/products"
          className="px-5 py-2.5 rounded-md bg-white text-black dark:bg-zinc-950 dark:text-white text-sm font-bold shadow hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors whitespace-nowrap"
        >
          Browse Products ➡️
        </Link>
      </div>

      {/* 최근 계약 공지 */}
      <div className="p-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-4">Latest System Updates</h3>
        <div className="space-y-4">
          <div className="flex gap-4 items-start text-sm">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 whitespace-nowrap">Notice</span>
            <div>
              <p className="font-semibold text-zinc-900 dark:text-white">U.S. Customs clearance compliance update</p>
              <p className="text-xs text-zinc-400 mt-1">August 7, 2026</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
