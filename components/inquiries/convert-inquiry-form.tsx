"use client";

import { useActionState } from "react";
import type { InquiryFormState } from "@/lib/inquiries/actions";

export function ConvertInquiryForm({
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
      <div>
        <label className="block text-sm font-medium text-zinc-700">국가</label>
        <input
          name="country"
          defaultValue="대한민국"
          className="mt-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
      >
        {pending ? "전환 중..." : "회사 등록 + 초대 메일 발송"}
      </button>
      {state?.error && (
        <p className="w-full text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
