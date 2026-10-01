"use client";

import { useState, useActionState } from "react";
import type { InquiryFormState } from "@/lib/inquiries/actions";
import { CountrySelect } from "@/components/shared/country-select";

export function ConvertInquiryForm({
  action,
}: {
  action: (state: InquiryFormState, formData: FormData) => Promise<InquiryFormState>;
}) {
  const [country, setCountry] = useState("");
  const [state, formAction, pending] = useActionState<InquiryFormState, FormData>(
    action,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">국가</label>
        <CountrySelect
          name="country"
          value={country}
          onChange={setCountry}
          className="mt-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
          placeholder="설립 국가 선택 (선택)"
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
