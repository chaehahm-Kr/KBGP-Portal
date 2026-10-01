import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSuppliersForPo } from "@/lib/purchase-order/actions";
import { PurchaseOrderForm } from "@/components/admin/purchase-order-form";

export const metadata: Metadata = {
  title: "신규 발주서 생성 (New PO) | K SELECT NETWORK 어드민",
};

export default async function AdminNewPurchaseOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ request_id?: string }>;
}) {
  const { request_id } = await searchParams;
  const session = await verifyAdminSession();
  const supabase = createAdminClient();

  // Load user roles
  const { data: userRoles } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("staff_id", session.userId);
  const roles = (userRoles ?? []).map((r) => r.role);
  const isReadOnly = roles.length === 0 || (roles.length === 1 && roles[0] === "executive_viewer");
  if (isReadOnly) {
    redirect("/admin/purchasing");
  }

  // 1. Fetch active warehouses
  const { data: dbWarehouses } = await supabase
    .from("warehouses")
    .select("id, name, code, type, status, is_default_receiving, company_id")
    .eq("status", "active")
    .order("name", { ascending: true });
  const warehouses = dbWarehouses ?? [];

  // Find the default receiving warehouse dynamically from Own warehouses
  const ownWarehouses = warehouses.filter((w: any) => (w.type || "").toLowerCase() === "own");
  const defaultWarehouse = ownWarehouses.find((w: any) => w.is_default_receiving === true) || ownWarehouses[0] || warehouses[0] || null;

  // 2. Fetch suppliers
  const suppliers = await getSuppliersForPo();

  // 3. Handle PO Request Prefill if request_id query param is present
  let prefillPo: any = null;
  if (request_id) {
    try {
      const { getAdminPoRequestDetail } = await import("@/lib/purchase-order/request-actions");
      const req = await getAdminPoRequestDetail(request_id);
      if (req) {
        prefillPo = {
          request_id: req.id,
          request_number: req.request_number,
          supplier_id: req.company_id,
          ship_from_warehouse_id: req.shipping_origin_id || "",
          expected_ready_date: req.requested_ready_date || "",
          po_receiving_email: req.contact_email || "",
          supplier_facing_note: req.notes || "",
          lines: req.lines.map((l) => ({
            product_id: l.product_id,
            product_name: l.product_name_snapshot,
            letusto_sku: l.letusto_sku_snapshot,
            manufacture_sku: l.manufacture_sku_snapshot,
            qty: l.admin_final_qty !== null ? l.admin_final_qty : l.requested_qty,
            unit_cost: l.admin_final_unit_cost !== null ? l.admin_final_unit_cost : l.reference_unit_cost,
            line_note: l.line_note || "",
          })),
        };
      }
    } catch (e) {
      console.error("Failed to prefill PO from request:", e);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-955 dark:text-white">
          {prefillPo ? `발주서 전환 (Convert PO Request #${prefillPo.request_number})` : "신규 발주서 생성 (New Purchase Order)"}
        </h1>
        <p className="text-xs text-zinc-550 dark:text-zinc-400">
          {prefillPo
            ? `파트너사 발주 요청 #${prefillPo.request_number}의 내용이 자동 입력되었습니다. 최종 상업 조건을 확인하고 Draft PO를 생성합니다.`
            : "공급사에 전달할 구매 발주 정보(주문조건, 입고예정창고, 품목 및 가격 스냅샷)를 입력하여 초안을 생성합니다."}
        </p>
      </div>

      <PurchaseOrderForm
        initialPo={prefillPo}
        warehouses={warehouses}
        suppliers={suppliers}
        defaultWarehouseId={defaultWarehouse?.id || ""}
      />
    </div>
  );
}
