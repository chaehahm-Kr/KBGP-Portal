"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  type ResolvedRetailerSalesPolicy,
  type RetailerPriceTier,
  calculateTierUnitPrice,
  calculateApplicablePrice,
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
  const [policyNote, setPolicyNote] = useState<string>("");

  // Simulation State
  const [simQty, setSimQty] = useState<number>(initialMoq > 0 ? initialMoq : 10);

  // UI State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const numMoq = parseInt(moq, 10) || 0;
  const numBasePrice = parseFloat(basePrice) || 0;

  // Recalculate tier starting quantities & unit prices when MOQ or Base Price changes
  const computedTiers = useMemo(() => {
    return tiers.map((t, idx) => {
      const mult = Math.max(1, Math.floor(t.multiple || 1));
      const minQty = numMoq > 0 ? numMoq * mult : mult;
      const disc = mult === 1 ? 0 : Math.max(0, Math.min(99.99, t.discount_percent || 0));
      const unitPrice = calculateTierUnitPrice(numBasePrice, disc);
      return {
        ...t,
        multiple: mult,
        min_qty: minQty,
        discount_percent: disc,
        unit_price: unitPrice,
      };
    });
  }, [tiers, numMoq, numBasePrice]);

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
          `수량 경계 주의: ${curr.min_qty}개 주문 총액($${currTotal.toFixed(2)})이 ${prev.min_qty}개 주문 총액($${prevTotal.toFixed(2)})보다 작거나 같습니다.`
        );
      }
    }
    return warnings;
  }, [computedTiers]);

  // Current Promotion Status
  const currentPromoStatus = useMemo(() => {
    const numPromo = parseFloat(promoPrice) || 0;
    if (numPromo <= 0) return { status: "none", label: "미설정", style: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" };
    
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
    return { status: "active", label: "진행 중 (Active)", style: "bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800" };
  }, [promoPrice, promoStart, promoEnd]);

  // Dynamic simulation policy snapshot
  const activeSimulationPolicy: ResolvedRetailerSalesPolicy = useMemo(() => {
    const numPromo = parseFloat(promoPrice) || null;
    const isPromoActive = currentPromoStatus.status === "active" && numPromo !== null && numPromo > 0;
    return {
      isConfigured: numMoq > 0 && numBasePrice > 0,
      initialSource: salesPolicy.initialSource,
      moq: numMoq,
      baseWholesalePrice: numBasePrice,
      isMoqValid: numMoq > 0,
      isBasePriceValid: numBasePrice > 0,
      tiers: computedTiers,
      publishedTiers: computedTiers.filter((t) => t.is_published),
      promoWholesalePrice: numPromo,
      promoStartDate: promoStart || null,
      promoEndDate: promoEnd || null,
      promoStatus: currentPromoStatus.status as any,
      hasActivePromo: isPromoActive,
      srpPrice: srpPrice,
      mapPrice: mapPrice,
    };
  }, [numMoq, numBasePrice, computedTiers, promoPrice, promoStart, promoEnd, currentPromoStatus, salesPolicy.initialSource, srpPrice, mapPrice]);

  // Simulation calculation
  const simResult = useMemo(() => {
    return calculateApplicablePrice(activeSimulationPolicy, simQty);
  }, [activeSimulationPolicy, simQty]);

  // Tier operations
  const handleAddTier = () => {
    setTiers((prev) => {
      const maxMult = Math.max(...prev.map((t) => t.multiple), 1);
      const newMult = maxMult + 3;
      const newTier: RetailerPriceTier = {
        id: `tier-${Date.now()}`,
        multiple: newMult,
        min_qty: numMoq * newMult,
        discount_percent: Math.min(15, Math.floor(newMult * 1.2)),
        unit_price: calculateTierUnitPrice(numBasePrice, Math.min(15, Math.floor(newMult * 1.2))),
        is_published: true,
      };
      return [...prev, newTier];
    });
  };

  const handleUpdateTier = (index: number, updates: Partial<RetailerPriceTier>) => {
    setTiers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const handleDeleteTier = (index: number) => {
    setTiers((prev) => {
      if (prev[index]?.multiple === 1) return prev; // Base tier cannot be deleted
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const handleResetForm = () => {
    setMoq(initialMoq > 0 ? initialMoq.toString() : "");
    setBasePrice(initialBasePrice > 0 ? initialBasePrice.toFixed(2) : "");
    setTiers(salesPolicy.tiers && salesPolicy.tiers.length > 0 ? salesPolicy.tiers : generateDefaultPriceTiers(initialMoq, initialBasePrice));
    setPromoPrice(salesPolicy.promoWholesalePrice ? salesPolicy.promoWholesalePrice.toFixed(2) : "");
    setPromoStart(salesPolicy.promoStartDate || "");
    setPromoEnd(salesPolicy.promoEndDate || "");
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleSave = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (numMoq <= 0) {
      setErrorMessage("Retailer MOQ는 1 이상의 유효한 정수를 입력해야 합니다.");
      return;
    }

    if (numBasePrice <= 0) {
      setErrorMessage("기본 Retailer 판매 단가는 0보다 큰 금액이어야 합니다.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        moq: numMoq,
        base_wholesale_price: numBasePrice,
        tiers: computedTiers.map((t) => ({
          id: t.id,
          multiple: t.multiple,
          discount_percent: t.discount_percent,
          is_published: t.is_published,
        })),
        promo_wholesale_price: promoPrice ? parseFloat(promoPrice) : null,
        promo_start_date: promoStart || null,
        promo_end_date: promoEnd || null,
        note: policyNote || null,
      };

      await updateRetailerSalesPolicy(productId, payload);
      setSuccessMessage("리테일러 판매 정책이 성공적으로 저장되었습니다.");
      setTimeout(() => setSuccessMessage(null), 4000);
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "판매 정책 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick simulation buttons
  const quickQtys = useMemo(() => {
    const base = numMoq > 0 ? numMoq : 10;
    return [base, base * 2, base * 3, base * 5, base * 6, base * 7];
  }, [numMoq]);

  return (
    <div id="retailer-sales-policy-card" className="rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-50/80 via-white to-indigo-50/50 dark:from-indigo-950/40 dark:via-zinc-900 dark:to-indigo-950/20 px-6 py-4 border-b border-indigo-100 dark:border-indigo-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base">💼</span>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
              리테일러 판매 정책 (Retailer Sales Policy)
            </h3>
            {salesPolicy.initialSource === "saved_policy" ? (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                ✓ 개별 저장된 정책
              </span>
            ) : salesPolicy.initialSource === "catalog_case" ? (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                카탈로그 Case 기준 초기값
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800">
                설정 필요
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            리테일러에게 공급하는 도매 단가, MOQ 묶음 주문 단위, 수량별 할인 구간 및 프로모션을 통합 관리합니다. (소비자 권장가 SRP/MAP와 분리)
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={handleResetForm}
            disabled={isSubmitting}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors"
          >
            초기화
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting}
            className="px-4 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            {isSubmitting ? "저장 중..." : "판매 정책 저장"}
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div className="px-6 space-y-2">
        {errorMessage && (
          <div className="rounded-xl p-3.5 bg-rose-50 border border-rose-200 dark:bg-rose-950/30 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <span className="font-bold">✕</span>
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="rounded-xl p-3.5 bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
            <span className="font-bold">✓</span>
            <span>{successMessage}</span>
          </div>
        )}
      </div>

      {/* Main Grid: Inputs (7 cols) + Live Simulator (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 px-6 pb-6 items-start">
        {/* Left Column: Form Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: MOQ & Base Price */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200 flex items-center justify-between">
              <span>1. 기본 주문 조건 & 공급 단가</span>
              <span className="text-[10px] text-zinc-400 font-normal lowercase">b2b wholesale only</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Retailer MOQ */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Retailer MOQ / 주문 묶음 단위 (EA) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={moq}
                    onChange={(e) => setMoq(e.target.value)}
                    placeholder={cartonPackQty > 0 ? `${cartonPackQty} (Case 기준)` : "설정 필요"}
                    className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="absolute right-3 top-2 text-xs font-bold text-zinc-400">EA / 묶음</span>
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  최소 주문 수량이자 주문 배수입니다. (예: 10 입력 시 10, 20, 30... 주문 가능)
                </p>
              </div>

              {/* Base Retailer Wholesale Price */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  기본 Retailer 판매 단가 (USD/EA) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-zinc-400">$</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400">
                  리테일러에게 공급하는 B2B 도매 단가입니다. (소비자가 SRP와 혼동 주의)
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Quantity Discount Tiers Table */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                  2. 수량별 할인 구간 (Quantity Discount Tiers)
                </h4>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  주문 묶음 배수에 따른 할인율과 개당 단가를 설정합니다. (할인율은 기본 단가 기준)
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddTier}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-400 dark:border-indigo-800 hover:bg-indigo-100 transition-colors"
              >
                + 기준 추가
              </button>
            </div>

            {/* Warnings */}
            {tierWarnings.length > 0 && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900 text-[11px] text-amber-700 dark:text-amber-300 space-y-1">
                {tierWarnings.map((w, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <span>⚠️</span>
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Tiers Table */}
            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-800/60 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase">
                    <th className="py-2.5 px-3">구분</th>
                    <th className="py-2.5 px-2 text-center">적용 배수</th>
                    <th className="py-2.5 px-2 text-right">시작 수량</th>
                    <th className="py-2.5 px-2 text-center">할인율 (%)</th>
                    <th className="py-2.5 px-2 text-right">계산 단가</th>
                    <th className="py-2.5 px-2 text-center">게시 여부</th>
                    <th className="py-2.5 px-2 text-center">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {computedTiers.map((tier, idx) => {
                    const isBase = tier.multiple === 1;
                    return (
                      <tr key={tier.id || idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                        <td className="py-2 px-3 font-semibold text-zinc-800 dark:text-zinc-200">
                          {isBase ? "기본 (MOQ × 1)" : `추가 ${idx}`}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {isBase ? (
                            <span className="font-mono text-zinc-500">1×</span>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                min="2"
                                step="1"
                                value={tier.multiple}
                                onChange={(e) => handleUpdateTier(idx, { multiple: parseInt(e.target.value, 10) || 1 })}
                                className="w-14 px-1.5 py-1 text-center font-mono rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                              />
                              <span className="text-zinc-400 text-[11px]">배</span>
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-zinc-900 dark:text-white">
                          {tier.min_qty.toLocaleString()} EA
                        </td>
                        <td className="py-2 px-2 text-center">
                          {isBase ? (
                            <span className="text-zinc-400 font-mono">0%</span>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                max="99"
                                step="0.5"
                                value={tier.discount_percent}
                                onChange={(e) => handleUpdateTier(idx, { discount_percent: parseFloat(e.target.value) || 0 })}
                                className="w-16 px-1.5 py-1 text-center font-mono rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                              />
                              <span className="text-zinc-400 text-[11px]">%</span>
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          ${tier.unit_price.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {isBase ? (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                              게시 (기본)
                            </span>
                          ) : (
                            <label className="inline-flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={tier.is_published}
                                onChange={(e) => handleUpdateTier(idx, { is_published: e.target.checked })}
                                className="rounded text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className={`text-[11px] font-semibold ${tier.is_published ? "text-emerald-600" : "text-zinc-400"}`}>
                                {tier.is_published ? "게시" : "숨김"}
                              </span>
                            </label>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center">
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
          </div>

          {/* Section 3: Promotion Settings */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                <span>3. 프로모션 단가 및 기간</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${currentPromoStatus.style}`}>
                  {currentPromoStatus.label}
                </span>
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Promo Price */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                  프로모션 단가 (USD/EA)
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1.5 text-xs text-zinc-400">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={promoPrice}
                    onChange={(e) => setPromoPrice(e.target.value)}
                    placeholder="미설정"
                    className="w-full pl-6 pr-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Start Date */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                  시작일 (Start Date)
                </label>
                <input
                  type="date"
                  value={promoStart}
                  onChange={(e) => setPromoStart(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                />
              </div>

              {/* End Date */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                  종료일 (End Date - 포함)
                </label>
                <input
                  type="date"
                  value={promoEnd}
                  onChange={(e) => setPromoEnd(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                />
              </div>
            </div>

            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              * 프로모션이 활성화되면 수량 할인과 중복 계산되지 않으며, 프로모션 단가와 수량별 할인 단가 중 <strong>더 낮은 단가</strong>가 적용됩니다.
            </p>
          </div>
        </div>

        {/* Right Column: Live Simulator & Hub Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-gradient-to-br from-indigo-50/40 via-white to-indigo-50/20 dark:from-zinc-900 dark:to-indigo-950/20 space-y-4">
            <div className="flex items-center justify-between border-b border-indigo-100 dark:border-zinc-800 pb-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-950 dark:text-indigo-300 flex items-center gap-1.5">
                <span>🔍</span> Hub 실제 단가 & 합계 미리보기
              </h4>
              <span className="text-[10px] text-zinc-500 font-mono">Live Simulator</span>
            </div>

            {/* Quick Quantity Buttons */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                수량 빠른 선택 (MOQ 배수)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {quickQtys.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setSimQty(q)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      simQty === q
                        ? "bg-indigo-600 text-white shadow-xs scale-105"
                        : "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-indigo-50"
                    }`}
                  >
                    {q}개
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Quantity Stepper */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                직접 수량 입력 (MOQ: {numMoq}개 단위)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSimQty((prev) => Math.max(numMoq, prev - numMoq))}
                  disabled={simQty <= numMoq}
                  className="w-8 h-8 rounded-lg bg-zinc-200 dark:bg-zinc-700 font-bold text-zinc-800 dark:text-white disabled:opacity-30"
                >
                  -
                </button>
                <input
                  type="number"
                  min={numMoq}
                  step={numMoq}
                  value={simQty}
                  onChange={(e) => setSimQty(parseInt(e.target.value, 10) || 0)}
                  className="flex-1 py-1.5 text-center font-mono font-bold text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setSimQty((prev) => prev + numMoq)}
                  className="w-8 h-8 rounded-lg bg-zinc-200 dark:bg-zinc-700 font-bold text-zinc-800 dark:text-white"
                >
                  +
                </button>
              </div>
            </div>

            {/* Simulation Results Card */}
            <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-indigo-100 dark:border-zinc-800 space-y-3">
              <div className="flex justify-between items-baseline border-b border-zinc-100 dark:border-zinc-800 pb-2">
                <span className="text-xs text-zinc-500">주문 묶음 수:</span>
                <span className="text-xs font-mono font-bold text-zinc-900 dark:text-white">
                  {simResult.bundleCount} 묶음 ({simResult.quantity} EA)
                </span>
              </div>

              <div className="flex justify-between items-baseline border-b border-zinc-100 dark:border-zinc-800 pb-2">
                <span className="text-xs text-zinc-500">적용 단가:</span>
                <div className="text-right">
                  <span className="text-base font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                    ${simResult.effectiveUnitPrice.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-zinc-400 block">/ EA</span>
                </div>
              </div>

              <div className="flex justify-between items-baseline border-b border-zinc-100 dark:border-zinc-800 pb-2">
                <span className="text-xs text-zinc-500">적용 할인 근거:</span>
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  {simResult.appliedReason === "promotion"
                    ? `🔥 프로모션 단가 (${simResult.discountPercent}% 할인)`
                    : simResult.appliedReason === "tier_quantity"
                    ? `수량 할인 (${simResult.discountPercent}%)`
                    : "기본 MOQ 단가 (0%)"}
                </span>
              </div>

              {srpPrice && srpPrice > 0 && (
                <div className="flex justify-between items-baseline border-b border-zinc-100 dark:border-zinc-800 pb-2">
                  <span className="text-xs text-zinc-500">리테일러 예상 마진:</span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {simResult.retailerMarginPercent !== null ? `${simResult.retailerMarginPercent}%` : "—"}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-baseline pt-1">
                <span className="text-xs font-bold text-zinc-900 dark:text-white">상품 총액 (Subtotal):</span>
                <span className="text-lg font-black text-zinc-900 dark:text-white font-mono">
                  ${simResult.subtotal.toFixed(2)}
                </span>
              </div>

              {!simResult.isOrderable && (
                <div className="p-2 rounded bg-rose-50 dark:bg-rose-950/40 text-[11px] text-rose-600 font-semibold text-center">
                  ⚠️ {simResult.orderableReason}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
