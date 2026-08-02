"use client";

import { useActionState } from "react";
import type { ApplicationFormState } from "@/lib/application/actions";

type SubmitApplicationButtonProps = {
  action: (
    state: ApplicationFormState,
    formData: FormData
  ) => Promise<ApplicationFormState>;
};

export function SubmitApplicationButton({ action }: SubmitApplicationButtonProps) {
  const [state, formAction, pending] = useActionState<
    ApplicationFormState,
    FormData
  >(action, undefined);

  return (
    <form action={formAction} className="mt-4 rounded-md border border-zinc-200 p-4 dark:border-zinc-800 dark:bg-zinc-900/10">
      <p className="text-xs text-zinc-650 dark:text-zinc-400">
        저장된 내용으로 신청서를 제출합니다. 제출 후에는 직접 수정할 수 없으며 심사가 시작됩니다.
      </p>
      {state?.error && (
        <p className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-450" role="alert">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded-md bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
      >
        {pending ? "제출 중..." : "신청서 제출"}
      </button>
    </form>
  );
}
