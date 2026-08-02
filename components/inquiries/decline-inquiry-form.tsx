"use client";

import { useActionState } from "react";
import type { InquiryFormState } from "@/lib/inquiries/actions";

export function DeclineInquiryForm({
  action,
}: {
  action: (state: InquiryFormState, formData: FormData) => Promise<InquiryFormState>;
}) {
  const [state, formAction, pending] = useActionState<InquiryFormState, FormData>(
    action,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex-1">
        <label className="block text-sm font-medium text-zinc-700">사유 (선택, 내부용)</label>
        <input
          name="reason"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50"
      >
        {pending ? "처리 중..." : "거절"}
      </button>
      {state?.error && (
        <p className="w-full text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
