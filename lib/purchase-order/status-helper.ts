export function getOverallStatus(
  po: {
    po_status: string;
    fulfillment_status?: string | null;
    supplier_confirmation_status?: string | null;
  },
  shipments: any[] = [],
  receivings: any[] = []
): string {
  if (po.po_status === "DRAFT") return "Draft";
  if (po.po_status === "CANCELLED") return "Cancelled";
  if (po.po_status === "APPROVED") return "Approved";

  if (po.po_status === "SENT") {
    const activeReceivings = receivings.filter((r) => r.status === "DRAFT");
    const finalizedReceivings = receivings.filter((r) => r.status === "FINALIZED");
    const activeShipments = shipments.filter((s) => s.status !== "CANCELLED");

    // Check if received or finalized
    if (
      po.fulfillment_status === "RECEIVED" ||
      po.fulfillment_status === "COMPLETED" ||
      (finalizedReceivings.length > 0 && activeReceivings.length === 0)
    ) {
      return "Completed";
    }

    // Check if currently receiving (draft receiving exists)
    if (activeReceivings.length > 0) {
      return "Receiving";
    }

    // Check if arrived/inspecting
    if (
      activeShipments.some((s) => s.status === "ARRIVED" || s.status === "PARTIALLY_RECEIVED")
    ) {
      return "Arrived";
    }

    // Calculate total shipped quantity across all active shipments
    const totalShippedQty = activeShipments.reduce(
      (sum, s) => sum + (s.lines ?? []).reduce((lSum: number, sl: any) => lSum + (Number(sl.shipped_qty) || 0), 0),
      0
    );

    // Check if shipped/transit (Requirement 4: Shipped Qty > 0 must transition to Shipped)
    if (
      po.fulfillment_status === "SHIPPED" ||
      po.fulfillment_status === "PARTIALLY_SHIPPED" ||
      activeShipments.some((s) => s.status === "IN_TRANSIT" || s.status === "BOOKED" || s.status === "SHIPPED" || s.status === "DRAFT") ||
      totalShippedQty > 0
    ) {
      return "Shipped";
    }

    if (po.fulfillment_status === "READY_TO_SHIP") {
      return "Ready to Ship";
    }

    if (po.fulfillment_status === "IN_PRODUCTION") {
      return "In Production";
    }

    if (po.supplier_confirmation_status === "CONFIRMED") {
      return "Supplier Confirmed";
    }

    return "Sent to Supplier";
  }

  return po.po_status;
}

export const OVERALL_STATUS_LABELS: Record<string, string> = {
  Draft: "초안 (Draft)",
  Approved: "승인됨 (Approved)",
  "Sent to Supplier": "공급사 전송됨 (Sent)",
  "Change Requested": "변경 제안됨 (Change Proposed)",
  "Supplier Confirmed": "공급사 수락됨 (Confirmed)",
  "In Production": "생산중 (In Production)",
  "Ready to Ship": "선적 대기 (Ready to Ship)",
  Shipped: "출고/선적 완료 (Shipped)",
  Arrived: "창고 도착 (Arrived)",
  Receiving: "입고 검수중 (Receiving)",
  Completed: "입고 종결 (Completed)",
  Cancelled: "취소됨 (Cancelled)",
};

export const OVERALL_STATUS_COLORS: Record<string, string> = {
  Draft: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700",
  Approved: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
  "Sent to Supplier": "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800",
  "Change Requested": "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
  "Supplier Confirmed": "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800",
  "In Production": "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  "Ready to Ship": "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
  Shipped: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800",
  Arrived: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800",
  Receiving: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800",
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
  Cancelled: "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800/80 dark:text-zinc-400 dark:border-zinc-700",
};

export interface PoProgressStep {
  stepNumber: number;
  key: string;
  label: string;
  subLabel: string;
  description: string;
}

export const PO_6_STEPS: PoProgressStep[] = [
  { stepNumber: 1, key: "PO_SENT", label: "PO Sent / Received", subLabel: "발주 발송 / 접수", description: "발주서 전달 및 공급사 접수" },
  { stepNumber: 2, key: "SUPPLIER_CONFIRMED", label: "Supplier Confirmed", subLabel: "공급사 수락 / 확인", description: "수량 및 공급 조건 확정" },
  { stepNumber: 3, key: "READY_TO_SHIP", label: "Ready to Ship", subLabel: "선적 / 출고 준비", description: "생산 완료 및 패킹/서류 등록" },
  { stepNumber: 4, key: "SHIPPED", label: "Shipped", subLabel: "선적 / 출고 완료", description: "화물 출항 및 운송 중" },
  { stepNumber: 5, key: "RECEIVING", label: "Receiving / Inspection", subLabel: "입고 / 검수", description: "창고 도착 및 실물 검수" },
  { stepNumber: 6, key: "COMPLETED", label: "Completed", subLabel: "입고 종결", description: "재고 반영 및 발주 완료" },
];

/**
 * Returns the current step index (1-6) for the unified 6-step progress bar.
 * Returns 0 for Draft (pre-sent) and -1 for Cancelled.
 */
export function getPoProgressStepIndex(overallStatus: string): number {
  switch (overallStatus) {
    case "Draft":
      return 0;
    case "Approved":
    case "Sent to Supplier":
    case "Change Requested":
      return 1;
    case "Supplier Confirmed":
    case "In Production":
      return 2;
    case "Ready to Ship":
      return 3;
    case "Shipped":
      return 4;
    case "Arrived":
    case "Receiving":
      return 5;
    case "Completed":
      return 6;
    case "Cancelled":
      return -1;
    default:
      return 1;
  }
}

export function getNextAction(overallStatus: string, isReadOnly: boolean = false) {
  if (isReadOnly) return null;
  switch (overallStatus) {
    case "Draft":
      return { label: "발주서 승인 (Approve PO)", action: "approve" };
    case "Approved":
      return { label: "Supplier에게 전송 처리 (Mark Sent)", action: "send" };
    case "Sent to Supplier":
      return { label: "공급사 회신 대기 중", action: "none", disabled: true };
    case "Change Requested":
      return { label: "공급사 변경 제안 검토 필요", action: "none", disabled: true };
    case "Supplier Confirmed":
      return { label: "선적 등록 (Create Shipment)", action: "create_shipment" };
    case "In Production":
      return { label: "선적대기 처리 (Ready to Ship)", action: "ready_to_ship" };
    case "Ready to Ship":
      return { label: "선적 등록 (Create Shipment)", action: "create_shipment" };
    case "Shipped":
      return { label: "창고 도착 처리 대기 중", action: "none", disabled: true };
    case "Arrived":
      return { label: "실물 입고 검수 등록 (Create Receiving)", action: "create_receiving" };
    case "Receiving":
      return { label: "입고 확정 (Finalize Receiving)", action: "finalize" };
    case "Completed":
      return { label: "발주 종결됨 (Completed)", action: "none", disabled: true };
    default:
      return null;
  }
}

