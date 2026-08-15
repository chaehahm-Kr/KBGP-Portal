import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOpenPosForShipment } from "@/lib/inbound/actions";
import { ShipmentForm } from "@/components/admin/shipment-form";

export const metadata: Metadata = {
  title: "신규 선적 생성 (New Shipment) | K SELECT NETWORK 어드민",
};

export default async function AdminNewShipmentPage() {
  await verifyAdminSession();
  const supabase = createAdminClient();

  // 1. Fetch eligible POs in APPROVED/SENT/IN_PRODUCTION/READY_TO_SHIP status
  const openPos = await getOpenPosForShipment();

  // 2. Fetch active warehouses
  const { data: dbWarehouses } = await supabase
    .from("warehouses")
    .select("id, name, code, status, is_default_receiving")
    .eq("status", "active")
    .order("name", { ascending: true });
  const warehouses = dbWarehouses ?? [];

  // Default receiving warehouse for consignee
  const defaultWarehouse = warehouses.find((w) => w.is_default_receiving === true) || warehouses[0] || null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-955 dark:text-white">신규 선적 등록 (New Inbound Shipment)</h1>
        <p className="text-xs text-zinc-550 dark:text-zinc-400">
          특정 발주서(Purchase Order)를 기반으로 공급사에서 선하(Shipped) 처리한 운송 품목, 스케줄 및 컨테이너 코드를 저장합니다.
        </p>
      </div>

      <ShipmentForm
        openPos={openPos}
        warehouses={warehouses}
        defaultWarehouseId={defaultWarehouse?.id || ""}
      />
    </div>
  );
}
