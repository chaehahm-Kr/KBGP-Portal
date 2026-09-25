// Single Source of Truth for Product Statuses across Admin and Brand Portal

export type SelectionStatus =
  | "UNREVIEWED"
  | "UNDER_REVIEW"
  | "INFO_REQUESTED"
  | "SELECTED"
  | "NOT_SELECTED";

export type SalesStatus =
  | "PREPARING"
  | "ON_SALE"
  | "PAUSED"
  | "ENDED";

export type RegistrationStatus = "COMPLETE" | "DRAFT" | "DELETED";

export const SELECTION_STATUS_LABELS: Record<SelectionStatus, string> = {
  UNREVIEWED: "미검토",
  UNDER_REVIEW: "검토 중",
  INFO_REQUESTED: "정보 요청",
  SELECTED: "선정",
  NOT_SELECTED: "미선정",
};

export const SELECTION_STATUS_STYLES: Record<SelectionStatus, { bg: string; text: string; border: string }> = {
  UNREVIEWED: {
    bg: "bg-zinc-100 dark:bg-zinc-850",
    text: "text-zinc-700 dark:text-zinc-300",
    border: "border-zinc-200 dark:border-zinc-700",
  },
  UNDER_REVIEW: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800/60",
  },
  INFO_REQUESTED: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800/60",
  },
  SELECTED: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800/60",
  },
  NOT_SELECTED: {
    bg: "bg-rose-50 dark:bg-rose-950/30",
    text: "text-rose-700 dark:text-rose-400",
    border: "border-rose-200 dark:border-rose-800/60",
  },
};

export const SALES_STATUS_LABELS: Record<SalesStatus, string> = {
  PREPARING: "판매 준비",
  ON_SALE: "판매 중",
  PAUSED: "일시 중지",
  ENDED: "판매 종료",
};

export const SALES_STATUS_STYLES: Record<SalesStatus, { bg: string; text: string; border: string }> = {
  PREPARING: {
    bg: "bg-zinc-100 dark:bg-zinc-850",
    text: "text-zinc-700 dark:text-zinc-300",
    border: "border-zinc-200 dark:border-zinc-700",
  },
  ON_SALE: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800/60",
  },
  PAUSED: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800/60",
  },
  ENDED: {
    bg: "bg-zinc-200 dark:bg-zinc-800",
    text: "text-zinc-600 dark:text-zinc-400",
    border: "border-zinc-300 dark:border-zinc-700",
  },
};

export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  COMPLETE: "등록 완료",
  DRAFT: "Draft (보완 대기)",
  DELETED: "Deleted (삭제됨)",
};

export const REGISTRATION_STATUS_STYLES: Record<RegistrationStatus, { bg: string; text: string; border: string }> = {
  COMPLETE: {
    bg: "bg-emerald-50 dark:bg-emerald-950/20",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-900/50",
  },
  DRAFT: {
    bg: "bg-rose-50 dark:bg-rose-950/20",
    text: "text-rose-700 dark:text-rose-400",
    border: "border-rose-200 dark:border-rose-900/50",
  },
  DELETED: {
    bg: "bg-zinc-100 dark:bg-zinc-800",
    text: "text-zinc-500 dark:text-zinc-400",
    border: "border-zinc-200 dark:border-zinc-700",
  },
};

export interface ProductRegistrationEvaluationInput {
  id?: string;
  name?: string | null;
  name_en?: string | null;
  brand_id?: string | null;
  category_code?: string | null;
  manufacture_sku?: string | null;
  origin?: string | null;
  price_krw_retail?: number | string | null;
  price_usd_fob?: number | string | null;
  item_width?: number | string | null;
  item_depth?: number | string | null;
  item_height?: number | string | null;
  item_weight?: number | string | null;
  package_width?: number | string | null;
  package_depth?: number | string | null;
  package_height?: number | string | null;
  package_weight?: number | string | null;
  carton_pack_qty?: number | string | null;
  carton_width?: number | string | null;
  carton_depth?: number | string | null;
  carton_height?: number | string | null;
  carton_weight?: number | string | null;
  upc?: string | null;
  ean?: string | null;
  selling_online?: boolean | null;
  sales_link_1?: string | null;
  deleted_at?: string | null;
  adminOverrides?: Record<string, any> | null;
  hasImages: boolean;
  categoryCompletion?: {
    categoryComplete: boolean;
    requiredAttributesComplete: boolean;
    missingRequiredAttributes?: { code: string; nameKo: string }[];
  } | null;
}

export interface ProductRegistrationEvaluationResult {
  isDraft: boolean;
  isDeleted: boolean;
  status: RegistrationStatus;
  statusLabel: string;
  missingFields: string[];
}

function safeString(val: any): string {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

/**
 * Unified evaluator for product registration completeness.
 * Strictly checks required fields across Basic Info, Category & Attributes, Price Info, Logistics (Item, Package, Carton), and Media.
 */
export function evaluateProductRegistrationStatus(
  input: ProductRegistrationEvaluationInput
): ProductRegistrationEvaluationResult {
  if (input.deleted_at) {
    return {
      isDraft: false,
      isDeleted: true,
      status: "DELETED",
      statusLabel: REGISTRATION_STATUS_LABELS.DELETED,
      missingFields: [],
    };
  }

  const overrides = input.adminOverrides || {};

  const effectiveBrandId = overrides.brand_id !== undefined && overrides.brand_id !== null ? overrides.brand_id : input.brand_id;
  const effectiveNameEn = safeString(overrides.name_en !== undefined && overrides.name_en !== null ? overrides.name_en : input.name_en);
  const effectiveManufactureSku = safeString(overrides.manufacture_sku !== undefined && overrides.manufacture_sku !== null ? overrides.manufacture_sku : input.manufacture_sku);
  const effectiveOrigin = safeString(overrides.origin !== undefined && overrides.origin !== null ? overrides.origin : input.origin);
  const effectivePriceKrw = overrides.price_krw_retail !== undefined && overrides.price_krw_retail !== null ? Number(overrides.price_krw_retail) : Number(input.price_krw_retail || 0);
  const effectivePriceUsd = overrides.price_usd_fob !== undefined && overrides.price_usd_fob !== null ? Number(overrides.price_usd_fob) : Number(input.price_usd_fob || 0);
  const effectiveUpc = safeString(overrides.upc !== undefined && overrides.upc !== null ? overrides.upc : input.upc);
  const effectiveEan = safeString(overrides.ean !== undefined && overrides.ean !== null ? overrides.ean : input.ean);

  const itemW = overrides.item_width !== undefined && overrides.item_width !== null ? Number(overrides.item_width) : Number(input.item_width || 0);
  const itemD = overrides.item_depth !== undefined && overrides.item_depth !== null ? Number(overrides.item_depth) : Number(input.item_depth || 0);
  const itemH = overrides.item_height !== undefined && overrides.item_height !== null ? Number(overrides.item_height) : Number(input.item_height || 0);
  const itemWt = overrides.item_weight !== undefined && overrides.item_weight !== null ? Number(overrides.item_weight) : Number(input.item_weight || 0);

  const pkgW = overrides.package_width !== undefined && overrides.package_width !== null ? Number(overrides.package_width) : Number(input.package_width || 0);
  const pkgD = overrides.package_depth !== undefined && overrides.package_depth !== null ? Number(overrides.package_depth) : Number(input.package_depth || 0);
  const pkgH = overrides.package_height !== undefined && overrides.package_height !== null ? Number(overrides.package_height) : Number(input.package_height || 0);
  const pkgWt = overrides.package_weight !== undefined && overrides.package_weight !== null ? Number(overrides.package_weight) : Number(input.package_weight || 0);

  const cartonQty = overrides.carton_pack_qty !== undefined && overrides.carton_pack_qty !== null ? Number(overrides.carton_pack_qty) : Number(input.carton_pack_qty || 0);
  const cartonW = overrides.carton_width !== undefined && overrides.carton_width !== null ? Number(overrides.carton_width) : Number(input.carton_width || 0);
  const cartonD = overrides.carton_depth !== undefined && overrides.carton_depth !== null ? Number(overrides.carton_depth) : Number(input.carton_depth || 0);
  const cartonH = overrides.carton_height !== undefined && overrides.carton_height !== null ? Number(overrides.carton_height) : Number(input.carton_height || 0);
  const cartonWt = overrides.carton_weight !== undefined && overrides.carton_weight !== null ? Number(overrides.carton_weight) : Number(input.carton_weight || 0);

  const missingFields: string[] = [];

  // 1. Brand
  if (!effectiveBrandId) {
    missingFields.push("브랜드");
  }

  // 2. Category & Dynamic Required Attributes
  if (input.categoryCompletion) {
    if (!input.categoryCompletion.categoryComplete) {
      missingFields.push("카테고리");
    } else if (!input.categoryCompletion.requiredAttributesComplete) {
      missingFields.push("카테고리 필수 속성");
    }
  } else {
    if (!input.category_code) {
      missingFields.push("카테고리");
    }
  }

  // 3. Name (English / Display)
  if (!effectiveNameEn || effectiveNameEn === "[임시저장] 신규 제품") {
    missingFields.push("영문 제품명");
  }

  // 4. Manufacture SKU
  if (!effectiveManufactureSku || effectiveManufactureSku.startsWith("DRAFT-SKU-")) {
    missingFields.push("제조사 SKU");
  }

  // 5. Origin
  if (!effectiveOrigin) {
    missingFields.push("원산지");
  }

  // 6. Pricing (Retail KRW & FOB USD)
  if (effectivePriceKrw <= 0) {
    missingFields.push("소비자 판매가");
  }
  if (effectivePriceUsd <= 0) {
    missingFields.push("FOB 수출 가격");
  }

  // 7. Logistics Specifications (A. Item Spec, B. Package Spec, C. Carton Spec)
  if (itemW <= 0 || itemD <= 0 || itemH <= 0 || itemWt <= 0) {
    missingFields.push("단품 규격");
  }
  if (pkgW <= 0 || pkgD <= 0 || pkgH <= 0 || pkgWt <= 0) {
    missingFields.push("단품 포장 패키지 규격");
  }
  if (cartonQty <= 0 || cartonW <= 0 || cartonD <= 0 || cartonH <= 0 || cartonWt <= 0) {
    missingFields.push("아웃 카톤 규격");
  }

  // 8. Barcode (UPC or EAN)
  if (!effectiveUpc && !effectiveEan) {
    missingFields.push("식별 바코드(UPC 또는 EAN)");
  }

  // 9. Online sales link if selling online
  if (input.selling_online && !safeString(input.sales_link_1)) {
    missingFields.push("온라인 판매 링크");
  }

  // 10. Representative Image
  if (!input.hasImages) {
    missingFields.push("대표 이미지");
  }

  const isDraft = missingFields.length > 0;

  return {
    isDraft,
    isDeleted: false,
    status: isDraft ? "DRAFT" : "COMPLETE",
    statusLabel: isDraft ? REGISTRATION_STATUS_LABELS.DRAFT : REGISTRATION_STATUS_LABELS.COMPLETE,
    missingFields,
  };
}
