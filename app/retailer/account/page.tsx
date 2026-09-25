import React from "react";
import Link from "next/link";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { ThemeToggle } from "@/components/retailer/theme-toggle";
import { logoutRetailer } from "@/lib/auth/actions";
import { getRetailerTeamData } from "@/lib/retailer/onboarding-actions";
import { TeamManagementView } from "@/components/retailer/team-management-view";

export const dynamic = "force-dynamic";

interface RetailerAccountPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function RetailerAccountPage({ searchParams }: RetailerAccountPageProps) {
  const { tab } = await searchParams;
  const currentTab = tab === "team" ? "team" : "overview";

  const session = await verifyRetailerSession();
  const adminClient = createAdminClient();

  // 1. Fetch user profile
  const { data: profile } = await adminClient
    .from("profiles")
    .select("display_name, email, role")
    .eq("id", session.userId)
    .maybeSingle();

  const displayName = profile?.display_name || session.email.split("@")[0] || "Retailer Partner";

  // 2. Fetch company info
  const { data: companyUser } = await adminClient
    .from("company_users")
    .select("company_id, company_role, companies(id, name, business_registration_number, country)")
    .eq("id", session.userId)
    .maybeSingle();

  const company = companyUser?.companies as any;
  const companyName = company?.name || "K SELECT Test Retailer";
  const businessNumber = company?.business_registration_number || "TEST-REG-001";
  const country = company?.country || "US";

  // 3. Fetch retailer specific role
  const { data: retailerRole } = await adminClient
    .from("retailer_user_roles")
    .select("role, has_all_stores_access")
    .eq("user_id", session.userId)
    .maybeSingle();

  const rawRole = (retailerRole?.role || companyUser?.company_role || "owner").toLowerCase();
  const roleTitle = rawRole.charAt(0).toUpperCase() + rawRole.slice(1);

  // 4. Fetch store access
  const companyId = company?.id || companyUser?.company_id || "7597f742-b9e7-4f67-8fd4-972168eb51ae";
  let storesList: Array<{ id: string; name: string; city?: string }> = [];

  if (companyId) {
    if (retailerRole?.has_all_stores_access || rawRole === "owner" || !retailerRole) {
      const { data: allStores } = await adminClient
        .from("stores")
        .select("id, name, city")
        .eq("company_id", companyId);

      if (allStores && allStores.length > 0) {
        storesList = allStores;
      }
    } else {
      const { data: userStores } = await adminClient
        .from("retailer_user_store_access")
        .select("store_id, stores(id, name, city)")
        .eq("user_id", session.userId);

      if (userStores && userStores.length > 0) {
        storesList = userStores.map((s: any) => s.stores).filter(Boolean);
      }
    }
  }

  if (storesList.length === 0) {
    storesList = [{ id: "effe7832-096c-4ae1-86c7-3cb189b59731", name: "Test Store 01", city: "Los Angeles" }];
  }

  // 5. Fetch team data if viewing or for counts
  let teamMembers: any[] = [];
  let pendingInvitations: any[] = [];

  try {
    const teamData = await getRetailerTeamData(companyId);
    teamMembers = teamData.members;
    pendingInvitations = teamData.invitations;
  } catch (err) {
    console.error("Error loading team data:", err);
  }

  const canViewTeam = ["owner", "buyer"].includes(rawRole);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
            Account & Organization Settings
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Manage your retailer profile, store locations, security preferences, display theme, and staff team access.
          </p>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-px">
        <Link
          href="/account"
          className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-colors border-b-2 -mb-px flex items-center gap-2 ${
            currentTab === "overview"
              ? "border-zinc-900 dark:border-white text-zinc-900 dark:text-white bg-zinc-100/50 dark:bg-zinc-900/50"
              : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
          }`}
        >
          <span>👤</span>
          <span>Profile & Organization</span>
        </Link>

        {canViewTeam && (
          <Link
            href="/account?tab=team"
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-colors border-b-2 -mb-px flex items-center gap-2 ${
              currentTab === "team"
                ? "border-zinc-900 dark:border-white text-zinc-900 dark:text-white bg-zinc-100/50 dark:bg-zinc-900/50"
                : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            <span>👥</span>
            <span>Team & Staff Access</span>
            {pendingInvitations.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-500 text-white">
                {pendingInvitations.length}
              </span>
            )}
          </Link>
        )}
      </div>

      {/* Tab Content */}
      {currentTab === "team" && canViewTeam ? (
        <TeamManagementView
          currentUserRole={rawRole}
          companyId={companyId}
          companyName={companyName}
          stores={storesList}
          initialMembers={teamMembers}
          initialInvitations={pendingInvitations}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* User Profile Card */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-sm font-bold text-zinc-700 dark:text-zinc-300">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Personal Profile
                </h2>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Authenticated user info</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block">Display Name</span>
                <span className="font-semibold text-zinc-900 dark:text-white">{displayName}</span>
              </div>
              <div>
                <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block">Email Address</span>
                <span className="font-mono text-zinc-900 dark:text-white">{session.email}</span>
              </div>
              <div>
                <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block">Retailer Role</span>
                <div className="inline-flex items-center gap-1.5 mt-0.5 px-2.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 capitalize">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  {roleTitle}
                </div>
              </div>
            </div>
          </div>

          {/* Company Card */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-lg">
                🏢
              </div>
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Retail Organization
                </h2>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Company registration</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block">Company Name</span>
                <span className="font-semibold text-zinc-900 dark:text-white">{companyName}</span>
              </div>
              <div>
                <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block">Registration / Tax ID</span>
                <span className="font-mono text-zinc-900 dark:text-white">{businessNumber}</span>
              </div>
              <div>
                <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block">Country</span>
                <span className="font-medium text-zinc-900 dark:text-white">{country}</span>
              </div>
            </div>
          </div>

          {/* Store Locations Card */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg">
                📍
              </div>
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Assigned Store Locations
                </h2>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Stores under your operational scope</p>
              </div>
            </div>

            <div className="space-y-2">
              {storesList.map((st) => (
                <div
                  key={st.id}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs"
                >
                  <div>
                    <span className="font-bold text-zinc-900 dark:text-white block">{st.name}</span>
                    {st.city && <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{st.city}</span>}
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    Active
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Display & Preferences Card */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center text-lg">
                🎨
              </div>
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Theme & Interface
                </h2>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Switch color mode</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-zinc-900 dark:text-white">Color Mode</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Choose between Light, Dark, or System mode</p>
                </div>
                <ThemeToggle />
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <form action={logoutRetailer}>
                <button
                  type="submit"
                  className="w-full py-2 px-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>🚪</span>
                  <span>Sign Out of Retailer Portal</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
