import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getInboundShipmentDetail, getOpenPosForShipment } from "@/lib/inbound/actions";
import { ShipmentForm } from "@/components/admin/shipment-form";

export const metadata: Metadata = {
  title: "선적서 수정 (Edit Shipment) | K SELECT NETWORK 어드민",
};

export default async function AdminEditShipmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await verifyAdminSession();
  const supabase = createAdminClient();

  // 1. Fetch shipment details
  let shp;
  try {
    shp = await getInboundShipmentDetail(id);
  } catch {
    notFound();
  }

  // Verify status is DRAFT
  if (shp.status !== "DRAFT") {
    redirect(`/admin/purchasing/shipments/${id}`);
  }

  // 2. Fetch eligible POs (including the current PO so it shows up in dropdown)
  const openPos = await getOpenPosForShipment();
  const hasCurrentPo = openPos.some((po) => po.id === shp.purchase_order_id);
  if (!hasCurrentPo && shp.po) {
    openPos.push({
      id: shp.purchase_order_id,
      po_number: shp.po.po_number,
      supplier_name: shp.po.supplier.name,
      order_date: shp.order_date || "",
      status: shp.status,
    } as any);
  }

  // 3. Fetch active warehouses
  const { data: dbWarehouses } = await supabase
    .from("warehouses")
    .select("id, name, code, status")
    .eq("status", "active")
    .order("name", { ascending: true });
  const warehouses = dbWarehouses ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-955 dark:text-white">선적 정보 수정 (Edit Inbound Shipment)</h1>
        <p className="text-xs text-zinc-550 dark:text-zinc-400">
          초안(Draft) 상태인 선적 번호 {shp.shipment_number}의 스케줄, 수하 정보 및 선적 품목 구성을 변경합니다.
        </p>
      </div>

      <ShipmentForm
        initialShipment={shp}
        openPos={openPos}
        warehouses={warehouses}
        defaultWarehouseId={shp.destination_warehouse_id}
      />
    </div>
  );
}
