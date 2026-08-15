import type { Metadata } from "next";
import Link from "next/link";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReceivings } from "@/lib/inbound/actions";
import { getSuppliersForPo } from "@/lib/purchase-order/actions";
import { ReceivingsList } from "@/components/admin/receivings-list";

export const metadata: Metadata = {
  title: "입고 검수 관리 (Receiving) | K SELECT NETWORK 어드민",
};

export default async function AdminReceivingPage() {
  await verifyAdminSession();
  const supabase = createAdminClient();

  // 1. Fetch receiving records
  const receivings = await getReceivings();

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
          <h1 className="text-xl font-bold text-zinc-955 dark:text-white">물류창고 입고 검수 (Receiving)</h1>
          <p className="text-xs text-zinc-550 dark:text-zinc-400">
            도착한 화물의 실제 품목 수량, 하자/파손 여부를 검수하고 재고원장(Inventory Balances)에 반영합니다.
          </p>
        </div>
        <Link
          href="/admin/purchasing/receiving/new"
          className="inline-flex items-center px-4 py-2 bg-zinc-950 hover:bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
        >
          + 신규 입고 등록 (New Receiving)
        </Link>
      </div>

      <ReceivingsList
        initialReceivings={receivings}
        warehouses={warehouses}
        suppliers={suppliers}
      />
    </div>
  );
}
