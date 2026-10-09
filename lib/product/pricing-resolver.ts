/**
 * Authoritative Single Source of Truth for Product Pricing & Margin Resolution.
 * Used across Trading List, Trading Detail, Admin Product pages & Retailer Hub.
 */

export interface RawProductPricingInput {
  price_usd_fob?: number | string | null;
  price_krw_retail?: number | string | null;
  price_krw_wholesale?: number | string | null;
  estimated_retail_price?: number | string | null;
  trading_wholesale_price?: number | string | null;
  trading_promo_wholesale_price?: number | string | null;
  trading_promo_start_date?: string | null;
  trading_promo_end_date?: string | null;
  trading_map_price?: number | string | null;
  trading_srp_price?: number | string | null;
  price_additional_info?: Record<string, any> | null;
}

export interface ResolvedPricing {
  wholesalePrice: number | null;
  baseWholesalePrice: number | null;
  promoWholesalePrice: number | null;
  hasActivePromo: boolean;
  retailPrice: number | null; // SRP in USD
  mapPrice: number | null;
  retailerMarginPercent: number | null;
  retailerMarginStatus: "normal" | "caution" | "warning" | "none";

  // Formatted Strings for Safe Display
  formattedWholesale: string; // e.g. "$2.75" or "Price Missing"
  formattedRetail: string;    // e.g. "$15.00" or "—"
  formattedMargin: string;    // e.g. "58.3%" or "—"
  isWholesaleValid: boolean;
  isRetailValid: boolean;
  isMarginValid: boolean;
}

/**
 * Safely parses any value (number, string with $, ₩, commas, spaces)
 * into a finite positive number (> 0), or returns null.
 */
export function parseValidPositiveNumber(val: any): number | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") {
    return Number.isFinite(val) && !Number.isNaN(val) && val > 0 ? val : null;
  }
  if (typeof val === "string") {
    // Strip currency symbols, commas, and trailing characters except digits and decimal point
    const cleaned = val.replace(/[^0-9.-]/g, "");
    if (!cleaned) return null;
    const num = parseFloat(cleaned);
    return Number.isFinite(num) && !Number.isNaN(num) && num > 0 ? num : null;
  }
  return null;
}

/**
 * Authoritative Pricing Resolver
 */
export function resolveProductPricing(input: RawProductPricingInput): ResolvedPricing {
  const priceAddInfo = input.price_additional_info || {};
  const adminOverrides = priceAddInfo.admin_overrides || {};
  const tradingOverrides = priceAddInfo.trading_overrides || {};

  // 1. Resolve Base Wholesale (FOB / Wholesale in USD)
  const directWholesale = parseValidPositiveNumber(input.trading_wholesale_price);
  const jsonWholesale = parseValidPositiveNumber(tradingOverrides.wholesale_price);
  const adminWholesale = parseValidPositiveNumber(adminOverrides.price_usd_fob);
  const dbFob = parseValidPositiveNumber(input.price_usd_fob);
  const dbKrwWholesale = parseValidPositiveNumber(input.price_krw_wholesale);

  const baseWholesalePrice = directWholesale ?? jsonWholesale ?? adminWholesale ?? dbFob ?? dbKrwWholesale ?? null;

  // 2. Resolve Promo Wholesale
  const directPromo = parseValidPositiveNumber(input.trading_promo_wholesale_price);
  const jsonPromo = parseValidPositiveNumber(tradingOverrides.promo_wholesale_price);
  const promoWholesalePrice = directPromo ?? jsonPromo ?? null;

  const promoStartDate = input.trading_promo_start_date || tradingOverrides.promo_start_date || null;
  const promoEndDate = input.trading_promo_end_date || tradingOverrides.promo_end_date || null;

  const now = new Date();
  const hasActivePromo = promoWholesalePrice !== null && (
    (!promoStartDate || new Date(promoStartDate) <= now) &&
    (!promoEndDate || new Date(promoEndDate) >= now)
  );

  const wholesalePrice = hasActivePromo ? promoWholesalePrice : baseWholesalePrice;

  // 3. Resolve Retail Price (SRP in USD)
  const directSrp = parseValidPositiveNumber(input.trading_srp_price);
  const jsonSrp = parseValidPositiveNumber(tradingOverrides.srp_price);
  const adminSrp = parseValidPositiveNumber(adminOverrides.estimated_retail_price);
  const dbEstSrp = parseValidPositiveNumber(input.estimated_retail_price);

  let rawSrp = directSrp ?? jsonSrp ?? adminSrp ?? dbEstSrp ?? null;

  // Currency Sanitation Guard:
  // If rawSrp > 500 while wholesalePrice <= 100 (e.g. rawSrp = 15000 from KRW retail price),
  // it is an unconverted KRW value, NOT a valid USD SRP. Treat as null!
  if (rawSrp !== null && rawSrp > 500 && (wholesalePrice === null || wholesalePrice <= 100)) {
    rawSrp = null;
  }

  const retailPrice = rawSrp;

  // 4. Resolve MAP Price
  const directMap = parseValidPositiveNumber(input.trading_map_price);
  const jsonMap = parseValidPositiveNumber(tradingOverrides.map_price);
  const mapPrice = directMap ?? jsonMap ?? (retailPrice && retailPrice > 0 ? retailPrice : null);

  // 5. Calculate Retailer Margin Percent
  let retailerMarginPercent: number | null = null;
  let retailerMarginStatus: "normal" | "caution" | "warning" | "none" = "none";

  if (wholesalePrice !== null && retailPrice !== null && retailPrice > 0 && wholesalePrice < retailPrice) {
    const marginRatio = (retailPrice - wholesalePrice) / retailPrice;
    const calcMargin = marginRatio * 100;
    if (Number.isFinite(calcMargin) && !Number.isNaN(calcMargin) && calcMargin >= 0 && calcMargin <= 100) {
      retailerMarginPercent = Math.round(calcMargin * 10) / 10;
      if (retailerMarginPercent >= 50) {
        retailerMarginStatus = "normal";
      } else if (retailerMarginPercent >= 40) {
        retailerMarginStatus = "caution";
      } else {
        retailerMarginStatus = "warning";
      }
    }
  }

  const isWholesaleValid = wholesalePrice !== null && wholesalePrice > 0;
  const isRetailValid = retailPrice !== null && retailPrice > 0;
  const isMarginValid = retailerMarginPercent !== null;

  // 6. Formatted strings for safe display
  const formattedWholesale = isWholesaleValid ? `$${wholesalePrice!.toFixed(2)}` : "Price Missing";
  const formattedRetail = isRetailValid ? `$${retailPrice!.toFixed(2)}` : "—";
  const formattedMargin = isMarginValid ? `${retailerMarginPercent!.toFixed(1)}%` : "—";

  return {
    wholesalePrice,
    baseWholesalePrice,
    promoWholesalePrice,
    hasActivePromo,
    retailPrice,
    mapPrice,
    retailerMarginPercent,
    retailerMarginStatus,
    formattedWholesale,
    formattedRetail,
    formattedMargin,
    isWholesaleValid,
    isRetailValid,
    isMarginValid,
  };
}
