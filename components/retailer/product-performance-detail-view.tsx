"use client";

import React, { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ProductPerformanceItem,
  ReorderCoverage,
} from "@/lib/retailer/performance";
import {
  ReorderRecommendationPanel,
  InventoryFlowSummary,
  StorePerformanceBreakdownView,
  DataReliabilityBadge,
} from "@/components/retailer/performance-ui";
import {
  ReorderCoverageTarget,
  ReorderRecommendationSignal,
  StoreBreakdownRow,
} from "@/components/retailer/performance-ui/types";
import { useCart } from "@/components/retailer/cart-context";

interface ProductPerformanceDetailViewProps {
  product: ProductPerformanceItem;
  userRole: string;
  selectedCoverage?: ReorderCoverage;
  period?: string;
  selectedStoreId?: string | "all";
}

export function ProductPerformanceDetailView({
  product,
  userRole,
  selectedCoverage,
  period = "30d",
  selectedStoreId: propStoreId,
}: ProductPerformanceDetailViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const { addItem } = useCart();
  const [cartFeedback, setCartFeedback] = useState<{
    title: string;
    message: string;
    subtext?: string;
  } | null>(null);

  const activeCoverage: ReorderCoverage = selectedCoverage || product.coverage || "30d";
  const isFinancialsHidden = userRole === "employee" || product.isFinancialsHidden;

  const currentStoreId = propStoreId || searchParams.get("store") || "all";
  const currentStoreObj = product.storesBreakdown.find((s) => s.storeId === currentStoreId);

  const handleCoverageChange = (cov: ReorderCoverageTarget) => {
    startTransition(() => {
      const storeParam = currentStoreId && currentStoreId !== "all" ? `&store=${currentStoreId}` : "";
      router.push(`/sales/${product.productId}?coverage=${cov}&period=${period}${storeParam}`);
    });
  };

  const handleAddToCartMain = (productId: string, quantity: number, storeId?: string) => {
    const targetStoreId = storeId || (currentStoreId !== "all" ? currentStoreId : undefined);
    const targetStoreName = targetStoreId
      ? product.storesBreakdown.find((s) => s.storeId === targetStoreId)?.storeName
      : product.storesBreakdown.length === 1
      ? product.storesBreakdown[0].storeName
      : undefined;

    const result = addItem(
      {
        id: product.productId,
        name: product.productName,
        nameEn: product.productNameEn,
        brandName: product.brandName,
        sku: product.sku,
        thumbnailUrl: product.thumbnailUrl,
        wholesalePrice: product.wholesalePrice || 0,
        msrp: product.msrp || 0,
        cartonPackQty: product.cartonPackQty,
        targetStoreId: targetStoreId,
        targetStoreName: targetStoreName,
      },
      quantity
    );

    const cases = Math.ceil(quantity / product.cartonPackQty);
    const totalCases = Math.ceil(result.newQty / product.cartonPackQty);
    const storeNotice = targetStoreName ? ` for ${targetStoreName}` : "";

    if (result.previousQty > 0) {
      setCartFeedback({
        title: "Cart Quantity Updated",
        message: `Added ${quantity.toLocaleString()} units (${cases} cs)${storeNotice}.`,
        subtext: `Cart now contains ${result.newQty.toLocaleString()} units (${totalCases} cs) of ${product.productName}.`,
      });
    } else {
      setCartFeedback({
        title: "Added to Cart",
        message: `Added ${quantity.toLocaleString()} units (${cases} cs)${storeNotice} of ${product.productName}.`,
        subtext: `Total in cart: ${result.newQty.toLocaleString()} units.`,
      });
    }
  };

  const handleAddToCartStore = (storeId: string, storeName: string, quantity: number) => {
    const result = addItem(
      {
        id: product.productId,
        name: product.productName,
        nameEn: product.productNameEn,
        brandName: product.brandName,
        sku: product.sku,
        thumbnailUrl: product.thumbnailUrl,
        wholesalePrice: product.wholesalePrice || 0,
        msrp: product.msrp || 0,
        cartonPackQty: product.cartonPackQty,
        targetStoreId: storeId,
        targetStoreName: storeName,
      },
      quantity
    );

    const cases = Math.ceil(quantity / product.cartonPackQty);
    const totalCases = Math.ceil(result.newQty / product.cartonPackQty);

    if (result.previousQty > 0) {
      setCartFeedback({
        title: "Cart Quantity Updated",
        message: `Added ${quantity.toLocaleString()} units (${cases} cs) for ${storeName}.`,
        subtext: `Cart now contains ${result.newQty.toLocaleString()} units (${totalCases} cs) of ${product.productName}.`,
      });
    } else {
      setCartFeedback({
        title: "Added to Cart",
        message: `Added ${quantity.toLocaleString()} units (${cases} cs) for ${storeName}.`,
        subtext: `Total in cart: ${result.newQty.toLocaleString()} units.`,
      });
    }
  };

  // Map stores breakdown to StoreBreakdownRow for P6 view
  const storeRows: StoreBreakdownRow[] = product.storesBreakdown.map((s) => {
    let storeSignal: ReorderRecommendationSignal = "insufficient_data";
    if (s.rawReorderNeed > 0) {
      storeSignal = "reorder_needed";
    } else if (s.movementStatus === "variance") {
      storeSignal = "needs_review";
    } else if (s.latestReportedRemaining === null) {
      storeSignal = "insufficient_data";
    } else {
      storeSignal = "sufficient_stock";
    }

    return {
      storeId: s.storeId,
      storeName: s.storeName,
      reportedStock: s.latestReportedRemaining,
      lastReportDate: s.lastReportDate,
      incomingQty: s.incomingQty,
      inTransitQty: s.inTransitQty,
      estimatedMovement: s.estimatedMovement,
      avgWeeklyMovement: s.avgWeeklyMovement,
      dailyVelocity: s.dailyVelocity,
      weeksOfSupply: s.approxWeeksOfSupply,
      signal: storeSignal,
      suggestedReorderQty: s.suggestedReorderQty,
    };
  });

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
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">SKU: {product.sku}</span>
          {isPending && (
            <span className="text-xs text-indigo-600 animate-pulse">Updating...</span>
          )}
        </div>
      </div>

      {/* SECTION 1: Product Identity Card */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          {/* Thumbnail */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden flex-shrink-0 border border-zinc-200 dark:border-zinc-700/60">
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
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                {product.brandName}
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">·</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                {product.categoryLabel}
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">·</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                MOQ: {product.cartonPackQty} units / case
              </span>
              <DataReliabilityBadge signal={product.reorderSignal as ReorderRecommendationSignal} size="sm" />
            </div>

            <h1 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white tracking-tight">
              {product.productName}
            </h1>
            {product.productNameEn && product.productNameEn !== product.productName && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {product.productNameEn}
              </p>
            )}

            {/* Pricing Badges */}
            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
              <div>
                <span className="text-zinc-400 dark:text-zinc-500 mr-1.5">Wholesale Price:</span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100">
                  ${product.wholesalePrice.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-zinc-400 dark:text-zinc-500 mr-1.5">Suggested SRP:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  ${product.msrp.toFixed(2)}
                </span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 ml-1">
                  ({product.priceBasisLabel})
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: Financial Performance Summary Table (Selected Period vs Cumulative Since Baseline) */}
      {!isFinancialsHidden && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                Financial Performance Summary
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Comparing current analysis period ({period}) with cumulative performance since starting count baseline.
              </p>
            </div>
            <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg self-start sm:self-auto">
              Pricing Basis: {product.priceBasisLabel}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Metric</th>
                  <th className="py-2.5 px-3 text-right">Selected Period ({period})</th>
                  <th className="py-2.5 px-3 text-right">Cumulative (From Baseline)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                {/* Units Sold */}
                <tr>
                  <td className="py-3 px-3 font-medium text-zinc-700 dark:text-zinc-300">
                    Estimated Units Sold
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-zinc-900 dark:text-zinc-100">
                    {product.estimatedUnitsSold !== null ? (
                      `${product.estimatedUnitsSold.toLocaleString()} units`
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-500 italic">Insufficient Data</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-zinc-900 dark:text-zinc-100">
                    {product.cumulativeMetrics?.estimatedUnitsSold !== null && product.cumulativeMetrics?.estimatedUnitsSold !== undefined ? (
                      `${product.cumulativeMetrics.estimatedUnitsSold.toLocaleString()} units`
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-500 italic">Insufficient Data</span>
                    )}
                  </td>
                </tr>

                {/* Retail Revenue */}
                <tr>
                  <td className="py-3 px-3 font-medium text-zinc-700 dark:text-zinc-300">
                    Estimated Retail Sales
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-zinc-900 dark:text-zinc-100">
                    {product.estimatedRetailSales !== null ? (
                      `$${product.estimatedRetailSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-500 italic">Insufficient Data</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-zinc-900 dark:text-zinc-100">
                    {product.cumulativeMetrics?.estimatedRetailSales !== null && product.cumulativeMetrics?.estimatedRetailSales !== undefined ? (
                      `$${product.cumulativeMetrics.estimatedRetailSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-500 italic">Insufficient Data</span>
                    )}
                  </td>
                </tr>

                {/* Wholesale Cost */}
                <tr>
                  <td className="py-3 px-3 font-medium text-zinc-700 dark:text-zinc-300">
                    Wholesale Merchandise Cost
                  </td>
                  <td className="py-3 px-3 text-right font-medium text-zinc-600 dark:text-zinc-400">
                    {product.estimatedRetailSales !== null && product.estimatedGrossProfit !== null ? (
                      `$${(product.estimatedRetailSales - product.estimatedGrossProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-500 italic">—</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-medium text-zinc-600 dark:text-zinc-400">
                    {product.cumulativeMetrics?.estimatedWholesaleCost !== null && product.cumulativeMetrics?.estimatedWholesaleCost !== undefined ? (
                      `$${product.cumulativeMetrics.estimatedWholesaleCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-500 italic">—</span>
                    )}
                  </td>
                </tr>

                {/* Gross Profit */}
                <tr>
                  <td className="py-3 px-3 font-medium text-zinc-700 dark:text-zinc-300">
                    Estimated Gross Profit
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-teal-600 dark:text-teal-400">
                    {product.estimatedGrossProfit !== null ? (
                      `$${product.estimatedGrossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-500 italic">Insufficient Data</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-teal-600 dark:text-teal-400">
                    {product.cumulativeMetrics?.estimatedGrossProfit !== null && product.cumulativeMetrics?.estimatedGrossProfit !== undefined ? (
                      `$${product.cumulativeMetrics.estimatedGrossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-500 italic">Insufficient Data</span>
                    )}
                  </td>
                </tr>

                {/* Gross Margin */}
                <tr>
                  <td className="py-3 px-3 font-medium text-zinc-700 dark:text-zinc-300">
                    Estimated Gross Margin
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-teal-600 dark:text-teal-400">
                    {product.estimatedGrossMargin !== null ? (
                      `${product.estimatedGrossMargin.toFixed(1)}%`
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-500 italic">—</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-teal-600 dark:text-teal-400">
                    {product.cumulativeMetrics?.estimatedGrossMargin !== null && product.cumulativeMetrics?.estimatedGrossMargin !== undefined ? (
                      `${product.cumulativeMetrics.estimatedGrossMargin.toFixed(1)}%`
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-500 italic">—</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 3: P6 Reorder Recommendation Panel */}
      <ReorderRecommendationPanel
        productId={product.productId}
        productName={product.productName}
        sku={product.sku}
        cartonPackQty={product.cartonPackQty}
        coverageTarget={activeCoverage as ReorderCoverageTarget}
        onCoverageChange={handleCoverageChange}
        currentReportedStock={product.totalReportedRemaining}
        postReportReceipts={product.postReportEstimatedReceipts}
        projectedAvailableStock={product.projectedAvailableStock}
        dailyVelocity={product.dailyVelocity}
        targetDemand={product.targetDemand}
        eligibleIncoming={product.incomingQty}
        rawReorderNeed={product.rawReorderNeed}
        suggestedCases={product.suggestedCases}
        suggestedReorderQty={product.suggestedReorderQty}
        signal={product.reorderSignal as ReorderRecommendationSignal}
        isOrderable={product.isOrderable}
        wholesalePrice={product.wholesalePrice}
        selectedStoreId={currentStoreId}
        selectedStoreName={currentStoreObj?.storeName}
        availableStores={product.storesBreakdown.map((s) => ({
          id: s.storeId,
          name: s.storeName,
        }))}
        onAddToCart={handleAddToCartMain}
      />

      {/* SECTION 4: P6 Inventory Flow & Pipeline Summary */}
      <InventoryFlowSummary
        orderedQty={product.orderedQty}
        confirmedShippedQty={product.confirmedShippedQty}
        pendingQty={product.pendingQty}
        inTransitQty={product.inTransitQty}
        estimatedReceivedQty={product.estimatedReceivedQty}
        incomingQty={product.incomingQty}
        nextEstimatedReceiptDate={product.nextEstimatedReceiptDate}
        postReportEstimatedReceipts={product.postReportEstimatedReceipts}
      />

      {/* SECTION 5: P6 Store-by-Store Performance Breakdown */}
      <StorePerformanceBreakdownView
        stores={storeRows}
        coverageTarget={activeCoverage as ReorderCoverageTarget}
        cartonPackQty={product.cartonPackQty}
        productId={product.productId}
        isOrderable={product.isOrderable}
        onAddToCartStore={handleAddToCartStore}
      />

      {/* SECTION 6: Estimation Disclosure Footer */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 p-4 text-xs text-zinc-500 dark:text-zinc-400 space-y-1.5">
        <div className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
          <span>ℹ️</span>
          <span>About K SELECT HUB Product Performance & Estimations</span>
        </div>
        <p className="leading-relaxed text-[11px]">
          K SELECT HUB is an estimation and restock assistance system designed for independent beauty supply retailers.
          Sales and financial metrics are computed by tracking depleted inventory between consecutive submitted weekly checks,
          reconciled with carrier shipments and estimated delivery dates. This system is not a real-time point-of-sale (POS) terminal,
          warehouse management system (WMS), or accounting platform. Variances from actual register sales may occur due to shrinkage,
          unreported store-to-store transfers, or pending customer returns.
        </p>
      </div>

      {/* Floating Cart Feedback Notification */}
      {cartFeedback && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm bg-zinc-900 border border-zinc-700/80 rounded-xl p-4 shadow-2xl text-white space-y-1.5 animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">
                ✓
              </span>
              <span className="text-xs font-bold text-zinc-100">{cartFeedback.title}</span>
            </div>
            <button
              type="button"
              onClick={() => setCartFeedback(null)}
              className="text-zinc-400 hover:text-white text-xs px-1 hover:bg-zinc-800 rounded transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-zinc-300 leading-normal pl-7">
            {cartFeedback.message}
          </p>
          {cartFeedback.subtext && (
            <p className="text-[11px] text-zinc-400 pl-7">{cartFeedback.subtext}</p>
          )}
          <div className="pl-7 pt-1">
            <Link
              href="/cart"
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-400 hover:text-indigo-300 hover:underline"
            >
              <span>View Cart</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
