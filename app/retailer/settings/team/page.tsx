import React from "react";
import Link from "next/link";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRetailerTeamData } from "@/lib/retailer/onboarding-actions";
import { TeamManagementView } from "@/components/retailer/team-management-view";
import { getServerTranslations } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function RetailerTeamSettingsPage() {
  const session = await verifyRetailerSession();
  const adminClient = createAdminClient();
  const { t, locale } = await getServerTranslations();

  // 1. Fetch user profile
  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, display_name, role")
    .eq("id", session.userId)
    .maybeSingle();

  // 2. Fetch company user relation
  const { data: companyUser } = await adminClient
    .from("company_users")
    .select("company_id, company_role, phone, name, status, email")
    .eq("id", session.userId)
    .maybeSingle();

  const companyId = companyUser?.company_id;

  // 3. Fetch authoritative company legal entity
  let companyName = "K SELECT Retailer";
  if (companyId) {
    const { data: compData } = await adminClient
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .maybeSingle();
    if (compData?.name) {
      companyName = compData.name;
    }
  }

  // 4. Fetch retailer specific role
  const { data: retailerRole } = companyId
    ? await adminClient
        .from("retailer_user_roles")
        .select("role, has_all_stores_access")
        .eq("user_id", session.userId)
        .eq("company_id", companyId)
        .maybeSingle()
    : { data: null };

  const rawRole = (retailerRole?.role || companyUser?.company_role || "owner").toLowerCase();
  const canManageTeam = ["owner", "buyer"].includes(rawRole);

  // Authorization Guard: Restricted for staff/viewer
  if (!canManageTeam || !companyId) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center text-2xl mx-auto">
          🔒
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
            {t.account.accessRestrictedTitle}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
            {t.account.accessRestrictedDesc}
          </p>
        </div>
        <div className="pt-2 flex items-center justify-center gap-3">
          <Link
            href="/account"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors shadow-xs"
          >
            <span>←</span>
            <span>{t.account.backToAccount}</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <span>{t.account.backToDashboard}</span>
          </Link>
        </div>
      </div>
    );
  }

  // 5. Fetch stores for assignment
  const { data: allStores } = await adminClient
    .from("stores")
    .select("id, name, city")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  const stores = (allStores || []).map((s) => ({
    id: s.id,
    name: s.name,
    city: s.city || undefined,
  }));

  // 6. Fetch team data
  const { members, invitations } = await getRetailerTeamData(companyId);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
            {t.account.teamSettingsTitle}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {t.account.teamSettingsSubtitle}
          </p>
        </div>
      </div>

      <TeamManagementView
        currentUserRole={rawRole}
        companyId={companyId}
        companyName={companyName}
        stores={stores}
        initialMembers={members}
        initialInvitations={invitations}
      />
    </div>
  );
}
