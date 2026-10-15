/**
 * Centralized Physical Price Tag Dimensions configuration (standard 50mm x 30mm NIIMBOT B1 shelf label)
 */
export const PHYSICAL_PRICE_TAG_DIMENSIONS = {
  widthMm: 50,
  heightMm: 30,
  widthInches: 1.97,
  heightInches: 1.18,
  dpi: 203,
  dotsPerMm: 8,
  pixelWidth: 384, // Printable width on NIIMBOT B1 / 50mm direct thermal (400 dots total, 384 printable)
  pixelHeight: 240, // Printable height on NIIMBOT B1 / 30mm direct thermal (240 dots)
  labelName: "Standard Shelf Fixture Tag (50mm × 30mm) / NIIMBOT B1",
};

export interface StoreProductPriceRecord {
  id?: string;
  companyId: string;
  storeId: string;
  productId: string;
  regularPrice: number;
  salePrice: number | null;
  saleStartDate: string | null;
  saleEndDate: string | null;
  discountPercent: number | null;
  isSaleActive: boolean;
  effectivePrice: number;
  currency: string;
  updatedAt: string | null;
}

export interface StorePriceBreakdownItem {
  storeId: string;
  storeName: string;
  regularPrice: number | null;
  salePrice: number | null;
  discountPercent: number | null;
  isSaleActive: boolean;
  hasStorePrice: boolean;
  isMsrpDefault?: boolean;
  effectivePrice: number;
  priceBasis: "store_sale" | "store_regular" | "msrp";
  regularGrossProfit: number | null;
  regularGrossMarginPercent: number | null;
  saleGrossProfit: number | null;
  saleGrossMarginPercent: number | null;
}

export interface StoreProductTagItem {
  productId: string;
  productName: string;
  productNameEn: string | null;
  brandName: string;
  brandId: string;
  sku: string;
  thumbnailUrl: string | null;
  category: string;
  categoryLabel: string;
  cartonPackQty: number;

  // Wholesale Cost & Source Attribution
  wholesalePrice: number | null; // Suppressed (null) for employee role to protect wholesale pricing
  wholesaleCostSource?: "invoice" | "order" | "curation" | "none";
  wholesaleCostLabel?: string | null; // e.g. "Last Purchase: $4.75"

  msrp: number; // Suggested Retail Price guidance (> 0)
  hasMsrp: boolean;

  // Store Price info (Single Store or Primary View)
  hasStorePrice: boolean; // True if explicit store price record exists in DB
  isMsrpDefault?: boolean; // True if regularPrice is automatically initialized from MSRP
  regularPrice: number | null; // Effective regular price (Store Override or MSRP Default, or null if neither)
  salePrice: number | null;
  saleStartDate: string | null;
  saleEndDate: string | null;
  discountPercent: number | null;
  isSaleActive: boolean;
  effectivePrice: number; // Active sale price, regular store price, or MSRP fallback
  priceBasis: "store_sale" | "store_regular" | "msrp";

  // Profitability (Unit-level merchandise margin)
  regularGrossProfit: number | null;
  regularGrossMarginPercent: number | null;
  saleGrossProfit: number | null;
  saleGrossMarginPercent: number | null;

  // All Stores Breakdown
  storeBreakdowns?: StorePriceBreakdownItem[];
  storesAvailableCount?: number;

  // Product Eligibility & Fulfillment Status
  tagStatus: "in_stock" | "incoming";

  // QR info
  canonicalProductUrl: string;
  qrDataUrl: string | null;
  qrSvg: string | null;
}

export interface StorePricingDashboardData {
  companyId: string;
  userRole: string;
  canEditPrice: boolean;
  isAllStores: boolean;
  selectedStoreId: string; // "all" or specific store UUID
  selectedStoreName: string;
  stores: Array<{ id: string; name: string }>;
  products: StoreProductTagItem[];
  totalAssortmentCount: number;
  pricedProductsCount: number;
  storeOverrideCount?: number;
  msrpDefaultCount?: number;
  onSaleProductsCount: number;
  incomingProductsCount: number;
  unpricedProductsCount: number;
}

/**
 * Calculate discount percentage safely
 */
export function calculateDiscountPercent(regularPrice: number, salePrice: number | null): number | null {
  if (!salePrice || salePrice <= 0 || regularPrice <= 0 || salePrice >= regularPrice) {
    return null;
  }
  return Math.round(((regularPrice - salePrice) / regularPrice) * 100);
}

/**
 * Determine whether a sale price is currently within active date window
 */
export function isSalePriceActive(
  salePrice: number | null,
  saleStartDate: string | null,
  saleEndDate: string | null,
  currentDate: Date = new Date()
): boolean {
  if (!salePrice || salePrice <= 0) return false;
  const todayStr = currentDate.toISOString().split("T")[0];
  if (saleStartDate && todayStr < saleStartDate) return false;
  if (saleEndDate && todayStr > saleEndDate) return false;
  return true;
}

/**
 * Calculate Unit-Level Gross Profit and Gross Margin Percentage
 * Gross Profit = Selling Price - Wholesale Cost
 * Gross Margin % = (Gross Profit / Selling Price) * 100
 * Denominator is strictly Selling Price (NOT cost, NOT markup)
 */
export function calculateGrossProfitMetrics(
  sellingPrice: number | null,
  wholesaleCost: number | null
): { grossProfit: number | null; grossMarginPercent: number | null } {
  if (
    sellingPrice === null ||
    sellingPrice === undefined ||
    sellingPrice <= 0 ||
    wholesaleCost === null ||
    wholesaleCost === undefined ||
    wholesaleCost <= 0
  ) {
    return { grossProfit: null, grossMarginPercent: null };
  }

  const grossProfit = Number((sellingPrice - wholesaleCost).toFixed(2));
  const grossMarginPercent = Number(((grossProfit / sellingPrice) * 100).toFixed(1));

  return { grossProfit, grossMarginPercent };
}
