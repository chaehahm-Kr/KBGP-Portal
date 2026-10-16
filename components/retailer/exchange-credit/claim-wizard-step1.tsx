"use client";

import React, { useState, useId } from "react";
import Image from "next/image";
import {
  ClaimWizardProductItem,
  ClaimWizardStore,
} from "./claim-wizard-types";
import {
  getStatusBadgeConfig,
  formatRetailerFriendlyReason,
  formatCurrency,
} from "./claim-wizard-helpers";

interface Step1SelectProductsProps {
  stores: ClaimWizardStore[];
  selectedStoreId: string;
  onStoreChange: (storeId: string) => void;
  products: ClaimWizardProductItem[];
  selectedCohortIds: Set<string>;
  onToggleProduct: (cohortId: string) => void;
  onSelectAllEligible: () => void;
  onDeselectAll: () => void;
  onNext: () => void;
}

export function ClaimWizardStep1({
  stores,
  selectedStoreId,
  onStoreChange,
  products,
  selectedCohortIds,
  onToggleProduct,
  onSelectAllEligible,
  onDeselectAll,
  onNext,
}: Step1SelectProductsProps) {
  const storeSelectId = useId();
  const [filter, setFilter] = useState<"ALL" | "ELIGIBLE" | "INELIGIBLE">("ALL");

  // Filter products by selected store
  const storeProducts = products.filter((p) => p.storeId === selectedStoreId);
  const eligibleProducts = storeProducts.filter((p) => p.status === "ELIGIBLE");

  // Filter tab list
  const filteredProducts = storeProducts.filter((p) => {
    if (filter === "ELIGIBLE") return p.status === "ELIGIBLE";
    if (filter === "INELIGIBLE") return p.status !== "ELIGIBLE";
    return true;
  });

  const selectedCount = Array.from(selectedCohortIds).filter((id) =>
    eligibleProducts.some((p) => p.cohortId === id)
  ).length;

  const currentStore = stores.find((s) => s.id === selectedStoreId);

  return (
    <div className="space-y-6">
      {/* 1. Store Context Banner */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold text-emerald-400 tracking-wider uppercase">
              매장별 단일 신청 (Single Store Context)
            </span>
            <h2 className="text-lg font-bold text-zinc-100 mt-1">
              신청 대상 매장 선택
            </h2>
            <p className="text-sm text-zinc-400 mt-0.5">
              90일 교환 보증은 매장별 독립 보장 정책입니다. 한 번의 요청에는 단일 매장의 품목만 담을 수 있습니다.
            </p>
          </div>

          {stores.length > 1 ? (
            <div className="min-w-[200px]">
              <label htmlFor={storeSelectId} className="sr-only">매장 선택</label>
              <select
                id={storeSelectId}
                value={selectedStoreId}
                onChange={(e) => onStoreChange(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              >
                {stores.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} {st.code ? `(${st.code})` : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-300 font-medium">
              🏪 {currentStore?.name || "기본 매장"} {currentStore?.code ? `(${currentStore.code})` : ""}
            </div>
          )}
        </div>
      </div>

      {/* 2. Filter & Selection Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-lg border border-zinc-800 w-fit">
          <button
            type="button"
            onClick={() => setFilter("ALL")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filter === "ALL"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            전체 품목 ({storeProducts.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("ELIGIBLE")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filter === "ELIGIBLE"
                ? "bg-emerald-500/20 text-emerald-300 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            신청 가능 ({eligibleProducts.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("INELIGIBLE")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filter === "INELIGIBLE"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            대기/제외 ({storeProducts.length - eligibleProducts.length})
          </button>
        </div>

        {eligibleProducts.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={onSelectAllEligible}
              className="text-emerald-400 hover:text-emerald-300 font-medium px-2 py-1 rounded hover:bg-emerald-500/10 transition-colors"
            >
              신청 가능 품목 전체 선택 ({eligibleProducts.length}개)
            </button>
            <span className="text-zinc-600">|</span>
            <button
              type="button"
              onClick={onDeselectAll}
              className="text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded hover:bg-zinc-800 transition-colors"
            >
              선택 해제
            </button>
          </div>
        )}
      </div>

      {/* 3. Product Cards Grid */}
      {filteredProducts.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-10 text-center">
          <p className="text-sm font-medium text-zinc-300">
            해당 조건의 90일 보증 대상 품목이 없습니다.
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            신청 가능한 다른 매장을 선택하거나 필터를 확인해 주세요.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProducts.map((prod) => {
            const isEligible = prod.status === "ELIGIBLE";
            const isSelected = selectedCohortIds.has(prod.cohortId);
            const badge = getStatusBadgeConfig(prod.status, prod.daysRemaining);

            return (
              <div
                key={prod.cohortId}
                onClick={() => {
                  if (isEligible) onToggleProduct(prod.cohortId);
                }}
                className={`relative rounded-xl border p-4 transition-all ${
                  isEligible
                    ? isSelected
                      ? "bg-emerald-950/20 border-emerald-500/50 shadow-sm cursor-pointer"
                      : "bg-zinc-900 border-zinc-800 hover:border-zinc-700 cursor-pointer"
                    : "bg-zinc-900/40 border-zinc-800/60 opacity-80 cursor-not-allowed"
                }`}
              >
                <div className="flex items-start gap-3.5">
                  {/* Selection Checkbox */}
                  <div className="pt-0.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={!isEligible}
                      onChange={() => {
                        if (isEligible) onToggleProduct(prod.cohortId);
                      }}
                      aria-label={`${prod.productName} 선택`}
                      className={`w-4 h-4 rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-zinc-900 ${
                        !isEligible ? "cursor-not-allowed opacity-40" : "cursor-pointer"
                      }`}
                    />
                  </div>

                  {/* Thumbnail */}
                  <div className="relative w-16 h-16 rounded-lg bg-zinc-800 border border-zinc-700/50 flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {prod.thumbnailUrl ? (
                      <Image
                        src={prod.thumbnailUrl}
                        alt={prod.productName}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <span className="text-xs text-zinc-500 font-mono">NO IMG</span>
                    )}
                  </div>

                  {/* Product Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-zinc-400 font-medium truncate">
                        {prod.brandName || "K SELECT"}
                      </span>
                      {/* Status Badge */}
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1.5 ${badge.badgeClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
                        {badge.label}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-zinc-100 truncate mt-0.5" title={prod.productName}>
                      {prod.productName}
                    </h3>
                    <p className="text-xs text-zinc-400 font-mono mt-0.5">
                      SKU: {prod.productSku}
                    </p>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-zinc-800/80 text-xs">
                      <div>
                        <span className="text-zinc-500 block text-[11px]">최대 청구 가능</span>
                        <span className={`font-semibold ${isEligible ? "text-emerald-400" : "text-zinc-400"}`}>
                          {prod.maxClaimableQuantity}개
                        </span>
                        <span className="text-zinc-500 text-[10px] ml-1">
                          (입고 {prod.fulfilledProtectedQuantity}개)
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[11px]">동결 도매단가</span>
                        <span className="font-semibold text-zinc-200">
                          {formatCurrency(prod.unitWholesalePrice)}
                        </span>
                      </div>
                    </div>

                    {/* Progress / Status Reason Notes */}
                    <div className="mt-2.5 pt-2 border-t border-zinc-800/60">
                      {isEligible ? (
                        <div className="flex items-center justify-between text-[11px] text-emerald-400/90">
                          <span>⏱️ {badge.explanation}</span>
                          <span className="text-zinc-400 font-medium">
                            주간 실사 {prod.distinctReportingWeeks}/8주 완료
                          </span>
                        </div>
                      ) : (
                        <div className="text-[11px] text-zinc-400 flex items-start gap-1">
                          <span className="text-amber-400 flex-shrink-0">ℹ️</span>
                          <span>
                            {prod.statusReason
                              ? formatRetailerFriendlyReason(prod.statusReason)
                              : badge.explanation}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Bottom Action Bar */}
      <div className="sticky bottom-0 bg-zinc-950/90 backdrop-blur border-t border-zinc-800 p-4 -mx-4 sm:-mx-6 sm:px-6 rounded-b-xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-sm text-zinc-400">
          선택된 신청 품목:{" "}
          <strong className="text-emerald-400 text-base font-bold">
            {selectedCount}개
          </strong>
          {selectedCount === 0 && (
            <span className="text-xs text-zinc-500 ml-2">
              (진행하려면 최소 1개 이상의 신청 가능 품목을 선택해 주세요)
            </span>
          )}
        </div>

        <button
          type="button"
          disabled={selectedCount === 0}
          onClick={onNext}
          className={`w-full sm:w-auto px-6 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm ${
            selectedCount > 0
              ? "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 cursor-pointer"
              : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
          }`}
        >
          다음: 보증 옵션 및 수량 선택 →
        </button>
      </div>
    </div>
  );
}
