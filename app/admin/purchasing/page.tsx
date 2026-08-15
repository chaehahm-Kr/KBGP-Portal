import type { Metadata } from "next";
import Link from "next/link";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPurchaseOrders, getSuppliersForPo } from "@/lib/purchase-order/actions";
import { PurchaseOrdersList } from "@/components/admin/purchase-orders-list";

export const metadata: Metadata = {
  title: "발주서 관리 (Purchase Orders) | K SELECT NETWORK 어드민",
};

export default async function AdminPurchasingPage() {
  await verifyAdminSession();
  const supabase = createAdminClient();

  // 1. Fetch all PO records
  const pos = await getPurchaseOrders();

  // 2. Fetch active warehouses for dropdown filter
  const { data: dbWarehouses } = await supabase
    .from("warehouses")
    .select("id, name, code")
    .eq("status", "active")
    .order("name", { ascending: true });
  const warehouses = dbWarehouses ?? [];

  // 3. Fetch suppliers for dropdown filter
  const suppliers = await getSuppliersForPo();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-zinc-955 dark:text-white">발주 관리 (Purchase Orders)</h1>
          <p className="text-xs text-zinc-550 dark:text-zinc-400">
            Supplier를 대상으로 발행된 Inbound 발주서의 진행 현황을 파악하고 관리합니다.
          </p>
        </div>
        <Link
          href="/admin/purchasing/new"
          className="inline-flex items-center px-4 py-2 bg-zinc-950 hover:bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
        >
          + 신규 발주서 생성 (New PO)
        </Link>
      </div>

      <PurchaseOrdersList
        initialPos={pos}
        warehouses={warehouses}
        suppliers={suppliers}
      />
    </div>
  );
}
