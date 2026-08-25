import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getPurchaseOrderDetail, getSupplierPoChangeRequests } from "@/lib/purchase-order/actions";
import { PurchaseOrderDetail } from "@/components/admin/purchase-order-detail";

export const metadata: Metadata = {
  title: "발주서 상세 정보 (PO Detail) | K SELECT NETWORK 어드민",
};

export default async function AdminPurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await verifyAdminSession();
  const supabase = await createClient();

  // Load user roles
  const { data: userRoles } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("staff_id", session.userId);
  const roles = (userRoles ?? []).map((r) => r.role);
  const isReadOnly = roles.length === 0 || (roles.length === 1 && roles[0] === "executive_viewer");

  let po;
  let changeRequests: any[] = [];
  try {
    po = await getPurchaseOrderDetail(id);
    changeRequests = await getSupplierPoChangeRequests(id);
  } catch (err) {
    console.error("Failed to load PO detail", err);
    notFound();
  }

  // Fetch sibling invoices
  const { data: invoices } = await supabase
    .from("supplier_invoices")
    .select("id, internal_ap_number, supplier_invoice_number, invoice_total, currency, invoice_status")
    .eq("purchase_order_id", id);

  // Fetch shipments
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

  // Fetch receivings
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
    .order("created_at", { ascending: false });
  const goodsReadiness = dbGoodsReadiness ?? [];

  // Fetch active warehouses
  const { data: dbAllWarehouses } = await supabase
    .from("warehouses")
    .select("id, name, code")
    .eq("status", "active")
    .order("name", { ascending: true });
  const warehouses = dbAllWarehouses ?? [];

  return (
    <div className="space-y-6">
      <PurchaseOrderDetail 
        po={po} 
        isReadOnly={isReadOnly} 
        invoices={invoices ?? []} 
        changeRequests={changeRequests} 
        shipments={shipments}
        receivings={receivings}
        goodsReadiness={goodsReadiness}
        warehouses={warehouses}
      />
    </div>
  );
}
