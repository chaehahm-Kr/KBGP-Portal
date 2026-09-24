import React from "react";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { getStorePricingDashboardData } from "@/lib/retailer/store-pricing";
import { PriceTagsDashboard } from "@/components/retailer/price-tags-dashboard";

export const dynamic = "force-dynamic";

interface RetailerTagsPageProps {
  searchParams: Promise<{
    store?: string;
  }>;
}

export default async function RetailerTagsPage({ searchParams }: RetailerTagsPageProps) {
  await verifyRetailerSession();
  const resolvedSearchParams = await searchParams;
  const storeId = resolvedSearchParams.store;

  const data = await getStorePricingDashboardData(storeId);

  return <PriceTagsDashboard data={data} />;
}
