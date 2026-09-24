"use client";

import React, { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  StorePricingDashboardData,
  StoreProductTagItem,
  PHYSICAL_PRICE_TAG_DIMENSIONS,
} from "@/lib/retailer/store-pricing-types";
import { PriceTagCard } from "@/components/retailer/price-tag-card";
import { PriceTagModal } from "@/components/retailer/price-tag-modal";

interface PriceTagsDashboardProps {
  data: StorePricingDashboardData;
}

export function PriceTagsDashboard({ data }: PriceTagsDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const {
    canEditPrice,
    selectedStoreId,
    selectedStoreName,
    stores,
    products,
    totalAssortmentCount,
    pricedProductsCount,
    onSaleProductsCount,
  } = data;

  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<string>("all");
  const [editingItem, setEditingItem] = useState<StoreProductTagItem | null>(null);
  const [previewingItem, setPreviewingItem] = useState<StoreProductTagItem | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const handleStoreChange = (storeId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("store", storeId);
    startTransition(() => {
      router.push(`/retailer/tags?${params.toString()}`);
    });
  };

  const handleToggleSelect = (productId: string) => {
    const next = new Set(selectedProductIds);
    if (next.has(productId)) {
      next.delete(productId);
    } else {
      next.add(productId);
    }
    setSelectedProductIds(next);
  };

  const handleSelectAll = () => {
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

    if (filterMode === "priced") return p.hasStorePrice;
    if (filterMode === "msrp") return !p.hasStorePrice;
    if (filterMode === "sale") return p.isSaleActive;

    return true;
  });

  const selectedPrintItems = products.filter((p) => selectedProductIds.has(p.productId));

  const triggerBrowserPrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              Store Price Tags & Shelf Labels
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              🏷️ Store Pricing
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Manage store-specific regular and promotional selling prices, preview shelf tags, and batch print labels with canonical product QR codes.
          </p>
        </div>

        {/* Global Controls: Store Selector & Batch Print */}
        <div className="flex items-center gap-3 flex-wrap">
          {stores.length > 1 && (
            <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700/60">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 pl-2">Store:</span>
              <select
                value={selectedStoreId}
                onChange={(e) => handleStoreChange(e.target.value)}
                className="text-xs font-semibold bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-lg px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Batch Print Button */}
          <button
            onClick={() => setIsPrintModalOpen(true)}
            disabled={selectedProductIds.size === 0}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-40 transition-all shadow-sm flex items-center gap-2"
          >
            🖨️ Print Selected ({selectedProductIds.size})
          </button>
        </div>
      </div>

      {/* Info & Fixture Dimension Banner */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-purple-50/50 via-zinc-50 to-zinc-50 dark:from-purple-950/30 dark:via-zinc-900/60 dark:to-zinc-900/60 p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-900 dark:text-white">
              📍 Active Location: {selectedStoreName}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-semibold">
              {PHYSICAL_PRICE_TAG_DIMENSIONS.labelName}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Shelf tags include your store selling price and a canonical product QR. Customer scanning leads directly to public product authenticity details.
          </p>
        </div>

        {/* Stats snapshot */}
        <div className="flex items-center gap-4 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
          <div>
            <span className="text-zinc-400">Assortment: </span>
            <span className="font-bold text-zinc-900 dark:text-white">{totalAssortmentCount} SKUs</span>
          </div>
          <span>•</span>
          <div>
            <span className="text-zinc-400">Store Priced: </span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{pricedProductsCount}</span>
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
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <span className="absolute left-3 top-2.5 text-zinc-400 text-xs">🔍</span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: "all", label: `All (${products.length})` },
            { id: "priced", label: `Store Priced (${pricedProductsCount})` },
            { id: "sale", label: `On Sale (${onSaleProductsCount})` },
            { id: "msrp", label: `MSRP Guidance (${totalAssortmentCount - pricedProductsCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterMode(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
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
            No products found in this store assortment
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
            Ensure products are mapped to this store in retailer store products or have been ordered.
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
                          filteredProducts.length > 0
                        }
                        onChange={handleSelectAll}
                        className="rounded border-zinc-300 text-purple-600 focus:ring-purple-500"
                      />
                    </th>
                    <th className="py-3.5 px-3">Product</th>
                    <th className="py-3.5 px-3 text-right">Wholesale Cost</th>
                    <th className="py-3.5 px-3 text-right">Suggested MSRP</th>
                    <th className="py-3.5 px-3 text-right">Store Regular</th>
                    <th className="py-3.5 px-3 text-right">Sale / Promo</th>
                    <th className="py-3.5 px-3 text-center">Tag Status</th>
                    <th className="py-3.5 pl-3 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                  {filteredProducts.map((p) => {
                    const isSelected = selectedProductIds.has(p.productId);
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
                            className="rounded border-zinc-300 text-purple-600 focus:ring-purple-500"
                          />
                        </td>

                        {/* Product Info */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-3">
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

                        {/* Wholesale Cost */}
                        <td className="py-3.5 px-3 text-right font-medium text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                          ${p.wholesalePrice.toFixed(2)}
                        </td>

                        {/* Suggested MSRP */}
                        <td className="py-3.5 px-3 text-right font-semibold text-zinc-900 dark:text-zinc-200 whitespace-nowrap">
                          ${p.msrp.toFixed(2)}
                        </td>

                        {/* Store Regular Price */}
                        <td className="py-3.5 px-3 text-right whitespace-nowrap">
                          {p.hasStorePrice && p.regularPrice ? (
                            <span className="font-bold text-zinc-900 dark:text-white">
                              ${p.regularPrice.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-zinc-400 italic text-[11px]">
                              MSRP Default (${p.msrp.toFixed(2)})
                            </span>
                          )}
                        </td>

                        {/* Sale Price */}
                        <td className="py-3.5 px-3 text-right whitespace-nowrap">
                          {p.isSaleActive && p.salePrice ? (
                            <div className="space-y-0.5">
                              <span className="font-bold text-rose-600 dark:text-rose-400">
                                ${p.salePrice.toFixed(2)}
                              </span>
                              {p.discountPercent !== null && (
                                <span className="block text-[10px] text-rose-500 font-extrabold">
                                  Save {p.discountPercent}%
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>

                        {/* Tag Status */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          {p.isSaleActive ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                              🔥 SALE TAG
                            </span>
                          ) : p.hasStorePrice ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              ✓ STORE TAG
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                              MSRP GUIDANCE
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 pl-3 pr-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setPreviewingItem(p)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200"
                            >
                              👁️ Preview
                            </button>

                            {canEditPrice && (
                              <button
                                onClick={() => setEditingItem(p)}
                                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 hover:bg-purple-100 transition-colors"
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
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(p.productId)}
                      className="mt-1 rounded border-zinc-300 text-purple-600 focus:ring-purple-500"
                    />

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

                  {/* Price display row */}
                  <div className="grid grid-cols-2 gap-2 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-3 text-xs">
                    <div>
                      <span className="text-[10px] text-zinc-400 uppercase font-semibold">Store Regular</span>
                      <div className="font-bold text-zinc-900 dark:text-white mt-0.5">
                        {p.hasStorePrice && p.regularPrice ? `$${p.regularPrice.toFixed(2)}` : `$${p.msrp.toFixed(2)} (MSRP)`}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-zinc-400 uppercase font-semibold">Sale / Promo</span>
                      <div className="font-bold mt-0.5">
                        {p.isSaleActive && p.salePrice ? (
                          <span className="text-rose-600 dark:text-rose-400">
                            ${p.salePrice.toFixed(2)} ({p.discountPercent}% OFF)
                          </span>
                        ) : (
                          <span className="text-zinc-400">None</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => setPreviewingItem(p)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                    >
                      👁️ Preview Tag
                    </button>

                    {canEditPrice && (
                      <button
                        onClick={() => setEditingItem(p)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600 text-white"
                      >
                        ✏️ Edit Price
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Edit Price Modal */}
      {editingItem && (
        <PriceTagModal
          item={editingItem}
          storeId={selectedStoreId}
          storeName={selectedStoreName}
          isOpen={!!editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={() => {
            startTransition(() => {
              router.refresh();
            });
          }}
        />
      )}

      {/* Single Tag Preview Modal */}
      {previewingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-md rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Shelf Price Tag Preview
                </h3>
                <p className="text-[11px] text-zinc-400">
                  {PHYSICAL_PRICE_TAG_DIMENSIONS.labelName}
                </p>
              </div>
              <button
                onClick={() => setPreviewingItem(null)}
                className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex justify-center p-4 bg-zinc-100 dark:bg-zinc-800/60 rounded-2xl border border-zinc-200 dark:border-zinc-700/60">
              <PriceTagCard item={previewingItem} />
            </div>

            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 space-y-1">
              <div><strong>Canonical QR URL:</strong> <span className="font-mono text-[10px] break-all">{previewingItem.canonicalProductUrl}</span></div>
              <p className="text-[10px] text-zinc-400">Common public QR remains stable across all stores and price updates.</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                onClick={() => setPreviewingItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setSelectedProductIds(new Set([previewingItem.productId]));
                  setPreviewingItem(null);
                  setIsPrintModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 shadow-sm"
              >
                🖨️ Print This Tag
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Print Modal / Print Sheet */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div
            className="w-full max-w-3xl rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header (Hidden during actual window.print()) */}
            <div className="no-print px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Print Price Tags ({selectedPrintItems.length} Labels)
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  📍 {selectedStoreName} • Standard 2.25" × 1.25" Fixture Tag Format
                </p>
              </div>
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Printable Tags Grid */}
            <div className="p-6 overflow-y-auto print-area bg-zinc-100/60 dark:bg-zinc-950/60">
              <div className="flex flex-wrap gap-4 justify-center items-start">
                {selectedPrintItems.map((item) => (
                  <PriceTagCard key={item.productId} item={item} isPrintVersion={true} />
                ))}
              </div>
            </div>

            {/* Modal Footer (Hidden during actual window.print()) */}
            <div className="no-print px-6 py-4 bg-zinc-50 dark:bg-zinc-800/40 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <span className="text-xs text-zinc-500">
                Ready to print on standard shelf tag label sheets.
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  onClick={triggerBrowserPrint}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 shadow-sm flex items-center gap-1.5"
                >
                  🖨️ Open Print Dialog
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Print CSS to isolate .print-area */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .no-print,
          header,
          nav,
          aside {
            display: none !important;
          }
          .print-area,
          .print-area * {
            visibility: visible !important;
          }
          .print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
          }
          .print-tag-sheet {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin: 4px !important;
            display: inline-flex !important;
          }
        }
      `}</style>
    </div>
  );
}
