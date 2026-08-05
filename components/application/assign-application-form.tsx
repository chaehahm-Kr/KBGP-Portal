"use client";

import { useActionState } from "react";
import type { AssignmentFormState } from "@/lib/application/assignment-actions";

type AssignApplicationFormProps = {
  action: (
    state: AssignmentFormState,
    formData: FormData
  ) => Promise<AssignmentFormState>;
  staffMembers: { id: string; name: string; email: string }[];
  currentStaffId: string | null;
};

export function AssignApplicationForm({
  action,
  staffMembers,
  currentStaffId,
}: AssignApplicationFormProps) {
  const [state, formAction, pending] = useActionState<
    AssignmentFormState,
    FormData
  >(action, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">담당자</label>
        <select
          name="staffId"
          defaultValue={currentStaffId ?? ""}
          className="mt-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-500 dark:focus:border-zinc-700"
        >
          <option value="" disabled className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-white">
            선택
          </option>
          {staffMembers.map((staff) => (
            <option key={staff.id} value={staff.id} className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-white">
              {staff.name || staff.email}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          배정 사유 (선택)
        </label>
        <input
          name="reason"
          className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-500 dark:focus:border-zinc-700"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
      >
        {pending ? "배정 중..." : "배정"}
      </button>
      {state?.error && (
        <p className="w-full text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
