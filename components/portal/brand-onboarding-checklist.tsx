"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { skipTeamOnboardingAction } from "@/lib/company/portal-actions";

export interface BrandOnboardingChecklistProps {
  companyId: string;
  companyName: string;
  userEmail: string;
  isCompanyInfoConfirmed: boolean;
  isAdminProfileConfirmed: boolean;
  isTeamComplete: boolean;
  teamCount: number;
  teamSkipped: boolean;
  isBrandConfirmed: boolean;
  brandCount: number;
  brandName?: string | null;
  isProductComplete: boolean;
  completeProductCount: number;
  totalProductCount: number;
  isAgreementComplete: boolean;
  agreementStatus?: string | null;
  agreementVersion?: string | null;
  agreementId?: string | null;
}

export function BrandOnboardingChecklist({
  companyId,
  companyName,
  userEmail,
  isCompanyInfoConfirmed,
  isAdminProfileConfirmed,
  isTeamComplete,
  teamCount,
  teamSkipped,
  isBrandConfirmed,
  brandCount,
  brandName,
  isProductComplete,
  completeProductCount,
  totalProductCount,
  isAgreementComplete,
  agreementStatus,
  agreementVersion,
  agreementId,
}: BrandOnboardingChecklistProps) {
  const [isPending, startTransition] = useTransition();

  const steps = [
    {
      id: "company",
      number: 1,
      title: "회사 정보 확인",
      subtitle: "기본 기업 정보 및 로고 등록",
      description: "회사명, 사업자등록번호, 주소, 웹사이트, 주요 연락처 및 회사 로고를 검토하고 완료해 주세요.",
      isComplete: isCompanyInfoConfirmed,
      statusLabel: isCompanyInfoConfirmed ? "완료 ✓" : "미완료",
      detailText: isCompanyInfoConfirmed ? "회사 정보 확인 완료" : "검토 및 확인 완료 필요",
      ctaLabel: isCompanyInfoConfirmed ? "회사 정보 보기 →" : "회사 정보 확인하기 →",
      ctaHref: "/portal/company/info",
    },
    {
      id: "admin_profile",
      number: 2,
      title: "관리자 정보 확인",
      subtitle: "포털 대표 관리자 프로필",
      description: "대표 관리자의 이름, 직함, 국가번호 및 연락처를 확인하고 저장해 주세요.",
      isComplete: isAdminProfileConfirmed,
      statusLabel: isAdminProfileConfirmed ? "완료 ✓" : "미완료",
      detailText: isAdminProfileConfirmed ? "관리자 프로필 확인 완료" : "직함/연락처 등록 필요",
      ctaLabel: isAdminProfileConfirmed ? "관리자 프로필 보기 →" : "관리자 정보 확인하기 →",
      ctaHref: "/portal/account",
    },
    {
      id: "team",
      number: 3,
      title: "팀원 초대",
      subtitle: "사내 협업 담당자 추가 (선택)",
      description: "포털 관리 및 발주/정산 업무를 함께할 팀원을 초대하세요. (선택 사항이며 건너뛸 수 있습니다)",
      isComplete: isTeamComplete,
      statusLabel: isTeamComplete
        ? teamSkipped && teamCount <= 1
          ? "완료 (건너뜀)"
          : "완료 ✓"
        : "미완료 (선택)",
      detailText:
        teamCount > 1
          ? `현재 팀원 ${teamCount}명 등록됨`
          : teamSkipped
          ? "나중에 하기로 설정됨"
          : "팀원 초대 가능",
      ctaLabel: isTeamComplete ? "팀원 관리 →" : "팀원 초대하기 →",
      ctaHref: "/portal/company/users",
      canSkip: !isTeamComplete,
    },
    {
      id: "brand",
      number: 4,
      title: "브랜드 정보 확인",
      subtitle: "대표 브랜드 및 상표권 등록 여부",
      description: "브랜드 정보와 한국/미국 상표권 등록 여부(예/아니오)를 검토하고 저장하세요.",
      isComplete: isBrandConfirmed,
      statusLabel: isBrandConfirmed ? "완료 ✓" : "미완료",
      detailText: isBrandConfirmed
        ? brandName
          ? `등록 브랜드: ${brandName}`
          : `${brandCount}개 브랜드 확인됨`
        : brandCount > 0
        ? "상표권 등록 여부 검토 필요"
        : "등록된 브랜드 없음",
      ctaLabel: isBrandConfirmed ? "브랜드 관리 →" : "브랜드 정보 확인하기 →",
      ctaHref: "/portal/brands",
    },
    {
      id: "product",
      number: 5,
      title: "상품 등록 완료",
      subtitle: "상품 정식 등록 (필수 규격/바코드)",
      description: "글로벌 유통 및 파트너 매칭을 위해 최소 1개 이상의 상품을 정식 등록(등록 완료)하세요.",
      isComplete: isProductComplete,
      statusLabel: isProductComplete ? "완료 ✓" : "미완료",
      detailText: isProductComplete
        ? `${completeProductCount}개 상품 등록 완료`
        : totalProductCount > 0
        ? "등록 완료된 상품이 없습니다. (Draft/보완 대기 상태)"
        : "등록 완료된 상품이 없습니다.",
      ctaLabel: isProductComplete ? "상품 관리 →" : "상품 등록/보완하기 →",
      ctaHref: "/portal/products",
    },
    {
      id: "agreement",
      number: 6,
      title: "계약서 확인 및 서명",
      subtitle: "기본 공급 및 파트너십 계약",
      description: "브랜드 공급·미국 유통 및 플랫폼 이용 기본계약서를 검토하고 전자서명을 완료하세요.",
      isComplete: isAgreementComplete,
      statusLabel: isAgreementComplete ? "완료 ✓" : "서명 대기",
      detailText: isAgreementComplete
        ? `계약 체결 완료 (${agreementId || "Active"})`
        : `Version ${agreementVersion || "1.0"} 서명 필요`,
      ctaLabel: isAgreementComplete ? "계약서 보기 →" : "계약서 확인 및 서명 →",
      ctaHref: "/portal/company/info?tab=agreements",
    },
  ];

  const completedCount = steps.filter((s) => s.isComplete).length;
  const totalCount = 6;
  const progressPercent = Math.round((completedCount / totalCount) * 100);
  const isAllComplete = completedCount === totalCount;

  const [isCollapsed, setIsCollapsed] = useState(isAllComplete);

  const handleSkipTeam = () => {
    startTransition(async () => {
      try {
        await skipTeamOnboardingAction(companyId);
      } catch (err: any) {
        alert(err?.message || "팀원 초대 건너뛰기 처리에 실패했습니다.");
      }
    });
  };

  return (
    <section aria-labelledby="onboarding-heading" className="w-full rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 p-5 sm:p-6 shadow-sm space-y-5 transition-all">
      {/* Header & Progress Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-black text-xs">
              🚀
            </span>
            <h2 id="onboarding-heading" className="text-base sm:text-lg font-extrabold tracking-tight text-zinc-950 dark:text-white">
              Brand Portal 시작하기
            </h2>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                isAllComplete
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                  : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
              }`}
            >
              {completedCount} / {totalCount} 완료 ({progressPercent}%)
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {isAllComplete
              ? "모든 온보딩 6단계를 완료하셨습니다. 이제 글로벌 유통 및 발주/정산 업무를 자유롭게 진행하실 수 있습니다."
              : "K SELECT NETWORK 글로벌 유통 및 파트너십을 위한 6단계 온보딩 체크리스트입니다. 각 항목을 검토하고 완료해 주세요."}
          </p>
        </div>

        <div className="flex items-center gap-3 self-end md:self-center">
          {/* Progress Bar */}
          <div className="w-36 sm:w-48 space-y-1">
            <div className="flex justify-between text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
              <span>진행률</span>
              <span className="font-mono text-zinc-900 dark:text-white">{progressPercent}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  isAllComplete ? "bg-emerald-500" : "bg-gradient-to-r from-amber-500 to-emerald-500"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Collapse Toggle when all complete */}
          {isAllComplete && (
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
            >
              {isCollapsed ? "체크리스트 열기 ▼" : "접기 ▲"}
            </button>
          )}
        </div>
      </div>

      {/* 6 Onboarding Cards Grid (Visible together) */}
      {!isCollapsed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
          {steps.map((step) => {
            const isDone = step.isComplete;

            return (
              <div
                key={step.id}
                className={`relative flex flex-col justify-between rounded-xl border p-4 transition-all ${
                  isDone
                    ? "border-emerald-200/80 bg-emerald-50/30 dark:border-emerald-950/60 dark:bg-emerald-950/10"
                    : "border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                <div className="space-y-3">
                  {/* Card Header: Step number & Status Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                          isDone
                            ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-zinc-950"
                            : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        {isDone ? "✓" : step.number}
                      </span>
                      <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                        STEP {step.number}
                      </span>
                    </div>

                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold border ${
                        isDone
                          ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800"
                          : "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
                      }`}
                    >
                      {step.statusLabel}
                    </span>
                  </div>

                  {/* Title & Subtitle */}
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                      {step.title}
                    </h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>

                {/* Footer: Detail & CTA Button */}
                <div className="pt-4 mt-3 border-t border-zinc-150 dark:border-zinc-800/80 space-y-2">
                  <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 truncate" title={step.detailText}>
                    {step.detailText}
                  </div>

                  <div className="flex items-center gap-2">
                    {step.ctaHref ? (
                      <Link
                        href={step.ctaHref}
                        className={`flex-1 inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-bold transition-all ${
                          isDone
                            ? "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-750 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                            : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 shadow-sm"
                        }`}
                      >
                        {step.ctaLabel}
                      </Link>
                    ) : (
                      <span className="flex-1 inline-flex items-center justify-center rounded-lg border border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/30 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 cursor-default">
                        {step.ctaLabel}
                      </span>
                    )}

                    {/* Optional Skip button for Team step */}
                    {step.canSkip && (
                      <button
                        type="button"
                        onClick={handleSkipTeam}
                        disabled={isPending}
                        className="px-2.5 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                        title="팀원 초대를 나중에 진행하고 온보딩을 계속합니다"
                      >
                        {isPending ? "처리중..." : "나중에 하기"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
