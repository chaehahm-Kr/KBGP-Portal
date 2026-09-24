import React from "react";
import { notFound, redirect } from "next/navigation";
import {
  getWeeklyCheckById,
  getOrCreateStoreWeeklyCheck,
  getRetailerAccessibleStores,
} from "@/lib/retailer/weekly-check";
import { RetailerWeeklyCheckStepper } from "@/components/retailer/weekly-check-stepper";
import { RetailerWeeklyCheckDetailView } from "@/components/retailer/weekly-check-detail-view";

export const dynamic = "force-dynamic";

interface CheckDetailPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    storeId?: string;
  }>;
}

export default async function RetailerWeeklyCheckDynamicPage({
  params,
  searchParams,
}: CheckDetailPageProps) {
  const { id } = await params;
  const sParams = await searchParams;

  // Handle /check/start?storeId=xxx
  if (id === "start") {
    const { stores } = await getRetailerAccessibleStores();
    if (stores.length === 0) notFound();

    const targetStoreId = sParams.storeId && stores.some((s) => s.id === sParams.storeId)
      ? sParams.storeId
      : stores[0].id;

    const session = await getOrCreateStoreWeeklyCheck(targetStoreId);
    if (!session) notFound();

    redirect(`/check/${session.id}`);
  }

  const session = await getWeeklyCheckById(id);
  if (!session) {
    notFound();
  }

  if (session.status === "draft") {
    return <RetailerWeeklyCheckStepper session={session} />;
  }

  return <RetailerWeeklyCheckDetailView session={session} />;
}
