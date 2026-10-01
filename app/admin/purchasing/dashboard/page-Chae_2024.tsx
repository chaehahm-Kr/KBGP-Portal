import type { Metadata } from "next";
import { getPurchasingDashboardData } from "@/lib/purchasing-dashboard/actions";
import { PurchasingDashboard } from "@/components/admin/purchasing-dashboard";

export const metadata: Metadata = {
  title: "발주 현황 대시보드 (Order Dashboard) | K SELECT NETWORK 어드민",
};

export default async function OrderDashboardPage() {
  const data = await getPurchasingDashboardData();
  return <PurchasingDashboard initialData={data} />;
}
