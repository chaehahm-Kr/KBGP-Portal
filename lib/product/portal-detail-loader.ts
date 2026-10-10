import "server-only";
import { notFound } from "next/navigation";
import { getPortalTenantContext } from "@/lib/company/dal";
import { getSignedFileUrl } from "@/lib/files/storage";
import { getProductCategoryCompletion, type CategoryCompletionResult } from "@/lib/product/attribute-completion";
import {
  getCategoriesTree,
  getCategoryAttributes,
  getProductAttributeValues,
  type CategoryNode,
  type AttributeMasterItem,
} from "@/lib/product/attribute-actions";
import {
  evaluateProductRegistrationStatus,
  type ProductRegistrationEvaluationResult,
} from "@/lib/product/registration-status";
import type { Product, ProductVideo } from "@/lib/product/types";

export interface CategoryHierarchyResolved {
  cat1: CategoryNode | null;
  cat2: CategoryNode | null;
  cat3: CategoryNode | null;
}

export interface PortalProductDetailLoaded {
  product: Product;
  brandName: string;
  brands: { id: string; name: string }[];
  imageRows: { id: string; storage_path: string }[];
  imageUrls: (string | null)[];
  videoRows: ProductVideo[];
  videoUrls: (string | null)[];
  certificateRows: { id: string; certificate_type: string; storage_path: string; original_filename: string | null; version: number }[];
  certificateUrls: (string | null)[];
  ingredientsFileUrl: string | null;
  ingredientsFileUrlEn: string | null;
  initialCategoryCompletion: CategoryCompletionResult;
  initialCategoriesTree: CategoryNode[];
  initialAttributeValues: Record<string, { value: any; text: string | null }>;
  initialCategoryAttributes: AttributeMasterItem[];
  categoryHierarchy: CategoryHierarchyResolved;
  registrationEvaluation: ProductRegistrationEvaluationResult;
}

/**
 * Authoritative Server Loader for Brand Portal Product Detail.
 * Resolves complete data contract including product, brand, media, category tree,
 * category attributes, stored attribute values, and registration evaluation.
 * Used identically for Normal Brand Login and Admin Login as User sessions.
 */
export async function getPortalProductDetail(
  productId: string,
  portalContext?: any
): Promise<PortalProductDetailLoaded> {
  const ctx = portalContext || (await getPortalTenantContext());
  const { companyId, supabase } = ctx;

  const { data: fetchedProduct, error: fetchErr } = await supabase
    .from("products")
    .select(`
      id, name, name_en, category, volume, estimated_retail_price, ingredients_text, ingredients_file_path, ingredients_file_path_en, brand_id,
      description, how_to_use, bullet_points, color, color_map, origin, lead_time,
      parent_sku, child_sku, manufacture_sku, letusto_sku, upc, ean,
      selling_online, selling_offline, sales_link_1, sales_link_2,
      price_krw_retail, price_krw_wholesale, price_usd_fob, price_additional_info,
      item_width, item_depth, item_height, item_weight,
      package_width, package_depth, package_height, package_weight,
      carton_pack_qty, carton_width, carton_depth, carton_height, carton_weight, carton_cbm,
      palette_carton_qty, palette_width, palette_depth, palette_height, palette_weight,
      container_20ft_qty, container_20ft_weight, container_20ft_cbm,
      container_40fthc_qty, container_40fthc_weight, container_40fthc_cbm, category_code,
      selection_status, sales_status, status, deleted_at, company_id
    `)
    .eq("id", productId)
    .eq("company_id", companyId)
    .maybeSingle();

  let product: any = fetchedProduct;
  if (fetchErr || !product) {
    const fallback = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .eq("company_id", companyId)
      .maybeSingle();
    product = fallback.data;
  }

  if (!product) {
    notFound();
  }

  // 1. Fetch Brand data
  const { data: brand } = await supabase
    .from("brands")
    .select("name")
    .eq("id", product.brand_id)
    .maybeSingle();

  const { data: brands } = await supabase
    .from("brands")
    .select("id, name")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  // 2. Fetch Media (Images, Videos, Certificates)
  const { data: images } = await supabase
    .from("product_images")
    .select("id, storage_path, position")
    .eq("product_id", productId)
    .order("position", { ascending: true });

  const { data: videos } = await supabase
    .from("product_videos")
    .select("id, storage_path, video_url, position")
    .eq("product_id", productId)
    .order("position", { ascending: true });

  const { data: certificates } = await supabase
    .from("product_certificates")
    .select("id, certificate_type, storage_path, original_filename, version")
    .eq("product_id", productId)
    .eq("is_current", true)
    .order("created_at", { ascending: true });

  const imageRows = images ?? [];
  const imageUrls = await Promise.all(
    imageRows.map((img: { id: string; storage_path: string }) => getSignedFileUrl(img.storage_path, 3600, "company-uploads", undefined, supabase))
  );

  const videoRows = (videos ?? []) as ProductVideo[];
  const videoUrls = await Promise.all(
    videoRows.map(async (v) => {
      if (v.storage_path) {
        try {
          return await getSignedFileUrl(v.storage_path, 3600, "company-uploads", undefined, supabase);
        } catch {
          return null;
        }
      }
      return v.video_url || null;
    })
  );

  const certificateRows = certificates ?? [];
  const certificateUrls = await Promise.all(
    certificateRows.map((cert: { id: string; storage_path: string }) => getSignedFileUrl(cert.storage_path, 3600, "company-uploads", undefined, supabase))
  );

  let ingredientsFileUrl: string | null = null;
  if (product.ingredients_file_path) {
    try {
      ingredientsFileUrl = await getSignedFileUrl(product.ingredients_file_path, 3600, "company-uploads", undefined, supabase);
    } catch {
      // Ignore
    }
  }

  let ingredientsFileUrlEn: string | null = null;
  if (product.ingredients_file_path_en) {
    try {
      ingredientsFileUrlEn = await getSignedFileUrl(product.ingredients_file_path_en, 3600, "company-uploads", undefined, supabase);
    } catch {
      // Ignore
    }
  }

  // 3. Category Tree & Category Hierarchy Resolution
  const categoriesTree = await getCategoriesTree(supabase);
  let cat1: CategoryNode | null = null;
  let cat2: CategoryNode | null = null;
  let cat3: CategoryNode | null = null;

  if (product.category_code && categoriesTree.length > 0) {
    const code = product.category_code;
    for (const c1 of categoriesTree) {
      if (c1.code === code) {
        cat1 = c1;
        break;
      }
      for (const c2 of c1.children) {
        if (c2.code === code) {
          cat1 = c1;
          cat2 = c2;
          break;
        }
        for (const c3 of c2.children) {
          if (c3.code === code) {
            cat1 = c1;
            cat2 = c2;
            cat3 = c3;
            break;
          }
        }
      }
    }
  }

  // 4. Attribute Values & Category Attributes
  const attributeValues = await getProductAttributeValues(productId, supabase);
  const catAttributesRes = await getCategoryAttributes(product.category_code || null, supabase);

  // 5. Category Completion
  const initialCategoryCompletion = await getProductCategoryCompletion(
    product.id,
    product.category_code || null,
    supabase
  );

  // 6. Registration Evaluation
  const adminOverrides = (product.price_additional_info as any)?.admin_overrides || null;
  const effectiveDeletedAt = product.deleted_at || (product.price_additional_info as any)?.deleted_at || null;

  const registrationEvaluation = evaluateProductRegistrationStatus({
    id: product.id,
    name: product.name,
    name_en: product.name_en,
    brand_id: product.brand_id,
    category_code: product.category_code,
    manufacture_sku: product.manufacture_sku,
    origin: product.origin,
    price_krw_retail: product.price_krw_retail,
    price_usd_fob: product.price_usd_fob,
    item_width: product.item_width,
    item_depth: product.item_depth,
    item_height: product.item_height,
    item_weight: product.item_weight,
    package_width: product.package_width,
    package_depth: product.package_depth,
    package_height: product.package_height,
    package_weight: product.package_weight,
    carton_pack_qty: product.carton_pack_qty,
    carton_width: product.carton_width,
    carton_depth: product.carton_depth,
    carton_height: product.carton_height,
    carton_weight: product.carton_weight,
    upc: product.upc,
    ean: product.ean,
    selling_online: product.selling_online,
    sales_link_1: product.sales_link_1,
    deleted_at: effectiveDeletedAt,
    adminOverrides,
    hasImages: imageRows.length > 0,
    categoryCompletion: initialCategoryCompletion,
  });

  return {
    product: product as unknown as Product,
    brandName: brand?.name ?? "(미확인 브랜드)",
    brands: brands ?? [],
    imageRows,
    imageUrls,
    videoRows,
    videoUrls,
    certificateRows,
    certificateUrls,
    ingredientsFileUrl,
    ingredientsFileUrlEn,
    initialCategoryCompletion,
    initialCategoriesTree: categoriesTree,
    initialAttributeValues: attributeValues,
    initialCategoryAttributes: catAttributesRes.attributes,
    categoryHierarchy: { cat1, cat2, cat3 },
    registrationEvaluation,
  };
}
