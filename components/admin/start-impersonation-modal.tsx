"use client";

import React, { useState, useTransition } from "react";
import { startImpersonationAction } from "@/lib/auth/impersonation-actions";

interface StartImpersonationModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: {
    id: string;
    name: string;
    email: string;
    status: string;
  } | null;
  targetCompany: {
    id: string;
    name: string;
    portalType: "BRAND" | "RETAILER";
  } | null;
}

const REASON_OPTIONS = [
  { value: "Customer Support", label: "고객 지원 / 문의 응대 (Customer Support)" },
  { value: "Troubleshooting", label: "시스템 문제 해결 및 장애 진단 (Troubleshooting)" },
  { value: "Portal QA", label: "포털 화면 및 기능 검증 (Portal QA)" },
  { value: "User-reported issue", label: "사용자 보고 오류 재현 (User-reported Issue)" },
  { value: "Other", label: "기타 사유 (Other)" },
];

export function StartImpersonationModal({
  isOpen,
  onClose,
  targetUser,
  targetCompany,
}: StartImpersonationModalProps) {
  const [reason, setReason] = useState("Customer Support");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<{
    targetUserName: string;
    targetCompanyName: string;
    portalType: "BRAND" | "RETAILER";
    redirectUrl?: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen || !targetUser || !targetCompany) return null;

  const handleStartSession = (forceRestart = false) => {
    setError(null);
    setActiveSession(null);

    startTransition(async () => {
      const res = await startImpersonationAction({
        targetUserId: targetUser.id,
        targetCompanyId: targetCompany.id,
        portalType: targetCompany.portalType,
        reason,
        note,
        forceRestart,
      });

      if (res.success && res.redirectUrl) {
        window.location.href = res.redirectUrl;
      } else if (res.activeSession) {
        setActiveSession({
          ...res.activeSession,
          redirectUrl: res.redirectUrl,
        });
        setError(res.error || "현재 실행 중인 지원 세션이 있습니다.");
      } else {
        setError(res.error || "지원 세션을 시작할 수 없습니다.");
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleStartSession(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-150 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 font-bold text-sm">
              🔑
            </span>
            <h3 className="text-base font-extrabold text-zinc-900 dark:text-white">
              사용자 계정 지원 세션 (Login as User)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold space-y-2">
            <div>⚠️ {error}</div>
            {activeSession && (
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleStartSession(true)}
                  disabled={isPending}
                  className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer"
                >
                  기존 세션 종료 및 새로 시작
                </button>
                {activeSession.redirectUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      if (activeSession.redirectUrl) {
                        window.location.href = activeSession.redirectUrl;
                      }
                    }}
                    className="rounded-lg bg-zinc-700 hover:bg-zinc-800 text-white px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer"
                  >
                    기존 세션으로 이동
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Target Information Card */}
        <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-700 text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-zinc-400">접속 대상 회사:</span>
            <strong className="text-zinc-900 dark:text-white font-bold">{targetCompany.name}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">접속 대상 사용자:</span>
            <strong className="text-zinc-900 dark:text-white font-bold">
              {targetUser.name} ({targetUser.email})
            </strong>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">대상 포털:</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400">
              {targetCompany.portalType === "RETAILER" ? "Retailer Portal (K SELECT HUB)" : "Brand Portal (K SELECT NETWORK)"}
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Reason */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block">
              접속 사유 (Reason for Access) <span className="text-rose-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              required
            >
              {REASON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Optional Note */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block">
              추가 메모 (Optional Note)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="예: 고객 문의 티켓 #1042 확인 및 화면 재현"
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Security Notice */}
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
            <p className="font-bold flex items-center gap-1">
              <span>🛡️</span> 보안 및 지원 정책 안내
            </p>
            <p className="leading-relaxed opacity-90">
              지원 세션은 최대 60분간 유지되며, 세션 시작/종료 내역이 감사 로그에 영구 기록됩니다. 전자서명 및 계정 관리 등 고위험 작업은 세션 중 자동 차단됩니다.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-150 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 px-4 py-2 text-xs font-bold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-xl bg-amber-500 hover:bg-amber-600 text-amber-950 px-5 py-2 text-xs font-extrabold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isPending ? "세션 생성 중..." : "Start User Session (지원 세션 시작)"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
