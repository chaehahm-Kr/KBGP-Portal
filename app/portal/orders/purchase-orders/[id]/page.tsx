import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPortalPurchaseOrderById, getPortalPoChangeRequests } from "@/lib/portal/actions";
import { getCompanyShippingOrigins } from "@/lib/company/shipping-origin-actions";
import { getPoDocuments } from "@/lib/purchase-order/document-actions";
import { requireCompanyMembership, getPortalTenantContext } from "@/lib/company/dal";
import { hasPortalPermission } from "@/lib/company/permissions";
import { AccessDeniedView } from "@/components/portal/access-denied";

export const metadata: Metadata = {
  title: "발주 상세 정보 | 파트너 포털",
};

interface PortalPoDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PortalPoDetailPage({ params }: PortalPoDetailPageProps) {
  const canRead = await hasPortalPermission("orders", "read");
  if (!canRead) {
    return (
      <AccessDeniedView
        title="접근 권한이 없습니다."
        message="주문 / 발주서 메뉴를 이용할 권한이 없습니다. 권한 조정을 원하시면 회사 관리자에게 문의해주세요."
      />
    );
  }

  const canWrite = await hasPortalPermission("orders", "write");
  const resolvedParams = await params;
  const { id } = resolvedParams;
  const { companyId, supabase } = await getPortalTenantContext();

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

  const finalShipments = (po?.shipments && po.shipments.length > 0) ? po.shipments : shipments;
  const finalReceivings = (po?.receivings && po.receivings.length > 0) ? po.receivings : receivings;
  const finalGoodsReadiness = (po?.goodsReadiness && po.goodsReadiness.length > 0) ? po.goodsReadiness : goodsReadiness;

  const PoDetailClient = (await import("@/components/portal/po-detail-client")).default;

  return (
    <PoDetailClient 
      po={po} 
      changeRequests={changeRequests} 
      shipments={finalShipments}
      receivings={finalReceivings}
      goodsReadiness={finalGoodsReadiness}
      documents={documents}
      warehouses={warehouses}
      shippingOrigins={shippingOrigins}
      linkedCases={linkedCases}
      canWrite={canWrite}
    />
  );
}
