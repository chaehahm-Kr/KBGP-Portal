import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBrandTrademarks } from "@/lib/brand/actions";
import { getSignedFileUrl } from "@/lib/files/storage";
import { AdminBrandsList, type AdminBrandItem } from "@/components/admin/admin-brands-list";
import { evaluateProductRegistrationStatus } from "@/lib/product/registration-status";
import { getBatchProductCategoryCompletions } from "@/lib/product/attribute-completion";
import { resolveEffectiveSku } from "@/lib/product/types";

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
        id, brand_code, name, intro, logo_path, company_id, is_active, created_at, updated_at,
        companies (id, name)
      `)
      .order("created_at", { ascending: true });
    brandsData = coreBrands ?? [];
  }

  // Fetch products and images in batch to compute registration status breakdown per brand
  const { data: productsData } = await supabase
    .from("products")
    .select(`
      id, brand_id, name, name_en, category_code, manufacture_sku, origin,
      price_krw_retail, price_usd_fob, item_width, item_depth, item_height, item_weight,
      package_width, package_depth, package_height, package_weight,
      carton_pack_qty, carton_width, carton_depth, carton_height, carton_weight,
      upc, ean, selling_online, sales_link_1, price_additional_info
    `);

  const { data: productImages } = await supabase
    .from("product_images")
    .select("product_id");
  const hasImagesProductIds = new Set((productImages ?? []).map((img) => img.product_id));

  let categoryCompletions = new Map<string, any>();
  try {
    categoryCompletions = await getBatchProductCategoryCompletions(
      (productsData ?? []).map((p) => ({
        id: p.id,
        category_code: p.category_code || null,
      })),
      supabase
    );
  } catch (err) {
    console.error("Admin brands categoryCompletions error:", err);
  }

  const productCountByBrandId = new Map<
    string,
    { total: number; complete: number; draft: number; deleted: number }
  >();

  (productsData ?? []).forEach((p) => {
    if (!p.brand_id) return;

    const adminOverrides = (p.price_additional_info as any)?.admin_overrides || {};
    const effectiveManufactureSku = resolveEffectiveSku(adminOverrides.manufacture_sku, p.manufacture_sku);
    const hasImages = hasImagesProductIds.has(p.id);
    const catCompletion = categoryCompletions.get(p.id) || null;
    const effectiveDeletedAt = (p as any).deleted_at || (p.price_additional_info as any)?.deleted_at || null;

    const evaluation = evaluateProductRegistrationStatus({
      id: p.id,
      name: p.name,
      name_en: p.name_en,
      brand_id: p.brand_id,
      category_code: p.category_code,
      manufacture_sku: effectiveManufactureSku,
      origin: p.origin,
      price_krw_retail: p.price_krw_retail,
      price_usd_fob: p.price_usd_fob,
      item_width: p.item_width,
      item_depth: p.item_depth,
      item_height: p.item_height,
      item_weight: p.item_weight,
      package_width: p.package_width,
      package_depth: p.package_depth,
      package_height: p.package_height,
      package_weight: p.package_weight,
      carton_pack_qty: p.carton_pack_qty,
      carton_width: p.carton_width,
      carton_depth: p.carton_depth,
      carton_height: p.carton_height,
      carton_weight: p.carton_weight,
      upc: p.upc,
      ean: p.ean,
      selling_online: p.selling_online,
      sales_link_1: p.sales_link_1,
      deleted_at: effectiveDeletedAt,
      adminOverrides: adminOverrides,
      hasImages: hasImages,
      categoryCompletion: catCompletion,
    });

    const current = productCountByBrandId.get(p.brand_id) || {
      total: 0,
      complete: 0,
      draft: 0,
      deleted: 0,
    };
    current.total += 1;
    if (evaluation.isDeleted) {
      current.deleted += 1;
    } else if (evaluation.isDraft) {
      current.draft += 1;
    } else {
      current.complete += 1;
    }
    productCountByBrandId.set(p.brand_id, current);
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
      const productCount = productCountByBrandId.get(brand.id) || {
        total: 0,
        complete: 0,
        draft: 0,
        deleted: 0,
      };

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
