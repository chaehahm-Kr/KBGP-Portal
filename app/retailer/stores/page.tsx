import React from "react";
import Link from "next/link";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function RetailerStoresPage() {
  const session = await verifyRetailerSession();
  const adminClient = createAdminClient();

  // Fetch actual stores for the retailer
  const { data: companyUser } = await adminClient
    .from("company_users")
    .select("company_id")
    .eq("id", session.userId)
    .maybeSingle();

  let stores: any[] = [];
  if (companyUser?.company_id) {
    const { data: storeList } = await adminClient
      .from("stores")
      .select("*")
      .eq("company_id", companyUser.company_id);
    if (storeList) stores = storeList;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
            Store Locations
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Physical retail store branches linked to your organization.
          </p>
        </div>
      </div>

      {/* Actual Store List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stores.map((store) => (
          <div
            key={store.id}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm space-y-3"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                  {store.store_code || "STORE"}
                </span>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white mt-1.5">
                  {store.name}
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 capitalize">
                {store.status || "Active"}
              </span>
            </div>

            <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
              <p>Type: <span className="text-zinc-700 dark:text-zinc-300 font-medium">{store.type || "Beauty Supply"}</span></p>
              {store.city && store.state && (
                <p>Location: <span className="text-zinc-700 dark:text-zinc-300 font-medium">{store.city}, {store.state}</span></p>
              )}
              {store.manager_name && (
                <p>Manager: <span className="text-zinc-700 dark:text-zinc-300 font-medium">{store.manager_name}</span></p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Info Box */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 p-5 text-xs text-zinc-500 dark:text-zinc-400 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <span>To add new stores, update store addresses, or manage assigned staff, visit the Organization Settings.</span>
        <Link
          href="/account?tab=organization"
          className="px-3.5 py-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-xs hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors shrink-0 inline-flex items-center gap-1 self-start sm:self-auto"
        >
          <span>🏢 Manage Stores in Account</span>
        </Link>
      </div>
    </div>
  );
}
