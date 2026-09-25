import React from "react";
import Link from "next/link";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRetailerPerformanceData } from "@/lib/retailer/performance";

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

  // 5. Fetch Quick Performance Summary (Last 30 Days)
  let performanceSummary = null;
  try {
    const perf = await getRetailerPerformanceData("30d", "all");
    performanceSummary = perf.summary;
  } catch {
    // Non-blocking fallback
  }

  // 6. Fetch Product Training stats for current user
  let trainingStats = { totalCount: 0, completedCount: 0, percent: 0 };
  try {
    const { getRetailerTrainingProducts } = await import("@/lib/retailer/training");
    const trData = await getRetailerTrainingProducts();
    trainingStats = trData.stats;
  } catch {
    // Non-blocking fallback
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

      {/* Performance & Demand Snapshot (Last 30 Days) */}
      {performanceSummary && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white">
                30-Day Demand & Sales Summary
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Overview derived from submitted weekly check counts
              </p>
            </div>
            <Link
              href="/sales"
              className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline"
            >
              Full Analytics →
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-zinc-400">Est. Units Moved</span>
              <div className="text-lg font-bold text-zinc-900 dark:text-white mt-0.5">
                {performanceSummary.totalEstimatedMovement.toLocaleString()}
              </div>
            </div>

            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-zinc-400">Est. Retail Value</span>
              <div className="text-lg font-bold text-zinc-900 dark:text-white mt-0.5">
                {performanceSummary.isFinancialsHidden
                  ? "—"
                  : `$${performanceSummary.totalEstimatedRetailSales.toFixed(2)}`}
              </div>
            </div>

            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-zinc-400">Est. Gross Profit</span>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {performanceSummary.isFinancialsHidden
                  ? "—"
                  : `+$${performanceSummary.totalEstimatedGrossProfit.toFixed(2)}`}
              </div>
            </div>

            <div className="p-3 bg-purple-50 dark:bg-purple-950/40 rounded-xl border border-purple-100 dark:border-purple-900/40">
              <span className="text-[10px] uppercase font-bold text-purple-700 dark:text-purple-300">
                Reorder Alerts
              </span>
              <div className="text-lg font-extrabold text-purple-700 dark:text-purple-300 mt-0.5">
                {performanceSummary.productsNeedingReorderCount} SKUs
              </div>
            </div>
          </div>
        </div>
      )}

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
            href="/products"
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
            href="/check"
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
                Submit weekly shelf presence and retail stock counts directly from your store.
              </p>
            </div>
          </Link>

          {/* Card 3: Orders */}
          <Link
            href="/orders"
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
            href="/sales"
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
            href="/training"
            className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm hover:border-zinc-400 dark:hover:border-zinc-600 transition-all space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-lg group-hover:scale-105 transition-transform">
                🎓
              </div>
              {trainingStats.totalCount > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                  {trainingStats.completedCount}/{trainingStats.totalCount} Completed ({trainingStats.percent}%)
                </span>
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                Product Training & Guides
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                Access product selling points, customer talk-tracks, and usage cheat-sheets for your store.
              </p>
            </div>
          </Link>

          {/* Card 6: Stores */}
          <Link
            href="/stores"
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
