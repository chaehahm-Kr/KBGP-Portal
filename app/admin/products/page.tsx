import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getSignedFileUrl } from "@/lib/files/storage";
import { AdminProductsList } from "@/components/admin/admin-products-list";

export const metadata: Metadata = {
  title: "제품 관리 | K SELECT NETWORK 어드민",
};

export default async function AdminProductsPage() {
  await verifyAdminSession();
  const supabase = await createClient();

  // 1. Fetch all products from all companies
  let products: any[] | null = null;
  const { data: firstQueryProducts, error: queryError } = await supabase
    .from("products")
    .select("id, name, name_en, category, brand_id, company_id, manufacture_sku, letusto_sku, parent_sku, child_sku, price_krw_retail, price_usd_fob, package_width, package_depth, package_height, package_weight, price_additional_info, deleted_at, origin, upc, ean, selling_online, selling_offline, sales_link_1, sales_link_2, category_code, selection_status, sales_status")
    .order("created_at", { ascending: false });

  if (queryError && (
    queryError.message?.includes("deleted_at") || 
    queryError.message?.includes("category_code") || 
    queryError.code === "PGRST100" || 
    queryError.message?.includes("column")
  )) {
    const fallbackResult = await supabase
      .from("products")
      .select("id, name, name_en, category, brand_id, company_id, manufacture_sku, letusto_sku, parent_sku, child_sku, price_krw_retail, price_usd_fob, package_width, package_depth, package_height, package_weight, price_additional_info, origin, upc, ean, selling_online, selling_offline, sales_link_1, sales_link_2, selection_status, sales_status")
      .order("created_at", { ascending: false });
    products = fallbackResult.data;
  } else {
    products = firstQueryProducts;
  }

  // 2. Fetch all companies for name mapping
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name");
  const companyNameById = new Map((companies ?? []).map((c) => [c.id, c.name]));

  // 3. Fetch all brands for name mapping
  const { data: brands } = await supabase
    .from("brands")
    .select("id, name");
  const brandNameById = new Map((brands ?? []).map((b) => [b.id, b.name]));

  // 4. Fetch all categories to build full path mappings
  const { data: dbCategories } = await supabase
    .from("categories")
    .select("code, name_ko, parent_code, depth");
  const categoryMap = new Map((dbCategories ?? []).map((c) => [c.code, c]));

  const getCategoryFullPath = (code: string | null | undefined): string => {
    if (!code) return "";
    const path: string[] = [];
    let current = categoryMap.get(code);
    while (current) {
      path.unshift(current.name_ko);
      current = current.parent_code ? categoryMap.get(current.parent_code) : undefined;
    }
    return path.join(" > ");
  };

  // 5. Fetch first images (lowest position) for products to display thumbnail
  const { data: productImages } = await supabase
    .from("product_images")
    .select("id, product_id, storage_path, position")
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
          // Ignore signed URL error
        }
      }

      const adminOverrides = (p.price_additional_info as any)?.admin_overrides || {};
      const effectiveBrandId = p.brand_id;
      const effectiveCategory = adminOverrides.category !== undefined && adminOverrides.category !== "" ? adminOverrides.category : p.category;
      const effectiveNameEn = adminOverrides.name_en !== undefined && adminOverrides.name_en !== "" ? adminOverrides.name_en : p.name_en;
      const effectiveManufactureSku = adminOverrides.manufacture_sku !== undefined && adminOverrides.manufacture_sku !== "" ? adminOverrides.manufacture_sku : p.manufacture_sku;
      const effectiveOrigin = adminOverrides.origin !== undefined && adminOverrides.origin !== "" ? adminOverrides.origin : p.origin;
      const effectivePriceKrwRetail = adminOverrides.price_krw_retail !== undefined ? parseFloat(adminOverrides.price_krw_retail) : (p.price_krw_retail || 0);
      const effectivePriceUsdFob = adminOverrides.price_usd_fob !== undefined ? parseFloat(adminOverrides.price_usd_fob) : (p.price_usd_fob || 0);
      const effectiveUpc = adminOverrides.upc !== undefined && adminOverrides.upc !== "" ? adminOverrides.upc : p.upc;
      const effectiveEan = adminOverrides.ean !== undefined && adminOverrides.ean !== "" ? adminOverrides.ean : p.ean;

      const pkgWidth = adminOverrides.package_width !== undefined ? parseFloat(adminOverrides.package_width) : Number(p.package_width || 0);
      const pkgDepth = adminOverrides.package_depth !== undefined ? parseFloat(adminOverrides.package_depth) : Number(p.package_depth || 0);
      const pkgHeight = adminOverrides.package_height !== undefined ? parseFloat(adminOverrides.package_height) : Number(p.package_height || 0);
      const pkgWeight = adminOverrides.package_weight !== undefined ? parseFloat(adminOverrides.package_weight) : Number(p.package_weight || 0);

      // 누락 항목 분석 (상세 페이지의 ov 상태 반영된 Draft 판정과 완전히 동기화)
      const missingFields: string[] = [];
      if (!effectiveBrandId) missingFields.push("브랜드");
      if (!p.category_code && !effectiveCategory) missingFields.push("카테고리");
      if (!(effectiveNameEn || "").trim()) missingFields.push("영문 제품명");
      if (!(effectiveManufactureSku || "").trim()) missingFields.push("제조사 SKU");
      if (!(effectiveOrigin || "").trim()) missingFields.push("원산지");
      if (Number(effectivePriceKrwRetail) <= 0) missingFields.push("소비자 판매가");
      if (Number(effectivePriceUsdFob) <= 0) missingFields.push("FOB 수출 가격");
      
      if (pkgWidth <= 0 || pkgDepth <= 0 || pkgHeight <= 0 || pkgWeight <= 0) {
        missingFields.push("패키지 배송 규격");
      }
      if (!(effectiveUpc || "").trim() && !(effectiveEan || "").trim()) {
        missingFields.push("식별 바코드(UPC 또는 EAN)");
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
        manufacture_sku: p.manufacture_sku,
        display_manufacture_sku: effectiveManufactureSku,
        letusto_sku: adminOverrides.letusto_sku !== undefined ? adminOverrides.letusto_sku : p.letusto_sku,
        parent_sku: adminOverrides.parent_sku !== undefined ? adminOverrides.parent_sku : p.parent_sku,
        child_sku: adminOverrides.child_sku !== undefined ? adminOverrides.child_sku : p.child_sku,
        category: p.category,
        brand_id: p.brand_id,
        company_id: p.company_id,
        companyName: companyNameById.get(p.company_id) || "(미지정 회사)",
        brandName: brandNameById.get(p.brand_id) || "(미지정 브랜드)",
        photoUrl,
        is_draft: isDraft,
        missing_fields: missingFields,
        deleted_at: p.deleted_at,
        selection_status: p.selection_status || "UNREVIEWED",
        sales_status: p.sales_status || "PREPARING",
        category_code: p.category_code || null,
        category_full_path: p.category_code ? getCategoryFullPath(p.category_code) : null,
      };
    })
  );

  return <AdminProductsList initialProducts={resolvedProducts} />;
}
