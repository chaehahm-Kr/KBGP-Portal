"use client";

import React from "react";
import {
  CheckoutCreditItem,
  CreditEligibilityResult,
  CheckoutTotalsCalculationResult
} from "@/lib/retailer/exchange-credit-checkout";

interface ExchangeCreditCheckoutSelectorProps {
  credits: CheckoutCreditItem[];
  evaluations: Record<string, CreditEligibilityResult>;
  selectedCreditId: string | null;
  onSelectCredit: (creditId: string | null) => void;
  totals: CheckoutTotalsCalculationResult;
  isGateEnabled?: boolean;
}

export function ExchangeCreditCheckoutSelector({
  credits,
  evaluations,
  selectedCreditId,
  onSelectCredit,
  totals,
  isGateEnabled = false
}: ExchangeCreditCheckoutSelectorProps) {
  if (!credits || credits.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-indigo-100 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs">
            $
          </span>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              보유 교환 크레딧 적용 (90-Day Exchange Credit)
            </h3>
            <p className="text-xs text-gray-500">
              소속 리테일러 회사의 유효한 교환 크레딧을 상품 주문 결제에 전액 1회 차감합니다.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
          전액 1회 차감 원칙
        </span>
      </div>

      {/* Feature Gate Banner */}
      {!isGateEnabled && (
        <div className="mt-3 rounded-lg bg-amber-50 p-3 border border-amber-200">
          <div className="flex items-start gap-2">
            <span className="text-amber-700 text-xs font-semibold">안내:</span>
            <p className="text-xs text-amber-800 leading-relaxed">
              교환 크레딧 결제 차감 기능은 현재 <strong>안전 점검 프리뷰(Feature-Gated)</strong> 모드입니다. 보유 크레딧 내역과 적격 상품 계산식을 미리 확인할 수 있으나, 실제 결제 차감은 활성화되지 않습니다.
            </p>
          </div>
        </div>
      )}

      {/* Available Credits List */}
      <div className="mt-4 space-y-3">
        {credits.map((credit) => {
          const evalResult = evaluations[credit.id];
          const isSelected = selectedCreditId === credit.id;
          const isEligible = evalResult?.eligible;

          return (
            <div
              key={credit.id}
              className={`rounded-lg border p-3 transition-all ${
                isSelected
                  ? "border-indigo-600 bg-indigo-50/40"
                  : isEligible
                  ? "border-gray-200 hover:border-gray-300"
                  : "border-gray-200 bg-gray-50/60 opacity-80"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id={`credit-${credit.id}`}
                    name="exchange-credit-selection"
                    checked={isSelected}
                    disabled={!isGateEnabled || !isEligible}
                    onChange={() => onSelectCredit(isSelected ? null : credit.id)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                  />
                  <label
                    htmlFor={`credit-${credit.id}`}
                    className="font-medium text-sm text-gray-900 cursor-pointer"
                  >
                    {credit.creditCode}
                  </label>
                  <span className="font-bold text-sm text-indigo-700">
                    ${(credit.creditAmountCents / 100).toFixed(2)}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-xs text-gray-500">
                    만료일: {new Date(credit.expiresAt).toLocaleDateString("ko-KR")}
                  </span>
                </div>
              </div>

              {/* Exclusion info & eligibility message */}
              <div className="mt-2 text-xs space-y-1 pl-6">
                {credit.originatingSku && (
                  <p className="text-gray-500">
                    • 발생 원인 제품 제외: <span className="font-medium text-gray-700">{credit.originatingSku}</span>
                  </p>
                )}

                {evalResult && !evalResult.eligible && (
                  <p className="text-rose-600 font-medium">
                    ⚠️ {evalResult.rejectionMessage}
                  </p>
                )}

                {evalResult && evalResult.eligible && (
                  <p className="text-emerald-700 font-medium">
                    ✓ 적격 상품 금액(${(evalResult.eligibleSubtotalCents / 100).toFixed(2)})이 충족되어 전액 차감 가능합니다.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Applied Credit Summary */}
      {totals.isCreditApplied && (
        <div className="mt-4 rounded-lg bg-gray-50 p-3 text-xs space-y-1.5 border border-gray-200">
          <div className="flex justify-between text-gray-600">
            <span>주문 상품 총액:</span>
            <span>${totals.subtotalDollars.toFixed(2)}</span>
          </div>
          {totals.excludedSkuAmountCents > 0 && (
            <div className="flex justify-between text-amber-700">
              <span>제외 품목(원인 SKU) 금액:</span>
              <span>-${totals.excludedSkuAmountDollars.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-indigo-700 font-medium border-t border-gray-200 pt-1">
            <span>교환 크레딧 차감 ({totals.appliedCreditCode}):</span>
            <span>-${totals.appliedCreditAmountDollars.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-900 font-bold border-t border-gray-200 pt-1">
            <span>차감 후 실 결제 필요 금액 (배송비/세금 포함):</span>
            <span>${totals.totalPayableDollars.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
