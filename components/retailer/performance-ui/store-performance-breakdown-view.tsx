"use client";

import React, { useState } from "react";
import { StorePerformanceBreakdownViewProps } from "./types";
import { DataReliabilityBadge } from "./data-reliability-badge";
import { normalizeReorderQuantity } from "@/lib/product/retailer-policy";

export function StorePerformanceBreakdownView({
  stores,
  coverageTarget,
  cartonPackQty,
  moq,
  orderMultiple,
  productId,
  isOrderable = true,
  onAddToCartStore,
}: StorePerformanceBreakdownViewProps) {
  const [addingStoreId, setAddingStoreId] = useState<string | null>(null);
  const [addedStoreId, setAddedStoreId] = useState<string | null>(null);

  const safeMoq = Math.max(1, Math.floor(moq || cartonPackQty || 1));
  const safeMultiple = Math.max(1, Math.floor(orderMultiple || safeMoq || 1));
  const minValidQty = Math.ceil(safeMoq / safeMultiple) * safeMultiple;

  if (stores.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center space-y-2">
        <p className="text-sm font-semibold text-zinc-300">No store associations found</p>
        <p className="text-xs text-zinc-500">This product is not currently assorted or reported in any accessible store.</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-800">
        <div>
          <h3 className="text-base font-bold text-white">Store-by-Store Inventory & Movement</h3>
          <p className="text-xs text-zinc-400">
            Store-isolated counts, incoming dispatches, and location-specific reorder recommendations ({coverageTarget === "30d" ? "30-Day" : "60-Day"} Target).
          </p>
        </div>
        <span className="text-xs text-zinc-500 self-start sm:self-auto font-medium">
          {stores.length} {stores.length === 1 ? "Store" : "Stores"}
        </span>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              <th className="py-2.5 px-3">Store Location</th>
              <th className="py-2.5 px-3 text-right">Reported Stock</th>
              <th className="py-2.5 px-3 text-right">Incoming</th>
              <th className="py-2.5 px-3 text-right">Est. Movement</th>
              <th className="py-2.5 px-3 text-right">Avg Weekly Sales</th>
              <th className="py-2.5 px-3 text-right">Weeks Supply</th>
              <th className="py-2.5 px-3 text-center">Status</th>
              <th className="py-2.5 px-3 text-right">Suggested Order</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {stores.map((s) => {
              const purchaseSuggestedQty = normalizeReorderQuantity(
                s.suggestedReorderQty,
                safeMoq,
                safeMultiple,
                isOrderable
              ).normalizedQty;
              const purchaseManualQty = minValidQty;

              return (
                <tr key={s.storeId} className="hover:bg-zinc-800/40 transition-colors">
                  {/* Store Name & Last Report Date */}
                  <td className="py-3 px-3">
                    <div className="font-semibold text-zinc-200">{s.storeName}</div>
                    <div className="text-[10px] text-zinc-500">
                      {s.lastReportDate ? `Counted ${s.lastReportDate}` : "No count submitted"}
                    </div>
                  </td>

                  {/* Reported Stock */}
                  <td className="py-3 px-3 text-right font-medium text-zinc-300">
                    {s.reportedStock !== null ? `${s.reportedStock} units` : <span className="text-zinc-500 italic">Not Reported</span>}
                  </td>

                  {/* Incoming Qty */}
                  <td className="py-3 px-3 text-right font-medium">
                    {s.incomingQty > 0 ? (
                      <span className="text-amber-400 font-semibold">+{s.incomingQty}</span>
                    ) : (
                      <span className="text-zinc-500">0</span>
                    )}
                  </td>

                  {/* Est. Movement */}
                  <td className="py-3 px-3 text-right font-medium text-zinc-300">
                    {s.estimatedMovement !== null ? `${s.estimatedMovement} units` : <span className="text-zinc-500">—</span>}
                  </td>

                  {/* Avg Weekly Sales */}
                  <td className="py-3 px-3 text-right font-medium text-zinc-300">
                    {s.avgWeeklyMovement !== null ? `${s.avgWeeklyMovement}/wk` : <span className="text-zinc-500">—</span>}
                  </td>

                  {/* Weeks of Supply */}
                  <td className="py-3 px-3 text-right font-medium">
                    {s.weeksOfSupply !== null ? (
                      <span className={s.weeksOfSupply < 2 ? "text-rose-400 font-bold" : "text-zinc-300"}>
                        {s.weeksOfSupply} wks
                      </span>
                    ) : (
                      <span className="text-zinc-500">—</span>
                    )}
                  </td>

                  {/* Recommendation Signal */}
                  <td className="py-3 px-3 text-center">
                    <DataReliabilityBadge signal={s.signal} size="sm" />
                  </td>

                  {/* Suggested Order */}
                  <td className="py-3 px-3 text-right font-bold">
                    {s.signal === "reorder_needed" && s.suggestedReorderQty && s.suggestedReorderQty > 0 ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-indigo-400">{s.suggestedReorderQty} units</span>
                        {isOrderable && onAddToCartStore && (
                          <button
                            type="button"
                            disabled={addingStoreId === s.storeId}
                            onClick={() => {
                              setAddingStoreId(s.storeId);
                              onAddToCartStore(s.storeId, s.storeName, purchaseSuggestedQty);
                              setAddedStoreId(s.storeId);
                              setTimeout(() => setAddingStoreId(null), 500);
                              setTimeout(() => setAddedStoreId(null), 3000);
                            }}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold shadow-xs transition-colors cursor-pointer ${
                              addedStoreId === s.storeId
                                ? "bg-emerald-600 text-white"
                                : "bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white"
                            } disabled:opacity-50`}
                            title={`Add suggested ${purchaseSuggestedQty} units to Cart`}
                          >
                            <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <span>{addedStoreId === s.storeId ? "✓ Added" : "+ Cart"}</span>
                          </button>
                        )}
                      </div>
                    ) : isOrderable && onAddToCartStore ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-zinc-500 font-normal">
                          {s.signal === "insufficient_data" ? "N/A" : "0"}
                        </span>
                        <button
                          type="button"
                          disabled={addingStoreId === s.storeId}
                          onClick={() => {
                            setAddingStoreId(s.storeId);
                            onAddToCartStore(s.storeId, s.storeName, purchaseManualQty);
                            setAddedStoreId(s.storeId);
                            setTimeout(() => setAddingStoreId(null), 500);
                            setTimeout(() => setAddedStoreId(null), 3000);
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold shadow-xs transition-colors cursor-pointer ${
                            addedStoreId === s.storeId
                              ? "bg-emerald-600 text-white"
                              : "bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-300 hover:text-white border border-zinc-700/80"
                          } disabled:opacity-50`}
                          title={`Manual Quick Reorder: Add minimum order multiple (${purchaseManualQty} units) to Cart`}
                        >
                          <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          <span>{addedStoreId === s.storeId ? "✓ Added" : "+ Reorder"}</span>
                        </button>
                      </div>
                    ) : (
                      <span className="text-zinc-500 font-normal">
                        {s.signal === "insufficient_data" ? "N/A" : "0"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List View */}
      <div className="md:hidden space-y-3">
        {stores.map((s) => {
          const purchaseSuggestedQty = normalizeReorderQuantity(
            s.suggestedReorderQty,
            safeMoq,
            safeMultiple,
            isOrderable
          ).normalizedQty;
          const purchaseManualQty = minValidQty;

          return (
            <div key={s.storeId} className="p-3.5 bg-zinc-800/40 rounded-xl border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-white text-sm">{s.storeName}</span>
                  <span className="text-[10px] text-zinc-500 block">
                    {s.lastReportDate ? `Counted on ${s.lastReportDate}` : "No count submitted"}
                  </span>
                </div>
                <DataReliabilityBadge signal={s.signal} size="sm" />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-zinc-800/60">
                <div>
                  <span className="text-[10px] text-zinc-400 block">Current Stock</span>
                  <span className="font-semibold text-zinc-200">
                    {s.reportedStock !== null ? `${s.reportedStock} units` : "Not Reported"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block">Incoming Stock</span>
                  <span className="font-semibold text-amber-400">
                    {s.incomingQty > 0 ? `+${s.incomingQty} units` : "0"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block">Est. Movement</span>
                  <span className="font-semibold text-zinc-200">
                    {s.estimatedMovement !== null ? `${s.estimatedMovement} units` : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between col-span-2 pt-1 border-t border-zinc-800/40">
                  <div>
                    <span className="text-[10px] text-zinc-400 block">Suggested Reorder</span>
                    <span className="font-bold text-indigo-400">
                      {s.suggestedReorderQty && s.suggestedReorderQty > 0 ? `${s.suggestedReorderQty} units` : "0 units (Adequate)"}
                    </span>
                  </div>
                  {s.suggestedReorderQty && s.suggestedReorderQty > 0 && s.signal === "reorder_needed" ? (
                    isOrderable && onAddToCartStore && (
                      <button
                        type="button"
                        disabled={addingStoreId === s.storeId}
                        onClick={() => {
                          setAddingStoreId(s.storeId);
                          onAddToCartStore(s.storeId, s.storeName, purchaseSuggestedQty);
                          setAddedStoreId(s.storeId);
                          setTimeout(() => setAddingStoreId(null), 500);
                          setTimeout(() => setAddedStoreId(null), 3000);
                        }}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold shadow-xs transition-colors cursor-pointer ${
                          addedStoreId === s.storeId
                            ? "bg-emerald-600 text-white"
                            : "bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white"
                        } disabled:opacity-50`}
                      >
                        <span>{addedStoreId === s.storeId ? "✓ Added" : "+ Cart"}</span>
                      </button>
                    )
                  ) : isOrderable && onAddToCartStore ? (
                    <button
                      type="button"
                      disabled={addingStoreId === s.storeId}
                      onClick={() => {
                        setAddingStoreId(s.storeId);
                        onAddToCartStore(s.storeId, s.storeName, purchaseManualQty);
                        setAddedStoreId(s.storeId);
                        setTimeout(() => setAddingStoreId(null), 500);
                        setTimeout(() => setAddedStoreId(null), 3000);
                      }}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold shadow-xs transition-colors cursor-pointer ${
                        addedStoreId === s.storeId
                          ? "bg-emerald-600 text-white"
                          : "bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-300 hover:text-white border border-zinc-700/80"
                      } disabled:opacity-50`}
                      title={`Manual Quick Reorder: Add minimum order multiple (${purchaseManualQty} units) to Cart`}
                    >
                      <span>{addedStoreId === s.storeId ? "✓ Added" : "+ Reorder"}</span>
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
