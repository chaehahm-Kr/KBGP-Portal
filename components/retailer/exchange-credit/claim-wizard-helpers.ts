/**
 * Pure Helpers and Computations for Claim Wizard UI
 * Task ID: EXCHANGE-CREDIT-PH2-003
 * Location: components/retailer/exchange-credit/claim-wizard-helpers.ts
 */

import {
  ClaimWizardProductItem,
  ClaimWizardProductStatus,
  ExchangeCreditOption,
  SelectedClaimItem,
} from "./claim-wizard-types";

export interface StatusBadgeConfig {
  label: string;
  badgeClass: string;
  dotClass: string;
  isSelectable: boolean;
  explanation: string;
}

export function getStatusBadgeConfig(
  status: ClaimWizardProductStatus,
  daysRemaining?: number
): StatusBadgeConfig {
  switch (status) {
    case "ELIGIBLE":
      return {
        label: "신청 가능 (Eligible)",
        badgeClass: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
        dotClass: "bg-emerald-400",
        isSelectable: true,
        explanation: daysRemaining !== undefined && daysRemaining >= 0
          ? `신청 마감까지 ${daysRemaining}일 남았습니다.`
          : "90일 교환 크레딧 신청 대상입니다.",
      };
    case "UPCOMING":
      return {
        label: "평가 대기 (Upcoming)",
        badgeClass: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
        dotClass: "bg-blue-400",
        isSelectable: false,
        explanation: "Day 100 평가일까지 주간 재고 점검을 지속해 주세요.",
      };
    case "NOT_ELIGIBLE":
      return {
        label: "신청 불가 (Not Eligible)",
        badgeClass: "bg-zinc-800 text-zinc-400 border border-zinc-700/50",
        dotClass: "bg-zinc-500",
        isSelectable: false,
        explanation: "프로그램 요건(판매율 50% 미만, 8주 보고, 재주문 없음)을 충족하지 못했습니다.",
      };
    case "NEEDS_REVIEW":
      return {
        label: "데이터 확인 중 (Needs Review)",
        badgeClass: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
        dotClass: "bg-amber-400",
        isSelectable: false,
        explanation: "재고 데이터 검토가 진행 중입니다. 본사 담당자가 확인 중입니다.",
      };
    case "CLAIMED":
      return {
        label: "신청 완료 (Claimed)",
        badgeClass: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
        dotClass: "bg-purple-400",
        isSelectable: false,
        explanation: "이미 해당 품목에 대해 1회성 보증 신청이 접수되었습니다.",
      };
    case "EXPIRED":
      return {
        label: "기한 만료 (Expired)",
        badgeClass: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
        dotClass: "bg-rose-500/40",
        isSelectable: false,
        explanation: "Day 150 신청 기한이 경과하여 보증이 종료되었습니다.",
      };
  }
}

/**
 * Format internal reason code into clear, friendly retailer-first explanation
 */
export function formatRetailerFriendlyReason(reasonCode: string | null): string {
  if (!reasonCode) return "";

  const REASON_MAP: Record<string, string> = {
    INSUFFICIENT_REPORTING_WEEKS: "주간 재고 점검 보고 횟수 부족 (필수 8주 미만 완료)",
    EXCESS_SELL_THROUGH: "판매율 50% 초과 (성공적 판매로 보증 대상 제외)",
    DISQUALIFIED_REORDERED: "동일 매장 추가 발주로 인한 보증 종료",
    ZERO_REMAINING_STOCK: "매장 보유 실사 잔여 재고 없음 (0개)",
    UNVERIFIED_SALES_EVIDENCE: "공식 판매 데이터 검토 대기 중",
    CONTRADICTORY_SALES_EVIDENCE: "판매 데이터 불일치 검토 중",
    CONTRADICTORY_INVENTORY_EVIDENCE: "재고 수량 불일치 검토 중",
    MISSING_INVENTORY_EVIDENCE: "주간 재고 점검 보고 이력 없음",
    DEADLINE_EXPIRED: "신청 마감일(Day 150) 경과",
    EVALUATION_PENDING: "Day 100 평가 대기 중",
  };

  return REASON_MAP[reasonCode] || reasonCode;
}

/**
 * Calculate estimated credit for a single item and option
 */
export function calculateItemCredit(
  item: ClaimWizardProductItem,
  option: ExchangeCreditOption,
  quantity: number
): { rate: number; credit: number } {
  const qty = Math.max(0, Math.min(item.maxClaimableQuantity, quantity));
  const wholesale = item.unitWholesalePrice;

  if (option === "A") {
    const rate = Math.max(0.2, Math.min(0.5, item.frozenOptionARate || 0.4));
    const credit = Math.round(qty * wholesale * rate * 100) / 100;
    return { rate, credit };
  } else {
    const rate = 1.0;
    const credit = Math.round(qty * wholesale * rate * 100) / 100;
    return { rate, credit };
  }
}

/**
 * Calculate summary totals across all selected wizard items
 */
export interface WizardTotals {
  totalUnits: number;
  totalOptionAUnits: number;
  totalOptionBUnits: number;
  totalOptionACredit: number;
  totalOptionBCredit: number;
  grandTotalEstimatedCredit: number;
  hasOptionB: boolean;
  isValid: boolean;
}

export function calculateWizardTotals(
  selectedItems: SelectedClaimItem[]
): WizardTotals {
  let totalUnits = 0;
  let totalOptionAUnits = 0;
  let totalOptionBUnits = 0;
  let totalOptionACredit = 0;
  let totalOptionBCredit = 0;
  let isValid = selectedItems.length > 0;

  for (const item of selectedItems) {
    if (
      !Number.isInteger(item.selectedQuantity) ||
      item.selectedQuantity <= 0 ||
      item.selectedQuantity > item.maxClaimableQuantity
    ) {
      isValid = false;
    }

    totalUnits += item.selectedQuantity;

    if (item.selectedOption === "A") {
      totalOptionAUnits += item.selectedQuantity;
      totalOptionACredit += item.estimatedCredit;
    } else {
      totalOptionBUnits += item.selectedQuantity;
      totalOptionBCredit += item.estimatedCredit;
    }
  }

  const grandTotalEstimatedCredit =
    Math.round((totalOptionACredit + totalOptionBCredit) * 100) / 100;

  return {
    totalUnits,
    totalOptionAUnits,
    totalOptionBUnits,
    totalOptionACredit: Math.round(totalOptionACredit * 100) / 100,
    totalOptionBCredit: Math.round(totalOptionBCredit * 100) / 100,
    grandTotalEstimatedCredit,
    hasOptionB: totalOptionBUnits > 0,
    isValid,
  };
}

/**
 * Currency formatter helper
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}
