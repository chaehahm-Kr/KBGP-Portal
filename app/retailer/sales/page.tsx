import React from "react";
import { verifyRetailerSession } from "@/lib/auth/dal";
import {
  getRetailerPerformanceData,
  ReportingPeriod,
  ReorderCoverage,
} from "@/lib/retailer/performance";
import { SalesPerformanceDashboard } from "@/components/retailer/sales-performance-dashboard";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Product Performance | K SELECT HUB Retailer",
  description: "Weekly count velocity, estimated retail sales, gross margins, and demand-based reorder signals.",
};

interface RetailerSalesPageProps {
  searchParams: Promise<{
    period?: string;
    store?: string;
    coverage?: string;
  }>;
}

export default async function RetailerSalesPage({ searchParams }: RetailerSalesPageProps) {
  await verifyRetailerSession();
  const resolvedParams = await searchParams;

  const validPeriods: ReportingPeriod[] = ["7d", "30d", "90d", "all"];
  const rawPeriod = resolvedParams.period as ReportingPeriod;
  const period: ReportingPeriod = validPeriods.includes(rawPeriod) ? rawPeriod : "30d";
  const storeId = resolvedParams.store || "all";

  const rawCoverage = resolvedParams.coverage as ReorderCoverage;
  const coverage: ReorderCoverage = rawCoverage === "60d" ? "60d" : "30d";

  const data = await getRetailerPerformanceData(period, storeId, coverage);

  return <SalesPerformanceDashboard data={data} />;
}
