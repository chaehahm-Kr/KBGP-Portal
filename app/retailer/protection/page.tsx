import React from "react";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { getRetailerProtections } from "@/lib/retailer/protection";
import { ProtectionListView } from "@/components/retailer/protection-list-view";

export const dynamic = "force-dynamic";

interface RetailerProtectionPageProps {
  searchParams: Promise<{
    status?: string;
    q?: string;
  }>;
}

export default async function RetailerProtectionPage({
  searchParams,
}: RetailerProtectionPageProps) {
  await verifyRetailerSession();
  const { status, q } = await searchParams;

  const data = await getRetailerProtections({
    statusFilter: status,
    search: q,
  });

  return (
    <ProtectionListView
      protections={data.protections}
      stats={data.stats}
      companyName={data.companyName}
      userRole={data.userRole}
    />
  );
}
