/**
 * Authoritative English Product Name Resolver
 * Standardized across all platforms (Admin Catalog, Admin Trading, Brand Portal, Retailer Portal, Cart, POs)
 * 
 * 1st Priority: Admin English Product Name Override (adminOverrides.name_en)
 * 2nd Priority: Brand-entered English Product Name (product.name_en || product.name)
 */
export function resolveProductName(product: any): string {
  if (!product) return "";
  const info = (product.price_additional_info as any) || {};
  const adminOverrides = info.admin_overrides || {};
  const tradingOverrides = info.trading_overrides || {};

  // 1st Priority: Admin Override
  const adminNameEn =
    adminOverrides.name_en?.trim() ||
    tradingOverrides.name_en?.trim() ||
    product.admin_override_name_en?.trim() ||
    product.adminOverrideNameEn?.trim();

  if (adminNameEn) {
    return adminNameEn;
  }

  // 2nd Priority: Brand-entered English Product Name
  const brandNameEn = product.name_en?.trim() || product.nameEn?.trim();
  if (brandNameEn) {
    return brandNameEn;
  }

  // Fallback to base name
  const baseName = product.name?.trim() || product.display_name?.trim() || product.displayName?.trim();
  return baseName || "";
}

/**
 * Resolves Retailer-facing Short Description
 * Admin location: Trading Products > Product Operations > Hub
 */
export function resolveShortDescription(product: any): string | null {
  if (!product) return null;
  const info = (product.price_additional_info as any) || {};
  const tradingOverrides = info.trading_overrides || {};
  const adminOverrides = info.admin_overrides || {};

  const shortDesc =
    tradingOverrides.short_description?.trim() ||
    info.short_description?.trim() ||
    adminOverrides.short_description?.trim() ||
    product.short_description?.trim() ||
    product.shortDescription?.trim();

  return shortDesc || null;
}
