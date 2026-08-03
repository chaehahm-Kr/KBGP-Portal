"use client";

import { useActionState, useState } from "react";
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
  const [showPassword, setShowPassword] = useState(false);
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
          <div className="relative mt-1">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              className="block w-full rounded-md border border-zinc-300 bg-white pl-3 pr-10 py-2 text-sm text-zinc-900 outline-none transition-all focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-zinc-700"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
              aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
            >
              {showPassword ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              )}
            </button>
          </div>
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
