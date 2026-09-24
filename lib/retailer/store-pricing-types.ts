/**
 * Centralized Physical Price Tag Dimensions configuration (standard 2.25" x 1.25" / 57mm x 32mm shelf label)
 */
export const PHYSICAL_PRICE_TAG_DIMENSIONS = {
  widthInches: 2.25,
  heightInches: 1.25,
  widthMm: 57,
  heightMm: 32,
  labelName: 'Standard Shelf Fixture Tag (2.25" × 1.25")',
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
  wholesalePrice: number;
  msrp: number; // Suggested Retail Price guidance
  
  // Store Price info
  hasStorePrice: boolean;
  regularPrice: number | null;
  salePrice: number | null;
  saleStartDate: string | null;
  saleEndDate: string | null;
  discountPercent: number | null;
  isSaleActive: boolean;
  effectivePrice: number; // Active sale price or regular price or MSRP fallback
  priceBasis: "store_sale" | "store_regular" | "msrp";

  // QR info
  canonicalProductUrl: string;
  qrDataUrl: string | null;
  qrSvg: string | null;
}

export interface StorePricingDashboardData {
  companyId: string;
  userRole: string;
  canEditPrice: boolean;
  selectedStoreId: string;
  selectedStoreName: string;
  stores: Array<{ id: string; name: string }>;
  products: StoreProductTagItem[];
  totalAssortmentCount: number;
  pricedProductsCount: number;
  onSaleProductsCount: number;
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
