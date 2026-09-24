import React from "react";
import Link from "next/link";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function RetailerHomePage() {
  const session = await verifyRetailerSession();
  const adminClient = createAdminClient();

  // 1. Fetch user profile
  const { data: profile } = await adminClient
    .from("profiles")
    .select("display_name")
    .eq("id", session.userId)
    .maybeSingle();

  const displayName = profile?.display_name || session.email.split("@")[0] || "Retailer Partner";

  // 2. Fetch company info
  const { data: companyUser } = await adminClient
    .from("company_users")
    .select("company_id, company_role, companies(id, name, business_registration_number)")
    .eq("id", session.userId)
    .maybeSingle();

  const company = companyUser?.companies as any;
  const companyName = company?.name || "K SELECT Test Retailer";
  const companyId = company?.id || companyUser?.company_id;

  // 3. Fetch retailer specific role
  const { data: retailerRole } = await adminClient
    .from("retailer_user_roles")
    .select("role, has_all_stores_access")
    .eq("user_id", session.userId)
    .maybeSingle();

  const roleTitle = retailerRole?.role
    ? retailerRole.role.charAt(0).toUpperCase() + retailerRole.role.slice(1)
    : companyUser?.company_role || "Owner";

  // 4. Fetch store access
  let storeNames: string[] = [];
  if (companyId) {
    if (retailerRole?.has_all_stores_access || retailerRole?.role === "owner" || !retailerRole) {
      const { data: allStores } = await adminClient
        .from("stores")
        .select("name")
        .eq("company_id", companyId);

      if (allStores && allStores.length > 0) {
        storeNames = allStores.map((s) => s.name);
      }
    } else {
      const { data: userStores } = await adminClient
        .from("retailer_user_store_access")
        .select("store_id, stores(name)")
        .eq("user_id", session.userId);

      if (userStores && userStores.length > 0) {
        storeNames = userStores.map((s: any) => s.stores?.name).filter(Boolean);
      }
    }
  }

  if (storeNames.length === 0) {
    storeNames = ["Test Store 01"];
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950 p-6 sm:p-8 text-white shadow-xl border border-zinc-700/50 dark:border-zinc-800">
        <div className="max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-semibold text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Verified Wholesale Partner
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Welcome, {displayName}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-300">
            Explore verified K-Beauty brands, check store merchandising status, and manage wholesale replenishment for your stores.
          </p>
        </div>
      </div>

      {/* Real Account & Store Context Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm space-y-1">
          <p className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
            Retail Organization
          </p>
          <p className="text-base font-bold text-zinc-900 dark:text-white truncate">
            {companyName}
          </p>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Authorized Account</p>
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm space-y-1">
          <p className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
            User Role
          </p>
          <p className="text-base font-bold text-zinc-900 dark:text-white capitalize">
            {roleTitle}
          </p>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Wholesale Authority</p>
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm space-y-1">
          <p className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
            Store Access
          </p>
          <p className="text-base font-bold text-zinc-900 dark:text-white truncate">
            📍 {storeNames.join(", ")}
          </p>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Assigned Location</p>
        </div>
      </div>

      {/* Primary Action-Oriented Portals */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">
            Retailer Quick Actions
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Access your core retail workflows and product discovery tools
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: Products */}
          <Link
            href="/retailer/products"
            className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm hover:border-zinc-400 dark:hover:border-zinc-600 transition-all space-y-3"
          >
            <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg group-hover:scale-105 transition-transform">
              📦
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                Product Discovery
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                Browse verified K-Beauty brands, view wholesale tier pricing, and check inventory.
              </p>
            </div>
          </Link>

          {/* Card 2: Weekly Check */}
          <Link
            href="/retailer/check"
            className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm hover:border-zinc-400 dark:hover:border-zinc-600 transition-all space-y-3"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg group-hover:scale-105 transition-transform">
              📋
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                Weekly Product Check
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                Submit weekly shelf presence and retail selling price checks directly from your store.
              </p>
            </div>
          </Link>

          {/* Card 3: Orders */}
          <Link
            href="/retailer/orders"
            className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm hover:border-zinc-400 dark:hover:border-zinc-600 transition-all space-y-3"
          >
            <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-lg group-hover:scale-105 transition-transform">
              🛒
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                Order History & Reorder
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                Track submitted purchase orders, shipment tracking numbers, and delivery confirmations.
              </p>
            </div>
          </Link>

          {/* Card 4: Sales & Reorder */}
          <Link
            href="/retailer/sales"
            className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm hover:border-zinc-400 dark:hover:border-zinc-600 transition-all space-y-3"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-lg group-hover:scale-105 transition-transform">
              📊
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                Sales & Reorder Analytics
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                Review store replenishment suggestions, estimated stock runout, and reorder alerts.
              </p>
            </div>
          </Link>

          {/* Card 5: Training */}
          <Link
            href="/retailer/training"
            className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm hover:border-zinc-400 dark:hover:border-zinc-600 transition-all space-y-3"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-lg group-hover:scale-105 transition-transform">
              🎓
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                Product Training & Guides
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                Access product selling points, brand training videos, and customer FAQ cheat-sheets.
              </p>
            </div>
          </Link>

          {/* Card 6: Stores */}
          <Link
            href="/retailer/stores"
            className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm hover:border-zinc-400 dark:hover:border-zinc-600 transition-all space-y-3"
          >
            <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-lg group-hover:scale-105 transition-transform">
              🏬
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                Store Locations & Staff
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                Manage branch store locations, assign store managers, and review store compliance.
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
