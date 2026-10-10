export { resolveProductName, resolveShortDescription } from "@/lib/product/name-resolver";

export type ProductCategory =
  | "skincare"
  | "hair_scalp"
  | "beauty_tools"
  | "daily_care"
  | "wellness_patch"
  | "other";

export const PRODUCT_CATEGORY_LABEL: Record<ProductCategory, string> = {
  skincare: "스킨케어",
  hair_scalp: "헤어&스칼프",
  beauty_tools: "뷰티소품·툴",
  daily_care: "데일리케어",
  wellness_patch: "웰니스·기능성패치",
  other: "기타",
};

/**
 * Authoritative mapping from UI ProductCategory enum to categories.code (FK target)
 */
export const CATEGORY_TO_CODE_MAP: Record<ProductCategory, string> = {
  skincare: "SKINCARE",
  hair_scalp: "HAIR_CARE",
  beauty_tools: "BEAUTY_TOOLS",
  daily_care: "BODY_CARE",
  wellness_patch: "PERSONAL_CARE",
  other: "OTHER",
};

/**
 * Reverse mapping from categories.code to UI ProductCategory enum
 */
export const CODE_TO_CATEGORY_MAP: Record<string, ProductCategory> = {
  SKINCARE: "skincare",
  HAIR_CARE: "hair_scalp",
  BEAUTY_TOOLS: "beauty_tools",
  BODY_CARE: "daily_care",
  PERSONAL_CARE: "wellness_patch",
  OTHER: "other",
  MAKEUP: "other",
  SETS_COLLECTIONS: "other",
};

/**
 * Resolves the authoritative categories.code for products.category_code FK.
 * Guarantees a valid uppercase category code referenced by public.categories (code) or null.
 */
export function resolveAuthoritativeCategoryCode(
  categoryOrCode: string | null | undefined
): string | null {
  if (!categoryOrCode || typeof categoryOrCode !== "string") return null;
  const trimmed = categoryOrCode.trim();
  if (!trimmed) return null;

  // 1. Direct match in CATEGORY_TO_CODE_MAP (e.g. "skincare" -> "SKINCARE")
  if (trimmed in CATEGORY_TO_CODE_MAP) {
    return CATEGORY_TO_CODE_MAP[trimmed as ProductCategory];
  }

  const lower = trimmed.toLowerCase();
  if (lower in CATEGORY_TO_CODE_MAP) {
    return CATEGORY_TO_CODE_MAP[lower as ProductCategory];
  }

  // 2. Korean category name match
  if (trimmed === "스킨케어") return "SKINCARE";
  if (trimmed === "헤어케어" || trimmed === "헤어&스칼프" || trimmed === "헤어") return "HAIR_CARE";
  if (trimmed === "바디케어" || trimmed === "데일리케어") return "BODY_CARE";
  if (trimmed === "뷰티툴" || trimmed === "뷰티소품·툴") return "BEAUTY_TOOLS";
  if (trimmed === "퍼스널케어" || trimmed === "웰니스·기능성패치") return "PERSONAL_CARE";
  if (trimmed === "메이크업") return "MAKEUP";
  if (trimmed === "세트/기획" || trimmed === "세트") return "SETS_COLLECTIONS";
  if (trimmed === "기타") return "OTHER";

  // 3. Known uppercase code or standard code pattern
  const upper = trimmed.toUpperCase();
  if (upper in CODE_TO_CATEGORY_MAP) {
    return upper;
  }

  if (/^[A-Z0-9_]+$/.test(upper)) {
    return upper;
  }

  return "OTHER";
}

export type CertificateType =
  | "ingredient_certification"
  | "trademark"
  | "fda_registration"
  | "patent"
  | "other";

export const CERTIFICATE_TYPE_LABEL: Record<CertificateType, string> = {
  ingredient_certification: "성분 인증",
  trademark: "상표권",
  fda_registration: "FDA 등록",
  patent: "특허",
  other: "기타",
};

export interface Product {
  id: string;
  brand_id: string;
  company_id: string;
  name: string;
  name_en?: string | null;
  category: string; // can be ProductCategory or string
  category_code?: string | null;
  volume?: string | null;
  estimated_retail_price?: number | null;
  ingredients_text?: string | null;
  ingredients_file_path?: string | null;
  ingredients_file_path_en?: string | null;
  status: "registered" | "selling" | "discontinued";
  created_at: string;
  updated_at: string;

  // New fields
  description?: string | null;
  how_to_use?: string | null;
  bullet_points?: string[] | null;
  color?: string | null;
  color_map?: string | null;
  origin?: string | null;
  lead_time?: string | null;

  // SKU
  parent_sku?: string | null;
  child_sku?: string | null;
  manufacture_sku?: string | null;
  letusto_sku?: string | null;
  upc?: string | null;
  ean?: string | null;

  // Prices
  price_krw_retail?: number | null;
  price_krw_wholesale?: number | null;
  price_usd_fob?: number | null;
  price_additional_info?: Record<string, any> | null;

  // Logistics: Item
  item_width?: number | null;
  item_depth?: number | null;
  item_height?: number | null;
  item_weight?: number | null;

  // Logistics: Package
  package_width?: number | null;
  package_depth?: number | null;
  package_height?: number | null;
  package_weight?: number | null;

  // Logistics: Carton
  carton_pack_qty?: number | null;
  carton_width?: number | null;
  carton_depth?: number | null;
  carton_height?: number | null;
  carton_weight?: number | null;
  carton_cbm?: number | null;

  // Logistics: Palette
  palette_carton_qty?: number | null;
  palette_width?: number | null;
  palette_depth?: number | null;
  palette_height?: number | null;
  palette_weight?: number | null;

  // Logistics: Container Loading
  container_20ft_qty?: number | null;
  container_20ft_weight?: number | null;
  container_20ft_cbm?: number | null;
  container_40fthc_qty?: number | null;
  container_40fthc_weight?: number | null;
  container_40fthc_cbm?: number | null;

  // New Selling Fields
  selling_online?: boolean;
  selling_offline?: boolean;
  sales_link_1?: string | null;
  sales_link_2?: string | null;
  selection_status?: string | null;
  sales_status?: string | null;
  trading_status?: string | null;
  retailer_visibility?: "visible" | "hidden" | string | null;
  deleted_at?: string | null;
  last_updated_by_name?: string | null;
  last_updated_source?: string | null;
  last_updated_by_id?: string | null;
}

export interface ProductVideo {
  id: string;
  product_id: string;
  company_id: string;
  storage_path?: string | null;
  video_url?: string | null;
  position: number;
  created_at: string;
}

export function sanitizeSku(val: string): string {
  // Convert to uppercase
  let cleaned = val.toUpperCase();
  // Allow only A-Z, 0-9, -, _ (Prohibit other special characters & spaces)
  cleaned = cleaned.replace(/[^A-Z0-9\-_]/g, "");
  // Block consecutive separators
  cleaned = cleaned.replace(/[\-_]{2,}/g, (match) => match[match.length - 1]);
  // Prevent leading separator
  cleaned = cleaned.replace(/^[\-_]/g, "");
  return cleaned;
}

export function trimSkuSeparators(val: string): string {
  return val.replace(/^[\-_]+|[\-_]+$/g, "");
}

export function isDraftPlaceholderSku(sku?: string | null): boolean {
  if (!sku) return false;
  return sku.trim().startsWith("DRAFT-SKU-");
}

export function isDraftPlaceholderName(name?: string | null): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  return trimmed === "[임시저장] 신규 제품" || trimmed.startsWith("[임시저장]");
}

export function cleanPlaceholderSku(sku?: string | null): string | null {
  if (!sku || isDraftPlaceholderSku(sku)) return null;
  return sku.trim();
}

export function cleanPlaceholderName(name?: string | null): string | null {
  if (!name || isDraftPlaceholderName(name)) return null;
  return name.trim();
}

/**
 * Single Source of Truth helper for resolving effective SKU:
 * Effective Value = Admin Override (if non-empty string and not draft placeholder) ?? Product Base Value (if non-empty string and not draft placeholder) ?? null
 */
export function resolveEffectiveSku(
  overrideValue?: string | null,
  baseValue?: string | null
): string | null {
  if (overrideValue && typeof overrideValue === "string" && overrideValue.trim() !== "" && !isDraftPlaceholderSku(overrideValue)) {
    return overrideValue.trim();
  }
  if (baseValue && typeof baseValue === "string" && baseValue.trim() !== "" && !isDraftPlaceholderSku(baseValue)) {
    return baseValue.trim();
  }
  return null;
}

export const VOLUME_UNITS = [
  { value: "ml", label: "ml" },
  { value: "L", label: "L" },
  { value: "g", label: "g" },
  { value: "kg", label: "kg" },
  { value: "mg", label: "mg" },
  { value: "oz", label: "oz" },
  { value: "fl oz", label: "fl oz" },
  { value: "ea / pcs", label: "ea / pcs" },
  { value: "Other", label: "기타 (Other)" },
] as const;

export type VolumeUnit = (typeof VOLUME_UNITS)[number]["value"];

export interface ParsedVolume {
  value: string;
  unit: VolumeUnit;
}

export function parseVolume(volumeStr?: string | null): ParsedVolume {
  if (!volumeStr || !volumeStr.trim()) {
    return { value: "", unit: "ml" };
  }
  const trimmed = volumeStr.trim();

  // Match number (including decimals) followed by unit
  const match = trimmed.match(/^([\d.,]+)\s*(fl[\.\s]*oz|floz|ea\s*\/\s*pcs|ea|pcs|ml|mg|kg|g|l|oz)$/i);
  if (match) {
    const val = match[1];
    const u = match[2].toLowerCase().replace(/\s+/g, " ").trim();
    if (u.includes("fl") && u.includes("oz")) {
      return { value: val, unit: "fl oz" };
    }
    if (u === "ea" || u === "pcs" || u.includes("ea") || u.includes("pcs")) {
      return { value: val, unit: "ea / pcs" };
    }
    if (u === "ml") return { value: val, unit: "ml" };
    if (u === "l") return { value: val, unit: "L" };
    if (u === "g") return { value: val, unit: "g" };
    if (u === "kg") return { value: val, unit: "kg" };
    if (u === "mg") return { value: val, unit: "mg" };
    if (u === "oz") return { value: val, unit: "oz" };
  }

  // If it does not match a standard single number+unit, treat as "Other"
  return { value: trimmed, unit: "Other" };
}

export function formatVolume(value: string, unit: VolumeUnit): string {
  const v = value.trim();
  if (!v) return "";
  if (unit === "Other") return v;
  return `${v} ${unit}`;
}

export type LeadTimeUnit = "일" | "주" | "개월";

export interface ParsedLeadTime {
  value: string;
  unit: LeadTimeUnit;
}

export function parseLeadTime(leadTimeStr?: string | null): ParsedLeadTime {
  if (!leadTimeStr || !leadTimeStr.trim()) {
    return { value: "", unit: "일" };
  }
  const match = leadTimeStr.trim().match(/^(\d+)\s*(일|주|개월|days|weeks|months|day|week|month)?$/i);
  if (match) {
    const val = match[1];
    let unit: "일" | "주" | "개월" = "일";
    const rawUnit = match[2] || "일";
    if (rawUnit.toLowerCase().startsWith("day") || rawUnit === "일") unit = "일";
    else if (rawUnit.toLowerCase().startsWith("week") || rawUnit === "주") unit = "주";
    else if (rawUnit.toLowerCase().startsWith("month") || rawUnit === "개월") unit = "개월";
    return { value: val, unit };
  }
  return { value: leadTimeStr.trim(), unit: "일" };
}

/**
 * Resolves root category code (e.g. "SKINCARE", "BODY_CARE", "HAIR_CARE", etc.)
 * from any category code (1Depth, 2Depth, or 3Depth).
 */
export function resolveRootCategoryCode(categoryCode: string | null | undefined): string {
  if (!categoryCode || typeof categoryCode !== "string") return "OTHER";
  const upper = categoryCode.trim().toUpperCase();
  if (!upper) return "OTHER";

  if (upper === "SKINCARE" || upper.startsWith("SK_")) return "SKINCARE";
  if (upper === "HAIR_CARE" || upper.startsWith("HC_") || upper.startsWith("HR_")) return "HAIR_CARE";
  if (upper === "BODY_CARE" || upper.startsWith("BC_") || upper.startsWith("BD_")) return "BODY_CARE";
  if (upper === "BEAUTY_TOOLS" || upper.startsWith("BT_") || upper.startsWith("TL_")) return "BEAUTY_TOOLS";
  if (upper === "PERSONAL_CARE" || upper.startsWith("PC_")) return "PERSONAL_CARE";
  if (upper === "MAKEUP" || upper.startsWith("MU_")) return "MAKEUP";
  if (upper === "SETS_COLLECTIONS" || upper.startsWith("SET_") || upper.startsWith("SETS_") || upper.startsWith("ST_")) return "SETS_COLLECTIONS";
  if (upper === "OTHER") return "OTHER";

  // Check mapped category enum values (e.g. "daily_care" -> "BODY_CARE")
  if (upper.toLowerCase() in CATEGORY_TO_CODE_MAP) {
    return CATEGORY_TO_CODE_MAP[upper.toLowerCase() as ProductCategory];
  }

  return "OTHER";
}

/**
 * Resolves the 1Depth Korean Category Label for display (e.g., "스킨케어", "바디케어", "헤어&스칼프", etc.)
 */
export function resolveRootCategoryLabel(
  categoryCode: string | null | undefined,
  fallbackCategory?: string | null
): string {
  const rootCode = resolveRootCategoryCode(categoryCode);
  if (rootCode === "SKINCARE") return "스킨케어";
  if (rootCode === "HAIR_CARE") return "헤어&스칼프";
  if (rootCode === "BODY_CARE") return "바디케어";
  if (rootCode === "BEAUTY_TOOLS") return "뷰티툴";
  if (rootCode === "PERSONAL_CARE") return "퍼스널케어";
  if (rootCode === "MAKEUP") return "메이크업";
  if (rootCode === "SETS_COLLECTIONS") return "세트/기획";
  if (rootCode === "OTHER") {
    if (fallbackCategory && fallbackCategory in PRODUCT_CATEGORY_LABEL) {
      return PRODUCT_CATEGORY_LABEL[fallbackCategory as ProductCategory];
    }
    return "기타";
  }

  if (fallbackCategory && fallbackCategory in PRODUCT_CATEGORY_LABEL) {
    return PRODUCT_CATEGORY_LABEL[fallbackCategory as ProductCategory];
  }

  return "기타";
}

/**
 * Resolves the DB ProductCategory enum value from category code.
 */
export function resolveRootCategoryEnum(categoryCode: string | null | undefined): ProductCategory {
  const rootCode = resolveRootCategoryCode(categoryCode);
  if (rootCode in CODE_TO_CATEGORY_MAP) {
    return CODE_TO_CATEGORY_MAP[rootCode];
  }
  return "other";
}
