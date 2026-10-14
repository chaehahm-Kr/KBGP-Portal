// app/admin/sales/orders/page.tsx
import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getAdminRetailerOrdersAction } from "@/lib/admin/orders-actions";
import { AdminOrdersTable } from "@/components/admin/orders/orders-table";
import { AdminOrderFilter } from "@/lib/admin/orders-types";

export const metadata: Metadata = {
  title: "Order Processing | K SELECT NETWORK Admin",
  description: "Centralized Order Processing, Inventory Fulfillment, Multi-Box Cartons & Invoices",
};

export default async function AdminRetailerOrdersPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await verifyAdminSession();
  const rawParams = searchParams ? await searchParams : {};

  const filter: AdminOrderFilter = {
    search: typeof rawParams.search === "string" ? rawParams.search : undefined,
    sku: typeof rawParams.sku === "string" ? rawParams.sku : undefined,
    quickFilter: typeof rawParams.quickFilter === "string" ? (rawParams.quickFilter as any) : undefined,
    companyId: typeof rawParams.companyId === "string" ? rawParams.companyId : undefined,
    storeId: typeof rawParams.storeId === "string" ? rawParams.storeId : undefined,
    status: typeof rawParams.status === "string" ? rawParams.status : undefined,
    paymentStatus: typeof rawParams.paymentStatus === "string" ? rawParams.paymentStatus : undefined,
    datePreset: typeof rawParams.datePreset === "string" ? (rawParams.datePreset as any) : undefined,
    startDate: typeof rawParams.startDate === "string" ? rawParams.startDate : undefined,
    endDate: typeof rawParams.endDate === "string" ? rawParams.endDate : undefined,
    testMode: typeof rawParams.testMode === "string" ? (rawParams.testMode as any) : undefined,
    sortBy: typeof rawParams.sortBy === "string" ? (rawParams.sortBy as any) : undefined,
    sortDirection: typeof rawParams.sortDirection === "string" ? (rawParams.sortDirection as any) : undefined,
    page: typeof rawParams.page === "string" ? parseInt(rawParams.page, 10) : 1,
    pageSize: typeof rawParams.pageSize === "string" ? parseInt(rawParams.pageSize, 10) : 25,
  };

  const res = await getAdminRetailerOrdersAction(filter);

  return (
    <div className="space-y-6">
      <AdminOrdersTable
        initialOrders={res.orders}
        initialTotal={res.totalCount}
        initialCounters={res.summaryCounters}
        companies={res.companies}
        stores={res.stores}
      />
    </div>
  );
}

