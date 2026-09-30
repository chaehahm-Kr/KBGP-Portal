"use client";

import React from "react";
import Link from "next/link";

interface AccessDeniedProps {
  title?: string;
  message?: string;
  categoryLabel?: string;
}

export function AccessDeniedView({
  title = "접근 권한이 없습니다.",
  message = "이 메뉴를 이용할 권한이 없습니다. 회사 관리자에게 권한 설정을 요청해 주세요.",
  categoryLabel,
}: AccessDeniedProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-3xl text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
          🔒
        </div>

        <div className="space-y-2">
          {categoryLabel && (
            <span className="inline-block rounded bg-zinc-100 px-2.5 py-1 text-[11px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {categoryLabel}
            </span>
          )}
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
            {title}
          </h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {message}
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/portal"
            className="w-full sm:w-auto rounded-xl bg-zinc-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-colors shadow-xs"
          >
            🏠 대시보드로 돌아가기
          </Link>
          <Link
            href="/portal/account"
            className="w-full sm:w-auto rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors shadow-2xs"
          >
            👤 My Account
          </Link>
        </div>
      </div>
    </div>
  );
}
