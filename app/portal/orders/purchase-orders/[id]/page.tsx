import type { Metadata } from "next";
import { getPortalPurchaseOrderById, getPortalPoChangeRequests } from "@/lib/portal/actions";
import PoDetailClient from "@/components/portal/po-detail-client";
import { requireCompanyMembership } from "@/lib/company/dal";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "발주 상세 정보 | 파트너 포털",
};

interface PortalPoDetailPageProps {
  params: Promise<{ id: string }> | { id: string };
}

export default async function PortalPoDetailPage({ params }: PortalPoDetailPageProps) {
  const resolvedParams = await params;
  const { id } = resolvedParams;
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  // Fetch PO detail and change request logs
  const po = await getPortalPurchaseOrderById(id);
  const changeRequests = await getPortalPoChangeRequests(id);

  // Fetch shipments scoping by supplier companyId
  const { data: dbShipments } = await supabase
    .from("inbound_shipments")
    .select(`
      *,
      warehouse:destination_warehouse_id (id, name, code),
      lines:inbound_shipment_lines (
        id, purchase_order_line_id, product_id, shipped_qty, line_note
      )
    `)
    .eq("purchase_order_id", id)
    .eq("supplier_id", companyId)
    .order("created_at", { ascending: false });
  const shipments = dbShipments ?? [];

  // Fetch receivings scoping by PO
  const { data: dbReceivings } = await supabase
    .from("receivings")
    .select(`
      *,
      warehouse:warehouse_id (id, name, code),
      lines:receiving_lines (
        id, inbound_shipment_line_id, purchase_order_line_id, product_id, received_qty, damaged_qty, hold_qty, line_note
      )
    `)
    .eq("purchase_order_id", id)
    .order("created_at", { ascending: false });
  const receivings = dbReceivings ?? [];

  // Fetch goods readiness
  const { data: dbGoodsReadiness } = await supabase
    .from("goods_readiness")
    .select(`
      *,
      lines:goods_readiness_lines (
        id, purchase_order_line_id, product_id, ready_qty, cartons, gross_weight, cbm
      )
    `)
    .eq("purchase_order_id", id)
    .eq("supplier_id", companyId)
    .order("created_at", { ascending: false });
  const goodsReadiness = dbGoodsReadiness ?? [];

  // Fetch warehouses
  const { data: dbAllWarehouses } = await supabase
    .from("warehouses")
    .select("id, name, code")
    .eq("status", "active")
    .order("name", { ascending: true });
  const warehouses = dbAllWarehouses ?? [];

  return (
    <PoDetailClient 
      po={po} 
      changeRequests={changeRequests} 
      shipments={shipments}
      receivings={receivings}
      goodsReadiness={goodsReadiness}
      warehouses={warehouses}
    />
  );
}
