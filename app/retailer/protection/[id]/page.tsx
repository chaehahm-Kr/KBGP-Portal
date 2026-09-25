import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { getRetailerProtectionDetail } from "@/lib/retailer/protection";
import { getRetailerAccessibleStores } from "@/lib/retailer/weekly-check";
import { ProtectionDetailView } from "@/components/retailer/protection-detail-view";

export const dynamic = "force-dynamic";

interface RetailerProtectionDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function RetailerProtectionDetailPage({
  params,
}: RetailerProtectionDetailPageProps) {
  await verifyRetailerSession();
  const { id } = await params;

  const protection = await getRetailerProtectionDetail(id);
  const { userRole } = await getRetailerAccessibleStores();

  if (!protection) {
    return (
      <div className="max-w-md mx-auto my-12 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center space-y-4 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-2xl mx-auto">
          🛡️
        </div>
        <h1 className="text-lg font-bold text-zinc-900 dark:text-white">
          Trial Protection Record Not Found
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          The requested 90-day initial trial protection record does not exist or is not associated with your company account.
        </p>
        <div className="pt-2">
          <Link
            href="/protection"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            ← Back to Protection List
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ProtectionDetailView
      protection={protection}
      userRole={userRole || "employee"}
    />
  );
}
