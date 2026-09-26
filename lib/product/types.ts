export type ProductCategory =
  | "skincare"
  | "hair_scalp"
  | "beauty_tools"
  | "daily_care"
  | "wellness_patch";

export const PRODUCT_CATEGORY_LABEL: Record<ProductCategory, string> = {
  skincare: "스킨케어",
  hair_scalp: "헤어&스칼프",
  beauty_tools: "뷰티소품·툴",
  daily_care: "데일리케어",
  wellness_patch: "웰니스·기능성패치",
};

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



