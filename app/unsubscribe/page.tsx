import React from "react";
import Link from "next/link";
import {
  verifyUnsubscribeToken,
  maskEmailAddress,
  isEmailSuppressed,
} from "@/lib/brand-marketing/unsubscribe";
import { UnsubscribeClientView } from "./unsubscribe-client-view";

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  // 1. Missing Token Edge Case
  if (!token) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-xl shadow-xs border border-stone-200 p-8 text-center space-y-4">
          <div className="text-xl font-bold tracking-tight text-stone-900">
            K SELECT NETWORK
          </div>
          <div className="p-4 bg-amber-50 text-amber-800 text-xs rounded-lg border border-amber-200 space-y-1">
            <div className="font-bold">수신 거부 링크가 올바르지 않습니다</div>
            <div>토큰 정보가 누락되었습니다. (Missing Token)</div>
          </div>
          <p className="text-xs text-stone-500 leading-relaxed">
            이메일 본문 하단의 [수신 거부] 링크를 다시 확인하시거나, 관리자에게 문의해 주시기 바랍니다.
          </p>
          <div className="pt-2">
            <Link
              href="https://www.kselectnetwork.com"
              className="text-xs text-stone-600 hover:text-stone-900 underline underline-offset-4"
            >
              홈페이지로 이동 →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. Token Verification (HMAC Signature & Expiration)
  const result = verifyUnsubscribeToken(token);

  if (!result.valid || !result.email) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-xl shadow-xs border border-stone-200 p-8 text-center space-y-4">
          <div className="text-xl font-bold tracking-tight text-stone-900">
            K SELECT NETWORK
          </div>
          <div className="p-4 bg-red-50 text-red-800 text-xs rounded-lg border border-red-200 space-y-1">
            <div className="font-bold">
              {result.expired ? "수신 거부 링크가 만료되었습니다" : "인증에 실패했습니다"}
            </div>
            <div>{result.error || "유효하지 않거나 위변조된 수신 거부 링크입니다."}</div>
          </div>
          <p className="text-xs text-stone-500 leading-relaxed">
            {result.expired
              ? "보안을 위해 발송 후 180일이 경과한 링크는 만료됩니다. 최신 이메일의 수신 거부 링크를 사용하시거나 직접 수신 거부를 요청해 주세요."
              : "보안 서명이 일치하지 않거나 링크가 손상되었습니다. 이메일 링크를 다시 확인해 주세요."}
          </p>
          <div className="pt-2">
            <Link
              href="https://www.kselectnetwork.com"
              className="text-xs text-stone-600 hover:text-stone-900 underline underline-offset-4"
            >
              홈페이지로 이동 →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. Pre-check if already suppressed in database
  const maskedEmail = maskEmailAddress(result.email);
  const alreadySuppressed = await isEmailSuppressed(result.email);

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-stone-200 p-8 space-y-6">
        <div className="text-center space-y-1">
          <span className="text-[10px] font-bold tracking-widest text-stone-400 uppercase">
            Email Preference Center
          </span>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight">
            K SELECT NETWORK
          </h1>
          <p className="text-xs text-stone-500">
            마케팅 이메일 수신 거부 (Unsubscribe)
          </p>
        </div>

        <UnsubscribeClientView
          token={token}
          maskedEmail={maskedEmail}
          initialSuppressed={alreadySuppressed}
        />

        <div className="border-t border-stone-100 pt-4 text-center">
          <p className="text-[10px] text-stone-400">
            K SELECT NETWORK · Operated by Letusto Inc. · 23B Roland Ave., Mount Laurel, NJ 08054
          </p>
        </div>
      </div>
    </div>
  );
}
