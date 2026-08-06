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
    .select("id, name, name_en, category, brand_id, company_id, manufacture_sku, letusto_sku, parent_sku, child_sku, price_krw_retail, price_usd_fob, package_width, package_depth, package_height, package_weight, price_additional_info, deleted_at, selection_status, sales_status")
    .order("created_at", { ascending: false });

  if (queryError && (queryError.message?.includes("deleted_at") || queryError.code === "PGRST100" || queryError.message?.includes("selection_status"))) {
    const fallbackResult = await supabase
      .from("products")
      .select("id, name, name_en, category, brand_id, company_id, manufacture_sku, letusto_sku, parent_sku, child_sku, price_krw_retail, price_usd_fob, package_width, package_depth, package_height, package_weight, price_additional_info")
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

  // 4. Fetch first images (lowest position) for products to display thumbnail
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
      const effectiveManufactureSku = adminOverrides.manufacture_sku !== undefined ? adminOverrides.manufacture_sku : p.manufacture_sku;
      
      // 브랜드, 카테고리, 영문 제품명, 제조사 SKU, 한국 소비자 판매가, FOB 수출 가격, 패키지 규격(가로, 세로, 높이, 무게) 중 하나라도 누락되면 Draft(보완 대기) 상태로 판정
      const isDraft =
        !p.brand_id ||
        !p.category ||
        !p.name_en?.trim() ||
        !(effectiveManufactureSku || "").trim() ||
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
        deleted_at: p.deleted_at,
        selection_status: p.selection_status || "UNREVIEWED",
        sales_status: p.sales_status || "PREPARING",
      };
    })
  );

  return <AdminProductsList initialProducts={resolvedProducts} />;
}
