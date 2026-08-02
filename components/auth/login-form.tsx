"use client";

import { useActionState } from "react";
import type { LoginFormState } from "@/lib/auth/actions";

type LoginFormProps = {
  action: (
    state: LoginFormState,
    formData: FormData
  ) => Promise<LoginFormState>;
  heading?: string;
  description?: string;
};

export function LoginForm({ action, heading, description }: LoginFormProps) {
  const [state, formAction, pending] = useActionState<
    LoginFormState,
    FormData
  >(action, undefined);

  return (
    <div className="w-full max-w-sm">
      {heading && <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">{heading}</h1>}
      {description && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>}

      <form action={formAction} className="mt-8 space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            이메일
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-all focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-zinc-700"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            비밀번호
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-all focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-zinc-700"
          />
        </div>

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
          {pending ? "로그인 중..." : "로그인"}
        </button>
      </form>
    </div>
  );
}
