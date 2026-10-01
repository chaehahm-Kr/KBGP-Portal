import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBrandTrademarks } from "@/lib/brand/actions";
import { getSignedFileUrl } from "@/lib/files/storage";
import { evaluateProductRegistrationStatus } from "@/lib/product/registration-status";
import { getBatchProductCategoryCompletions } from "@/lib/product/attribute-completion";
import { resolveEffectiveSku } from "@/lib/product/types";
import { AdminBrandDetail, type AdminBrandDetailData } from "@/components/admin/admin-brand-detail";

interface AdminBrandDetailPageProps {
  params: Promise<{ brandId: string }> | { brandId: string };
}

export async function generateMetadata({ params }: AdminBrandDetailPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const brandId = resolvedParams.brandId;
  const supabase = createAdminClient();

  const { data: brand } = await supabase
    .from("brands")
    .select("name, brand_code")
    .eq("id", brandId)
    .maybeSingle();

  const brandName = brand?.name ? `${brand.name} (${brand.brand_code || "상세"})` : "브랜드 상세";

  return {
    title: `${brandName} | K SELECT NETWORK 어드민`,
  };
}

export default async function AdminBrandDetailPage({ params }: AdminBrandDetailPageProps) {
  const session = await verifyAdminSession();
  const resolvedParams = await params;
  const brandId = resolvedParams.brandId;

  if (!brandId) {
    notFound();
  }

  const supabase = createAdminClient();

  // Fetch the brand
  let targetBrand: any = null;
  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select(`
      id, brand_code, name, intro, logo_path, company_id, is_active, created_at, updated_at,
      companies (id, name),
      has_kr_trademark, kr_trademark_number, kr_trademark_path,
      has_us_trademark, us_trademark_number, us_trademark_path
    `)
    .eq("id", brandId)
    .maybeSingle();

  if (!brandError && brand) {
    targetBrand = brand;
  } else {
    // Attempt fallback query without extended columns if column missing
    const { data: fallbackBrand } = await supabase
      .from("brands")
      .select(`
        id, name, intro, logo_path, company_id, is_active, created_at, updated_at,
        companies (id, name)
      `)
      .eq("id", brandId)
      .maybeSingle();

    if (fallbackBrand) {
      targetBrand = fallbackBrand;
    }
  }

  if (!targetBrand) {
    notFound();
  }

  // Resolve brand code (fallback if DB brand_code missing)
  let brandCode = targetBrand.brand_code;
  if (!brandCode) {
    const { data: allBrands } = await supabase
      .from("brands")
      .select("id, created_at")
      .order("created_at", { ascending: true });

    const sortedBrands = (allBrands || []).sort((a, b) => {
      const tA = new Date(a.created_at || 0).getTime();
      const tB = new Date(b.created_at || 0).getTime();
      if (tA !== tB) return tA - tB;
      return String(a.id).localeCompare(String(b.id));
    });

    const index = sortedBrands.findIndex((b) => b.id === targetBrand.id);
    const codeNum = index >= 0 ? index + 1 : 1;
    brandCode = `BR-${String(codeNum).padStart(6, "0")}`;
  }

  // Parse trademarks
  const tm = await parseBrandTrademarks(targetBrand);

  // Get signed URLs for images / files
  const logoUrl = targetBrand.logo_path ? await getSignedFileUrl(targetBrand.logo_path) : null;
  const krUrl = tm.kr_trademark_path ? await getSignedFileUrl(tm.kr_trademark_path) : null;
  const usUrl = tm.us_trademark_path ? await getSignedFileUrl(tm.us_trademark_path) : null;

  // Compute Product Registration Status Breakdown for this brand
  const { data: productsData } = await supabase
    .from("products")
    .select(`
      id, brand_id, name, name_en, category_code, manufacture_sku, origin,
      price_krw_retail, price_usd_fob, item_width, item_depth, item_height, item_weight,
      package_width, package_depth, package_height, package_weight,
      carton_pack_qty, carton_width, carton_depth, carton_height, carton_weight,
      upc, ean, selling_online, sales_link_1, price_additional_info
    `)
    .eq("brand_id", brandId);

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
    console.error("Admin brand detail categoryCompletions error:", err);
  }

  const productCount = {
    total: 0,
    complete: 0,
    draft: 0,
    deleted: 0,
  };

  (productsData ?? []).forEach((p) => {
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

    productCount.total += 1;
    if (evaluation.isDeleted) {
      productCount.deleted += 1;
    } else if (evaluation.isDraft) {
      productCount.draft += 1;
    } else {
      productCount.complete += 1;
    }
  });

  // User permission check
  const role = session.role || "admin";
  const canEdit = role === "admin" || (role as string) === "super_admin" || (role as string) === "manager";
  const canManage = role === "admin" || (role as string) === "super_admin";

  const companyRel = Array.isArray(targetBrand.companies)
    ? targetBrand.companies[0]
    : targetBrand.companies;

  const detailData: AdminBrandDetailData = {
    id: targetBrand.id,
    brandCode,
    name: targetBrand.name,
    intro: targetBrand.intro,
    logoUrl,
    companyId: companyRel?.id || targetBrand.company_id,
    companyName: companyRel?.name || "알 수 없음",
    isActive: targetBrand.is_active !== false,
    hasKr: tm.has_kr_trademark,
    krNumber: tm.kr_trademark_number,
    krPath: tm.kr_trademark_path,
    krUrl,
    hasUs: tm.has_us_trademark,
    usNumber: tm.us_trademark_number,
    usPath: tm.us_trademark_path,
    usUrl,
    createdAt: targetBrand.created_at,
    updatedAt: targetBrand.updated_at || targetBrand.created_at,
    productCount,
    canEdit,
    canManage,
  };

  return <AdminBrandDetail brand={detailData} />;
}
