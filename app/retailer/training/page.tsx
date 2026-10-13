import React from "react";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { getRetailerTrainingProducts } from "@/lib/retailer/training";
import { TrainingListView } from "@/components/retailer/training-list-view";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Learning Center | K SELECT HUB Retailer",
  description: "Learn key benefits, how to use, selling points, and customer talk-tracks for products carried in your store.",
};

interface RetailerTrainingPageProps {
  searchParams: Promise<{
    storeId?: string;
    q?: string;
    status?: "all" | "completed" | "not_completed";
  }>;
}

export default async function RetailerTrainingPage({
  searchParams,
}: RetailerTrainingPageProps) {
  await verifyRetailerSession();
  const { storeId, q, status } = await searchParams;

  const data = await getRetailerTrainingProducts({
    storeId,
    search: q,
    statusFilter: status,
  });

  return (
    <TrainingListView
      products={data.products}
      stats={data.stats}
      stores={data.stores}
      selectedStoreId={data.selectedStoreId}
      userRole={data.userRole}
    />
  );
}
