import type { Metadata } from "next";
import { requireCompanyAdmin } from "@/lib/company/dal";
import { createClient } from "@/lib/supabase/server";
import { InviteUserForm } from "@/components/company/invite-user-form";
import { CompanyUsersManager } from "@/components/company/company-users-manager";

export const metadata: Metadata = {
  title: "소속 사용자 관리 | 파트너 포털",
};

export default async function CompanyUsersPage() {
  const { companyId, userId } = await requireCompanyAdmin();
  const supabase = await createClient();

  // Query company users with detailed permissions and metadata
  let { data: users, error } = await supabase
    .from("company_users")
    .select(
      "id, company_id, name, email, company_role, status, invited_at, joined_at, created_at, title, position, phone, is_primary, permissions"
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  // Safe fallback if database columns do not exist yet (migration 0017 not applied)
  if (error && (error.code === "42703" || error.message.includes("column"))) {
    const { data: fallbackUsers } = await supabase
      .from("company_users")
      .select("id, company_id, name, email, company_role, status, invited_at, joined_at, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true });

    users = (fallbackUsers ?? []).map((u: any) => ({
      ...u,
      title: "",
      position: "",
      phone: "",
      is_primary: false,
      permissions: {},
    }));
  }

  const rows = users ?? [];

  return (
    <div className="space-y-6 w-full max-w-7xl">
      {/* Top Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">소속 사용자 관리</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          같은 회사 동료를 포털에 초대하고, 멤버들의 세부 권한(ACL) 및 로그인 활성 상태를 관리합니다.
        </p>
      </div>

      {/* Invite Form Card */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-4 shadow-sm">
        <h2 className="text-xs font-bold text-zinc-450 uppercase tracking-wider">신규 멤버 초대</h2>
        <InviteUserForm />
      </div>

      {/* Unified User Manager Component */}
      <CompanyUsersManager initialUsers={rows} currentUserId={userId} />
    </div>
  );
}
