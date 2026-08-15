import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getInboundShipmentDetail } from "@/lib/inbound/actions";
import { ShipmentDetail } from "@/components/admin/shipment-detail";

export const metadata: Metadata = {
  title: "선적 상세 정보 (Shipment Detail) | K SELECT NETWORK 어드민",
};

export default async function AdminShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await verifyAdminSession();

  let shp;
  try {
    shp = await getInboundShipmentDetail(id);
  } catch (err) {
    console.error("Failed to load shipment detail", err);
    notFound();
  }

  return (
    <div className="space-y-6">
      <ShipmentDetail shipment={shp} />
    </div>
  );
}
