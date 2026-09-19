"use client";

import { useActionState } from "react";
import {
  inviteCompanyUser,
  type InviteFormState,
} from "@/lib/company/invite-actions";

const inputClass =
  "mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition-all focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-600";

export function InviteUserForm() {
  const [state, formAction, pending] = useActionState<
    InviteFormState,
    FormData
  >(inviteCompanyUser, undefined);

  return (
    <div className="w-full space-y-3">
      <form
        action={formAction}
        className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 sm:flex-row sm:items-end dark:border-zinc-800 dark:bg-zinc-950/40"
      >
        <div className="flex-1">
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            이름
          </label>
          <input name="name" required placeholder="홍길동" className={inputClass} />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            이메일
          </label>
          <input name="email" type="email" required placeholder="user@example.com" className={inputClass} />
        </div>
        <div className="w-full sm:w-44 shrink-0">
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            역할
          </label>
          <select name="companyRole" defaultValue="company_staff" className={inputClass}>
            <option value="company_staff" className="bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">담당자(Staff)</option>
            <option value="company_admin" className="bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">관리자(Admin)</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-md bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 cursor-pointer"
        >
          {pending ? "초대 중..." : "초대하기"}
        </button>
      </form>
      {state?.error && (
        <div className="rounded-md bg-rose-50 border border-rose-200 p-3 dark:bg-rose-950/30 dark:border-rose-900/50">
          <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 whitespace-pre-line leading-relaxed" role="alert">
            {state.error}
          </p>
        </div>
      )}
    </div>
  );
}
