"use client";

import React, { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  StorePricingDashboardData,
  StoreProductTagItem,
  PHYSICAL_PRICE_TAG_DIMENSIONS,
} from "@/lib/retailer/store-pricing-types";
import { PriceTagCard } from "@/components/retailer/price-tag-card";
import { PriceTagModal } from "@/components/retailer/price-tag-modal";
import {
  savePriceTagForNiimbot,
  copyPriceTagImageToClipboard,
} from "@/lib/retailer/niimbot-export";

interface PriceTagsDashboardProps {
  data: StorePricingDashboardData;
}

export function PriceTagsDashboard({ data }: PriceTagsDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const {
    canEditPrice,
    userRole,
    isAllStores,
    selectedStoreId,
    selectedStoreName,
    stores,
    products,
    totalAssortmentCount,
    pricedProductsCount,
    onSaleProductsCount,
    incomingProductsCount,
    unpricedProductsCount,
  } = data;

  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<string>("all");
  const [editingItem, setEditingItem] = useState<StoreProductTagItem | null>(null);
  const [previewingItem, setPreviewingItem] = useState<StoreProductTagItem | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Store selection choice modal for All Stores mode
  const [storeChoiceModalItem, setStoreChoiceModalItem] = useState<StoreProductTagItem | null>(null);
  const [storeChoiceAction, setStoreChoiceAction] = useState<"edit" | "preview">("edit");

  const isEmployee = userRole === "employee";

  const getQty = (productId: string) => quantities[productId] || 1;
  const updateQty = (productId: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[productId] || 1;
      const next = Math.max(1, Math.min(50, current + delta));
      return { ...prev, [productId]: next };
    });
  };

  const handleStoreChange = (storeId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (storeId === "all") {
      params.set("store", "all");
    } else {
      params.set("store", storeId);
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleToggleSelect = (productId: string) => {
    if (isAllStores) return; // Batch print disabled in All Stores mode
    const next = new Set(selectedProductIds);
    if (next.has(productId)) {
      next.delete(productId);
    } else {
      next.add(productId);
    }
    setSelectedProductIds(next);
  };

  const handleSelectAll = () => {
    if (isAllStores) return;
    if (selectedProductIds.size === filteredProducts.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(filteredProducts.map((p) => p.productId)));
    }
  };

  // Filtered products
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

    if (filterMode === "priced") return p.regularPrice !== null;
    if (filterMode === "unpriced" || filterMode === "msrp") return p.regularPrice === null;
    if (filterMode === "incoming") return p.tagStatus === "incoming";
    if (filterMode === "sale") return p.isSaleActive;

    return true;
  });

  const selectedPrintItems = products.filter((p) => selectedProductIds.has(p.productId));
  const totalLabelsToPrint = selectedPrintItems.reduce((acc, it) => acc + getQty(it.productId), 0);

  const handleExportSingleNiimbot = async (item: StoreProductTagItem) => {
    try {
      setIsExporting(true);
      setExportFeedback(null);
      const res = await savePriceTagForNiimbot(item);
      if (res.success) {
        setExportFeedback("📱 50×30mm label exported! Open NIIMBOT app → 50×30mm roll → Tap Image to print.");
      }
    } catch (err: any) {
      setExportFeedback("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyClipboard = async (item: StoreProductTagItem) => {
    try {
      const ok = await copyPriceTagImageToClipboard(item);
      if (ok) {
        setExportFeedback("📋 Label image copied to clipboard!");
      } else {
        setExportFeedback("Clipboard not supported in this browser. Please use 'Save Label'.");
      }
    } catch {
      setExportFeedback("Failed to copy image.");
    }
  };

  const triggerBrowserPrint = () => {
    window.print();
  };

  const handleActionClick = (item: StoreProductTagItem, action: "edit" | "preview") => {
    if (isAllStores) {
      setStoreChoiceAction(action);
      setStoreChoiceModalItem(item);
    } else {
      if (action === "edit") {
        setEditingItem(item);
      } else {
        setPreviewingItem(item);
        setExportFeedback(null);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              Price Tags & Shelf Labels
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              🏷️ Store Pricing
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Store-specific shelf price labels for NIIMBOT B1 thermal printers and POS fixture sheets.
          </p>
        </div>

        {/* Global Controls: Button-based Store Selector & Batch Print */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Button-based Segmented Store Selector */}
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700/60 overflow-x-auto max-w-full no-scrollbar">
            {stores.length > 1 && (
              <button
                type="button"
                onClick={() => handleStoreChange("all")}
                disabled={isPending}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isAllStores
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                🏢 All Stores
              </button>
            )}

            {stores.map((s) => {
              const isSelected = !isAllStores && selectedStoreId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleStoreChange(s.id)}
                  disabled={isPending}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                >
                  🏪 {s.name}
                </button>
              );
            })}
          </div>

          {/* Batch Print Button */}
          <button
            onClick={() => {
              if (isAllStores) return;
              setIsPrintModalOpen(true);
            }}
            disabled={selectedProductIds.size === 0 || isAllStores}
            title={isAllStores ? "Please select a specific store to print shelf labels" : undefined}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-40 transition-all shadow-sm flex items-center gap-2 cursor-pointer"
          >
            🖨️ Print Selected ({selectedProductIds.size})
          </button>
        </div>
      </div>

      {/* Info & Fixture Dimension Banner */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-purple-50/50 via-zinc-50 to-zinc-50 dark:from-purple-950/30 dark:via-zinc-900/60 dark:to-zinc-900/60 p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-zinc-900 dark:text-white">
              📍 Location: {selectedStoreName}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-semibold">
              {PHYSICAL_PRICE_TAG_DIMENSIONS.labelName}
            </span>
            {isAllStores && (
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold">
                Overview & Comparison Mode
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {isAllStores
              ? "Displaying union of assortment products across all authorized stores. Select a specific store to edit pricing or print labels."
              : "50mm × 30mm thermal shelf tags with canonical product QR codes. Compatible with NIIMBOT B1 thermal printers and POS sheets."}
          </p>
        </div>

        {/* Stats snapshot */}
        <div className="flex items-center gap-3 sm:gap-4 text-xs font-semibold text-zinc-600 dark:text-zinc-300 flex-wrap">
          <div>
            <span className="text-zinc-400">Total: </span>
            <span className="font-bold text-zinc-900 dark:text-white">{totalAssortmentCount} SKUs</span>
          </div>
          <span>•</span>
          <div>
            <span className="text-zinc-400">Priced: </span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{pricedProductsCount}</span>
          </div>
          <span>•</span>
          <div>
            <span className="text-zinc-400">Needs Price: </span>
            <span className="font-bold text-amber-600 dark:text-amber-400">{unpricedProductsCount}</span>
          </div>
          <span>•</span>
          <div>
            <span className="text-zinc-400">Incoming: </span>
            <span className="font-bold text-blue-600 dark:text-blue-400">{incomingProductsCount}</span>
          </div>
          <span>•</span>
          <div>
            <span className="text-zinc-400">On Sale: </span>
            <span className="font-bold text-rose-600 dark:text-rose-400">{onSaleProductsCount}</span>
          </div>
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
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
          />
          <span className="absolute left-3 top-2.5 text-zinc-400 text-xs">🔍</span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: "all", label: `All (${products.length})` },
            { id: "priced", label: `Priced (${pricedProductsCount})` },
            { id: "unpriced", label: `Needs Price (${unpricedProductsCount})` },
            { id: "incoming", label: `Incoming (${incomingProductsCount})` },
            { id: "sale", label: `On Sale (${onSaleProductsCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterMode(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filterMode === tab.id
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Product List / Table */}
      {filteredProducts.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl mx-auto">
            🏷️
          </div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
            No products found matching filters
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
            All qualifying store assortment items and ordered products appear here automatically.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/40 text-zinc-500 dark:text-zinc-400 font-semibold">
                    <th className="py-3.5 pl-4 pr-2 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          selectedProductIds.size === filteredProducts.length &&
                          filteredProducts.length > 0 &&
                          !isAllStores
                        }
                        onChange={handleSelectAll}
                        disabled={isAllStores}
                        className="rounded border-zinc-300 text-purple-600 focus:ring-purple-500 disabled:opacity-30"
                      />
                    </th>
                    <th className="py-3.5 px-3">Product</th>
                    {!isEmployee && (
                      <th className="py-3.5 px-3 text-right">Wholesale Cost</th>
                    )}
                    <th className="py-3.5 px-3 text-right">Suggested MSRP</th>
                    <th className="py-3.5 px-3 text-right">Store Regular</th>
                    <th className="py-3.5 px-3 text-right">Sale / Promo</th>
                    <th className="py-3.5 px-3 text-center">Status</th>
                    {!isAllStores && (
                      <th className="py-3.5 px-3 text-center w-24">Facings</th>
                    )}
                    <th className="py-3.5 pl-3 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                  {filteredProducts.map((p) => {
                    const isSelected = selectedProductIds.has(p.productId);
                    const qty = getQty(p.productId);

                    return (
                      <tr
                        key={p.productId}
                        className={`hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors ${
                          isSelected ? "bg-purple-50/30 dark:bg-purple-950/20" : ""
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3.5 pl-4 pr-2 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(p.productId)}
                            disabled={isAllStores}
                            className="rounded border-zinc-300 text-purple-600 focus:ring-purple-500 disabled:opacity-30"
                          />
                        </td>

                        {/* Product Info */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-700/60">
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
                              <div className="font-bold text-zinc-900 dark:text-white truncate max-w-xs">
                                {p.productName}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                                <span>{p.brandName}</span>
                                <span>•</span>
                                <span className="font-mono">{p.sku}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Wholesale Cost (Privileged roles only) */}
                        {!isEmployee && (
                          <td className="py-3.5 px-3 text-right whitespace-nowrap">
                            {typeof p.wholesalePrice === "number" && p.wholesalePrice > 0 ? (
                              <div title={p.wholesaleCostLabel || undefined} className="cursor-help">
                                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                                  ${p.wholesalePrice.toFixed(2)}
                                </span>
                                {p.wholesaleCostSource === "invoice" && (
                                  <span className="block text-[9px] text-zinc-400 font-normal">Last Purchase</span>
                                )}
                                {p.wholesaleCostSource === "order" && (
                                  <span className="block text-[9px] text-zinc-400 font-normal">Last Order</span>
                                )}
                                {p.wholesaleCostSource === "curation" && (
                                  <span className="block text-[9px] text-zinc-400 font-normal">Catalog</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-zinc-400" title="Cost Not Available">—</span>
                            )}
                          </td>
                        )}

                        {/* Suggested MSRP */}
                        <td className="py-3.5 px-3 text-right whitespace-nowrap">
                          {p.hasMsrp ? (
                            <span className="font-semibold text-zinc-900 dark:text-zinc-200">
                              ${p.msrp.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-[11px] text-zinc-400">—</span>
                          )}
                        </td>

                        {/* Store Regular Price & Gross Margin */}
                        <td className="py-3.5 px-3 text-right whitespace-nowrap">
                          {isAllStores ? (
                            /* All Stores Mode: Store-by-Store price breakdown */
                            <div className="space-y-1">
                              {p.storeBreakdowns && p.storeBreakdowns.length > 0 ? (
                                <div className="flex flex-col items-end gap-1">
                                  {p.storeBreakdowns.map((b) => (
                                    <div
                                      key={b.storeId}
                                      className="text-[11px] flex items-center justify-end gap-1.5"
                                    >
                                      <span className="text-[10px] text-zinc-400 font-medium truncate max-w-[90px]">
                                        {b.storeName}:
                                      </span>
                                      <span className="font-bold text-zinc-800 dark:text-zinc-200 font-mono">
                                        {b.regularPrice ? `${b.regularPrice.toFixed(2)}${b.isMsrpDefault ? " (MSRP)" : ""}` : "Set Price"}
                                      </span>
                                      {!isEmployee && b.regularGrossProfit !== null && (
                                        <span
                                          className={`text-[10px] font-semibold ${
                                            b.regularGrossProfit < 0
                                              ? "text-rose-600 dark:text-rose-400 font-bold"
                                              : "text-emerald-600 dark:text-emerald-400"
                                          }`}
                                          title={`GP: $${b.regularGrossProfit.toFixed(2)} (${b.regularGrossMarginPercent}%)`}
                                        >
                                          ({b.regularGrossMarginPercent}%)
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-zinc-400">—</span>
                              )}
                            </div>
                          ) : (
                            /* Single Store Mode */
                            <div>
                              {p.regularPrice !== null ? (
                                <div>
                                  <div className="flex items-center justify-end gap-1.5">
                                    <span className="font-bold text-zinc-900 dark:text-white">
                                      ${p.regularPrice.toFixed(2)}
                                    </span>
                                    {p.isMsrpDefault ? (
                                      <span
                                        className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                                        title="Store regular price automatically initialized from Suggested MSRP"
                                      >
                                        MSRP Default
                                      </span>
                                    ) : (
                                      <span
                                        className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                                        title="Explicit Store Price override"
                                      >
                                        Store Price
                                      </span>
                                    )}
                                  </div>
                                  {!isEmployee && p.regularGrossProfit !== null && (
                                    <div
                                      className={`text-[10px] font-semibold flex items-center justify-end gap-1 ${
                                        p.regularGrossProfit < 0
                                          ? "text-rose-600 dark:text-rose-400 font-bold"
                                          : "text-emerald-600 dark:text-emerald-400"
                                      }`}
                                      title={`Gross Profit: ${p.regularGrossProfit.toFixed(2)} | Gross Margin: ${p.regularGrossMarginPercent}% (Margin = GP / Regular Price)`}
                                    >
                                      <span>GP ${p.regularGrossProfit.toFixed(2)}</span>
                                      <span>(${p.regularGrossMarginPercent}%)</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                    ⚠️ Set Price
                                  </span>
                                  <span className="block text-[9px] text-zinc-400">
                                    MSRP Not Available
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Sale Price & Sale Margin */}
                        <td className="py-3.5 px-3 text-right whitespace-nowrap">
                          {p.isSaleActive && p.salePrice ? (
                            <div>
                              <div className="font-bold text-rose-600 dark:text-rose-400">
                                ${p.salePrice.toFixed(2)}
                              </div>
                              {p.discountPercent !== null && (
                                <span className="block text-[10px] text-rose-500 font-extrabold">
                                  Save {p.discountPercent}%
                                </span>
                              )}
                              {!isEmployee && p.saleGrossProfit !== null && (
                                <div
                                  className={`text-[10px] font-semibold flex items-center justify-end gap-1 ${
                                    p.saleGrossProfit < 0
                                      ? "text-rose-600 dark:text-rose-400 font-bold"
                                      : "text-emerald-600 dark:text-emerald-400"
                                  }`}
                                  title={`Sale Gross Profit: $${p.saleGrossProfit.toFixed(2)} | Sale Margin: ${p.saleGrossMarginPercent}%`}
                                >
                                  <span>GP ${p.saleGrossProfit.toFixed(2)}</span>
                                  <span>({p.saleGrossMarginPercent}%)</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>

                        {/* Tag & Fulfillment Status */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <div className="flex flex-col items-center gap-1">
                            {p.tagStatus === "incoming" ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                📦 INCOMING
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                ✓ IN STOCK
                              </span>
                            )}

                            {p.isSaleActive ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                                🔥 SALE
                              </span>
                            ) : !p.hasStorePrice ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                                MSRP GUIDANCE
                              </span>
                            ) : null}
                          </div>
                        </td>

                        {/* Quantity Stepper (Single store only) */}
                        {!isAllStores && (
                          <td className="py-3.5 px-3 text-center whitespace-nowrap">
                            <div className="inline-flex items-center border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
                              <button
                                type="button"
                                onClick={() => updateQty(p.productId, -1)}
                                className="px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold cursor-pointer"
                              >
                                -
                              </button>
                              <span className="px-2.5 py-1 text-xs font-bold text-zinc-900 dark:text-white min-w-[24px]">
                                {qty}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQty(p.productId, 1)}
                                className="px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </td>
                        )}

                        {/* Actions */}
                        <td className="py-3.5 pl-3 pr-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleActionClick(p, "preview")}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
                            >
                              📱 Preview & Print
                            </button>

                            {canEditPrice && (
                              <button
                                onClick={() => handleActionClick(p, "edit")}
                                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60 transition-colors cursor-pointer"
                              >
                                ✏️ Edit Price
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Product Cards */}
          <div className="block lg:hidden space-y-3">
            {filteredProducts.map((p) => {
              const isSelected = selectedProductIds.has(p.productId);
              const qty = getQty(p.productId);

              return (
                <div
                  key={p.productId}
                  className={`rounded-2xl border p-4 shadow-sm space-y-3 transition-colors ${
                    isSelected
                      ? "border-purple-300 dark:border-purple-800 bg-purple-50/20 dark:bg-purple-950/20"
                      : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {!isAllStores && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(p.productId)}
                        className="mt-1 rounded border-zinc-300 text-purple-600 focus:ring-purple-500"
                      />
                    )}

                    <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-700/60">
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
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        {p.tagStatus === "incoming" ? (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200">
                            📦 INCOMING
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200">
                            ✓ IN STOCK
                          </span>
                        )}
                        {p.isSaleActive && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-200">
                            🔥 SALE
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-sm text-zinc-900 dark:text-white truncate">
                        {p.productName}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                        <span>{p.brandName}</span>
                        <span>•</span>
                        <span className="font-mono">{p.sku}</span>
                      </div>
                    </div>
                  </div>

                  {/* Price display row & Gross Margin */}
                  <div className="grid grid-cols-2 gap-2 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-3 text-xs">
                    <div>
                      <span className="text-[10px] text-zinc-400 uppercase font-semibold">
                        {isAllStores ? "Store Prices" : "Store Regular"}
                      </span>
                      <div className="font-bold text-zinc-900 dark:text-white mt-0.5">
                        {isAllStores ? (
                          <div className="space-y-1">
                            {p.storeBreakdowns?.map((b) => (
                              <div key={b.storeId} className="text-[10px] text-zinc-600 dark:text-zinc-300">
                                {b.storeName}: <strong>{b.regularPrice ? `${b.regularPrice.toFixed(2)}${b.isMsrpDefault ? " (MSRP)" : ""}` : "Set Price"}</strong>
                                {!isEmployee && b.regularGrossMarginPercent !== null && (
                                  <span className="text-emerald-600 dark:text-emerald-400 ml-1">
                                    ({b.regularGrossMarginPercent}%)
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : p.regularPrice !== null ? (
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span>${p.regularPrice.toFixed(2)}</span>
                              {p.isMsrpDefault ? (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200">
                                  MSRP Default
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                  Store Price
                                </span>
                              )}
                            </div>
                            {!isEmployee && p.regularGrossProfit !== null && (
                              <span
                                className={`text-[10px] font-semibold ${
                                  p.regularGrossProfit < 0
                                    ? "text-rose-600 dark:text-rose-400 font-bold"
                                    : "text-emerald-600 dark:text-emerald-400"
                                }`}
                              >
                                GP ${p.regularGrossProfit.toFixed(2)} (${p.regularGrossMarginPercent}%)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">
                            ⚠️ Set Price (MSRP Not Available)
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-zinc-400 uppercase font-semibold">Sale / Promo</span>
                      <div className="font-bold mt-0.5">
                        {p.isSaleActive && p.salePrice ? (
                          <div>
                            <span className="text-rose-600 dark:text-rose-400">
                              ${p.salePrice.toFixed(2)} ({p.discountPercent}% OFF)
                            </span>
                            {!isEmployee && p.saleGrossProfit !== null && (
                              <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                GP ${p.saleGrossProfit.toFixed(2)} ({p.saleGrossMarginPercent}%)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quantity & Actions row */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    {!isAllStores ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase">Tags:</span>
                        <div className="inline-flex items-center border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
                          <button
                            type="button"
                            onClick={() => updateQty(p.productId, -1)}
                            className="px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold"
                          >
                            -
                          </button>
                          <span className="px-2.5 py-1 text-xs font-bold text-zinc-900 dark:text-white min-w-[20px] text-center">
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQty(p.productId, 1)}
                            className="px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-zinc-400">Available in {p.storesAvailableCount} stores</span>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleActionClick(p, "preview")}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 cursor-pointer"
                      >
                        📱 Print Tag
                      </button>

                      {canEditPrice && (
                        <button
                          onClick={() => handleActionClick(p, "edit")}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600 text-white cursor-pointer"
                        >
                          ✏️ Edit Price
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Store Choice Modal (when initiating Edit or Preview from All Stores mode) */}
      {storeChoiceModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                Select Store Location
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Choose a store location to {storeChoiceAction === "edit" ? "edit the selling price for" : "print labels for"}{" "}
                <strong className="text-zinc-800 dark:text-zinc-200">{storeChoiceModalItem.productName}</strong>.
              </p>
            </div>

            <div className="space-y-2">
              {stores.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    const item = storeChoiceModalItem;
                    const action = storeChoiceAction;
                    setStoreChoiceModalItem(null);
                    handleStoreChange(st.id);
                    if (action === "edit") {
                      setEditingItem(item);
                    } else {
                      setPreviewingItem(item);
                    }
                  }}
                  className="w-full text-left p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-purple-50 hover:border-purple-300 dark:hover:bg-purple-950/40 text-xs font-semibold text-zinc-900 dark:text-white flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span>🏪 {st.name}</span>
                  <span className="text-purple-600 dark:text-purple-400">Select →</span>
                </button>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setStoreChoiceModalItem(null)}
                className="text-xs text-zinc-500 hover:underline cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Price Modal */}
      {editingItem && (
        <PriceTagModal
          item={editingItem}
          storeId={selectedStoreId === "all" && stores.length > 0 ? stores[0].id : selectedStoreId}
          storeName={selectedStoreId === "all" && stores.length > 0 ? stores[0].name : selectedStoreName}
          isOpen={!!editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={() => {
            startTransition(() => {
              router.refresh();
            });
          }}
        />
      )}

      {/* Single Product Preview & Export Modal */}
      {previewingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Shelf Tag Preview (50×30mm)
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  📍 {selectedStoreName} • {previewingItem.brandName} {previewingItem.sku}
                </p>
              </div>
              <button
                onClick={() => setPreviewingItem(null)}
                className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {exportFeedback && (
                <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-xs font-semibold text-purple-700 dark:text-purple-300">
                  {exportFeedback}
                </div>
              )}

              {/* Tag Component Render */}
              <div className="flex justify-center p-6 rounded-2xl bg-zinc-100 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700">
                <PriceTagCard item={previewingItem} scale={1.0} />
              </div>

              {/* Tag specs & Instructions */}
              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 p-4 space-y-2 text-xs">
                <div className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <span>📱</span>
                  <span>How to print on NIIMBOT B1:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-zinc-600 dark:text-zinc-400 text-[11px] leading-relaxed">
                  <li>Tap <strong>Save Label (50×30mm Image)</strong> below to download the tag image.</li>
                  <li>Open the official <strong>NIIMBOT</strong> smartphone app via Bluetooth.</li>
                  <li>Select label size <strong>50 × 30 mm</strong> and tap <strong>Image / Picture</strong>.</li>
                  <li>Select the saved image and tap <strong>Print</strong>.</li>
                </ol>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 bg-zinc-50/50 dark:bg-zinc-900/50">
              <button
                type="button"
                onClick={() => handleCopyClipboard(previewingItem)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 cursor-pointer"
              >
                📋 Copy Image
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewingItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleExportSingleNiimbot(previewingItem)}
                  disabled={isExporting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  <span>💾</span>
                  <span>Save Label Image</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Print Modal */}
      {isPrintModalOpen && !isAllStores && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-4xl rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Batch Print Shelf Labels ({totalLabelsToPrint} tags)
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  📍 {selectedStoreName} • {selectedPrintItems.length} SKUs selected
                </p>
              </div>
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Printable Sheet View */}
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between text-xs text-zinc-500 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <span>Print-Ready 50mm × 30mm Fixture Grid</span>
                <span className="font-semibold text-purple-600 dark:text-purple-400">
                  {totalLabelsToPrint} labels total
                </span>
              </div>

              {/* Print Grid */}
              <div
                id="batch-price-tags-print-container"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 bg-zinc-100 dark:bg-zinc-950/60 rounded-2xl border border-zinc-200 dark:border-zinc-800"
              >
                {selectedPrintItems.map((item) => {
                  const qty = getQty(item.productId);
                  return Array.from({ length: qty }).map((_, idx) => (
                    <div
                      key={`${item.productId}-${idx}`}
                      className="flex justify-center p-2 bg-white dark:bg-zinc-900 rounded-xl shadow-xs border border-zinc-200 dark:border-zinc-800"
                    >
                      <PriceTagCard item={item} scale={0.9} />
                    </div>
                  ));
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
              <p className="text-xs text-zinc-500">
                Use your browser print dialog to print to your desktop label roll or standard sheet.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={triggerBrowserPrint}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  🖨️ Print Fixture Sheet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
