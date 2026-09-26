"use client";

import React from "react";
import Link from "next/link";
import type { CompanyAgreementItem } from "@/lib/agreement/types";

interface PortalAgreementDashboardBannerProps {
  agreement: CompanyAgreementItem | null;
}

export function PortalAgreementDashboardBanner({ agreement }: PortalAgreementDashboardBannerProps) {
  // If no agreement or agreement is active/expired/terminated/superseded, do not show the pending banner
  if (!agreement || agreement.status === "active") {
    return null;
  }

  return (
    <div className="rounded-2xl border border-amber-250 bg-amber-50/70 p-5 dark:border-amber-900/60 dark:bg-amber-950/30 shadow-xs transition-all animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-lg font-bold">
            ✍️
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 px-2 py-0.5 text-[10px] font-bold border border-amber-200 dark:border-amber-800">
                온보딩 서류 / 계약 체결
              </span>
              <span className="text-xs font-mono font-bold text-amber-900 dark:text-amber-300">
                Version {agreement.version || "1.0"}
              </span>
            </div>
            <h3 className="text-sm font-extrabold text-amber-950 dark:text-amber-200">
              계약 서명 필요 — 브랜드 공급·미국 유통 및 플랫폼 이용 기본계약서
            </h3>
            <p className="text-xs text-amber-800 dark:text-amber-400 leading-relaxed">
              회사 기본계약서를 확인하고 전자서명을 완료해 주세요. (서명 대기 중에도 모든 포털 기능은 정상 이용 가능합니다)
            </p>
          </div>
        </div>

        <div className="shrink-0 flex justify-end">
          <Link
            href="/portal/company/info?tab=agreements"
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-2.5 text-xs font-bold text-white transition-colors shadow-sm cursor-pointer whitespace-nowrap"
          >
            <span>계약서 확인 및 서명</span>
            <span>→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
