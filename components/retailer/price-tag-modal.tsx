"use client";

import React, { useState, useTransition } from "react";
import { StoreProductTagItem, calculateDiscountPercent } from "@/lib/retailer/store-pricing-types";
import { saveStoreProductPriceAction, clearStoreProductPriceAction } from "@/lib/retailer/store-pricing-actions";
import { PriceTagCard } from "@/components/retailer/price-tag-card";

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

  const [regularPrice, setRegularPrice] = useState<string>(
    item.regularPrice ? item.regularPrice.toString() : item.msrp.toString()
  );
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
    setRegularPrice(item.msrp.toFixed(2));
    setSalePrice("");
    setSaleStartDate("");
    setSaleEndDate("");
    setErrorMessage(null);
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
            <div className="w-12 h-12 rounded-xl bg-white dark:bg-zinc-800 relative overflow-hidden flex-shrink-0 border border-zinc-200 dark:border-zinc-700">
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
              <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mt-0.5">
                <span>Wholesale Cost: ${item.wholesalePrice.toFixed(2)}</span>
                <span>•</span>
                <span className="font-semibold text-purple-600 dark:text-purple-400">
                  Suggested MSRP: ${item.msrp.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Pricing Form */}
          <div className="space-y-4 text-xs">
            {/* Regular Price */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-bold text-zinc-900 dark:text-white">
                  Store Regular Price ($ USD) <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleUseMSRP}
                  className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline"
                >
                  Convenience: [Use Suggested MSRP (${item.msrp.toFixed(2)})]
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-zinc-400 font-bold">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={regularPrice}
                  onChange={(e) => setRegularPrice(e.target.value)}
                  placeholder={item.msrp.toFixed(2)}
                  className="w-full pl-7 pr-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
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
                  className="w-full pl-7 pr-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* Sale Dates */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] text-zinc-500 font-medium block mb-1">
                    Sale Start Date
                  </label>
                  <input
                    type="date"
                    value={saleStartDate}
                    onChange={(e) => setSaleStartDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-zinc-500 font-medium block mb-1">
                    Sale End Date
                  </label>
                  <input
                    type="date"
                    value={saleEndDate}
                    onChange={(e) => setSaleEndDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Live Tag Preview Card */}
          <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <span className="text-[11px] uppercase font-bold text-zinc-400 tracking-wider">
              Live Shelf Tag Preview
            </span>
            <div className="flex justify-center p-3 bg-zinc-100 dark:bg-zinc-800/60 rounded-2xl border border-zinc-200 dark:border-zinc-700/60">
              <PriceTagCard item={previewItem} />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-800/40 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
          {item.hasStorePrice ? (
            <button
              type="button"
              disabled={isPending}
              onClick={handleResetToMSRP}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
            >
              Reset to MSRP Guidance
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isPending || !isValidRegular}
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-all shadow-sm flex items-center gap-2"
            >
              {isPending ? "Saving..." : "Save Store Price"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
