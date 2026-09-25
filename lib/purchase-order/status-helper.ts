/**
 * Unified Purchase Order Status & Stepper Helper
 * Task ID: ADM-PUR-UI-001-R3 / PORT-PO-UI-001-R3 (Shipment Confirmation & Progress Synchronization)
 */
export function getOverallStatus(
  po: {
    po_status: string;
    fulfillment_status?: string | null;
    supplier_confirmation_status?: string | null;
  },
  shipments: any[] = [],
  receivings: any[] = [],
  goodsReadiness: any[] = []
): string {
  if (po.po_status === "DRAFT") return "Draft";
  if (po.po_status === "CANCELLED") return "Cancelled";
  if (po.po_status === "APPROVED") return "Approved";

  if (po.po_status === "SENT") {
    const activeReceivings = receivings.filter((r) => r.status === "DRAFT");
    const finalizedReceivings = receivings.filter((r) => r.status === "FINALIZED");
    const activeShipments = shipments.filter((s) => s.status !== "CANCELLED");
    const activeReadiness = goodsReadiness.filter(
      (gr) => gr.handover_status !== "CANCELLED" && gr.handover_status !== "DRAFT"
    );

    const totalReadyQty = activeReadiness.reduce(
      (sum, gr) => sum + (gr.lines ?? []).reduce((lSum: number, gl: any) => lSum + (Number(gl.ready_qty) || 0), 0),
      0
    );

    const totalShippedQty = activeShipments.reduce(
      (sum, s) => sum + (s.lines ?? []).reduce((lSum: number, sl: any) => lSum + (Number(sl.shipped_qty) || 0), 0),
      0
    );

    let totalAcceptedQty = 0;
    let totalReceivedQty = 0;
    finalizedReceivings.forEach((r) => {
      const rLines = r.lines ?? r.receiving_lines ?? [];
      rLines.forEach((rl: any) => {
        totalReceivedQty += Number(rl.received_qty) || 0;
        totalAcceptedQty += (Number(rl.received_qty) || 0) - (Number(rl.damaged_qty) || 0) - (Number(rl.hold_qty) || 0);
      });
    });

    // Step 6: Completed (Explicit fulfillment_status COMPLETED after Complete PO action)
    if (po.fulfillment_status === "COMPLETED") {
      return "Completed";
    }

    // Step 5: Receiving / Arrived (Active draft inspection, warehouse arrived, partial receiving, receiving in progress, or finalized receiving pending PO completion)
    if (
      activeReceivings.length > 0 ||
      finalizedReceivings.length > 0 ||
      totalReceivedQty > 0 ||
      po.fulfillment_status === "PARTIALLY_RECEIVED" ||
      po.fulfillment_status === "RECEIVED" ||
      activeShipments.some((s) => s.status === "ARRIVED" || s.status === "PARTIALLY_RECEIVED")
    ) {
      return "Receiving";
    }

    // Step 4: Shipped (Shipped Qty > 0 or active shipments or fulfillment_status SHIPPED/IN_TRANSIT)
    if (
      po.fulfillment_status === "SHIPPED" ||
      po.fulfillment_status === "IN_TRANSIT" ||
      activeShipments.length > 0 ||
      totalShippedQty > 0
    ) {
      return "Shipped";
    }

    // Step 3: Ready to Ship (Ready Qty > 0 or active goods readiness or fulfillment_status READY_TO_SHIP)
    if (
      po.fulfillment_status === "READY_TO_SHIP" ||
      activeReadiness.length > 0 ||
      totalReadyQty > 0
    ) {
      return "Ready to Ship";
    }

    // Step 2: Supplier Confirmed / In Production
    if (po.fulfillment_status === "IN_PRODUCTION") {
      return "In Production";
    }

    if (po.supplier_confirmation_status === "CONFIRMED") {
      return "Supplier Confirmed";
    }

    // Step 1: PO Sent
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
  Approved: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  "Sent to Supplier": "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  "Change Requested": "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
  "Supplier Confirmed": "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  "In Production": "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  "Ready to Ship": "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
  Shipped: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800",
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
      return { label: "입고 검수 등록 (Start Receiving)", action: "create_receiving" };
    case "Arrived":
      return { label: "입고 검수 등록 (Start Receiving)", action: "create_receiving" };
    case "Receiving":
      return { label: "입고 검수 계속 / 확정 (Receiving & Finalize)", action: "continue_receiving" };
    case "Completed":
      return { label: "발주 종결됨 (Completed)", action: "none", disabled: true };
    default:
      return null;
  }
}

export interface CanonicalPoLineSummary {
  id: string;
  productId: string;
  productName: string;
  letustoSku: string;
  poQty: number;
  confirmedQty: number;
  readyQty: number;
  shippedQty: number;
  receivedQty: number;
  damagedQty: number;
  holdQty: number;
  damagedHoldQty: number;
  acceptedQty: number;
  variance: number;
}

export interface CanonicalPoSummary {
  totalPoQty: number;
  totalConfirmedQty: number;
  totalReadyQty: number;
  totalShippedQty: number;
  totalReceivedQty: number;
  totalDamagedQty: number;
  totalHoldQty: number;
  totalDamagedHoldQty: number;
  totalAcceptedQty: number;
  totalVariance: number;
  lineMap: Map<string, CanonicalPoLineSummary>;
  lines: CanonicalPoLineSummary[];
  overallStatus: string;
  hasDraftReceiving: boolean;
  hasFinalizedReceiving: boolean;
  activeReceivingCount: number;
  finalizedReceivingCount: number;
}

export function computeCanonicalPoAggregation(
  po: any,
  shipments: any[] = [],
  receivings: any[] = [],
  goodsReadiness: any[] = []
): CanonicalPoSummary {
  const activeShipments = (shipments || []).filter((s) => s.status !== "CANCELLED");
  const finalizedReceivings = (receivings || []).filter((r) => r.status === "FINALIZED");
  const activeReceivings = (receivings || []).filter((r) => r.status === "DRAFT");
  const activeReadiness = (goodsReadiness || []).filter(
    (gr) => gr.handover_status !== "CANCELLED" && gr.handover_status !== "DRAFT"
  );

  const poLines = po.lines || po.purchase_order_lines || [];

  const readyLineMap = new Map<string, number>();
  activeReadiness.forEach((gr) => {
    (gr.lines ?? gr.items ?? []).forEach((gl: any) => {
      const lineId = gl.purchase_order_line_id;
      if (lineId) {
        readyLineMap.set(lineId, (readyLineMap.get(lineId) || 0) + (Number(gl.ready_qty) || 0));
      }
    });
  });

  const shippedLineMap = new Map<string, number>();
  activeShipments.forEach((s) => {
    (s.lines ?? s.inbound_shipment_lines ?? []).forEach((sl: any) => {
      const lineId = sl.purchase_order_line_id;
      if (lineId) {
        shippedLineMap.set(lineId, (shippedLineMap.get(lineId) || 0) + (Number(sl.shipped_qty) || 0));
      }
    });
  });

  const receivedLineMap = new Map<string, number>();
  const damagedLineMap = new Map<string, number>();
  const holdLineMap = new Map<string, number>();

  finalizedReceivings.forEach((r) => {
    (r.lines ?? r.receiving_lines ?? []).forEach((rl: any) => {
      const lineId = rl.purchase_order_line_id;
      if (lineId) {
        receivedLineMap.set(lineId, (receivedLineMap.get(lineId) || 0) + (Number(rl.received_qty) || 0));
        damagedLineMap.set(lineId, (damagedLineMap.get(lineId) || 0) + (Number(rl.damaged_qty) || 0));
        holdLineMap.set(lineId, (holdLineMap.get(lineId) || 0) + (Number(rl.hold_qty) || 0));
      }
    });
  });

  const lineSummaries: CanonicalPoLineSummary[] = poLines.map((l: any) => {
    const poQty = Number(l.qty) || 0;
    const confirmedQty = l.confirmed_qty !== null && l.confirmed_qty !== undefined ? Number(l.confirmed_qty) : poQty;
    const readyQty = readyLineMap.get(l.id) || Number(l.ready_qty) || 0;
    const shippedQty = shippedLineMap.get(l.id) || Number(l.shipped_qty) || 0;
    const receivedQty = receivedLineMap.get(l.id) || Number(l.received_qty) || 0;
    const damagedQty = damagedLineMap.get(l.id) || Number(l.damaged_qty) || 0;
    const holdQty = holdLineMap.get(l.id) || Number(l.hold_qty) || 0;
    const damagedHoldQty = damagedQty + holdQty;
    const acceptedQty = Math.max(0, receivedQty - damagedHoldQty);
    const variance = shippedQty > 0 ? (shippedQty - acceptedQty) : Math.max(0, poQty - acceptedQty);

    return {
      id: l.id,
      productId: l.product_id,
      productName: l.product_name || l.product_name_snapshot || l.product?.name || "(제품명 없음)",
      letustoSku: l.letusto_sku || l.letusto_sku_snapshot || l.product?.letusto_sku || "-",
      poQty,
      confirmedQty,
      readyQty,
      shippedQty,
      receivedQty,
      damagedQty,
      holdQty,
      damagedHoldQty,
      acceptedQty,
      variance,
    };
  });

  const lineMap = new Map<string, CanonicalPoLineSummary>(lineSummaries.map((ls) => [ls.id, ls]));

  const totalPoQty = lineSummaries.reduce((sum, l) => sum + l.poQty, 0);
  const totalConfirmedQty = lineSummaries.reduce((sum, l) => sum + l.confirmedQty, 0);
  const totalReadyQty = lineSummaries.reduce((sum, l) => sum + l.readyQty, 0);
  const totalShippedQty = Math.max(
    activeShipments.reduce(
      (sum, s) => sum + (s.lines ?? s.inbound_shipment_lines ?? []).reduce((lSum: number, sl: any) => lSum + (Number(sl.shipped_qty) || 0), 0),
      0
    ),
    lineSummaries.reduce((sum, l) => sum + l.shippedQty, 0)
  );
  const totalReceivedQty = lineSummaries.reduce((sum, l) => sum + l.receivedQty, 0);
  const totalDamagedQty = lineSummaries.reduce((sum, l) => sum + l.damagedQty, 0);
  const totalHoldQty = lineSummaries.reduce((sum, l) => sum + l.holdQty, 0);
  const totalDamagedHoldQty = totalDamagedQty + totalHoldQty;
  const totalAcceptedQty = lineSummaries.reduce((sum, l) => sum + l.acceptedQty, 0);
  const totalVariance = totalShippedQty > 0 ? totalShippedQty - totalAcceptedQty : Math.max(0, totalPoQty - totalAcceptedQty);

  const overallStatus = getOverallStatus(po, shipments, receivings, goodsReadiness);

  return {
    totalPoQty,
    totalConfirmedQty,
    totalReadyQty,
    totalShippedQty,
    totalReceivedQty,
    totalDamagedQty,
    totalHoldQty,
    totalDamagedHoldQty,
    totalAcceptedQty,
    totalVariance,
    lineMap,
    lines: lineSummaries,
    overallStatus,
    hasDraftReceiving: activeReceivings.length > 0,
    hasFinalizedReceiving: finalizedReceivings.length > 0,
    activeReceivingCount: activeReceivings.length,
    finalizedReceivingCount: finalizedReceivings.length,
  };
}
