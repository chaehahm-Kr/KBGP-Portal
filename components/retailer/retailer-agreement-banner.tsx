"use client";

import React from "react";
import Link from "next/link";
import type { CompanyAgreementItem } from "@/lib/agreement/types";

interface RetailerAgreementBannerProps {
  agreement: CompanyAgreementItem | null;
}

export function RetailerAgreementBanner({ agreement }: RetailerAgreementBannerProps) {
  if (!agreement || agreement.status === "active") {
    return null;
  }

  return (
    <div className="mb-5 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
      <div className="flex items-center gap-3">
        <span className="text-xl">📑</span>
        <div className="text-xs">
          <strong className="font-bold block text-zinc-900 dark:text-white">
            Action Recommended: Retailer Operating Agreement Pending
          </strong>
          <span className="text-zinc-600 dark:text-zinc-300">
            Please review and execute the standard Retailer Supply & Platform Agreement to complete your company onboarding.
          </span>
        </div>
      </div>

      <Link
        href="/account?tab=documents"
        className="px-3.5 py-1.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors shrink-0 text-center"
      >
        Review & Sign Agreement →
      </Link>
    </div>
  );
}
