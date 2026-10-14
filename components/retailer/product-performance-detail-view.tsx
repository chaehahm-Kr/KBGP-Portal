"use client";

import React, { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ProductPerformanceItem,
  StorePerformanceBreakdown,
  ReorderCoverage,
  ReorderSignal,
} from "@/lib/retailer/performance";
import { useCart } from "@/components/retailer/cart-context";

interface ProductPerformanceDetailViewProps {
  product: ProductPerformanceItem;
  userRole: string;
  selectedCoverage?: ReorderCoverage;
  period?: string;
}

export function ProductPerformanceDetailView({
  product,
  userRole,
  selectedCoverage,
  period = "30d",
}: ProductPerformanceDetailViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { addItem } = useCart();
  const [isAdded, setIsAdded] = useState(false);

  const activeCoverage: ReorderCoverage = selectedCoverage || product.coverage || "30d";
  const isFinancialsHidden = userRole === "employee";

  const handleCoverageChange = (cov: ReorderCoverage) => {
    startTransition(() => {
      router.push(`/sales/${product.productId}?coverage=${cov}&period=${period}`);
    });
  };

  const handleAddToCart = () => {
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

    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href={`/sales?coverage=${activeCoverage}&period=${period}`}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          ← Back to Performance Dashboard
        </Link>
        <span className="text-xs font-mono text-zinc-400">SKU: {product.sku}</span>
      </div>

      {/* Product Summary Header Card */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          {/* Thumbnail */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden flex-shrink-0 border border-zinc-200 dark:border-zinc-700">
            {product.thumbnailUrl ? (
              <Image
                src={product.thumbnailUrl}
                alt={product.productName}
                fill
                unoptimized
                className="object-cover"
                sizes="96px"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl text-zinc-400">
                🧴
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300">
                {product.brandName}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {product.categoryLabel}
              </span>
              <span className="text-xs font-mono text-zinc-400">
                Case Pack: {product.cartonPackQty} units
              </span>
            </div>

            <h1 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white leading-snug">
              {product.productName}
            </h1>
            {product.productNameEn && (
              <p className="text-xs text-zinc-400 font-normal">{product.productNameEn}</p>
            )}

            {/* Commercial Pricing row */}
            <div className="flex items-center gap-4 pt-1 text-xs">
              <div>
                <span className="text-zinc-400">Wholesale Cost: </span>
                <span className="font-bold text-zinc-900 dark:text-white">
                  ${product.wholesalePrice.toFixed(2)}
                </span>
              </div>
              <span>•</span>
              <div>
                <span className="text-zinc-400">Suggested Retail (SRP): </span>
                <span className="font-bold text-zinc-900 dark:text-white">
                  ${product.msrp.toFixed(2)}
                </span>
              </div>
              <span>•</span>
              <div>
                <span className="text-zinc-400">Target Margin: </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {product.msrp > 0 && product.wholesalePrice > 0
                    ? `${Math.round(((product.msrp - product.wholesalePrice) / product.msrp) * 100)}%`
                    : product.estimatedGrossMargin > 0
                    ? `${product.estimatedGrossMargin}%`
                    : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Demand & Reorder Recommendation Card */}
      <div className="rounded-2xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/20 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base font-bold text-purple-900 dark:text-purple-200">
                Demand Signal & Reorder Recommendation
              </h2>

              {/* Target Coverage Toggle (30 Days | 60 Days) */}
              <div className="inline-flex items-center gap-1 bg-white/90 dark:bg-zinc-900/90 p-0.5 rounded-xl border border-purple-200 dark:border-purple-800 shadow-xs">
                <button
                  type="button"
                  onClick={() => handleCoverageChange("30d")}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    activeCoverage === "30d"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                >
                  30 Days
                </button>
                <button
                  type="button"
                  onClick={() => handleCoverageChange("60d")}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    activeCoverage === "60d"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                >
                  60 Days
                </button>
              </div>

              <DetailReorderSignalBadge signal={product.reorderSignal} qty={product.suggestedReorderQty} />
            </div>
            <p className="text-xs text-purple-700/80 dark:text-purple-300/80">
              {product.coverageDays}-day forward inventory target based on observed daily velocity and projected stock.
            </p>
          </div>

          {/* Action Button */}
          {product.suggestedReorderQty > 0 && product.isOrderable && (
            <button
              onClick={handleAddToCart}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 ${
                isAdded
                  ? "bg-emerald-600 text-white"
                  : "bg-purple-600 text-white hover:bg-purple-700"
              }`}
            >
              {isAdded ? "✓ Added to Cart" : `+ Add ${product.suggestedReorderQty} Units to Cart`}
            </button>
          )}
        </div>

        {/* Calculation Step Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-white/80 dark:bg-zinc-900/80 rounded-xl p-4 border border-purple-100 dark:border-purple-900/40 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-zinc-400">Avg. Daily Velocity</span>
            <div className="text-lg font-bold text-zinc-900 dark:text-white mt-0.5">
              {product.dailyVelocity > 0 ? `${product.dailyVelocity.toFixed(2)} / day` : "—"}
            </div>
            <span className="text-[10px] text-zinc-400">
              {product.usableWeeksCount > 0 ? `${product.averageWeeklyMovement}/wk (${product.totalObservedDays}d obs.)` : "No velocity data"}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-purple-700 dark:text-purple-300">
              Target Demand ({product.coverageDays}d)
            </span>
            <div className="text-lg font-bold text-purple-700 dark:text-purple-300 mt-0.5">
              {product.targetDemand} units
            </div>
            <span className="text-[10px] text-zinc-400">
              {product.dailyVelocity > 0 ? `${product.dailyVelocity.toFixed(2)} × ${product.coverageDays} days` : "Requires velocity"}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-zinc-400">Reported Stock</span>
            <div className="text-lg font-bold text-zinc-900 dark:text-white mt-0.5">
              {product.totalReportedRemaining !== null ? `${product.totalReportedRemaining} units` : "Not Reported"}
            </div>
            <span className="text-[10px] text-zinc-400">
              {product.approxWeeksOfSupply !== null ? `~${product.approxWeeksOfSupply} wks on hand` : "Supply N/A"}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">Projected Available</span>
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5">
              {product.projectedAvailableStock !== null ? `${product.projectedAvailableStock} units` : "—"}
            </div>
            <span className="text-[10px] text-zinc-400">
              +{product.incomingQty} incoming{product.postReportEstimatedReceipts > 0 ? ` (+${product.postReportEstimatedReceipts} post-check)` : ""}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-purple-700 dark:text-purple-300">
              Suggested Reorder
            </span>
            <div className="text-lg font-extrabold text-purple-700 dark:text-purple-300 mt-0.5">
              {product.suggestedReorderQty > 0
                ? `${product.suggestedReorderQty} units`
                : product.reorderConfidence === "insufficient_data" || product.movementStatus === "no_data"
                ? "—"
                : product.reorderSignal === "overstock"
                ? "0 (Overstocked)"
                : product.incomingQty > 0 && product.targetDemand > (product.totalReportedRemaining ?? 0)
                ? "0 (Covered)"
                : "0 (Healthy)"}
            </div>
            <span className="text-[10px] text-purple-600/80 dark:text-purple-400/80">
              {product.suggestedReorderQty > 0
                ? `${product.suggestedCases} case(s) (pack of ${product.cartonPackQty})`
                : product.reorderConfidence === "insufficient_data"
                ? "Requires weekly check counts"
                : product.reorderSignal === "overstock"
                ? "Well stocked for target"
                : product.incomingQty > 0 && product.targetDemand > (product.totalReportedRemaining ?? 0)
                ? "Covered by incoming inventory"
                : `Pack of ${product.cartonPackQty}`}
            </span>
          </div>
        </div>
      </div>

      {/* Inventory Flow & Incoming Stock Reconciliation Card */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white">
                📦 Inventory Flow & Incoming Reconciliation
              </h3>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                product.dataReliability === "verified"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
              }`}>
                {product.dataReliability === "verified" ? "✓ Verified via Invoices & Dispatches" : "⚡ Estimated Transit Policy"}
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              발송 확인(Confirmed Dispatch) 및 송장 발행일 기준으로 입고 예정(In Transit)과 자동 입고(Est. Received)를 산정합니다.
            </p>
          </div>

          {product.nextEstimatedReceiptDate && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-semibold">
              <span>🚚</span>
              <span>Next Est. Arrival: <strong>{product.nextEstimatedReceiptDate}</strong></span>
            </div>
          )}
        </div>

        {/* 5-Tile Flow Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 space-y-0.5">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase">Ordered Total</span>
            <div className="text-base font-bold text-zinc-900 dark:text-white">
              {product.orderedQty} units
            </div>
            <p className="text-[10px] text-zinc-400">
              Cancelled: {product.cancelledQty} units
            </p>
          </div>

          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 space-y-0.5">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase">Confirmed Shipped</span>
            <div className="text-base font-bold text-zinc-900 dark:text-white">
              {product.confirmedShippedQty} units
            </div>
            <p className="text-[10px] text-zinc-400">
              Transit + Est. Received
            </p>
          </div>

          <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 space-y-0.5">
            <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase">In Transit</span>
            <div className="text-base font-extrabold text-blue-700 dark:text-blue-300">
              {product.inTransitQty} units
            </div>
            <p className="text-[10px] text-blue-500">
              En route to stores
            </p>
          </div>

          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 space-y-0.5">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase">Est. Received</span>
            <div className="text-base font-bold text-zinc-900 dark:text-white">
              {product.estimatedReceivedQty} units
            </div>
            <p className="text-[10px] text-zinc-400">
              Delivered / Date reached
            </p>
          </div>

          <div className="col-span-2 sm:col-span-1 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 space-y-0.5">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase">Pending Dispatch</span>
            <div className="text-base font-bold text-zinc-900 dark:text-white">
              {product.pendingQty} units
            </div>
            <p className="text-[10px] text-zinc-400">
              Awaiting fulfillment
            </p>
          </div>
        </div>

        {/* Invariant Equation Confirmation */}
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/30 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 font-mono">
          <div>
            <span>Ordered ({product.orderedQty})</span> = <span>Shipped ({product.confirmedShippedQty})</span> + <span>Cancelled ({product.cancelledQty})</span> + <span>Pending ({product.pendingQty})</span>
          </div>
          <div className="text-blue-600 dark:text-blue-400">
            Total Incoming: <strong>+{product.incomingQty}</strong> (In Transit: {product.inTransitQty} + Pending: {product.pendingQty})
          </div>
        </div>
      </div>

      {/* Store Breakdown Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
            Store-by-Store Performance Breakdown
          </h3>
          <span className="text-xs text-zinc-500">
            {product.storesBreakdown.length} Store Location(s)
          </span>
        </div>

        {product.storesBreakdown.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 text-center text-xs text-zinc-500">
            No store count data available for this product.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/40 text-zinc-500 dark:text-zinc-400 font-semibold">
                  <th className="py-3 pl-4 pr-3">Store Location</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Reported Stock</th>
                  <th className="py-3 px-3 text-right">Incoming Stock</th>
                  <th className="py-3 px-3 text-right">Est. Received</th>
                  <th className="py-3 px-3 text-right">Est. Movement</th>
                  <th className="py-3 px-3 text-right">Avg Weekly</th>
                  <th className="py-3 px-3 text-right">Weeks Supply</th>
                  <th className="py-3 pl-3 pr-4 text-right">Last Reported</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                {product.storesBreakdown.map((sb) => (
                  <tr key={sb.storeId} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30">
                    <td className="py-3 pl-4 pr-3 font-bold text-zinc-900 dark:text-white">
                      {sb.storeName}
                    </td>

                    <td className="py-3 px-3 text-center">
                      <StoreStatusBadge status={sb.movementStatus} />
                    </td>

                    <td className="py-3 px-3 text-right font-semibold text-zinc-900 dark:text-zinc-100">
                      {sb.latestReportedRemaining !== null ? `${sb.latestReportedRemaining} units` : "Not Reported"}
                    </td>

                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {sb.incomingQty > 0 ? (
                          <span className="text-blue-600 dark:text-blue-400 font-bold">
                            +{sb.incomingQty} units
                          </span>
                        ) : (
                          <span className="text-zinc-400 font-normal">0 units</span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        {sb.inTransitQty > 0 && sb.pendingQty > 0
                          ? `${sb.inTransitQty} transit • ${sb.pendingQty} pending`
                          : sb.inTransitQty > 0
                          ? `${sb.inTransitQty} transit`
                          : sb.pendingQty > 0
                          ? `${sb.pendingQty} pending`
                          : "No orders"}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right font-medium text-zinc-700 dark:text-zinc-300">
                      {sb.estimatedReceivedQty} units
                    </td>

                    <td className="py-3 px-3 text-right font-bold text-zinc-900 dark:text-white">
                      {sb.movementStatus === "baseline"
                        ? "Baseline"
                        : sb.movementStatus === "no_data"
                        ? "—"
                        : `${sb.estimatedMovement} units`}
                    </td>

                    <td className="py-3 px-3 text-right text-zinc-700 dark:text-zinc-300">
                      {sb.avgWeeklyMovement > 0 ? `${sb.avgWeeklyMovement} / wk` : "—"}
                    </td>

                    <td className="py-3 px-3 text-right text-zinc-700 dark:text-zinc-300">
                      {sb.approxWeeksOfSupply !== null ? `${sb.approxWeeksOfSupply} wks` : "—"}
                    </td>

                    <td className="py-3 pl-3 pr-4 text-right text-zinc-400 text-[11px]">
                      {sb.lastReportingWeek || sb.lastReportDate || "None"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Methodology & Safety Footnote */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-900/40 p-4 text-[11px] text-zinc-500 dark:text-zinc-400 space-y-1.5">
        <div className="font-bold text-zinc-700 dark:text-zinc-300">
          💡 Estimation Methodology & Price Basis
        </div>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>
            <strong>Estimated Retail Sales & Gross Profit:</strong> Estimated using K SELECT Suggested Retail Price (MSRP) and confidential Retailer wholesale purchase cost. Sourcing and FOB costs are never exposed or used.
          </li>
          <li>
            <strong>Baseline Counts:</strong> The initial weekly check for a product establishes the starting baseline stock and does not fabricate historical sales.
          </li>
          <li>
            <strong>Provisional Movement:</strong> Interval calculation where delivery tracking is pending (<span className="italic">Previous Remaining − Current Remaining</span>).
          </li>
          <li>
            <strong>30 / 60-Day Reorder Coverage:</strong> Target demand is calculated by multiplying observed daily velocity by the selected forward-looking coverage target (30 or 60 days). Recommended orders deduct projected available stock (reported remaining + post-report estimated receipts + incoming pending/transit) and automatically round up to the product’s valid carton case pack multiple.
          </li>
          <li>
            <strong>Missing Inventory Safeguard:</strong> If no weekly inventory check has been submitted, suggested reorder remains zero and is flagged as insufficient data to prevent accidental or duplicate purchasing.
          </li>
        </ul>
      </div>
    </div>
  );
}

function DetailReorderSignalBadge({ signal, qty }: { signal: ReorderSignal; qty: number }) {
  switch (signal) {
    case "reorder_needed":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-200 border border-purple-300 dark:border-purple-800">
          🔔 Need {qty} Units
        </span>
      );
    case "sufficient_stock":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          ✓ Stock Healthy
        </span>
      );
    case "overstock":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
          📦 Well Stocked
        </span>
      );
    case "needs_review":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          ⚠️ Audit Variance
        </span>
      );
    case "insufficient_data":
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          📊 Insufficient Data
        </span>
      );
  }
}

function StoreStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "normal":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
          Moving
        </span>
      );
    case "provisional":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
          Provisional
        </span>
      );
    case "baseline":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
          Baseline
        </span>
      );
    case "variance":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
          Variance
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          No Count
        </span>
      );
  }
}

