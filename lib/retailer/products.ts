import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { resolveEffectiveSku, isDraftPlaceholderName, isDraftPlaceholderSku } from "@/lib/product/types";
import { resolveProductName, resolveShortDescription } from "@/lib/product/name-resolver";
import { formatCanonicalCountryName } from "@/lib/constants/countries";
import { evaluateProductRegistrationStatus } from "@/lib/product/registration-status";
import { resolveProductPricing, parseValidPositiveNumber } from "@/lib/product/pricing-resolver";
import {
  resolveRetailerSalesPolicy,
  type ResolvedRetailerSalesPolicy,
} from "@/lib/product/retailer-policy";
import {
  evaluateHubVisibility,
  type HubVisibilityEvaluation,
  type EffectiveHubVisibility,
  type OrderabilityStatus,
} from "@/lib/product/hub-visibility";
import { getCategoryMaster } from "@/lib/product/category-taxonomy-server";
import {
  resolveProductCategoryBranch,
  buildCategoryTreeWithCounts,
  type CategoryItem,
  type CategoryHierarchy,
} from "@/lib/product/category-taxonomy";
import {
  resolveActiveMarketingBadges,
  type ActiveMarketingBadge,
} from "@/lib/product/badge-utils";

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
  depth1Code: string | null;
  depth2Code: string | null;
  depth3Code: string | null;
  categoryPath?: string;
  wholesalePrice: number;
  msrp: number;
  marginPercent: number;
  moq: number;
  isOrderable: boolean;
  thumbnailUrl: string | null;
  imageUrls?: string[];
  shortDescription?: string | null;
  origin: string | null;
  volume: string | null;
  status: string;
  salesPolicy?: ResolvedRetailerSalesPolicy;
  hasTiers?: boolean;
  maxDiscountPercent?: number;
  isPromoActive?: boolean;
  promoWholesalePrice?: number | null;
  activeMarketingBadges: ActiveMarketingBadge[];
  availableStock?: number;
  isSoldOut?: boolean;
  restockEta?: string | null;
  orderabilityStatus?: OrderabilityStatus;
  orderabilityLabel?: string;
  orderabilityReason?: string;
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
  depth1?: string;
  depth2?: string;
  depth3?: string;
  brandId?: string;
  marginFilter?: string; // 'all' | '40' | '50' | '60'
  pricePreset?: string; // 'all' | 'under5' | '5to10' | '10to20' | 'over20' | 'custom'
  minPrice?: number;
  maxPrice?: number;
  orderableOnly?: boolean;
  sortBy?: string; // 'default' | 'margin_desc' | 'price_asc' | 'price_desc' | 'newest'
}

export interface RetailerCatalogResult {
  products: RetailerProductSummary[];
  totalCount: number;
  categories: Array<{ code: string; label: string; count: number }>;
  categoryHierarchy: CategoryHierarchy;
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
      categoryHierarchy: {
        depth1: [],
        depth2ByParent: {},
        depth3ByParent: {},
        categoryByCode: {},
      },
      brands: [],
    };
  }

  // 2. Fetch inventory balances across all products
  const { data: allBalances } = await adminClient
    .from("inventory_balances")
    .select("product_id, qty_on_hand, qty_hold, qty_damaged");

  const stockMap = new Map<string, number>();
  (allBalances ?? []).forEach((b: any) => {
    const onHand = Number(b.qty_on_hand || 0);
    const hold = Number(b.qty_hold || 0);
    const damaged = Number(b.qty_damaged || 0);
    const avail = Math.max(0, onHand - hold - damaged);
    stockMap.set(b.product_id, (stockMap.get(b.product_id) || 0) + avail);
  });

  // Fetch open inbound shipment ETAs
  const { data: openShipments } = await adminClient
    .from("inbound_shipment_lines")
    .select(`
      product_id,
      inbound_shipments!inner(status, eta)
    `)
    .not("inbound_shipments.status", "in", '("CANCELLED", "COMPLETED")');

  const restockEtaMap = new Map<string, string>();
  (openShipments ?? []).forEach((sl: any) => {
    const shipment = Array.isArray(sl.inbound_shipments) ? sl.inbound_shipments[0] : sl.inbound_shipments;
    if (shipment?.eta) {
      const existing = restockEtaMap.get(sl.product_id);
      if (!existing || new Date(shipment.eta) < new Date(existing)) {
        restockEtaMap.set(sl.product_id, shipment.eta);
      }
    }
  });

  // 3. Unified Hub Visibility filter:
  // Must have Effective Hub Visibility == 'PUBLISHED'
  // Out of stock (availableStock == 0) products REMAIN in the catalog with isSoldOut=true.
  const activeProducts = rawProducts.filter((p) => {
    const stock = stockMap.get(p.id) || 0;
    const eta = restockEtaMap.get(p.id) || null;
    const visEval = evaluateHubVisibility(p, stock, eta);
    return visEval.effectiveVisibility === "PUBLISHED";
  });

  // 4. Fetch Category Master & build authoritative 3-Depth Category Tree
  const categoryMaster = await getCategoryMaster();
  const categoryHierarchy = buildCategoryTreeWithCounts(categoryMaster, activeProducts);

  // 5. Process products and sign thumbnail URLs
  const brandMap = new Map<string, { id: string; name: string; count: number }>();
  const categoryMap = new Map<string, { code: string; label: string; count: number }>();

  const processedList = await Promise.all(
    activeProducts.map(async (p) => {
      const info = (p.price_additional_info as any) || {};
      const overrides = info.admin_overrides || {};

      const brand = (p.brands as any) || {};
      const brandId = p.brand_id || brand.id || "unassigned";
      const brandName = brand.name || "K SELECT Brand";

      // 3-Depth Category Branch Resolution
      const branch = resolveProductCategoryBranch(p, categoryHierarchy.categoryByCode);
      const categoryLabel = branch.depth1LabelEn || formatCategoryName(p.category || p.category_code);

      // Sku resolution
      const effectiveSku = resolveEffectiveSku(overrides.letusto_sku, p.letusto_sku) ||
        resolveEffectiveSku(overrides.manufacture_sku, p.manufacture_sku) ||
        "KS-PROD";

      // Inventory & Visibility Evaluation
      const stock = stockMap.get(p.id) || 0;
      const restockEta = restockEtaMap.get(p.id) || null;
      const visEval = evaluateHubVisibility(p, stock, restockEta);

      // Pricing & Sales Policy resolution
      const salesPolicy = visEval.salesPolicy;
      const { wholesalePrice: fallbackWholesale, msrp: fallbackMsrp } = resolveRetailerPrice(p);

      const isPromoActive = salesPolicy.hasActivePromo && salesPolicy.promoWholesalePrice !== null && salesPolicy.promoWholesalePrice > 0;
      const wholesalePrice = isPromoActive
        ? salesPolicy.promoWholesalePrice!
        : (salesPolicy.baseWholesalePrice > 0 ? salesPolicy.baseWholesalePrice : fallbackWholesale);

      const msrp = salesPolicy.srpPrice && salesPolicy.srpPrice > 0 ? salesPolicy.srpPrice : fallbackMsrp;
      const moq = visEval.moq;
      const isOrderable = visEval.isOrderable;

      const hasTiers = salesPolicy.publishedTiers.some((t) => t.discount_percent > 0);
      const maxDiscountPercent = Math.max(0, ...salesPolicy.publishedTiers.map((t) => t.discount_percent));

      const marginPercent =
        msrp > 0 && wholesalePrice > 0
          ? Number((((msrp - wholesalePrice) / msrp) * 100).toFixed(1))
          : 0;

      // Marketing Badges resolution (Promotion, Sale, New)
      const activeMarketingBadges = resolveActiveMarketingBadges(
        {
          isPromoActive,
          price_additional_info: p.price_additional_info,
        },
        "en"
      );

      // Image signing (sign up to 6 images for listing card carousel)
      const rawImages = (p.product_images as any[]) || [];
      const sortedImages = [...rawImages].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      const imageUrls: string[] = [];
      if (sortedImages.length > 0) {
        for (const img of sortedImages.slice(0, 6)) {
          if (img.storage_path) {
            if (img.storage_path.startsWith("http://") || img.storage_path.startsWith("https://")) {
              imageUrls.push(img.storage_path);
            } else {
              try {
                const { data: signed } = await adminClient.storage
                  .from("company-uploads")
                  .createSignedUrl(img.storage_path, 3600);
                if (signed?.signedUrl) imageUrls.push(signed.signedUrl);
              } catch {
                // ignore error
              }
            }
          }
        }
      }
      const thumbnailUrl = imageUrls.length > 0 ? imageUrls[0] : null;

      // Accumulate filter counts
      const bEntry = brandMap.get(brandId) || { id: brandId, name: brandName, count: 0 };
      bEntry.count += 1;
      brandMap.set(brandId, bEntry);

      const cEntry = categoryMap.get(branch.depth1Code) || {
        code: branch.depth1Code,
        label: branch.depth1LabelEn,
        count: 0,
      };
      cEntry.count += 1;
      categoryMap.set(branch.depth1Code, cEntry);

      const authoritativeName = resolveProductName(p);
      const shortDesc = resolveShortDescription(p);

      const item: RetailerProductSummary = {
        id: p.id,
        name: authoritativeName,
        nameEn: authoritativeName,
        brandId,
        brandName,
        sku: effectiveSku,
        category: p.category || "skincare",
        categoryLabel,
        categoryCode: p.category_code || null,
        depth1Code: branch.depth1Code,
        depth2Code: branch.depth2Code,
        depth3Code: branch.depth3Code,
        categoryPath: [branch.depth1LabelEn, branch.depth2LabelEn, branch.depth3LabelEn].filter(Boolean).join(" > "),
        wholesalePrice,
        msrp,
        marginPercent,
        moq,
        isOrderable,
        thumbnailUrl,
        imageUrls,
        shortDescription: shortDesc,
        origin: formatCanonicalCountryName(overrides.origin || p.origin) || "South Korea",
        volume: overrides.volume || p.volume || null,
        status: p.status || "selling",
        salesPolicy,
        hasTiers,
        maxDiscountPercent,
        isPromoActive,
        promoWholesalePrice: salesPolicy.promoWholesalePrice,
        activeMarketingBadges,
        availableStock: stock,
        isSoldOut: visEval.isSoldOut,
        restockEta: visEval.restockEta,
        orderabilityStatus: visEval.orderabilityStatus,
        orderabilityLabel: visEval.orderabilityLabel,
        orderabilityReason: visEval.orderabilityReason,
      };

      return item;
    })
  );

  // 6. Apply search & filters
  let filtered = processedList;

  if (filters.search && filters.search.trim()) {
    const q = filters.search.toLowerCase().trim();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.nameEn && p.nameEn.toLowerCase().includes(q)) ||
        p.brandName.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.categoryLabel.toLowerCase().includes(q) ||
        (p.categoryPath && p.categoryPath.toLowerCase().includes(q))
    );
  }

  // 3-Depth Category Filter
  if (filters.depth3 && filters.depth3 !== "all") {
    filtered = filtered.filter((p) => p.depth3Code === filters.depth3);
  } else if (filters.depth2 && filters.depth2 !== "all") {
    filtered = filtered.filter((p) => p.depth2Code === filters.depth2);
  } else if (filters.depth1 && filters.depth1 !== "all") {
    filtered = filtered.filter((p) => p.depth1Code === filters.depth1);
  } else if (filters.category && filters.category !== "all") {
    filtered = filtered.filter(
      (p) =>
        p.depth1Code === filters.category ||
        p.depth2Code === filters.category ||
        p.depth3Code === filters.category ||
        p.category === filters.category ||
        p.categoryCode === filters.category
    );
  }

  // Brand Filter
  if (filters.brandId && filters.brandId !== "all") {
    filtered = filtered.filter((p) => p.brandId === filters.brandId);
  }

  // Margin Filter
  if (filters.marginFilter && filters.marginFilter !== "all") {
    const minMargin = Number(filters.marginFilter);
    if (!isNaN(minMargin) && minMargin > 0) {
      filtered = filtered.filter((p) => p.msrp > 0 && p.wholesalePrice > 0 && p.marginPercent >= minMargin);
    }
  }

  // Price Preset Filter
  if (filters.pricePreset && filters.pricePreset !== "all") {
    if (filters.pricePreset === "under10") {
      filtered = filtered.filter((p) => p.wholesalePrice > 0 && p.wholesalePrice < 10);
    } else if (filters.pricePreset === "between10and20" || filters.pricePreset === "10to20") {
      filtered = filtered.filter((p) => p.wholesalePrice >= 10 && p.wholesalePrice < 20);
    } else if (filters.pricePreset === "between20and30" || filters.pricePreset === "20to30") {
      filtered = filtered.filter((p) => p.wholesalePrice >= 20 && p.wholesalePrice < 30);
    } else if (filters.pricePreset === "between30and40" || filters.pricePreset === "30to40") {
      filtered = filtered.filter((p) => p.wholesalePrice >= 30 && p.wholesalePrice < 40);
    } else if (filters.pricePreset === "between40and50" || filters.pricePreset === "40to50") {
      filtered = filtered.filter((p) => p.wholesalePrice >= 40 && p.wholesalePrice < 50);
    } else if (filters.pricePreset === "over50" || filters.pricePreset === "50plus") {
      filtered = filtered.filter((p) => p.wholesalePrice >= 50);
    }
  }

  // Custom Min/Max Price Filter
  if (filters.minPrice !== undefined && !isNaN(filters.minPrice) && filters.minPrice > 0) {
    filtered = filtered.filter((p) => p.wholesalePrice >= (filters.minPrice ?? 0));
  }
  if (filters.maxPrice !== undefined && !isNaN(filters.maxPrice) && filters.maxPrice > 0) {
    filtered = filtered.filter((p) => p.wholesalePrice <= (filters.maxPrice ?? Infinity));
  }

  // Orderable Stock Only Filter (default OFF)
  if (filters.orderableOnly) {
    filtered = filtered.filter((p) => (p.availableStock ?? 0) >= p.moq && p.isOrderable);
  }

  // Sorting
  if (filters.sortBy === "margin_desc") {
    filtered.sort((a, b) => (b.marginPercent || 0) - (a.marginPercent || 0));
  } else if (filters.sortBy === "price_asc") {
    filtered.sort((a, b) => (a.wholesalePrice || 0) - (b.wholesalePrice || 0));
  } else if (filters.sortBy === "price_desc") {
    filtered.sort((a, b) => (b.wholesalePrice || 0) - (a.wholesalePrice || 0));
  }

  return {
    products: filtered,
    totalCount: filtered.length,
    categories: Array.from(categoryMap.values()).sort((a, b) => b.count - a.count),
    categoryHierarchy,
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

  // Query inventory balance for product
  const { data: balances } = await adminClient
    .from("inventory_balances")
    .select("qty_on_hand, qty_hold, qty_damaged")
    .eq("product_id", productId);

  let totalAvailable = 0;
  (balances ?? []).forEach((b: any) => {
    const onHand = Number(b.qty_on_hand || 0);
    const hold = Number(b.qty_hold || 0);
    const damaged = Number(b.qty_damaged || 0);
    totalAvailable += Math.max(0, onHand - hold - damaged);
  });

  // Query open shipment ETAs
  const { data: openShipments } = await adminClient
    .from("inbound_shipment_lines")
    .select(`
      product_id,
      inbound_shipments!inner(status, eta)
    `)
    .eq("product_id", productId)
    .not("inbound_shipments.status", "in", '("CANCELLED", "COMPLETED")');

  let restockEta: string | null = null;
  (openShipments ?? []).forEach((sl: any) => {
    const shipment = Array.isArray(sl.inbound_shipments) ? sl.inbound_shipments[0] : sl.inbound_shipments;
    if (shipment?.eta) {
      if (!restockEta || new Date(shipment.eta) < new Date(restockEta)) {
        restockEta = shipment.eta;
      }
    }
  });

  const visEval = evaluateHubVisibility(p, totalAvailable, restockEta);

  if (visEval.effectiveVisibility !== "PUBLISHED") {
    return null;
  }

  const info = (p.price_additional_info as any) || {};
  const overrides = info.admin_overrides || {};
  const brand = (p.brands as any) || {};
  const brandId = p.brand_id || brand.id || "unassigned";
  const brandName = brand.name || "K SELECT Brand";

  const categoryLabel = formatCategoryName(p.category || p.category_code);

  const effectiveSku =
    resolveEffectiveSku(overrides.letusto_sku, p.letusto_sku) ||
    resolveEffectiveSku(overrides.manufacture_sku, p.manufacture_sku) ||
    "KS-PROD";

  const salesPolicy = visEval.salesPolicy;
  const { wholesalePrice: fallbackWholesale, msrp: fallbackMsrp } = resolveRetailerPrice(p);

  const isPromoActive = salesPolicy.hasActivePromo && salesPolicy.promoWholesalePrice !== null && salesPolicy.promoWholesalePrice > 0;
  const wholesalePrice = isPromoActive
    ? salesPolicy.promoWholesalePrice!
    : (salesPolicy.baseWholesalePrice > 0 ? salesPolicy.baseWholesalePrice : fallbackWholesale);

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

  const activeMarketingBadges = resolveActiveMarketingBadges(
    {
      isPromoActive,
      price_additional_info: p.price_additional_info,
    },
    "en"
  );

  const moq = visEval.moq;

  const authoritativeName = resolveProductName(p);
  const shortDesc = resolveShortDescription(p);

  return {
    id: p.id,
    name: authoritativeName,
    nameEn: authoritativeName,
    brandId,
    brandName,
    sku: effectiveSku,
    category: p.category || "skincare",
    categoryLabel,
    categoryCode: p.category_code || null,
    depth1Code: null,
    depth2Code: null,
    depth3Code: null,
    wholesalePrice,
    msrp,
    marginPercent,
    moq,
    isOrderable: visEval.isOrderable,
    thumbnailUrl: images.length > 0 ? images[0].url : null,
    imageUrls: images.map((i) => i.url),
    shortDescription: shortDesc,
    origin: formatCanonicalCountryName(overrides.origin || p.origin) || "South Korea",
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
    activeMarketingBadges,
    availableStock: totalAvailable,
    isSoldOut: visEval.isSoldOut,
    restockEta: visEval.restockEta,
    orderabilityStatus: visEval.orderabilityStatus,
    orderabilityLabel: visEval.orderabilityLabel,
    orderabilityReason: visEval.orderabilityReason,
  };
}
