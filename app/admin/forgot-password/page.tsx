"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  requestAdminPasswordReset,
  type ResetRequestState,
} from "@/lib/auth/reset-password";

export default function AdminForgotPasswordPage() {
  const [state, formAction, pending] = useActionState<
    ResetRequestState,
    FormData
  >(requestAdminPasswordReset, undefined);

  return (
    <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900/90 p-8 shadow-2xl space-y-6 backdrop-blur-sm">
      {/* KSN Premium Logo & Title */}
      <div className="flex flex-col items-center justify-center text-center space-y-4">
        <div className="max-w-[260px] w-full px-2">
          <img
            src="/ksn-logo-admin.png"
            alt="K SELECT NETWORK"
            className="w-full h-auto object-contain"
          />
        </div>
        <p className="text-[11px] text-zinc-400 font-medium">관리자 비밀번호 재설정</p>
      </div>

      <div className="border-t border-zinc-800 pt-6">
        <p className="text-xs text-zinc-400 mb-4">
          등록된 관리자 계정 이메일을 입력하시면 재설정 링크를 보내드립니다.
        </p>

        <form action={formAction} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-semibold text-zinc-300 mb-1.5"
            >
              이메일 (Email)
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="example@kselectnetwork.com"
              className="block w-full rounded-md border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition-all focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-zinc-700"
            />
          </div>

          {state?.message && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium" role="status">
              {state.message}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 cursor-pointer"
          >
            {pending ? "전송 중..." : "재설정 링크 보내기"}
          </button>
        </form>
      </div>

      <div className="flex justify-center border-t border-zinc-800 pt-4">
        <Link
          href="/admin/login"
          className="text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
        >
          로그인으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
