"use client";

import React, { useState, useMemo } from "react";
import {
  ClaimWizardProps,
  ClaimWizardProductItem,
  ExchangeCreditOption,
  SelectedClaimItem,
} from "./claim-wizard-types";
import {
  calculateItemCredit,
} from "./claim-wizard-helpers";
import { ClaimWizardStep1 } from "./claim-wizard-step1";
import { ClaimWizardStep2 } from "./claim-wizard-step2";
import { ClaimWizardStep3 } from "./claim-wizard-step3";
import { submitExchangeClaim } from "@/lib/retailer/exchange-credit-claim-actions";

export type WizardStep = 1 | 2 | 3;

export function ClaimWizardContainer({
  stores,
  selectedStoreId: initialStoreId,
  products,
  isLoading = false,
  errorMessage = null,
  onStoreChange,
  onCancel,
  isPreviewMode = true,
}: ClaimWizardProps) {
  // 1. Store Selection State (Single store context)
  const [selectedStoreId, setSelectedStoreId] = useState<string>(() => {
    if (initialStoreId && stores.some((s) => s.id === initialStoreId)) {
      return initialStoreId;
    }
    return stores[0]?.id || "";
  });

  // Current Step
  const [step, setStep] = useState<WizardStep>(1);

  // Selected Cohort IDs in Step 1
  const [selectedCohortIds, setSelectedCohortIds] = useState<Set<string>>(new Set());

  // Configured Claim Items in Step 2 (Option A/B + Quantity)
  const [configuredItems, setConfiguredItems] = useState<Map<string, { option: ExchangeCreditOption; quantity: number }>>(
    new Map()
  );

  // Map for fast product lookups
  const productsMap = useMemo(() => {
    const map = new Map<string, ClaimWizardProductItem>();
    for (const p of products) {
      map.set(p.cohortId, p);
    }
    return map;
  }, [products]);

  // Handle store change: reset selected items to enforce single-store context
  const handleStoreChange = (newStoreId: string) => {
    setSelectedStoreId(newStoreId);
    setSelectedCohortIds(new Set());
    setConfiguredItems(new Map());
    setStep(1);
    if (onStoreChange) onStoreChange(newStoreId);
  };

  // Toggle single product selection in Step 1
  const handleToggleProduct = (cohortId: string) => {
    const next = new Set(selectedCohortIds);
    if (next.has(cohortId)) {
      next.delete(cohortId);
    } else {
      next.add(cohortId);
      // Initialize with default Option A and full max eligible quantity
      if (!configuredItems.has(cohortId)) {
        const prod = productsMap.get(cohortId);
        if (prod) {
          const nextConfig = new Map(configuredItems);
          nextConfig.set(cohortId, {
            option: "A",
            quantity: prod.maxClaimableQuantity,
          });
          setConfiguredItems(nextConfig);
        }
      }
    }
    setSelectedCohortIds(next);
  };

  // Select all eligible products for current store
  const handleSelectAllEligible = () => {
    const next = new Set<string>();
    const nextConfig = new Map(configuredItems);

    for (const prod of products) {
      if (prod.storeId === selectedStoreId && prod.status === "ELIGIBLE" && prod.maxClaimableQuantity > 0) {
        next.add(prod.cohortId);
        if (!nextConfig.has(prod.cohortId)) {
          nextConfig.set(prod.cohortId, {
            option: "A",
            quantity: prod.maxClaimableQuantity,
          });
        }
      }
    }
    setSelectedCohortIds(next);
    setConfiguredItems(nextConfig);
  };

  // Deselect all
  const handleDeselectAll = () => {
    setSelectedCohortIds(new Set());
  };

  // Change Option (A or B) in Step 2
  const handleChangeOption = (cohortId: string, option: ExchangeCreditOption) => {
    const prod = productsMap.get(cohortId);
    if (!prod) return;

    const existing = configuredItems.get(cohortId) || {
      option: "A",
      quantity: prod.maxClaimableQuantity,
    };
    const nextConfig = new Map(configuredItems);
    nextConfig.set(cohortId, {
      ...existing,
      option,
    });
    setConfiguredItems(nextConfig);
  };

  // Change Quantity in Step 2
  const handleChangeQuantity = (cohortId: string, quantity: number) => {
    const prod = productsMap.get(cohortId);
    if (!prod) return;

    const clampedQty = Math.max(1, Math.min(prod.maxClaimableQuantity, quantity));
    const existing = configuredItems.get(cohortId) || {
      option: "A",
      quantity: prod.maxClaimableQuantity,
    };
    const nextConfig = new Map(configuredItems);
    nextConfig.set(cohortId, {
      ...existing,
      quantity: clampedQty,
    });
    setConfiguredItems(nextConfig);
  };

  // Build resolved SelectedClaimItem list for Steps 2 & 3
  const selectedItems: SelectedClaimItem[] = useMemo(() => {
    const list: SelectedClaimItem[] = [];
    for (const cohortId of selectedCohortIds) {
      const prod = productsMap.get(cohortId);
      if (!prod) continue;

      const conf = configuredItems.get(cohortId) || {
        option: "A",
        quantity: prod.maxClaimableQuantity,
      };

      const { credit, rate } = calculateItemCredit(prod, conf.option, conf.quantity);

      list.push({
        cohortId: prod.cohortId,
        productId: prod.productId,
        productName: prod.productName,
        productSku: prod.productSku,
        brandName: prod.brandName,
        thumbnailUrl: prod.thumbnailUrl,
        selectedOption: conf.option,
        selectedQuantity: conf.quantity,
        maxClaimableQuantity: prod.maxClaimableQuantity,
        unitWholesalePrice: prod.unitWholesalePrice,
        creditRate: rate,
        estimatedCredit: credit,
      });
    }
    return list;
  }, [selectedCohortIds, configuredItems, productsMap]);

  const currentStore = stores.find((s) => s.id === selectedStoreId);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const handleSubmitClaim = async () => {
    if (!selectedStoreId || selectedItems.length === 0) return;
    setIsSubmitting(true);
    setSubmissionError(null);
    try {
      const res = await submitExchangeClaim({
        storeId: selectedStoreId,
        items: selectedItems.map((item) => ({
          cohortId: item.cohortId,
          productId: item.productId,
          selectedOption: item.selectedOption,
          selectedQuantity: item.selectedQuantity,
          currentConfirmedStock: item.selectedQuantity,
        })),
        isStockReconfirmed: true,
        retailerNotes: "Submitted via Retailer Exchange Credit Claim Wizard",
      });

      if (res.success) {
        window.location.href = `/retailer/protection?claim_submitted=${res.claimId || "success"}`;
      } else {
        setSubmissionError(res.error || "클레임 제출에 실패했습니다.");
      }
    } catch (err: any) {
      setSubmissionError(err.message || "네트워크 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stepper UI Steps Definition
  const STEP_DEFINITIONS = [
    { num: 1, label: "품목 선택", sublabel: "보증 대상 SKU 확인" },
    { num: 2, label: "보증 옵션", sublabel: "Option A / B 및 수량" },
    { num: 3, label: "검토 및 신청", sublabel: "최종 내역 확인" },
  ];

  if (isLoading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-medium text-zinc-300 mt-4">
          90일 교환 보증 대상 품목 및 적격 상태를 조회하고 있습니다...
        </p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-8 text-center">
        <span className="text-2xl">⚠️</span>
        <h3 className="text-base font-bold text-rose-400 mt-2">보증 품목 조회 오류</h3>
        <p className="text-sm text-zinc-300 mt-1">{errorMessage}</p>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg transition-colors"
          >
            돌아가기
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl space-y-6">
      {/* 1. Header with Title & Cancel */}
      <div className="flex items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 tracking-wide uppercase">
              90-Day Exchange Credit
            </span>
            <span className="text-xs text-zinc-500">신청 위자드 (3-Step Wizard)</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 mt-1">
            재고 교환 크레딧 신청
          </h1>
        </div>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-900 transition-colors"
          >
            닫기
          </button>
        )}
      </div>

      {/* 2. Responsive Stepper Navigation */}
      <nav aria-label="신청 진행 단계" className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 sm:p-4">
        <ol className="grid grid-cols-3 gap-2 sm:gap-4">
          {STEP_DEFINITIONS.map((s) => {
            const isActive = step === s.num;
            const isCompleted = step > s.num;

            return (
              <li
                key={s.num}
                className={`flex items-center gap-2.5 sm:gap-3 p-2 rounded-lg transition-all ${
                  isActive
                    ? "bg-zinc-800/80 border border-emerald-500/30"
                    : isCompleted
                    ? "text-zinc-300"
                    : "text-zinc-500"
                }`}
              >
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                    isActive
                      ? "bg-emerald-500 text-zinc-950 shadow-sm"
                      : isCompleted
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {isCompleted ? "✓" : s.num}
                </div>
                <div className="min-w-0 hidden sm:block">
                  <span
                    className={`block text-xs font-bold leading-tight ${
                      isActive ? "text-zinc-100" : isCompleted ? "text-zinc-300" : "text-zinc-500"
                    }`}
                  >
                    {s.label}
                  </span>
                  <span className="block text-[11px] text-zinc-500 truncate leading-tight mt-0.5">
                    {s.sublabel}
                  </span>
                </div>
                {/* Mobile Single Label */}
                <span
                  className={`block sm:hidden text-xs font-bold truncate ${
                    isActive ? "text-zinc-100" : "text-zinc-500"
                  }`}
                >
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* 3. Active Step Component Rendering */}
      {step === 1 && (
        <ClaimWizardStep1
          stores={stores}
          selectedStoreId={selectedStoreId}
          onStoreChange={handleStoreChange}
          products={products}
          selectedCohortIds={selectedCohortIds}
          onToggleProduct={handleToggleProduct}
          onSelectAllEligible={handleSelectAllEligible}
          onDeselectAll={handleDeselectAll}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <ClaimWizardStep2
          productsMap={productsMap}
          selectedItems={selectedItems}
          onChangeOption={handleChangeOption}
          onChangeQuantity={handleChangeQuantity}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <ClaimWizardStep3
          store={currentStore}
          productsMap={productsMap}
          selectedItems={selectedItems}
          onBack={() => setStep(2)}
          isPreviewMode={isPreviewMode}
          onSubmit={handleSubmitClaim}
          isSubmitting={isSubmitting}
          submissionError={submissionError}
        />
      )}
    </div>
  );
}
