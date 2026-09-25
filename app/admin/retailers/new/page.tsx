import React from "react";
import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { RetailerCreateForm } from "@/components/admin/retailer-create-form";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Onboard New Retailer | K SELECT NETWORK Admin",
};

export default async function AdminNewRetailerPage() {
  await verifyAdminSession();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/retailers"
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            >
              ← Retailers
            </Link>
            <span className="text-zinc-300 dark:text-zinc-700">/</span>
            <span className="text-xs font-bold text-zinc-900 dark:text-white">New Onboarding</span>
          </div>
          <h1 className="text-xl font-bold text-zinc-950 dark:text-white mt-1">
            Onboard New Retailer Organization
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Configure legal entity, credit terms, initial store location, and dispatch owner invitation.
          </p>
        </div>
      </div>

      <RetailerCreateForm />
    </div>
  );
}
