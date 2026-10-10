"use server";

import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveProductName } from "@/lib/product/name-resolver";
import { getCategoryMaster } from "@/lib/product/category-taxonomy-server";
import { resolveProductCategoryBranch, type CategoryItem } from "@/lib/product/category-taxonomy";

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
  category_display_path: string; // 1st > 2nd Depth English Path from Category Master
  depth1Code?: string;
  depth2Code?: string | null;
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

export interface ContentStatusCategoryOption {
  code: string;
  name: string; // 1st or 1st > 2nd Depth English Name
  depth: 1 | 2;
  depth1Code: string;
  depth2Code: string | null;
}

export interface ContentStatusListFilterOptions {
  brands: { id: string; name: string }[];
  categories: ContentStatusCategoryOption[];
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

  // 4. Fetch category master (authoritative source)
  const categoryMaster = await getCategoryMaster();
  const categoryByCode: Record<string, CategoryItem> = {};
  categoryMaster.forEach((c) => {
    categoryByCode[c.code] = c;
  });

  // 5. Fetch product images (authoritative packshot image)
  const { data: rawImages } = await adminSupabase
    .from("product_images")
    .select("id, product_id, storage_path, position")
    .order("position", { ascending: true });

  const imagesByProduct = new Map<string, Array<{ id: string; storage_path: string; position: number }>>();
  if (rawImages) {
    for (const img of rawImages) {
      if (!img.storage_path) continue;
      const list = imagesByProduct.get(img.product_id) || [];
      list.push(img);
      imagesByProduct.set(img.product_id, list);
    }
  }

  // 6. Build product items
  const products: ContentProductItem[] = await Promise.all(
    rawProducts.map(async (p) => {
      const pImages = imagesByProduct.get(p.id) || [];
      let photoUrl: string | null = null;
      if (pImages.length > 0) {
        const firstImg = pImages[0];
        if (firstImg.storage_path) {
          if (firstImg.storage_path.startsWith("http://") || firstImg.storage_path.startsWith("https://")) {
            photoUrl = firstImg.storage_path;
          } else {
            try {
              const { data: signed } = await adminSupabase.storage
                .from("company-uploads")
                .createSignedUrl(firstImg.storage_path, 3600);
              if (signed?.signedUrl) {
                photoUrl = signed.signedUrl;
              }
            } catch {
              photoUrl = null;
            }
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

      // 1st + 2nd Depth English Category Path from Master
      const branch = resolveProductCategoryBranch(p, categoryByCode);
      const categoryDisplayPath = branch.depth2LabelEn
        ? `${branch.depth1LabelEn} > ${branch.depth2LabelEn}`
        : branch.depth1LabelEn;

      const categoryFullPath = [branch.depth1LabelEn, branch.depth2LabelEn, branch.depth3LabelEn]
        .filter(Boolean)
        .join(" > ");

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
        category_display_path: categoryDisplayPath,
        depth1Code: branch.depth1Code,
        depth2Code: branch.depth2Code,
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

  // Extract unique brands for filtering
  const brandList = Array.from(new Set(products.map((p) => p.brand_id)))
    .map((id) => ({
      id,
      name: brandMap.get(id) || id,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Build 1st + 2nd Depth English Category Filter Options from Category Master
  const categoryOptions: ContentStatusCategoryOption[] = [];
  const depth1List = categoryMaster.filter((c) => c.depth === 1).sort((a, b) => a.display_order - b.display_order);

  depth1List.forEach((d1) => {
    categoryOptions.push({
      code: d1.code,
      name: d1.name_en,
      depth: 1,
      depth1Code: d1.code,
      depth2Code: null,
    });

    const depth2List = categoryMaster
      .filter((c) => c.depth === 2 && c.parent_code === d1.code)
      .sort((a, b) => a.display_order - b.display_order);

    depth2List.forEach((d2) => {
      categoryOptions.push({
        code: d2.code,
        name: `${d1.name_en} > ${d2.name_en}`,
        depth: 2,
        depth1Code: d1.code,
        depth2Code: d2.code,
      });
    });
  });

  return {
    products,
    filterOptions: {
      brands: brandList,
      categories: categoryOptions,
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

  const categoryMaster = await getCategoryMaster();
  const categoryByCode: Record<string, CategoryItem> = {};
  categoryMaster.forEach((c) => {
    categoryByCode[c.code] = c;
  });

  const { data: rawImages } = await adminSupabase
    .from("product_images")
    .select("id, product_id, storage_path, position")
    .eq("product_id", p.id)
    .order("position", { ascending: true });

  let photoUrl: string | null = null;
  if (rawImages && rawImages.length > 0) {
    const firstImg = rawImages[0];
    if (firstImg.storage_path) {
      if (firstImg.storage_path.startsWith("http://") || firstImg.storage_path.startsWith("https://")) {
        photoUrl = firstImg.storage_path;
      } else {
        try {
          const { data: signed } = await adminSupabase.storage
            .from("company-uploads")
            .createSignedUrl(firstImg.storage_path, 3600);
          if (signed?.signedUrl) {
            photoUrl = signed.signedUrl;
          }
        } catch {
          photoUrl = null;
        }
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

  const branch = resolveProductCategoryBranch(p, categoryByCode);
  const categoryDisplayPath = branch.depth2LabelEn
    ? `${branch.depth1LabelEn} > ${branch.depth2LabelEn}`
    : branch.depth1LabelEn;

  const categoryFullPath = [branch.depth1LabelEn, branch.depth2LabelEn, branch.depth3LabelEn]
    .filter(Boolean)
    .join(" > ");

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
    category_display_path: categoryDisplayPath,
    depth1Code: branch.depth1Code,
    depth2Code: branch.depth2Code,
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
