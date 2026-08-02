"use client";

import { useActionState } from "react";
import type { InfoRequestFormState } from "@/lib/application/info-request-actions";

type ReplyInfoRequestFormProps = {
  action: (
    state: InfoRequestFormState,
    formData: FormData
  ) => Promise<InfoRequestFormState>;
};

export function ReplyInfoRequestForm({ action }: ReplyInfoRequestFormProps) {
  const [state, formAction, pending] = useActionState<
    InfoRequestFormState,
    FormData
  >(action, undefined);

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <textarea
        name="replyContent"
        rows={3}
        required
        placeholder="회신 내용을 입력해주세요"
        className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-all focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-zinc-700"
      />
      <input
        name="attachment"
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp,.csv,.xlsx"
        className="block text-xs text-zinc-500 dark:text-zinc-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 file:text-zinc-700 dark:file:bg-zinc-850 dark:file:text-zinc-300 hover:file:bg-zinc-200 dark:hover:file:bg-zinc-800"
      />
      {state?.error && (
        <p className="text-xs font-semibold text-rose-600 dark:text-rose-450" role="alert">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
      >
        {pending ? "제출 중..." : "회신 제출"}
      </button>
    </form>
  );
}
