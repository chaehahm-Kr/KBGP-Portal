"use client";

import React from "react";
import {
  PO_6_STEPS,
  getPoProgressStepIndex,
  OVERALL_STATUS_LABELS,
  OVERALL_STATUS_COLORS,
} from "@/lib/purchase-order/status-helper";

interface PoUnifiedStepperProps {
  overallStatus: string;
  revisionNo?: number;
  supplierConfirmationStatus?: string | null;
  confirmedByName?: string | null;
  confirmedAt?: string | null;
  cancellationStatus?: string | null;
  cancellationReason?: string | null;
  cancellationRequestedAt?: string | null;
  cancellationRejectReason?: string | null;
  cancellationRejectedAt?: string | null;
  nextActionSlot?: React.ReactNode;
  className?: string;
}

export function PoUnifiedStepper({
  overallStatus,
  revisionNo = 1,
  supplierConfirmationStatus,
  confirmedByName,
  confirmedAt,
  cancellationStatus,
  cancellationReason,
  cancellationRequestedAt,
  cancellationRejectReason,
  cancellationRejectedAt,
  nextActionSlot,
  className = "",
}: PoUnifiedStepperProps) {
  const currentStep = getPoProgressStepIndex(overallStatus);
  const isCancelled = overallStatus === "Cancelled" || cancellationStatus === "CANCELLED";

  const formatShortDate = (dStr: string | null | undefined) => {
    if (!dStr) return "";
    return dStr.includes("T") ? dStr.split("T")[0] : dStr;
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Cancellation Alert Banners if applicable */}
      {cancellationStatus === "CANCELLATION_REQUESTED" && !isCancelled && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5 shadow-sm">
          <span className="text-base leading-none">⏳</span>
          <div>
            <span className="font-bold">[공급사 동의 대기]</span> 발주 취소 동의 요청이 진행 중입니다.
            {cancellationReason && (
              <p className="mt-0.5 text-[11px] text-amber-800 dark:text-amber-300">
                취소 요청 사유: {cancellationReason} {cancellationRequestedAt ? `(${formatShortDate(cancellationRequestedAt)})` : ""}
              </p>
            )}
          </div>
        </div>
      )}

      {cancellationStatus === "REJECTED" && !isCancelled && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-200 text-xs flex items-start gap-2.5 shadow-sm">
          <span className="text-base leading-none">⚠️</span>
          <div>
            <span className="font-bold">[취소 요청 거절됨]</span> 공급사가 발주 취소 요청을 거절하여 발주가 정상 유지됩니다.
            {cancellationRejectReason && (
              <p className="mt-0.5 text-[11px] text-rose-800 dark:text-rose-300">
                거절 사유: {cancellationRejectReason} {cancellationRejectedAt ? `(${formatShortDate(cancellationRejectedAt)})` : ""}
              </p>
            )}
          </div>
        </div>
      )}

      {isCancelled && (
        <div className="p-3.5 rounded-xl bg-zinc-100 border border-zinc-300 text-zinc-700 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 text-xs flex items-start gap-2.5 shadow-sm">
          <span className="text-base leading-none">🚫</span>
          <div>
            <span className="font-bold text-rose-600 dark:text-rose-400">[발주 취소됨]</span> 본 발주서는 취소(Cancelled) 처리되어 모든 진행이 중단되었습니다.
          </div>
        </div>
      )}

      {/* Main 6-Step Stepper Card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {/* Header Strip: Overall Status, Revision, Confirmation Pill & Next Action */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-zinc-150 pb-4 dark:border-zinc-800 gap-3">
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">진행 상태</span>
            <span
              className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold border ${
                OVERALL_STATUS_COLORS[overallStatus || "Draft"] ||
                "bg-zinc-100 text-zinc-700 border-zinc-200"
              }`}
            >
              {OVERALL_STATUS_LABELS[overallStatus || "Draft"] || overallStatus}
            </span>

            {revisionNo > 1 && (
              <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold bg-purple-50 border border-purple-200 text-purple-700 dark:bg-purple-950/40 dark:border-purple-900 dark:text-purple-300">
                Rev {revisionNo}
              </span>
            )}

            {supplierConfirmationStatus === "CONFIRMED" && (
              <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300">
                ✓ 공급사 수락 완료 {confirmedByName ? `(${confirmedByName})` : ""}
              </span>
            )}

            {supplierConfirmationStatus === "CHANGE_REQUESTED" && (
              <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300">
                📝 변경 제안 검토중
              </span>
            )}

            {supplierConfirmationStatus === "PENDING" && currentStep === 1 && (
              <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold bg-zinc-100 border border-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300">
                ⏳ 공급사 확인 대기
              </span>
            )}
          </div>

          {nextActionSlot && (
            <div className="flex items-center gap-2 self-end sm:self-auto">
              {nextActionSlot}
            </div>
          )}
        </div>

        {/* 6-Step Visual Stepper */}
        <div className="relative pt-5 pb-2">
          {/* Desktop Timeline */}
          <div className="hidden md:flex justify-between items-start w-full relative">
            {PO_6_STEPS.map((step) => {
              const isCompleted = !isCancelled && currentStep > step.stepNumber;
              const isCurrent = !isCancelled && currentStep === step.stepNumber;

              return (
                <div key={step.key} className="flex flex-col items-center flex-1 relative z-10 text-center px-1">
                  {/* Step Icon / Circle */}
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-200 border-2 ${
                      isCompleted
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                        : isCurrent
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-md ring-4 ring-indigo-100 dark:ring-indigo-950/60"
                        : "bg-white border-zinc-300 text-zinc-400 dark:bg-zinc-900 dark:border-zinc-700"
                    }`}
                  >
                    {isCompleted ? (
                      <svg className="w-3.5 h-3.5 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span>{step.stepNumber}</span>
                    )}
                  </div>

                  {/* Step Title & Subtitle */}
                  <div className="mt-2.5">
                    <div
                      className={`text-[11px] leading-tight font-bold ${
                        isCompleted
                          ? "text-zinc-800 dark:text-zinc-200"
                          : isCurrent
                          ? "text-indigo-600 dark:text-indigo-400 font-extrabold"
                          : "text-zinc-400 dark:text-zinc-500 font-medium"
                      }`}
                    >
                      {step.label}
                    </div>
                    <div
                      className={`text-[10px] mt-0.5 ${
                        isCompleted
                          ? "text-zinc-500 dark:text-zinc-400"
                          : isCurrent
                          ? "text-indigo-500/90 dark:text-indigo-300/90 font-medium"
                          : "text-zinc-400 dark:text-zinc-600"
                      }`}
                    >
                      {step.subLabel}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Background Connecting Bar */}
            <div className="absolute top-[14px] left-[8%] right-[8%] h-0.5 bg-zinc-200 dark:bg-zinc-800 -z-0">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{
                  width: `${
                    isCancelled
                      ? 0
                      : currentStep <= 1
                      ? 0
                      : Math.min(100, ((currentStep - 1) / (PO_6_STEPS.length - 1)) * 100)
                  }%`,
                }}
              />
            </div>
          </div>

          {/* Mobile Timeline */}
          <div className="md:hidden grid grid-cols-3 gap-2">
            {PO_6_STEPS.map((step) => {
              const isCompleted = !isCancelled && currentStep > step.stepNumber;
              const isCurrent = !isCancelled && currentStep === step.stepNumber;

              return (
                <div
                  key={step.key}
                  className={`p-2 rounded-lg border text-center text-xs transition-colors ${
                    isCompleted
                      ? "bg-emerald-50/60 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-300"
                      : isCurrent
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/30 dark:border-indigo-800 dark:text-indigo-300 font-bold ring-1 ring-indigo-400/40"
                      : "bg-zinc-50/50 border-zinc-200 text-zinc-400 dark:bg-zinc-800/30 dark:border-zinc-800 dark:text-zinc-500"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <span className="text-[10px] font-mono opacity-80">{step.stepNumber}.</span>
                    <span className="truncate font-medium text-[11px]">{step.subLabel}</span>
                  </div>
                  {isCompleted && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">완료 ✓</span>}
                  {isCurrent && <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">진행 중 ●</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
