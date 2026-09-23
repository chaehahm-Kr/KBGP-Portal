import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPurchaseOrderDetail, getSuppliersForPo } from "@/lib/purchase-order/actions";
import { PurchaseOrderForm } from "@/components/admin/purchase-order-form";

export const metadata: Metadata = {
  title: "발주서 수정 (Edit PO) | K SELECT NETWORK 어드민",
};

export default async function AdminEditPurchaseOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
    redirect(`/admin/purchasing/${id}`);
  }

  // 1. Fetch PO details
  let po;
  try {
    po = await getPurchaseOrderDetail(id);
  } catch {
    notFound();
  }

  // Cancelled PO cannot be edited
  if (po.po_status === "CANCELLED") {
    redirect(`/admin/purchasing/${id}`);
  }

  // 2. Fetch active warehouses
  const { data: dbWarehouses } = await supabase
    .from("warehouses")
    .select("id, name, code, status, company_id")
    .eq("status", "active")
    .order("name", { ascending: true });
  const warehouses = dbWarehouses ?? [];

  // 3. Fetch suppliers
  const suppliers = await getSuppliersForPo();

  const isSent = po.po_status === "SENT";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-zinc-950 dark:text-white">발주서 수정 (Edit Purchase Order)</h1>
          {isSent && (
            <span className="inline-flex items-center rounded-md bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 text-xs font-bold text-indigo-700 dark:text-indigo-400 ring-1 ring-inset ring-indigo-700/20">
              Revision {(po.revision_no || 1) + 1} 생성 예정
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          발주서 번호 {po.po_number} (현재 Revision {po.revision_no || 1})의 세부 거래 조건 및 품목을 변경합니다.
          {isSent && " 발송 완료(Sent) 상태에서 수정 시 Revision 번호가 증가하고 공급사 확인이 초기화됩니다."}
        </p>
      </div>

      <PurchaseOrderForm
        initialPo={po}
        warehouses={warehouses}
        suppliers={suppliers}
        defaultWarehouseId={po.destination_warehouse_id}
      />
    </div>
  );
}
