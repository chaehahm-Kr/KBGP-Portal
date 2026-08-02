import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  inviteStaffMember,
  setStaffRoles,
  suspendStaffMember,
  reactivateStaffMember,
} from "@/lib/staff/actions";
import type { StaffRole } from "@/lib/staff/types";
import { InviteStaffForm } from "@/components/staff/invite-staff-form";
import { StaffRoleForm } from "@/components/staff/staff-role-form";

export const metadata: Metadata = {
  title: "직원 관리 | 관리자 콘솔",
};

/**
 * 08_주요화면과AC.md 화면 18 "직원 관리 | Super Admin | 역할 부여/회수 즉시 반영,
 * 계정 비활성화 시 즉시 로그인 차단".
 */
export default async function StaffManagementPage() {
  const session = await requireSuperAdmin();
  const supabase = await createClient();

  const { data: staffMembers } = await supabase
    .from("staff_members")
    .select("id, name, email, status, created_at")
    .order("created_at", { ascending: true });

  const { data: roleRows } = await supabase.from("staff_roles").select("staff_id, role");
  const rolesByStaffId = new Map<string, StaffRole[]>();
  for (const row of roleRows ?? []) {
    const list = rolesByStaffId.get(row.staff_id) ?? [];
    list.push(row.role as StaffRole);
    rolesByStaffId.set(row.staff_id, list);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-lg font-semibold text-zinc-900">직원 관리</h1>
      <p className="mt-1 text-sm text-zinc-500">
        내부 직원 계정을 초대하고, 역할을 부여·회수하고, 퇴사 시 계정을 비활성화합니다.
      </p>

      <section className="mt-8 rounded-md border border-zinc-200 p-4">
        <h2 className="text-sm font-semibold text-zinc-900">직원 초대</h2>
        <div className="mt-3">
          <InviteStaffForm action={inviteStaffMember} />
        </div>
      </section>

      <section className="mt-8 space-y-3">
        {(staffMembers ?? []).map((staff) => (
          <div key={staff.id} className="rounded-md border border-zinc-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-900">
                  {staff.name || staff.email}
                  {staff.id === session.userId && (
                    <span className="ml-2 text-xs text-zinc-400">(본인)</span>
                  )}
                </p>
                <p className="text-xs text-zinc-500">{staff.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {staff.status === "active" ? (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800">
                    활성
                  </span>
                ) : (
                  <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs text-zinc-600">
                    비활성화됨
                  </span>
                )}
                {staff.id !== session.userId &&
                  (staff.status === "active" ? (
                    <form action={suspendStaffMember.bind(null, staff.id)}>
                      <button
                        type="submit"
                        className="text-xs text-red-600 underline underline-offset-2"
                      >
                        비활성화
                      </button>
                    </form>
                  ) : (
                    <form action={reactivateStaffMember.bind(null, staff.id)}>
                      <button
                        type="submit"
                        className="text-xs text-zinc-700 underline underline-offset-2"
                      >
                        재활성화
                      </button>
                    </form>
                  ))}
              </div>
            </div>
            <div className="mt-3">
              <StaffRoleForm
                currentRoles={rolesByStaffId.get(staff.id) ?? []}
                action={setStaffRoles.bind(null, staff.id)}
              />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
