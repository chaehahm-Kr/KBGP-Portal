import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBrandTrademarks } from "@/lib/brand/actions";
import { getSignedFileUrl } from "@/lib/files/storage";
import { AdminBrandsList, type AdminBrandItem } from "@/components/admin/admin-brands-list";

export const metadata: Metadata = {
  title: "브랜드 관리 | K SELECT NETWORK 어드민",
};

export default async function AdminBrandsPage() {
  await verifyAdminSession();
  const supabase = createAdminClient();

  // Safely fetch brands with brand_code and trademark columns
  let brandsData: any[] = [];
  const { data: brandsWithCode, error: brandsError } = await supabase
    .from("brands")
    .select(`
      id, brand_code, name, intro, logo_path, company_id, is_active, created_at, updated_at,
      companies (id, name),
      has_kr_trademark, kr_trademark_number, kr_trademark_path,
      has_us_trademark, us_trademark_number, us_trademark_path
    `)
    .order("created_at", { ascending: true });

  if (!brandsError && brandsWithCode) {
    brandsData = brandsWithCode;
  } else {
    // Fallback if brand_code column or trademark columns differ
    const { data: coreBrands } = await supabase
      .from("brands")
      .select(`
        id, name, intro, logo_path, company_id, is_active, created_at, updated_at,
        companies (id, name)
      `)
      .order("created_at", { ascending: true });
    brandsData = coreBrands ?? [];
  }

  // Fetch product counts per brand in a single aggregate query (N+1 query prevention)
  const { data: productsData } = await supabase
    .from("products")
    .select("id, brand_id");

  const productCountByBrandId = new Map<string, number>();
  (productsData ?? []).forEach((p) => {
    if (p.brand_id) {
      productCountByBrandId.set(p.brand_id, (productCountByBrandId.get(p.brand_id) || 0) + 1);
    }
  });

  // Sort existing brands deterministically by created_at ASC, id ASC for fallback code indexing
  const sortedBrandsData = [...brandsData].sort((a, b) => {
    const tA = new Date(a.created_at || 0).getTime();
    const tB = new Date(b.created_at || 0).getTime();
    if (tA !== tB) return tA - tB;
    return String(a.id).localeCompare(String(b.id));
  });

  // Parse and resolve trademark information, logos, and product counts
  const resolvedBrands: AdminBrandItem[] = await Promise.all(
    sortedBrandsData.map(async (brand, index) => {
      const tm = await parseBrandTrademarks(brand);
      const logoUrl = brand.logo_path ? await getSignedFileUrl(brand.logo_path) : null;
      const productCount = productCountByBrandId.get(brand.id) || 0;
      
      // Fallback display format if DB migration is pending execution
      const fallbackCode = `BR-${String(index + 1).padStart(6, "0")}`;
      const brandCode = brand.brand_code || fallbackCode;

      return {
        id: brand.id,
        brandCode,
        name: brand.name,
        logoUrl,
        companyName: brand.companies?.name || "알 수 없음",
        companyId: brand.companies?.id || brand.company_id,
        hasKr: tm.has_kr_trademark,
        hasUs: tm.has_us_trademark,
        isActive: brand.is_active !== false,
        productCount,
        lastUpdated: new Date(brand.updated_at || brand.created_at).toLocaleDateString(),
      };
    })
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-955 dark:text-white">브랜드 관리</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          K SELECT NETWORK 플랫폼의 파트너사 브랜드 레지스트리를 통합 관리하고 상표권 및 연결 상품 현황을 조회합니다.
        </p>
      </div>

      {/* Interactive Brand Registry List */}
      <AdminBrandsList initialBrands={resolvedBrands} />
    </div>
  );
}
