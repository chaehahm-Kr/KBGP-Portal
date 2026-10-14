"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ReorderRecommendationPanelProps, ReorderCoverageTarget } from "./types";
import { DataReliabilityBadge } from "./data-reliability-badge";

export function ReorderRecommendationPanel({
  productId,
  productName,
  sku,
  cartonPackQty,
  coverageTarget,
  onCoverageChange,
  currentReportedStock,
  postReportReceipts,
  projectedAvailableStock,
  dailyVelocity,
  targetDemand,
  eligibleIncoming,
  rawReorderNeed,
  suggestedCases,
  suggestedReorderQty,
  signal,
  signalReason,
  isOrderable,
  wholesalePrice,
  selectedStoreId,
  selectedStoreName,
  availableStores,
  onAddToCart,
  onAddToCartPlaceholder,
}: ReorderRecommendationPanelProps) {
  const isInsufficient = signal === "insufficient_data";
  const isNeedsReview = signal === "needs_review";

  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  // P4-R1 Dual-Mode Reorder Architecture:
  // 1. Suggested Mode: P3 computed replenishment need (reorder_needed & suggestedReorderQty > 0)
  // 2. Manual Mode: Always available for any orderable SKU independent of performance observations
  const hasSuggested = isOrderable && signal === "reorder_needed" && suggestedReorderQty > 0;
  const isManualAvailable = isOrderable && wholesalePrice !== null && wholesalePrice !== undefined;
  const canOrder = hasSuggested || isManualAvailable;

  // Case stepper state: defaults to suggested cases if recommendation exists, or 1 case (MOQ)
  const initialCases = hasSuggested ? Math.max(1, suggestedCases) : 1;
  const [orderCases, setOrderCases] = useState<number>(initialCases);

  useEffect(() => {
    if (hasSuggested) {
      setOrderCases(Math.max(1, suggestedCases));
    }
  }, [hasSuggested, suggestedCases, coverageTarget]);

  // Destination store selection for Company-Wide view
  const [customStoreId, setCustomStoreId] = useState<string | undefined>(undefined);
  const activeTargetStoreId =
    selectedStoreId && selectedStoreId !== "all"
      ? selectedStoreId
      : customStoreId || (availableStores && availableStores.length > 0 ? availableStores[0].id : undefined);

  const packMultiple = Math.max(1, cartonPackQty || 1);
  const orderUnits = orderCases * packMultiple;
  const isSuggestedMode = hasSuggested && orderCases === suggestedCases;

  const handleAddToCart = () => {
    if (!canOrder || isAdding || orderUnits <= 0) return;
    setIsAdding(true);
    if (onAddToCart) {
      onAddToCart(productId, orderUnits, activeTargetStoreId);
    } else if (onAddToCartPlaceholder) {
      onAddToCartPlaceholder(productId, orderUnits);
    }
    setJustAdded(true);
    setTimeout(() => setIsAdding(false), 500);
    setTimeout(() => setJustAdded(false), 4000);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-5">
      {/* Header with Title, Badge and 30d/60d Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-bold text-white">Reorder Recommendation</h3>
            <DataReliabilityBadge signal={signal} size="md" />
          </div>
          <p className="text-xs text-zinc-400">
            Automated stock replenishment guidance rounded to case pack multiples (MOQ: {cartonPackQty} units/case).
          </p>
        </div>

        {/* 30 / 60 Days Coverage Target Selection */}
        <div className="flex items-center gap-1.5 p-1 bg-zinc-800/80 rounded-lg border border-zinc-700/60 self-start sm:self-auto">
          <span className="text-[11px] font-medium text-zinc-400 px-2">Target:</span>
          {(["30d", "60d"] as ReorderCoverageTarget[]).map((cov) => (
            <button
              key={cov}
              type="button"
              onClick={() => onCoverageChange && onCoverageChange(cov)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                coverageTarget === cov
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {cov === "30d" ? "30 Days" : "60 Days"}
            </button>
          ))}
        </div>
      </div>

      {/* Main Suggested Quantity Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Recommended Quantity Box */}
        <div className="md:col-span-2 bg-gradient-to-br from-indigo-950/40 via-zinc-900 to-zinc-900 border border-indigo-900/40 rounded-xl p-4 flex flex-col justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
              Suggested Reorder for {coverageTarget === "30d" ? "30-Day" : "60-Day"} Target
            </span>
            <div className="flex items-baseline gap-3 pt-1">
              {isInsufficient ? (
                <div className="text-2xl font-bold text-zinc-400">Insufficient Data</div>
              ) : isNeedsReview ? (
                <div className="text-2xl font-bold text-amber-300">Review Required</div>
              ) : suggestedReorderQty > 0 ? (
                <>
                  <span className="text-4xl font-extrabold text-white tracking-tight">
                    {suggestedReorderQty.toLocaleString()}{" "}
                    <span className="text-sm font-normal text-zinc-400">units</span>
                  </span>
                  <span className="text-sm font-semibold text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800/60">
                    {suggestedCases} {suggestedCases === 1 ? "case" : "cases"}
                  </span>
                </>
              ) : (
                <span className="text-3xl font-bold text-emerald-400">
                  0 units <span className="text-sm font-normal text-zinc-400">(Adequate Stock)</span>
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-800/80 text-xs text-zinc-400 flex items-center justify-between">
            <span>
              {signalReason ||
                (suggestedReorderQty > 0
                  ? `Raw deficit: ${rawReorderNeed} units, rounded up to ${suggestedCases} full case(s)`
                  : "Current stock plus incoming pipeline covers the target demand period")}
            </span>
            {wholesalePrice && suggestedReorderQty > 0 && (
              <span className="font-semibold text-zinc-300">
                Est. Cost: ${(suggestedReorderQty * wholesalePrice).toFixed(2)}
              </span>
            )}
          </div>
        </div>

        {/* P4-R1 Active Quick Reorder Box (Suggested or Manual) */}
        <div className="bg-zinc-800/40 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Quick Reorder
              </span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                  isSuggestedMode
                    ? "bg-indigo-950/80 text-indigo-300 border-indigo-800/60"
                    : canOrder
                    ? "bg-zinc-800 text-zinc-300 border-zinc-700"
                    : "bg-rose-950/40 text-rose-300 border-rose-900/60"
                }`}
              >
                {isSuggestedMode ? "Suggested" : canOrder ? "Manual" : "Unavailable"}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              {!isOrderable
                ? "Product currently unavailable for ordering on HUB."
                : hasSuggested
                ? `System recommended replenishment for ${coverageTarget === "30d" ? "30-day" : "60-day"} demand.`
                : isInsufficient
                ? "No sales velocity data yet. Manual case pack reorder is active."
                : isNeedsReview
                ? "Stock review recommended. Manual case pack reorder is active."
                : "Stock covers demand. Manual case pack restock is active."}
            </p>
          </div>

          {/* Destination Store Picker if Company-Wide & Multiple Stores */}
          {selectedStoreId === "all" && availableStores && availableStores.length > 1 && canOrder && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                <span>Destination Store</span>
                <span className="text-[10px] text-zinc-500 font-normal">Fulfillment</span>
              </label>
              <select
                value={activeTargetStoreId || ""}
                onChange={(e) => setCustomStoreId(e.target.value)}
                className="w-full text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                {availableStores.map((s) => (
                  <option key={s.id} value={s.id}>
                    📍 {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Stepper Controls */}
          {canOrder && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400 font-medium">Order Quantity:</span>
                <span className="text-zinc-400 text-[10px]">{packMultiple} units/case</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={orderCases <= 1}
                  onClick={() => setOrderCases(Math.max(1, orderCases - 1))}
                  className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold flex items-center justify-center border border-zinc-700 text-sm transition-colors cursor-pointer"
                  title="Decrease 1 case"
                >
                  −
                </button>
                <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg py-1 px-2.5 text-center">
                  <div className="text-xs font-bold text-white">
                    {orderUnits.toLocaleString()} <span className="text-[10px] font-normal text-zinc-400">units</span>
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    {orderCases} {orderCases === 1 ? "case" : "cases"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOrderCases(orderCases + 1)}
                  className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-white font-bold flex items-center justify-center border border-zinc-700 text-sm transition-colors cursor-pointer"
                  title="Increase 1 case"
                >
                  +
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2 pt-1">
            {canOrder ? (
              <button
                type="button"
                disabled={isAdding}
                onClick={handleAddToCart}
                className="w-full py-2.5 px-3 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                <svg className="w-4 h-4 text-white shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>
                  {justAdded
                    ? "✓ Added to Cart!"
                    : isSuggestedMode
                    ? `Add Suggested ${orderUnits.toLocaleString()} Units (${orderCases} cs)`
                    : `Add ${orderUnits.toLocaleString()} Units (${orderCases} cs)`}
                </span>
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="w-full py-2.5 px-3 rounded-lg text-xs font-semibold bg-zinc-800 text-zinc-500 border border-zinc-700/50 cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                title="Product currently unavailable on HUB"
              >
                <svg className="w-4 h-4 text-zinc-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>Unavailable on HUB</span>
              </button>
            )}

            {justAdded ? (
              <div className="flex items-center justify-between text-[11px] pt-1 text-emerald-400">
                <span>✓ Added to cart</span>
                <Link href="/cart" className="underline font-bold text-indigo-400 hover:text-indigo-300">
                  View Cart →
                </Link>
              </div>
            ) : canOrder ? (
              <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-0.5">
                {wholesalePrice ? (
                  <span>Est. Cost: ${(orderUnits * wholesalePrice).toFixed(2)}</span>
                ) : (
                  <span>Rounded to MOQ</span>
                )}
                <span>MOQ: {packMultiple} u/cs</span>
              </div>
            ) : (
              <p className="text-[10px] text-zinc-500 text-center">
                Product currently unavailable on HUB
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Transparent Calculation Breakdown Grid */}
      <div className="space-y-2 pt-2">
        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
          Calculation Breakdown & Flow Logic
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div className="p-3 bg-zinc-800/40 rounded-lg border border-zinc-800">
            <span className="text-[11px] text-zinc-400 block mb-1">Reported Stock</span>
            <span className="font-bold text-zinc-200 text-sm">
              {currentReportedStock !== null ? `${currentReportedStock} units` : "Not Reported"}
            </span>
            <span className="text-[10px] text-zinc-500 block mt-0.5">Physical check count</span>
          </div>

          <div className="p-3 bg-zinc-800/40 rounded-lg border border-zinc-800">
            <span className="text-[11px] text-zinc-400 block mb-1">Post-Report Receipts</span>
            <span className="font-bold text-zinc-200 text-sm">+{postReportReceipts} units</span>
            <span className="text-[10px] text-zinc-500 block mt-0.5">Delivered since count</span>
          </div>

          <div className="p-3 bg-zinc-800/40 rounded-lg border border-zinc-800">
            <span className="text-[11px] text-zinc-400 block mb-1">Eligible Incoming</span>
            <span className="font-bold text-zinc-200 text-sm">+{eligibleIncoming} units</span>
            <span className="text-[10px] text-zinc-500 block mt-0.5">In-transit & pending</span>
          </div>

          <div className="p-3 bg-zinc-800/40 rounded-lg border border-zinc-800">
            <span className="text-[11px] text-zinc-400 block mb-1">
              Target Demand ({coverageTarget === "30d" ? "30d" : "60d"})
            </span>
            <span className="font-bold text-zinc-200 text-sm">
              {dailyVelocity > 0 ? `${targetDemand} units` : "0 units"}
            </span>
            <span className="text-[10px] text-zinc-500 block mt-0.5">
              @{dailyVelocity}/day velocity
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
