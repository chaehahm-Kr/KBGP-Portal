import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSignedFileUrl } from "@/lib/files/storage";
import { AdminProductsList } from "@/components/admin/admin-products-list";
import { evaluateProductRegistrationStatus } from "@/lib/product/registration-status";
import { getBatchProductCategoryCompletions } from "@/lib/product/attribute-completion";
import { resolveEffectiveSku } from "@/lib/product/types";

export const metadata: Metadata = {
  title: "제품 관리 | K SELECT NETWORK 어드민",
};

export default async function AdminProductsPage() {
  await verifyAdminSession();
  const admin = createAdminClient();

  // 1. Fetch all products from all companies
  const { data: products } = await admin
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  // 2. Fetch all companies for name mapping
  const { data: companies } = await admin
    .from("companies")
    .select("id, name");
  const companyNameById = new Map((companies ?? []).map((c) => [c.id, c.name]));

  // 3. Fetch all brands for name mapping
  const { data: brands } = await admin
    .from("brands")
    .select("id, name");
  const brandNameById = new Map((brands ?? []).map((b) => [b.id, b.name]));

  // 4. Fetch all categories to build full path mappings
  const { data: dbCategories } = await admin
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
  const { data: productImages } = await admin
    .from("product_images")
    .select("id, product_id, storage_path, position")
    .order("position", { ascending: true });

  // 6. Fetch batch category & attribute completion status (Single Source of Truth)
  let categoryCompletions = new Map<string, any>();
  try {
    categoryCompletions = await getBatchProductCategoryCompletions(
      (products ?? []).map((p) => ({
        id: p.id,
        category_code: p.category_code || null,
      })),
      admin
    );
  } catch (err) {
    console.error("Admin products categoryCompletions error:", err);
  }

  const resolvedProducts = await Promise.all(
    (products ?? []).map(async (p) => {
      try {
        // Find the first image for this product
        const firstImage = (productImages ?? []).find((img) => img.product_id === p.id);
        let photoUrl: string | null = null;
        if (firstImage?.storage_path) {
          try {
            const { data } = await admin.storage
              .from("company-uploads")
              .createSignedUrl(firstImage.storage_path, 3600);
            photoUrl = data?.signedUrl || null;
          } catch {
            // Ignore signed URL error
          }
        }

        const adminOverrides = (p.price_additional_info as any)?.admin_overrides || {};
        const effectiveManufactureSku = resolveEffectiveSku(adminOverrides.manufacture_sku, p.manufacture_sku);
        const effectiveLetustoSku = resolveEffectiveSku(adminOverrides.letusto_sku, p.letusto_sku);

        const hasImages = (productImages ?? []).some((img) => img.product_id === p.id);
        const catCompletion = categoryCompletions.get(p.id) || null;
        const effectiveDeletedAt = (p as any).deleted_at || (p.price_additional_info as any)?.deleted_at || null;

        // Unified Single Source of Truth Registration Evaluation
        const registrationEvaluation = evaluateProductRegistrationStatus({
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
          adminOverrides,
          hasImages,
          categoryCompletion: catCompletion,
        });

        return {
          id: p.id,
          name: p.name,
          display_name: adminOverrides.name_en || p.name_en || adminOverrides.name || p.name,
          manufacture_sku: p.manufacture_sku,
          display_manufacture_sku: effectiveManufactureSku,
          letusto_sku: effectiveLetustoSku,
          parent_sku: adminOverrides.parent_sku !== undefined ? adminOverrides.parent_sku : p.parent_sku,
          child_sku: adminOverrides.child_sku !== undefined ? adminOverrides.child_sku : p.child_sku,
          category: p.category,
          brand_id: p.brand_id,
          company_id: p.company_id,
          companyName: companyNameById.get(p.company_id) || "(미지정 회사)",
          brandName: brandNameById.get(p.brand_id) || "(미지정 브랜드)",
          photoUrl,
          is_draft: registrationEvaluation.isDraft,
          missing_fields: registrationEvaluation.missingFields,
          registration_status: registrationEvaluation.status,
          deleted_at: effectiveDeletedAt,
          updated_at: (p as any).updated_at || null,
          last_updated_by_name: (p as any).last_updated_by_name || null,
          last_updated_source: (p as any).last_updated_source || null,
          selection_status: p.selection_status || "UNREVIEWED",
          sales_status: p.sales_status || "PREPARING",
          category_code: p.category_code || null,
          category_full_path: p.category_code ? getCategoryFullPath(p.category_code) : null,
        };
      } catch (prodErr) {
        console.error("Error resolving product for admin list:", p?.id, prodErr);
        const fallbackDeletedAt = (p as any)?.deleted_at || (p?.price_additional_info as any)?.deleted_at || null;
        return {
          id: p.id,
          name: p.name || "",
          display_name: p.name_en || p.name || "",
          manufacture_sku: p.manufacture_sku || null,
          display_manufacture_sku: p.manufacture_sku || null,
          letusto_sku: p.letusto_sku || null,
          parent_sku: p.parent_sku || null,
          child_sku: p.child_sku || null,
          category: p.category || "",
          brand_id: p.brand_id || "",
          company_id: p.company_id || "",
          companyName: companyNameById.get(p.company_id) || "(미지정 회사)",
          brandName: brandNameById.get(p.brand_id) || "(미지정 브랜드)",
          photoUrl: null,
          is_draft: true,
          missing_fields: [],
          registration_status: "DRAFT" as const,
          deleted_at: fallbackDeletedAt,
          updated_at: (p as any)?.updated_at || null,
          last_updated_by_name: null,
          last_updated_source: null,
          selection_status: p?.selection_status || "UNREVIEWED",
          sales_status: p?.sales_status || "PREPARING",
          category_code: p?.category_code || null,
          category_full_path: null,
        };
      }
    })
  );

  return <AdminProductsList initialProducts={resolvedProducts} />;
}
