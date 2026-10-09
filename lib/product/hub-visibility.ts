import { resolveEffectiveSku, isDraftPlaceholderName, isDraftPlaceholderSku } from "@/lib/product/types";
import {
  resolveRetailerSalesPolicy,
  type ResolvedRetailerSalesPolicy,
} from "@/lib/product/retailer-policy";

export type AdminVisibilitySetting = "visible" | "hidden";
export type EffectiveHubVisibility = "PUBLISHED" | "HIDDEN";
export type OrderabilityStatus =
  | "ORDERABLE"
  | "OUT_OF_STOCK"
  | "INSUFFICIENT_STOCK"
  | "NOT_ORDERABLE";

export type HubVisibilityHoldReasonCode =
  | "NO_WHOLESALE_PRICE"
  | "NO_RETAIL_PRICE"
  | "NO_MOQ"
  | "INACTIVE_OPERATION";

export interface HubVisibilityEvaluation {
  adminVisibility: AdminVisibilitySetting;
  effectiveVisibility: EffectiveHubVisibility;
  effectiveVisibilityLabel: string; // "노출" | "비노출"
  effectiveVisibilityDescription: string;
  holdReasons: HubVisibilityHoldReasonCode[];
  holdReasonLabels: string[];
  isOrderable: boolean;
  orderabilityStatus: OrderabilityStatus;
  orderabilityLabel: string; // "주문 가능" | "품절" | "주문 불가"
  orderabilityReason?: string;
  wholesalePrice: number;
  retailPrice: number;
  moq: number;
  availableStock: number;
  isSoldOut: boolean;
  restockEta?: string | null;
  salesPolicy: ResolvedRetailerSalesPolicy;
}

export interface VisibilityEligibilityResult {
  isEligible: boolean;
  missingReasons: string[];
  errorMessage: string | null;
}

/**
 * Authoritative Eligibility Evaluator for Setting Product to 'visible'
 * Checks the 3 mandatory conditions:
 * 1. Valid Wholesale Price (> 0)
 * 2. Valid Retail Price / SRP / MSRP (> 0)
 * 3. Retailer Order MOQ (> 0)
 */
export function evaluateVisibilityEligibility(product: any): VisibilityEligibilityResult {
  const salesPolicy = resolveRetailerSalesPolicy(product);
  const info = (product.price_additional_info as any) || {};
  const overrides = info.admin_overrides || {};
  const tradingOverrides = info.trading_overrides || {};

  const wholesalePrice =
    salesPolicy.hasActivePromo &&
    salesPolicy.promoWholesalePrice &&
    salesPolicy.promoWholesalePrice > 0
      ? salesPolicy.promoWholesalePrice
      : salesPolicy.baseWholesalePrice > 0
      ? salesPolicy.baseWholesalePrice
      : Number(product.trading_wholesale_price) || 0;

  const retailPrice =
    salesPolicy.srpPrice && salesPolicy.srpPrice > 0
      ? salesPolicy.srpPrice
      : Number(tradingOverrides.srp_price) > 0
      ? Number(tradingOverrides.srp_price)
      : Number(product.price_krw_retail) > 0
      ? Number(product.price_krw_retail)
      : Number(product.estimated_retail_price) > 0
      ? Number(product.estimated_retail_price)
      : Number(overrides.estimated_retail_price) > 0
      ? Number(overrides.estimated_retail_price)
      : 0;

  const moq =
    salesPolicy.moq > 0
      ? salesPolicy.moq
      : Number(product.moq) > 0
      ? Number(product.moq)
      : Number(product.carton_pack_qty) > 0
      ? Number(product.carton_pack_qty)
      : Number(overrides.carton_pack_qty) > 0
      ? Number(overrides.carton_pack_qty)
      : 0;

  const missingReasons: string[] = [];

  if (wholesalePrice <= 0) {
    missingReasons.push("Wholesale Price를 먼저 설정하세요.");
  }
  if (retailPrice <= 0) {
    missingReasons.push("Retail Price를 먼저 설정하세요.");
  }
  if (moq <= 0) {
    missingReasons.push("Retailer MOQ를 먼저 설정하세요.");
  }

  const isEligible = missingReasons.length === 0;

  return {
    isEligible,
    missingReasons,
    errorMessage: isEligible ? null : missingReasons.join(" "),
  };
}

/**
 * Authoritative Unified Evaluator for Hub Visibility & Runtime Orderability
 */
export function evaluateHubVisibility(
  product: any,
  availableStock: number = 0,
  restockEta: string | null = null
): HubVisibilityEvaluation {
  const info = (product.price_additional_info as any) || {};
  const overrides = info.admin_overrides || {};
  const isDeleted = Boolean(
    info.deleted_at || product.deleted_at || product.status === "discontinued"
  );
  const isPlaceholder =
    isDraftPlaceholderName(product.name) ||
    isDraftPlaceholderSku(product.manufacture_sku);

  const adminVisibility: AdminVisibilitySetting =
    product.retailer_visibility === "visible" ? "visible" : "hidden";

  const tradingStatus =
    product.trading_status ||
    (product.selection_status === "SELECTED" ? "active" : "inactive");

  const salesPolicy = resolveRetailerSalesPolicy(product);
  const wholesalePrice =
    salesPolicy.hasActivePromo &&
    salesPolicy.promoWholesalePrice &&
    salesPolicy.promoWholesalePrice > 0
      ? salesPolicy.promoWholesalePrice
      : salesPolicy.baseWholesalePrice > 0
      ? salesPolicy.baseWholesalePrice
      : Number(product.trading_wholesale_price) || 0;

  const retailPrice =
    salesPolicy.srpPrice && salesPolicy.srpPrice > 0
      ? salesPolicy.srpPrice
      : Number(product.price_krw_retail) > 0
      ? Number(product.price_krw_retail)
      : Number(product.estimated_retail_price) > 0
      ? Number(product.estimated_retail_price)
      : Number(overrides.estimated_retail_price) > 0
      ? Number(overrides.estimated_retail_price)
      : 0;

  const moq =
    salesPolicy.moq > 0
      ? salesPolicy.moq
      : Number(product.moq) > 0
      ? Number(product.moq)
      : Number(product.carton_pack_qty) > 0
      ? Number(product.carton_pack_qty)
      : Number(overrides.carton_pack_qty) > 0
      ? Number(overrides.carton_pack_qty)
      : 0;

  const eligibility = evaluateVisibilityEligibility(product);

  // Hub Display Rule:
  // Active + Visible + Valid Wholesale + Valid Retail + Valid MOQ + Not Deleted/Placeholder
  const isHubVisible =
    !isDeleted &&
    !isPlaceholder &&
    tradingStatus === "active" &&
    adminVisibility === "visible" &&
    eligibility.isEligible;

  const effectiveVisibility: EffectiveHubVisibility = isHubVisible ? "PUBLISHED" : "HIDDEN";

  // Inventory is ONLY used for Orderability, NOT Hub Visibility!
  const isSoldOut = availableStock <= 0;
  const isOrderable = isHubVisible && availableStock > 0 && availableStock >= moq;

  let orderabilityStatus: OrderabilityStatus = "NOT_ORDERABLE";
  let orderabilityLabel = "주문 불가";
  let orderabilityReason: string | undefined = undefined;

  if (isOrderable) {
    orderabilityStatus = "ORDERABLE";
    orderabilityLabel = "주문 가능";
  } else if (isHubVisible && isSoldOut) {
    orderabilityStatus = "OUT_OF_STOCK";
    orderabilityLabel = "품절";
    orderabilityReason = "가용 재고 소진 (0 EA)";
  } else if (isHubVisible && availableStock < moq) {
    orderabilityStatus = "INSUFFICIENT_STOCK";
    orderabilityLabel = "재고 부족";
    orderabilityReason = `가용 재고(${availableStock} EA)가 MOQ(${moq} EA) 미만입니다.`;
  } else if (!isHubVisible) {
    orderabilityReason = "Hub 미노출 상품입니다.";
  }

  return {
    adminVisibility,
    effectiveVisibility,
    effectiveVisibilityLabel: isHubVisible ? "노출" : "비노출",
    effectiveVisibilityDescription: isHubVisible
      ? "Retailer Hub에 정상 노출 중입니다."
      : "Hub 미노출 상품입니다.",
    holdReasons: [],
    holdReasonLabels: [],
    isOrderable,
    orderabilityStatus,
    orderabilityLabel,
    orderabilityReason,
    wholesalePrice,
    retailPrice,
    moq,
    availableStock,
    isSoldOut,
    restockEta,
    salesPolicy,
  };
}
