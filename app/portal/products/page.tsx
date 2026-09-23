import type { Metadata } from "next";
import { requireCompanyMembership } from "@/lib/company/dal";
import { createClient } from "@/lib/supabase/server";
import { getSignedFileUrl } from "@/lib/files/storage";
import { PortalProductsList } from "@/components/product/portal-products-list";
import { getBatchProductCategoryCompletions } from "@/lib/product/attribute-completion";
import { evaluateProductRegistrationStatus } from "@/lib/product/registration-status";
import { resolveEffectiveSku } from "@/lib/product/types";

export const metadata: Metadata = {
  title: "제품 관리 | 파트너 포털",
};

export default async function ProductsPage() {
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  let products: any[] | null = null;
  const { data: firstQueryProducts, error: queryError } = await supabase
    .from("products")
    .select("id, name, name_en, category, brand_id, letusto_sku, manufacture_sku, price_krw_retail, price_usd_fob, package_width, package_depth, package_height, package_weight, price_additional_info, origin, upc, ean, selling_online, selling_offline, sales_link_1, sales_link_2, category_code, selection_status, sales_status, status")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (queryError) {
    console.error("Products query error, trying select('*'):", queryError);
    const fallbackResult = await supabase
      .from("products")
      .select("*")
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

  // Fetch category & attribute completion status for all products
  let categoryCompletions = new Map<string, any>();
  try {
    categoryCompletions = await getBatchProductCategoryCompletions(
      (products ?? []).map((p) => ({
        id: p.id,
        category_code: p.category_code || null,
      }))
    );
  } catch (err) {
    console.error("Portal products categoryCompletions error:", err);
  }

  const resolvedProducts = await Promise.all(
    (products ?? []).map(async (p) => {
      try {
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
        const effectiveLetustoSku = resolveEffectiveSku(adminOverrides.letusto_sku, p.letusto_sku);
        const effectiveManufactureSku = resolveEffectiveSku(adminOverrides.manufacture_sku, p.manufacture_sku);

        const catCompletion = categoryCompletions.get(p.id) || null;
        const hasImages = (productImages ?? []).some((img) => img.product_id === p.id);

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
          package_width: p.package_width,
          package_depth: p.package_depth,
          package_height: p.package_height,
          package_weight: p.package_weight,
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
          letusto_sku: effectiveLetustoSku,
          manufacture_sku: effectiveManufactureSku,
          category: p.category,
          brand_id: p.brand_id,
          brandName: brandNameById.get(p.brand_id) || "(미지정 브랜드)",
          photoUrl,
          is_draft: registrationEvaluation.isDraft,
          missing_fields: registrationEvaluation.missingFields,
          registration_status: registrationEvaluation.status,
          selection_status: p.selection_status || "UNREVIEWED",
          sales_status: p.sales_status || "PREPARING",
          deleted_at: effectiveDeletedAt,
          category_code: p.category_code || null,
          category_completion: catCompletion,
        };
      } catch (prodErr) {
        console.error("Error resolving product for portal list:", p?.id, prodErr);
        const fallbackDeletedAt = (p as any)?.deleted_at || (p?.price_additional_info as any)?.deleted_at || null;
        return {
          id: p.id,
          name: p.name || "",
          display_name: p.name_en || p.name || "",
          letusto_sku: p.letusto_sku || "",
          manufacture_sku: p.manufacture_sku || "",
          category: p.category || "",
          brand_id: p.brand_id || "",
          brandName: brandNameById.get(p.brand_id) || "(미지정 브랜드)",
          photoUrl: null,
          is_draft: true,
          missing_fields: [],
          registration_status: "DRAFT" as const,
          selection_status: p.selection_status || "UNREVIEWED",
          sales_status: p.sales_status || "PREPARING",
          deleted_at: fallbackDeletedAt,
          category_code: p.category_code || null,
          category_completion: null,
        };
      }
    })
  );

  return (
    <div className="w-full max-w-7xl">
      <PortalProductsList initialProducts={resolvedProducts} hasBrand={hasBrand} />
    </div>
  );
}


