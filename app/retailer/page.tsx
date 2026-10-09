import React from "react";
import Link from "next/link";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRetailerPerformanceData } from "@/lib/retailer/performance";
import { getCompanyAgreement } from "@/lib/agreement/actions";
import { RetailerAgreementBanner } from "@/components/retailer/retailer-agreement-banner";
import { getServerTranslations } from "@/lib/i18n/server";
import { getCurrentReportingWeek } from "@/lib/retailer/weekly-check";

export const dynamic = "force-dynamic";

export default async function RetailerHomePage() {
  const { t } = await getServerTranslations();
  const session = await verifyRetailerSession();
  const adminClient = createAdminClient();

  // 1. Fetch user profile
  const { data: profile } = await adminClient
    .from("profiles")
    .select("display_name")
    .eq("id", session.userId)
    .maybeSingle();

  const displayName = profile?.display_name || session.email.split("@")[0] || "Retailer Partner";

  // 2. Fetch company user relation
  const { data: companyUser } = await adminClient
    .from("company_users")
    .select("company_id, company_role")
    .eq("id", session.userId)
    .maybeSingle();

  const companyId = companyUser?.company_id;

  let rawCompany: any = null;
  if (companyId) {
    const { data: compData } = await adminClient
      .from("companies")
      .select("id, name, business_registration_number")
      .eq("id", companyId)
      .maybeSingle();
    rawCompany = compData;
  }

  const companyName = rawCompany?.name || "K SELECT Retailer Partner";

  // 3. Fetch retailer specific role
  const { data: retailerRole } = companyId
    ? await adminClient
        .from("retailer_user_roles")
        .select("role, has_all_stores_access")
        .eq("user_id", session.userId)
        .eq("company_id", companyId)
        .maybeSingle()
    : { data: null };

  const roleTitle = retailerRole?.role
    ? retailerRole.role.charAt(0).toUpperCase() + retailerRole.role.slice(1)
    : companyUser?.company_role || "Owner";

  // 4. Fetch store access
  let storeRows: Array<{ id: string; name: string }> = [];
  if (companyId) {
    if (retailerRole?.has_all_stores_access || retailerRole?.role === "owner" || !retailerRole) {
      const { data: allStores } = await adminClient
        .from("stores")
        .select("id, name")
        .eq("company_id", companyId);

      if (allStores && allStores.length > 0) {
        storeRows = allStores;
      }
    } else {
      const { data: userStores } = await adminClient
        .from("retailer_user_store_access")
        .select("store_id, stores(id, name)")
        .eq("user_id", session.userId);

      if (userStores && userStores.length > 0) {
        storeRows = userStores
          .map((s: any) => s.stores)
          .filter(Boolean);
      }
    }
  }

  const storeNames = storeRows.length > 0 ? storeRows.map((s) => s.name) : ["Main Store"];
  const storeCount = storeRows.length > 0 ? storeRows.length : 1;

  // 5. Fetch Quick Performance Summary (Last 30 Days)
  let performanceSummary: any = null;
  try {
    const perf = await getRetailerPerformanceData("30d", "all");
    performanceSummary = perf.summary;
  } catch {
    // Non-blocking fallback
  }

  // 6. Action Required Data Lookups (Real DB queries)
  let weeklyCheckDueCount = 0;
  let ordersAttentionCount = 0;
  let supportActionCount = 0;

  if (companyId) {
    const currentWeek = getCurrentReportingWeek();
    const accessibleStoreIds = storeRows.map((s) => s.id);

    try {
      // A. Weekly Check Due: check which stores have submitted for current week
      if (accessibleStoreIds.length > 0) {
        const { data: submittedChecks } = await adminClient
          .from("retailer_weekly_checks")
          .select("store_id")
          .eq("company_id", companyId)
          .eq("reporting_week", currentWeek)
          .eq("status", "submitted")
          .in("store_id", accessibleStoreIds);

        const submittedStoreIds = new Set((submittedChecks || []).map((c) => c.store_id));
        weeklyCheckDueCount = accessibleStoreIds.filter((id) => !submittedStoreIds.has(id)).length;
      } else {
        weeklyCheckDueCount = 1; // Unconfigured store fallback
      }
    } catch {
      weeklyCheckDueCount = 0;
    }

    try {
      // B. Orders Requiring Attention (Active replenishment orders in flight or unpaid)
      const { count: openOrdersCount } = await adminClient
        .from("retailer_orders")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .or("order_status.in.(submitted,confirmed,processing),payment_status.in.(unpaid,payment_pending)");

      ordersAttentionCount = openOrdersCount || 0;
    } catch {
      ordersAttentionCount = 0;
    }

    try {
      // C. Support Cases Requiring Attention (Action required or replied cases)
      const { count: supportCasesCount } = await adminClient
        .from("partner_inquiries")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("source_type", "retailer")
        .or("is_action_required.eq.true,status.in.(replied,action_required)");

      supportActionCount = supportCasesCount || 0;
    } catch {
      supportActionCount = 0;
    }
  }

  const reorderAlertsCount = performanceSummary?.productsNeedingReorderCount || 0;
  const hasActionRequired =
    weeklyCheckDueCount > 0 ||
    reorderAlertsCount > 0 ||
    ordersAttentionCount > 0 ||
    supportActionCount > 0;

  // 7. Check if 30-day activity data exists
  const hasSalesActivity = Boolean(
    performanceSummary &&
      (performanceSummary.totalEstimatedMovement > 0 ||
        performanceSummary.totalEstimatedRetailSales > 0 ||
        performanceSummary.productsNeedingReorderCount > 0)
  );

  // 8. Fetch Product Training stats for current user
  let trainingStats = { totalCount: 0, completedCount: 0, percent: 0 };
  try {
    const { getRetailerTrainingProducts } = await import("@/lib/retailer/training");
    const trData = await getRetailerTrainingProducts();
    trainingStats = trData.stats;
  } catch {
    // Non-blocking fallback
  }

  // 9. Fetch Authoritative Retailer Agreement (Onboarding Guidance)
  let companyAgreement = null;
  if (companyId) {
    try {
      const agrRes = await getCompanyAgreement(companyId, "RETAILER");
      companyAgreement = agrRes.agreement;
    } catch {
      // Non-blocking fallback
    }
  }

  return (
    <div className="space-y-6">
      {/* Agreement Onboarding Guidance Banner (Non-blocking) */}
      <RetailerAgreementBanner agreement={companyAgreement} />

      {/* 1. Compact Unified Welcome Hero */}
      <div className="rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950 p-5 sm:p-6 text-white shadow-lg border border-zinc-700/50 dark:border-zinc-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-semibold text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {t.dashboard.verifiedWholesalePartner}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              {t.dashboard.welcome}, {displayName}
            </h1>
            <p className="text-xs text-zinc-300">
              {t.dashboard.welcomeSubtitle}
            </p>
          </div>

          {/* Integrated Organization, Role, Store metadata */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-zinc-200">
            <div>
              <p className="font-bold text-white truncate max-w-[200px]">{companyName}</p>
              <p className="text-[11px] text-zinc-400 capitalize">
                {roleTitle.replace(/_/g, " ")} · {storeCount} {t.dashboard.storeCountUnit}
              </p>
            </div>
            <div className="hidden sm:block h-6 w-px bg-white/10" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold text-zinc-400">{t.dashboard.storeAccess}</p>
              <p className="text-xs font-semibold text-zinc-200 truncate max-w-[220px]" title={storeNames.join(", ")}>
                📍 {storeNames.join(", ")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Simple "Action Required" Section */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5 sm:p-6 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white tracking-tight">
              {t.dashboard.actionRequiredTitle}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {t.dashboard.actionRequiredSubtitle}
            </p>
          </div>
        </div>

        {hasActionRequired ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Action 1: Weekly Check Due */}
            {weeklyCheckDueCount > 0 && (
              <Link
                href="/check"
                className="group flex flex-col justify-between p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 hover:border-emerald-400 dark:hover:border-emerald-700 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-base">📋</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-xs">
                    {weeklyCheckDueCount}
                  </span>
                </div>
                <div className="mt-3">
                  <p className="text-xs font-bold text-zinc-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {t.dashboard.weeklyCheckDue}
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2">
                    {t.dashboard.weeklyCheckDueDesc}
                  </p>
                </div>
              </Link>
            )}

            {/* Action 2: Reorder Alerts */}
            {reorderAlertsCount > 0 && (
              <Link
                href="/sales"
                className="group flex flex-col justify-between p-3.5 rounded-xl border border-purple-200 dark:border-purple-800/60 bg-purple-50/40 dark:bg-purple-950/20 hover:border-purple-400 dark:hover:border-purple-700 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-base">⚠️</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-600 text-white shadow-xs">
                    {reorderAlertsCount}
                  </span>
                </div>
                <div className="mt-3">
                  <p className="text-xs font-bold text-zinc-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    {t.dashboard.reorderAlertsAction}
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2">
                    {t.dashboard.reorderAlertsDesc}
                  </p>
                </div>
              </Link>
            )}

            {/* Action 3: Orders Requiring Attention */}
            {ordersAttentionCount > 0 && (
              <Link
                href="/orders"
                className="group flex flex-col justify-between p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/20 hover:border-amber-400 dark:hover:border-amber-700 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-base">🛒</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-600 text-white shadow-xs">
                    {ordersAttentionCount}
                  </span>
                </div>
                <div className="mt-3">
                  <p className="text-xs font-bold text-zinc-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                    {t.dashboard.ordersNeedAttention}
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2">
                    {t.dashboard.ordersNeedAttentionDesc}
                  </p>
                </div>
              </Link>
            )}

            {/* Action 4: Support Replies / Action Required */}
            {supportActionCount > 0 && (
              <Link
                href="/support"
                className="group flex flex-col justify-between p-3.5 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/40 dark:bg-blue-950/20 hover:border-blue-400 dark:hover:border-blue-700 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-base">💬</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-600 text-white shadow-xs">
                    {supportActionCount}
                  </span>
                </div>
                <div className="mt-3">
                  <p className="text-xs font-bold text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {t.dashboard.supportReplies}
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2">
                    {t.dashboard.supportRepliesDesc}
                  </p>
                </div>
              </Link>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span>{t.dashboard.allCaughtUp}</span>
          </div>
        )}
      </div>

      {/* 3. 30-Day Demand & Sales Summary */}
      {performanceSummary && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white">
                {t.dashboard.demandSummaryTitle}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {t.dashboard.demandSummarySubtitle}
              </p>
            </div>
            <Link
              href="/sales"
              className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline"
            >
              {t.dashboard.fullAnalytics}
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800/60">
              <span className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400">{t.dashboard.estUnitsMoved}</span>
              <div className="text-lg font-bold text-zinc-900 dark:text-white mt-0.5">
                {performanceSummary.totalEstimatedMovement.toLocaleString()}
              </div>
            </div>

            <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800/60">
              <span className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400">{t.dashboard.estRetailValue}</span>
              <div className="text-lg font-bold text-zinc-900 dark:text-white mt-0.5">
                {performanceSummary.isFinancialsHidden
                  ? "—"
                  : `$${performanceSummary.totalEstimatedRetailSales.toFixed(2)}`}
              </div>
            </div>

            <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800/60">
              <span className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400">{t.dashboard.estGrossProfit}</span>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {performanceSummary.isFinancialsHidden
                  ? "—"
                  : `+$${performanceSummary.totalEstimatedGrossProfit.toFixed(2)}`}
              </div>
            </div>

            <div className="p-3.5 bg-purple-50/50 dark:bg-purple-950/40 rounded-xl border border-purple-100 dark:border-purple-900/40">
              <span className="text-[10px] uppercase font-bold text-purple-700 dark:text-purple-300">
                {t.dashboard.reorderAlerts}
              </span>
              <div className="text-lg font-extrabold text-purple-700 dark:text-purple-300 mt-0.5">
                {performanceSummary.productsNeedingReorderCount} SKUs
              </div>
            </div>
          </div>

          {/* Zero activity helper guide */}
          {!hasSalesActivity && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 text-xs">
              <div className="space-y-0.5">
                <p className="font-bold text-zinc-900 dark:text-white">
                  {t.dashboard.noActivityTitle}
                </p>
                <p className="text-zinc-500 dark:text-zinc-400">
                  {t.dashboard.noActivityDesc}
                </p>
              </div>
              <Link
                href="/check"
                className="inline-flex items-center justify-center px-3.5 py-2 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold text-xs hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shrink-0 shadow-xs"
              >
                {t.dashboard.startWeeklyCheck} →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* 4. Streamlined Quick Actions (2 rows x 3 columns) */}
      <div className="space-y-3">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white tracking-tight">
            {t.dashboard.quickActionsTitle}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {t.dashboard.quickActionsSubtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* Row 1, Card 1: Browse Products */}
          <Link
            href="/products"
            className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-xs hover:border-zinc-400 dark:hover:border-zinc-600 transition-all space-y-2.5"
          >
            <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-base group-hover:scale-105 transition-transform">
              📦
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {t.dashboard.cardProductsTitle}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                {t.dashboard.cardProductsDesc}
              </p>
            </div>
          </Link>

          {/* Row 1, Card 2: Weekly Check */}
          <Link
            href="/check"
            className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-xs hover:border-zinc-400 dark:hover:border-zinc-600 transition-all space-y-2.5"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-base group-hover:scale-105 transition-transform">
              📋
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {t.dashboard.cardCheckTitle}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                {t.dashboard.cardCheckDesc}
              </p>
            </div>
          </Link>

          {/* Row 1, Card 3: Orders & Reorder */}
          <Link
            href="/orders"
            className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-xs hover:border-zinc-400 dark:hover:border-zinc-600 transition-all space-y-2.5"
          >
            <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-base group-hover:scale-105 transition-transform">
              🛒
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                {t.dashboard.cardOrdersTitle}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                {t.dashboard.cardOrdersDesc}
              </p>
            </div>
          </Link>

          {/* Row 2, Card 4: Sales & Reorder Analytics */}
          <Link
            href="/sales"
            className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-xs hover:border-zinc-400 dark:hover:border-zinc-600 transition-all space-y-2.5"
          >
            <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-base group-hover:scale-105 transition-transform">
              📊
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                {t.dashboard.cardSalesTitle}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                {t.dashboard.cardSalesDesc}
              </p>
            </div>
          </Link>

          {/* Row 2, Card 5: Training & Guides */}
          <Link
            href="/training"
            className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-xs hover:border-zinc-400 dark:hover:border-zinc-600 transition-all space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-base group-hover:scale-105 transition-transform">
                🎓
              </div>
              {trainingStats.totalCount > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                  {trainingStats.completedCount}/{trainingStats.totalCount} ({trainingStats.percent}%)
                </span>
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {t.dashboard.cardTrainingTitle}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                {t.dashboard.cardTrainingDesc}
              </p>
            </div>
          </Link>

          {/* Row 2, Card 6: Company & Store Settings */}
          <Link
            href="/stores"
            className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-xs hover:border-zinc-400 dark:hover:border-zinc-600 transition-all space-y-2.5"
          >
            <div className="w-9 h-9 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-base group-hover:scale-105 transition-transform">
              🏬
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                {t.dashboard.cardStoresTitle}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                {t.dashboard.cardStoresDesc}
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

