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
  let retailers: any[] = [];
  let loadError: string | null = null;
  try {
    retailers = await getAdminRetailersList();
  } catch (err: any) {
    console.error("AdminRetailersPage error:", err);
    loadError = err.message || "Failed to load retailer partner organizations.";
  }

  return (
    <div className="space-y-6 w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-zinc-950 dark:text-white">
              Retail Partner Organizations
            </h1>
            <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-[10px] font-bold text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
              {retailers.length} Total
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Manage approved retailer companies, store locations, onboarding invitation statuses, and commercial credit terms.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
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
      <RetailersList initialRetailers={retailers} loadError={loadError} />
    </div>
  );
}
