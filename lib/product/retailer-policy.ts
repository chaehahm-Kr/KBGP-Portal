/**
 * Authoritative Retailer Sales Policy & Quantity Tier Pricing Engine
 * Shared across Admin Trading Detail, Retailer Hub, Cart, and Order Validation.
 */

import { parseValidPositiveNumber } from "@/lib/product/pricing-resolver";

export interface RetailerPriceTierInput {
  id?: string;
  multiple: number;           // MOQ multiple (e.g. 1, 3, 6)
  discount_percent: number;   // e.g. 0, 2, 5 (0 <= discount < 100)
  is_published: boolean;      // true/false
}

export interface RetailerPriceTier {
  id: string;
  multiple: number;
  min_qty: number;
  discount_percent: number;
  unit_price: number;
  is_published: boolean;
}

export interface RetailerSalesPolicyInput {
  moq: number;
  base_wholesale_price: number;
  tiers: RetailerPriceTierInput[];
  promo_wholesale_price?: number | null;
  promo_start_date?: string | null;
  promo_end_date?: string | null;
  note?: string | null;
}

export interface ResolvedRetailerSalesPolicy {
  isConfigured: boolean;
  initialSource: "saved_policy" | "catalog_case" | "needs_setup";
  moq: number;
  baseWholesalePrice: number;
  isMoqValid: boolean;
  isBasePriceValid: boolean;
  tiers: RetailerPriceTier[];
  publishedTiers: RetailerPriceTier[];
  
  // Promotion Resolution
  promoWholesalePrice: number | null;
  promoStartDate: string | null;
  promoEndDate: string | null;
  promoStatus: "scheduled" | "active" | "ended" | "none";
  hasActivePromo: boolean;
  
  // SRP & Map for Margins
  srpPrice: number | null;
  mapPrice: number | null;
}

export interface ApplicablePriceResult {
  isOrderable: boolean;
  orderableReason: string | null;
  quantity: number;
  bundleCount: number;
  baseUnitPrice: number;
  effectiveUnitPrice: number;
  discountPercent: number;
  subtotal: number;
  appliedReason: "promotion" | "tier_quantity" | "base_moq" | "unconfigured";
  appliedTierId: string | null;
  appliedTierMultiple: number;
  retailerMarginPercent: number | null;
  retailerMarginStatus: "normal" | "caution" | "warning" | "none";
}

/**
 * Calculates tier unit price with exact 2-decimal rounding.
 * Math: round(basePrice * (1 - discountPercent / 100) * 100) / 100
 */
export function calculateTierUnitPrice(basePrice: number, discountPercent: number): number {
  if (!basePrice || basePrice <= 0) return 0;
  if (!discountPercent || discountPercent <= 0) return Number(basePrice.toFixed(2));
  const rate = Math.max(0, Math.min(99.99, discountPercent)) / 100;
  const discounted = basePrice * (1 - rate);
  return Math.round((discounted + Number.EPSILON) * 100) / 100;
}

/**
 * Checks if order quantity satisfies MOQ batching rules:
 * 1. quantity >= MOQ
 * 2. quantity % MOQ === 0
 */
export function isValidMoqOrderQuantity(quantity: number, moq: number): boolean {
  if (!Number.isInteger(quantity) || quantity <= 0) return false;
  if (!Number.isInteger(moq) || moq <= 0) return false;
  return quantity >= moq && quantity % moq === 0;
}

/**
 * Generates default 3-tier structure based on MOQ:
 * - Base: 1x MOQ, 0% discount
 * - Tier 1: 3x MOQ, 2% discount
 * - Tier 2: 6x MOQ, 5% discount
 */
export function generateDefaultPriceTiers(moq: number, basePrice: number): RetailerPriceTier[] {
  const safeMoq = Math.max(1, Math.floor(moq || 1));
  const safePrice = basePrice > 0 ? basePrice : 0;

  return [
    {
      id: "tier-base",
      multiple: 1,
      min_qty: safeMoq * 1,
      discount_percent: 0,
      unit_price: calculateTierUnitPrice(safePrice, 0),
      is_published: true,
    },
    {
      id: "tier-1",
      multiple: 3,
      min_qty: safeMoq * 3,
      discount_percent: 2,
      unit_price: calculateTierUnitPrice(safePrice, 2),
      is_published: true,
    },
    {
      id: "tier-2",
      multiple: 6,
      min_qty: safeMoq * 6,
      discount_percent: 5,
      unit_price: calculateTierUnitPrice(safePrice, 5),
      is_published: true,
    },
  ];
}

/**
 * Resolves full Retailer Sales Policy from raw product data
 */
export function resolveRetailerSalesPolicy(product: any): ResolvedRetailerSalesPolicy {
  const priceInfo = product.price_additional_info || {};
  const savedPolicy = priceInfo.retailer_sales_policy;
  const adminOverrides = priceInfo.admin_overrides || {};
  const tradingOverrides = priceInfo.trading_overrides || {};

  // 1. Resolve MOQ
  let moq: number = 0;
  let initialSource: ResolvedRetailerSalesPolicy["initialSource"] = "needs_setup";

  if (savedPolicy && typeof savedPolicy.moq === "number" && savedPolicy.moq > 0) {
    moq = Math.floor(savedPolicy.moq);
    initialSource = "saved_policy";
  } else if (product.carton_pack_qty && Number(product.carton_pack_qty) > 0) {
    moq = Math.floor(Number(product.carton_pack_qty));
    initialSource = "catalog_case";
  } else if (adminOverrides.carton_pack_qty && Number(adminOverrides.carton_pack_qty) > 0) {
    moq = Math.floor(Number(adminOverrides.carton_pack_qty));
    initialSource = "catalog_case";
  }

  // 2. Resolve Base Wholesale Price
  const directWholesale = parseValidPositiveNumber(product.trading_wholesale_price);
  const policyWholesale = parseValidPositiveNumber(savedPolicy?.base_wholesale_price);
  const jsonWholesale = parseValidPositiveNumber(tradingOverrides.wholesale_price);
  const adminFob = parseValidPositiveNumber(adminOverrides.price_usd_fob);
  const dbFob = parseValidPositiveNumber(product.price_usd_fob);

  const baseWholesalePrice = directWholesale ?? policyWholesale ?? jsonWholesale ?? adminFob ?? dbFob ?? 0;

  const isMoqValid = moq > 0;
  const isBasePriceValid = baseWholesalePrice > 0;

  // 3. Resolve Tiers
  let tiers: RetailerPriceTier[] = [];
  if (savedPolicy && Array.isArray(savedPolicy.tiers) && savedPolicy.tiers.length > 0) {
    tiers = savedPolicy.tiers.map((t: any, idx: number) => {
      const mult = Math.max(1, Math.floor(Number(t.multiple) || 1));
      const disc = Math.max(0, Math.min(99.99, Number(t.discount_percent) || 0));
      return {
        id: t.id || `tier-${idx}`,
        multiple: mult,
        min_qty: isMoqValid ? moq * mult : mult,
        discount_percent: mult === 1 ? 0 : disc, // Base tier is always 0%
        unit_price: calculateTierUnitPrice(baseWholesalePrice, mult === 1 ? 0 : disc),
        is_published: t.is_published !== false,
      };
    });
  } else {
    tiers = generateDefaultPriceTiers(moq > 0 ? moq : 1, baseWholesalePrice);
  }

  // Ensure Base tier exists
  if (!tiers.some((t) => t.multiple === 1)) {
    tiers.unshift({
      id: "tier-base",
      multiple: 1,
      min_qty: isMoqValid ? moq * 1 : 1,
      discount_percent: 0,
      unit_price: calculateTierUnitPrice(baseWholesalePrice, 0),
      is_published: true,
    });
  }

  const publishedTiers = tiers.filter((t) => t.is_published);

  // 4. Resolve Promotion
  const directPromo = parseValidPositiveNumber(product.trading_promo_wholesale_price);
  const policyPromo = parseValidPositiveNumber(savedPolicy?.promotion?.promo_wholesale_price);
  const jsonPromo = parseValidPositiveNumber(tradingOverrides.promo_wholesale_price);
  const promoWholesalePrice = directPromo ?? policyPromo ?? jsonPromo ?? null;

  const promoStartDate =
    product.trading_promo_start_date ||
    savedPolicy?.promotion?.promo_start_date ||
    tradingOverrides.promo_start_date ||
    null;
  const promoEndDate =
    product.trading_promo_end_date ||
    savedPolicy?.promotion?.promo_end_date ||
    tradingOverrides.promo_end_date ||
    null;

  let promoStatus: ResolvedRetailerSalesPolicy["promoStatus"] = "none";
  let hasActivePromo = false;

  if (promoWholesalePrice !== null && promoWholesalePrice > 0) {
    const now = new Date();
    const start = promoStartDate ? new Date(promoStartDate) : null;
    let end = promoEndDate ? new Date(promoEndDate) : null;
    
    // If end date is YYYY-MM-DD without time, make it inclusive to end of day
    if (end && promoEndDate && promoEndDate.length === 10) {
      end = new Date(`${promoEndDate}T23:59:59.999Z`);
    }

    if (start && start > now) {
      promoStatus = "scheduled";
    } else if (end && end < now) {
      promoStatus = "ended";
    } else {
      promoStatus = "active";
      hasActivePromo = true;
    }
  }

  // 5. Resolve SRP & MAP
  const directSrp = parseValidPositiveNumber(product.trading_srp_price);
  const jsonSrp = parseValidPositiveNumber(tradingOverrides.srp_price);
  const adminSrp = parseValidPositiveNumber(adminOverrides.estimated_retail_price);
  const dbEstSrp = parseValidPositiveNumber(product.estimated_retail_price);
  const srpPrice = directSrp ?? jsonSrp ?? adminSrp ?? dbEstSrp ?? null;

  const directMap = parseValidPositiveNumber(product.trading_map_price);
  const jsonMap = parseValidPositiveNumber(tradingOverrides.map_price);
  const mapPrice = directMap ?? jsonMap ?? (srpPrice && srpPrice > 0 ? srpPrice : null);

  return {
    isConfigured: isMoqValid && isBasePriceValid,
    initialSource: savedPolicy ? "saved_policy" : initialSource,
    moq,
    baseWholesalePrice,
    isMoqValid,
    isBasePriceValid,
    tiers,
    publishedTiers,
    promoWholesalePrice,
    promoStartDate,
    promoEndDate,
    promoStatus,
    hasActivePromo,
    srpPrice,
    mapPrice,
  };
}

/**
 * Calculates applicable price, discount, subtotal, and margin for a given quantity
 */
export function calculateApplicablePrice(
  policy: ResolvedRetailerSalesPolicy,
  quantity: number
): ApplicablePriceResult {
  const safeQty = Math.floor(quantity || 0);

  if (!policy.isConfigured || policy.moq <= 0 || policy.baseWholesalePrice <= 0) {
    return {
      isOrderable: false,
      orderableReason: "판매 정책 설정이 필요합니다.",
      quantity: safeQty,
      bundleCount: 0,
      baseUnitPrice: policy.baseWholesalePrice,
      effectiveUnitPrice: policy.baseWholesalePrice,
      discountPercent: 0,
      subtotal: 0,
      appliedReason: "unconfigured",
      appliedTierId: null,
      appliedTierMultiple: 1,
      retailerMarginPercent: null,
      retailerMarginStatus: "none",
    };
  }

  // Validate MOQ multiple rule
  if (!isValidMoqOrderQuantity(safeQty, policy.moq)) {
    return {
      isOrderable: false,
      orderableReason: `주문 수량은 최소 ${policy.moq}개 이상이며, ${policy.moq}개 단위의 배수여야 합니다.`,
      quantity: safeQty,
      bundleCount: Math.floor(safeQty / policy.moq),
      baseUnitPrice: policy.baseWholesalePrice,
      effectiveUnitPrice: policy.baseWholesalePrice,
      discountPercent: 0,
      subtotal: Number((safeQty * policy.baseWholesalePrice).toFixed(2)),
      appliedReason: "base_moq",
      appliedTierId: "tier-base",
      appliedTierMultiple: 1,
      retailerMarginPercent: null,
      retailerMarginStatus: "none",
    };
  }

  const bundleCount = safeQty / policy.moq;

  // Find the highest published tier where min_qty <= safeQty
  // Sort descending by min_qty
  const sortedTiers = [...policy.publishedTiers].sort((a, b) => b.min_qty - a.min_qty);
  const matchedTier = sortedTiers.find((t) => safeQty >= t.min_qty) || sortedTiers[sortedTiers.length - 1] || {
    id: "tier-base",
    multiple: 1,
    min_qty: policy.moq,
    discount_percent: 0,
    unit_price: policy.baseWholesalePrice,
    is_published: true,
  };

  const tierUnitPrice = matchedTier.unit_price;
  let effectiveUnitPrice = tierUnitPrice;
  let appliedReason: ApplicablePriceResult["appliedReason"] = matchedTier.discount_percent > 0 ? "tier_quantity" : "base_moq";
  let appliedDiscount = matchedTier.discount_percent;

  // Check Promotion: apply promo price if active and lower than tier price (no compounding)
  if (policy.hasActivePromo && policy.promoWholesalePrice !== null && policy.promoWholesalePrice > 0) {
    if (policy.promoWholesalePrice < tierUnitPrice) {
      effectiveUnitPrice = policy.promoWholesalePrice;
      appliedReason = "promotion";
      appliedDiscount = Math.round(((policy.baseWholesalePrice - effectiveUnitPrice) / policy.baseWholesalePrice) * 1000) / 10;
    }
  }

  const subtotal = Math.round((safeQty * effectiveUnitPrice + Number.EPSILON) * 100) / 100;

  // Margin calculation
  let retailerMarginPercent: number | null = null;
  let retailerMarginStatus: ApplicablePriceResult["retailerMarginStatus"] = "none";

  if (policy.srpPrice && policy.srpPrice > 0 && effectiveUnitPrice <= policy.srpPrice) {
    const rawMargin = ((policy.srpPrice - effectiveUnitPrice) / policy.srpPrice) * 100;
    if (Number.isFinite(rawMargin) && rawMargin >= 0) {
      retailerMarginPercent = Math.round(rawMargin * 10) / 10;
      if (retailerMarginPercent >= 50) retailerMarginStatus = "normal";
      else if (retailerMarginPercent >= 40) retailerMarginStatus = "caution";
      else retailerMarginStatus = "warning";
    }
  }

  return {
    isOrderable: true,
    orderableReason: null,
    quantity: safeQty,
    bundleCount,
    baseUnitPrice: policy.baseWholesalePrice,
    effectiveUnitPrice,
    discountPercent: appliedDiscount,
    subtotal,
    appliedReason,
    appliedTierId: matchedTier.id,
    appliedTierMultiple: matchedTier.multiple,
    retailerMarginPercent,
    retailerMarginStatus,
  };
}
