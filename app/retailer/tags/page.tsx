import React from "react";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { getStorePricingDashboardData } from "@/lib/retailer/store-pricing";
import { PriceTagsDashboard } from "@/components/retailer/price-tags-dashboard";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Price Tags & Shelf Labels | K SELECT HUB Retailer",
  description: "Manage store-specific selling prices, preview shelf tags, and batch print labels with QR codes.",
};

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
