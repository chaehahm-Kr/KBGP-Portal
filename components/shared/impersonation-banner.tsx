"use client";

import React, { useTransition } from "react";
import type { ImpersonationSessionData } from "@/lib/auth/impersonation";
import { stopImpersonationAction } from "@/lib/auth/impersonation-actions";

interface ImpersonationBannerProps {
  session: ImpersonationSessionData;
}

export function ImpersonationBanner({ session }: ImpersonationBannerProps) {
  const [isPending, startTransition] = useTransition();

  const handleExit = () => {
    startTransition(async () => {
      const res = await stopImpersonationAction();
      if (res.redirectUrl) {
        window.location.href = res.redirectUrl;
      }
    });
  };

  const isRetailer = session.portalType === "RETAILER";

  return (
    <div className="sticky top-0 z-[100] w-full bg-amber-500 text-amber-950 px-4 py-2.5 shadow-md font-sans border-b border-amber-600 flex items-center justify-between text-xs font-semibold animate-fadeIn">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-950 text-amber-100 px-2 py-0.5 text-[10px] font-extrabold font-mono uppercase tracking-wider">
          👀 ADMIN SUPPORT SESSION
        </span>

        <span className="font-extrabold text-zinc-950 text-sm">
          Viewing as {session.targetUserName} ({session.targetUserEmail}) — <span className="underline decoration-amber-700 font-black">{session.targetCompanyName}</span> <span className="text-[11px] font-bold text-amber-950 opacity-90">({isRetailer ? "Retailer Portal" : "Brand Portal"})</span>
        </span>

        <span className="hidden md:inline bg-amber-400/80 text-amber-950 px-2 py-0.5 rounded-md text-[11px] font-medium border border-amber-600/50">
          Reason: {session.reason}{session.note ? ` (${session.note})` : ""}
        </span>

        <span className="hidden xl:inline text-[11px] font-mono text-amber-900 opacity-80">
          Admin: {session.adminEmail}
        </span>
      </div>

      <button
        type="button"
        onClick={handleExit}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-amber-400 px-3.5 py-1.5 text-xs font-extrabold transition-all shadow-xs shrink-0 cursor-pointer disabled:opacity-50"
      >
        <span>✕</span>
        <span>{isPending ? "종료 중..." : "Exit Impersonation (지원 세션 종료)"}</span>
      </button>
    </div>
  );
}
