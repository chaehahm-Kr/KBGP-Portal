"use client";

import React, { useState } from "react";
import Link from "next/link";

export interface OnboardingStepItem {
  step: number;
  id: string;
  name: string;
  isComplete: boolean;
  isSkipped?: boolean;
}

export interface CompanyOnboardingPopoverProps {
  onboardingStatus?: "completed" | "in_progress" | "not_started" | "not_applicable";
  onboardingBadgeText?: string;
  completedCount?: number;
  totalCount?: number;
  steps?: OnboardingStepItem[];
  companyId?: string | null;
}

const CANONICAL_STEPS: { step: number; id: string; name: string }[] = [
  { step: 1, id: "company", name: "회사 정보 확인" },
  { step: 2, id: "admin_profile", name: "관리자 정보 확인" },
  { step: 3, id: "brand", name: "브랜드 정보 확인" },
  { step: 4, id: "team", name: "팀원 초대" },
  { step: 5, id: "tasks", name: "담당업무 및 주 담당자 지정" },
  { step: 6, id: "product", name: "상품 등록 완료" },
  { step: 7, id: "agreement", name: "상품공급 및 플랫폼 이용 약관 확인·서명" },
];

export function CompanyOnboardingPopover({
  onboardingStatus = "not_started",
  onboardingBadgeText = "0 / 7 미시작",
  completedCount = 0,
  totalCount = 7,
  steps = [],
  companyId,
}: CompanyOnboardingPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getBadgeStyle = (status: "completed" | "in_progress" | "not_started" | "not_applicable") => {
    if (status === "completed") {
      return "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800";
    }
    if (status === "in_progress") {
      return "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800";
    }
    if (status === "not_applicable") {
      return "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-850 dark:text-zinc-400 dark:border-zinc-700 cursor-default";
    }
    return "bg-zinc-100 text-zinc-600 border-zinc-200 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700";
  };

  // Map provided steps or generate default 7 steps list
  const resolvedSteps = CANONICAL_STEPS.map((cs) => {
    const found = steps.find((s) => s.step === cs.step || s.id === cs.id);
    return {
      step: cs.step,
      id: cs.id,
      name: cs.name,
      isComplete: Boolean(found?.isComplete),
      isSkipped: Boolean(found?.isSkipped),
    };
  });

  const displayCompletedCount = steps.length > 0 ? steps.filter((s) => s.isComplete).length : completedCount;
  const isNna = onboardingStatus === "not_applicable";

  const BadgeContent = (
    <span
      className={`inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border transition-colors cursor-pointer select-none ${getBadgeStyle(
        onboardingStatus
      )}`}
    >
      {onboardingBadgeText}
    </span>
  );

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => !isNna && setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => !isNna && setIsOpen(true)}
      onBlur={() => setIsOpen(false)}
    >
      {companyId ? (
        <Link href={`/admin/companies/${companyId}`} title="온보딩 상세 보기 (회사 상세 이동)">
          {BadgeContent}
        </Link>
      ) : (
        BadgeContent
      )}

      {isOpen && !isNna && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 w-72 rounded-xl border border-zinc-200 bg-white p-3.5 shadow-2xl dark:border-zinc-700 dark:bg-zinc-950 text-left animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-800 pb-2 mb-2">
            <span className="text-[11px] font-extrabold text-zinc-900 dark:text-white flex items-center gap-1.5">
              <span>📋</span>
              <span>온보딩 진행 상태</span>
            </span>
            <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 font-mono">
              {displayCompletedCount} / {totalCount} 완료
            </span>
          </div>

          <div className="space-y-1.5 text-[11px]">
            {resolvedSteps.map((s) => (
              <div
                key={s.step}
                className={`flex items-center justify-between py-0.5 px-1.5 rounded transition-colors ${
                  s.isComplete
                    ? "bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 font-bold"
                    : "text-zinc-500 dark:text-zinc-400 font-medium"
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-mono text-[10px] shrink-0 font-bold">
                    {s.isComplete ? (
                      <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-600">○</span>
                    )}
                  </span>
                  <span className="truncate">
                    <span className="text-[9px] text-zinc-400 mr-1 font-mono">STEP {s.step}</span>
                    <span>{s.name}</span>
                  </span>
                </div>
                {s.isComplete && s.isSkipped && (
                  <span className="ml-1 shrink-0 text-[9px] px-1 py-0.2 rounded bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 font-normal">
                    건너뜀
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Arrow */}
          <div className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-r border-b border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950" />
        </div>
      )}
    </div>
  );
}
