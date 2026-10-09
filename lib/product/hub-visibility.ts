import { resolveEffectiveSku, isDraftPlaceholderName, isDraftPlaceholderSku } from "@/lib/product/types";
import {
  resolveRetailerSalesPolicy,
  type ResolvedRetailerSalesPolicy,
} from "@/lib/product/retailer-policy";

export type AdminVisibilitySetting = "visible" | "hidden";
export type EffectiveHubVisibility = "PUBLISHED" | "ON_HOLD" | "HIDDEN";
export type OrderabilityStatus =
  | "ORDERABLE"
  | "OUT_OF_STOCK"
  | "INSUFFICIENT_STOCK"
  | "NOT_ORDERABLE";

export type HubVisibilityHoldReasonCode =
  | "NO_WHOLESALE_PRICE"
  | "NO_MOQ"
  | "INACTIVE_OPERATION"
  | "NO_BRAND"
  | "NO_PRODUCT_NAME";

export interface HubVisibilityEvaluation {
  adminVisibility: AdminVisibilitySetting;
  effectiveVisibility: EffectiveHubVisibility;
  effectiveVisibilityLabel: string; // "Hub 노출" | "Hub 노출 보류" | "Hub 비노출"
  effectiveVisibilityDescription: string;
  holdReasons: HubVisibilityHoldReasonCode[];
  holdReasonLabels: string[];
  isOrderable: boolean;
  orderabilityStatus: OrderabilityStatus;
  orderabilityLabel: string; // "주문 가능" | "품절" | "주문 불가 (재고 부족)" | "주문 불가"
  orderabilityReason?: string;
  wholesalePrice: number;
  moq: number;
  availableStock: number;
  isSoldOut: boolean;
  restockEta?: string | null;
  salesPolicy: ResolvedRetailerSalesPolicy;
}

/**
 * Authoritative Unified Evaluator for Hub Visibility, Automatic Hold & Recovery, and Orderability
 */
export function evaluateHubVisibility(
  product: any,
  availableStock: number = 0,
  restockEta: string | null = null
): HubVisibilityEvaluation {
  const info = (product.price_additional_info as any) || {};
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

  const moq =
    salesPolicy.moq > 0
      ? salesPolicy.moq
      : Number(product.moq) > 0
      ? Number(product.moq)
      : Number(product.carton_pack_qty) > 0
      ? Number(product.carton_pack_qty)
      : 0;

  if (isDeleted || isPlaceholder) {
    return {
      adminVisibility,
      effectiveVisibility: "HIDDEN",
      effectiveVisibilityLabel: "Hub 비노출",
      effectiveVisibilityDescription:
        "삭제 또는 임시 등록 상품으로 Hub에 노출되지 않습니다.",
      holdReasons: [],
      holdReasonLabels: [],
      isOrderable: false,
      orderabilityStatus: "NOT_ORDERABLE",
      orderabilityLabel: "주문 불가",
      orderabilityReason: "비활성 상품입니다.",
      wholesalePrice: 0,
      moq: 1,
      availableStock,
      isSoldOut: true,
      restockEta: null,
      salesPolicy,
    };
  }

  if (adminVisibility === "visible") {
    const holdReasons: HubVisibilityHoldReasonCode[] = [];
    const holdReasonLabels: string[] = [];

    if (tradingStatus !== "active") {
      holdReasons.push("INACTIVE_OPERATION");
      holdReasonLabels.push("운영 상태 미활성 (운영 중지/종료)");
    }

    if (wholesalePrice <= 0) {
      holdReasons.push("NO_WHOLESALE_PRICE");
      holdReasonLabels.push("리테일러 판매 단가 미설정");
    }

    if (moq < 1) {
      holdReasons.push("NO_MOQ");
      holdReasonLabels.push("Retailer MOQ 미설정");
    }

    if (!product.name || !product.name.trim()) {
      holdReasons.push("NO_PRODUCT_NAME");
      holdReasonLabels.push("상품명 미입력");
    }

    if (holdReasons.length > 0) {
      const effectiveVisibility: EffectiveHubVisibility = "ON_HOLD";
      return {
        adminVisibility,
        effectiveVisibility,
        effectiveVisibilityLabel: "Hub 노출 보류",
        effectiveVisibilityDescription: `필수 정보(${holdReasonLabels.join(
          ", "
        )}) 미설정으로 Hub 노출이 자동 보류 중입니다. 정보 설정 시 즉시 자동 노출됩니다.`,
        holdReasons,
        holdReasonLabels,
        isOrderable: false,
        orderabilityStatus: "NOT_ORDERABLE",
        orderabilityLabel: "주문 불가",
        orderabilityReason: `Hub 노출 보류: ${holdReasonLabels.join(", ")}`,
        wholesalePrice,
        moq,
        availableStock,
        isSoldOut: availableStock <= 0,
        restockEta,
        salesPolicy,
      };
    }

    // All conditions met -> PUBLISHED
    const effectiveVisibility: EffectiveHubVisibility = "PUBLISHED";
    const isSoldOut = availableStock <= 0;

    let orderabilityStatus: OrderabilityStatus = "ORDERABLE";
    let orderabilityLabel = "주문 가능";
    let orderabilityReason: string | undefined = undefined;
    let isOrderable = true;

    if (isSoldOut) {
      isOrderable = false;
      orderabilityStatus = "OUT_OF_STOCK";
      orderabilityLabel = "품절";
      orderabilityReason = "현재 가용 재고 소진 (0 EA)";
    } else if (availableStock < moq) {
      isOrderable = false;
      orderabilityStatus = "INSUFFICIENT_STOCK";
      orderabilityLabel = "주문 불가 (재고 부족)";
      orderabilityReason = `가용 재고(${availableStock} EA)가 최소 주문 수량(${moq} EA) 미만입니다.`;
    }

    return {
      adminVisibility,
      effectiveVisibility,
      effectiveVisibilityLabel: "Hub 노출",
      effectiveVisibilityDescription: "Retailer Hub에 정상 노출 중입니다.",
      holdReasons: [],
      holdReasonLabels: [],
      isOrderable,
      orderabilityStatus,
      orderabilityLabel,
      orderabilityReason,
      wholesalePrice,
      moq,
      availableStock,
      isSoldOut,
      restockEta,
      salesPolicy,
    };
  } else {
    // Admin set to Hidden
    const effectiveVisibility: EffectiveHubVisibility = "HIDDEN";
    return {
      adminVisibility,
      effectiveVisibility,
      effectiveVisibilityLabel: "Hub 비노출",
      effectiveVisibilityDescription:
        "관리자 설정에 의해 Hub에 노출되지 않습니다.",
      holdReasons: [],
      holdReasonLabels: [],
      isOrderable: false,
      orderabilityStatus: "NOT_ORDERABLE",
      orderabilityLabel: "주문 불가",
      orderabilityReason: "관리자 비노출 설정",
      wholesalePrice,
      moq,
      availableStock,
      isSoldOut: availableStock <= 0,
      restockEta,
      salesPolicy,
    };
  }
}
