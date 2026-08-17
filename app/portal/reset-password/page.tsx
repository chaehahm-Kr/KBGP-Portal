"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  requestPasswordReset,
  type ResetRequestState,
} from "@/lib/auth/reset-password";

export default function ResetPasswordRequestPage() {
  const [state, formAction, pending] = useActionState<
    ResetRequestState,
    FormData
  >(requestPasswordReset, undefined);

  return (
    <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">
          비밀번호 재설정
        </h1>
        <p className="mt-1 text-xs text-zinc-400">
          가입하신 이메일 주소를 입력하시면 재설정 링크를 보내드립니다.
        </p>

        <form action={formAction} className="mt-8 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-semibold text-white mb-1.5"
            >
              이메일 (Email)
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="example@company.com"
              className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none transition-all focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
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
            className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
          >
            {pending ? "전송 중..." : "재설정 링크 보내기"}
          </button>
        </form>
      </div>

      <div className="flex justify-center border-t border-zinc-800 pt-4">
        <Link
          href="/portal/login"
          className="text-xs font-semibold text-white hover:underline"
        >
          로그인으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
