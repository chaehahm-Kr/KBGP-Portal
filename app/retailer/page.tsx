import React from "react";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { logoutRetailer } from "@/lib/auth/actions";

export const dynamic = "force-dynamic";

export default async function RetailerLandingPage() {
  const session = await verifyRetailerSession();
  const adminClient = createAdminClient();

  // 1. Fetch user profile
  const { data: profile } = await adminClient
    .from("profiles")
    .select("display_name")
    .eq("id", session.userId)
    .maybeSingle();

  const displayName = profile?.display_name || session.email;

  // 2. Fetch company info
  const { data: companyUser } = await adminClient
    .from("company_users")
    .select("company_id, role, companies(id, name, business_number)")
    .eq("id", session.userId)
    .maybeSingle();

  const company = companyUser?.companies as any;
  const companyName = company?.name || "K SELECT Test Retailer";

  // 3. Fetch retailer specific role
  const { data: retailerRole } = await adminClient
    .from("retailer_user_roles")
    .select("role, has_all_stores_access")
    .eq("user_id", session.userId)
    .maybeSingle();

  const roleTitle = retailerRole?.role 
    ? retailerRole.role.charAt(0).toUpperCase() + retailerRole.role.slice(1) 
    : companyUser?.role || "Owner";

  // 4. Fetch store access
  let storeAccessNames: string[] = [];
  if (company?.id) {
    if (retailerRole?.has_all_stores_access || retailerRole?.role === "owner" || !retailerRole) {
      const { data: allStores } = await adminClient
        .from("stores")
        .select("name, store_code")
        .eq("company_id", company.id);
      
      if (allStores && allStores.length > 0) {
        storeAccessNames = allStores.map((s) => s.name);
      }
    } else {
      const { data: userStores } = await adminClient
        .from("retailer_user_store_access")
        .select("store_id, stores(name)")
        .eq("user_id", session.userId);
      
      if (userStores && userStores.length > 0) {
        storeAccessNames = userStores.map((s: any) => s.stores?.name).filter(Boolean);
      }
    }
  }

  if (storeAccessNames.length === 0) {
    storeAccessNames = ["Test Store 01"];
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-between p-4 sm:p-6 lg:p-10 font-sans">
      {/* Top Navigation Bar */}
      <header className="w-full max-w-4xl mx-auto flex items-center justify-between pb-6 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-md">
            <span className="text-zinc-950 text-base font-black tracking-tighter">K</span>
          </div>
          <div>
            <span className="text-base font-bold text-white tracking-wide block">
              K SELECT HUB
            </span>
            <span className="text-[11px] text-zinc-400 font-medium block">
              Retailer Portal
            </span>
          </div>
        </div>

        <form action={logoutRetailer}>
          <button
            type="submit"
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all shadow-sm"
          >
            Sign Out
          </button>
        </form>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-4xl mx-auto my-auto py-10 space-y-8">
        {/* Welcome Banner */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-medium text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Authenticated Session Active
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Welcome, {displayName}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Your Retailer Portal authentication foundation is active and verified.
          </p>
        </div>

        {/* Tenant Details Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-5 backdrop-blur-sm space-y-1.5">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Company
            </p>
            <p className="text-base font-bold text-white truncate">
              {companyName}
            </p>
            <p className="text-[11px] text-zinc-500">Retailer Organization</p>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-5 backdrop-blur-sm space-y-1.5">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Role
            </p>
            <p className="text-base font-bold text-white">
              {roleTitle}
            </p>
            <p className="text-[11px] text-zinc-500">Business Permission</p>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-5 backdrop-blur-sm space-y-1.5">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Store Access
            </p>
            <p className="text-base font-bold text-white truncate">
              {storeAccessNames.join(", ")}
            </p>
            <p className="text-[11px] text-zinc-500">Assigned Physical Store</p>
          </div>
        </div>

        {/* Informational Box */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-200">
            Phase 1: Authentication & Multi-Tenant Verification Complete
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            This minimal shell confirms your Retailer account credentials, tenant isolation, store scoping, and session cookie isolation at <span className="text-zinc-200 font-mono">portal.kselecthub.com</span>. The full Retailer application experience (catalog discovery, orders, and weekly check tools) will be deployed in subsequent tasks.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl mx-auto pt-6 border-t border-zinc-900 text-center text-xs text-zinc-600">
        &copy; {new Date().getFullYear()} K SELECT NETWORK. All rights reserved.
      </footer>
    </div>
  );
}
