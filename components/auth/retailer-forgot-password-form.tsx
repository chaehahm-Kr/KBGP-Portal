"use client";

import { useActionState } from "react";
import type { ResetRequestState } from "@/lib/auth/reset-password";

type RetailerForgotPasswordFormProps = {
  action: (
    state: ResetRequestState,
    formData: FormData
  ) => Promise<ResetRequestState>;
};

export function RetailerForgotPasswordForm({ action }: RetailerForgotPasswordFormProps) {
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
              <span>Instructions Sent</span>
            </div>
            <p className="leading-relaxed">{state.message}</p>
            <p className="text-[11px] text-emerald-400/80 pt-1">
              Please check your spam or junk folder if the email does not appear within a few minutes. The reset link is valid for 30 minutes.
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
              Registered Email Address <span className="text-rose-400">*</span>
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
            {pending ? "Sending Reset Instructions..." : "Send Reset Instructions"}
          </button>
        </form>
      )}
    </div>
  );
}
