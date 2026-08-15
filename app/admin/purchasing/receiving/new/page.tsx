import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOpenShipmentsForReceiving } from "@/lib/inbound/actions";
import { ReceivingForm } from "@/components/admin/receiving-form";

export const metadata: Metadata = {
  title: "신규 입고 등록 (New Receiving) | K SELECT NETWORK 어드민",
};

export default async function AdminNewReceivingPage({
  searchParams,
}: {
  searchParams: Promise<{ shipmentId?: string }>;
}) {
  const { shipmentId } = await searchParams;
  await verifyAdminSession();
  const supabase = createAdminClient();

  // 1. Fetch eligible shipments in BOOKED/IN_TRANSIT/ARRIVED/PARTIALLY_RECEIVED status
  const openShipments = await getOpenShipmentsForReceiving();

  // 2. Fetch active warehouses
  const { data: dbWarehouses } = await supabase
    .from("warehouses")
    .select("id, name, code, status, is_default_receiving")
    .eq("status", "active")
    .order("name", { ascending: true });
  const warehouses = dbWarehouses ?? [];

  // Default warehouse selection
  const defaultWarehouse = warehouses.find((w) => w.is_default_receiving === true) || warehouses[0] || null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-955 dark:text-white">신규 입고 등록 (New Inbound Receiving)</h1>
        <p className="text-xs text-zinc-550 dark:text-zinc-400">
          특정 선적 화물의 실물 박스가 창고에 도달했을 때, 개별 SKU 품목별로 정상 입고 개수 및 보류/파손 개수를 기입합니다.
        </p>
      </div>

      <ReceivingForm
        openShipments={openShipments}
        warehouses={warehouses}
        defaultWarehouseId={defaultWarehouse?.id || ""}
        preselectedShipmentId={shipmentId || ""}
      />
    </div>
  );
}
