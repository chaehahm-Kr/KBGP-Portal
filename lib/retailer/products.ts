import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { resolveEffectiveSku, isDraftPlaceholderName, isDraftPlaceholderSku } from "@/lib/product/types";
import { evaluateProductRegistrationStatus } from "@/lib/product/registration-status";
import { resolveProductPricing, parseValidPositiveNumber } from "@/lib/product/pricing-resolver";
import {
  resolveRetailerSalesPolicy,
  type ResolvedRetailerSalesPolicy,
} from "@/lib/product/retailer-policy";

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
  isOrderable: boolean;
  thumbnailUrl: string | null;
  origin: string | null;
  volume: string | null;
  status: string;
  salesPolicy?: ResolvedRetailerSalesPolicy;
  hasTiers?: boolean;
  maxDiscountPercent?: number;
  isPromoActive?: boolean;
  promoWholesalePrice?: number | null;
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
  other: "Other",
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

function resolveRetailerPrice(prod: any) {
  const pricing = resolveProductPricing(prod);
  const info = (prod.price_additional_info as any) || {};
  const overrides = info.trading_overrides || {};
  const curation = Array.isArray(prod.product_curations)
    ? prod.product_curations[0]
    : prod.product_curations;

  let wholesalePrice = pricing.wholesalePrice || 0;
  if (wholesalePrice <= 0) {
    const curationWholesale = parseValidPositiveNumber(curation?.wholesale_price);
    if (curationWholesale) wholesalePrice = curationWholesale;
  }

  let msrp = pricing.retailPrice || 0;
  if (msrp <= 0) {
    const curationSrp = parseValidPositiveNumber(curation?.suggest_retail_price);
    if (curationSrp && (wholesalePrice <= 0 || curationSrp <= 500 || wholesalePrice > 100)) {
      msrp = curationSrp;
    }
  }

  const isPricingActive = overrides.is_pricing_active !== false && prod.trading_pricing_active !== false;

  return { wholesalePrice, msrp, isPricingActive };
}

/**
 * Fetch products list for authenticated Retailer with search and filter capabilities
 */
export async function getRetailerProducts(
  filters: RetailerCatalogFilters = {}
): Promise<RetailerCatalogResult> {
  await verifyRetailerSession();
  const adminClient = createAdminClient();

  let rawProducts: any[] | null = null;
  const { data: queryData, error } = await adminClient
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
      selection_status,
      trading_status,
      retailer_visibility,
      trading_pricing_active,
      trading_wholesale_price,
      trading_promo_wholesale_price,
      trading_promo_start_date,
      trading_promo_end_date,
      estimated_retail_price,
      price_usd_fob,
      price_krw_retail,
      price_krw_wholesale,
      price_additional_info,
      origin,
      volume,
      item_width,
      item_depth,
      item_height,
      item_weight,
      carton_pack_qty,
      carton_width,
      carton_depth,
      carton_height,
      carton_weight,
      package_width,
      package_depth,
      package_height,
      package_weight,
      upc,
      ean,
      selling_online,
      sales_link_1,
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

  if (error || !queryData) {
    const { data: fallbackData } = await adminClient
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
        selection_status,
        trading_status,
        sales_status,
        trading_pricing_active,
        trading_wholesale_price,
        trading_promo_wholesale_price,
        trading_promo_start_date,
        trading_promo_end_date,
        estimated_retail_price,
        price_usd_fob,
        price_krw_retail,
        price_krw_wholesale,
        price_additional_info,
        origin,
        volume,
        item_width,
        item_depth,
        item_height,
        item_weight,
        carton_pack_qty,
        carton_width,
        carton_depth,
        carton_height,
        carton_weight,
        package_width,
        package_depth,
        package_height,
        package_weight,
        upc,
        ean,
        selling_online,
        sales_link_1,
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

    rawProducts = fallbackData || [];
  } else {
    rawProducts = queryData;
  }

  if (!rawProducts || rawProducts.length === 0) {
    return {
      products: [],
      totalCount: 0,
      categories: [],
      brands: [],
    };
  }

  // 2. Strict Product Framework filter:
  // Must be COMPLETE (registration) + SELECTED (selection) + active (operational) + visible (hub visibility) + wholesalePrice > 0 + not deleted
  const activeProducts = rawProducts.filter((p) => {
    const info = (p.price_additional_info as any) || {};
    if (info.deleted_at || (p as any).deleted_at) return false;
    if (p.status === "discontinued") return false;

    // Isolate Draft technical placeholders
    if (isDraftPlaceholderName(p.name) || isDraftPlaceholderSku(p.manufacture_sku)) return false;

    // Must be officially SELECTED by K SELECT review
    if (p.selection_status !== "SELECTED") return false;

    // Must be actively operating (trading_status == 'active')
    const tradingStatus = (p as any).trading_status || "inactive";
    if (tradingStatus !== "active") return false;

    // Must be explicitly visible to Retailer Hub (retailer_visibility == 'visible')
    const retailerVisibility = (p as any).retailer_visibility || "hidden";
    if (retailerVisibility !== "visible") return false;

    const regEval = evaluateProductRegistrationStatus({
      id: p.id,
      name: p.name,
      name_en: p.name_en,
      brand_id: p.brand_id,
      category_code: p.category_code,
      manufacture_sku: p.manufacture_sku,
      origin: p.origin,
      price_krw_retail: p.price_krw_retail,
      price_usd_fob: p.price_usd_fob,
      item_width: (p as any).item_width,
      item_depth: (p as any).item_depth,
      item_height: (p as any).item_height,
      item_weight: (p as any).item_weight,
      package_width: p.package_width,
      package_depth: p.package_depth,
      package_height: p.package_height,
      package_weight: p.package_weight,
      carton_pack_qty: p.carton_pack_qty,
      carton_width: (p as any).carton_width,
      carton_depth: (p as any).carton_depth,
      carton_height: (p as any).carton_height,
      carton_weight: (p as any).carton_weight,
      upc: (p as any).upc,
      ean: (p as any).ean,
      selling_online: (p as any).selling_online,
      sales_link_1: (p as any).sales_link_1,
      deleted_at: info.deleted_at || (p as any).deleted_at,
      hasImages: Array.isArray(p.product_images) && p.product_images.length > 0,
    });

    if (regEval.status !== "COMPLETE") return false;

    // Must have a valid wholesale price (> 0)
    const { wholesalePrice } = resolveRetailerPrice(p);
    if (wholesalePrice <= 0) return false;

    return true;
  });

  // 3. Process products and sign thumbnail URLs
  const brandMap = new Map<string, { id: string; name: string; count: number }>();
  const categoryMap = new Map<string, { code: string; label: string; count: number }>();

  const processedList = await Promise.all(
    activeProducts.map(async (p) => {
      const info = (p.price_additional_info as any) || {};
      const overrides = info.admin_overrides || {};

      const brand = (p.brands as any) || {};
      const brandId = p.brand_id || brand.id || "unassigned";
      const brandName = brand.name || "K SELECT Brand";

      const categoryCode = p.category_code || p.category || "skincare";
      const categoryLabel = formatCategoryName(p.category || p.category_code);

      // Sku resolution
      const effectiveSku = resolveEffectiveSku(overrides.letusto_sku, p.letusto_sku) ||
        resolveEffectiveSku(overrides.manufacture_sku, p.manufacture_sku) ||
        "KS-PROD";

      // Pricing & Sales Policy resolution
      const salesPolicy = resolveRetailerSalesPolicy(p);
      const { wholesalePrice: fallbackWholesale, msrp: fallbackMsrp, isPricingActive } = resolveRetailerPrice(p);

      const isPromoActive = salesPolicy.hasActivePromo && salesPolicy.promoWholesalePrice !== null && salesPolicy.promoWholesalePrice > 0;
      const wholesalePrice = isPromoActive
        ? salesPolicy.promoWholesalePrice!
        : (salesPolicy.baseWholesalePrice > 0 ? salesPolicy.baseWholesalePrice : fallbackWholesale);

      const msrp = salesPolicy.srpPrice && salesPolicy.srpPrice > 0 ? salesPolicy.srpPrice : fallbackMsrp;
      const moq = salesPolicy.moq > 0 ? salesPolicy.moq : (overrides.carton_pack_qty || p.carton_pack_qty || 1);
      const isOrderable = wholesalePrice > 0 && isPricingActive && salesPolicy.isConfigured;

      const hasTiers = salesPolicy.publishedTiers.some((t) => t.discount_percent > 0);
      const maxDiscountPercent = Math.max(0, ...salesPolicy.publishedTiers.map((t) => t.discount_percent));

      const marginPercent =
        msrp > 0 && wholesalePrice > 0
          ? Number((((msrp - wholesalePrice) / msrp) * 100).toFixed(1))
          : 0;

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
        isOrderable,
        thumbnailUrl,
        origin: overrides.origin || p.origin || "Republic of Korea",
        volume: overrides.volume || p.volume || null,
        status: p.status || "selling",
        salesPolicy,
        hasTiers,
        maxDiscountPercent,
        isPromoActive,
        promoWholesalePrice: salesPolicy.promoWholesalePrice,
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

  let p: any = null;
  const { data: queryData, error } = await adminClient
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
      selection_status,
      trading_status,
      retailer_visibility,
      trading_pricing_active,
      trading_wholesale_price,
      trading_promo_wholesale_price,
      trading_promo_start_date,
      trading_promo_end_date,
      description,
      bullet_points,
      origin,
      volume,
      upc,
      ean,
      estimated_retail_price,
      price_usd_fob,
      price_krw_retail,
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

  if (error || !queryData) {
    const { data: fallbackData } = await adminClient
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
        selection_status,
        trading_status,
        sales_status,
        trading_pricing_active,
        trading_wholesale_price,
        trading_promo_wholesale_price,
        trading_promo_start_date,
        trading_promo_end_date,
        description,
        bullet_points,
        origin,
        volume,
        upc,
        ean,
        estimated_retail_price,
        price_usd_fob,
        price_krw_retail,
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

    if (!fallbackData) return null;
    p = fallbackData;
  } else {
    p = queryData;
  }

  const info = (p.price_additional_info as any) || {};
  if (
    info.deleted_at ||
    (p as any).deleted_at ||
    p.status === "discontinued" ||
    p.selection_status !== "SELECTED" ||
    ((p as any).trading_status || "inactive") !== "active" ||
    ((p as any).retailer_visibility || "hidden") !== "visible"
  ) {
    return null;
  }

  // Enforce Registration Status == COMPLETE
  const regEval = evaluateProductRegistrationStatus({
    id: p.id,
    name: p.name,
    name_en: p.name_en,
    brand_id: p.brand_id,
    category_code: p.category_code,
    manufacture_sku: p.manufacture_sku,
    origin: p.origin,
    price_krw_retail: p.price_krw_retail,
    price_usd_fob: p.price_usd_fob,
    package_width: p.package_width,
    package_depth: p.package_depth,
    package_height: p.package_height,
    package_weight: p.package_weight,
    carton_pack_qty: p.carton_pack_qty,
    upc: (p as any).upc,
    ean: (p as any).ean,
    deleted_at: info.deleted_at || (p as any).deleted_at,
    hasImages: Array.isArray(p.product_images) && p.product_images.length > 0,
  });

  if (regEval.status !== "COMPLETE") {
    return null;
  }

  // Authoritative wholesale price & sales policy resolution
  const salesPolicy = resolveRetailerSalesPolicy(p);
  const { wholesalePrice: fallbackWholesale, msrp: fallbackMsrp, isPricingActive } = resolveRetailerPrice(p);

  const isPromoActive = salesPolicy.hasActivePromo && salesPolicy.promoWholesalePrice !== null && salesPolicy.promoWholesalePrice > 0;
  const wholesalePrice = isPromoActive
    ? salesPolicy.promoWholesalePrice!
    : (salesPolicy.baseWholesalePrice > 0 ? salesPolicy.baseWholesalePrice : fallbackWholesale);

  if (wholesalePrice <= 0) {
    return null;
  }

  const overrides = info.admin_overrides || {};
  const brand = (p.brands as any) || {};
  const brandId = p.brand_id || brand.id || "unassigned";
  const brandName = brand.name || "K SELECT Brand";

  const categoryLabel = formatCategoryName(p.category || p.category_code);

  const effectiveSku =
    resolveEffectiveSku(overrides.letusto_sku, p.letusto_sku) ||
    resolveEffectiveSku(overrides.manufacture_sku, p.manufacture_sku) ||
    "KS-PROD";

  const isOrderable = wholesalePrice > 0 && isPricingActive && salesPolicy.isConfigured;

  const msrp = salesPolicy.srpPrice && salesPolicy.srpPrice > 0 ? salesPolicy.srpPrice : fallbackMsrp;
  const hasTiers = salesPolicy.publishedTiers.some((t) => t.discount_percent > 0);
  const maxDiscountPercent = Math.max(0, ...salesPolicy.publishedTiers.map((t) => t.discount_percent));

  const marginPercent =
    msrp > 0 && wholesalePrice > 0
      ? Number((((msrp - wholesalePrice) / msrp) * 100).toFixed(1))
      : 0;

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

  const moq = salesPolicy.moq > 0 ? salesPolicy.moq : (overrides.carton_pack_qty || p.carton_pack_qty || 1);

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
    isOrderable,
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
    salesPolicy,
    hasTiers,
    maxDiscountPercent,
    isPromoActive,
    promoWholesalePrice: salesPolicy.promoWholesalePrice,
  };
}
