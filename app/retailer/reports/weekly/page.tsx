import React from "react";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { getRetailerWeeklyReportData } from "@/lib/retailer/weekly-report";
import { WeeklyReportView } from "@/components/retailer/weekly-report-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Weekly Performance & Reorder Report | K SELECT HUB",
  description: "Weekly physical stock movement, estimated retail sales, and replenishment recommendations.",
};

interface Props {
  searchParams: Promise<{
    week?: string;
    store?: string;
  }>;
}

export default async function RetailerWeeklyReportsPage({ searchParams }: Props) {
  try {
    await verifyRetailerSession();
  } catch {
    redirect("/login");
  }

  const resolvedParams = await searchParams;
  const reportingWeek = resolvedParams.week;
  const storeId = resolvedParams.store;

  const data = await getRetailerWeeklyReportData({
    reportingWeek,
    storeId,
  });

  return <WeeklyReportView initialData={data} />;
}
