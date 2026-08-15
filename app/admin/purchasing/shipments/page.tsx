import type { Metadata } from "next";
import Link from "next/link";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getInboundShipments } from "@/lib/inbound/actions";
import { getSuppliersForPo } from "@/lib/purchase-order/actions";
import { ShipmentsList } from "@/components/admin/shipments-list";

export const metadata: Metadata = {
  title: "선적 관리 (Inbound Shipments) | K SELECT NETWORK 어드민",
};

export default async function AdminShipmentsPage() {
  await verifyAdminSession();
  const supabase = createAdminClient();

  // 1. Fetch all shipment records
  const shipments = await getInboundShipments();

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
          <h1 className="text-xl font-bold text-zinc-955 dark:text-white">선적 관리 (Inbound Shipments)</h1>
          <p className="text-xs text-zinc-550 dark:text-zinc-400">
            발주한 물품의 운송 스케줄(ETD, ETA), 컨테이너 정보 및 입고 예정 창고 현황을 모니터링합니다.
          </p>
        </div>
        <Link
          href="/admin/purchasing/shipments/new"
          className="inline-flex items-center px-4 py-2 bg-zinc-950 hover:bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
        >
          + 신규 선적 생성 (New Shipment)
        </Link>
      </div>

      <ShipmentsList
        initialShipments={shipments}
        warehouses={warehouses}
        suppliers={suppliers}
      />
    </div>
  );
}
