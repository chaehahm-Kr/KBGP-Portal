import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSignedFileUrl } from "@/lib/files/storage";
import { ProductOverrideTabs } from "@/components/admin/product-override-tabs";
import type { Product, ProductVideo } from "@/lib/product/types";
import { adminGetProductCuration } from "@/lib/product/admin-actions";

export const metadata: Metadata = {
  title: "제품 오버라이드 관리 | K SELECT NETWORK 어드민",
};

export default async function AdminProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await verifyAdminSession();
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select(`
      id, name, name_en, category, volume, estimated_retail_price, ingredients_text, ingredients_file_path, ingredients_file_path_en, brand_id, company_id,
      description, bullet_points, color, color_map, origin, lead_time,
      parent_sku, child_sku, manufacture_sku, letusto_sku, upc, ean,
      price_krw_retail, price_krw_wholesale, price_usd_fob, price_additional_info,
      item_width, item_depth, item_height, item_weight,
      package_width, package_depth, package_height, package_weight,
      carton_pack_qty, carton_width, carton_depth, carton_height, carton_weight, carton_cbm,
      palette_carton_qty, palette_width, palette_depth, palette_height, palette_weight,
      container_20ft_qty, container_20ft_weight, container_20ft_cbm,
      container_40fthc_qty, container_40fthc_weight, container_40fthc_cbm,
      selection_status, sales_status, category_code
    `)
    .eq("id", id)
    .maybeSingle();

  if (!product) {
    notFound();
  }

  const { data: brand } = await supabase
    .from("brands")
    .select("name")
    .eq("id", product.brand_id)
    .maybeSingle();

  const { data: brands } = await supabase
    .from("brands")
    .select("id, name")
    .eq("company_id", product.company_id)
    .order("name", { ascending: true });

  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", product.company_id)
    .maybeSingle();

  // Fetch active curators (staff members)
  const { data: curators } = await supabase
    .from("staff_members")
    .select("id, name, email")
    .eq("status", "active")
    .order("name", { ascending: true });

  const adminSupabase = createAdminClient();

  const { data: images } = await adminSupabase
    .from("product_images")
    .select("id, storage_path")
    .eq("product_id", id)
    .order("position", { ascending: true });

  const { data: videos } = await adminSupabase
    .from("product_videos")
    .select("id, storage_path, video_url, position")
    .eq("product_id", id)
    .order("position", { ascending: true });

  const { data: certificates } = await adminSupabase
    .from("product_certificates")
    .select("id, certificate_type, storage_path, original_filename, version")
    .eq("product_id", id)
    .eq("is_current", true)
    .order("created_at", { ascending: true });

  const imageRows = images ?? [];
  const imageUrls = await Promise.all(
    imageRows.map((img) => getSignedFileUrl(img.storage_path))
  );

  const videoRows = (videos ?? []) as ProductVideo[];
  const videoUrls = await Promise.all(
    videoRows.map(async (v) => {
      if (v.storage_path) {
        try {
          return await getSignedFileUrl(v.storage_path);
        } catch {
          return null;
        }
      }
      return v.video_url || null;
    })
  );

  const certificateRows = certificates ?? [];
  const certificateUrls = await Promise.all(
    certificateRows.map((cert) => getSignedFileUrl(cert.storage_path))
  );

  let ingredientsFileUrl: string | null = null;
  if (product.ingredients_file_path) {
    try {
      ingredientsFileUrl = await getSignedFileUrl(product.ingredients_file_path);
    } catch {
      // Ignore
    }
  }

  let ingredientsFileUrlEn: string | null = null;
  if (product.ingredients_file_path_en) {
    try {
      ingredientsFileUrlEn = await getSignedFileUrl(product.ingredients_file_path_en);
    } catch {
      // Ignore
    }
  }

  // Fetch attributes data to check for missing required attributes
  const { data: dbAllAttrs } = await adminSupabase
    .from("attributes")
    .select("code, scope, is_required")
    .eq("is_active", true);

  const { data: dbCatProfileMaps } = await adminSupabase
    .from("category_profile_mappings")
    .select("category_code, profile_code")
    .eq("is_active", true);
  const catToProfile = new Map((dbCatProfileMaps ?? []).map((m) => [m.category_code, m.profile_code]));

  const { data: dbProfAttrs } = await adminSupabase
    .from("profile_attributes")
    .select("profile_code, attribute_code, is_required_override")
    .eq("is_active", true);

  const { data: dbProductAttrValues } = await adminSupabase
    .from("product_attribute_values")
    .select("attribute_code, value_json")
    .eq("product_id", id);

  const attrRequiredMap = new Map((dbAllAttrs ?? []).map(a => [a.code, a.is_required]));
  const profileRequiredAttrs = new Map<string, string[]>();
  (dbProfAttrs ?? []).forEach((pa) => {
    const isRequired = pa.is_required_override !== null 
      ? pa.is_required_override 
      : (attrRequiredMap.get(pa.attribute_code) ?? false);
    
    if (isRequired) {
      const list = profileRequiredAttrs.get(pa.profile_code) || [];
      list.push(pa.attribute_code);
      profileRequiredAttrs.set(pa.profile_code, list);
    }
  });

  const commonRequiredAttrCodes = (dbAllAttrs ?? [])
    .filter((a) => a.scope === "COMMON" && a.is_required)
    .map((a) => a.code);

  const getHasMissingRequiredAttributes = (): boolean => {
    const categoryCode = product.category_code;
    if (!categoryCode) return false;
    const profileCode = catToProfile.get(categoryCode);
    const requiredAttrCodes = new Set<string>(commonRequiredAttrCodes);
    if (profileCode) {
      const pRequiredAttrs = profileRequiredAttrs.get(profileCode) || [];
      pRequiredAttrs.forEach((code) => requiredAttrCodes.add(code));
    }
    if (requiredAttrCodes.size === 0) return false;

    const valuesMap = new Map((dbProductAttrValues ?? []).map(v => [v.attribute_code, v.value_json]));
    for (const code of requiredAttrCodes) {
      const val = valuesMap.get(code);
      if (val === undefined || val === null) return true;
      if (Array.isArray(val)) {
        if (val.length === 0) return true;
      } else if (String(val).trim() === "") {
        return true;
      }
    }
    return false;
  };

  const hasMissingRequiredAttributes = getHasMissingRequiredAttributes();

  const { curation, matrix } = await adminGetProductCuration(product.id);

  // Fetch product's mapped suppliers
  const { data: mappedSupplierRows } = await adminSupabase
    .from("product_suppliers")
    .select("supplier_id")
    .eq("product_id", id);
  const mappedSupplierIds = (mappedSupplierRows ?? []).map((r) => r.supplier_id);

  // Fetch all active suppliers to select from
  const { data: roles } = await adminSupabase
    .from("company_roles")
    .select("company_id")
    .eq("role", "Supplier");
  const activeSupplierIds = (roles ?? []).map((r) => r.company_id);

  let activeSuppliers: any[] = [];
  if (activeSupplierIds.length > 0) {
    const { data: dbActiveSuppliers } = await adminSupabase
      .from("companies")
      .select("id, name")
      .in("id", activeSupplierIds)
      .order("name", { ascending: true });
    activeSuppliers = dbActiveSuppliers ?? [];
  }

  // Fetch assortment profiles for matrix name mappings
  const { data: apProfiles } = await supabase
    .from("assortment_profiles")
    .select("id, display_program, code, name, description, is_active")
    .order("code", { ascending: true });

  // Fetch active display programs for matrix columns
  const { data: displayPrograms } = await supabase
    .from("display_programs")
    .select("code, name, description, min_sku, max_sku, is_active")
    .eq("is_active", true);

  return (
    <ProductOverrideTabs
      product={product as unknown as Product}
      brandName={brand?.name ?? "(미확인 브랜드)"}
      brands={brands ?? []}
      companyName={company?.name ?? "(미확인 회사)"}
      imageRows={imageRows}
      imageUrls={imageUrls}
      videoRows={videoRows}
      videoUrls={videoUrls}
      certificateRows={certificateRows}
      certificateUrls={certificateUrls}
      ingredientsFileUrl={ingredientsFileUrl}
      ingredientsFileUrlEn={ingredientsFileUrlEn}
      curation={curation}
      matrix={matrix}
      curators={curators ?? []}
      apProfiles={apProfiles ?? []}
      displayPrograms={displayPrograms ?? []}
      hasMissingRequiredAttributes={hasMissingRequiredAttributes}
      activeSuppliers={activeSuppliers}
      mappedSupplierIds={mappedSupplierIds}
    />
  );
}
