"use server";

import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveProductName } from "@/lib/product/name-resolver";
import { getSignedFileUrl } from "@/lib/files/storage";

export type ContentOverallStatus = "published" | "ready" | "in_progress" | "needs_attention" | "not_started";
export type CustomerPageStatus = "published" | "draft" | "missing" | "not_started";
export type TrainingStatus = "ready" | "in_progress" | "missing";
export type MediaStatus = "complete" | "partial" | "missing";
export type FaqStatus = "published" | "draft" | "empty";
export type ReviewStatus = "active" | "pending" | "none";
export type QrPublishingStatus = "live" | "inactive" | "not_generated";

export interface ContentProductItem {
  id: string;
  name: string; // Authoritative English / Resolved name
  original_name: string;
  name_en: string | null;
  letusto_sku: string | null;
  parent_sku?: string | null;
  child_sku?: string | null;
  upc: string | null;
  brand_id: string;
  brand_name: string;
  company_id: string;
  company_name: string;
  category: string;
  category_code: string | null;
  category_full_path: string | null;
  photoUrl: string | null;

  // Read-only Operational & Visibility Statuses
  operational_status: "active" | "inactive" | "historical";
  visibility: "visible" | "hidden";

  // Content Modules Statuses
  overall_status: ContentOverallStatus;
  customer_page_status: CustomerPageStatus;
  training_status: TrainingStatus;
  media_status: MediaStatus;
  faq_status: FaqStatus;
  review_status: ReviewStatus;
  qr_status: QrPublishingStatus;

  // Metrics
  image_count: number;
  video_count: number;

  last_updated: string;
  updated_at: string;
}

export interface ContentStatusListFilterOptions {
  brands: { id: string; name: string }[];
  categories: { code: string; name: string }[];
}

export async function getContentStatusProducts(): Promise<{
  products: ContentProductItem[];
  filterOptions: ContentStatusListFilterOptions;
}> {
  await verifyAdminSession();
  const adminSupabase = createAdminClient();

  // 1. Fetch products
  const { data: rawProducts, error: prodErr } = await adminSupabase
    .from("products")
    .select(`
      id, name, name_en, category, brand_id, company_id,
      parent_sku, child_sku, manufacture_sku, letusto_sku, upc, ean,
      price_additional_info, category_code, selection_status, trading_status,
      retailer_visibility, updated_at, created_at, description
    `)
    .order("created_at", { ascending: false });

  if (prodErr || !rawProducts) {
    console.error("[getContentStatusProducts] Error fetching products:", prodErr);
    return { products: [], filterOptions: { brands: [], categories: [] } };
  }

  // 2. Fetch brands
  const { data: rawBrands } = await adminSupabase
    .from("brands")
    .select("id, name");
  const brandMap = new Map((rawBrands ?? []).map((b) => [b.id, b.name]));

  // 3. Fetch companies
  const { data: rawCompanies } = await adminSupabase
    .from("companies")
    .select("id, name");
  const companyMap = new Map((rawCompanies ?? []).map((c) => [c.id, c.name]));

  // 4. Fetch categories
  const { data: rawCategories } = await adminSupabase
    .from("categories")
    .select("code, name_ko, parent_code, depth");
  const categoryMap = new Map((rawCategories ?? []).map((c) => [c.code, c]));

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

  // 5. Fetch product images
  const { data: rawImages } = await adminSupabase
    .from("product_images")
    .select("product_id, image_url, file_path, is_primary, display_order, image_type")
    .order("display_order", { ascending: true });

  const imagesByProduct = new Map<string, Array<any>>();
  if (rawImages) {
    for (const img of rawImages) {
      const list = imagesByProduct.get(img.product_id) || [];
      list.push(img);
      imagesByProduct.set(img.product_id, list);
    }
  }

  // 6. Build product items
  const products: ContentProductItem[] = await Promise.all(
    rawProducts.map(async (p) => {
      const pImages = imagesByProduct.get(p.id) || [];
      const primaryImg = pImages.find((img) => img.is_primary) || pImages[0];
      let photoUrl: string | null = null;
      if (primaryImg) {
        if (primaryImg.image_url) {
          photoUrl = primaryImg.image_url;
        } else if (primaryImg.file_path) {
          try {
            photoUrl = await getSignedFileUrl(primaryImg.file_path, 3600, "company-uploads");
          } catch {
            photoUrl = null;
          }
        }
      }

      // Authoritative product name
      const authoritativeName = resolveProductName(p);

      // Operational status (read-only)
      let operationalStatus: "active" | "inactive" | "historical" = "inactive";
      if (p.trading_status === "active" || p.trading_status === "inactive" || p.trading_status === "historical") {
        operationalStatus = p.trading_status;
      } else if (p.selection_status === "SELECTED") {
        operationalStatus = "active";
      }

      // Visibility (read-only)
      const visibility: "visible" | "hidden" = p.retailer_visibility === "visible" ? "visible" : "hidden";

      // Parse metadata from price_additional_info
      const info = (p.price_additional_info as any) || {};
      const contentMeta = info.content || {};

      const imageCount = pImages.length;
      const videoCount = (info.media_videos as any[] || []).length;

      // Media status
      let mediaStatus: MediaStatus = "missing";
      if (contentMeta.media_status) {
        mediaStatus = contentMeta.media_status;
      } else if (imageCount >= 3) {
        mediaStatus = "complete";
      } else if (imageCount > 0) {
        mediaStatus = "partial";
      }

      // Customer page status
      let customerPageStatus: CustomerPageStatus = "not_started";
      if (contentMeta.customer_page_status) {
        customerPageStatus = contentMeta.customer_page_status;
      } else if (info.customer_page_published) {
        customerPageStatus = "published";
      } else if (p.description || info.bullet_points) {
        customerPageStatus = "draft";
      } else {
        customerPageStatus = "missing";
      }

      // Training status
      const trainingStatus: TrainingStatus =
        contentMeta.training_status || (info.training_ready ? "ready" : "missing");

      // FAQ status
      const faqStatus: FaqStatus =
        contentMeta.faq_status || (info.faqs?.length > 0 ? "published" : "empty");

      // Review status
      const reviewStatus: ReviewStatus =
        contentMeta.review_status || (info.reviews?.length > 0 ? "active" : "none");

      // QR status
      const qrStatus: QrPublishingStatus =
        contentMeta.qr_status || (info.qr_published ? "live" : "not_generated");

      // Overall content status calculation
      let overallStatus: ContentOverallStatus = "not_started";
      if (contentMeta.overall_status) {
        overallStatus = contentMeta.overall_status;
      } else if (qrStatus === "live" && customerPageStatus === "published") {
        overallStatus = "published";
      } else if (customerPageStatus === "published" && mediaStatus === "complete") {
        overallStatus = "ready";
      } else if (
        operationalStatus === "active" &&
        visibility === "visible" &&
        (customerPageStatus === "missing" || mediaStatus === "missing" || trainingStatus === "missing")
      ) {
        overallStatus = "needs_attention";
      } else if (
        mediaStatus !== "missing" ||
        customerPageStatus === "draft" ||
        trainingStatus === "in_progress" ||
        faqStatus !== "empty"
      ) {
        overallStatus = "in_progress";
      } else {
        overallStatus = "not_started";
      }

      const brandName = brandMap.get(p.brand_id) || "Unknown Brand";
      const companyName = companyMap.get(p.company_id) || "Unknown Company";
      const categoryFullPath = getCategoryFullPath(p.category_code) || p.category || "-";

      const updatedDate = p.updated_at ? new Date(p.updated_at).toISOString().split("T")[0] : "-";

      return {
        id: p.id,
        name: authoritativeName,
        original_name: p.name || "",
        name_en: p.name_en || null,
        letusto_sku: p.letusto_sku || p.manufacture_sku || null,
        parent_sku: p.parent_sku,
        child_sku: p.child_sku,
        upc: p.upc || p.ean || null,
        brand_id: p.brand_id,
        brand_name: brandName,
        company_id: p.company_id,
        company_name: companyName,
        category: p.category || "-",
        category_code: p.category_code || null,
        category_full_path: categoryFullPath,
        photoUrl,
        operational_status: operationalStatus,
        visibility,
        overall_status: overallStatus,
        customer_page_status: customerPageStatus,
        training_status: trainingStatus,
        media_status: mediaStatus,
        faq_status: faqStatus,
        review_status: reviewStatus,
        qr_status: qrStatus,
        image_count: imageCount,
        video_count: videoCount,
        last_updated: updatedDate,
        updated_at: p.updated_at || p.created_at || "",
      };
    })
  );

  // Extract unique brands and categories for filtering
  const brandList = Array.from(new Set(products.map((p) => p.brand_id)))
    .map((id) => ({
      id,
      name: brandMap.get(id) || id,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const categoryList = Array.from(
    new Set(products.map((p) => p.category_full_path || p.category).filter(Boolean))
  )
    .map((cat) => ({
      code: cat as string,
      name: cat as string,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    products,
    filterOptions: {
      brands: brandList,
      categories: categoryList,
    },
  };
}

export async function getContentProductDetail(productId: string): Promise<ContentProductItem | null> {
  await verifyAdminSession();
  const adminSupabase = createAdminClient();

  const { data: p, error: prodErr } = await adminSupabase
    .from("products")
    .select(`
      id, name, name_en, category, brand_id, company_id,
      parent_sku, child_sku, manufacture_sku, letusto_sku, upc, ean,
      price_additional_info, category_code, selection_status, trading_status,
      retailer_visibility, updated_at, created_at, description
    `)
    .eq("id", productId)
    .maybeSingle();

  if (prodErr || !p) {
    return null;
  }

  const { data: brand } = await adminSupabase
    .from("brands")
    .select("name")
    .eq("id", p.brand_id)
    .maybeSingle();

  const { data: company } = await adminSupabase
    .from("companies")
    .select("name")
    .eq("id", p.company_id)
    .maybeSingle();

  const { data: rawCategories } = await adminSupabase
    .from("categories")
    .select("code, name_ko, parent_code, depth");
  const categoryMap = new Map((rawCategories ?? []).map((c) => [c.code, c]));

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

  const { data: rawImages } = await adminSupabase
    .from("product_images")
    .select("image_url, file_path, is_primary, display_order, image_type")
    .eq("product_id", p.id)
    .order("display_order", { ascending: true });

  const primaryImg = rawImages?.find((img) => img.is_primary) || rawImages?.[0];
  let photoUrl: string | null = null;
  if (primaryImg) {
    if (primaryImg.image_url) {
      photoUrl = primaryImg.image_url;
    } else if (primaryImg.file_path) {
      try {
        photoUrl = await getSignedFileUrl(primaryImg.file_path, 3600, "company-uploads");
      } catch {
        photoUrl = null;
      }
    }
  }

  const authoritativeName = resolveProductName(p);

  let operationalStatus: "active" | "inactive" | "historical" = "inactive";
  if (p.trading_status === "active" || p.trading_status === "inactive" || p.trading_status === "historical") {
    operationalStatus = p.trading_status;
  } else if (p.selection_status === "SELECTED") {
    operationalStatus = "active";
  }

  const visibility: "visible" | "hidden" = p.retailer_visibility === "visible" ? "visible" : "hidden";
  const info = (p.price_additional_info as any) || {};
  const contentMeta = info.content || {};
  const imageCount = rawImages?.length || 0;
  const videoCount = (info.media_videos as any[] || []).length;

  let mediaStatus: MediaStatus = "missing";
  if (contentMeta.media_status) {
    mediaStatus = contentMeta.media_status;
  } else if (imageCount >= 3) {
    mediaStatus = "complete";
  } else if (imageCount > 0) {
    mediaStatus = "partial";
  }

  let customerPageStatus: CustomerPageStatus = "not_started";
  if (contentMeta.customer_page_status) {
    customerPageStatus = contentMeta.customer_page_status;
  } else if (info.customer_page_published) {
    customerPageStatus = "published";
  } else if (p.description || info.bullet_points) {
    customerPageStatus = "draft";
  } else {
    customerPageStatus = "missing";
  }

  const trainingStatus: TrainingStatus =
    contentMeta.training_status || (info.training_ready ? "ready" : "missing");

  const faqStatus: FaqStatus =
    contentMeta.faq_status || (info.faqs?.length > 0 ? "published" : "empty");

  const reviewStatus: ReviewStatus =
    contentMeta.review_status || (info.reviews?.length > 0 ? "active" : "none");

  const qrStatus: QrPublishingStatus =
    contentMeta.qr_status || (info.qr_published ? "live" : "not_generated");

  let overallStatus: ContentOverallStatus = "not_started";
  if (contentMeta.overall_status) {
    overallStatus = contentMeta.overall_status;
  } else if (qrStatus === "live" && customerPageStatus === "published") {
    overallStatus = "published";
  } else if (customerPageStatus === "published" && mediaStatus === "complete") {
    overallStatus = "ready";
  } else if (
    operationalStatus === "active" &&
    visibility === "visible" &&
    (customerPageStatus === "missing" || mediaStatus === "missing" || trainingStatus === "missing")
  ) {
    overallStatus = "needs_attention";
  } else if (
    mediaStatus !== "missing" ||
    customerPageStatus === "draft" ||
    trainingStatus === "in_progress" ||
    faqStatus !== "empty"
  ) {
    overallStatus = "in_progress";
  } else {
    overallStatus = "not_started";
  }

  const brandName = brand?.name || "Unknown Brand";
  const companyName = company?.name || "Unknown Company";
  const categoryFullPath = getCategoryFullPath(p.category_code) || p.category || "-";
  const updatedDate = p.updated_at ? new Date(p.updated_at).toISOString().split("T")[0] : "-";

  return {
    id: p.id,
    name: authoritativeName,
    original_name: p.name || "",
    name_en: p.name_en || null,
    letusto_sku: p.letusto_sku || p.manufacture_sku || null,
    parent_sku: p.parent_sku,
    child_sku: p.child_sku,
    upc: p.upc || p.ean || null,
    brand_id: p.brand_id,
    brand_name: brandName,
    company_id: p.company_id,
    company_name: companyName,
    category: p.category || "-",
    category_code: p.category_code || null,
    category_full_path: categoryFullPath,
    photoUrl,
    operational_status: operationalStatus,
    visibility,
    overall_status: overallStatus,
    customer_page_status: customerPageStatus,
    training_status: trainingStatus,
    media_status: mediaStatus,
    faq_status: faqStatus,
    review_status: reviewStatus,
    qr_status: qrStatus,
    image_count: imageCount,
    video_count: videoCount,
    last_updated: updatedDate,
    updated_at: p.updated_at || p.created_at || "",
  };
}
