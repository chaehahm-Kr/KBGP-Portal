import React from "react";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { getRetailerTrainingProducts } from "@/lib/retailer/training";
import { TrainingListView } from "@/components/retailer/training-list-view";

export const dynamic = "force-dynamic";

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
