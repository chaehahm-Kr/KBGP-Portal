// app/admin/sales/orders/page.tsx
import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getAdminRetailerOrdersAction } from "@/lib/admin/orders-actions";
import { AdminOrdersTable } from "@/components/admin/orders/orders-table";

export const metadata: Metadata = {
  title: "Retailer Orders | K SELECT NETWORK Admin",
  description: "Centralized Retailer Orders Management, Units Reconciliation & Multi-Box Logistics",
};

export default async function AdminRetailerOrdersPage() {
  await verifyAdminSession();
  const res = await getAdminRetailerOrdersAction();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-950 dark:text-white">
          Retailer Orders (리테일러 주문 관리)
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          모든 리테일 매장 발주 주문, 4-Way 수량 정합성(주문/출고/취소/잔여), 다중 박스 운송장 및 인보이스를 통합 관리합니다.
        </p>
      </div>

      <AdminOrdersTable
        initialOrders={res.orders}
        initialTotal={res.totalCount}
      />
    </div>
  );
}
