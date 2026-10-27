import React from "react";
import { verifyUnsubscribeToken, recordEmailOptOut, maskEmailAddress } from "@/lib/brand-marketing/unsubscribe";
import Link from "next/link";

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-xs border border-stone-200 p-8 text-center space-y-4">
          <div className="text-2xl font-bold tracking-tight text-stone-900">
            K SELECT NETWORK
          </div>
          <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">
            유효하지 않거나 만료된 수신 거부 링크입니다. (Missing Token)
          </div>
          <p className="text-xs text-stone-500 leading-relaxed">
            이메일 본문 하단의 [수신 거부] 링크를 다시 확인하시거나, 관리자에게 문의해 주시기 바랍니다.
          </p>
          <div className="pt-2">
            <Link
              href="https://www.kselectnetwork.com"
              className="text-xs text-stone-600 hover:text-stone-900 underline"
            >
              홈페이지로 이동 →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const result = verifyUnsubscribeToken(token);

  if (!result.valid || !result.email) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-xs border border-stone-200 p-8 text-center space-y-4">
          <div className="text-2xl font-bold tracking-tight text-stone-900">
            K SELECT NETWORK
          </div>
          <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">
            {result.error || "수신 거부 토큰 인증에 실패했습니다."}
          </div>
          <p className="text-xs text-stone-500 leading-relaxed">
            토큰 위변조 또는 서명 불일치로 인해 요청을 처리할 수 없습니다.
          </p>
        </div>
      </div>
    );
  }

  const maskedEmail = maskEmailAddress(result.email);

  async function handleConfirmOptOut() {
    "use server";
    await recordEmailOptOut(result.email!, "UNSUBSCRIBED", undefined, result.campaignId);
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-stone-200 p-8 space-y-6">
        <div className="text-center space-y-1">
          <span className="text-xs font-bold tracking-widest text-stone-400 uppercase">
            Email Preference Center
          </span>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight">
            K SELECT NETWORK
          </h1>
          <p className="text-xs text-stone-500">
            마케팅 이메일 수신 거부 (Unsubscribe)
          </p>
        </div>

        <div className="bg-stone-50 rounded-lg p-4 border border-stone-100 space-y-2 text-xs">
          <div className="text-stone-500">수신 대상 이메일 주소:</div>
          <div className="font-mono font-bold text-stone-800 text-sm">{maskedEmail}</div>
        </div>

        <div className="text-xs text-stone-600 space-y-2 leading-relaxed">
          <p>
            아래 확인 버튼을 클릭하시면, K SELECT NETWORK에서 발송되는 <strong>브랜드 파트너십 및 입점 제안 마케팅 이메일</strong> 수신 대상에서 즉시 제외됩니다.
          </p>
          <p className="text-[11px] text-stone-400">
            * 계약, 주문 처리 및 필수 알림과 관련된 거래성 이메일은 계속 수신될 수 있습니다.
          </p>
        </div>

        <form action={handleConfirmOptOut} className="pt-2 space-y-3">
          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs transition cursor-pointer shadow-xs"
          >
            수신 거부 확인 (Confirm Unsubscribe)
          </button>
        </form>

        <div className="border-t border-stone-100 pt-4 text-center">
          <p className="text-[10px] text-stone-400">
            K SELECT NETWORK · Operated by Letusto Inc.
          </p>
        </div>
      </div>
    </div>
  );
}
