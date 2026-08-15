import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getInventoryOverview } from "@/lib/inventory/actions";
import { getSignedFileUrl } from "@/lib/files/storage";
import { InventoryOverviewList } from "@/components/admin/inventory-overview-list";

export const metadata: Metadata = {
  title: "물류창고 재고 관리 (Inventory Overview) | K SELECT NETWORK 어드민",
};

export default async function AdminInventoryPage() {
  await verifyAdminSession();
  const supabase = createAdminClient();

  // 1. Fetch aggregated inventory overview
  const initialOverview = await getInventoryOverview();

  // 2. Resolve signed URLs for product thumbnails in the list
  const resolvedOverview = await Promise.all(
    initialOverview.map(async (item) => {
      let photoUrl: string | null = null;
      if (item.photoPath) {
        try {
          photoUrl = await getSignedFileUrl(item.photoPath);
        } catch {
          // Ignore signed URL error
        }
      }
      return {
        ...item,
        photoUrl,
      };
    })
  );

  // 3. Fetch active warehouses for dropdown filter
  const { data: dbWarehouses } = await supabase
    .from("warehouses")
    .select("id, name, code")
    .eq("status", "active")
    .order("name", { ascending: true });

  const warehouses = dbWarehouses ?? [];

  // 4. Fetch brands for dropdown filter
  const { data: dbBrands } = await supabase
    .from("brands")
    .select("id, name")
    .order("name", { ascending: true });

  const brands = dbBrands ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-955 dark:text-white">물류창고 재고 관리 (Inventory Overview)</h1>
        <p className="text-xs text-zinc-550 dark:text-zinc-400">
          Trading Product와 등록된 물류창고를 매핑하여 수량과 상태별 가용 재고 현황을 실시간 모니터링합니다.
        </p>
      </div>

      <InventoryOverviewList
        initialOverview={resolvedOverview}
        warehouses={warehouses}
        brands={brands}
      />
    </div>
  );
}
