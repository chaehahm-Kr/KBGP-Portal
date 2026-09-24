"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/retailer/cart-context";
import { RetailerProductDetail } from "@/lib/retailer/products";

interface ProductDetailViewProps {
  product: RetailerProductDetail;
}

export function RetailerProductDetailView({ product }: ProductDetailViewProps) {
  const { addItem } = useCart();
  const moq = Math.max(1, product.cartonPackQty || 1);
  const [orderQty, setOrderQty] = useState(moq);
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [copiedSku, setCopiedSku] = useState(false);

  const activeImage =
    product.images.length > 0
      ? product.images[selectedImageIndex]?.url || product.thumbnailUrl
      : null;

  const handleCopySku = () => {
    navigator.clipboard.writeText(product.sku);
    setCopiedSku(true);
    setTimeout(() => setCopiedSku(false), 2000);
  };

  const handleAddToCart = () => {
    addItem(product, orderQty);
    setAddedSuccess(true);
    setTimeout(() => setAddedSuccess(false), 3000);
  };

  return (
    <div className="space-y-8">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <Link
          href="/products"
          className="hover:text-zinc-900 dark:hover:text-white transition-colors flex items-center gap-1 font-medium"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
            />
          </svg>
          Products
        </Link>
        <span>/</span>
        <span className="text-zinc-400 dark:text-zinc-600">{product.brandName}</span>
        <span>/</span>
        <span className="text-zinc-900 dark:text-white font-medium truncate max-w-[200px] sm:max-w-md">
          {product.name}
        </span>
      </nav>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Left Column: Image Gallery (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Main Showcase Image */}
          <div className="relative aspect-square w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden flex items-center justify-center p-6 shadow-xs">
            {activeImage ? (
              <img
                src={activeImage}
                alt={product.name}
                className="w-full h-full object-contain object-center transition-all duration-300"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-600 gap-3">
                <svg
                  className="w-16 h-16 stroke-current opacity-30"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                  />
                </svg>
                <span className="text-xs font-medium">No packshot available</span>
              </div>
            )}

            {/* Category Tag Overlay */}
            <div className="absolute top-4 left-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white/90 dark:bg-zinc-900/90 text-zinc-800 dark:text-zinc-200 backdrop-blur-md shadow-xs border border-zinc-200/60 dark:border-zinc-700/60">
                {product.categoryLabel}
              </span>
            </div>
          </div>

          {/* Thumbnail Gallery Carousel */}
          {product.images.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
              {product.images.map((img, idx) => {
                const isSelected = selectedImageIndex === idx;
                return (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`relative w-18 h-18 rounded-xl border-2 overflow-hidden shrink-0 bg-white dark:bg-zinc-900 p-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? "border-indigo-600 dark:border-indigo-400 ring-2 ring-indigo-500/20"
                        : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={img.url}
                      alt={`${product.name} thumbnail ${idx + 1}`}
                      className="w-full h-full object-contain"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Commercial & Product Details (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Header & Badges */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                {product.brandName}
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">•</span>
              <button
                type="button"
                onClick={handleCopySku}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md cursor-pointer"
                title="Click to copy SKU"
              >
                <span>SKU: {product.sku}</span>
                <span className="text-[10px] text-zinc-400">{copiedSku ? "✓ Copied" : "📋"}</span>
              </button>
              {product.origin && (
                <>
                  <span className="text-zinc-300 dark:text-zinc-700">•</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Origin: {product.origin}
                  </span>
                </>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight leading-snug">
              {product.name}
            </h1>

            {product.nameEn && product.nameEn !== product.name && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-normal">
                {product.nameEn}
              </p>
            )}
          </div>

          {/* Commercial Pricing Card */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-950 p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Wholesale Price */}
              <div>
                <div className="text-xs uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500">
                  Wholesale B2B Price
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white mt-0.5">
                  {product.wholesalePrice > 0
                    ? `$${product.wholesalePrice.toFixed(2)}`
                    : "Pricing on Request"}
                </div>
                <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                  Per single unit • Excl. local sales taxes
                </div>
              </div>

              {/* Retail MSRP & Margin */}
              <div className="flex items-center sm:flex-col sm:items-end gap-3 sm:gap-1">
                <div className="text-right">
                  <div className="text-xs uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500">
                    MSRP (Suggested Retail)
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-zinc-700 dark:text-zinc-300">
                    {product.msrp > 0 ? `$${product.msrp.toFixed(2)}` : "-"}
                  </div>
                </div>

                {product.marginPercent > 0 && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                    {product.marginPercent}% Estimated Margin
                  </span>
                )}
              </div>
            </div>

            {/* Ordering MOQ & Case Pack Strip */}
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-300">
              <div className="flex items-center gap-2">
                <span className="text-zinc-400">Order Multiple / MOQ:</span>
                <strong className="text-zinc-900 dark:text-white font-semibold">
                  {product.cartonPackQty} units per master carton
                </strong>
              </div>
              {product.volume && (
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400">Volume:</span>
                  <strong className="text-zinc-900 dark:text-white font-semibold">
                    {product.volume}
                  </strong>
                </div>
              )}
            </div>

            {/* Ordering Controls & Add to Cart */}
            <div className="pt-2 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800">
                <div>
                  <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                    <span>Order Quantity</span>
                    <span className="text-[10px] font-normal text-zinc-500 dark:text-zinc-400">
                      (Multiple of {moq})
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Line Total:{" "}
                    <strong className="text-zinc-900 dark:text-white font-bold text-sm">
                      ${(orderQty * product.wholesalePrice).toFixed(2)}
                    </strong>
                  </div>
                </div>

                {/* Quantity Stepper */}
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-1">
                    <button
                      type="button"
                      onClick={() => setOrderQty((prev) => Math.max(moq, prev - moq))}
                      disabled={orderQty <= moq}
                      className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={orderQty}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val > 0) setOrderQty(val);
                      }}
                      onBlur={() => {
                        let val = Math.max(moq, orderQty);
                        const rem = val % moq;
                        if (rem !== 0) val = val + (moq - rem);
                        setOrderQty(val);
                      }}
                      className="w-14 text-center font-bold text-sm bg-transparent border-0 text-zinc-900 dark:text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setOrderQty((prev) => prev + moq)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 transition-colors"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className={`flex-1 py-3.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer ${
                    addedSuccess
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:opacity-95"
                  }`}
                >
                  {addedSuccess ? (
                    <>
                      <span>✓</span>
                      <span>Added to Cart ({orderQty} units)</span>
                    </>
                  ) : (
                    <>
                      <span>🛒</span>
                      <span>Add to Order Cart</span>
                    </>
                  )}
                </button>

                {addedSuccess && (
                  <Link
                    href="/cart"
                    className="py-3.5 px-6 rounded-xl font-bold text-sm bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>View Cart →</span>
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Key Bullet Points / Highlights */}
          {product.bulletPoints && product.bulletPoints.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
                Key Product Highlights
              </h3>
              <ul className="space-y-2 text-xs sm:text-sm text-zinc-600 dark:text-zinc-300">
                {product.bulletPoints.map((bp, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="text-emerald-500 font-bold mt-0.5">✓</span>
                    <span>{bp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Description */}
          {product.description && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
                Product Description
              </h3>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </div>
          )}

          {/* Specifications & Logistics Table */}
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
              Specifications & Logistics
            </h3>

            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
              <div className="grid grid-cols-3 p-3 bg-zinc-50/50 dark:bg-zinc-900/50">
                <span className="text-zinc-500 font-medium">Brand</span>
                <span className="col-span-2 text-zinc-900 dark:text-white font-semibold">
                  {product.brandName}
                </span>
              </div>
              <div className="grid grid-cols-3 p-3 bg-white dark:bg-zinc-900">
                <span className="text-zinc-500 font-medium">Category</span>
                <span className="col-span-2 text-zinc-900 dark:text-white">
                  {product.categoryLabel}
                </span>
              </div>
              <div className="grid grid-cols-3 p-3 bg-zinc-50/50 dark:bg-zinc-900/50">
                <span className="text-zinc-500 font-medium">Master SKU</span>
                <span className="col-span-2 text-zinc-900 dark:text-white font-mono">
                  {product.sku}
                </span>
              </div>
              {product.upc && (
                <div className="grid grid-cols-3 p-3 bg-white dark:bg-zinc-900">
                  <span className="text-zinc-500 font-medium">UPC Barcode</span>
                  <span className="col-span-2 text-zinc-900 dark:text-white font-mono">
                    {product.upc}
                  </span>
                </div>
              )}
              {product.ean && (
                <div className="grid grid-cols-3 p-3 bg-zinc-50/50 dark:bg-zinc-900/50">
                  <span className="text-zinc-500 font-medium">EAN Barcode</span>
                  <span className="col-span-2 text-zinc-900 dark:text-white font-mono">
                    {product.ean}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-3 p-3 bg-white dark:bg-zinc-900">
                <span className="text-zinc-500 font-medium">Country of Origin</span>
                <span className="col-span-2 text-zinc-900 dark:text-white">
                  {product.origin || "Republic of Korea"}
                </span>
              </div>
              <div className="grid grid-cols-3 p-3 bg-zinc-50/50 dark:bg-zinc-900/50">
                <span className="text-zinc-500 font-medium">Case Pack (Carton)</span>
                <span className="col-span-2 text-zinc-900 dark:text-white">
                  {product.cartonPackQty} units / carton
                </span>
              </div>
              {(product.packageDimensions.width ||
                product.packageDimensions.depth ||
                product.packageDimensions.height ||
                product.packageDimensions.weight) && (
                <div className="grid grid-cols-3 p-3 bg-white dark:bg-zinc-900">
                  <span className="text-zinc-500 font-medium">Package Dimensions & Weight</span>
                  <span className="col-span-2 text-zinc-900 dark:text-white">
                    {product.packageDimensions.width && product.packageDimensions.depth && product.packageDimensions.height
                      ? `${product.packageDimensions.width} × ${product.packageDimensions.depth} × ${product.packageDimensions.height} mm`
                      : "Standard retail packaging"}
                    {product.packageDimensions.weight ? ` • ${product.packageDimensions.weight}g` : ""}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
