import type { Metadata } from "next";
import { requireCompanyMembership } from "@/lib/company/dal";
import { createClient } from "@/lib/supabase/server";
import { getSignedFileUrl } from "@/lib/files/storage";
import { PortalProductsList } from "@/components/product/portal-products-list";

export const metadata: Metadata = {
  title: "제품 관리 | 파트너 포털",
};

export default async function ProductsPage() {
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  let products: any[] | null = null;
  const { data: firstQueryProducts, error: queryError } = await supabase
    .from("products")
    .select("id, name, name_en, category, brand_id, letusto_sku, manufacture_sku, price_krw_retail, price_usd_fob, package_width, package_depth, package_height, package_weight, price_additional_info, deleted_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (queryError && (queryError.message?.includes("deleted_at") || queryError.code === "PGRST100")) {
    const fallbackResult = await supabase
      .from("products")
      .select("id, name, name_en, category, brand_id, letusto_sku, manufacture_sku, price_krw_retail, price_usd_fob, package_width, package_depth, package_height, package_weight, price_additional_info")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    products = fallbackResult.data;
  } else {
    products = firstQueryProducts;
  }

  const { data: brands } = await supabase
    .from("brands")
    .select("id, name");

  const brandNameById = new Map((brands ?? []).map((b) => [b.id, b.name]));
  const hasBrand = (brands ?? []).filter((b) => b.id !== undefined).length > 0;

  // Fetch product images to display thumbnail
  const { data: productImages } = await supabase
    .from("product_images")
    .select("id, product_id, storage_path, position")
    .eq("company_id", companyId)
    .order("position", { ascending: true });

  const resolvedProducts = await Promise.all(
    (products ?? []).map(async (p) => {
      // Find the first image for this product
      const firstImage = (productImages ?? []).find((img) => img.product_id === p.id);
      let photoUrl: string | null = null;
      if (firstImage?.storage_path) {
        try {
          photoUrl = await getSignedFileUrl(firstImage.storage_path);
        } catch {
          // Ignore
        }
      }

      const adminOverrides = (p.price_additional_info as any)?.admin_overrides || {};
      const effectiveLetustoSku = adminOverrides.letusto_sku || p.letusto_sku || "";
      const effectiveManufactureSku = adminOverrides.manufacture_sku || p.manufacture_sku || "";

      // 브랜드, 카테고리, 영문 제품명, 제조사 SKU, 한국 소비자 판매가, FOB 수출 가격, 패키지 규격(가로, 세로, 높이, 무게) 중 하나라도 누락되면 Draft(보완 대기) 상태로 판정
      const isDraft =
        !p.brand_id ||
        !p.category ||
        !p.name_en?.trim() ||
        !effectiveManufactureSku.trim() ||
        !p.price_krw_retail ||
        Number(p.price_krw_retail) <= 0 ||
        !p.price_usd_fob ||
        Number(p.price_usd_fob) <= 0 ||
        !p.package_width ||
        Number(p.package_width) <= 0 ||
        !p.package_depth ||
        Number(p.package_depth) <= 0 ||
        !p.package_height ||
        Number(p.package_height) <= 0 ||
        !p.package_weight ||
        Number(p.package_weight) <= 0;

      return {
        id: p.id,
        name: p.name,
        display_name: adminOverrides.name_en || p.name_en || adminOverrides.name || p.name,
        letusto_sku: effectiveLetustoSku,
        manufacture_sku: effectiveManufactureSku,
        category: p.category,
        brand_id: p.brand_id,
        brandName: brandNameById.get(p.brand_id) || "(미지정 브랜드)",
        photoUrl,
        is_draft: isDraft,
        deleted_at: p.deleted_at,
      };
    })
  );

  return (
    <div className="w-full max-w-7xl">
      <PortalProductsList initialProducts={resolvedProducts} hasBrand={hasBrand} />
    </div>
  );
}

