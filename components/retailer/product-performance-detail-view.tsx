"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ProductPerformanceItem, StorePerformanceBreakdown } from "@/lib/retailer/performance";
import { useCart } from "@/components/retailer/cart-context";

interface ProductPerformanceDetailViewProps {
  product: ProductPerformanceItem;
  userRole: string;
}

export function ProductPerformanceDetailView({ product, userRole }: ProductPerformanceDetailViewProps) {
  const { addItem } = useCart();
  const [isAdded, setIsAdded] = useState(false);

  const isFinancialsHidden = userRole === "employee";

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
          href="/retailer/sales"
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
                  {product.estimatedGrossMargin}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Demand & Reorder Recommendation Card */}
      <div className="rounded-2xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/20 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-purple-900 dark:text-purple-200">
                Demand Signal & Reorder Recommendation
              </h2>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-purple-200 text-purple-900 dark:bg-purple-900 dark:text-purple-100">
                Target: 4 Weeks Supply
              </span>
            </div>
            <p className="text-xs text-purple-700/80 dark:text-purple-300/80 mt-0.5">
              Calculated from multi-store company-wide velocity and reported remaining stock.
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/80 dark:bg-zinc-900/80 rounded-xl p-4 border border-purple-100 dark:border-purple-900/40 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-zinc-400">Company Movement</span>
            <div className="text-lg font-bold text-zinc-900 dark:text-white mt-0.5">
              {product.estimatedMovement} units
            </div>
            <span className="text-[10px] text-zinc-400">Across usable periods</span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-zinc-400">Avg. Velocity</span>
            <div className="text-lg font-bold text-zinc-900 dark:text-white mt-0.5">
              {product.averageWeeklyMovement} / wk
            </div>
            <span className="text-[10px] text-zinc-400">{product.usableWeeksCount} report intervals</span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-zinc-400">Reported Stock</span>
            <div className="text-lg font-bold text-zinc-900 dark:text-white mt-0.5">
              {product.totalReportedRemaining} units
            </div>
            <span className="text-[10px] text-zinc-400">
              {product.approxWeeksOfSupply !== null ? `${product.approxWeeksOfSupply} wks supply` : "Supply N/A"}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-purple-700 dark:text-purple-300">
              Suggested Reorder
            </span>
            <div className="text-lg font-extrabold text-purple-700 dark:text-purple-300 mt-0.5">
              {product.suggestedReorderQty > 0 ? `${product.suggestedReorderQty} units` : "0 (Healthy)"}
            </div>
            <span className="text-[10px] text-purple-600/80 dark:text-purple-400/80">
              Rounded to pack of {product.cartonPackQty}
            </span>
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
                  <th className="py-3 px-3 text-right">Latest Stock</th>
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
                      {sb.latestReportedRemaining !== null ? `${sb.latestReportedRemaining} units` : "—"}
                    </td>

                    <td className="py-3 px-3 text-right font-bold text-zinc-900 dark:text-white">
                      {sb.movementStatus === "baseline"
                        ? "Baseline"
                        : sb.movementStatus === "no_data"
                        ? "No Count"
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
            <strong>Estimated Retail Sales & Gross Profit:</strong> Estimated using K SELECT Suggested Retail Price (MSRP) and confidential Retailer wholesale purchase cost. Supplier FOB and sourcing costs are never used.
          </li>
          <li>
            <strong>Baseline Counts:</strong> The initial weekly check for a product establishes the starting baseline stock and does not fabricate historical sales.
          </li>
          <li>
            <strong>Provisional Movement:</strong> Interval calculation where delivery tracking is pending (<span className="italic">Previous Remaining − Current Remaining</span>).
          </li>
          <li>
            <strong>Reorder Rules:</strong> Target quantity is calculated for a 4-week supply and automatically rounded up to the product’s valid carton case pack multiple.
          </li>
        </ul>
      </div>
    </div>
  );
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
