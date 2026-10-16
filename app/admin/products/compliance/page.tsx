import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveEffectiveSku } from "@/lib/product/types";
import { resolveProductName } from "@/lib/product/name-resolver";
import { ComplianceClient, type ComplianceProductItem } from "@/components/admin/products/compliance-client";

export const metadata: Metadata = {
  title: "Product Compliance | K SELECT NETWORK Admin",
  description: "US Import & Market Readiness — Regulatory review checklist and existing product compliance overview",
};

export default async function AdminProductCompliancePage() {
  await verifyAdminSession();
  const admin = createAdminClient();

  // 1. Fetch all products
  const { data: rawProducts } = await admin
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  const products = rawProducts ?? [];
  const productIds = products.map((p) => p.id);

  // 2. Fetch companies for name and country mapping
  const { data: companies } = await admin
    .from("companies")
    .select("id, name, country");
  const companyMap = new Map((companies ?? []).map((c) => [c.id, c]));

  // 3. Fetch brands for name mapping
  const { data: brands } = await admin
    .from("brands")
    .select("id, name, brand_code");
  const brandMap = new Map((brands ?? []).map((b) => [b.id, b]));

  // 4. Fetch categories to build category full paths
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

  // 5. Fetch first images for products
  const { data: rawImages } = await admin
    .from("product_images")
    .select("id, product_id, storage_path, position")
    .order("position", { ascending: true });

  const productImages = rawImages ?? [];

  // 6. Fetch regulatory and compliance attribute values
  const { data: rawAttrValues } = await admin
    .from("product_attribute_values")
    .select("product_id, attribute_code, value_json, text_value")
    .in("attribute_code", [
      "FDA_STATUS",
      "MOCRA_STATUS",
      "OTC_STATUS",
      "DRUG_FACTS_STATUS",
      "HAIR_LOSS_CLAIM",
      "PRIMARY_CONCERN",
      "SPF_VALUE",
      "PA_RATING",
      "UV_FILTER_TYPE",
      "FORMULATION",
      "PACKAGE_FORMAT",
      "SHELF_LIFE_MONTHS",
      "PAO_MONTHS",
      "STORAGE_CONDITION",
    ]);

  const attrValues = rawAttrValues ?? [];
  // Map of productId -> (attribute_code -> value_json)
  const productAttrMap = new Map<string, Map<string, any>>();
  attrValues.forEach((row) => {
    if (!productAttrMap.has(row.product_id)) {
      productAttrMap.set(row.product_id, new Map());
    }
    productAttrMap.get(row.product_id)!.set(row.attribute_code, row.value_json);
  });

  // 7. Fetch product certificates
  const { data: rawCertificates } = await admin
    .from("product_certificates")
    .select("id, product_id, certificate_type, storage_path, original_filename, version, created_at");

  const certificates = rawCertificates ?? [];

  // 8. Collect all storage paths for batch signed URLs
  const storagePathsToSign: string[] = [];

  // Primary image paths
  const firstImageByProductId = new Map<string, string>();
  productImages.forEach((img) => {
    if (img.storage_path && !firstImageByProductId.has(img.product_id)) {
      firstImageByProductId.set(img.product_id, img.storage_path);
      storagePathsToSign.push(img.storage_path);
    }
  });

  // Certificate paths
  certificates.forEach((c) => {
    if (c.storage_path) {
      storagePathsToSign.push(c.storage_path);
    }
  });

  // Ingredients file paths
  products.forEach((p) => {
    if (p.ingredients_file_path) storagePathsToSign.push(p.ingredients_file_path);
    if (p.ingredients_file_path_en) storagePathsToSign.push(p.ingredients_file_path_en);
  });

  // Batch signed URL creation
  const signedUrlMap = new Map<string, string>();
  if (storagePathsToSign.length > 0) {
    try {
      const { data: signedUrls, error: signErr } = await admin.storage
        .from("company-uploads")
        .createSignedUrls(Array.from(new Set(storagePathsToSign)), 3600);

      if (!signErr && signedUrls) {
        signedUrls.forEach((item) => {
          if (item?.path && item?.signedUrl) {
            signedUrlMap.set(item.path, item.signedUrl);
          }
        });
      }
    } catch (err) {
      console.error("Batch signed URLs error in Compliance page:", err);
    }
  }

  // 9. Assemble ComplianceProductItem list
  const resolvedProducts: ComplianceProductItem[] = products.map((p) => {
    const adminOverrides = (p.price_additional_info as any)?.admin_overrides || {};
    const effectiveManufactureSku = resolveEffectiveSku(adminOverrides.manufacture_sku, p.manufacture_sku);
    const effectiveLetustoSku = resolveEffectiveSku(adminOverrides.letusto_sku, p.letusto_sku);
    const authoritativeName = resolveProductName(p);

    const firstImagePath = firstImageByProductId.get(p.id) || null;
    const photoUrl = firstImagePath ? signedUrlMap.get(firstImagePath) || null : null;

    const company = companyMap.get(p.company_id);
    const brand = brandMap.get(p.brand_id);

    const attrs = productAttrMap.get(p.id);

    const prodCerts = certificates
      .filter((c) => c.product_id === p.id)
      .map((c) => ({
        id: c.id,
        certificate_type: c.certificate_type,
        storage_path: c.storage_path,
        original_filename: c.original_filename,
        version: c.version,
        created_at: c.created_at,
        signedUrl: c.storage_path ? signedUrlMap.get(c.storage_path) || null : null,
      }));

    return {
      id: p.id,
      name: authoritativeName,
      name_en: p.name_en || null,
      display_name: authoritativeName,
      manufacture_sku: p.manufacture_sku || null,
      display_manufacture_sku: effectiveManufactureSku,
      letusto_sku: effectiveLetustoSku,
      brand_id: p.brand_id,
      brand_name: brand?.name || "(미지정 브랜드)",
      company_id: p.company_id,
      company_name: company?.name || "(미지정 회사)",
      company_country: company?.country || null,
      category: p.category || null,
      category_code: p.category_code || null,
      category_full_path: p.category_code ? getCategoryFullPath(p.category_code) : null,
      photoUrl,
      origin: p.origin || null,
      description: p.description || null,
      how_to_use: p.how_to_use || null,
      bullet_points: Array.isArray(p.bullet_points) ? p.bullet_points : null,
      volume: p.volume || null,
      ingredients_text: p.ingredients_text || null,
      ingredients_file_path: p.ingredients_file_path || null,
      ingredients_file_path_en: p.ingredients_file_path_en || null,
      ingredientsFileSignedUrl: p.ingredients_file_path ? signedUrlMap.get(p.ingredients_file_path) || null : null,
      ingredientsFileEnSignedUrl: p.ingredients_file_path_en ? signedUrlMap.get(p.ingredients_file_path_en) || null : null,

      // Authoritative regulatory attributes (preserve actual stored string/null)
      fda_status: attrs?.get("FDA_STATUS") !== undefined ? String(attrs.get("FDA_STATUS")) : null,
      mocra_status: attrs?.get("MOCRA_STATUS") !== undefined ? String(attrs.get("MOCRA_STATUS")) : null,
      otc_status: attrs?.get("OTC_STATUS") !== undefined ? String(attrs.get("OTC_STATUS")) : null,
      drug_facts_status: attrs?.get("DRUG_FACTS_STATUS") !== undefined ? String(attrs.get("DRUG_FACTS_STATUS")) : null,

      // Additional attributes for 7-section checklist
      hair_loss_claim: attrs?.get("HAIR_LOSS_CLAIM") !== undefined ? String(attrs.get("HAIR_LOSS_CLAIM")) : null,
      primary_concern: attrs?.get("PRIMARY_CONCERN") || null,
      spf_value: attrs?.get("SPF_VALUE") || null,
      pa_rating: attrs?.get("PA_RATING") || null,
      uv_filter_type: attrs?.get("UV_FILTER_TYPE") || null,
      formulation: attrs?.get("FORMULATION") || null,
      package_format: attrs?.get("PACKAGE_FORMAT") || null,
      shelf_life_months: attrs?.get("SHELF_LIFE_MONTHS") || null,
      pao_months: attrs?.get("PAO_MONTHS") || null,
      storage_condition: attrs?.get("STORAGE_CONDITION") || null,

      certificates: prodCerts,
    };
  });

  const availableBrands = (brands ?? []).map((b) => ({ id: b.id, name: b.name }));
  const availableCompanies = (companies ?? []).map((c) => ({ id: c.id, name: c.name }));
  const availableCategories = (dbCategories ?? []).filter((c) => c.depth === 1 || !c.parent_code).map((c) => ({ code: c.code, name_ko: c.name_ko }));

  return (
    <div className="flex-1 w-full p-4 sm:p-6 space-y-6">
      <ComplianceClient
        products={resolvedProducts}
        brands={availableBrands}
        companies={availableCompanies}
        categories={availableCategories}
      />
    </div>
  );
}
