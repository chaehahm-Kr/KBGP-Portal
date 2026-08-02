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
  | "other";

export const CERTIFICATE_TYPE_LABEL: Record<CertificateType, string> = {
  ingredient_certification: "성분 인증",
  trademark: "상표권",
  fda_registration: "FDA 등록",
  other: "기타",
};

export interface Product {
  id: string;
  brand_id: string;
  company_id: string;
  name: string;
  name_en?: string | null;
  category: string; // can be ProductCategory or string
  volume?: string | null;
  estimated_retail_price?: number | null;
  ingredients_text?: string | null;
  ingredients_file_path?: string | null;
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

