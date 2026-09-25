"use client";

import React, { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PerformanceDashboardData,
  ProductPerformanceItem,
  ReportingPeriod,
  MovementStatus,
  ReorderSignal,
} from "@/lib/retailer/performance";
import { useCart } from "@/components/retailer/cart-context";

interface SalesPerformanceDashboardProps {
  data: PerformanceDashboardData;
}

export function SalesPerformanceDashboard({ data }: { data: PerformanceDashboardData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const { addItem } = useCart();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [addedProductId, setAddedProductId] = useState<string | null>(null);

  const { selectedPeriod, selectedStoreId, stores, dataCoverage, summary, products } = data;

  const handlePeriodChange = (period: ReportingPeriod) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", period);
    startTransition(() => {
      router.push(`/retailer/sales?${params.toString()}`);
    });
  };

  const handleStoreChange = (storeId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("store", storeId);
    startTransition(() => {
      router.push(`/retailer/sales?${params.toString()}`);
    });
  };

  const handleAddToCart = (product: ProductPerformanceItem) => {
    if (!product.isOrderable || product.suggestedReorderQty <= 0) return;

    addItem(
      {
        id: product.productId,
        name: product.productName,
        nameEn: product.productNameEn,
        brandName: product.brandName,
        sku: product.sku,
        thumbnailUrl: product.thumbnailUrl,
        wholesalePrice: product.wholesalePrice,
        msrp: product.msrp,
        marginPercent: product.estimatedGrossMargin,
        cartonPackQty: product.cartonPackQty,
      },
      product.suggestedReorderQty
    );

    setAddedProductId(product.productId);
    setTimeout(() => setAddedProductId(null), 2500);
  };

  // Filter products by search and status
  const filteredProducts = products.filter((p) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        p.productName.toLowerCase().includes(q) ||
        (p.productNameEn && p.productNameEn.toLowerCase().includes(q)) ||
        p.sku.toLowerCase().includes(q) ||
        p.brandName.toLowerCase().includes(q);
      if (!match) return false;
    }

    if (statusFilter === "reorder") {
      return p.suggestedReorderQty > 0;
    }
    if (statusFilter === "moving") {
      return p.estimatedMovement > 0;
    }
    if (statusFilter === "review") {
      return p.hasNegativeVariance || p.movementStatus === "variance";
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              Product Performance & Reorder
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              {selectedStoreId === "all" ? "🏢 Company-Wide View" : "🏬 Store-Level View"}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Weekly count velocity, estimated retail sales, gross margins, and demand-based reorder signals.
          </p>
        </div>

        {/* Global Filters: Period & Store */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Store Selector */}
          <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700/60">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 pl-2">Store:</span>
            <select
              value={selectedStoreId}
              onChange={(e) => handleStoreChange(e.target.value)}
              className="text-xs font-semibold bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-lg px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Stores (Company Total)</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Period Selector */}
          <div className="inline-flex rounded-xl bg-zinc-100 dark:bg-zinc-800/80 p-1 border border-zinc-200 dark:border-zinc-700/60">
            {(
              [
                { id: "7d", label: "7 Days" },
                { id: "30d", label: "30 Days" },
                { id: "90d", label: "90 Days" },
                { id: "all", label: "All Time" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => handlePeriodChange(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectedPeriod === t.id
                    ? "bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-400 shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Data Coverage & Price Basis Banner */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-zinc-50 to-purple-50/30 dark:from-zinc-900/60 dark:to-purple-950/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-base flex-shrink-0">
            📊
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                Weekly Reporting Coverage: {dataCoverage.reportingStores} of {dataCoverage.totalStores} Stores ({dataCoverage.percent}%)
              </span>
              {dataCoverage.isPartial && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  Partial Store Data
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              {summary.priceBasisNotice}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/protection"
            className="py-1.5 px-3 rounded-xl text-xs font-bold bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors inline-flex items-center gap-1.5 shadow-xs"
          >
            <span>🛡️</span>
            <span>90-Day Protection</span>
            <span>→</span>
          </Link>
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-400">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            {summary.totalProductsAssorted} SKUs
          </div>
        </div>
      </div>

      {/* Top KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* Estimated Movement */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 sm:p-5 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Est. Units Moved
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white">
            {summary.totalEstimatedMovement > 0 ? summary.totalEstimatedMovement.toLocaleString() : "0"}
          </div>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
            From submitted weekly checks
          </p>
        </div>

        {/* Estimated Retail Sales */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 sm:p-5 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Est. Retail Sales @ SRP
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white">
            {summary.isFinancialsHidden
              ? "—"
              : `$${summary.totalEstimatedRetailSales.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </div>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
            {summary.isFinancialsHidden ? "Staff view restricted" : "Suggested retail value"}
          </p>
        </div>

        {/* Estimated Gross Profit */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 sm:p-5 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Est. Gross Profit
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {summary.isFinancialsHidden
              ? "—"
              : `$${summary.totalEstimatedGrossProfit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </div>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
            Retail Value − Wholesale Cost
          </p>
        </div>

        {/* Gross Margin */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 sm:p-5 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Est. Gross Margin
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white">
            {summary.isFinancialsHidden
              ? "—"
              : summary.averageGrossMargin > 0
              ? `${summary.averageGrossMargin}%`
              : "0%"}
          </div>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
            Average margin on moved units
          </p>
        </div>

        {/* Reorder Alerts */}
        <div className="col-span-2 lg:col-span-1 rounded-2xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/20 p-4 sm:p-5 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-300">
            Reorder Needed
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-purple-700 dark:text-purple-300">
            {summary.productsNeedingReorderCount} <span className="text-sm font-semibold">SKUs</span>
          </div>
          <p className="text-[10px] text-purple-600/80 dark:text-purple-400/80">
            Below 4-week supply target
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search by SKU, Product or Brand..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <span className="absolute left-3 top-2.5 text-zinc-400 text-xs">🔍</span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: "all", label: `All (${products.length})` },
            { id: "reorder", label: `Reorder Needed (${summary.productsNeedingReorderCount})` },
            { id: "moving", label: `Active Movement` },
            { id: "review", label: `Needs Review` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === tab.id
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Products Performance List / Table */}
      {filteredProducts.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl mx-auto">
            📦
          </div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
            No products found matching criteria
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
            Complete and submit weekly checks on the Weekly Check tab to populate real-time velocity and restock suggestions.
          </p>
          <div className="pt-2">
            <Link
              href="/retailer/check"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 transition-colors shadow-sm"
            >
              Go to Weekly Check Stepper →
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/40 text-zinc-500 dark:text-zinc-400 font-semibold">
                    <th className="py-3.5 pl-4 pr-3">Product</th>
                    <th className="py-3.5 px-3 text-center">Movement Status</th>
                    <th className="py-3.5 px-3 text-right">Est. Movement</th>
                    <th className="py-3.5 px-3 text-right">Reported Stock</th>
                    <th className="py-3.5 px-3 text-right">Avg Wkly / Wks Supply</th>
                    {!summary.isFinancialsHidden && (
                      <>
                        <th className="py-3.5 px-3 text-right">Est. Retail Sales</th>
                        <th className="py-3.5 px-3 text-right">Est. Gross Profit</th>
                      </>
                    )}
                    <th className="py-3.5 pl-3 pr-4 text-center">Reorder Signal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                  {filteredProducts.map((p) => (
                    <tr
                      key={p.productId}
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors group"
                    >
                      {/* Product Name & Brand */}
                      <td className="py-3.5 pl-4 pr-3">
                        <Link
                          href={`/retailer/sales/${p.productId}`}
                          className="flex items-center gap-3 group-hover:opacity-90"
                        >
                          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden flex-shrink-0 border border-zinc-200 dark:border-zinc-700/60">
                            {p.thumbnailUrl ? (
                              <Image
                                src={p.thumbnailUrl}
                                alt={p.productName}
                                fill
                                className="object-cover"
                                sizes="40px"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400">
                                🧴
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-zinc-900 dark:text-white truncate max-w-xs group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                              {p.productName}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                              <span>{p.brandName}</span>
                              <span>•</span>
                              <span className="font-mono">{p.sku}</span>
                              <span>•</span>
                              <span>Pack {p.cartonPackQty}</span>
                            </div>
                          </div>
                        </Link>
                      </td>

                      {/* Movement Status Badge */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <MovementStatusBadge status={p.movementStatus} />
                      </td>

                      {/* Estimated Movement */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <div className="font-bold text-zinc-900 dark:text-white">
                          {p.movementStatus === "baseline" ? (
                            <span className="text-zinc-400 text-xs">Baseline</span>
                          ) : p.movementStatus === "no_data" ? (
                            <span className="text-zinc-400 text-xs">No Count</span>
                          ) : (
                            `${p.estimatedMovement} units`
                          )}
                        </div>
                        {p.movementStatus === "provisional" && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400">
                            Provisional
                          </div>
                        )}
                      </td>

                      {/* Reported Remaining Stock */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {p.totalReportedRemaining} units
                        </div>
                        <div className="text-[10px] text-zinc-400">Across {p.storesBreakdown.length} store(s)</div>
                      </td>

                      {/* Velocity & Weeks of Supply */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {p.averageWeeklyMovement > 0 ? `${p.averageWeeklyMovement} / wk` : "—"}
                        </div>
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                          {p.approxWeeksOfSupply !== null
                            ? `${p.approxWeeksOfSupply} wks supply`
                            : "Supply: N/A"}
                        </div>
                      </td>

                      {/* Financials: Retail Sales & Gross Profit */}
                      {!summary.isFinancialsHidden && (
                        <>
                          <td className="py-3.5 px-3 text-right whitespace-nowrap">
                            <div className="font-bold text-zinc-900 dark:text-white">
                              ${p.estimatedRetailSales.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-[10px] text-zinc-400">@ ${p.msrp.toFixed(2)} SRP</div>
                          </td>

                          <td className="py-3.5 px-3 text-right whitespace-nowrap">
                            <div className="font-bold text-emerald-600 dark:text-emerald-400">
                              +${p.estimatedGrossProfit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-[10px] text-emerald-600/75 dark:text-emerald-400/75">
                              {p.estimatedGrossMargin}% margin
                            </div>
                          </td>
                        </>
                      )}

                      {/* Reorder Signal & Action */}
                      <td className="py-3.5 pl-3 pr-4 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center gap-1.5">
                          <ReorderSignalBadge signal={p.reorderSignal} qty={p.suggestedReorderQty} />

                          {p.suggestedReorderQty > 0 && p.isOrderable && (
                            <button
                              onClick={() => handleAddToCart(p)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shadow-sm ${
                                addedProductId === p.productId
                                  ? "bg-emerald-600 text-white"
                                  : "bg-purple-600 text-white hover:bg-purple-700"
                              }`}
                            >
                              {addedProductId === p.productId ? (
                                <>✓ Added</>
                              ) : (
                                <>+ Add {p.suggestedReorderQty} to Cart</>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Product Cards */}
          <div className="block lg:hidden space-y-3">
            {filteredProducts.map((p) => (
              <div
                key={p.productId}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 shadow-sm space-y-3"
              >
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden flex-shrink-0 border border-zinc-200 dark:border-zinc-700/60">
                    {p.thumbnailUrl ? (
                      <Image
                        src={p.thumbnailUrl}
                        alt={p.productName}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-base text-zinc-400">
                        🧴
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/retailer/sales/${p.productId}`}
                      className="font-bold text-sm text-zinc-900 dark:text-white block hover:text-purple-600 dark:hover:text-purple-400 truncate"
                    >
                      {p.productName}
                    </Link>
                    <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                      <span>{p.brandName}</span>
                      <span>•</span>
                      <span className="font-mono">{p.sku}</span>
                    </div>
                  </div>
                  <MovementStatusBadge status={p.movementStatus} />
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-2 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-3 text-xs">
                  <div>
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold">Est. Movement</span>
                    <div className="font-bold text-zinc-900 dark:text-white mt-0.5">
                      {p.movementStatus === "baseline"
                        ? "Baseline Count"
                        : p.movementStatus === "no_data"
                        ? "No Count"
                        : `${p.estimatedMovement} units`}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold">Reported Stock</span>
                    <div className="font-bold text-zinc-900 dark:text-white mt-0.5">
                      {p.totalReportedRemaining} units
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold">Weeks Supply</span>
                    <div className="font-semibold text-zinc-900 dark:text-zinc-200 mt-0.5">
                      {p.approxWeeksOfSupply !== null ? `${p.approxWeeksOfSupply} wks` : "N/A"}
                    </div>
                  </div>

                  {!summary.isFinancialsHidden && (
                    <div>
                      <span className="text-[10px] text-zinc-400 uppercase font-semibold">Est. Gross Profit</span>
                      <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        +${p.estimatedGrossProfit.toFixed(2)} ({p.estimatedGrossMargin}%)
                      </div>
                    </div>
                  )}
                </div>

                {/* Reorder Recommendation Banner */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                  <ReorderSignalBadge signal={p.reorderSignal} qty={p.suggestedReorderQty} />

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/retailer/sales/${p.productId}`}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200"
                    >
                      Breakdown →
                    </Link>

                    {p.suggestedReorderQty > 0 && p.isOrderable && (
                      <button
                        onClick={() => handleAddToCart(p)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                          addedProductId === p.productId
                            ? "bg-emerald-600 text-white"
                            : "bg-purple-600 text-white hover:bg-purple-700"
                        }`}
                      >
                        {addedProductId === p.productId ? "✓ Added" : `+ Add ${p.suggestedReorderQty}`}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MovementStatusBadge({ status }: { status: MovementStatus }) {
  switch (status) {
    case "normal":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          ● Moving
        </span>
      );
    case "provisional":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          ⚡ Provisional
        </span>
      );
    case "baseline":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
          📌 Baseline
        </span>
      );
    case "variance":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          ⚠️ Variance Review
        </span>
      );
    case "no_data":
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          No Counts
        </span>
      );
  }
}

function ReorderSignalBadge({ signal, qty }: { signal: ReorderSignal; qty: number }) {
  switch (signal) {
    case "reorder_needed":
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-200 border border-purple-300 dark:border-purple-800">
          🔔 Need {qty} Units
        </span>
      );
    case "sufficient_stock":
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          ✓ Stock Healthy
        </span>
      );
    case "overstock":
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
          📦 Well Stocked (&gt;8w)
        </span>
      );
    case "needs_review":
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          ⚠️ Audit Variance
        </span>
      );
    case "insufficient_data":
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          📊 Early Data
        </span>
      );
  }
}
