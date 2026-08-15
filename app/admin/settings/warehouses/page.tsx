import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getWarehouses } from "@/lib/warehouse/actions";
import { WarehouseSettingsManager } from "@/components/admin/settings/warehouse-settings-manager";

export const metadata: Metadata = {
  title: "물류창고 설정 관리 | K SELECT NETWORK 어드민",
};

export default async function AdminWarehousesPage() {
  const session = await verifyAdminSession();
  const supabase = await createClient();

  // 1. Fetch warehouses
  const warehouses = await getWarehouses();

  // 2. Fetch companies for select dropdown
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name")
    .eq("status", "active")
    .order("name", { ascending: true });

  // 3. Fetch current staff permissions
  const { data: staff } = await supabase
    .from("staff_members")
    .select("base_role, menu_permissions")
    .eq("id", session.userId)
    .maybeSingle();

  const baseRole = staff?.base_role || "reviewer";
  const menuPermissions = staff?.menu_permissions as any;
  const canEdit = baseRole === "super_admin" || menuPermissions?.companies?.edit === true;

  return (
    <div className="flex-1 p-6 space-y-6">
      <div className="flex flex-col gap-1 border-b border-zinc-100 pb-5 dark:border-zinc-800">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
          물류창고 관리 (Warehouse Settings)
        </h1>
        <p className="text-xs text-zinc-550 dark:text-zinc-400">
          회사별로 여러 물류창고를 등록하고 관리할 수 있는 공통 Warehouse Master입니다.
        </p>
      </div>

      <WarehouseSettingsManager
        initialWarehouses={warehouses}
        companies={companies || []}
        canEdit={canEdit}
      />
    </div>
  );
}
