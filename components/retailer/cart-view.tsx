"use client";

import React from "react";
import Link from "next/link";
import { useCart } from "@/components/retailer/cart-context";

export function RetailerCartView() {
  const {
    items,
    subtotal,
    totalUnits,
    totalSkus,
    updateQuantity,
    removeItem,
    clearCart,
    isLoading,
  } = useCart();

  if (isLoading) {
    return (
      <div className="py-16 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-zinc-500">Loading your cart...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-12 text-center space-y-4 shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-3xl mx-auto font-bold">
          🛒
        </div>
        <div className="max-w-sm mx-auto space-y-1">
          <h2 className="text-base font-bold text-zinc-900 dark:text-white">
            Your Order Cart is Empty
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Browse verified Korean cosmetics, analyze retail margins, and add case packs to your store order.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:opacity-90 transition-opacity shadow-xs"
          >
            Explore Product Catalog →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">
            Store Order Cart
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Review case packs, quantities, and wholesale pricing before submitting your order.
          </p>
        </div>
        <button
          type="button"
          onClick={clearCart}
          className="text-xs font-semibold text-zinc-400 hover:text-red-500 transition-colors self-start sm:self-auto cursor-pointer"
        >
          Clear All Items ✕
        </button>
      </div>

      {/* Main Grid: Items List + Summary Column */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Items List (8 cols on lg) */}
        <div className="lg:col-span-8 space-y-4">
          {items.map((item) => {
            const pack = Math.max(1, item.casePackQty || 1);
            return (
              <div
                key={item.productId}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-xs space-y-4"
              >
                <div className="flex gap-4">
                  {/* Thumbnail */}
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 p-2 shrink-0 flex items-center justify-center overflow-hidden border border-zinc-200/60 dark:border-zinc-800">
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.productName}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-xs text-zinc-400">No Image</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                          {item.brandName}
                        </span>
                        <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white line-clamp-2 leading-snug">
                          <Link
                            href={`/products/${item.productId}`}
                            className="hover:underline"
                          >
                            {item.productName}
                          </Link>
                        </h3>
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => removeItem(item.productId)}
                        className="p-1 text-zinc-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                        title="Remove item"
                        aria-label="Remove item"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                          />
                        </svg>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="font-mono text-[11px]">SKU: {item.sku}</span>
                      <span>•</span>
                      <span>Case Pack: {pack} units</span>
                      {item.marginPercent > 0 && (
                        <>
                          <span>•</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {item.marginPercent}% Margin
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Quantity Controls & Line Total */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  {/* Stepper */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                      Qty:
                    </span>
                    <div className="inline-flex items-center rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-1">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, item.quantity - pack)}
                        disabled={item.quantity <= pack}
                        className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val > 0) {
                            updateQuantity(item.productId, val);
                          }
                        }}
                        className="w-12 text-center font-bold text-xs bg-transparent border-0 text-zinc-900 dark:text-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, item.quantity + pack)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 transition-colors"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-[11px] text-zinc-400">
                      (@ ${item.wholesalePrice.toFixed(2)}/ea)
                    </span>
                  </div>

                  {/* Line Total */}
                  <div className="text-right">
                    <div className="text-[10px] uppercase font-bold text-zinc-400">Line Total</div>
                    <div className="text-base sm:text-lg font-extrabold text-zinc-900 dark:text-white">
                      ${item.lineTotal.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Order Summary (4 cols on lg) */}
        <div className="lg:col-span-4 space-y-4 sticky top-20">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-950 p-6 shadow-xs space-y-5">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-zinc-800 pb-3">
              Order Summary
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Total SKUs:</span>
                <span className="font-semibold text-zinc-900 dark:text-white">{totalSkus}</span>
              </div>
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Total Product Units:</span>
                <span className="font-semibold text-zinc-900 dark:text-white">{totalUnits} units</span>
              </div>
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Wholesale Subtotal:</span>
                <span className="font-bold text-sm text-zinc-900 dark:text-white">
                  ${subtotal.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>Estimated Shipping:</span>
                <span className="italic text-zinc-400">Calculated at dispatch</span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>Estimated Tax:</span>
                <span className="italic text-zinc-400">Exempt / Wholesale</span>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-baseline">
              <div>
                <div className="text-xs font-bold text-zinc-900 dark:text-white">Estimated Total</div>
                <div className="text-[10px] text-zinc-400">Excl. shipping & taxes</div>
              </div>
              <div className="text-2xl font-black text-zinc-900 dark:text-white">
                ${subtotal.toFixed(2)}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <Link
                href="/checkout"
                className="w-full py-3.5 px-6 rounded-xl font-bold text-sm bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:opacity-95 transition-opacity flex items-center justify-center gap-2 shadow-xs"
              >
                <span>Proceed to Checkout</span>
                <span>→</span>
              </Link>
              <Link
                href="/products"
                className="w-full py-2.5 px-4 text-center rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors block"
              >
                ← Continue Browsing Catalog
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
