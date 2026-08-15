import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSuppliersForPo } from "@/lib/purchase-order/actions";
import { PurchaseOrderForm } from "@/components/admin/purchase-order-form";

export const metadata: Metadata = {
  title: "신규 발주서 생성 (New PO) | K SELECT NETWORK 어드민",
};

export default async function AdminNewPurchaseOrderPage() {
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
    .select("id, name, code, status, is_default_receiving, company_id")
    .eq("status", "active")
    .order("name", { ascending: true });
  const warehouses = dbWarehouses ?? [];

  // Find the default receiving warehouse dynamically
  const defaultWarehouse = warehouses.find((w: any) => w.is_default_receiving === true) || warehouses[0] || null;

  // 2. Fetch suppliers
  const suppliers = await getSuppliersForPo();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-955 dark:text-white">신규 발주서 생성 (New Purchase Order)</h1>
        <p className="text-xs text-zinc-550 dark:text-zinc-400">
          공급사에 전달할 구매 발주 정보(주문조건, 입고예정창고, 품목 및 가격 스냅샷)를 입력하여 초안을 생성합니다.
        </p>
      </div>

      <PurchaseOrderForm
        warehouses={warehouses}
        suppliers={suppliers}
        defaultWarehouseId={defaultWarehouse?.id || ""}
      />
    </div>
  );
}
