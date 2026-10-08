"use client";

import { useActionState } from "react";
import type { ResetRequestState } from "@/lib/auth/reset-password";
import { useTranslation } from "@/lib/i18n";

type RetailerForgotPasswordFormProps = {
  action: (
    state: ResetRequestState,
    formData: FormData
  ) => Promise<ResetRequestState>;
};

export function RetailerForgotPasswordForm({ action }: RetailerForgotPasswordFormProps) {
  const { locale } = useTranslation();
  const isKo = locale === "ko";

  const [state, formAction, pending] = useActionState<ResetRequestState, FormData>(
    action,
    undefined
  );

  return (
    <div className="w-full">
      {state?.message ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-300 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-emerald-200 text-sm">
              <span>✉️</span>
              <span>{isKo ? "안내 이메일 발송 완료" : "Instructions Sent"}</span>
            </div>
            <p className="leading-relaxed">
              {isKo
                ? "등록된 계정인 경우 비밀번호 재설정 안내 이메일이 발송되었습니다."
                : state.message}
            </p>
            <p className="text-[11px] text-emerald-400/80 pt-1">
              {isKo
                ? "메일이 도착하지 않은 경우 스팸함을 확인해주세요. 재설정 링크는 30분 동안 유효합니다."
                : "Please check your spam or junk folder if the email does not appear within a few minutes. The reset link is valid for 30 minutes."}
            </p>
          </div>
        </div>
      ) : (
        <form action={formAction} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-300"
            >
              {isKo ? "등록된 이메일 주소" : "Registered Email Address"} <span className="text-rose-400">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="buyer@retailer.com"
              className="mt-1.5 block w-full rounded-lg border border-zinc-700 bg-zinc-800/80 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition-all focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-all hover:bg-zinc-100 disabled:opacity-50 active:scale-[0.99] shadow-sm cursor-pointer"
          >
            {pending 
              ? (isKo ? "안내 메일 발송 중..." : "Sending Reset Instructions...") 
              : (isKo ? "비밀번호 재설정 안내 발송" : "Send Reset Instructions")}
          </button>
        </form>
      )}
    </div>
  );
}
