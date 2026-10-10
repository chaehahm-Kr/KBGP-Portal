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

export type TradingStatus = "active" | "inactive" | "historical";

export type RetailerVisibility = "visible" | "hidden";

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

export const TRADING_STATUS_LABELS: Record<TradingStatus, string> = {
  active: "운영 중",
  inactive: "운영 중지",
  historical: "운영 종료",
};

export const TRADING_STATUS_STYLES: Record<TradingStatus, { bg: string; text: string; border: string }> = {
  active: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800/60",
  },
  inactive: {
    bg: "bg-zinc-100 dark:bg-zinc-850",
    text: "text-zinc-700 dark:text-zinc-400",
    border: "border-zinc-200 dark:border-zinc-700",
  },
  historical: {
    bg: "bg-zinc-200 dark:bg-zinc-800",
    text: "text-zinc-600 dark:text-zinc-400",
    border: "border-zinc-300 dark:border-zinc-700",
  },
};

export const RETAILER_VISIBILITY_LABELS: Record<RetailerVisibility, string> = {
  visible: "노출",
  hidden: "비노출",
};

export const RETAILER_VISIBILITY_STYLES: Record<RetailerVisibility, { bg: string; text: string; border: string }> = {
  visible: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800/60",
  },
  hidden: {
    bg: "bg-zinc-100 dark:bg-zinc-850",
    text: "text-zinc-500 dark:text-zinc-400",
    border: "border-zinc-200 dark:border-zinc-700",
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

export function mapSalesStatusToTradingStatus(salesStatus: SalesStatus | string | null | undefined): TradingStatus {
  switch (salesStatus) {
    case "ON_SALE":
      return "active";
    case "ENDED":
      return "historical";
    case "PAUSED":
    case "PREPARING":
    default:
      return "inactive";
  }
}

export function isValidStatusVisibilityCombination(tradingStatus: TradingStatus, visibility: RetailerVisibility): boolean {
  if (visibility === "visible") {
    return tradingStatus === "active";
  }
  return true;
}

export function sanitizeTradingAndVisibility(
  tradingStatus: TradingStatus | string | null | undefined,
  visibility: RetailerVisibility | string | null | undefined
): { tradingStatus: TradingStatus; visibility: RetailerVisibility } {
  let tStatus: TradingStatus = "inactive";
  if (tradingStatus === "active" || tradingStatus === "historical" || tradingStatus === "inactive") {
    tStatus = tradingStatus;
  }
  let vStatus: RetailerVisibility = "hidden";
  if (visibility === "visible" && tStatus === "active") {
    vStatus = "visible";
  }
  return { tradingStatus: tStatus, visibility: vStatus };
}

export interface OrderabilityEvaluation {
  isOrderable: boolean;
  reason: string | null;
  reasons: string[];
}

/**
 * Authoritative Server-side Orderability Evaluator
 * Accumulates all active blocking reasons.
 */
export function evaluateTradingOrderability(params: {
  registrationStatus?: string | null;
  selectionStatus: string | null | undefined;
  tradingStatus: string | null | undefined;
  retailerVisibility: string | null | undefined;
  isPricingActive: boolean;
  wholesalePrice: number;
  cartonPackQty?: number | null;
  availableStock?: number | null;
}): OrderabilityEvaluation {
  const reasons: string[] = [];

  if (params.registrationStatus && params.registrationStatus !== "COMPLETE") {
    reasons.push("등록 미완료");
  }
  if (params.selectionStatus !== "SELECTED") {
    reasons.push("미선정 상품");
  }
  if (params.tradingStatus !== "active") {
    reasons.push(params.tradingStatus === "historical" ? "운영 종료 상품" : "운영 중지 상품");
  }
  if (params.retailerVisibility !== "visible") {
    reasons.push("Hub 비노출");
  }
  if (!params.isPricingActive) {
    reasons.push("가격 비활성화");
  }
  if (!params.wholesalePrice || params.wholesalePrice <= 0) {
    reasons.push("도매가 미입력");
  }
  const pack = params.cartonPackQty ?? 1;
  if (pack < 1) {
    reasons.push("MOQ 미설정");
  }
  if (params.availableStock !== undefined && params.availableStock !== null && params.availableStock <= 0) {
    reasons.push("판매 가능 재고 없음");
  }

  return {
    isOrderable: reasons.length === 0,
    reason: reasons.length > 0 ? reasons[0] : null,
    reasons,
  };
}

export interface CategoryMissingStep {
  code: "cat1" | "cat2" | "cat3";
  label: string;
  targetId: string;
}

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
  how_to_use?: string | null;
  adminOverrides?: Record<string, any> | null;
  hasImages: boolean;
  categoryCompletion?: {
    categoryComplete: boolean;
    categoryMissingStep?: CategoryMissingStep | null;
    requiredAttributesComplete: boolean;
    missingRequiredAttributes?: { code: string; nameKo: string }[];
  } | null;
}

export interface MissingFieldItem {
  key: string;
  section: string;
  label: string;
  displayTag: string;
  tab: "basic" | "category_attributes" | "price" | "logistics" | "media" | "certs";
  targetId: string;
  inputName?: string;
}

export interface ProductRegistrationEvaluationResult {
  isDraft: boolean;
  isDeleted: boolean;
  status: RegistrationStatus;
  statusLabel: string;
  missingFields: string[];
  missingFieldItems: MissingFieldItem[];
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
      missingFieldItems: [],
    };
  }

  const overrides = input.adminOverrides || {};

  const effectiveBrandId = overrides.brand_id !== undefined && overrides.brand_id !== null ? overrides.brand_id : input.brand_id;
  const effectiveNameEn = safeString(overrides.name_en !== undefined && overrides.name_en !== null ? overrides.name_en : input.name_en);
  const effectiveManufactureSku = safeString(overrides.manufacture_sku !== undefined && overrides.manufacture_sku !== null ? overrides.manufacture_sku : input.manufacture_sku);
  const effectiveOrigin = safeString(overrides.origin !== undefined && overrides.origin !== null ? overrides.origin : input.origin);
  const effectiveHowToUse = safeString(overrides.how_to_use !== undefined && overrides.how_to_use !== null ? overrides.how_to_use : input.how_to_use);
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
  const missingFieldItems: MissingFieldItem[] = [];

  // 1. Brand
  if (!effectiveBrandId) {
    missingItemsPush({
      key: "brand_id",
      section: "기본 정보",
      label: "브랜드",
      displayTag: "[기본 정보: 브랜드]",
      tab: "basic",
      targetId: "brandId-field",
      inputName: "brandId",
    });
  }

  // 2. Category & Dynamic Required Attributes
  if (input.categoryCompletion) {
    if (!input.categoryCompletion.categoryComplete) {
      const step = input.categoryCompletion.categoryMissingStep;
      const stepLabel = step ? step.label : "카테고리 지정";
      const targetId = step ? step.targetId : "category-depth-1";
      missingItemsPush({
        key: "category_step",
        section: "카테고리 및 속성",
        label: stepLabel,
        displayTag: `[카테고리 및 속성: ${stepLabel}]`,
        tab: "category_attributes",
        targetId: targetId,
        inputName: targetId,
      });
    }

    if (input.categoryCompletion.missingRequiredAttributes && input.categoryCompletion.missingRequiredAttributes.length > 0) {
      for (const reqAttr of input.categoryCompletion.missingRequiredAttributes) {
        missingItemsPush({
          key: `attr_${reqAttr.code}`,
          section: "카테고리 및 속성",
          label: reqAttr.nameKo,
          displayTag: `[카테고리 및 속성: ${reqAttr.nameKo}]`,
          tab: "category_attributes",
          targetId: `attr-field-${reqAttr.code}`,
          inputName: `attr-input-${reqAttr.code}`,
        });
      }
    }
  } else {
    if (!input.category_code) {
      missingItemsPush({
        key: "category_code",
        section: "카테고리 및 속성",
        label: "1Depth 대분류",
        displayTag: "[카테고리 및 속성: 1Depth 대분류]",
        tab: "category_attributes",
        targetId: "category-depth-1",
        inputName: "categorySelect",
      });
    }
  }

  // 3. Name (English / Display)
  if (!effectiveNameEn || effectiveNameEn === "[임시저장] 신규 제품") {
    missingItemsPush({
      key: "name_en",
      section: "기본 정보",
      label: "영문 제품명",
      displayTag: "[기본 정보: 영문 제품명]",
      tab: "basic",
      targetId: "nameEn-field",
      inputName: "nameEn",
    });
  }

  // 4. Manufacture SKU
  if (!effectiveManufactureSku || effectiveManufactureSku.startsWith("DRAFT-SKU-")) {
    missingItemsPush({
      key: "manufacture_sku",
      section: "기본 정보",
      label: "제조사 SKU",
      displayTag: "[기본 정보: 제조사 SKU]",
      tab: "basic",
      targetId: "manufactureSku-field",
      inputName: "manufactureSku",
    });
  }

  // 5. Origin
  if (!effectiveOrigin) {
    missingItemsPush({
      key: "origin",
      section: "기본 정보",
      label: "원산지",
      displayTag: "[기본 정보: 원산지]",
      tab: "basic",
      targetId: "origin-field",
      inputName: "origin",
    });
  }

  // 6. How to Use
  if (!effectiveHowToUse) {
    missingItemsPush({
      key: "how_to_use",
      section: "기본 정보",
      label: "사용 방법",
      displayTag: "[기본 정보: 사용 방법]",
      tab: "basic",
      targetId: "howToUse-field",
      inputName: "howToUse",
    });
  }

  // 7. Pricing (Retail KRW & FOB USD)
  if (effectivePriceKrw <= 0) {
    missingItemsPush({
      key: "price_krw_retail",
      section: "가격 정보",
      label: "소비자 판매가",
      displayTag: "[가격 정보: 소비자 판매가]",
      tab: "price",
      targetId: "priceKrwRetail-field",
      inputName: "priceKrwRetail",
    });
  }
  if (effectivePriceUsd <= 0) {
    missingItemsPush({
      key: "price_usd_fob",
      section: "가격 정보",
      label: "FOB 수출 가격",
      displayTag: "[가격 정보: FOB 수출 가격]",
      tab: "price",
      targetId: "priceUsdFob-field",
      inputName: "priceUsdFob",
    });
  }

  // 7. Logistics Specifications (A. Item Spec, B. Package Spec, C. Carton Spec)
  if (itemW <= 0 || itemD <= 0 || itemH <= 0 || itemWt <= 0) {
    missingItemsPush({
      key: "item_spec",
      section: "물류 정보",
      label: "단품 규격",
      displayTag: "[물류 정보: 단품 규격]",
      tab: "logistics",
      targetId: "itemWidth-field",
      inputName: "itemWidth",
    });
  }
  if (pkgW <= 0 || pkgD <= 0 || pkgH <= 0 || pkgWt <= 0) {
    missingItemsPush({
      key: "package_spec",
      section: "물류 정보",
      label: "단품 포장 패키지 규격",
      displayTag: "[물류 정보: 단품 포장 패키지 규격]",
      tab: "logistics",
      targetId: "packageWidth-field",
      inputName: "packageWidth",
    });
  }
  if (cartonQty <= 0 || cartonW <= 0 || cartonD <= 0 || cartonH <= 0 || cartonWt <= 0) {
    missingItemsPush({
      key: "carton_spec",
      section: "물류 정보",
      label: "마스터 카톤 규격",
      displayTag: "[물류 정보: 마스터 카톤 규격]",
      tab: "logistics",
      targetId: "cartonPackQty-field",
      inputName: "cartonPackQty",
    });
  }

  // 8. Barcode (UPC or EAN)
  const isValidUpc = Boolean(effectiveUpc && /^\d{12}$/.test(effectiveUpc));
  const isValidEan = Boolean(effectiveEan && /^\d{13}$/.test(effectiveEan));
  const isUpcAcceptable = !effectiveUpc || isValidUpc;
  const isEanAcceptable = !effectiveEan || isValidEan;
  const hasAtLeastOneValid = isValidUpc || isValidEan;

  if (!isUpcAcceptable || !isEanAcceptable || !hasAtLeastOneValid) {
    missingItemsPush({
      key: "barcode",
      section: "기본 정보",
      label: "식별 바코드(UPC/EAN)",
      displayTag: "[기본 정보: 식별 바코드(UPC/EAN)]",
      tab: "basic",
      targetId: "upc-field",
      inputName: "upc",
    });
  }

  // 9. Online sales link if selling online
  if (input.selling_online && !safeString(input.sales_link_1)) {
    missingItemsPush({
      key: "sales_link",
      section: "기본 정보",
      label: "온라인 판매 링크",
      displayTag: "[기본 정보: 온라인 판매 링크]",
      tab: "basic",
      targetId: "salesLink1-field",
      inputName: "salesLink1",
    });
  }

  // 10. Representative Image
  if (!input.hasImages) {
    missingItemsPush({
      key: "images",
      section: "미디어 정보",
      label: "대표 이미지",
      displayTag: "[미디어 정보: 대표 이미지]",
      tab: "media",
      targetId: "product-images-dropzone",
      inputName: "images",
    });
  }

  function missingItemsPush(item: MissingFieldItem) {
    missingFieldItems.push(item);
    missingFields.push(`${item.section}: ${item.label}`);
  }

  const isDraft = missingFieldItems.length > 0;

  return {
    isDraft,
    isDeleted: false,
    status: isDraft ? "DRAFT" : "COMPLETE",
    statusLabel: isDraft ? REGISTRATION_STATUS_LABELS.DRAFT : REGISTRATION_STATUS_LABELS.COMPLETE,
    missingFields,
    missingFieldItems,
  };
}
