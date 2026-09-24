import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPortalPurchaseOrderById, getPortalPoChangeRequests } from "@/lib/portal/actions";
import { getCompanyShippingOrigins } from "@/lib/company/shipping-origin-actions";
import { getPoDocuments } from "@/lib/purchase-order/document-actions";
import PoDetailClient from "@/components/portal/po-detail-client";
import { requireCompanyMembership } from "@/lib/company/dal";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "발주 상세 정보 | 파트너 포털",
};

interface PortalPoDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PortalPoDetailPage({ params }: PortalPoDetailPageProps) {
  const resolvedParams = await params;
  const { id } = resolvedParams;
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  // Fetch PO detail and change request logs
  let po: any = null;
  let changeRequests: any[] = [];
  try {
    po = await getPortalPurchaseOrderById(id);
    changeRequests = await getPortalPoChangeRequests(id);
  } catch (e: any) {
    console.warn("PO not accessible or unauthorized for supplier:", e?.message);
    redirect("/portal/orders/purchase-orders");
  }

  // Fetch shipping origins
  const shippingOrigins = await getCompanyShippingOrigins(companyId);

  // Fetch documents
  const documents = await getPoDocuments(id);

  // Fetch shipments scoping by PO ID
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

  // Fetch linked cases (Partner Inquiries)
  const { data: dbCases } = await supabase
    .from("partner_inquiries")
    .select("id, case_number, title, status, category, created_at, updated_at")
    .eq("related_po_id", id)
    .order("created_at", { ascending: false });
  const linkedCases = dbCases ?? [];

  return (
    <PoDetailClient 
      po={po} 
      changeRequests={changeRequests} 
      shipments={shipments}
      receivings={receivings}
      goodsReadiness={goodsReadiness}
      documents={documents}
      warehouses={warehouses}
      shippingOrigins={shippingOrigins}
      linkedCases={linkedCases}
    />
  );
}
