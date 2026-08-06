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
    .select("id, name, name_en, category, brand_id, letusto_sku, manufacture_sku, price_krw_retail, price_usd_fob, package_width, package_depth, package_height, package_weight, price_additional_info, deleted_at, origin, upc, ean, selling_online, selling_offline, sales_link_1, sales_link_2")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (queryError && (queryError.message?.includes("deleted_at") || queryError.code === "PGRST100")) {
    const fallbackResult = await supabase
      .from("products")
      .select("id, name, name_en, category, brand_id, letusto_sku, manufacture_sku, price_krw_retail, price_usd_fob, package_width, package_depth, package_height, package_weight, price_additional_info, origin, upc, ean, selling_online, selling_offline, sales_link_1, sales_link_2")
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

      // 누락 항목 분석
      const missingFields: string[] = [];
      if (!p.brand_id) missingFields.push("브랜드");
      if (!p.category) missingFields.push("카테고리");
      if (!p.name_en?.trim()) missingFields.push("영문 제품명");
      if (!effectiveManufactureSku.trim()) missingFields.push("제조사 SKU");
      if (!p.origin?.trim()) missingFields.push("원산지");
      if (!p.price_krw_retail || Number(p.price_krw_retail) <= 0) missingFields.push("소비자 판매가");
      if (!p.price_usd_fob || Number(p.price_usd_fob) <= 0) missingFields.push("FOB 수출 가격");
      
      const widthVal = Number(p.package_width || 0);
      const depthVal = Number(p.package_depth || 0);
      const heightVal = Number(p.package_height || 0);
      const weightVal = Number(p.package_weight || 0);
      if (widthVal <= 0 || depthVal <= 0 || heightVal <= 0 || weightVal <= 0) {
        missingFields.push("패키지 배송 규격");
      }
      
      if (!p.upc?.trim() && !p.ean?.trim()) {
        missingFields.push("식별 바코드(UPC 또는 EAN)");
      }
      if (p.selling_online && !p.sales_link_1?.trim()) {
        missingFields.push("온라인 판매 링크");
      }
      
      const hasImages = (productImages ?? []).some((img) => img.product_id === p.id);
      if (!hasImages) {
        missingFields.push("대표 이미지");
      }

      const isDraft = missingFields.length > 0;

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
        missing_fields: missingFields,
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

