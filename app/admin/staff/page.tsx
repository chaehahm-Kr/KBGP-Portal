import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  inviteStaffMemberAction,
  updateStaffPermissionsAction,
  updateStaffBasicInfoAction,
  updateStaffOrgInfoAction,
  updateStaffStatusAction,
  resetStaffPasswordAction,
  reinviteStaffAction,
  addDepartmentAction,
  toggleDepartmentAction,
  addJobTitleAction,
  toggleJobTitleAction,
} from "@/lib/staff/actions";
import { StaffWorkspace } from "@/components/staff/staff-workspace";

export const metadata: Metadata = {
  title: "직원 및 권한 관리 | 관리자 콘솔",
};

export default async function StaffManagementPage() {
  const session = await requireSuperAdmin();
  const admin = createAdminClient();

  // 1. Fetch staff members with new extended profile columns
  const { data: staff } = await admin
    .from("staff_members")
    .select(`
      id,
      name,
      email,
      status,
      english_name,
      nickname,
      phone,
      profile_picture_url,
      region,
      timezone,
      language,
      department_id,
      job_title_id,
      manager_id,
      hire_date,
      base_role,
      menu_permissions,
      must_change_password,
      last_login_at,
      birthday,
      created_at
    `)
    .order("created_at", { ascending: true });

  // 2. Fetch departments and job titles
  const { data: departments } = await admin
    .from("departments")
    .select("id, name, is_active")
    .order("name", { ascending: true });

  const { data: jobTitles } = await admin
    .from("job_titles")
    .select("id, name, is_active")
    .order("name", { ascending: true });

  // 3. Fetch audit logs (with actor and target display names resolved)
  const { data: rawLogs } = await admin
    .from("staff_audit_logs")
    .select(`
      id,
      actor_id,
      target_id,
      action_type,
      old_values,
      new_values,
      ip_address,
      reason,
      created_at
    `)
    .order("created_at", { ascending: false })
    .limit(40);

  // Fetch names map for logs
  const { data: profiles } = await admin.from("profiles").select("id, display_name");
  const nameMap = new Map((profiles ?? []).map(p => [p.id, p.display_name || "알수없음"]));

  const auditLogs = (rawLogs ?? []).map(log => ({
    id: log.id,
    actor_name: nameMap.get(log.actor_id ?? "") || "시스템",
    target_name: nameMap.get(log.target_id ?? "") || "전체",
    action_type: log.action_type,
    old_values: log.old_values,
    new_values: log.new_values,
    ip_address: log.ip_address || "127.0.0.1",
    reason: log.reason || "",
    created_at: log.created_at,
  }));

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-8.5rem)] overflow-hidden">
      
      {/* Dashboard Top Header Area */}
      <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm shrink-0">
        <h1 className="text-sm font-bold text-zinc-900 dark:text-white">직원 및 권한 관리 (Staff & Permissions)</h1>
        <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal max-w-4xl">
          내부 직원의 부서, 직책, 권한 롤을 제어하고, 메뉴별 CRUD 예외 권한을 개별 튜닝합니다. 
          직원을 신규 초대하면 임시 비밀번호가 발급되며 최초 로그인 시 비밀번호와 기본 인적 정보 입력이 강제됩니다.
        </p>
      </div>

      {/* Main Drag-Resizable Workspace Component */}
      <StaffWorkspace
        currentUserId={session.userId}
        initialStaff={staff || []}
        departments={departments || []}
        jobTitles={jobTitles || []}
        auditLogs={auditLogs}
        inviteAction={inviteStaffMemberAction}
        updatePermissions={updateStaffPermissionsAction}
        updateBasicInfo={updateStaffBasicInfoAction}
        updateOrgInfo={updateStaffOrgInfoAction}
        updateStatus={updateStaffStatusAction}
        resetPassword={resetStaffPasswordAction}
        reinviteStaff={reinviteStaffAction}
        addDept={addDepartmentAction}
        toggleDept={toggleDepartmentAction}
        addTitle={addJobTitleAction}
        toggleTitle={toggleJobTitleAction}
      />
    </div>
  );
}
