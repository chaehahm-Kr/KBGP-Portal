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

    // Check if shipped/transit
    if (
      po.fulfillment_status === "SHIPPED" ||
      activeShipments.some((s) => s.status === "IN_TRANSIT" || s.status === "BOOKED" || s.status === "SHIPPED")
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

    if (po.supplier_confirmation_status === "CHANGE_REQUESTED") {
      return "Change Requested";
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
  Draft: "bg-zinc-100 text-zinc-700 border-zinc-250 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  Approved: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50",
  "Sent to Supplier": "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/50",
  "Change Requested": "bg-rose-50 text-rose-700 border-rose-250 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50",
  "Supplier Confirmed": "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-900/50",
  "In Production": "bg-amber-50 text-amber-700 border-amber-250 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50",
  "Ready to Ship": "bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
  Shipped: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/20 dark:text-sky-400 dark:border-sky-900/50",
  Arrived: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/20 dark:text-cyan-400 dark:border-cyan-900/50",
  Receiving: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/50",
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-450 dark:border-emerald-900/50",
  Cancelled: "bg-zinc-50 text-zinc-400 border-zinc-200 dark:bg-zinc-900/40 dark:text-zinc-650 dark:border-zinc-800",
};

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
