"use client";

import { useState, useTransition } from "react";
import { confirmBrandOnboardingAction } from "@/lib/brand/actions";

export function BrandOnboardingBanner({ isConfirmed }: { isConfirmed: boolean }) {
  const [confirmed, setConfirmed] = useState(isConfirmed);
  const [isPending, startTransition] = useTransition();

  if (confirmed) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold">
            ✓
          </span>
          <div>
            <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
              온보딩 4단계: 브랜드 정보 확인 완료
            </p>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
              등록된 브랜드 정보와 상표권 정보가 성공적으로 확인되었습니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleConfirm = () => {
    startTransition(async () => {
      try {
        await confirmBrandOnboardingAction();
        setConfirmed(true);
      } catch (err) {
        console.error("Brand confirmation error:", err);
      }
    });
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/60 dark:bg-amber-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold mt-0.5">
          4
        </span>
        <div>
          <p className="text-xs font-bold text-amber-950 dark:text-amber-200">
            온보딩 4단계: 브랜드 정보 및 상표권 확인 필요
          </p>
          <p className="text-[11px] text-amber-800 dark:text-amber-400 mt-0.5">
            등록된 브랜드 정보, 로고, 대한민국 및 미국 USPTO 상표권 보유 여부를 확인한 후 아래 버튼을 클릭해 주세요.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleConfirm}
        disabled={isPending}
        className="shrink-0 rounded-lg bg-[#131E2E] hover:bg-[#1f3047] px-4 py-2 text-xs font-bold text-white transition-colors disabled:opacity-50 dark:bg-white dark:text-[#131E2E] dark:hover:bg-zinc-100 cursor-pointer shadow-sm"
      >
        {isPending ? "확인 처리 중..." : "브랜드 정보 확인 완료 ✓"}
      </button>
    </div>
  );
}
