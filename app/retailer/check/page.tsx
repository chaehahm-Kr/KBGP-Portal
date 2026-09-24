import React from "react";
import {
  getRetailerAccessibleStores,
  getCurrentReportingWeek,
  getOrCreateStoreWeeklyCheck,
  getWeeklyCheckHistory,
} from "@/lib/retailer/weekly-check";
import { RetailerWeeklyCheckDashboard } from "@/components/retailer/weekly-check-dashboard";

export const dynamic = "force-dynamic";

interface CheckPageProps {
  searchParams: Promise<{
    storeId?: string;
  }>;
}

export default async function RetailerCheckDashboardPage({ searchParams }: CheckPageProps) {
  const params = await searchParams;
  const { stores } = await getRetailerAccessibleStores();

  if (stores.length === 0) {
    return (
      <div className="p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-center text-xs text-zinc-500">
        No stores are currently assigned to your account.
      </div>
    );
  }

  const selectedStoreId = params.storeId && stores.some((s) => s.id === params.storeId)
    ? params.storeId
    : stores[0].id;

  const currentWeek = getCurrentReportingWeek();
  const history = await getWeeklyCheckHistory(selectedStoreId);

  let activeCheck: any = null;
  try {
    const session = await getOrCreateStoreWeeklyCheck(selectedStoreId);
    if (session) {
      activeCheck = {
        id: session.id,
        storeId: session.storeId,
        status: session.status,
        totalProductsCount: session.totalProductsCount,
        totalCountedProducts: session.totalCountedProducts,
        totalRemainingUnits: session.totalRemainingUnits,
        submittedAt: session.submittedAt,
      };
    }
  } catch (e) {
    // Session might not be started yet or table not created
  }

  return (
    <RetailerWeeklyCheckDashboard
      stores={stores}
      currentWeek={currentWeek}
      activeCheck={activeCheck}
      history={history}
      selectedStoreId={selectedStoreId}
    />
  );
}
