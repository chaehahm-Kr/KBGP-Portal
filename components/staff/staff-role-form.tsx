"use client";

import { useActionState } from "react";
import type { StaffFormState } from "@/lib/staff/actions";
import { STAFF_ROLES, STAFF_ROLE_LABEL, type StaffRole } from "@/lib/staff/types";

type StaffRoleFormProps = {
  currentRoles: StaffRole[];
  action: (state: StaffFormState, formData: FormData) => Promise<StaffFormState>;
};

export function StaffRoleForm({ currentRoles, action }: StaffRoleFormProps) {
  const [state, formAction, pending] = useActionState<StaffFormState, FormData>(
    action,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap gap-3">
        {STAFF_ROLES.map((role) => (
          <label key={role} className="flex items-center gap-1.5 text-xs text-zinc-600">
            <input
              type="checkbox"
              name="roles"
              value={role}
              defaultChecked={currentRoles.includes(role)}
              className="rounded border-zinc-300"
            />
            {STAFF_ROLE_LABEL[role]}
          </label>
        ))}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50"
      >
        {pending ? "저장 중..." : "역할 저장"}
      </button>
      {state?.error && (
        <p className="w-full text-xs text-red-600" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
