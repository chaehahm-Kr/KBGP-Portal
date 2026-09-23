"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  transitionPoStatus,
  deleteDraftPo,
  reviewSupplierPoChangeRequest,
  requestPoCancellation,
} from "@/lib/purchase-order/actions";
import {
  getOverallStatus,
  OVERALL_STATUS_LABELS,
  OVERALL_STATUS_COLORS,
  getNextAction,
} from "@/lib/purchase-order/status-helper";
import {
  createInboundShipment,
  createReceiving,
  finalizeReceiving,
  transitionShipmentStatus,
  closeShipmentWithVariance,
} from "@/lib/inbound/actions";
import { PoUnifiedStepper } from "@/components/shared/po-unified-stepper";
import { getEasternTodayString } from "@/lib/utils/timezone";

function formatEasternDate(dStr: string | null | undefined): string {
  if (!dStr) return "-";
  return dStr.includes("T") ? dStr.split("T")[0] : dStr;
}

interface LineItem {
  id: string;
  product_id: string;
  product_name: string;
  letusto_sku: string | null;
  manufacture_sku: string | null;
  qty: number;
  confirmed_qty: number | null;
  unit_cost: number;
  line_total: number;
  line_note: string | null;
  brand_name: string;
  ready_qty?: number;
  shipped_qty?: number;
  received_qty?: number;
  remaining_to_ship?: number;
  remaining_to_receive?: number;
}

interface PurchaseOrderDetailProps {
  po: {
    id: string;
    po_number: string;
    supplier_id: string;
    order_date: string;
    po_status: "DRAFT" | "APPROVED" | "SENT" | "CANCELLED";
    fulfillment_status: "PENDING" | "IN_PRODUCTION" | "READY_TO_SHIP" | "SHIPPED" | "RECEIVED";
    supplier_confirmation_status?: string | null;
    currency: string;
    payment_terms: string | null;
    incoterms: string | null;
    port_of_loading: string | null;
    expected_ready_date: string | null;
    expected_ship_date: string | null;
    eta?: string | null;
    destination_warehouse_id: string;
    ship_from_warehouse_id: string | null;
    po_receiving_email: string | null;
    internal_note: string | null;
    supplier_facing_note: string | null;
    created_at: string;
    updated_at: string;
    created_by: string | null;
    approved_by: string | null;
    approved_at: string | null;
    sent_at: string | null;
    cancelled_by: string | null;
    cancelled_at: string | null;
    supplier: {
      id: string;
      name: string;
      official_name?: string | null;
      address: string | null;
      address_line1?: string | null;
      address_line2?: string | null;
      city_state_zip?: string | null;
      country?: string | null;
      phone?: string | null;
      contact_name?: string | null;
      contact_title?: string | null;
      contact_email?: string | null;
      additional_emails?: string | null;
      business_registration_number: string | null;
    };
    warehouse: {
      id: string;
      name: string;
      code: string;
      address1: string;
      city: string;
      state: string;
      zip_code: string;
      country: string;
    };
    ship_from_warehouse: {
      id: string;
      name: string;
      code: string;
      address1: string;
      city: string;
      state: string;
      zip_code: string;
      country: string;
    } | null;
    creator: { full_name: string } | null;
    approver: { full_name: string } | null;
    canceller: { full_name: string } | null;
    revision_no?: number;
    confirmed_by_id?: string | null;
    confirmed_by_name?: string | null;
    confirmed_at?: string | null;
    cancellation_status?: string | null;
    cancellation_reason?: string | null;
    cancellation_requested_by?: string | null;
    cancellation_requested_at?: string | null;
    cancellation_confirmed_by?: string | null;
    cancellation_confirmed_at?: string | null;
    cancellation_rejected_by?: string | null;
    cancellation_rejected_at?: string | null;
    cancellation_reject_reason?: string | null;
    activity_logs?: any[];
    revisions?: any[];
    linked_cases?: any[];
    lines: LineItem[];
    total_qty: number;
    total_amount: number;
  };
  isReadOnly?: boolean;
  invoices?: Array<{
    id: string;
    internal_ap_number: string;
    supplier_invoice_number: string;
    invoice_total: number;
    currency: string;
    invoice_status: string;
  }>;
  changeRequests?: Array<{
    id: string;
    purchaseOrderLineId: string;
    requestType: string;
    originalQty: number;
    proposedQty: number;
    reason: string;
    status: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";
    reviewNote: string | null;
    createdAt: string;
    updatedAt: string;
    requestedByName: string;
    companyName: string;
  }>;
  shipments?: any[];
  receivings?: any[];
  goodsReadiness?: any[];
  warehouses?: any[];
}

export function PurchaseOrderDetail({
  po,
  isReadOnly = false,
  invoices = [],
  changeRequests = [],
  shipments = [],
  receivings = [],
  goodsReadiness = [],
  warehouses = [],
}: PurchaseOrderDetailProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isPrinting, setIsPrinting] = useState(false);

  // Cancellation modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelCategory, setCancelCategory] = useState("수량/품목 변경");
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  // Collaboration change requests state
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [reviewLoading, setReviewLoading] = useState<string | null>(null);

  // Shipment registration form state
  const [showShipmentForm, setShowShipmentForm] = useState(false);
  const [shippingMethod, setShippingMethod] = useState<"Ocean" | "Air" | "Ground" | "Courier" | "Other">("Ocean");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [containerNumber, setContainerNumber] = useState("");
  const [billOfLading, setBillOfLading] = useState("");
  const [bookingNumber, setBookingNumber] = useState("");
  const [originPort, setOriginPort] = useState("");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState(po.destination_warehouse_id || "");
  const [etd, setEtd] = useState("");
  const [eta, setEta] = useState("");
  const [shipmentLines, setShipmentLines] = useState<Array<{
    purchase_order_line_id: string;
    product_id: string;
    product_name: string;
    letusto_sku: string;
    remaining_to_ship: number;
    shipped_qty: number;
    line_note: string;
  }>>([]);

  // Receiving inspection form state
  const [showReceivingForm, setShowReceivingForm] = useState(false);
  const [selectedShipmentId, setSelectedShipmentId] = useState("");
  const [receivingWarehouseId, setReceivingWarehouseId] = useState(po.destination_warehouse_id || "");
  const [receivedDate, setReceivedDate] = useState(getEasternTodayString());
  const [receivingLines, setReceivingLines] = useState<Array<{
    inbound_shipment_line_id: string;
    purchase_order_line_id: string;
    product_id: string;
    product_name: string;
    letusto_sku: string;
    shipped_qty: number;
    received_qty: number;
    damaged_qty: number;
    hold_qty: number;
    line_note: string;
  }>>([]);

  // Aggregate shipped, received, accepted and variance stats dynamically
  const stats = useMemo(() => {
    const activeShipments = shipments.filter((s) => s.status !== "CANCELLED");
    const finalizedReceivings = receivings.filter((r) => r.status === "FINALIZED");

    const totalShipped = activeShipments.reduce(
      (sum, s) => sum + (s.lines ?? []).reduce((lSum: number, sl: any) => lSum + sl.shipped_qty, 0),
      0
    );

    let totalReceived = 0;
    let totalAccepted = 0;
    let totalDamaged = 0;

    finalizedReceivings.forEach((r) => {
      (r.lines ?? []).forEach((rl: any) => {
        totalReceived += rl.received_qty;
        totalAccepted += rl.received_qty - rl.damaged_qty - rl.hold_qty;
        totalDamaged += rl.damaged_qty;
      });
    });

    const variance = totalAccepted - po.total_qty;

    return {
      shipped: totalShipped,
      received: totalReceived,
      accepted: totalAccepted,
      damaged: totalDamaged,
      variance,
    };
  }, [po.total_qty, shipments, receivings]);

  // Overall status helper calculation
  const overallStatus = useMemo(() => {
    return getOverallStatus(po, shipments, receivings);
  }, [po, shipments, receivings]);

  const nextAction = useMemo(() => {
    return getNextAction(overallStatus, isReadOnly);
  }, [overallStatus, isReadOnly]);

  // Init shipment lines input quantities based on remaining items to ship
  const initShipmentForm = () => {
    const activeShipmentLines = shipments
      .filter((s) => s.status !== "CANCELLED")
      .flatMap((s) => s.lines || []);

    const shippedCountMap = new Map<string, number>();
    activeShipmentLines.forEach((sl) => {
      const cur = shippedCountMap.get(sl.purchase_order_line_id) || 0;
      shippedCountMap.set(sl.purchase_order_line_id, cur + sl.shipped_qty);
    });

    const items = po.lines.map((l) => {
      const shipped = shippedCountMap.get(l.id) || 0;
      const targetQty = l.confirmed_qty !== null && l.confirmed_qty !== undefined ? Number(l.confirmed_qty) : Number(l.qty);
      const remaining = Math.max(0, targetQty - shipped);
      return {
        purchase_order_line_id: l.id,
        product_id: l.product_id,
        product_name: l.product_name,
        letusto_sku: l.letusto_sku || "-",
        remaining_to_ship: remaining,
        shipped_qty: remaining,
        line_note: "",
      };
    });

    setShipmentLines(items);
    setShowShipmentForm(true);
  };

  // Init receiving inspection form
  const initReceivingForm = (shipmentId: string) => {
    const target = shipments.find((s) => s.id === shipmentId);
    if (!target) return;

    // Filter out already received counts for the shipment lines
    const matchedReceivings = receivings.filter(
      (r) => r.inbound_shipment_id === shipmentId && r.status === "FINALIZED"
    );

    const receivedCountMap = new Map<string, number>();
    matchedReceivings.flatMap((r) => r.lines || []).forEach((rl) => {
      const cur = receivedCountMap.get(rl.inbound_shipment_line_id) || 0;
      receivedCountMap.set(rl.inbound_shipment_line_id, cur + rl.received_qty);
    });

    const items = (target.lines || []).map((sl: any) => {
      const already = receivedCountMap.get(sl.id) || 0;
      const remaining = Math.max(0, sl.shipped_qty - already);

      const matchedPoLine = po.lines.find((l) => l.id === sl.purchase_order_line_id);

      return {
        inbound_shipment_line_id: sl.id,
        purchase_order_line_id: sl.purchase_order_line_id,
        product_id: sl.product_id,
        product_name: matchedPoLine?.product_name || "Unknown Product",
        letusto_sku: matchedPoLine?.letusto_sku || "-",
        shipped_qty: sl.shipped_qty,
        received_qty: remaining,
        damaged_qty: 0,
        hold_qty: 0,
        line_note: "",
      };
    });

    setSelectedShipmentId(shipmentId);
    setReceivingLines(items);
    setShowReceivingForm(true);
  };

  // Status transitions
  const handleTransition = async (targetStatus: string) => {
    const label = OVERALL_STATUS_LABELS[targetStatus] || targetStatus;
    if (!confirm(`발주 진행 단계를 "${label}" 상태로 변경하시겠습니까?`)) return;

    setErrorMessage("");
    setSuccessMessage("");
    setIsActionLoading(true);

    try {
      await transitionPoStatus(po.id, targetStatus);
      setSuccessMessage("상태 변경 처리가 완료되었습니다.");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "상태 변경 실패");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Delete Draft
  const handleDelete = async () => {
    if (!confirm("이 초안 발주서를 삭제하시겠습니까? 이 작업은 복구할 수 없습니다.")) return;
    setErrorMessage("");
    setIsActionLoading(true);

    try {
      await deleteDraftPo(po.id);
      router.push("/admin/purchasing");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "삭제 처리 실패");
      setIsActionLoading(false);
    }
  };

  // Cancel or Request Cancellation
  const handleCancelPo = async () => {
    if (po.supplier_confirmation_status === "CONFIRMED") {
      setShowCancelModal(true);
    } else {
      if (!confirm("이 발주서를 즉시 취소하시겠습니까? 공급사 확인 이전이므로 즉시 취소 처리됩니다.")) return;
      await handleTransition("CANCELLED");
    }
  };

  const handleRequestCancellation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelReason.trim()) {
      alert("취소 요청 사유를 입력해주세요.");
      return;
    }
    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmittingCancel(true);

    try {
      await requestPoCancellation(po.id, cancelReason, cancelCategory);
      setSuccessMessage("공급사에게 발주 취소 동의 요청을 발송하였습니다.");
      setShowCancelModal(false);
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "취소 요청 실패");
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  // Submit Shipment inline
  const handleSubmitShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsActionLoading(true);

    const validLines = shipmentLines
      .filter((l) => l.shipped_qty > 0)
      .map((l) => ({
        purchase_order_line_id: l.purchase_order_line_id,
        product_id: l.product_id,
        shipped_qty: l.shipped_qty,
        line_note: l.line_note,
      }));

    if (validLines.length === 0) {
      setErrorMessage("선적 대상 품목의 출고 수량을 1개 이상 입력해주세요.");
      setIsActionLoading(false);
      return;
    }

    try {
      await createInboundShipment({
        purchase_order_id: po.id,
        shipping_method: shippingMethod,
        carrier,
        tracking_number: trackingNumber,
        container_number: containerNumber,
        bill_of_lading: billOfLading,
        booking_number: bookingNumber,
        origin_port: originPort,
        destination_warehouse_id: destinationWarehouseId,
        etd: etd || undefined,
        eta: eta || undefined,
        lines: validLines,
      });

      setSuccessMessage("선적이 성공적으로 등록되었습니다.");
      setShowShipmentForm(false);
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "선적 등록 실패");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Submit Receiving inline
  const handleSubmitReceiving = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsActionLoading(true);

    const validLines = receivingLines
      .filter((l) => l.received_qty > 0)
      .map((l) => ({
        inbound_shipment_line_id: l.inbound_shipment_line_id,
        purchase_order_line_id: l.purchase_order_line_id,
        product_id: l.product_id,
        received_qty: l.received_qty,
        damaged_qty: l.damaged_qty,
        hold_qty: l.hold_qty,
        line_note: l.line_note,
      }));

    if (validLines.length === 0) {
      setErrorMessage("실제 입고 수량이 기록된 품목이 없습니다.");
      setIsActionLoading(false);
      return;
    }

    try {
      await createReceiving({
        inbound_shipment_id: selectedShipmentId,
        purchase_order_id: po.id,
        warehouse_id: receivingWarehouseId,
        received_date: receivedDate,
        lines: validLines,
      });

      setSuccessMessage("입고서 초안이 생성되었습니다. 입고 및 검수 탭에서 입고 확정을 진행하십시오.");
      setShowReceivingForm(false);
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "입고 검수서 등록 실패");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Finalize Receiving
  const handleFinalizeReceiving = async (recId: string) => {
    if (!confirm("입고 검수를 종결하고 실재고 가산 및 발주 이행 상태를 확정하시겠습니까?")) return;
    setErrorMessage("");
    setSuccessMessage("");
    setIsActionLoading(true);

    try {
      await finalizeReceiving(recId);
      setSuccessMessage("입고 처리가 확정 완료되었습니다.");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "입고 확정 처리 중 오류가 발생했습니다.");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Update Shipment Status (BOOKED, IN_TRANSIT, ARRIVED, etc.)
  const handleShipmentStatusChange = async (shipmentId: string, status: string) => {
    if (!confirm(`선적 상태를 "${status}" 상태로 전이하시겠습니까?`)) return;
    setErrorMessage("");
    setSuccessMessage("");
    setIsActionLoading(true);

    try {
      await transitionShipmentStatus(shipmentId, status);
      setSuccessMessage("선적물 상태가 전이 완료되었습니다.");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "선적 상태 전이 실패");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Close shipment with variance
  const handleCloseShipmentVariance = async (shipmentId: string) => {
    const note = prompt("수량 차이 종결 처리에 대한 사유를 입력하십시오:");
    if (note === null) return;

    setErrorMessage("");
    setSuccessMessage("");
    setIsActionLoading(true);

    try {
      await closeShipmentWithVariance(shipmentId, note);
      setSuccessMessage("선적 수량 차이 강제 종결 처리가 완료되었습니다.");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "종결 처리 실패");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Collaboration change requests
  const handleReviewRequest = async (requestId: string, status: "APPROVE" | "REJECT") => {
    const note = reviewNotes[requestId] || "";
    if (status === "REJECT" && !note.trim()) {
      alert("반려 시에는 반드시 반려 사유를 입력해야 합니다.");
      return;
    }

    setReviewLoading(requestId);
    setErrorMessage("");
    try {
      await reviewSupplierPoChangeRequest(po.id, requestId, status, note);
      setSuccessMessage("변경 요청 심사 처리가 정상 완료되었습니다.");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "변경 제안 심사 실패");
    } finally {
      setReviewLoading(null);
    }
  };

  // Print PDF helper trigger
  const handlePrint = () => {
    setIsPrinting(true);
  };

  useEffect(() => {
    if (isPrinting) {
      window.print();
      const timer = setTimeout(() => {
        setIsPrinting(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isPrinting]);

  // If in Print Mode, render standard Invoice/PO PDF printable layout
  if (isPrinting) {
    const s = po.supplier || {};
    return (
      <div className="p-8 space-y-6 bg-white text-zinc-900 border-2 border-zinc-950 max-w-4xl mx-auto font-sans print:p-0 print:border-none">
        {/* Document Header */}
        <div className="flex justify-between items-start border-b-2 border-zinc-950 pb-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-950">LETUSTO INC.</h1>
            <p className="text-xs text-zinc-600 font-medium">B2B Global Select Network Brand Sourcing Platform</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-black tracking-tight text-zinc-900">PURCHASE ORDER</h2>
            <p className="text-xs font-mono font-bold text-zinc-800">PO Number: {po.po_number}</p>
            <p className="text-[11px] text-zinc-600">Date: {formatEasternDate(po.order_date)}</p>
          </div>
        </div>

        {/* Issued By & Issued To */}
        <div className="grid grid-cols-2 gap-8 text-xs border-b border-zinc-300 pb-4">
          <div className="space-y-1 bg-zinc-50/60 p-3 rounded-lg border border-zinc-200">
            <span className="text-[9px] text-zinc-400 block uppercase font-bold tracking-wider">ISSUED BY (Buyer)</span>
            <p className="font-bold text-zinc-950 text-sm">Letusto Inc.</p>
            <p className="text-zinc-700">23B Roland Ave.</p>
            <p className="text-zinc-700">Mount Laurel, NJ 08054</p>
            <p className="text-zinc-700 font-medium">United States</p>
            <div className="pt-2 text-[11px] text-zinc-700 space-y-0.5 border-t border-zinc-200 mt-2">
              <p><span className="text-zinc-500 font-medium">Phone:</span> 856-383-8288</p>
              <p><span className="text-zinc-500 font-medium">Email:</span> Contact@letusto.com</p>
            </div>
          </div>

          <div className="space-y-1 bg-zinc-50/60 p-3 rounded-lg border border-zinc-200">
            <span className="text-[9px] text-zinc-400 block uppercase font-bold tracking-wider">ISSUED TO (Supplier)</span>
            <p className="font-bold text-zinc-950 text-sm">{s.official_name || s.name || "Supplier Company"}</p>
            {s.address_line1 && <p className="text-zinc-700">{s.address_line1}</p>}
            {s.address_line2 && <p className="text-zinc-700">{s.address_line2}</p>}
            {s.city_state_zip && <p className="text-zinc-700">{s.city_state_zip}</p>}
            {s.country && <p className="text-zinc-700 font-medium">{s.country}</p>}
            <div className="pt-2 text-[11px] text-zinc-700 space-y-0.5 border-t border-zinc-200 mt-2">
              {s.phone && <p><span className="text-zinc-500 font-medium">Phone:</span> {s.phone}</p>}
              {s.contact_name && (
                <p><span className="text-zinc-500 font-medium">Contact:</span> {s.contact_name} {s.contact_title ? `(${s.contact_title})` : ""}</p>
              )}
              {s.contact_email && <p><span className="text-zinc-500 font-medium">Email:</span> {s.contact_email}</p>}
              {s.additional_emails && (
                <p className="text-[10px] text-zinc-500"><span className="font-medium">Additional Recipient:</span> {s.additional_emails}</p>
              )}
            </div>
          </div>
        </div>

        {/* PO Terms & Commercial Conditions */}
        <div className="border border-zinc-200 rounded-lg p-3 bg-zinc-50/70 text-xs">
          <span className="text-[9px] text-zinc-400 block uppercase font-bold tracking-wider mb-2">Order Terms & Logistics Conditions</span>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-2.5 gap-x-4">
            <div>
              <span className="text-[10px] text-zinc-400 block">Payment Terms</span>
              <span className="font-bold text-zinc-900">{po.payment_terms || "-"}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 block">Incoterms</span>
              <span className="font-bold text-zinc-900">{po.incoterms || "-"}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 block">Port of Loading</span>
              <span className="font-medium text-zinc-900">{po.port_of_loading || "-"}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 block">Currency</span>
              <span className="font-mono font-bold text-zinc-900">{po.currency || "USD"}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 block">Ship From</span>
              <span className="font-medium text-zinc-900">
                {po.ship_from_warehouse?.name || s.address_line1 || "-"}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 block">Destination (Ship To)</span>
              <span className="font-medium text-zinc-900">
                {po.warehouse ? `${po.warehouse.name} [${po.warehouse.code}]` : "-"}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 block">Ready Date (생산완료)</span>
              <span className="font-medium text-zinc-900">{po.expected_ready_date ? formatEasternDate(po.expected_ready_date) : "-"}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 block">ETD / ETA</span>
              <span className="font-medium text-zinc-900">
                {po.expected_ship_date ? formatEasternDate(po.expected_ship_date) : "-"} → {po.eta ? formatEasternDate(po.eta) : "-"}
              </span>
            </div>
          </div>
        </div>

        {/* Order Line Items */}
        <div className="space-y-3">
          <h3 className="font-black text-zinc-950 uppercase border-b border-zinc-900 pb-1 text-xs tracking-wider">Order Line Items</h3>
          <table className="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr className="border-b border-zinc-950 font-bold text-zinc-900 bg-zinc-100">
                <th className="py-2 px-2">Brand</th>
                <th className="py-2 px-2">SKU Details</th>
                <th className="py-2 px-2">Product Description</th>
                <th className="py-2 px-2 text-right">Quantity</th>
                <th className="py-2 px-2 text-right">Unit Price</th>
                <th className="py-2 px-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {po.lines.map((l: any) => (
                <tr key={l.id} className="align-top">
                  <td className="py-2 px-2 font-medium text-zinc-700">{l.brand_name}</td>
                  <td className="py-2 px-2 font-mono text-[10px]">
                    {l.letusto_sku && <div><span className="text-zinc-400">Letusto:</span> <span className="font-bold">{l.letusto_sku}</span></div>}
                    {l.manufacture_sku && <div><span className="text-zinc-400">Mfr:</span> {l.manufacture_sku}</div>}
                    {!l.letusto_sku && !l.manufacture_sku && <span>-</span>}
                  </td>
                  <td className="py-2 px-2">
                    <p className="font-bold text-zinc-950">{l.product_name}</p>
                    {l.line_note && <p className="text-[10px] text-zinc-500 mt-0.5">Note: {l.line_note}</p>}
                  </td>
                  <td className="py-2 px-2 text-right font-mono font-bold">{l.qty.toLocaleString()}</td>
                  <td className="py-2 px-2 text-right font-mono">
                    {po.currency} {l.unit_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-2 text-right font-mono font-bold">
                    {po.currency} {l.line_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Calculation */}
        <div className="flex justify-end pt-2">
          <div className="w-72 border-t-2 border-zinc-950 p-3 space-y-1.5 font-bold text-right text-xs bg-zinc-50/50 rounded-b-lg">
            <div className="flex justify-between text-zinc-600 text-[11px]">
              <span>Total Quantity:</span>
              <span className="font-mono text-zinc-950 font-bold">{po.total_qty.toLocaleString()} PCS</span>
            </div>
            <div className="flex justify-between border-t border-zinc-300 pt-1.5 text-sm text-zinc-950">
              <span>Total Amount ({po.currency}):</span>
              <span className="font-mono font-black">
                {po.currency} {po.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Supplier Note (Supplier-facing only) */}
        {po.supplier_facing_note && (
          <div className="border border-zinc-300 rounded-lg p-3 bg-zinc-50/70 space-y-1 text-xs">
            <span className="text-[10px] text-zinc-500 block uppercase font-bold tracking-wider">SUPPLIER NOTE / 공급사 전달 메모</span>
            <p className="text-zinc-800 whitespace-pre-wrap">{po.supplier_facing_note}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb / Actions header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Link
          href="/admin/purchasing"
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors inline-flex items-center gap-1"
        >
          ← 발주 목록으로 돌아가기
        </Link>
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            🖨️ PDF / 인쇄 화면
          </button>
          {!isReadOnly && po.po_status !== "CANCELLED" && (
            <Link
              href={`/admin/purchasing/${po.id}/edit`}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60 text-xs font-bold rounded-lg transition-colors"
            >
              ✏️ 발주 수정 {po.po_status === "SENT" ? "(개정/Revision)" : ""}
            </Link>
          )}
          {!isReadOnly && po.po_status === "DRAFT" && (
            <button
              onClick={handleDelete}
              disabled={isActionLoading}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              🗑️ 초안 삭제
            </button>
          )}
          {!isReadOnly && po.po_status !== "CANCELLED" && po.po_status !== "DRAFT" && po.cancellation_status !== "CANCELLATION_REQUESTED" && (
            <button
              onClick={handleCancelPo}
              disabled={isActionLoading}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              ❌ {po.supplier_confirmation_status === "CONFIRMED" ? "발주 취소 요청" : "발주 취소"}
            </button>
          )}
        </div>
      </div>

      {/* Cancellation Request Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-lg w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-150 pb-3 dark:border-zinc-800">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                ⚠️ 발주 취소 동의 요청 (공급사 확인 완료건)
              </h3>
              <button
                onClick={() => setShowCancelModal(false)}
                className="text-zinc-400 hover:text-zinc-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              이미 공급사가 발주를 확인(Confirmed)하였으므로, 일방적 취소가 불가하며 공급사의 동의(취소 승인)가 필요합니다. 취소 요청 사유를 작성해주세요.
            </p>
            <form onSubmit={handleRequestCancellation} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                  취소 사유 구분
                </label>
                <select
                  value={cancelCategory}
                  onChange={(e) => setCancelCategory(e.target.value)}
                  className="w-full text-xs rounded-lg border border-zinc-300 p-2 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                >
                  <option value="수량/품목 변경">수량/품목 변경</option>
                  <option value="고객사 주문 취소">고객사 주문 취소</option>
                  <option value="납기 지연 우려">납기 지연 우려</option>
                  <option value="가격 및 거래조건 불일치">가격 및 거래조건 불일치</option>
                  <option value="기타 사유">기타 사유</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                  상세 취소 사유 (공급사 전달) *
                </label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="공급사에 전달할 구체적인 발주 취소 사유를 입력하세요."
                  required
                  className="w-full text-xs rounded-lg border border-zinc-300 p-2.5 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  닫기
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCancel}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingCancel ? "전송 중..." : "취소 요청 발송"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unified 6-Step PO Progress Stepper & Alerts */}
      <PoUnifiedStepper
        overallStatus={overallStatus}
        revisionNo={po.revision_no}
        supplierConfirmationStatus={po.supplier_confirmation_status}
        confirmedByName={po.confirmed_by_name}
        confirmedAt={po.confirmed_at}
        cancellationStatus={po.cancellation_status}
        cancellationReason={po.cancellation_reason}
        cancellationRequestedAt={po.cancellation_requested_at}
        cancellationRejectReason={po.cancellation_reject_reason}
        cancellationRejectedAt={po.cancellation_rejected_at}
        nextActionSlot={
          nextAction && !nextAction.disabled ? (
            <button
              onClick={() => {
                if (nextAction.action === "approve") handleTransition("APPROVED");
                else if (nextAction.action === "send") handleTransition("SENT");
                else if (nextAction.action === "ready_to_ship") handleTransition("READY_TO_SHIP");
                else if (nextAction.action === "create_shipment") initShipmentForm();
                else if (nextAction.action === "create_receiving") {
                  const activeShipments = shipments.filter(
                    (s) => s.status === "ARRIVED" || s.status === "PARTIALLY_RECEIVED"
                  );
                  if (activeShipments.length > 0) initReceivingForm(activeShipments[0].id);
                  else alert("도착 처리된 선적이 존재하지 않습니다. 먼저 선적을 Arrived 상태로 변경해주십시오.");
                } else if (nextAction.action === "finalize") {
                  const drafts = receivings.filter((r) => r.status === "DRAFT");
                  if (drafts.length > 0) handleFinalizeReceiving(drafts[0].id);
                }
              }}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-all shadow-sm flex items-center gap-1.5"
            >
              <span>{nextAction.label}</span>
              <span>→</span>
            </button>
          ) : null
        }
      />

      {/* Overview stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 text-center">
          <span className="text-[10px] text-zinc-400 block uppercase font-bold">발주 수량</span>
          <span className="text-sm font-bold font-mono text-zinc-900 dark:text-white">{po.total_qty.toLocaleString()}</span>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 text-center">
          <span className="text-[10px] text-zinc-400 block uppercase font-bold">출고 완료 수량</span>
          <span className="text-sm font-bold font-mono text-zinc-700 dark:text-zinc-300">{stats.shipped.toLocaleString()}</span>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 text-center">
          <span className="text-[10px] text-zinc-400 block uppercase font-bold">입고 수량</span>
          <span className="text-sm font-bold font-mono text-zinc-700 dark:text-zinc-300">{stats.received.toLocaleString()}</span>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 text-center">
          <span className="text-[10px] text-zinc-400 block uppercase font-bold">최종 승인 수량</span>
          <span className="text-sm font-bold font-mono text-emerald-600">{stats.accepted.toLocaleString()}</span>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 text-center">
          <span className="text-[10px] text-zinc-400 block uppercase font-bold">불량/대기 수량</span>
          <span className="text-sm font-bold font-mono text-rose-600">{stats.damaged.toLocaleString()}</span>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 text-center">
          <span className="text-[10px] text-zinc-400 block uppercase font-bold">미입고/차이(Variance)</span>
          <span className={`text-sm font-bold font-mono ${stats.variance < 0 ? "text-rose-600" : "text-emerald-600"}`}>
            {stats.variance.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="border-b border-zinc-200 dark:border-zinc-850">
        <nav className="flex space-x-6 text-xs font-bold overflow-x-auto">
          {[
            { id: "overview", label: "발주 개요 (Overview)" },
            { id: "products", label: "품목 리스트 (Products)" },
            { id: "shipment", label: "선적 관리 (Shipments)" },
            { id: "receiving", label: "입고 및 검수 (Receiving)" },
            { id: "documents", label: "증빙 서류 (Documents)" },
            { id: "activity", label: "활동 내역 (Activity)" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-4 whitespace-nowrap cursor-pointer border-b-2 transition-all ${
                activeTab === tab.id
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-zinc-400 hover:text-zinc-650"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Contents */}
      <div className="space-y-6">
        {/* Tab 1: Overview */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
            {/* General details */}
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
                <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-150 pb-2 dark:border-zinc-850">
                  발주 상세 조건
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] text-zinc-400 block mb-0.5">발주일자</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-250">{po.order_date}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block mb-0.5">정산 화폐</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-250 font-mono">{po.currency}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block mb-0.5">대금 지급 조건 (Payment Terms)</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-250">{po.payment_terms || "-"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block mb-0.5">인코텀즈 (Incoterms)</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-250">{po.incoterms || "-"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block mb-0.5">출고지 창고 (Ship From)</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-250">
                      {po.ship_from_warehouse ? `[${po.ship_from_warehouse.code}] ${po.ship_from_warehouse.name}` : "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block mb-0.5">목적지 창고 (Ship To)</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-250">
                      [{po.warehouse.code}] {po.warehouse.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block mb-0.5">선적항 (Port of Loading)</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-250">{po.port_of_loading || "-"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block mb-0.5">생산완료예정일 (Ready Date)</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-250">{po.expected_ready_date || "-"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block mb-0.5">ETD (예상 출발일)</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-250">{po.expected_ship_date || "-"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block mb-0.5">ETA (예상 도착일)</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-250 font-mono">{po.eta || "-"}</span>
                  </div>
                </div>
              </div>

              {/* Memos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-2">
                  <h4 className="font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wide">내부 관리 메모</h4>
                  <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap font-medium">
                    {po.internal_note || <span className="text-zinc-350 italic font-normal">등록된 내부 메모가 없습니다.</span>}
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-2">
                  <h4 className="font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wide">공급사 전달 메모</h4>
                  <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap font-medium">
                    {po.supplier_facing_note || <span className="text-zinc-350 italic font-normal">등록된 공급사 전달 메모가 없습니다.</span>}
                  </p>
                </div>
              </div>
              {/* Linked Inquiries / Cases */}
              {po.linked_cases && po.linked_cases.length > 0 && (
                <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
                  <h4 className="font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wide flex items-center justify-between">
                    <span>🔗 연계된 파트너 문의 / 케이스 (Linked Cases)</span>
                    <span className="text-xs text-indigo-600 font-mono">{po.linked_cases.length}건</span>
                  </h4>
                  <div className="divide-y divide-zinc-150 dark:divide-zinc-800">
                    {po.linked_cases.map((cs: any) => (
                      <div key={cs.id} className="py-2.5 flex justify-between items-center text-xs">
                        <div>
                          <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                            <span className="font-mono text-zinc-500">[{cs.inquiry_number}]</span>
                            <span>{cs.title}</span>
                          </div>
                          <div className="text-[10px] text-zinc-400 mt-0.5">
                            유형: {cs.inquiry_type} | 접수: {formatEasternDate(cs.created_at)}
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          cs.status === "OPEN" ? "bg-amber-50 text-amber-700" :
                          cs.status === "IN_PROGRESS" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"
                        }`}>
                          {cs.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Revision History */}
              {po.revisions && po.revisions.length > 0 && (
                <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
                  <h4 className="font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wide">
                    📜 발주 개정 이력 (Revision History)
                  </h4>
                  <div className="divide-y divide-zinc-150 dark:divide-zinc-800 text-xs">
                    {po.revisions.map((rev: any, idx: number) => (
                      <div key={idx} className="py-3 space-y-1">
                        <div className="flex justify-between items-center font-bold">
                          <span className="text-purple-600 dark:text-purple-400">Rev {rev.revision_no} 스냅샷</span>
                          <span className="text-zinc-400 text-[10px]">{formatEasternDate(rev.revised_at)}</span>
                        </div>
                        <div className="text-zinc-600 dark:text-zinc-400 text-[11px] grid grid-cols-3 gap-2">
                          <div>총 수량: {rev.total_qty?.toLocaleString()} PCS</div>
                          <div>총 금액: {po.currency} {rev.total_amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                          <div>품목수: {rev.lines?.length || 0}개 품목</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right column: Supplier Profile */}
            <div className="lg:col-span-1 space-y-6">
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
                <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-150 pb-2 dark:border-zinc-850">
                  공급업체 정보
                </h3>
                <div className="space-y-2.5">
                  <div>
                    <span className="text-[10px] text-zinc-400 block">업체명</span>
                    <span className="font-bold text-zinc-850 dark:text-white block">{po.supplier.name}</span>
                  </div>
                  {po.supplier.business_registration_number && (
                    <div>
                      <span className="text-[10px] text-zinc-400 block">사업자 등록 번호</span>
                      <span className="font-mono text-zinc-700 dark:text-zinc-300">{po.supplier.business_registration_number}</span>
                    </div>
                  )}
                  {po.po_receiving_email && (
                    <div>
                      <span className="text-[10px] text-zinc-400 block">발주 수신 이메일</span>
                      <span className="font-mono text-zinc-700 dark:text-zinc-300">{po.po_receiving_email}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Products */}
        {activeTab === "products" && (
          <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/50 text-zinc-550 font-bold dark:border-zinc-850 dark:bg-zinc-900/50 dark:text-white">
                    <th className="px-4 py-3.5">브랜드</th>
                    <th className="px-4 py-3.5 font-mono">Letusto SKU</th>
                    <th className="px-4 py-3.5">제품 설명</th>
                    <th className="px-4 py-3.5 text-right">주문 수량 (PO)</th>
                    <th className="px-4 py-3.5 text-right">공급사 확정 (Confirmed)</th>
                    <th className="px-4 py-3.5 text-right">출고 준비 (Ready)</th>
                    <th className="px-4 py-3.5 text-right">출고 수량 (Shipped)</th>
                    <th className="px-4 py-3.5 text-right">입고 완료 (Received)</th>
                    <th className="px-4 py-3.5 text-right">단가</th>
                    <th className="px-4 py-3.5 text-right">합계</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800/80">
                  {po.lines.map((l) => {
                    const targetQty = (l.confirmed_qty !== null && l.confirmed_qty !== undefined) ? Number(l.confirmed_qty) : Number(l.qty);
                    const readyQty = Number(l.ready_qty || 0);
                    const shippedQty = Number(l.shipped_qty || 0);
                    const receivedQty = Number(l.received_qty || 0);
                    return (
                      <tr key={l.id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-850/10">
                        <td className="px-4 py-3 font-semibold text-zinc-650 dark:text-zinc-400">{l.brand_name}</td>
                        <td className="px-4 py-3 font-mono font-bold">{l.letusto_sku || "-"}</td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-zinc-900 dark:text-white block">{l.product_name}</span>
                          {l.line_note && <span className="text-[10px] text-zinc-450 italic mt-0.5 block">{l.line_note}</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">{l.qty.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">
                          {l.confirmed_qty !== null && l.confirmed_qty !== undefined ? (
                            <span className={l.confirmed_qty !== l.qty ? "text-amber-600 dark:text-amber-400 font-bold" : "text-emerald-600 dark:text-emerald-400"}>
                              {l.confirmed_qty.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-zinc-400 italic">미확정 ({l.qty.toLocaleString()})</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-indigo-600 dark:text-indigo-400 font-bold">
                          {readyQty.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">{shippedQty.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {receivedQty.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {po.currency} {l.unit_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold">
                          {po.currency} {l.line_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Shipments */}
        {activeTab === "shipment" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-zinc-800 dark:text-white">선적 내역 (Shipment Logs)</h3>
              {!isReadOnly && po.po_status === "SENT" && (
                <button
                  onClick={initShipmentForm}
                  className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  + 신규 선적 등록 (Create Shipment)
                </button>
              )}
            </div>

            {/* Shipment Form inline */}
            {showShipmentForm && (
              <form onSubmit={handleSubmitShipment} className="rounded-xl border border-zinc-300 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/50 space-y-4">
                <div className="flex justify-between items-center border-b border-zinc-200 pb-2 dark:border-zinc-800">
                  <h4 className="font-bold text-zinc-900 dark:text-white text-xs">📦 신규 선적물 등록 정보</h4>
                  <button
                    type="button"
                    onClick={() => setShowShipmentForm(false)}
                    className="text-zinc-400 hover:text-zinc-650 cursor-pointer"
                  >
                    취소 (Close)
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-zinc-500 mb-1">운송 수단</label>
                    <select
                      value={shippingMethod}
                      onChange={(e) => setShippingMethod(e.target.value as any)}
                      className="w-full rounded-lg border-zinc-300 text-xs py-1.5 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    >
                      <option value="Ocean">Ocean (해상)</option>
                      <option value="Air">Air (항공)</option>
                      <option value="Ground">Ground (육상)</option>
                      <option value="Courier">Courier (특송)</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-500 mb-1">운송사 (Carrier)</label>
                    <input
                      type="text"
                      placeholder="DHL, Fedex, Maersk 등"
                      value={carrier}
                      onChange={(e) => setCarrier(e.target.value)}
                      className="w-full rounded-lg border-zinc-300 text-xs py-1.5 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-500 mb-1">송장/트래킹 번호</label>
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      className="w-full rounded-lg border-zinc-300 text-xs py-1.5 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-500 mb-1">ETD (출항예정일)</label>
                    <input
                      type="date"
                      value={etd}
                      onChange={(e) => setEtd(e.target.value)}
                      onClick={(e) => (e.target as any).showPicker?.()}
                      className="w-full rounded-lg border-zinc-300 text-xs py-1.5 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-500 mb-1">ETA (도착예정일)</label>
                    <input
                      type="date"
                      value={eta}
                      onChange={(e) => setEta(e.target.value)}
                      onClick={(e) => (e.target as any).showPicker?.()}
                      className="w-full rounded-lg border-zinc-300 text-xs py-1.5 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-500 mb-1">입고 목적지 창고</label>
                    <select
                      value={destinationWarehouseId}
                      onChange={(e) => setDestinationWarehouseId(e.target.value)}
                      className="w-full rounded-lg border-zinc-300 text-xs py-1.5 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    >
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          [{w.code}] {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-500 mb-1">Container Number</label>
                    <input
                      type="text"
                      value={containerNumber}
                      onChange={(e) => setContainerNumber(e.target.value)}
                      className="w-full rounded-lg border-zinc-300 text-xs py-1.5 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-500 mb-1">B/L (Bill of Lading)</label>
                    <input
                      type="text"
                      value={billOfLading}
                      onChange={(e) => setBillOfLading(e.target.value)}
                      className="w-full rounded-lg border-zinc-300 text-xs py-1.5 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-500 mb-1">Booking Number</label>
                    <input
                      type="text"
                      value={bookingNumber}
                      onChange={(e) => setBookingNumber(e.target.value)}
                      className="w-full rounded-lg border-zinc-300 text-xs py-1.5 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    />
                  </div>
                </div>

                {/* Line quantities input */}
                <div className="space-y-2 pt-2">
                  <h5 className="font-bold text-zinc-800 dark:text-zinc-300 text-xs">선적 대상 품목 수량</h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px] border-collapse bg-white dark:bg-zinc-950 rounded-lg">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50/50 text-zinc-550 font-bold dark:border-zinc-850 dark:bg-zinc-900/50 dark:text-white">
                          <th className="p-2.5">제품명 / SKU</th>
                          <th className="p-2.5 text-right">미선적 잔량</th>
                          <th className="p-2.5 text-right w-32">이번 출고 수량</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800">
                        {shipmentLines.map((line, idx) => (
                          <tr key={line.purchase_order_line_id} className="align-middle">
                            <td className="p-2.5">
                              <span className="font-bold block text-zinc-850 dark:text-zinc-300">{line.product_name}</span>
                              <span className="font-mono text-[10px] text-zinc-450">{line.letusto_sku}</span>
                            </td>
                            <td className="p-2.5 text-right font-mono font-semibold">{line.remaining_to_ship}개</td>
                            <td className="p-2.5 text-right">
                              <input
                                type="number"
                                min={0}
                                max={line.remaining_to_ship}
                                value={line.shipped_qty}
                                onChange={(e) => {
                                  const updated = [...shipmentLines];
                                  updated[idx].shipped_qty = Number(e.target.value);
                                  setShipmentLines(updated);
                                }}
                                className="w-24 text-right rounded-md border-zinc-300 text-xs px-2 py-1 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white focus:ring-indigo-500"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setShowShipmentForm(false)}
                    className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-lg cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    선적 정보 저장
                  </button>
                </div>
              </form>
            )}

            {/* List existing shipments */}
            <div className="grid grid-cols-1 gap-6">
              {shipments.length === 0 ? (
                <div className="py-12 border-2 border-dashed border-zinc-200 dark:border-zinc-850 rounded-xl text-center text-zinc-500">
                  현재 등록된 선적 내역이 없습니다.
                </div>
              ) : (
                shipments.map((shp) => (
                  <div key={shp.id} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
                    <div className="flex justify-between items-center border-b border-zinc-150 pb-3 dark:border-zinc-850">
                      <div>
                        <span className="font-mono text-sm font-bold text-zinc-900 dark:text-white">{shp.shipment_number}</span>
                        <span className="ml-2.5 text-[10px] font-bold text-zinc-400">({shp.shipping_method})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {shp.status !== "RECEIVED" && shp.status !== "CANCELLED" && !isReadOnly && (
                          <div className="flex gap-1.5">
                            {shp.status === "BOOKED" && (
                              <button
                                onClick={() => handleShipmentStatusChange(shp.id, "IN_TRANSIT")}
                                className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold rounded"
                              >
                                출항/운송중 (Transit)
                              </button>
                            )}
                            {shp.status === "IN_TRANSIT" && (
                              <button
                                onClick={() => handleShipmentStatusChange(shp.id, "ARRIVED")}
                                className="px-2 py-1 bg-cyan-600 hover:bg-cyan-700 text-white text-[10px] font-bold rounded"
                              >
                                창고 도착 (Arrived)
                              </button>
                            )}
                            {shp.status === "ARRIVED" && (
                              <button
                                onClick={() => handleCloseShipmentVariance(shp.id)}
                                className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded"
                              >
                                차이 종결 (Close Variance)
                              </button>
                            )}
                          </div>
                        )}
                        <span className="px-2 py-0.5 bg-zinc-100 text-zinc-650 border border-zinc-200 rounded text-[10px] font-bold dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
                          {shp.status}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      <div>
                        <span className="text-[10px] text-zinc-400 block">운송사 (Carrier)</span>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-300">{shp.carrier || "-"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-400 block">B/L (Bill of Lading)</span>
                        <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-300">{shp.bill_of_lading || "-"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-400 block">ETD (출항일자)</span>
                        <span className="font-mono text-zinc-800 dark:text-zinc-300">{shp.etd || "-"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-400 block">ETA (도착일자)</span>
                        <span className="font-mono text-zinc-800 dark:text-zinc-300">{shp.eta || "-"}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Receiving & Inspection */}
        {activeTab === "receiving" && (
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-white">창고 입고 및 실물 검수 정보</h3>

            {/* Waiting shipments list */}
            {shipments.filter(s => s.status === "ARRIVED" || s.status === "PARTIALLY_RECEIVED").length > 0 && !isReadOnly && (
              <div className="rounded-xl border border-amber-250 bg-amber-50/20 p-5 space-y-3 dark:border-amber-900/50">
                <h4 className="font-bold text-amber-800 dark:text-amber-400 text-xs">📥 대기 중인 입고 검수 대상 선적물</h4>
                <div className="space-y-2">
                  {shipments
                    .filter((s) => s.status === "ARRIVED" || s.status === "PARTIALLY_RECEIVED")
                    .map((shp) => (
                      <div key={shp.id} className="flex justify-between items-center bg-white dark:bg-zinc-950 p-3 rounded-lg border border-zinc-150 dark:border-zinc-850 text-xs">
                        <div>
                          <span className="font-mono font-bold text-zinc-850 dark:text-zinc-250">{shp.shipment_number}</span>
                          <span className="ml-2 text-zinc-450">ETA: {shp.eta || "-"} | 목적지: {shp.warehouse?.name}</span>
                        </div>
                        <button
                          onClick={() => initReceivingForm(shp.id)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
                        >
                          실물 입고 검수 시작
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Receiving Form inline */}
            {showReceivingForm && (
              <form onSubmit={handleSubmitReceiving} className="rounded-xl border border-zinc-300 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/50 space-y-4">
                <div className="flex justify-between items-center border-b border-zinc-200 pb-2 dark:border-zinc-800">
                  <h4 className="font-bold text-zinc-900 dark:text-white text-xs">📥 창고 실물 입고 검수 기록 등록</h4>
                  <button
                    type="button"
                    onClick={() => setShowReceivingForm(false)}
                    className="text-zinc-400 hover:text-zinc-650 cursor-pointer"
                  >
                    취소 (Close)
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-zinc-500 mb-1">실제 입고일자 (Received Date)</label>
                    <input
                      type="date"
                      value={receivedDate}
                      onChange={(e) => setReceivedDate(e.target.value)}
                      onClick={(e) => (e.target as any).showPicker?.()}
                      className="w-full rounded-lg border-zinc-300 text-xs py-1.5 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-500 mb-1">실물 검수 창고 (Warehouse)</label>
                    <select
                      value={receivingWarehouseId}
                      onChange={(e) => setReceivingWarehouseId(e.target.value)}
                      className="w-full rounded-lg border-zinc-300 text-xs py-1.5 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    >
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          [{w.code}] {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Line quantities input */}
                <div className="space-y-2 pt-2">
                  <h5 className="font-bold text-zinc-800 dark:text-zinc-300 text-xs">실제 품목 검수 결과</h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px] border-collapse bg-white dark:bg-zinc-950 rounded-lg">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50/50 text-zinc-550 font-bold dark:border-zinc-850 dark:bg-zinc-900/50 dark:text-white">
                          <th className="p-2.5">제품명 / SKU</th>
                          <th className="p-2.5 text-right">선적 수량</th>
                          <th className="p-2.5 text-right w-24">정상입고 (Good)</th>
                          <th className="p-2.5 text-right w-24">불량파손 (Damaged)</th>
                          <th className="p-2.5 text-right w-24">검수보류 (Hold)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800">
                        {receivingLines.map((line, idx) => (
                          <tr key={line.inbound_shipment_line_id} className="align-middle">
                            <td className="p-2.5">
                              <span className="font-bold block text-zinc-850 dark:text-zinc-300">{line.product_name}</span>
                              <span className="font-mono text-[10px] text-zinc-450">{line.letusto_sku}</span>
                            </td>
                            <td className="p-2.5 text-right font-mono font-semibold">{line.shipped_qty}개</td>
                            <td className="p-2.5 text-right">
                              <input
                                type="number"
                                min={0}
                                max={line.shipped_qty}
                                value={line.received_qty}
                                onChange={(e) => {
                                  const updated = [...receivingLines];
                                  updated[idx].received_qty = Number(e.target.value);
                                  setReceivingLines(updated);
                                }}
                                className="w-20 text-right rounded-md border-zinc-300 text-xs px-2 py-1 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white focus:ring-indigo-500"
                              />
                            </td>
                            <td className="p-2.5 text-right">
                              <input
                                type="number"
                                min={0}
                                value={line.damaged_qty}
                                onChange={(e) => {
                                  const updated = [...receivingLines];
                                  updated[idx].damaged_qty = Number(e.target.value);
                                  setReceivingLines(updated);
                                }}
                                className="w-20 text-right rounded-md border-zinc-350 text-xs px-2 py-1 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white focus:ring-indigo-500"
                              />
                            </td>
                            <td className="p-2.5 text-right">
                              <input
                                type="number"
                                min={0}
                                value={line.hold_qty}
                                onChange={(e) => {
                                  const updated = [...receivingLines];
                                  updated[idx].hold_qty = Number(e.target.value);
                                  setReceivingLines(updated);
                                }}
                                className="w-20 text-right rounded-md border-zinc-350 text-xs px-2 py-1 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white focus:ring-indigo-500"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setShowReceivingForm(false)}
                    className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-lg cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    실물 입고기록 저장
                  </button>
                </div>
              </form>
            )}

            {/* List receivings */}
            <div className="grid grid-cols-1 gap-6">
              {receivings.length === 0 ? (
                <div className="py-12 border-2 border-dashed border-zinc-200 dark:border-zinc-850 rounded-xl text-center text-zinc-500">
                  현재 완료 또는 등록된 입고 내역이 없습니다.
                </div>
              ) : (
                receivings.map((r) => (
                  <div key={r.id} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
                    <div className="flex justify-between items-center border-b border-zinc-150 pb-3 dark:border-zinc-850">
                      <div>
                        <span className="font-mono text-sm font-bold text-zinc-900 dark:text-white">{r.receiving_number}</span>
                        <span className="ml-2.5 text-[10px] text-zinc-450">입고일자: {r.received_date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.status === "DRAFT" && !isReadOnly && (
                          <button
                            onClick={() => handleFinalizeReceiving(r.id)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded transition-colors cursor-pointer"
                          >
                            ✔️ 입고 전표 확정 (Finalize)
                          </button>
                        )}
                        <span className="px-2 py-0.5 bg-zinc-100 text-zinc-650 border border-zinc-250 rounded text-[10px] font-bold dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
                          {r.status}
                        </span>
                      </div>
                    </div>

                    {/* Table of receiving line results */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px] border-collapse bg-zinc-50 dark:bg-zinc-950 rounded-lg">
                        <thead>
                          <tr className="border-b border-zinc-200 bg-zinc-100/50 text-zinc-550 font-bold dark:border-zinc-850 dark:bg-zinc-900/50 dark:text-white">
                            <th className="p-2">제품 코드</th>
                            <th className="p-2">제품 설명</th>
                            <th className="p-2 text-right">정상 입고</th>
                            <th className="p-2 text-right">불량/보류</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800">
                          {(r.lines || []).map((line: any) => (
                            <tr key={line.id} className="align-middle">
                              <td className="p-2 font-mono font-bold text-zinc-700 dark:text-zinc-300">{line.letusto_sku || "-"}</td>
                              <td className="p-2 font-medium">{line.product_name}</td>
                              <td className="p-2 text-right font-mono font-semibold text-emerald-600">{line.received_qty - line.damaged_qty - line.hold_qty}개</td>
                              <td className="p-2 text-right font-mono text-rose-600">{line.damaged_qty + line.hold_qty}개</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 5: Documents */}
        {activeTab === "documents" && (
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-white">발주 및 선적 증빙 서류</h3>
            <div className="divide-y divide-zinc-150 dark:divide-zinc-850">
              <div className="py-3 flex justify-between items-center">
                <span className="font-semibold text-zinc-800 dark:text-zinc-300">📄 발주서 PDF 문서 (Purchase Order Invoice)</span>
                <button
                  onClick={handlePrint}
                  className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold rounded"
                >
                  출력 / 저장
                </button>
              </div>

              {/* Goods Readiness Submitted Documents */}
              {goodsReadiness.map((gr) => (
                <div key={gr.id} className="py-3 space-y-2">
                  <div className="font-bold text-zinc-400 text-[10px]">파트너사 제출 서류 (Ready Date: {gr.goods_ready_date})</div>
                  <div className="flex flex-col gap-1.5 ml-2.5">
                    {gr.packing_list_path && (
                      <a
                        href={gr.packing_list_path}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline flex items-center gap-1.5"
                      >
                        📂 패킹 리스트 (Packing List): {gr.packing_list_filename || "Download"}
                      </a>
                    )}
                    {gr.commercial_invoice_path && (
                      <a
                        href={gr.commercial_invoice_path}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline flex items-center gap-1.5"
                      >
                        📂 상업 송장 (Commercial Invoice): {gr.commercial_invoice_filename || "Download"}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 6: Activity */}
        {activeTab === "activity" && (
          <div className="space-y-6">
            {/* System / Operational Activity Logs Timeline */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
              <h3 className="text-sm font-bold text-zinc-800 dark:text-white flex items-center justify-between">
                <span>⏱️ 발주 라이프사이클 이벤트 로그 (Activity Log)</span>
                <span className="text-xs text-zinc-400 font-normal">Eastern Time (ET) 기준</span>
              </h3>
              {(!po.activity_logs || po.activity_logs.length === 0) ? (
                <div className="py-6 text-center text-zinc-400 text-xs">
                  기록된 라이프사이클 이벤트가 없습니다.
                </div>
              ) : (
                <div className="relative pl-6 border-l-2 border-zinc-200 dark:border-zinc-800 space-y-6 my-2 text-xs">
                  {[...po.activity_logs].reverse().map((log: any, idx: number) => (
                    <div key={idx} className="relative group">
                      <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full bg-indigo-600 border-2 border-white dark:border-zinc-900" />
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                        <span className="font-bold text-zinc-900 dark:text-white">
                          {log.event || "Event"}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {formatEasternDate(log.timestamp)} ({log.actor || "System"})
                        </span>
                      </div>
                      {log.description && (
                        <p className="text-zinc-600 dark:text-zinc-300 mt-1 text-[11px] leading-relaxed">
                          {log.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Collaboration Logs */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
              <h3 className="text-sm font-bold text-zinc-800 dark:text-white">파트너 협업 및 수량 조율 (Collaboration Logs)</h3>

              {/* List change requests */}
              <div className="divide-y divide-zinc-150 dark:divide-zinc-800">
                {changeRequests.length === 0 ? (
                  <div className="py-6 text-center text-zinc-500 text-xs">
                    등록된 파트너 수량 조율 요청이 없습니다.
                  </div>
                ) : (
                changeRequests.map((req) => {
                  const matchedLine = po.lines.find((l) => l.id === req.purchaseOrderLineId);
                  return (
                    <div key={req.id} className="py-4 space-y-3 last:pb-0">
                      <div className="flex justify-between items-center text-xs">
                        <div>
                          <span className="font-bold text-zinc-900 dark:text-white">
                            {matchedLine?.product_name || "전체 조율"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-400">
                            요청: {req.requestedByName} ({req.companyName}) | {new Date(req.createdAt).toLocaleString()}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            req.status === "PENDING" ? "bg-amber-50 text-amber-700" :
                            req.status === "APPROVED" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                          }`}>
                            {req.status}
                          </span>
                        </div>
                      </div>

                      {/* Detail Metrics */}
                      <div className="grid grid-cols-4 gap-4 text-center bg-zinc-50 dark:bg-zinc-950 p-3 rounded-lg border border-zinc-150 dark:border-zinc-850 text-xs">
                        <div>
                          <div className="text-[10px] text-zinc-400">원래 수량</div>
                          <div className="font-bold font-mono text-zinc-700 dark:text-zinc-300">{req.originalQty}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-zinc-400">제안 수량</div>
                          <div className="font-bold font-mono text-zinc-900 dark:text-white">{req.proposedQty}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-zinc-400">조율 차이</div>
                          <div className="font-bold font-mono text-indigo-600 dark:text-indigo-400">
                            {req.proposedQty - req.originalQty}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-zinc-400">유형</div>
                          <div className="font-bold text-zinc-700 dark:text-zinc-300">{req.requestType}</div>
                        </div>
                      </div>

                      {/* Partner Reason */}
                      <div className="space-y-1 text-xs">
                        <div className="font-bold text-zinc-400 uppercase tracking-wide text-[10px]">변경 사유</div>
                        <div className="p-2.5 border-l-2 border-zinc-300 bg-zinc-50/50 text-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-300">
                          {req.reason || "(사유 기재 없음)"}
                        </div>
                      </div>

                      {/* Admin Decision Actions */}
                      {req.status === "PENDING" && !isReadOnly && (
                        <div className="space-y-2 pt-2 text-xs">
                          <label className="block text-[10px] font-bold text-zinc-405 uppercase">검토 의견 / 반려 사유</label>
                          <textarea
                            rows={2}
                            placeholder="변경 승인 또는 반려 처리 메모를 입력해주세요."
                            value={reviewNotes[req.id] || ""}
                            onChange={(e) => setReviewNotes({ ...reviewNotes, [req.id]: e.target.value })}
                            className="w-full rounded-md border-zinc-300 bg-white text-xs text-zinc-900 shadow-sm focus:border-zinc-500 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleReviewRequest(req.id, "REJECT")}
                              disabled={reviewLoading === req.id}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50"
                            >
                              {reviewLoading === req.id ? "심사중..." : "반려 (Reject)"}
                            </button>
                            <button
                              onClick={() => handleReviewRequest(req.id, "APPROVE")}
                              disabled={reviewLoading === req.id}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50"
                            >
                              {reviewLoading === req.id ? "심사중..." : "승인 (Approve)"}
                            </button>
                          </div>
                        </div>
                      )}

                      {req.reviewNote && (
                        <div className="p-3 bg-amber-50/20 border border-amber-100 rounded-lg text-zinc-700 dark:bg-amber-950/10 dark:border-amber-900/30 dark:text-zinc-300 space-y-1 text-xs">
                          <div className="font-bold text-amber-800 dark:text-amber-400 text-[10px]">어드민 의견:</div>
                          <div>{req.reviewNote}</div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
);
}
