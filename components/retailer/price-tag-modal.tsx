"use client";

import React, { useState, useTransition } from "react";
import {
  StoreProductTagItem,
  calculateDiscountPercent,
  calculateGrossProfitMetrics,
} from "@/lib/retailer/store-pricing-types";
import { saveStoreProductPriceAction, clearStoreProductPriceAction } from "@/lib/retailer/store-pricing-actions";
import { PriceTagCard } from "@/components/retailer/price-tag-card";
import { CalendarDatePicker } from "@/components/shared/calendar-date-picker";

interface PriceTagModalProps {
  item: StoreProductTagItem;
  storeId: string;
  storeName: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function PriceTagModal({
  item,
  storeId,
  storeName,
  isOpen,
  onClose,
  onSaved,
}: PriceTagModalProps) {
  const [isPending, startTransition] = useTransition();

  // MSRP-based initialization:
  // If store price exists, keep existing price.
  // If store price is missing, prefill with valid positive MSRP, otherwise leave empty (do not prefill $0.00).
  const initialRegular = item.hasStorePrice && item.regularPrice
    ? item.regularPrice.toString()
    : item.msrp > 0
    ? item.msrp.toFixed(2)
    : "";

  const [regularPrice, setRegularPrice] = useState<string>(initialRegular);
  const [salePrice, setSalePrice] = useState<string>(
    item.salePrice ? item.salePrice.toString() : ""
  );
  const [saleStartDate, setSaleStartDate] = useState<string>(item.saleStartDate || "");
  const [saleEndDate, setSaleEndDate] = useState<string>(item.saleEndDate || "");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const numRegular = parseFloat(regularPrice);
  const numSale = parseFloat(salePrice);
  const isValidRegular = !isNaN(numRegular) && numRegular > 0;
  const isSaleProvided = salePrice.trim() !== "" && !isNaN(numSale) && numSale > 0;
  const isSaleValid = !isSaleProvided || (isValidRegular && numSale < numRegular);
  const previewDiscount =
    isValidRegular && isSaleProvided && isSaleValid
      ? calculateDiscountPercent(numRegular, numSale)
      : null;

  // Margin previews
  const wholesaleCost = typeof item.wholesalePrice === "number" ? item.wholesalePrice : null;
  const regMargin = calculateGrossProfitMetrics(isValidRegular ? numRegular : null, wholesaleCost);
  const saleMargin = calculateGrossProfitMetrics(isSaleProvided && isSaleValid ? numSale : null, wholesaleCost);

  // Virtual item for live preview in modal
  const previewItem: StoreProductTagItem = {
    ...item,
    hasStorePrice: true,
    regularPrice: isValidRegular ? numRegular : item.msrp,
    salePrice: isSaleProvided && isSaleValid ? numSale : null,
    saleStartDate: saleStartDate || null,
    saleEndDate: saleEndDate || null,
    discountPercent: previewDiscount,
    isSaleActive: isSaleProvided && isSaleValid,
    effectivePrice: isSaleProvided && isSaleValid ? numSale : isValidRegular ? numRegular : item.msrp,
    priceBasis: isSaleProvided && isSaleValid ? "store_sale" : "store_regular",
  };

  const handleUseMSRP = () => {
    if (item.msrp > 0) {
      setRegularPrice(item.msrp.toFixed(2));
      setErrorMessage(null);
    }
  };

  const handleSave = () => {
    setErrorMessage(null);

    if (!isValidRegular) {
      setErrorMessage("Regular Price must be greater than $0.00.");
      return;
    }

    if (isSaleProvided && numSale >= numRegular) {
      setErrorMessage("Sale Price must be strictly lower than Regular Price.");
      return;
    }

    startTransition(async () => {
      const res = await saveStoreProductPriceAction({
        storeId,
        productId: item.productId,
        regularPrice: numRegular,
        salePrice: isSaleProvided ? numSale : null,
        saleStartDate: saleStartDate || null,
        saleEndDate: saleEndDate || null,
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to save store price.");
      } else {
        onSaved();
        onClose();
      }
    });
  };

  const handleResetToMSRP = () => {
    if (!item.hasStorePrice) {
      onClose();
      return;
    }

    startTransition(async () => {
      const res = await clearStoreProductPriceAction(storeId, item.productId);
      if (!res.success) {
        setErrorMessage(res.error || "Failed to reset price.");
      } else {
        onSaved();
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">
              Edit Store Price & Tag
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              📍 {storeName} • {item.brandName} {item.sku}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-xs font-semibold text-rose-700 dark:text-rose-300">
              ⚠️ {errorMessage}
            </div>
          )}

          {/* Product Header */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
            <div className="w-12 h-12 rounded-xl bg-white dark:bg-zinc-800 relative overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-700">
              {item.thumbnailUrl ? (
                <img
                  src={item.thumbnailUrl}
                  alt={item.productName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-lg text-zinc-400">
                  🧴
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 text-xs">
              <div className="font-bold text-zinc-900 dark:text-white truncate">
                {item.productName}
              </div>
              <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mt-0.5 flex-wrap">
                {typeof item.wholesalePrice === "number" && (
                  <>
                    <span title={item.wholesaleCostLabel || undefined} className="cursor-help">
                      Wholesale Cost: <strong>${item.wholesalePrice.toFixed(2)}</strong>
                    </span>
                    <span>•</span>
                  </>
                )}
                <span className="font-semibold text-purple-600 dark:text-purple-400">
                  {item.hasMsrp ? `Suggested MSRP: $${item.msrp.toFixed(2)}` : "MSRP Not Available"}
                </span>
              </div>
            </div>
          </div>

          {/* MSRP Guidance Callout if unpriced */}
          {!item.hasStorePrice && (
            <div className="p-3 rounded-xl bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/80 text-xs space-y-1">
              {item.hasMsrp ? (
                <>
                  <div className="font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                    <span>💡</span>
                    <span>MSRP Default: ${item.msrp.toFixed(2)}</span>
                  </div>
                  <p className="text-[11px] text-purple-800 dark:text-purple-300">
                    Store regular price is automatically initialized from Suggested MSRP. Adjusting and saving will create an explicit Store Price override.
                  </p>
                </>
              ) : (
                <>
                  <div className="font-bold text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                    <span>⚠️</span>
                    <span>MSRP Not Available</span>
                  </div>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">
                    Please manually specify your store regular selling price below.
                  </p>
                </>
              )}
            </div>
          )}

          {/* Pricing Form */}
          <div className="space-y-4 text-xs">
            {/* Regular Price */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-bold text-zinc-900 dark:text-white">
                  Store Regular Price ($ USD) <span className="text-rose-500">*</span>
                </label>
                {item.hasMsrp && (
                  <button
                    type="button"
                    onClick={handleUseMSRP}
                    className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                  >
                    Use Suggested MSRP (${item.msrp.toFixed(2)})
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-zinc-400 font-bold">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={regularPrice}
                  onChange={(e) => setRegularPrice(e.target.value)}
                  placeholder={item.hasMsrp ? item.msrp.toFixed(2) : "Enter selling price"}
                  className="w-full pl-7 pr-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-bold text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Live Regular Margin Preview */}
              {regMargin.grossProfit !== null && (
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 px-1">
                  <span>Estimated Merchandise Profit:</span>
                  <span
                    className={`font-semibold ${
                      regMargin.grossProfit < 0
                        ? "text-rose-600 dark:text-rose-400 font-bold"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    GP ${regMargin.grossProfit.toFixed(2)} ({regMargin.grossMarginPercent}%)
                  </span>
                </div>
              )}
            </div>

            {/* Optional Sale Price */}
            <div className="p-4 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 space-y-3 bg-zinc-50/50 dark:bg-zinc-800/20">
              <div className="flex items-center justify-between">
                <label className="font-bold text-zinc-900 dark:text-white">
                  Optional Sale Price ($ USD)
                </label>
                {previewDiscount !== null && (
                  <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 font-black text-[11px]">
                    SAVE {previewDiscount}%
                  </span>
                )}
              </div>

              <div className="relative">
                <span className="absolute left-3 top-2.5 text-zinc-400 font-bold">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  placeholder="Optional promotional price"
                  className="w-full pl-7 pr-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-bold text-sm focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* Live Sale Margin Preview */}
              {saleMargin.grossProfit !== null && (
                <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 px-1">
                  <span>Sale Merchandise Profit:</span>
                  <span
                    className={`font-semibold ${
                      saleMargin.grossProfit < 0
                        ? "text-rose-600 dark:text-rose-400 font-bold"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    GP ${saleMargin.grossProfit.toFixed(2)} ({saleMargin.grossMarginPercent}%)
                  </span>
                </div>
              )}

              {/* Sale Dates */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <CalendarDatePicker
                    label="Sale Start Date"
                    value={saleStartDate}
                    maxDate={saleEndDate || undefined}
                    onChange={(val) => setSaleStartDate(val)}
                  />
                </div>
                <div>
                  <CalendarDatePicker
                    label="Sale End Date"
                    value={saleEndDate}
                    minDate={saleStartDate || undefined}
                    onChange={(val) => setSaleEndDate(val)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Live Shelf Label Preview */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
              Label Preview (Customer Facing: 50mm × 30mm)
            </span>
            <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 flex justify-center">
              <PriceTagCard item={previewItem} scale={1.0} />
            </div>
            <p className="text-[10px] text-zinc-400 text-center">
              * Note: Wholesale cost, gross profit, and margins are strictly internal management data and never appear on printed customer-facing shelf labels.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
          <div>
            {item.hasStorePrice && (
              <button
                type="button"
                onClick={handleResetToMSRP}
                disabled={isPending}
                className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer disabled:opacity-50"
              >
                Clear Store Price
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || !isValidRegular}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {isPending ? "Saving..." : "Confirm & Save Price"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
