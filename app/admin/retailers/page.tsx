import React from "react";
import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getAdminRetailersList } from "@/lib/retailer/admin-retailer-actions";
import { RetailersList } from "@/components/admin/retailers-list";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Retailers Management | K SELECT NETWORK Admin",
};

export default async function AdminRetailersPage() {
  await verifyAdminSession();
  const retailers = await getAdminRetailersList();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-xl font-bold text-zinc-950 dark:text-white">
            Retail Partner Organizations
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Manage approved retailer companies, store locations, onboarding invitation statuses, and commercial credit terms.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/retailers/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-900 text-xs font-bold transition-all shadow-xs"
          >
            <span>➕</span>
            <span>Onboard New Retailer</span>
          </Link>
        </div>
      </div>

      {/* Retailers List */}
      <RetailersList initialRetailers={retailers} />
    </div>
  );
}
