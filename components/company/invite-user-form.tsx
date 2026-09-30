"use client";

import { useActionState, useState } from "react";
import {
  inviteCompanyUser,
  type InviteFormState,
} from "@/lib/company/invite-actions";
import { CompanyAclMatrixEditor } from "./company-acl-matrix-editor";
import { ROLE_PRESETS } from "@/lib/permissions/brand-portal-acl";

const inputClass =
  "mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 outline-none transition-all focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-600";

export function InviteUserForm() {
  const [state, formAction, pending] = useActionState<
    InviteFormState,
    FormData
  >(inviteCompanyUser, undefined);

  // Default invited member role preset = VIEWER
  const [selectedRole, setSelectedRole] = useState<string>("viewer");
  const [permissions, setPermissions] = useState<Record<string, any>>({
    ...ROLE_PRESETS.viewer,
  });

  return (
    <div className="w-full space-y-4">
      <form
        action={formAction}
        className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 dark:border-zinc-800 dark:bg-zinc-950/40 shadow-xs"
      >
        <input
          type="hidden"
          name="companyRole"
          value={selectedRole === "admin" ? "company_admin" : selectedRole === "staff" ? "company_staff" : selectedRole}
        />
        <input
          type="hidden"
          name="permissionsJson"
          value={JSON.stringify(permissions)}
        />

        {/* Row 1: 영문 성명 (필수) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              영문 성 (English Last Name) <span className="text-rose-500">*</span>
            </label>
            <input name="englishLastName" required placeholder="Hong" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              영문 이름 (English First Name) <span className="text-rose-500">*</span>
            </label>
            <input name="englishFirstName" required placeholder="Gildong" className={inputClass} />
          </div>
        </div>

        {/* Row 2: 한글 성명 (선택) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              한글 성 (Korean Last Name) <span className="text-[10px] text-zinc-400 font-normal">[선택]</span>
            </label>
            <input name="koreanLastName" placeholder="홍" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              한글 이름 (Korean First Name) <span className="text-[10px] text-zinc-400 font-normal">[선택]</span>
            </label>
            <input name="koreanFirstName" placeholder="길동" className={inputClass} />
          </div>
        </div>

        {/* Row 3: 이메일 */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            이메일 (Login Email) <span className="text-rose-500">*</span>
          </label>
          <input name="email" type="email" required placeholder="user@example.com" className={inputClass} />
        </div>

        {/* Row 4: Unified Role Presets & 9-Category ACL Matrix */}
        <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <CompanyAclMatrixEditor
            selectedRole={selectedRole}
            onRoleChange={setSelectedRole}
            permissions={permissions}
            onPermissionsChange={setPermissions}
          />
        </div>

        {/* Submit Row */}
        <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-zinc-950 px-6 py-2.5 text-xs font-bold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 cursor-pointer shadow-sm flex items-center gap-2"
          >
            {pending && (
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white dark:border-zinc-900/30 dark:border-t-zinc-900" />
            )}
            <span>{pending ? "초대 메일 발송 중..." : "초대하기"}</span>
          </button>
        </div>
      </form>

      {state?.message && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 dark:bg-emerald-950/30 dark:border-emerald-900/50">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 whitespace-pre-line leading-relaxed">
            {state.message}
          </p>
        </div>
      )}
      {state?.error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 dark:bg-rose-950/30 dark:border-rose-900/50">
          <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 whitespace-pre-line leading-relaxed" role="alert">
            {state.error}
          </p>
        </div>
      )}
    </div>
  );
}
