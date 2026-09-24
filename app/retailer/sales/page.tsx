import React from "react";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { getRetailerPerformanceData, ReportingPeriod } from "@/lib/retailer/performance";
import { SalesPerformanceDashboard } from "@/components/retailer/sales-performance-dashboard";

export const dynamic = "force-dynamic";

interface RetailerSalesPageProps {
  searchParams: Promise<{
    period?: string;
    store?: string;
  }>;
}

export default async function RetailerSalesPage({ searchParams }: RetailerSalesPageProps) {
  await verifyRetailerSession();
  const resolvedParams = await searchParams;

  const validPeriods: ReportingPeriod[] = ["7d", "30d", "90d", "all"];
  const rawPeriod = resolvedParams.period as ReportingPeriod;
  const period: ReportingPeriod = validPeriods.includes(rawPeriod) ? rawPeriod : "30d";
  const storeId = resolvedParams.store || "all";

  const data = await getRetailerPerformanceData(period, storeId);

  return <SalesPerformanceDashboard data={data} />;
}
