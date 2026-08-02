"use client";

import { useActionState } from "react";
import { signupCompanyAdmin, type SignupFormState } from "@/lib/auth/signup";
import { PASSWORD_RULE_DESCRIPTION } from "@/lib/auth/password";

const inputClass =
  "mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-all focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-zinc-700";
const labelClass = "block text-sm font-medium text-zinc-700 dark:text-zinc-300";

export function SignupForm() {
  const [state, formAction, pending] = useActionState<
    SignupFormState,
    FormData
  >(signupCompanyAdmin, undefined);

  return (
    <div className="w-full max-w-md">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">
        파트너 포털 회원가입
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        회사를 대표해 가입하는 첫 계정은 자동으로 회사 관리자 권한을
        받습니다.
      </p>

      <form action={formAction} className="mt-8 space-y-4">
        <div>
          <label htmlFor="companyName" className={labelClass}>
            회사명
          </label>
          <input
            id="companyName"
            name="companyName"
            required
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="businessRegistrationNumber" className={labelClass}>
            사업자등록번호
          </label>
          <input
            id="businessRegistrationNumber"
            name="businessRegistrationNumber"
            placeholder="123-45-67890"
            required
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="country" className={labelClass}>
            국가
          </label>
          <input
            id="country"
            name="country"
            defaultValue="대한민국"
            required
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="contactName" className={labelClass}>
            담당자 이름
          </label>
          <input
            id="contactName"
            name="contactName"
            required
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="contactPhone" className={labelClass}>
            담당자 연락처
          </label>
          <input
            id="contactPhone"
            name="contactPhone"
            required
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="email" className={labelClass}>
            이메일
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="password" className={labelClass}>
            비밀번호
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            className={inputClass}
          />
          <p className="mt-1 text-xs text-zinc-400">
            {PASSWORD_RULE_DESCRIPTION}
          </p>
        </div>

        <label className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            name="agreedToTerms"
            required
            className="mt-0.5"
          />
          이용약관 및 개인정보 처리방침에 동의합니다.
        </label>

        {state?.error && (
          <p className="text-sm text-red-600 dark:text-red-400 font-medium" role="alert">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
        >
          {pending ? "가입 처리 중..." : "회원가입"}
        </button>
      </form>
    </div>
  );
}
