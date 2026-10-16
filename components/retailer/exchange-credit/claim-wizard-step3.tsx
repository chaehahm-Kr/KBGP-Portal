"use client";

import React, { useState } from "react";
import {
  ClaimWizardProductItem,
  ClaimWizardStore,
  SelectedClaimItem,
} from "./claim-wizard-types";
import {
  calculateWizardTotals,
  formatCurrency,
} from "./claim-wizard-helpers";

interface Step3ReviewSubmitProps {
  store?: ClaimWizardStore;
  productsMap: Map<string, ClaimWizardProductItem>;
  selectedItems: SelectedClaimItem[];
  onBack: () => void;
  // Read-only / Preview mode prop
  isPreviewMode?: boolean;
}

export function ClaimWizardStep3({
  store,
  productsMap,
  selectedItems,
  onBack,
  isPreviewMode = true,
}: Step3ReviewSubmitProps) {
  const [isStockReconfirmed, setIsStockReconfirmed] = useState(false);
  const totals = calculateWizardTotals(selectedItems);

  return (
    <div className="space-y-6">
      {/* 1. Mandatory Preview Mode Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 sm:p-5 flex items-start gap-3.5">
        <span className="text-xl flex-shrink-0">⚠️</span>
        <div>
          <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wide">
            Preview Mode — 제출 비활성화 안내 (Not Submitted)
          </h2>
          <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
            현재 화면은 90일 교환 크레딧 신청 UI 컴포넌트 프리뷰 상태입니다. 실제 데이터베이스 클레임 테이블 및 제출 액션은 후속 태스크에서 안전하게 연동될 예정이며, 현재 단계에서는 <strong>서버 제출이 의도적으로 비활성화</strong>되어 있습니다.
          </p>
        </div>
      </div>

      {/* 2. Store & Claim Summary Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-4">
          <div>
            <span className="text-xs text-zinc-400 font-medium">신청 매장 정보</span>
            <h3 className="text-base font-bold text-zinc-100 mt-0.5">
              🏪 {store?.name || "매장"} {store?.code ? `(${store.code})` : ""}
            </h3>
            {store?.city && store?.state && (
              <p className="text-xs text-zinc-400 mt-0.5">
                위치: {store.city}, {store.state}
              </p>
            )}
          </div>
          <div className="text-right">
            <span className="text-xs text-zinc-400 font-medium">신청 품목 수</span>
            <div className="text-lg font-bold text-zinc-100">{selectedItems.length}개 SKU</div>
          </div>
        </div>

        {/* Selected Items Table / Cards */}
        <div className="mt-4 divide-y divide-zinc-800/80">
          {selectedItems.map((item, idx) => {
            const prod = productsMap.get(item.cohortId);
            const isOptionA = item.selectedOption === "A";

            return (
              <div key={item.cohortId} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500 font-mono">#{idx + 1}</span>
                    <span className="font-semibold text-zinc-200 text-sm truncate">
                      {item.productName}
                    </span>
                    <span className="font-mono text-zinc-400">({item.productSku})</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-zinc-400">
                    <span>
                      선택 옵션:{" "}
                      <strong className={isOptionA ? "text-emerald-400" : "text-indigo-400"}>
                        {isOptionA ? "Option A (매장 보유)" : "Option B (물류 반품)"}
                      </strong>
                    </span>
                    <span>·</span>
                    <span>
                      신청 수량: <strong className="text-zinc-200">{item.selectedQuantity}개</strong>{" "}
                      <span className="text-zinc-500">(최대 {prod?.maxClaimableQuantity}개)</span>
                    </span>
                    <span>·</span>
                    <span>
                      도매가: {formatCurrency(item.unitWholesalePrice)}
                    </span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <span className="text-zinc-400 text-[11px] block">
                    {isOptionA
                      ? `${item.selectedQuantity}개 × ${formatCurrency(item.unitWholesalePrice)} × ${Math.round(item.creditRate * 100)}%`
                      : `${item.selectedQuantity}개 × ${formatCurrency(item.unitWholesalePrice)} × 100%`}
                  </span>
                  <span className="text-sm font-bold text-emerald-400">
                    {formatCurrency(item.estimatedCredit)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Totals Summary Breakdown */}
        <div className="mt-4 pt-4 border-t border-zinc-800 bg-zinc-950/60 -mx-5 -mb-5 p-5 rounded-b-xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800">
              <span className="text-zinc-400 block text-[11px]">Option A 합계 (매장 보유)</span>
              <span className="text-base font-bold text-emerald-400 mt-1 block">
                {formatCurrency(totals.totalOptionACredit)}
              </span>
              <span className="text-zinc-500 text-[10px]">
                {totals.totalOptionAUnits}개 품목 보유 (반품 불필요)
              </span>
            </div>

            <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800">
              <span className="text-zinc-400 block text-[11px]">Option B 합계 (반품 환급)</span>
              <span className="text-base font-bold text-indigo-400 mt-1 block">
                {formatCurrency(totals.totalOptionBCredit)}
              </span>
              <span className="text-zinc-500 text-[10px]">
                {totals.totalOptionBUnits}개 품목 반품 (검수 후 확정)
              </span>
            </div>

            <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/40">
              <span className="text-emerald-400 block text-[11px] font-semibold">총 예상 크레딧</span>
              <span className="text-xl font-black text-emerald-300 mt-0.5 block">
                {formatCurrency(totals.grandTotalEstimatedCredit)}
              </span>
              <span className="text-zinc-400 text-[10px]">
                총 {totals.totalUnits}개 수량 신청
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Mandatory One-Final-Claim Warning Banner */}
      <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 sm:p-5 flex items-start gap-3.5">
        <span className="text-xl flex-shrink-0">⚠️</span>
        <div className="text-xs text-zinc-300 leading-relaxed">
          <strong className="text-rose-400 font-semibold block text-sm mb-1">
            품목별 1회 최종 보증 신청 원칙 (One-Time Final Claim per SKU)
          </strong>
          90일 교환 보증 제도는 품목 코호트별로 <strong>단 1회만 신청</strong>할 수 있습니다. 
          최대 청구 가능 수량 중 일부 수량만 선택하여 신청하더라도, 본 신청이 제출된 이후에는 <strong>미신청 잔여 수량에 대해 추가 재청구를 진행할 수 없습니다.</strong> 
          반드시 신청 수량을 신중히 확인해 주시기 바랍니다.
        </div>
      </div>

      {/* 4. Return Instructions (If Option B is Selected) */}
      {totals.hasOptionB && (
        <div className="bg-indigo-950/20 border border-indigo-500/30 rounded-xl p-4 sm:p-5">
          <h4 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
            📦 Option B 상품 반품 안내 및 절차
          </h4>
          <ol className="mt-2.5 space-y-2 text-xs text-zinc-300 list-decimal list-inside leading-relaxed">
            <li>
              <strong>반품 라벨 발급:</strong> 승인 완료 후 Letusto 선불 반품 운송장(Prepaid Label)과 RMA 패킹 슬립이 제공됩니다. (반품 운송비 전액 Letusto 부담)
            </li>
            <li>
              <strong>14일 이내 인계:</strong> RMA 승인일로부터 <strong>14일 이내</strong>에 지정 택배사/화물에 상품을 인계해야 보증이 유지됩니다.
            </li>
            <li>
              <strong>창고 입고 및 검수:</strong> 미개봉 및 재판매 가능 상태 확인 후 최종 크레딧이 확정 발급됩니다.
            </li>
          </ol>
        </div>
      )}

      {/* 5. Physical Stock Reconfirmation Checkbox */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-5">
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isStockReconfirmed}
            onChange={(e) => setIsStockReconfirmed(e.target.checked)}
            className="w-4 h-4 rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500 mt-0.5"
          />
          <span className="text-xs text-zinc-200 leading-relaxed font-medium">
            <strong>[필수] 매장 실재고 일치 확인:</strong> 본 신청서에 입력된 각 품목별 수량은 당 매장에 현재 실제 보관 중인 실물 재고와 정확히 일치하며, 
            허위 또는 분실 재고가 포함되지 않았음을 확인합니다.
          </span>
        </label>
      </div>

      {/* 6. Bottom Navigation and Disabled Submission Button */}
      <div className="sticky bottom-0 bg-zinc-950/95 backdrop-blur border-t border-zinc-800 p-4 -mx-4 sm:-mx-6 sm:px-6 rounded-b-xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="w-full sm:w-auto px-4 py-2.5 rounded-lg text-sm font-medium border border-zinc-700 hover:bg-zinc-800 text-zinc-300 transition-colors"
        >
          ← 이전 단계
        </button>

        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            disabled={true}
            title="현재 프리뷰 모드에서는 서버 제출이 비활성화되어 있습니다."
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-sm font-bold bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50 shadow-inner flex items-center justify-center gap-2"
          >
            <span>🔒 교환 크레딧 신청 제출</span>
            <span className="text-[11px] font-normal px-2 py-0.5 rounded bg-zinc-700/60 text-zinc-400">
              프리뷰 — 제출 비활성화
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
