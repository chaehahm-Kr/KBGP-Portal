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
  await verifyAdminSession();
  const supabase = createAdminClient();

  // 1. Fetch PO details
  let po;
  try {
    po = await getPurchaseOrderDetail(id);
  } catch {
    notFound();
  }

  // Double check if in DRAFT status
  if (po.status !== "DRAFT") {
    redirect(`/admin/purchasing/${id}`);
  }

  // 2. Fetch active warehouses
  const { data: dbWarehouses } = await supabase
    .from("warehouses")
    .select("id, name, code, status")
    .eq("status", "active")
    .order("name", { ascending: true });
  const warehouses = dbWarehouses ?? [];

  // 3. Fetch suppliers
  const suppliers = await getSuppliersForPo();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-955 dark:text-white">발주서 수정 (Edit Purchase Order)</h1>
        <p className="text-xs text-zinc-550 dark:text-zinc-400">
          초안(Draft) 상태인 발주서 번호 {po.po_number}의 세부 거래 조건 및 라인 품목을 변경합니다.
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
