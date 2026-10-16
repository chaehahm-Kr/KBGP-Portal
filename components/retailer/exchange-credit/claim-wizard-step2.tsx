"use client";

import React from "react";
import Image from "next/image";
import {
  ClaimWizardProductItem,
  ExchangeCreditOption,
  SelectedClaimItem,
} from "./claim-wizard-types";
import {
  calculateWizardTotals,
  formatCurrency,
} from "./claim-wizard-helpers";

interface Step2ChooseExchangeProps {
  productsMap: Map<string, ClaimWizardProductItem>;
  selectedItems: SelectedClaimItem[];
  onChangeOption: (cohortId: string, option: ExchangeCreditOption) => void;
  onChangeQuantity: (cohortId: string, quantity: number) => void;
  onBack: () => void;
  onNext: () => void;
}

export function ClaimWizardStep2({
  productsMap,
  selectedItems,
  onChangeOption,
  onChangeQuantity,
  onBack,
  onNext,
}: Step2ChooseExchangeProps) {
  const totals = calculateWizardTotals(selectedItems);

  return (
    <div className="space-y-6">
      {/* 1. Explanatory Banner */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-5">
        <h2 className="text-lg font-bold text-zinc-100">
          보증 옵션 및 신청 수량 선택
        </h2>
        <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
          품목별로 <strong>Option A (매장 보유 및 부분 크레딧 수령)</strong> 또는{" "}
          <strong>Option B (상품 반품 및 전액 크레딧 수령)</strong> 중 매장 운영에 가장 유리한 방식을 자율적으로 선택하실 수 있습니다.
          동일한 매장 신청 건 내에서 품목마다 서로 다른 옵션을 자유롭게 혼합 지정할 수 있습니다.
        </p>
      </div>

      {/* 2. Selected Items List */}
      <div className="space-y-5">
        {selectedItems.map((item, index) => {
          const product = productsMap.get(item.cohortId);
          if (!product) return null;

          const optionARatePercent = Math.round(product.frozenOptionARate * 100);
          const optionBRatePercent = 100;

          const isOptionA = item.selectedOption === "A";
          const isOptionB = item.selectedOption === "B";

          return (
            <div
              key={item.cohortId}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-6 transition-all"
            >
              {/* Product Header Row */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-800">
                <div className="flex items-start gap-3">
                  <div className="relative w-14 h-14 rounded-lg bg-zinc-800 border border-zinc-700/50 flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {product.thumbnailUrl ? (
                      <Image
                        src={product.thumbnailUrl}
                        alt={product.productName}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <span className="text-[10px] text-zinc-500 font-mono">NO IMG</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[11px] text-zinc-400 font-medium">
                      #{index + 1} · {product.brandName || "K SELECT"}
                    </span>
                    <h3 className="text-base font-semibold text-zinc-100">
                      {product.productName}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1">
                      <span className="font-mono">SKU: {product.productSku}</span>
                      <span>·</span>
                      <span>동결 도매단가: <strong className="text-zinc-200">{formatCurrency(product.unitWholesalePrice)}</strong></span>
                      <span>·</span>
                      <span>최대 신청 가능: <strong className="text-emerald-400">{product.maxClaimableQuantity}개</strong></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Option A vs Option B Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                {/* Option A: Keep & Credit */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onChangeOption(item.cohortId, "A")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onChangeOption(item.cohortId, "A");
                    }
                  }}
                  className={`p-4 rounded-xl border transition-all text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isOptionA
                      ? "bg-emerald-950/20 border-emerald-500 shadow-sm"
                      : "bg-zinc-950/50 border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isOptionA
                            ? "border-emerald-500 bg-emerald-500 text-zinc-950"
                            : "border-zinc-600 bg-transparent"
                        }`}
                      >
                        {isOptionA && <span className="w-1.5 h-1.5 rounded-full bg-zinc-950" />}
                      </span>
                      <span className="text-sm font-bold text-zinc-100">
                        Option A: 매장 보유 (Keep & Credit)
                      </span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      도매가의 {optionARatePercent}% 크레딧
                    </span>
                  </div>

                  <p className="text-xs text-zinc-400 mt-2.5 leading-relaxed">
                    상품을 반품하지 않고 매장에 보유합니다. <strong>실물 반품 절차 없이</strong> 도매가의 {optionARatePercent}%를 플랫폼 크레딧으로 즉시 수령하며, 재고는 매장 자체 할인 행사나 프로모션으로 처분할 수 있습니다.
                  </p>

                  <div className="mt-3.5 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                    <span className="text-zinc-500">반품 배송 여부</span>
                    <span className="text-emerald-400 font-medium">반품 불필요 (No Return)</span>
                  </div>
                </div>

                {/* Option B: Return & Credit */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onChangeOption(item.cohortId, "B")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onChangeOption(item.cohortId, "B");
                    }
                  }}
                  className={`p-4 rounded-xl border transition-all text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    isOptionB
                      ? "bg-indigo-950/20 border-indigo-500 shadow-sm"
                      : "bg-zinc-950/50 border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isOptionB
                            ? "border-indigo-500 bg-indigo-500 text-zinc-950"
                            : "border-zinc-600 bg-transparent"
                        }`}
                      >
                        {isOptionB && <span className="w-1.5 h-1.5 rounded-full bg-zinc-950" />}
                      </span>
                      <span className="text-sm font-bold text-zinc-100">
                        Option B: 반품 환급 (Return & Credit)
                      </span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      도매가의 {optionBRatePercent}% 전액 환급
                    </span>
                  </div>

                  <p className="text-xs text-zinc-400 mt-2.5 leading-relaxed">
                    미판매 재고를 Letusto 물류센터로 반품합니다. <strong>반품 배송비는 Letusto가 전액 부담</strong>(선불 라벨 제공)하며, 입고 검수(미개봉/재판매 가능 상태 확인) 후 도매가 100% 전액을 크레딧으로 발급해 드립니다.
                  </p>

                  <div className="mt-3.5 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                    <span className="text-zinc-500">배송 라벨 / 기한</span>
                    <span className="text-indigo-400 font-medium">선불 라벨 제공 / 승인 후 14일 내 인계</span>
                  </div>
                </div>
              </div>

              {/* Quantity Selector & Line Total */}
              <div className="mt-5 p-4 rounded-lg bg-zinc-950 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <label htmlFor={`qty-input-${item.cohortId}`} className="text-xs text-zinc-400 font-medium whitespace-nowrap">
                    신청 수량 선택:
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={item.selectedQuantity <= 1}
                      onClick={() => onChangeQuantity(item.cohortId, item.selectedQuantity - 1)}
                      className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold flex items-center justify-center transition-colors"
                      aria-label="수량 감소"
                    >
                      −
                    </button>
                    <input
                      id={`qty-input-${item.cohortId}`}
                      type="number"
                      min={1}
                      max={product.maxClaimableQuantity}
                      value={item.selectedQuantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) onChangeQuantity(item.cohortId, val);
                      }}
                      className="w-16 h-8 text-center bg-zinc-900 border border-zinc-700 rounded-lg text-sm font-semibold text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      disabled={item.selectedQuantity >= product.maxClaimableQuantity}
                      onClick={() => onChangeQuantity(item.cohortId, item.selectedQuantity + 1)}
                      className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold flex items-center justify-center transition-colors"
                      aria-label="수량 증가"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeQuantity(item.cohortId, product.maxClaimableQuantity)}
                      className="text-[11px] text-zinc-400 hover:text-emerald-400 underline ml-1.5 transition-colors"
                    >
                      최대 ({product.maxClaimableQuantity}개)
                    </button>
                  </div>
                </div>

                {/* Line Calculation Details */}
                <div className="flex items-center justify-end gap-3 text-right">
                  <div className="text-xs">
                    <span className="text-zinc-500 block text-[11px]">
                      {isOptionA
                        ? `Option A 계산식 (${item.selectedQuantity}개 × ${formatCurrency(product.unitWholesalePrice)} × ${optionARatePercent}%)`
                        : `Option B 계산식 (${item.selectedQuantity}개 × ${formatCurrency(product.unitWholesalePrice)} × 100%)`}
                    </span>
                    <span className="text-lg font-bold text-emerald-400">
                      {formatCurrency(item.estimatedCredit)}
                    </span>
                    <span className="text-[11px] text-zinc-500 ml-1">
                      {isOptionA ? "크레딧 확정 예상액" : "검수 후 발급 예상액"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Summary Bottom Bar */}
      <div className="sticky bottom-0 bg-zinc-950/95 backdrop-blur border-t border-zinc-800 p-4 -mx-4 sm:-mx-6 sm:px-6 rounded-b-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div>
            <span className="text-zinc-500 block">총 신청 수량</span>
            <span className="text-base font-bold text-zinc-200">{totals.totalUnits}개</span>
          </div>
          {totals.totalOptionAUnits > 0 && (
            <div className="border-l border-zinc-800 pl-4">
              <span className="text-zinc-500 block">Option A ({totals.totalOptionAUnits}개)</span>
              <span className="text-sm font-semibold text-emerald-400">
                {formatCurrency(totals.totalOptionACredit)}
              </span>
            </div>
          )}
          {totals.totalOptionBUnits > 0 && (
            <div className="border-l border-zinc-800 pl-4">
              <span className="text-zinc-500 block">Option B ({totals.totalOptionBUnits}개)</span>
              <span className="text-sm font-semibold text-indigo-400">
                {formatCurrency(totals.totalOptionBCredit)}
              </span>
            </div>
          )}
          <div className="border-l border-zinc-800 pl-4">
            <span className="text-zinc-500 block">예상 크레딧 합계</span>
            <span className="text-lg font-black text-emerald-400">
              {formatCurrency(totals.grandTotalEstimatedCredit)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={onBack}
            className="w-1/2 md:w-auto px-4 py-2.5 rounded-lg text-sm font-medium border border-zinc-700 hover:bg-zinc-800 text-zinc-300 transition-colors"
          >
            ← 이전 단계
          </button>
          <button
            type="button"
            disabled={!totals.isValid}
            onClick={onNext}
            className={`w-1/2 md:w-auto px-6 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm ${
              totals.isValid
                ? "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 cursor-pointer"
                : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            }`}
          >
            다음: 최종 검토 및 제출 →
          </button>
        </div>
      </div>
    </div>
  );
}
