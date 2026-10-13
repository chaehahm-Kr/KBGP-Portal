"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useCart } from "@/components/retailer/cart-context";
import { validateRetailerCartItemsAction } from "@/lib/retailer/purchase-limit-actions";
import { type RetailerPurchaseAllowance } from "@/lib/retailer/purchase-limits";
import { evaluateCartPromotionsAction } from "@/lib/retailer/promotion-actions";
import { type EvaluatePromotionResult } from "@/lib/retailer/promotion-types";

export function RetailerCartView() {
  const {
    items,
    subtotal,
    totalUnits,
    totalSkus,
    couponCode,
    setCouponCode,
    updateQuantity,
    removeItem,
    clearCart,
    isLoading,
  } = useCart();

  const [allowances, setAllowances] = useState<Record<string, RetailerPurchaseAllowance>>({});
  const [productThumbnails, setProductThumbnails] = useState<Record<string, string | null>>({});
  const [isValidating, setIsValidating] = useState(false);

  // Promotion states
  const [inputCode, setInputCode] = useState("");
  const [promoEvaluation, setPromoEvaluation] = useState<EvaluatePromotionResult | null>(null);
  const [isEvaluatingPromo, setIsEvaluatingPromo] = useState(false);
  const [promoFeedbackMessage, setPromoFeedbackMessage] = useState<string | null>(null);
  const [promoFeedbackType, setPromoFeedbackType] = useState<"error" | "success">("error");

  // Validate live stock, account allowances, and resolve authoritative images
  const validateCartItems = useCallback(async (productIds: string[]) => {
    if (!productIds || productIds.length === 0) {
      setAllowances({});
      setProductThumbnails({});
      return;
    }

    setIsValidating(true);
    try {
      const res = await validateRetailerCartItemsAction(productIds);
      if (res.success) {
        if (res.allowances) setAllowances(res.allowances);
        if (res.thumbnails) setProductThumbnails(res.thumbnails);
      }
    } catch (err) {
      console.error("[RetailerCartView] Cart validation failed:", err);
    } finally {
      setIsValidating(false);
    }
  }, []);

  useEffect(() => {
    if (items.length > 0) {
      const ids = items.map((i) => i.productId);
      validateCartItems(ids);
    } else {
      setAllowances({});
      setProductThumbnails({});
    }
  }, [items, validateCartItems]);

  // Evaluate promotions whenever items or couponCode change
  useEffect(() => {
    if (items.length === 0) {
      setPromoEvaluation(null);
      return;
    }

    let isCurrent = true;
    setIsEvaluatingPromo(true);

    evaluateCartPromotionsAction(
      items.map((i) => ({
        productId: i.productId,
        wholesalePrice: i.wholesalePrice,
        quantity: i.quantity,
        lineTotal: i.lineTotal,
        discountPercent: i.discountPercent,
        appliedReason: i.appliedReason,
      })),
      couponCode
    )
      .then((res) => {
        if (isCurrent) {
          setPromoEvaluation(res);
          if (couponCode && !res.isValid) {
            setPromoFeedbackType("error");
            setPromoFeedbackMessage(res.errorReason || "Invalid promo code.");
          } else if (couponCode && res.isValid && res.appliedCoupon) {
            setPromoFeedbackType("success");
            setPromoFeedbackMessage(null);
          } else {
            setPromoFeedbackMessage(null);
          }
        }
      })
      .catch((err) => {
        if (isCurrent) {
          console.error("Cart promo evaluation error:", err);
        }
      })
      .finally(() => {
        if (isCurrent) setIsEvaluatingPromo(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [items, couponCode]);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputCode.trim().toUpperCase();
    if (!trimmed) return;
    setCouponCode(trimmed);
  };

  const handleRemoveCoupon = () => {
    setCouponCode(null);
    setInputCode("");
    setPromoFeedbackMessage(null);
  };

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

  // Check if any cart item violates stock or account limits
  const violations = items.map((item) => {
    const allowance = allowances[item.productId];
    const stock = allowance ? allowance.availableStock : (item.availableStock !== undefined ? item.availableStock : 999999);
    const overStock = item.quantity > stock;
    const overLimit = Boolean(allowance?.limitEnabled && item.quantity > allowance.remainingAllowance);
    return {
      productId: item.productId,
      overStock,
      overLimit,
      stock,
      allowance,
    };
  });

  const hasAnyViolation = violations.some((v) => v.overStock || v.overLimit);

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

      {/* Global Stock/Limit Warning Banner if violations exist */}
      {hasAnyViolation && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 text-amber-900 dark:text-amber-200 flex items-start gap-3 shadow-xs">
          <span className="text-lg shrink-0">⚠️</span>
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider">
              주문 수량 조정 필요 (Action Required Before Checkout)
            </h4>
            <p className="text-xs text-amber-800 dark:text-amber-300">
              장바구니에 담긴 일부 상품의 수량이 현재 가용 재고(Available Stock) 또는 계정 구매 한도(Account Purchase Limit)를 초과했습니다. 수량을 조정한 후 주문을 진행해주세요.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid: Items List + Summary Column */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Items List (8 cols on lg) */}
        <div className="lg:col-span-8 space-y-4">
          {items.map((item) => {
            const pack = Math.max(1, item.casePackQty || 1);
            const violation = violations.find((v) => v.productId === item.productId);
            const stock = violation?.stock ?? (item.availableStock !== undefined ? item.availableStock : 999999);
            const allowance = violation?.allowance;
            const isOverStock = violation?.overStock ?? false;
            const isOverLimit = violation?.overLimit ?? false;
            const effectiveMax = allowance
              ? Math.min(stock, allowance.remainingAllowance)
              : stock;

            return (
              <div
                key={item.productId}
                className={`rounded-2xl border bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-xs space-y-4 transition-all ${
                  isOverStock || isOverLimit
                    ? "border-amber-300 dark:border-amber-700/80 ring-2 ring-amber-400/30"
                    : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <div className="flex gap-4">
                  {/* Thumbnail */}
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 p-2 shrink-0 flex items-center justify-center overflow-hidden border border-zinc-200/60 dark:border-zinc-800 relative">
                    {(() => {
                      const displayImg = productThumbnails[item.productId] ?? item.thumbnailUrl;
                      return displayImg ? (
                        <img
                          src={displayImg}
                          alt={item.productName}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            const target = e.currentTarget;
                            target.style.display = "none";
                            const parent = target.parentElement;
                            if (parent && !parent.querySelector(".no-img-label")) {
                              const span = document.createElement("span");
                              span.className = "text-xs text-zinc-400 no-img-label";
                              span.innerText = "No Image";
                              parent.appendChild(span);
                            }
                          }}
                        />
                      ) : (
                        <span className="text-xs text-zinc-400">No Image</span>
                      );
                    })()}
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
                            className="hover:underline hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
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
                      <span>•</span>
                      <span className="text-zinc-600 dark:text-zinc-400 font-medium">
                        가용 재고: <strong className={stock > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"}>{stock} EA</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Over-Stock Alert Banner */}
                {isOverStock && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 font-medium flex items-center gap-2">
                    <span className="font-bold">⚠️</span>
                    <span>
                      Only {stock} units are currently available. Please adjust your quantity before checkout.
                    </span>
                  </div>
                )}

                {/* Over-Limit Alert Banner */}
                {isOverLimit && allowance && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300 font-medium flex items-center gap-2">
                    <span className="font-bold">⚠️</span>
                    <span>
                      This quantity ({item.quantity} units) exceeds your account purchase limit of {allowance.limit} units for this {allowance.period === "monthly" ? "month" : allowance.period === "weekly" ? "week" : "day"} ({allowance.remainingAllowance} units remaining). Please adjust your quantity before checkout.
                    </span>
                  </div>
                )}

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
                        className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={pack}
                        step={pack}
                        value={item.quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val > 0) {
                            updateQuantity(item.productId, val);
                          }
                        }}
                        className={`w-16 text-center font-bold text-xs bg-transparent border-0 focus:outline-hidden ${
                          isOverStock || isOverLimit
                            ? "text-rose-600 dark:text-rose-400 font-black"
                            : "text-zinc-900 dark:text-white"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, item.quantity + pack)}
                        disabled={item.quantity + pack > effectiveMax}
                        className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
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

            {/* Promo Code Input & Status */}
            <div className="space-y-2 pb-2">
              <div className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                Promo Code
              </div>

              {promoEvaluation?.appliedCoupon ? (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-2 shadow-2xs">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                      <span className="font-mono">{promoEvaluation.appliedCoupon.coupon_code}</span>
                      <span className="text-[10px] bg-emerald-200/70 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 px-1.5 py-0.5 rounded font-medium">
                        Applied
                      </span>
                    </div>
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-300 truncate">
                      {promoEvaluation.appliedCoupon.promotion_name}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-emerald-700 dark:text-emerald-300">
                      -${promoEvaluation.appliedCoupon.discount_amount.toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 underline font-medium cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter promo code"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white uppercase font-mono placeholder:normal-case placeholder:font-sans focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                  />
                  <button
                    type="submit"
                    disabled={!inputCode.trim() || isEvaluatingPromo}
                    className="px-3.5 py-2 text-xs font-bold rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity cursor-pointer shrink-0"
                  >
                    {isEvaluatingPromo ? "..." : "Apply"}
                  </button>
                </form>
              )}

              {/* Promo Error Feedback */}
              {promoFeedbackMessage && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-[11px] text-rose-700 dark:text-rose-300 font-medium flex items-center justify-between">
                  <span>{promoFeedbackMessage}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setPromoFeedbackMessage(null);
                      if (couponCode) handleRemoveCoupon();
                    }}
                    className="text-rose-500 hover:text-rose-700 ml-2 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Automatic Promotion Badge */}
              {promoEvaluation?.appliedAutomatic && (
                <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200 flex items-center justify-between gap-2 shadow-2xs">
                  <div className="space-y-0.5 min-w-0">
                    <div className="font-bold flex items-center gap-1 text-[11px]">
                      <span>⚡ Automatic Promotion</span>
                    </div>
                    <div className="text-[11px] text-indigo-700 dark:text-indigo-300 truncate">
                      {promoEvaluation.appliedAutomatic.promotion_name}
                    </div>
                  </div>
                  <span className="font-bold shrink-0 text-emerald-600 dark:text-emerald-400">
                    -${promoEvaluation.appliedAutomatic.discount_amount.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3 text-xs pt-3 border-t border-zinc-200 dark:border-zinc-800">
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

              {/* Promotion / Coupon Discount Line */}
              {promoEvaluation && promoEvaluation.totalDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span>Promotion / Coupon:</span>
                  <span className="font-bold">
                    -${promoEvaluation.totalDiscount.toFixed(2)}
                  </span>
                </div>
              )}

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
                ${(promoEvaluation ? promoEvaluation.finalSubtotal : subtotal).toFixed(2)}
              </div>
            </div>

            {/* Violation Alert inside Summary */}
            {hasAnyViolation && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <span>⚠️</span>
                  <span>수량 초과 상품 확인 필요</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  가용 재고 또는 계정 구매 한도를 초과한 상품이 포함되어 있어 주문을 진행할 수 없습니다. 수량을 조정한 후 결제를 진행해주세요.
                </p>
              </div>
            )}

            <div className="space-y-2 pt-2">
              {hasAnyViolation ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-3.5 px-6 rounded-xl font-bold text-sm bg-zinc-300 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-500 cursor-not-allowed flex items-center justify-center gap-2 shadow-xs"
                >
                  <span>Proceed to Checkout (Adjust Quantities)</span>
                </button>
              ) : (
                <Link
                  href="/checkout"
                  className="w-full py-3.5 px-6 rounded-xl font-bold text-sm bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:opacity-95 transition-opacity flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <span>Proceed to Checkout</span>
                  <span>→</span>
                </Link>
              )}

              <Link
                href="/products"
                className="w-full py-2.5 px-4 text-center rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors block cursor-pointer"
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
