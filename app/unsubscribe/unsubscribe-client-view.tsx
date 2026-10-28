"use client";

import React, { useState } from "react";
import Link from "next/link";
import { confirmUnsubscribeAction, ConfirmUnsubscribeResult } from "./actions";

interface UnsubscribeClientViewProps {
  token: string;
  maskedEmail: string;
  initialSuppressed: boolean;
}

export function UnsubscribeClientView({
  token,
  maskedEmail,
  initialSuppressed,
}: UnsubscribeClientViewProps) {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "already" | "error">(
    initialSuppressed ? "already" : "idle"
  );
  const [resultMessage, setResultMessage] = useState<string>(
    initialSuppressed ? "이미 수신 거부 처리가 완료된 이메일 주소입니다." : ""
  );
  const [errorMessage, setErrorMessage] = useState<string>("");

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "submitting" || status === "success" || status === "already") {
      return;
    }

    setStatus("submitting");
    setErrorMessage("");

    try {
      const res: ConfirmUnsubscribeResult = await confirmUnsubscribeAction(token);

      if (res.success) {
        if (res.alreadySuppressed) {
          setStatus("already");
          setResultMessage(res.message || "이미 수신 거부 처리가 완료된 이메일 주소입니다.");
        } else {
          setStatus("success");
          setResultMessage(
            res.message ||
              "수신 거부가 정상적으로 완료되었습니다. 앞으로 K SELECT NETWORK 마케팅 이메일 발송 목록에서 제외됩니다."
          );
        }
      } else {
        setStatus("error");
        setErrorMessage(res.error || "수신 거부 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      }
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err.message || "네트워크 오류가 발생했습니다. 연결 상태를 확인 후 다시 시도해 주세요.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Target Email Box */}
      <div className="bg-stone-50 rounded-lg p-4 border border-stone-200 space-y-1.5 text-xs">
        <div className="text-stone-500 font-medium">수신 대상 이메일 주소:</div>
        <div className="font-mono font-bold text-stone-900 text-sm tracking-wide">
          {maskedEmail}
        </div>
      </div>

      {/* State A: Initial Idle State */}
      {status === "idle" && (
        <>
          <div className="text-xs text-stone-600 space-y-2 leading-relaxed">
            <p>
              아래 확인 버튼을 클릭하시면, K SELECT NETWORK에서 발송되는{" "}
              <strong>브랜드 파트너십 및 입점 제안 마케팅 이메일</strong> 수신 대상에서 즉시 제외됩니다.
            </p>
            <p className="text-[11px] text-stone-400">
              * 계약, 주문 처리 및 필수 시스템 알림과 관련된 거래성 이메일은 계속 수신될 수 있습니다.
            </p>
          </div>

          <form onSubmit={handleConfirm} className="pt-2">
            <button
              type="submit"
              className="w-full py-3 px-4 rounded-lg bg-stone-900 hover:bg-stone-800 active:bg-black text-white font-bold text-xs transition cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              수신 거부 확인 (Confirm Unsubscribe)
            </button>
          </form>
        </>
      )}

      {/* State B: Submitting Loader */}
      {status === "submitting" && (
        <div className="py-6 text-center space-y-3">
          <div className="inline-block w-6 h-6 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin" />
          <p className="text-xs font-medium text-stone-600">
            수신 거부 처리 중입니다. 잠시만 기다려 주세요...
          </p>
          <button
            type="button"
            disabled
            className="w-full py-3 px-4 rounded-lg bg-stone-400 text-white font-bold text-xs cursor-not-allowed opacity-60"
          >
            처리 중... (Processing...)
          </button>
        </div>
      )}

      {/* State C: Successfully Unsubscribed */}
      {status === "success" && (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-center">
            <div className="w-10 h-10 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-lg font-bold">
              ✓
            </div>
            <h3 className="text-sm font-bold text-emerald-900">
              수신 거부가 완료되었습니다
            </h3>
            <p className="text-xs text-emerald-700 leading-relaxed">
              {resultMessage}
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              disabled
              className="w-full py-2.5 px-4 rounded-lg bg-stone-100 text-stone-400 font-bold text-xs cursor-default border border-stone-200"
            >
              ✓ 수신 거부 등록 완료 (Unsubscribed)
            </button>
          </div>
        </div>
      )}

      {/* State D: Already Unsubscribed Previously */}
      {status === "already" && (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-2 text-center">
            <div className="w-10 h-10 mx-auto rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-lg font-bold">
              ℹ
            </div>
            <h3 className="text-sm font-bold text-blue-900">
              이미 수신 거부 처리가 완료된 이메일입니다
            </h3>
            <p className="text-xs text-blue-700 leading-relaxed">
              해당 이메일 주소({maskedEmail})는 이미 마케팅 수신 거부 목록에 등록되어 발송 대상에서 제외되어 있습니다. 추가적인 조치가 필요하지 않습니다.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              disabled
              className="w-full py-2.5 px-4 rounded-lg bg-stone-100 text-stone-400 font-bold text-xs cursor-default border border-stone-200"
            >
              이미 수신 거부됨 (Already Unsubscribed)
            </button>
          </div>
        </div>
      )}

      {/* State E: Error Occurred with Retry */}
      {status === "error" && (
        <div className="space-y-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2 text-center">
            <div className="w-10 h-10 mx-auto rounded-full bg-red-100 flex items-center justify-center text-red-700 text-lg font-bold">
              ✕
            </div>
            <h3 className="text-sm font-bold text-red-900">
              수신 거부 처리 실패
            </h3>
            <p className="text-xs text-red-700 leading-relaxed">
              {errorMessage}
            </p>
          </div>

          <form onSubmit={handleConfirm} className="pt-2">
            <button
              type="submit"
              className="w-full py-3 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition cursor-pointer shadow-xs"
            >
              다시 시도 (Retry)
            </button>
          </form>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="border-t border-stone-100 pt-4 text-center">
        <Link
          href="https://www.kselectnetwork.com"
          className="text-xs text-stone-500 hover:text-stone-800 transition underline underline-offset-4"
        >
          K SELECT NETWORK 홈페이지로 이동 →
        </Link>
      </div>
    </div>
  );
}
