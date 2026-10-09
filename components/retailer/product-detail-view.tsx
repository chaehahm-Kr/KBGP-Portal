"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useCart } from "@/components/retailer/cart-context";
import { RetailerProductDetail } from "@/lib/retailer/products";
import {
  resolveRetailerSalesPolicy,
  calculateApplicablePrice,
  isValidMoqOrderQuantity,
} from "@/lib/product/retailer-policy";

interface ProductDetailViewProps {
  product: RetailerProductDetail;
}

export function RetailerProductDetailView({ product }: ProductDetailViewProps) {
  const { addItem } = useCart();
  
  // Resolve Sales Policy
  const policy = useMemo(() => {
    return product.salesPolicy || resolveRetailerSalesPolicy(product);
  }, [product]);

  const moq = policy.moq > 0 ? policy.moq : Math.max(1, product.cartonPackQty || 1);
  const [orderQty, setOrderQty] = useState<number>(moq);
  const [rawQtyInput, setRawQtyInput] = useState<string>(moq.toString());
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [copiedSku, setCopiedSku] = useState(false);

  // Validate Quantity
  const parsedQty = parseInt(rawQtyInput, 10);
  const isQtyValid = !isNaN(parsedQty) && isValidMoqOrderQuantity(parsedQty, moq);

  // Live Price Calculation based on Policy and Quantity
  const livePriceResult = useMemo(() => {
    return calculateApplicablePrice(policy, isQtyValid ? parsedQty : moq);
  }, [policy, parsedQty, isQtyValid, moq]);

  const activeImage =
    product.images.length > 0
      ? product.images[selectedImageIndex]?.url || product.thumbnailUrl
      : null;

  const handleCopySku = () => {
    navigator.clipboard.writeText(product.sku);
    setCopiedSku(true);
    setTimeout(() => setCopiedSku(false), 2000);
  };

  const handleQtyChange = (valStr: string) => {
    setRawQtyInput(valStr);
    const parsed = parseInt(valStr, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setOrderQty(parsed);
    }
  };

  const handleStepQty = (delta: number) => {
    const current = isNaN(parsedQty) || parsedQty <= 0 ? moq : parsedQty;
    const next = Math.max(moq, current + delta * moq);
    setOrderQty(next);
    setRawQtyInput(next.toString());
  };

  const handleQuickSelect = (targetQty: number) => {
    setOrderQty(targetQty);
    setRawQtyInput(targetQty.toString());
  };

  const handleAddToCart = () => {
    if (!isQtyValid) return;
    addItem(
      {
        id: product.id,
        name: product.name,
        nameEn: product.nameEn,
        brandName: product.brandName,
        sku: product.sku,
        thumbnailUrl: product.thumbnailUrl,
        wholesalePrice: livePriceResult.effectiveUnitPrice,
        msrp: product.msrp,
        marginPercent: livePriceResult.retailerMarginPercent ?? product.marginPercent,
        cartonPackQty: moq,
      },
      parsedQty
    );
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

            {/* Category & Status Tag Overlay */}
            <div className="absolute top-4 left-4 flex flex-col gap-1.5 items-start">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white/90 dark:bg-zinc-900/90 text-zinc-800 dark:text-zinc-200 backdrop-blur-md shadow-xs border border-zinc-200/60 dark:border-zinc-700/60">
                {product.categoryLabel}
              </span>
              {product.isSoldOut && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-600 text-white shadow-xs">
                  품절 (Out of Stock)
                </span>
              )}
              {policy.hasActivePromo && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white shadow-xs">
                  🔥 Active Promotion
                </span>
              )}
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
                <div className="text-xs uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
                  <span>Wholesale B2B Price</span>
                  {policy.hasActivePromo && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                      Promo
                    </span>
                  )}
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white mt-0.5 flex items-baseline gap-1">
                  <span>
                    {livePriceResult.effectiveUnitPrice > 0
                      ? `$${livePriceResult.effectiveUnitPrice.toFixed(2)}`
                      : "Pricing on Request"}
                  </span>
                  <span className="text-xs font-normal text-zinc-400">/ EA</span>
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
                    {product.msrp > 0 ? `$${product.msrp.toFixed(2)}` : "—"}
                  </div>
                </div>

                {livePriceResult.retailerMarginPercent !== null && livePriceResult.retailerMarginPercent > 0 ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                    {livePriceResult.retailerMarginPercent}% Estimated Margin
                  </span>
                ) : (
                  <span className="text-xs text-zinc-400 font-medium">Margin: —</span>
                )}
              </div>
            </div>

            {/* Quantity Discount Tiers Table (Published Tiers Only) */}
            {policy.publishedTiers.length > 0 && (
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <span>📊</span> Quantity Discount Tiers (수량별 공급 단가)
                  </span>
                  <span className="text-[11px] text-zinc-400">Packs of {moq} units</span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase">
                        <th className="py-2 px-3">Order Quantity</th>
                        <th className="py-2 px-2 text-center">Batch Multiple</th>
                        <th className="py-2 px-2 text-center">Discount</th>
                        <th className="py-2 px-2 text-right">Unit Price</th>
                        <th className="py-2 px-3 text-right">Pack Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {policy.publishedTiers.map((t) => {
                        const isCurrentActive = isQtyValid && livePriceResult.appliedTierId === t.id && livePriceResult.appliedReason !== "promotion";
                        return (
                          <tr
                            key={t.id}
                            className={`transition-colors ${
                              isCurrentActive
                                ? "bg-indigo-50/80 dark:bg-indigo-950/40 font-bold"
                                : "hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30"
                            }`}
                          >
                            <td className="py-2 px-3 font-semibold text-zinc-800 dark:text-zinc-200">
                              {t.min_qty.toLocaleString()} units +
                            </td>
                            <td className="py-2 px-2 text-center font-mono text-zinc-500 dark:text-zinc-400">
                              {t.multiple}× MOQ
                            </td>
                            <td className="py-2 px-2 text-center">
                              {t.discount_percent > 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                                  {t.discount_percent}% OFF
                                </span>
                              ) : (
                                <span className="text-zinc-400 font-normal">Base</span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-bold text-zinc-900 dark:text-white">
                              ${t.unit_price.toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-zinc-600 dark:text-zinc-400">
                              ${(t.min_qty * t.unit_price).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Ordering MOQ & Case Pack Strip */}
            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-300">
              <div className="flex items-center gap-2">
                <span className="text-zinc-400">Order Multiple / MOQ:</span>
                <strong className="text-zinc-900 dark:text-white font-semibold">
                  최소 {moq}개 · {moq}개 단위 묶음 (Batch of {moq} units)
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

            {/* Quick Tier Selection Buttons */}
            {policy.publishedTiers.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 block">
                  Quick Select Quantity:
                </span>
                <div className="flex flex-wrap gap-2">
                  {policy.publishedTiers.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleQuickSelect(t.min_qty)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                        parsedQty === t.min_qty
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      }`}
                    >
                      {t.min_qty} units {t.discount_percent > 0 ? `(${t.discount_percent}% off)` : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Ordering Controls & Add to Cart */}
            {product.isSoldOut ? (
              <div className="pt-2 space-y-4">
                <div className="p-4 sm:p-5 rounded-2xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 space-y-3">
                  <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold text-sm">
                    <span className="text-base">🚨</span>
                    <span>현재 가용 재고가 소진되어 품절(Out of Stock) 상태입니다.</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/80 dark:bg-zinc-900/80 border border-rose-100 dark:border-rose-950 text-xs text-zinc-700 dark:text-zinc-300 space-y-1">
                    <div className="font-semibold text-zinc-900 dark:text-white">재입고 안내 (Restock Information):</div>
                    <div>
                      {product.restockEta ? (
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                          입고 예정일: {new Date(product.restockEta).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })} ({product.restockEta})
                        </span>
                      ) : (
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                          재입고 일정을 확인 중입니다. (재입고 일정 미정)
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled
                    className="w-full py-3.5 px-6 rounded-xl font-bold text-sm bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed text-center"
                  >
                    품절 (Out of Stock — 주문 불가)
                  </button>
                </div>
              </div>
            ) : product.isOrderable && product.wholesalePrice > 0 ? (
              <div className="pt-2 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800">
                  <div>
                    <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <span>Order Quantity</span>
                      <span className="text-[10px] font-normal text-zinc-500 dark:text-zinc-400">
                        (Multiple of {moq} units)
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Line Total:{" "}
                      <strong className="text-zinc-900 dark:text-white font-bold text-base font-mono">
                        ${isQtyValid ? livePriceResult.subtotal.toFixed(2) : "—"}
                      </strong>
                      {isQtyValid && (
                        <span className="text-[11px] text-zinc-400 ml-2">
                          (${livePriceResult.effectiveUnitPrice.toFixed(2)} × {parsedQty} units)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-2">
                    <div className="inline-flex items-center rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-1">
                      <button
                        type="button"
                        onClick={() => handleStepQty(-1)}
                        disabled={parsedQty <= moq}
                        className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={moq}
                        step={moq}
                        value={rawQtyInput}
                        onChange={(e) => handleQtyChange(e.target.value)}
                        className={`w-16 text-center font-bold font-mono text-sm bg-transparent border-0 focus:outline-hidden ${
                          !isQtyValid ? "text-rose-600 dark:text-rose-400 ring-2 ring-rose-500 rounded" : "text-zinc-900 dark:text-white"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => handleStepQty(1)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Validation Warning Banner if not a multiple */}
                {!isQtyValid && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                    <span className="font-bold text-sm">⚠️</span>
                    <span>
                      주문 수량은 최소 {moq}개 이상이며, <strong>{moq}개 단위의 배수</strong>({moq}, {moq * 2}, {moq * 3}...)여야 합니다.
                    </span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={!isQtyValid}
                    className={`flex-1 py-3.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      addedSuccess
                        ? "bg-emerald-600 text-white"
                        : "bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:opacity-95"
                    }`}
                  >
                    {addedSuccess ? (
                      <>
                        <span>✓</span>
                        <span>Added to Cart ({parsedQty} units)</span>
                      </>
                    ) : (
                      <>
                        <span>🛒</span>
                        <span>Add {isQtyValid ? `${parsedQty} units` : ""} to Cart</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-center text-xs text-zinc-500 dark:text-zinc-400">
                This item is currently not available for purchase.
              </div>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Product Description
              </h3>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </div>
          )}

          {/* Bullet Points */}
          {product.bulletPoints.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Highlights & Features
              </h3>
              <ul className="space-y-1.5">
                {product.bulletPoints.map((point, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-300"
                  >
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold shrink-0 mt-0.5">
                      ✓
                    </span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
