"use client";

import { useActionState } from "react";
import type { ReviewNoteFormState } from "@/lib/application/review-note-actions";

type AddReviewNoteFormProps = {
  action: (
    state: ReviewNoteFormState,
    formData: FormData
  ) => Promise<ReviewNoteFormState>;
  products: { id: string; name: string }[];
};

export function AddReviewNoteForm({ action, products }: AddReviewNoteFormProps) {
  const [state, formAction, pending] = useActionState<
    ReviewNoteFormState,
    FormData
  >(action, undefined);

  return (
    <form action={formAction} className="space-y-2 rounded-md border border-zinc-200 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          name="applicationProductId"
          defaultValue=""
          className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-500 dark:focus:border-zinc-700"
        >
          <option value="" className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-white">신청서 전체 대상</option>
          {products.map((p) => (
            <option key={p.id} value={p.id} className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-white">
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <textarea
        name="content"
        rows={2}
        required
        placeholder="외부에는 절대 노출되지 않는 내부 메모입니다"
        className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-500 dark:focus:border-zinc-700"
      />
      {state?.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
      >
        {pending ? "저장 중..." : "메모 추가"}
      </button>
    </form>
  );
}
