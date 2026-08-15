import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReceivingDetail, getOpenShipmentsForReceiving } from "@/lib/inbound/actions";
import { ReceivingForm } from "@/components/admin/receiving-form";

export const metadata: Metadata = {
  title: "입고 정보 수정 (Edit Receiving) | K SELECT NETWORK 어드민",
};

export default async function AdminEditReceivingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await verifyAdminSession();
  const supabase = createAdminClient();

  // 1. Fetch receiving details
  let rec;
  try {
    rec = await getReceivingDetail(id);
  } catch {
    notFound();
  }

  // Verify status is DRAFT
  if (rec.status !== "DRAFT") {
    redirect(`/admin/purchasing/receiving/${id}`);
  }

  // 2. Fetch open shipments (including the current shipment so it is selectable)
  const openShipments = await getOpenShipmentsForReceiving();
  const hasCurrentShp = openShipments.some((s) => s.id === rec.inbound_shipment_id);
  if (!hasCurrentShp && rec.shipment) {
    openShipments.push({
      id: rec.inbound_shipment_id,
      shipment_number: rec.shipment.shipment_number,
      po_number: rec.po?.po_number || "-",
      supplier_name: rec.po?.supplier?.name || "-",
      status: rec.status,
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
        <h1 className="text-xl font-bold text-zinc-955 dark:text-white">입고 검수 수정 (Edit Inbound Receiving)</h1>
        <p className="text-xs text-zinc-550 dark:text-zinc-400">
          초안(Draft) 상태인 입고 번호 {rec.receiving_number}의 검수 수량, 보류 파손 여부 및 창고 목적지를 변경합니다.
        </p>
      </div>

      <ReceivingForm
        initialReceiving={rec}
        openShipments={openShipments}
        warehouses={warehouses}
        defaultWarehouseId={rec.warehouse_id}
      />
    </div>
  );
}
