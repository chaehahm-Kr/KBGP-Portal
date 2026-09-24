import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { resolveEffectiveSku } from "@/lib/product/types";

export interface RetailerProductSummary {
  id: string;
  name: string;
  nameEn: string | null;
  brandId: string;
  brandName: string;
  sku: string;
  category: string;
  categoryLabel: string;
  categoryCode: string | null;
  wholesalePrice: number;
  msrp: number;
  marginPercent: number;
  moq: number;
  thumbnailUrl: string | null;
  origin: string | null;
  volume: string | null;
  status: string;
}

export interface RetailerProductDetail extends RetailerProductSummary {
  description: string | null;
  bulletPoints: string[];
  upc: string | null;
  ean: string | null;
  packageDimensions: {
    width: number | null;
    depth: number | null;
    height: number | null;
    weight: number | null;
  };
  cartonPackQty: number;
  images: Array<{
    id: string;
    url: string;
    position: number;
  }>;
}

export interface RetailerCatalogFilters {
  search?: string;
  category?: string;
  brandId?: string;
}

export interface RetailerCatalogResult {
  products: RetailerProductSummary[];
  totalCount: number;
  categories: Array<{ code: string; label: string; count: number }>;
  brands: Array<{ id: string; name: string; count: number }>;
}

const CATEGORY_NAMES_EN: Record<string, string> = {
  skincare: "Skincare",
  hair_scalp: "Hair & Scalp",
  beauty_tools: "Beauty Tools",
  daily_care: "Daily Care",
  wellness_patch: "Wellness & Patches",
  makeup: "Makeup",
  cleanser: "Cleansers",
  toner: "Toners & Mists",
  serum: "Serums & Ampoules",
  cream: "Creams & Moisturizers",
  sunscreen: "Sun Care",
  mask: "Masks & Packs",
};

export function formatCategoryName(cat: string | null | undefined): string {
  if (!cat) return "General Beauty";
  const lower = cat.toLowerCase().trim();
  if (CATEGORY_NAMES_EN[lower]) return CATEGORY_NAMES_EN[lower];
  // Capitalize words
  return lower
    .split(/[_\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Fetch products list for authenticated Retailer with search and filter capabilities
 */
export async function getRetailerProducts(
  filters: RetailerCatalogFilters = {}
): Promise<RetailerCatalogResult> {
  await verifyRetailerSession();
  const adminClient = createAdminClient();

  // 1. Fetch all candidate products
  const { data: rawProducts, error } = await adminClient
    .from("products")
    .select(`
      id,
      name,
      name_en,
      category,
      category_code,
      brand_id,
      letusto_sku,
      manufacture_sku,
      status,
      estimated_retail_price,
      price_usd_fob,
      price_krw_retail,
      price_krw_wholesale,
      price_additional_info,
      origin,
      volume,
      carton_pack_qty,
      brands (
        id,
        name
      ),
      product_curations (
        wholesale_price,
        suggest_retail_price,
        status
      ),
      product_images (
        id,
        storage_path,
        position
      )
    `)
    .order("created_at", { ascending: false });

  if (error || !rawProducts) {
    console.error("Error fetching retailer products:", error);
    return {
      products: [],
      totalCount: 0,
      categories: [],
      brands: [],
    };
  }

  // 2. Filter out soft-deleted or non-active products
  const activeProducts = rawProducts.filter((p) => {
    const info = (p.price_additional_info as any) || {};
    if (info.deleted_at || (p as any).deleted_at) return false;
    if (p.status === "discontinued") return false;
    return true;
  });

  // 3. Process products and sign thumbnail URLs
  const brandMap = new Map<string, { id: string; name: string; count: number }>();
  const categoryMap = new Map<string, { code: string; label: string; count: number }>();

  const processedList = await Promise.all(
    activeProducts.map(async (p) => {
      const info = (p.price_additional_info as any) || {};
      const overrides = info.admin_overrides || {};
      const curation = Array.isArray(p.product_curations)
        ? p.product_curations[0]
        : p.product_curations;

      const brand = (p.brands as any) || {};
      const brandId = p.brand_id || brand.id || "unassigned";
      const brandName = brand.name || "K SELECT Brand";

      const categoryCode = p.category_code || p.category || "skincare";
      const categoryLabel = formatCategoryName(p.category || p.category_code);

      // Sku resolution
      const effectiveSku = resolveEffectiveSku(overrides.letusto_sku, p.letusto_sku) ||
        resolveEffectiveSku(overrides.manufacture_sku, p.manufacture_sku) ||
        "KS-PROD";

      // Pricing resolution (Strictly Retailer safe, no FOB or supplier margin exposed)
      let wholesalePrice = 0;
      if (curation?.wholesale_price && Number(curation.wholesale_price) > 0) {
        wholesalePrice = Number(curation.wholesale_price);
      } else if (p.price_usd_fob && Number(p.price_usd_fob) > 0) {
        wholesalePrice = Number(p.price_usd_fob);
      } else if (p.estimated_retail_price && Number(p.estimated_retail_price) > 0) {
        wholesalePrice = Number((Number(p.estimated_retail_price) * 0.5).toFixed(2));
      }

      let msrp = 0;
      if (curation?.suggest_retail_price && Number(curation.suggest_retail_price) > 0) {
        msrp = Number(curation.suggest_retail_price);
      } else if (p.estimated_retail_price && Number(p.estimated_retail_price) > 0) {
        msrp = Number(p.estimated_retail_price);
      } else if (wholesalePrice > 0) {
        msrp = Number((wholesalePrice * 2.0).toFixed(2));
      }

      const marginPercent =
        msrp > 0 && wholesalePrice > 0
          ? Number((((msrp - wholesalePrice) / msrp) * 100).toFixed(1))
          : 50.0;

      // Image signing
      const rawImages = (p.product_images as any[]) || [];
      const sortedImages = [...rawImages].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      let thumbnailUrl: string | null = null;
      if (sortedImages.length > 0 && sortedImages[0].storage_path) {
        try {
          const { data: signed } = await adminClient.storage
            .from("company-uploads")
            .createSignedUrl(sortedImages[0].storage_path, 3600);
          thumbnailUrl = signed?.signedUrl || null;
        } catch {
          // ignore error
        }
      }

      const moq = overrides.carton_pack_qty || p.carton_pack_qty || 1;

      // Accumulate filter counts
      const bEntry = brandMap.get(brandId) || { id: brandId, name: brandName, count: 0 };
      bEntry.count += 1;
      brandMap.set(brandId, bEntry);

      const cEntry = categoryMap.get(categoryCode) || { code: categoryCode, label: categoryLabel, count: 0 };
      cEntry.count += 1;
      categoryMap.set(categoryCode, cEntry);

      const item: RetailerProductSummary = {
        id: p.id,
        name: overrides.name?.trim() || p.name,
        nameEn: overrides.name_en?.trim() || p.name_en || null,
        brandId,
        brandName,
        sku: effectiveSku,
        category: p.category || "skincare",
        categoryLabel,
        categoryCode: p.category_code || null,
        wholesalePrice,
        msrp,
        marginPercent,
        moq,
        thumbnailUrl,
        origin: overrides.origin || p.origin || "Republic of Korea",
        volume: overrides.volume || p.volume || null,
        status: p.status || "selling",
      };

      return item;
    })
  );

  // 4. Apply search & filters
  let filtered = processedList;

  if (filters.search && filters.search.trim()) {
    const q = filters.search.toLowerCase().trim();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.nameEn && p.nameEn.toLowerCase().includes(q)) ||
        p.brandName.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.categoryLabel.toLowerCase().includes(q)
    );
  }

  if (filters.category && filters.category !== "all") {
    filtered = filtered.filter(
      (p) =>
        p.category === filters.category ||
        p.categoryCode === filters.category ||
        p.categoryLabel.toLowerCase() === filters.category?.toLowerCase()
    );
  }

  if (filters.brandId && filters.brandId !== "all") {
    filtered = filtered.filter((p) => p.brandId === filters.brandId);
  }

  return {
    products: filtered,
    totalCount: filtered.length,
    categories: Array.from(categoryMap.values()).sort((a, b) => b.count - a.count),
    brands: Array.from(brandMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/**
 * Fetch detailed product info for Retailer Product Detail view
 */
export async function getRetailerProductDetail(
  productId: string
): Promise<RetailerProductDetail | null> {
  await verifyRetailerSession();
  const adminClient = createAdminClient();

  const { data: p, error } = await adminClient
    .from("products")
    .select(`
      id,
      name,
      name_en,
      category,
      category_code,
      brand_id,
      letusto_sku,
      manufacture_sku,
      status,
      description,
      bullet_points,
      origin,
      volume,
      upc,
      ean,
      estimated_retail_price,
      price_usd_fob,
      price_additional_info,
      carton_pack_qty,
      package_width,
      package_depth,
      package_height,
      package_weight,
      brands (
        id,
        name
      ),
      product_curations (
        wholesale_price,
        suggest_retail_price,
        status
      ),
      product_images (
        id,
        storage_path,
        position
      )
    `)
    .eq("id", productId)
    .maybeSingle();

  if (error || !p) {
    console.error("Error fetching retailer product detail:", error);
    return null;
  }

  const info = (p.price_additional_info as any) || {};
  if (info.deleted_at || (p as any).deleted_at || p.status === "discontinued") {
    return null;
  }

  const overrides = info.admin_overrides || {};
  const curation = Array.isArray(p.product_curations)
    ? p.product_curations[0]
    : p.product_curations;

  const brand = (p.brands as any) || {};
  const brandId = p.brand_id || brand.id || "unassigned";
  const brandName = brand.name || "K SELECT Brand";

  const categoryLabel = formatCategoryName(p.category || p.category_code);

  const effectiveSku =
    resolveEffectiveSku(overrides.letusto_sku, p.letusto_sku) ||
    resolveEffectiveSku(overrides.manufacture_sku, p.manufacture_sku) ||
    "KS-PROD";

  // Pricing resolution
  let wholesalePrice = 0;
  if (curation?.wholesale_price && Number(curation.wholesale_price) > 0) {
    wholesalePrice = Number(curation.wholesale_price);
  } else if (p.price_usd_fob && Number(p.price_usd_fob) > 0) {
    wholesalePrice = Number(p.price_usd_fob);
  } else if (p.estimated_retail_price && Number(p.estimated_retail_price) > 0) {
    wholesalePrice = Number((Number(p.estimated_retail_price) * 0.5).toFixed(2));
  }

  let msrp = 0;
  if (curation?.suggest_retail_price && Number(curation.suggest_retail_price) > 0) {
    msrp = Number(curation.suggest_retail_price);
  } else if (p.estimated_retail_price && Number(p.estimated_retail_price) > 0) {
    msrp = Number(p.estimated_retail_price);
  } else if (wholesalePrice > 0) {
    msrp = Number((wholesalePrice * 2.0).toFixed(2));
  }

  const marginPercent =
    msrp > 0 && wholesalePrice > 0
      ? Number((((msrp - wholesalePrice) / msrp) * 100).toFixed(1))
      : 50.0;

  // Sign all product images
  const rawImages = (p.product_images as any[]) || [];
  const sortedImages = [...rawImages].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const images: Array<{ id: string; url: string; position: number }> = [];

  for (const img of sortedImages) {
    if (img.storage_path) {
      try {
        const { data: signed } = await adminClient.storage
          .from("company-uploads")
          .createSignedUrl(img.storage_path, 3600);
        if (signed?.signedUrl) {
          images.push({
            id: img.id,
            url: signed.signedUrl,
            position: img.position ?? 0,
          });
        }
      } catch {
        // ignore error
      }
    }
  }

  // Bullet points
  let bulletPoints: string[] = [];
  if (Array.isArray(overrides.bullet_points) && overrides.bullet_points.length > 0) {
    bulletPoints = overrides.bullet_points.filter(Boolean);
  } else if (Array.isArray(p.bullet_points) && p.bullet_points.length > 0) {
    bulletPoints = p.bullet_points.filter(Boolean);
  }

  const moq = overrides.carton_pack_qty || p.carton_pack_qty || 1;

  return {
    id: p.id,
    name: overrides.name?.trim() || p.name,
    nameEn: overrides.name_en?.trim() || p.name_en || null,
    brandId,
    brandName,
    sku: effectiveSku,
    category: p.category || "skincare",
    categoryLabel,
    categoryCode: p.category_code || null,
    wholesalePrice,
    msrp,
    marginPercent,
    moq,
    thumbnailUrl: images.length > 0 ? images[0].url : null,
    origin: overrides.origin || p.origin || "Republic of Korea",
    volume: overrides.volume || p.volume || null,
    status: p.status || "selling",
    description: overrides.description || p.description || null,
    bulletPoints,
    upc: overrides.upc || p.upc || null,
    ean: overrides.ean || p.ean || null,
    packageDimensions: {
      width: overrides.package_width || p.package_width || null,
      depth: overrides.package_depth || p.package_depth || null,
      height: overrides.package_height || p.package_height || null,
      weight: overrides.package_weight || p.package_weight || null,
    },
    cartonPackQty: moq,
    images,
  };
}
