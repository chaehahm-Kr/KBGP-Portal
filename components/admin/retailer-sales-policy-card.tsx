"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  type ResolvedRetailerSalesPolicy,
  type RetailerPriceTier,
  calculateTierUnitPrice,
  isValidMoqOrderQuantity,
  generateDefaultPriceTiers,
} from "@/lib/product/retailer-policy";
import { updateRetailerSalesPolicy } from "@/lib/product/trading-actions";

interface RetailerSalesPolicyCardProps {
  productId: string;
  productName: string;
  cartonPackQty: number;
  salesPolicy: ResolvedRetailerSalesPolicy;
  srpPrice: number | null;
  mapPrice: number | null;
}

export function RetailerSalesPolicyCard({
  productId,
  productName,
  cartonPackQty,
  salesPolicy,
  srpPrice,
  mapPrice,
}: RetailerSalesPolicyCardProps) {
  const router = useRouter();

  // Form State
  const initialMoq = salesPolicy.moq > 0 ? salesPolicy.moq : (cartonPackQty > 0 ? cartonPackQty : 0);
  const initialBasePrice = salesPolicy.baseWholesalePrice > 0 ? salesPolicy.baseWholesalePrice : 0;

  const [moq, setMoq] = useState<string>(initialMoq > 0 ? initialMoq.toString() : "");
  const [basePrice, setBasePrice] = useState<string>(initialBasePrice > 0 ? initialBasePrice.toFixed(2) : "");

  // Tiers State
  const [tiers, setTiers] = useState<RetailerPriceTier[]>(() => {
    if (salesPolicy.tiers && salesPolicy.tiers.length > 0) {
      return salesPolicy.tiers;
    }
    return generateDefaultPriceTiers(initialMoq > 0 ? initialMoq : 1, initialBasePrice);
  });

  // Promotion State
  const [promoPrice, setPromoPrice] = useState<string>(
    salesPolicy.promoWholesalePrice !== null && salesPolicy.promoWholesalePrice > 0
      ? salesPolicy.promoWholesalePrice.toFixed(2)
      : ""
  );
  const [promoStart, setPromoStart] = useState<string>(salesPolicy.promoStartDate || "");
  const [promoEnd, setPromoEnd] = useState<string>(salesPolicy.promoEndDate || "");

  // UI State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const numMoq = parseInt(moq, 10) || 0;
  const numBasePrice = parseFloat(basePrice) || 0;
  const numPromo = parseFloat(promoPrice) || 0;

  // Promotion Status Evaluation
  const currentPromoStatus = useMemo(() => {
    if (numPromo <= 0) return { status: "none", label: "미설정", style: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700" };

    const now = new Date();
    const start = promoStart ? new Date(promoStart) : null;
    let end = promoEnd ? new Date(promoEnd) : null;
    if (end && promoEnd.length === 10) {
      end = new Date(`${promoEnd}T23:59:59.999Z`);
    }

    if (start && start > now) {
      return { status: "scheduled", label: "예약 (Scheduled)", style: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900" };
    }
    if (end && end < now) {
      return { status: "ended", label: "종료 (Ended)", style: "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700" };
    }
    return { status: "active", label: "진행 중 (Active)", style: "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800" };
  }, [numPromo, promoStart, promoEnd]);

  const isPromoCurrentlyActive = currentPromoStatus.status === "active" && numPromo > 0;

  // Recalculate tier starting quantities & unit prices & purchase subtotals when MOQ or Base Price changes
  const computedTiers = useMemo(() => {
    return tiers.map((t, idx) => {
      const mult = Math.max(1, Math.floor(t.multiple || 1));
      const minQty = numMoq > 0 ? numMoq * mult : mult;
      const disc = mult === 1 ? 0 : Math.max(0, Math.min(99.99, t.discount_percent || 0));
      const regularUnitPrice = calculateTierUnitPrice(numBasePrice, disc);

      // Check if active promotion applies to this tier (if promo price is lower than tier price)
      const hasPromoApplied = isPromoCurrentlyActive && numPromo < regularUnitPrice;
      const effectiveUnitPrice = hasPromoApplied ? numPromo : regularUnitPrice;

      // Calculate Purchase Subtotal for the starting quantity
      const isValidInputs = numMoq > 0 && numBasePrice > 0;
      const purchaseSubtotal = isValidInputs
        ? Math.round((minQty * effectiveUnitPrice + Number.EPSILON) * 100) / 100
        : null;
      const regularPurchaseSubtotal = isValidInputs
        ? Math.round((minQty * regularUnitPrice + Number.EPSILON) * 100) / 100
        : null;

      return {
        ...t,
        multiple: mult,
        min_qty: minQty,
        discount_percent: disc,
        unit_price: regularUnitPrice,
        effective_unit_price: effectiveUnitPrice,
        has_promo_applied: hasPromoApplied,
        purchase_subtotal: purchaseSubtotal,
        regular_purchase_subtotal: regularPurchaseSubtotal,
      };
    });
  }, [tiers, numMoq, numBasePrice, isPromoCurrentlyActive, numPromo]);

  // Check for tier inversions / warnings (where ordering more costs less than ordering fewer)
  const tierWarnings = useMemo(() => {
    const warnings: string[] = [];
    const published = computedTiers.filter((t) => t.is_published).sort((a, b) => a.min_qty - b.min_qty);
    for (let i = 1; i < published.length; i++) {
      const prev = published[i - 1];
      const curr = published[i];
      const prevTotal = prev.min_qty * prev.unit_price;
      const currTotal = curr.min_qty * curr.unit_price;
      if (currTotal <= prevTotal && curr.min_qty > prev.min_qty) {
        warnings.push(
          `수량 경계 주의: ${curr.min_qty}개 주문 총액($${currTotal.toFixed(2)})이 ${prev.min_qty}개 주문 총액($${prevTotal.toFixed(2)})보다 작거나 같습니다. 할인율을 확인해주세요.`
        );
      }
    }
    return warnings;
  }, [computedTiers]);

  // Add new tier
  const handleAddTier = () => {
    const nextIdx = computedTiers.length;
    const lastTier = computedTiers[computedTiers.length - 1];
    const nextMultiple = lastTier ? lastTier.multiple + 3 : 3;
    const nextDiscount = lastTier ? Math.min(95, lastTier.discount_percent + 3) : 2;

    setTiers([
      ...tiers,
      {
        id: `tier-custom-${Date.now()}`,
        multiple: nextMultiple,
        min_qty: numMoq > 0 ? numMoq * nextMultiple : nextMultiple,
        discount_percent: nextDiscount,
        unit_price: calculateTierUnitPrice(numBasePrice, nextDiscount),
        is_published: true,
      },
    ]);
  };

  // Update tier fields
  const handleUpdateTier = (idx: number, updates: Partial<RetailerPriceTier>) => {
    setTiers((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...updates };
      return copy;
    });
  };

  // Delete tier
  const handleDeleteTier = (idx: number) => {
    if (computedTiers[idx].multiple === 1) return; // Base tier cannot be deleted
    setTiers((prev) => prev.filter((_, i) => i !== idx));
  };

  // Save Policy
  const handleSavePolicy = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (numMoq <= 0) {
        throw new Error("Retailer MOQ는 1 이상의 정수여야 합니다.");
      }
      if (numBasePrice <= 0) {
        throw new Error("기본 Retailer 판매 단가는 $0.01 이상이어야 합니다.");
      }

      // Format tiers payload
      const tiersPayload = computedTiers.map((t) => ({
        id: t.id,
        multiple: t.multiple,
        discount_percent: t.multiple === 1 ? 0 : t.discount_percent,
        is_published: t.multiple === 1 ? true : Boolean(t.is_published),
      }));

      // Ensure base tier exists
      if (!tiersPayload.some((t) => t.multiple === 1)) {
        tiersPayload.unshift({
          id: "tier-base",
          multiple: 1,
          discount_percent: 0,
          is_published: true,
        });
      }

      const res = await updateRetailerSalesPolicy(productId, {
        moq: numMoq,
        base_wholesale_price: numBasePrice,
        tiers: tiersPayload,
        promo_wholesale_price: numPromo > 0 ? numPromo : null,
        promo_start_date: promoStart || null,
        promo_end_date: promoEnd || null,
        reason: "Retailer Sales Policy saved from Admin Trading Detail",
      });

      if (!res.success) {
        throw new Error(res.error || "리테일러 판매 정책 저장 중 오류가 발생했습니다.");
      }

      setSuccessMessage("리테일러 판매 정책이 성공적으로 저장 및 Hub에 적용되었습니다.");
      setTimeout(() => setSuccessMessage(null), 5000);
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err?.message || "판매 정책 저장 실패");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
      {/* Header & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>📋</span> 리테일러 판매 정책 (Retailer Sales Policy)
            </h3>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                salesPolicy.isConfigured
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
                  : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"
              }`}
            >
              {salesPolicy.isConfigured ? "설정 완료" : "설정 필요 (Needs Setup)"}
            </span>
            {salesPolicy.initialSource === "catalog_case" && !salesPolicy.isConfigured && (
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                카탈로그 Case 기준 초안
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            리테일러 대상 B2B 최소 주문 수량(MOQ), 공급 단가, 수량별 할인 구간 및 프로모션을 통합 관리합니다.
          </p>
        </div>
      </div>

      {/* Alerts / Feedback */}
      {errorMessage && (
        <div className="rounded-xl p-3.5 bg-rose-50 border border-rose-200 dark:bg-rose-950/30 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
          <span className="font-bold">⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="rounded-xl p-3.5 bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
          <span className="font-bold">✓</span>
          <span>{successMessage}</span>
        </div>
      )}

      {/* 1. Basic Order Conditions & Wholesale Price */}
      <div className="p-4 sm:p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-200/70 dark:border-zinc-800 pb-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
            <span>1. 기본 주문 조건 & 공급 단가 (Base Ordering Rules)</span>
          </h4>
          <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
            B2B Wholesale (USD/EA)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Retailer MOQ */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200">
                Retailer MOQ / 기본 주문 묶음 단위 (EA) <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-zinc-400">최소 주문이자 증가 단위</span>
            </div>
            <div className="relative">
              <input
                type="number"
                min="1"
                step="1"
                value={moq}
                onChange={(e) => setMoq(e.target.value)}
                placeholder={cartonPackQty > 0 ? `${cartonPackQty} (Case 기준)` : "설정 필요"}
                className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs"
              />
              <span className="absolute right-3 top-2 text-xs font-bold text-zinc-400">EA / 묶음</span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              * 리테일러는 이 수량의 배수(예: {numMoq > 0 ? `${numMoq}, ${numMoq * 2}, ${numMoq * 3}...` : "10, 20, 30..."}개) 단위로만 발주할 수 있습니다.
            </p>
          </div>

          {/* Base Retailer Wholesale Price */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200">
                기본 Retailer 판매 단가 (USD/EA) <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">리테일러 공급가</span>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs font-bold text-zinc-400">$</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs"
              />
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              * 소비자가(SRP)나 한국 원화 기준가가 아닌, <strong>리테일러에게 공급하는 순수 USD 공급 단가</strong>입니다.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Quantity Discount Tiers Table with Purchase Subtotal */}
      <div className="p-4 sm:p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-200/70 dark:border-zinc-800 pb-2">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
              <span>2. 수량별 가격 및 구매 합계 (Quantity Tiers & Subtotals)</span>
            </h4>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              주문 묶음 배수에 따른 할인율, 개당 계산 단가 및 시작 수량 구매 합계를 확인합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddTier}
            className="px-3 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-400 dark:border-indigo-800 hover:bg-indigo-100 transition-colors self-start sm:self-auto"
          >
            + 할인 구간 추가
          </button>
        </div>

        {/* Tier Inversion Warnings */}
        {tierWarnings.length > 0 && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300 space-y-1">
            {tierWarnings.map((w, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span>⚠️</span>
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Full-Width Tiers Table */}
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-800/80 text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase">
                <th className="py-2.5 px-3">구분</th>
                <th className="py-2.5 px-2.5 text-center">MOQ 배수</th>
                <th className="py-2.5 px-3 text-right">적용 시작 수량</th>
                <th className="py-2.5 px-3 text-center">할인율 (%)</th>
                <th className="py-2.5 px-3 text-right">계산 단가 (USD/EA)</th>
                <th className="py-2.5 px-3 text-right bg-indigo-50/40 dark:bg-indigo-950/20 text-indigo-950 dark:text-indigo-300">
                  해당 수량 구매 합계
                </th>
                <th className="py-2.5 px-3 text-center">게시 여부</th>
                <th className="py-2.5 px-2.5 text-center">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {computedTiers.map((tier, idx) => {
                const isBase = tier.multiple === 1;
                return (
                  <tr key={tier.id || idx} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                    {/* 구분 */}
                    <td className="py-2.5 px-3 font-semibold text-zinc-800 dark:text-zinc-200">
                      {isBase ? (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-600" />
                          <span>기본 (MOQ × 1)</span>
                        </div>
                      ) : (
                        <span>추가 구간 {idx}</span>
                      )}
                    </td>

                    {/* MOQ 배수 */}
                    <td className="py-2.5 px-2.5 text-center">
                      {isBase ? (
                        <span className="font-mono text-xs font-bold text-zinc-500">1×</span>
                      ) : (
                        <div className="inline-flex items-center justify-center gap-1">
                          <input
                            type="number"
                            min="2"
                            step="1"
                            value={tier.multiple}
                            onChange={(e) => handleUpdateTier(idx, { multiple: parseInt(e.target.value, 10) || 1 })}
                            className="w-14 px-1.5 py-1 text-center font-mono font-bold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                          />
                          <span className="text-zinc-400 text-[11px]">배</span>
                        </div>
                      )}
                    </td>

                    {/* 적용 시작 수량 */}
                    <td className="py-2.5 px-3 text-right font-mono font-extrabold text-zinc-900 dark:text-white">
                      {numMoq > 0 ? (
                        <span>{tier.min_qty.toLocaleString()} EA</span>
                      ) : (
                        <span className="text-zinc-400 font-normal">—</span>
                      )}
                    </td>

                    {/* 할인율 (%) */}
                    <td className="py-2.5 px-3 text-center">
                      {isBase ? (
                        <span className="text-zinc-400 font-mono text-xs font-semibold">0% (기준)</span>
                      ) : (
                        <div className="inline-flex items-center justify-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="99"
                            step="0.5"
                            value={tier.discount_percent}
                            onChange={(e) => handleUpdateTier(idx, { discount_percent: parseFloat(e.target.value) || 0 })}
                            className="w-16 px-1.5 py-1 text-center font-mono font-bold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                          />
                          <span className="text-zinc-400 text-[11px]">%</span>
                        </div>
                      )}
                    </td>

                    {/* 단가 */}
                    <td className="py-2.5 px-3 text-right font-mono">
                      {numBasePrice > 0 ? (
                        <div className="flex flex-col items-end">
                          <span className="font-extrabold text-zinc-900 dark:text-white">
                            ${tier.unit_price.toFixed(2)}
                          </span>
                          {tier.has_promo_applied && (
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1 rounded">
                              프로모션 적용: ${tier.effective_unit_price.toFixed(2)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>

                    {/* 해당 수량 구매 합계 */}
                    <td className="py-2.5 px-3 text-right font-mono font-black bg-indigo-50/30 dark:bg-indigo-950/15">
                      {tier.purchase_subtotal !== null ? (
                        <div className="flex flex-col items-end">
                          <span className="text-indigo-600 dark:text-indigo-400 text-sm">
                            ${tier.purchase_subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] font-medium text-zinc-400">
                            ({tier.min_qty}개 × ${tier.effective_unit_price.toFixed(2)})
                          </span>
                        </div>
                      ) : (
                        <span className="text-zinc-400 font-normal">—</span>
                      )}
                    </td>

                    {/* 게시 여부 */}
                    <td className="py-2.5 px-3 text-center">
                      {isBase ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                          게시 (기본)
                        </span>
                      ) : (
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={tier.is_published}
                            onChange={(e) => handleUpdateTier(idx, { is_published: e.target.checked })}
                            className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                          <span className={`text-[11px] font-bold ${tier.is_published ? "text-emerald-600" : "text-zinc-400"}`}>
                            {tier.is_published ? "게시" : "숨김"}
                          </span>
                        </label>
                      )}
                    </td>

                    {/* 작업 */}
                    <td className="py-2.5 px-2.5 text-center">
                      {isBase ? (
                        <span className="text-zinc-300 dark:text-zinc-700 text-xs">—</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDeleteTier(idx)}
                          className="text-rose-600 hover:text-rose-700 text-xs font-semibold px-2 py-0.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        >
                          삭제
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Informative Guidance Note */}
        <div className="p-3 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 text-xs text-zinc-600 dark:text-zinc-300 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">💡</span>
            <span>
              <strong>주문 안내:</strong> {numMoq > 0 ? numMoq : 10}개 단위로 주문하며, 총 주문 수량에 해당하는 할인 단가가 전체 수량에 적용됩니다. (구매 합계는 각 시작 수량 기준 금액입니다.)
            </span>
          </div>
          <span className="text-[11px] text-zinc-400 font-medium">
            * 소수점 둘째 자리 반올림 기준
          </span>
        </div>
      </div>

      {/* 3. Promotion Settings */}
      <div className="p-4 sm:p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-200/70 dark:border-zinc-800 pb-2">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <span>3. 프로모션 단가 및 일정 (Promotions)</span>
            </h4>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${currentPromoStatus.style}`}>
              {currentPromoStatus.label}
            </span>
          </div>
          <span className="text-[11px] text-zinc-400">
            {isPromoCurrentlyActive ? "진행 중인 프로모션 우선 적용" : "일정 지정 시 자동 적용"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Promo Wholesale Price */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200">
              프로모션 단가 (USD/EA)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs font-bold text-zinc-400">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={promoPrice}
                onChange={(e) => setPromoPrice(e.target.value)}
                placeholder="미설정"
                className="w-full pl-7 pr-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 shadow-xs"
              />
            </div>
          </div>

          {/* Start Date */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200">
              시작일 (Start Date)
            </label>
            <input
              type="date"
              value={promoStart}
              onChange={(e) => setPromoStart(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white dark:[color-scheme:dark] focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs"
            />
          </div>

          {/* End Date */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200">
              종료일 (End Date - 당일 23:59까지 포함)
            </label>
            <input
              type="date"
              value={promoEnd}
              onChange={(e) => setPromoEnd(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white dark:[color-scheme:dark] focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs"
            />
          </div>
        </div>

        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          * 프로모션 기간 중에는 수량 할인과 중복 계산되지 않으며, 프로모션 단가와 각 수량별 할인 단가 중 <strong>더 낮은 단가가 자동 선택</strong>됩니다.
        </p>
      </div>

      {/* 4. Bottom Primary Save Action */}
      <div className="pt-3 flex items-center justify-end border-t border-zinc-100 dark:border-zinc-800">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={handleSavePolicy}
          className="w-full sm:w-auto px-6 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>저장 중...</span>
            </>
          ) : (
            <>
              <span>💾</span>
              <span>판매 정책 저장</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
