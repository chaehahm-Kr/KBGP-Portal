"use client";

import { useActionState } from "react";
import type { StaffFormState } from "@/lib/staff/actions";

type InviteStaffFormProps = {
  action: (state: StaffFormState, formData: FormData) => Promise<StaffFormState>;
};

export function InviteStaffForm({ action }: InviteStaffFormProps) {
  const [state, formAction, pending] = useActionState<StaffFormState, FormData>(
    action,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-sm font-medium text-zinc-700">이름</label>
        <input
          name="name"
          required
          className="mt-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700">이메일</label>
        <input
          name="email"
          type="email"
          required
          className="mt-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
      >
        {pending ? "초대 중..." : "초대"}
      </button>
      {state?.error && (
        <p className="w-full text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
