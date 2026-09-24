"use client";

// Task ID: ADM-PUR-UI-001-R3 / PORT-PO-UI-001-R3 (Shipment Confirmation & Progress Synchronization)
import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  transitionPoStatus,
  deleteDraftPo,
  reviewSupplierPoChangeRequest,
  requestPoCancellation,
  updateAdminGoodsReadinessForwarderInfo,
  completePurchaseOrder,
} from "@/lib/purchase-order/actions";
import { parseSpecialInstructions } from "@/lib/purchase-order/forwarder-helper";
import {
  getOverallStatus,
  OVERALL_STATUS_LABELS,
  OVERALL_STATUS_COLORS,
  getNextAction,
} from "@/lib/purchase-order/status-helper";
import {
  createInboundShipment,
  createReceiving,
  updateReceiving,
  finalizeReceiving,
  transitionShipmentStatus,
  updateInboundShipmentLogistics,
  closeShipmentWithVariance,
} from "@/lib/inbound/actions";
import { PoUnifiedStepper } from "@/components/shared/po-unified-stepper";
import {
  PoDocument,
  PoDocumentType,
  PO_DOCUMENT_TYPE_LABELS,
  PO_DOCUMENT_TYPE_BADGES,
  } from "@/lib/purchase-order/document-types";
import { uploadPoDocument } from "@/lib/purchase-order/document-actions";
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
  documents?: PoDocument[];
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
  documents = [],
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
  // Document Upload modal state for Admin
  const [showDocUploadModal, setShowDocUploadModal] = useState(false);
  const [uploadDocType, setUploadDocType] = useState<PoDocumentType>("PACKING_LIST");
  const [uploadRelatedType, setUploadRelatedType] = useState<"PO" | "GOODS_READY" | "SHIPMENT">("PO");
  const [uploadRelatedId, setUploadRelatedId] = useState<string>("");
  const [uploadNote, setUploadNote] = useState<string>("");
  const [selectedDocFile, setSelectedDocFile] = useState<File | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  const handleDocumentUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocFile) {
      alert("업로드할 파일을 선택해주세요.");
      return;
    }
    setIsUploadingDoc(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const formData = new FormData();
      formData.append("poId", po.id);
      formData.append("documentType", uploadDocType);
      formData.append("relatedType", uploadRelatedType);
      if (uploadRelatedId) formData.append("relatedId", uploadRelatedId);
      if (uploadNote) formData.append("note", uploadNote);
      formData.append("file", selectedDocFile);

      await uploadPoDocument(formData);
      setSuccessMessage("증빙 서류가 성공적으로 업로드되었습니다.");
      setShowDocUploadModal(false);
      setSelectedDocFile(null);
      setUploadNote("");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "서류 업로드 실패");
    } finally {
      setIsUploadingDoc(false);
    }
  };

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

  // Forwarder & Handover modal state for Admin
  const [showForwarderModal, setShowForwarderModal] = useState(false);
  const [editingGrId, setEditingGrId] = useState<string>("");
  const [forwarderFobPort, setForwarderFobPort] = useState("");
  const [forwarderHandoverLoc, setForwarderHandoverLoc] = useState("");
  const [adminForwarderName, setAdminForwarderName] = useState("");
  const [adminForwarderContact, setAdminForwarderContact] = useState("");
  const [adminForwarderEmail, setAdminForwarderEmail] = useState("");
  const [adminForwarderPhone, setAdminForwarderPhone] = useState("");
  const [adminForwarderNotes, setAdminForwarderNotes] = useState("");
  const [isSavingForwarder, setIsSavingForwarder] = useState(false);

  const openForwarderModal = (gr: any) => {
    setEditingGrId(gr.id);
    setForwarderFobPort(gr.fob_port || po.port_of_loading || "");
    setForwarderHandoverLoc(gr.handover_location || "");
    const fwd = parseSpecialInstructions(gr.special_instructions);
    setAdminForwarderName(fwd.forwarderName || "");
    setAdminForwarderContact(fwd.forwarderContact || "");
    setAdminForwarderEmail(fwd.forwarderEmail || "");
    setAdminForwarderPhone(fwd.forwarderPhone || "");
    setAdminForwarderNotes(fwd.notes || "");
    setShowForwarderModal(true);
  };

  const handleSaveForwarderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingForwarder(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await updateAdminGoodsReadinessForwarderInfo({
        readinessId: editingGrId,
        poId: po.id,
        fobPort: forwarderFobPort,
        handoverLocation: forwarderHandoverLoc,
        forwarderName: adminForwarderName,
        forwarderContact: adminForwarderContact,
        forwarderEmail: adminForwarderEmail,
        forwarderPhone: adminForwarderPhone,
        notes: adminForwarderNotes,
      });
      setSuccessMessage("인도 조건 및 포워더 정보가 성공적으로 저장되었습니다.");
      setShowForwarderModal(false);
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "포워더 정보 저장 실패");
    } finally {
      setIsSavingForwarder(false);
    }
  };

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
  const [editingReceivingId, setEditingReceivingId] = useState<string | null>(null);
  const [selectedShipmentId, setSelectedShipmentId] = useState("");
  const [receivingWarehouseId, setReceivingWarehouseId] = useState(po.destination_warehouse_id || "");
  const [receivedDate, setReceivedDate] = useState(getEasternTodayString());
  const [showCompletePoModal, setShowCompletePoModal] = useState(false);
  const [completePoNote, setCompletePoNote] = useState("");
  const [isCompletingPo, setIsCompletingPo] = useState(false);
  const [completeWithVariance, setCompleteWithVariance] = useState(false);
  const [receivingLines, setReceivingLines] = useState<Array<{
    inbound_shipment_line_id: string;
    purchase_order_line_id: string;
    product_id: string;
    product_name: string;
    letusto_sku: string;
    shipped_qty: number;
    previously_received?: number;
    remaining_to_receive?: number;
    received_qty: number;
    damaged_qty: number;
    hold_qty: number;
    line_note: string;
  }>>([]);

  // Edit Shipment Logistics modal state
  const [showEditShipmentModal, setShowEditShipmentModal] = useState(false);
  const [editingShipmentId, setEditingShipmentId] = useState("");
  const [editShipmentNumber, setEditShipmentNumber] = useState("");
  const [editCarrier, setEditCarrier] = useState("");
  const [editTrackingNumber, setEditTrackingNumber] = useState("");
  const [editContainerNumber, setEditContainerNumber] = useState("");
  const [editBillOfLading, setEditBillOfLading] = useState("");
  const [editBookingNumber, setEditBookingNumber] = useState("");
  const [editOriginPort, setEditOriginPort] = useState("");
  const [editEtd, setEditEtd] = useState("");
  const [editEta, setEditEta] = useState("");
  const [isSavingShipmentEdit, setIsSavingShipmentEdit] = useState(false);

  const openEditShipmentModal = (shp: any) => {
    setEditingShipmentId(shp.id);
    setEditShipmentNumber(shp.shipment_number || "");
    setEditCarrier(shp.carrier || "");
    setEditTrackingNumber(shp.tracking_number || "");
    setEditContainerNumber(shp.container_number || "");
    setEditBillOfLading(shp.bill_of_lading || "");
    setEditBookingNumber(shp.booking_number || "");
    setEditOriginPort(shp.origin_port || "");
    setEditEtd(shp.etd || "");
    setEditEta(shp.eta || "");
    setShowEditShipmentModal(true);
  };

  const handleSaveShipmentEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingShipmentEdit(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await updateInboundShipmentLogistics(editingShipmentId, {
        carrier: editCarrier,
        tracking_number: editTrackingNumber,
        container_number: editContainerNumber,
        bill_of_lading: editBillOfLading,
        booking_number: editBookingNumber,
        origin_port: editOriginPort,
        etd: editEtd || null,
        eta: editEta || null,
      });
      setSuccessMessage("선적 물류 정보가 성공적으로 수정되었습니다.");
      setShowEditShipmentModal(false);
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "선적 정보 수정 실패");
    } finally {
      setIsSavingShipmentEdit(false);
    }
  };

  // Aggregate shipped, received, accepted and variance stats dynamically
  const stats = useMemo(() => {
    const activeShipments = shipments.filter((s) => s.status !== "CANCELLED");
    const finalizedReceivings = receivings.filter((r) => r.status === "FINALIZED");

    const totalShipped = Math.max(
      activeShipments.reduce(
        (sum, s) => sum + (s.lines ?? []).reduce((lSum: number, sl: any) => lSum + (Number(sl.shipped_qty) || 0), 0),
        0
      ),
      (po.lines || []).reduce((sum: number, l: any) => sum + (Number(l.shipped_qty) || 0), 0)
    );

    let totalReceived = 0;
    let totalAccepted = 0;
    let totalDamagedHold = 0;

    finalizedReceivings.forEach((r) => {
      (r.lines ?? []).forEach((rl: any) => {
        totalReceived += rl.received_qty;
        totalAccepted += rl.received_qty - rl.damaged_qty - rl.hold_qty;
        totalDamagedHold += (Number(rl.damaged_qty) || 0) + (Number(rl.hold_qty) || 0);
      });
    });

    const variance = totalShipped > 0 ? totalShipped - totalAccepted : 0;

    return {
      shipped: totalShipped,
      received: totalReceived,
      accepted: totalAccepted,
      damagedHold: totalDamagedHold,
      variance,
    };
  }, [po.total_qty, shipments, receivings]);

  // Overall status helper calculation
  const overallStatus = useMemo(() => {
    return getOverallStatus(po, shipments, receivings, goodsReadiness);
  }, [po, shipments, receivings, goodsReadiness]);

  const nextAction = useMemo(() => {
    return getNextAction(overallStatus, isReadOnly);
  }, [overallStatus, isReadOnly]);

  // Init shipment lines input quantities based on remaining items to ship
  const initShipmentForm = () => {
    setActiveTab("shipments");
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
    if (!destinationWarehouseId && po.destination_warehouse_id) {
      setDestinationWarehouseId(po.destination_warehouse_id);
    }
    if (!originPort && po.port_of_loading) {
      setOriginPort(po.port_of_loading);
    }
    if (!etd && po.expected_ship_date) {
      setEtd(po.expected_ship_date);
    }
    setShowShipmentForm(true);
  };

  // Init receiving inspection form
  const initReceivingForm = (shipmentId?: string, draftReceiving?: any) => {
    setActiveTab("receiving");
    setShowReceivingForm(true);

    // If editing a draft receiving directly
    if (draftReceiving) {
      setEditingReceivingId(draftReceiving.id);
      setSelectedShipmentId(draftReceiving.inbound_shipment_id || "");
      setReceivingWarehouseId(draftReceiving.warehouse_id || po.destination_warehouse_id || (warehouses[0]?.id ?? ""));
      setReceivedDate(draftReceiving.received_date || getEasternTodayString());

      const lines = (draftReceiving.lines || []).map((rl: any) => {
        const matchedPoLine = po.lines.find((l) => l.id === rl.purchase_order_line_id);
        const matchedShipmentLine = shipments.flatMap((s) => s.lines || []).find((sl: any) => sl.id === rl.inbound_shipment_line_id);
        const shippedQty = matchedShipmentLine?.shipped_qty ?? matchedPoLine?.confirmed_qty ?? matchedPoLine?.qty ?? rl.received_qty;

        return {
          inbound_shipment_line_id: rl.inbound_shipment_line_id || "",
          purchase_order_line_id: rl.purchase_order_line_id || matchedPoLine?.id || "",
          product_id: rl.product_id,
          product_name: matchedPoLine?.product_name || "Unknown Product",
          letusto_sku: matchedPoLine?.letusto_sku || "-",
          manufacture_sku: matchedPoLine?.manufacture_sku || "-",
          shipped_qty: shippedQty,
          previously_received: 0,
          remaining_to_receive: shippedQty,
          received_qty: rl.received_qty || 0,
          damaged_qty: rl.damaged_qty || 0,
          hold_qty: rl.hold_qty || 0,
          line_note: rl.line_note || "",
        };
      });

      if (lines.length > 0) {
        setReceivingLines(lines);
      }
      setTimeout(() => {
        const el = document.getElementById("receiving-section");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 50);
      return;
    }

    // Check if there is an existing DRAFT receiving for this PO
    const existingDraft = receivings.find((r) => r.status === "DRAFT");
    if (existingDraft) {
      initReceivingForm(undefined, existingDraft);
      return;
    }

    setEditingReceivingId(null);

    const activeShipments = shipments.filter((s) => s.status !== "CANCELLED");
    const target = (shipmentId ? shipments.find((s) => s.id === shipmentId) : activeShipments[0]) || shipments[0];

    // Filter out already received counts for finalized receivings
    const finalizedReceivings = receivings.filter((r) => r.status === "FINALIZED");
    const receivedCountMap = new Map<string, number>();
    finalizedReceivings.flatMap((r) => r.lines || []).forEach((rl: any) => {
      if (rl.inbound_shipment_line_id) {
        const cur = receivedCountMap.get(rl.inbound_shipment_line_id) || 0;
        receivedCountMap.set(rl.inbound_shipment_line_id, cur + (rl.received_qty || 0));
      }
      if (rl.purchase_order_line_id) {
        const curPo = receivedCountMap.get(rl.purchase_order_line_id) || 0;
        receivedCountMap.set(rl.purchase_order_line_id, curPo + (rl.received_qty || 0));
      }
    });

    let items: any[] = [];
    if (target && target.lines && target.lines.length > 0) {
      setSelectedShipmentId(target.id);
      setReceivingWarehouseId(target.destination_warehouse_id || po.destination_warehouse_id || (warehouses[0]?.id ?? ""));
      setReceivedDate(getEasternTodayString());

      items = target.lines.map((sl: any) => {
        const already = receivedCountMap.get(sl.id) || 0;
        const remaining = Math.max(0, sl.shipped_qty - already);
        const matchedPoLine = po.lines.find((l) => l.id === sl.purchase_order_line_id);

        return {
          inbound_shipment_line_id: sl.id,
          purchase_order_line_id: sl.purchase_order_line_id || matchedPoLine?.id || "",
          product_id: sl.product_id,
          product_name: matchedPoLine?.product_name || "Unknown Product",
          letusto_sku: matchedPoLine?.letusto_sku || "-",
          manufacture_sku: matchedPoLine?.manufacture_sku || "-",
          shipped_qty: sl.shipped_qty,
          previously_received: already,
          remaining_to_receive: remaining,
          received_qty: remaining,
          damaged_qty: 0,
          hold_qty: 0,
          line_note: "",
        };
      });
    } else {
      setSelectedShipmentId(target?.id || "");
      setReceivingWarehouseId(po.destination_warehouse_id || (warehouses[0]?.id ?? ""));
      setReceivedDate(getEasternTodayString());

      items = po.lines.map((pol: any) => {
        const already = receivedCountMap.get(pol.id) || 0;
        const remaining = Math.max(0, (pol.confirmed_qty ?? pol.qty) - already);

        return {
          inbound_shipment_line_id: "",
          purchase_order_line_id: pol.id,
          product_id: pol.product_id,
          product_name: pol.product_name || "Unknown Product",
          letusto_sku: pol.letusto_sku || "-",
          manufacture_sku: pol.manufacture_sku || "-",
          shipped_qty: pol.confirmed_qty ?? pol.qty,
          previously_received: already,
          remaining_to_receive: remaining,
          received_qty: remaining,
          damaged_qty: 0,
          hold_qty: 0,
          line_note: "",
        };
      });
    }

    setReceivingLines(items);
    setTimeout(() => {
      const el = document.getElementById("receiving-section");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }, 50);
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
  const handleSubmitReceiving = async (e: React.FormEvent, finalizeImmediately: boolean = false) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsActionLoading(true);

    const validLines = receivingLines
      .filter((l) => (l.received_qty || 0) > 0 || (l.damaged_qty || 0) > 0 || (l.hold_qty || 0) > 0)
      .map((l) => ({
        inbound_shipment_line_id: l.inbound_shipment_line_id || undefined,
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
      let recId = editingReceivingId;
      if (recId) {
        await updateReceiving({
          receiving_id: recId,
          warehouse_id: receivingWarehouseId,
          received_date: receivedDate,
          inbound_shipment_id: selectedShipmentId || null,
          lines: validLines,
        });
      } else {
        const res = await createReceiving({
          inbound_shipment_id: selectedShipmentId || undefined,
          purchase_order_id: po.id,
          warehouse_id: receivingWarehouseId,
          received_date: receivedDate,
          lines: validLines,
        });
        recId = res?.id || null;
      }

      if (finalizeImmediately && recId) {
        await finalizeReceiving(recId);
        setSuccessMessage("입고 검수 결과가 확정되었습니다. 최종 확인 후 '발주 완료 종결(Complete PO)'을 클릭하여 재고 반영을 진행하십시오.");
      } else {
        setSuccessMessage("입고서 초안(DRAFT)이 저장되었습니다. 검수 완료 후 '입고 전표 확정'을 진행하십시오.");
      }
      setShowReceivingForm(false);
      setEditingReceivingId(null);
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "입고 검수서 등록 실패");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Finalize Receiving
  const handleFinalizeReceiving = async (recId: string) => {
    if (!confirm("입고 검수 결과를 확정하시겠습니까? (최종 재고 반영은 '발주 완료 종결' 시 수행됩니다)")) return;
    setErrorMessage("");
    setSuccessMessage("");
    setIsActionLoading(true);

    try {
      await finalizeReceiving(recId);
      setSuccessMessage("입고 검수 결과가 확정되었습니다. 최종 확인 후 '발주 완료 종결(Complete PO)'을 진행하십시오.");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "입고 확정 처리 중 오류가 발생했습니다.");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Complete PO Actions
  const handleOpenCompleteModal = (withVar: boolean = false) => {
    setCompleteWithVariance(withVar);
    setCompletePoNote(withVar ? "공급사 협의 하에 잔여 수량 차이를 반영하여 발주를 최종 종결합니다." : "");
    setShowCompletePoModal(true);
  };

  const handleExecuteCompletePo = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCompletingPo(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await completePurchaseOrder(po.id, completePoNote, completeWithVariance);
      setSuccessMessage(completeWithVariance ? "차이를 포함하여 발주가 최종 종결(Completed)되었습니다." : "발주가 성공적으로 최종 종결(Completed)되었습니다.");
      setShowCompletePoModal(false);
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "발주 종결 처리 실패");
    } finally {
      setIsCompletingPo(false);
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
                    {po.currency} {(l.line_total ?? ((l.qty || 0) * (l.unit_cost || 0))).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
      {/* Top Breadcrumb */}
      <div>
        <Link
          href="/admin/purchasing"
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors inline-flex items-center gap-1"
        >
          ← 발주 목록으로 돌아가기
        </Link>
      </div>

      {/* Top Action Alerts */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300 text-xs font-bold flex justify-between items-center shadow-sm">
          <span>⚠️ {errorMessage}</span>
          <button onClick={() => setErrorMessage("")} className="text-rose-500 hover:text-rose-700 font-bold ml-2 cursor-pointer">✕</button>
        </div>
      )}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300 text-xs font-bold flex justify-between items-center shadow-sm">
          <span>✅ {successMessage}</span>
          <button onClick={() => setSuccessMessage("")} className="text-emerald-500 hover:text-emerald-700 font-bold ml-2 cursor-pointer">✕</button>
        </div>
      )}

      {/* Prominent Top PO Header Banner (ADM-PUR-UI-001) */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-zinc-950 dark:text-white">
                {po.po_number}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${OVERALL_STATUS_COLORS[overallStatus] || "bg-zinc-100 text-zinc-700"}`}>
                {OVERALL_STATUS_LABELS[overallStatus] || overallStatus}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                Rev. {po.revision_no ?? 0}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap">
              <span>공급사: <strong className="text-zinc-800 dark:text-zinc-200">{po.supplier?.name || "-"}</strong></span>
              <span>발주일자: <strong className="text-zinc-800 dark:text-zinc-200">{po.order_date}</strong></span>
              <span>화폐: <strong className="font-mono text-zinc-800 dark:text-zinc-200">{po.currency}</strong></span>
              <span>총 수량: <strong className="font-mono text-zinc-800 dark:text-zinc-200">{po.total_qty.toLocaleString()} PCS</strong></span>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {!isReadOnly && overallStatus === "Shipped" && (
              <button
                type="button"
                onClick={() => initReceivingForm()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>📥</span>
                <span>입고 검수 등록 (Start Receiving)</span>
              </button>
            )}

            {!isReadOnly && overallStatus === "Receiving" && (
              <button
                type="button"
                onClick={() => initReceivingForm()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>📥</span>
                <span>입고 검수 계속 / 추가 (Receiving)</span>
              </button>
            )}

            {!isReadOnly && overallStatus === "Receiving" && receivings.length > 0 && receivings.every((r: any) => r.status === "FINALIZED") && (
              stats.received >= po.total_qty ? (
                <button
                  type="button"
                  onClick={() => handleOpenCompleteModal(false)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>🎉</span>
                  <span>발주 종결 (Complete PO)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleOpenCompleteModal(true)}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>⚠️</span>
                  <span>차이 포함 발주 종결 (Complete with Variance)</span>
                </button>
              )
            )}

            {!isReadOnly && po.po_status !== "CANCELLED" && po.po_status !== "DRAFT" && overallStatus !== "Completed" && (
              po.lines.some(l => (l.remaining_to_ship || (l.qty - (l.shipped_qty || 0))) > 0) || shipments.length === 0 ? (
                <button
                  type="button"
                  onClick={initShipmentForm}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>🚢</span>
                  <span>{overallStatus === "Shipped" || overallStatus === "Receiving" ? "+ 추가 선적 (Shipment)" : "선적 등록 (Create Shipment)"}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={initShipmentForm}
                  className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>🚢</span>
                  <span>선적 관리 (View Shipments)</span>
                </button>
              )
            )}
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              🖨️ PDF / 인쇄
            </button>
            {!isReadOnly && po.po_status !== "CANCELLED" && (
              <Link
                href={`/admin/purchasing/${po.id}/edit`}
                className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 text-xs font-bold rounded-xl transition-colors"
              >
                ✏️ 발주 수정 {po.po_status === "SENT" ? "(개정/Revision)" : ""}
              </Link>
            )}
            {!isReadOnly && po.po_status === "DRAFT" && (
              <button
                onClick={handleDelete}
                disabled={isActionLoading}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                🗑️ 초안 삭제
              </button>
            )}
            {!isReadOnly && po.po_status !== "CANCELLED" && po.po_status !== "DRAFT" && po.cancellation_status !== "CANCELLATION_REQUESTED" && (
              <button
                onClick={handleCancelPo}
                disabled={isActionLoading}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                ❌ {po.supplier_confirmation_status === "CONFIRMED" ? "발주 취소 요청" : "발주 취소"}
              </button>
            )}
          </div>
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

      {/* Edit Shipment Logistics Modal */}
      {showEditShipmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-xl w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-150 pb-3 dark:border-zinc-800">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-1.5">
                <span>🚢</span>
                <span>선적 물류 정보 수정 ({editShipmentNumber})</span>
              </h3>
              <button
                onClick={() => setShowEditShipmentModal(false)}
                className="text-zinc-400 hover:text-zinc-600 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveShipmentEdit} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    운송사 (Carrier)
                  </label>
                  <input
                    type="text"
                    placeholder="예: DHL, Fedex, Maersk"
                    value={editCarrier}
                    onChange={(e) => setEditCarrier(e.target.value)}
                    className="w-full text-xs rounded-lg border border-zinc-300 p-2 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    송장/트래킹 번호 (Tracking No)
                  </label>
                  <input
                    type="text"
                    value={editTrackingNumber}
                    onChange={(e) => setEditTrackingNumber(e.target.value)}
                    className="w-full text-xs rounded-lg border border-zinc-300 p-2 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    컨테이너 번호 (Container No)
                  </label>
                  <input
                    type="text"
                    value={editContainerNumber}
                    onChange={(e) => setEditContainerNumber(e.target.value)}
                    className="w-full text-xs rounded-lg border border-zinc-300 p-2 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    선하증권 (B/L Number)
                  </label>
                  <input
                    type="text"
                    value={editBillOfLading}
                    onChange={(e) => setEditBillOfLading(e.target.value)}
                    className="w-full text-xs rounded-lg border border-zinc-300 p-2 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    부킹 번호 (Booking No)
                  </label>
                  <input
                    type="text"
                    value={editBookingNumber}
                    onChange={(e) => setEditBookingNumber(e.target.value)}
                    className="w-full text-xs rounded-lg border border-zinc-300 p-2 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    ETD (출항일자)
                  </label>
                  <input
                    type="date"
                    value={editEtd}
                    onChange={(e) => setEditEtd(e.target.value)}
                    onClick={(e) => (e.target as any).showPicker?.()}
                    className="w-full text-xs rounded-lg border border-zinc-300 p-2 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    ETA (도착일자)
                  </label>
                  <input
                    type="date"
                    value={editEta}
                    onChange={(e) => setEditEta(e.target.value)}
                    onClick={(e) => (e.target as any).showPicker?.()}
                    className="w-full text-xs rounded-lg border border-zinc-300 p-2 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-150 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowEditShipmentModal(false)}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSavingShipmentEdit}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSavingShipmentEdit ? "저장 중..." : "선적 정보 저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Forwarder & Handover Info Edit Modal for Admin */}
      {showForwarderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-xl w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-150 pb-3 dark:border-zinc-800">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-1.5">
                <span>🚢</span>
                <span>인도 조건 및 지정 포워더 정보 수정</span>
              </h3>
              <button
                onClick={() => setShowForwarderModal(false)}
                className="text-zinc-400 hover:text-zinc-600 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              관리자 및 공급사가 공유하는 FOB 항구, 인도 방식 및 지정 포워더(Forwarder) 담당자 정보를 수정합니다.
            </p>
            <form onSubmit={handleSaveForwarderSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    FOB 항구명 또는 선적 기준 위치
                  </label>
                  <input
                    type="text"
                    placeholder="예: Busan Port, Incheon Port"
                    value={forwarderFobPort}
                    onChange={(e) => setForwarderFobPort(e.target.value)}
                    className="w-full text-xs rounded-lg border border-zinc-300 p-2 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    인도 장소 / 방식 (Handover Location)
                  </label>
                  <input
                    type="text"
                    placeholder="예: 공장 상차 / CY 전달 / 지정 창고 입고"
                    value={forwarderHandoverLoc}
                    onChange={(e) => setForwarderHandoverLoc(e.target.value)}
                    className="w-full text-xs rounded-lg border border-zinc-300 p-2 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    포워딩 회사명 (Forwarder Company)
                  </label>
                  <input
                    type="text"
                    placeholder="예: 현대글로비스 / CJ대한통운 / Letusto Logistics"
                    value={adminForwarderName}
                    onChange={(e) => setAdminForwarderName(e.target.value)}
                    className="w-full text-xs rounded-lg border border-zinc-300 p-2 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    포워딩 담당자 성명 (Forwarder Contact)
                  </label>
                  <input
                    type="text"
                    placeholder="예: 김물류 팀장"
                    value={adminForwarderContact}
                    onChange={(e) => setAdminForwarderContact(e.target.value)}
                    className="w-full text-xs rounded-lg border border-zinc-300 p-2 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    포워딩 담당자 이메일
                  </label>
                  <input
                    type="email"
                    placeholder="forwarder@email.com"
                    value={adminForwarderEmail}
                    onChange={(e) => setAdminForwarderEmail(e.target.value)}
                    className="w-full text-xs rounded-lg border border-zinc-300 p-2 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    포워딩 담당자 전화번호
                  </label>
                  <input
                    type="text"
                    placeholder="010-0000-0000"
                    value={adminForwarderPhone}
                    onChange={(e) => setAdminForwarderPhone(e.target.value)}
                    className="w-full text-xs rounded-lg border border-zinc-300 p-2 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                  인도/포워딩 특이사항 및 메모 (Special Instructions / Notes)
                </label>
                <textarea
                  rows={3}
                  placeholder="통관 관련 특이사항, 픽업 시 주의사항, 팔레트 작업 요청 등"
                  value={adminForwarderNotes}
                  onChange={(e) => setAdminForwarderNotes(e.target.value)}
                  className="w-full text-xs rounded-lg border border-zinc-300 p-2.5 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-150 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowForwarderModal(false)}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSavingForwarder}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSavingForwarder ? "저장 중..." : "포워더 정보 저장"}
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
                else if (nextAction.action === "create_receiving" || nextAction.action === "continue_receiving") {
                  initReceivingForm();
                } else if (nextAction.action === "finalize") {
                  const drafts = receivings.filter((r) => r.status === "DRAFT");
                  if (drafts.length > 0) handleFinalizeReceiving(drafts[0].id);
                  else initReceivingForm();
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
          <span className="text-[10px] text-zinc-400 block uppercase font-bold">불량/대기 수량</span>
          <span className="text-sm font-bold font-mono text-rose-600">{stats.damagedHold.toLocaleString()}</span>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 text-center">
          <span className="text-[10px] text-zinc-400 block uppercase font-bold">최종 승인 수량</span>
          <span className="text-sm font-bold font-mono text-emerald-600">{stats.accepted.toLocaleString()}</span>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 text-center">
          <span className="text-[10px] text-zinc-400 block uppercase font-bold">입고 차이 (Variance)</span>
          <span className={`text-sm font-bold font-mono ${stats.variance < 0 ? "text-rose-600" : "text-emerald-600"}`}>
            {stats.variance.toLocaleString()}
          </span>
        </div>
      </div>

{/* Permanent Order Products Summary Table (Always rendered outside tabs) */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden space-y-0">
        <div className="px-5 py-4 border-b border-zinc-150 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white flex items-center gap-2">
              <span>📦</span>
              <span>주문 품목 리스트 (Order Products & Line Quantities)</span>
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              품목별 발주, 공급사 확정, 출고 준비, 출고(선적), 입고 완료 현황입니다.
            </p>
          </div>
          <span className="font-mono text-xs font-bold text-zinc-500 dark:text-zinc-400">
            총 {po.lines.length}개 품목
          </span>
        </div>

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
                    <td className="px-4 py-3 font-mono font-bold text-zinc-900 dark:text-white">{l.letusto_sku || "-"}</td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-zinc-900 dark:text-white block">{l.product_name}</span>
                      {l.line_note && <span className="text-[10px] text-zinc-450 italic mt-0.5 block">{l.line_note}</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{l.qty.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {l.confirmed_qty !== null && l.confirmed_qty !== undefined ? (
                        <span className={l.confirmed_qty !== l.qty ? "text-amber-600 dark:text-amber-400 font-bold" : "text-emerald-600 dark:text-emerald-400 font-semibold"}>
                          {l.confirmed_qty.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-zinc-400 italic">미확정 ({l.qty.toLocaleString()})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-indigo-600 dark:text-indigo-400 font-bold">
                      {readyQty.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-zinc-900 dark:text-white font-bold">{shippedQty.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400 font-bold">
                      {receivedQty.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-600 dark:text-zinc-400">
                      {po.currency} {l.unit_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-black text-zinc-950 dark:text-white">
                      {po.currency} {(l.line_total ?? ((l.qty || 0) * (l.unit_cost || 0))).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-zinc-200 dark:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-900/60 font-bold">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-zinc-600 dark:text-zinc-400">합계 (Total)</td>
                <td className="px-4 py-3 text-right font-mono text-zinc-900 dark:text-white">{po.total_qty.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono text-zinc-900 dark:text-white">
                  {po.lines.reduce((s, l) => s + (l.confirmed_qty ?? l.qty), 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono text-indigo-600 dark:text-indigo-400">
                  {po.lines.reduce((s, l) => s + Number(l.ready_qty || 0), 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono text-zinc-900 dark:text-white">
                  {Math.max(stats.shipped, po.lines.reduce((s, l) => s + Number(l.shipped_qty || 0), 0)).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                  {stats.received.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono text-zinc-400">-</td>
                <td className="px-4 py-3 text-right font-mono font-black text-zinc-950 dark:text-white">
                  {po.currency} {po.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="border-b border-zinc-200 dark:border-zinc-850">
        <nav className="flex space-x-6 text-xs font-bold overflow-x-auto">
          {[
            { id: "overview", label: "발주 개요 (Overview)" },
            { id: "shipments", label: "선적 관리 (Shipments)" },
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

        {/* Tab 3: Shipments */}
        {activeTab === "shipments" && (
          <div className="space-y-6 text-xs">
            {/* Goods Readiness & Forwarding Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-white">출고 준비 및 포워딩 관리 (Goods Readiness & Forwarding)</h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    공급사 출고 준비(Goods Ready) 현황 및 FOB 선적항, 인도 방식, 지정 포워더(Forwarder) 정보입니다.
                  </p>
                </div>
              </div>

              {goodsReadiness.length === 0 ? (
                <div className="py-8 border-2 border-dashed border-zinc-200 dark:border-zinc-850 rounded-xl text-center text-zinc-500 dark:text-zinc-400">
                  공급사가 등록한 출고 준비(Goods Ready) 내역이 아직 없습니다.
                </div>
              ) : (
                <div className="space-y-4">
                  {goodsReadiness.map((gr) => {
                    const grLines = gr.lines || [];
                    const totalLinesQty = grLines.reduce((s: number, l: any) => s + Number(l.ready_qty || 0), 0);
                    const totalCartons = grLines.reduce((s: number, l: any) => s + Number(l.cartons || 0), 0);
                    const totalWeight = grLines.reduce((s: number, l: any) => s + Number(l.gross_weight || 0), 0);
                    const totalCbm = grLines.reduce((s: number, l: any) => s + Number(l.cbm || 0), 0);

                    const fwd = parseSpecialInstructions(gr.special_instructions);
                    const contactParts = (gr.contact_person || "").split(" / ");
                    const originContactName = contactParts[0] || "-";
                    const originContactEmail = contactParts[1] || "-";
                    const originContactPhone = contactParts[2] || "-";

                    return (
                      <div key={gr.id} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
                        <div className="flex justify-between items-center border-b border-zinc-150 pb-3 dark:border-zinc-850">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-zinc-800 dark:text-zinc-250">
                              출고 준비 내역 (Ready Date: {gr.goods_ready_date})
                            </span>
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold dark:bg-indigo-950/30 dark:text-indigo-400">
                              {gr.handover_status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {!isReadOnly && (
                              <button
                                onClick={() => openForwarderModal(gr)}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold rounded text-xs cursor-pointer transition-colors flex items-center gap-1 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
                              >
                                ✏️ 인도 / 포워딩 정보 수정 (Edit Forwarder Info)
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Section 1 & Section 2 Display Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                          {/* Origin Card */}
                          <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-950/40 space-y-2">
                            <h6 className="font-bold text-zinc-800 dark:text-zinc-200 text-xs flex items-center gap-1 border-b border-zinc-200/60 pb-1.5 dark:border-zinc-800">
                              <span>🏢</span>
                              <span>출고지 및 출고 담당자</span>
                            </h6>
                            <div className="grid grid-cols-2 gap-2 text-zinc-600 dark:text-zinc-400">
                              <div>
                                <span className="text-zinc-400 block text-[10px]">인수지 명칭</span>
                                <span className="font-semibold text-zinc-800 dark:text-zinc-300">{gr.pickup_location || "-"}</span>
                              </div>
                              <div>
                                <span className="text-zinc-400 block text-[10px]">출고 완료 예정일</span>
                                <span className="font-semibold text-zinc-800 dark:text-zinc-300 font-mono">{gr.goods_ready_date}</span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-zinc-400 block text-[10px]">공장/창고 상세 주소</span>
                                <span>{gr.warehouse_factory_address || "-"}</span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-zinc-400 block text-[10px]">현장 출고 담당자</span>
                                <span>
                                  {originContactName !== "-" ? (
                                    <span className="font-semibold text-zinc-800 dark:text-zinc-300">
                                      {originContactName} {originContactEmail !== "-" ? `(${originContactEmail})` : ""} {originContactPhone !== "-" ? `/ ${originContactPhone}` : ""}
                                    </span>
                                  ) : (
                                    "-"
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Forwarder & Handover Card */}
                          <div className="rounded-lg border border-indigo-150 bg-indigo-50/20 p-3.5 dark:border-indigo-950 dark:bg-indigo-950/20 space-y-2">
                            <h6 className="font-bold text-indigo-900 dark:text-indigo-300 text-xs flex items-center gap-1 border-b border-indigo-100/60 pb-1.5 dark:border-indigo-900/40">
                              <span>🚢</span>
                              <span>인도 조건 및 지정 포워더</span>
                            </h6>
                            <div className="grid grid-cols-2 gap-2 text-zinc-600 dark:text-zinc-400">
                              <div>
                                <span className="text-zinc-400 block text-[10px]">FOB 항구명</span>
                                <span className="font-semibold text-indigo-900 dark:text-indigo-300">{gr.fob_port || "-"}</span>
                              </div>
                              <div>
                                <span className="text-zinc-400 block text-[10px]">인도 장소/방식</span>
                                <span className="font-semibold text-zinc-800 dark:text-zinc-300">{gr.handover_location || "-"}</span>
                              </div>
                              <div>
                                <span className="text-zinc-400 block text-[10px]">포워딩 회사명</span>
                                <span className="font-semibold text-zinc-800 dark:text-zinc-300">{fwd.forwarderName || "-"}</span>
                              </div>
                              <div>
                                <span className="text-zinc-400 block text-[10px]">포워더 담당자 / 연락처</span>
                                <span>
                                  {fwd.forwarderContact || fwd.forwarderEmail || fwd.forwarderPhone ? (
                                    <span>
                                      {fwd.forwarderContact || ""} {fwd.forwarderEmail ? `(${fwd.forwarderEmail})` : ""} {fwd.forwarderPhone ? `/ ${fwd.forwarderPhone}` : ""}
                                    </span>
                                  ) : (
                                    "-"
                                  )}
                                </span>
                              </div>
                              {fwd.notes && (
                                <div className="col-span-2 pt-1 border-t border-indigo-100/40 dark:border-indigo-900/30">
                                  <span className="text-zinc-400 block text-[10px]">특이사항 / 메모</span>
                                  <span className="text-zinc-700 dark:text-zinc-300">{fwd.notes}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Section 3: Summary metrics */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-50 dark:bg-zinc-950/40 p-3 rounded-lg text-[11px]">
                          <div>
                            <span className="text-zinc-400 block text-[10px]">총 준비 수량</span>
                            <strong className="text-indigo-600 font-bold font-mono">{totalLinesQty.toLocaleString()} PCS</strong>
                          </div>
                          <div>
                            <span className="text-zinc-400 block text-[10px]">총 박스(Carton) 수</span>
                            <strong className="text-zinc-800 dark:text-zinc-200 font-bold font-mono">{totalCartons.toLocaleString()} CTN</strong>
                          </div>
                          <div>
                            <span className="text-zinc-400 block text-[10px]">총 중량(Gross Weight)</span>
                            <strong className="text-zinc-800 dark:text-zinc-200 font-bold font-mono">{totalWeight.toFixed(2)} kg</strong>
                          </div>
                          <div>
                            <span className="text-zinc-400 block text-[10px]">총 부피(CBM)</span>
                            <strong className="text-zinc-800 dark:text-zinc-200 font-bold font-mono">{totalCbm.toFixed(3)} CBM</strong>
                          </div>
                        </div>

                        {/* Attached Documents on this Goods Readiness */}
                        {(gr.packing_list_path || gr.commercial_invoice_path) && (
                          <div className="pt-2 border-t border-zinc-150 dark:border-zinc-850">
                            <span className="text-[10px] font-bold text-zinc-400 block mb-1.5">첨부 선적 서류</span>
                            <div className="flex flex-wrap gap-2">
                              {gr.packing_list_path && (
                                <a
                                  href={gr.packing_list_path}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold hover:bg-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900"
                                >
                                  📄 패킹 리스트: {gr.packing_list_filename || "Packing_List.pdf"}
                                </a>
                              )}
                              {gr.commercial_invoice_path && (
                                <a
                                  href={gr.commercial_invoice_path}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-250 text-xs font-semibold hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900"
                                >
                                  📄 상업 송장: {gr.commercial_invoice_filename || "Commercial_Invoice.pdf"}
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <hr className="border-zinc-200 dark:border-zinc-800" />

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
                    disabled={isActionLoading}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50"
                  >
                    {isActionLoading ? "선적 등록 중..." : "선적 등록 및 출고 확정 (Confirm Shipment)"}
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
          <div id="receiving-section" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-zinc-800 dark:text-white">창고 입고 및 실물 검수 정보</h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  도착한 선적 화물의 실물 수량 검수, 불량/보류 처리 및 실재고(Inventory) 반영을 관리합니다.
                </p>
              </div>
              {!showReceivingForm && !isReadOnly && (
                <button
                  type="button"
                  onClick={() => initReceivingForm()}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>📥</span>
                  <span>{receivings.some((r) => r.status === "DRAFT") ? "초안 검수 계속하기" : "+ 입고 검수 등록"}</span>
                </button>
              )}
            </div>

            {/* Waiting shipments list */}
            {shipments.filter(s => s.status === "ARRIVED" || s.status === "PARTIALLY_RECEIVED" || s.status === "IN_TRANSIT").length > 0 && !isReadOnly && !showReceivingForm && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-4 space-y-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                <h4 className="font-bold text-amber-800 dark:text-amber-400 text-xs flex items-center gap-1.5">
                  <span>📥</span>
                  <span>입고 검수 대상 선적물 (Shipments Eligible for Receiving)</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {shipments
                    .filter((s) => s.status !== "CANCELLED" && s.status !== "RECEIVED")
                    .map((shp) => (
                      <div key={shp.id} className="flex justify-between items-center bg-white dark:bg-zinc-950 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs">
                        <div>
                          <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{shp.shipment_number}</span>
                          <span className="ml-2 text-zinc-500 dark:text-zinc-400 text-[11px]">
                            {shp.shipping_method} | ETA: {shp.eta || "-"}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => initReceivingForm(shp.id)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
                        >
                          실물 검수 시작
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Receiving Form inline */}
            {showReceivingForm && (
              <form onSubmit={(e) => handleSubmitReceiving(e, false)} className="rounded-xl border-2 border-indigo-300 bg-white dark:bg-zinc-900 p-5 dark:border-indigo-800/80 shadow-md space-y-5">
                <div className="flex justify-between items-center border-b border-zinc-200 pb-3 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📥</span>
                    <div>
                      <h4 className="font-bold text-zinc-900 dark:text-white text-xs">
                        {editingReceivingId ? "창고 실물 입고 검수 수정 (DRAFT Edit)" : "창고 실물 입고 및 검수 등록 (Receiving & Inspection)"}
                      </h4>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        선적 화물의 실제 입고 수량 및 불량/보류 여부를 검수하여 기록합니다.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowReceivingForm(false);
                      setEditingReceivingId(null);
                    }}
                    className="text-zinc-400 hover:text-zinc-650 cursor-pointer text-xs font-bold px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    ✕ 취소 (Close)
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  {shipments.length > 0 && (
                    <div>
                      <label className="block font-bold text-zinc-600 dark:text-zinc-300 mb-1">입고 대상 선적물 (Shipment)</label>
                      <select
                        value={selectedShipmentId}
                        onChange={(e) => initReceivingForm(e.target.value)}
                        className="w-full rounded-lg border border-zinc-300 text-xs py-1.5 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                      >
                        <option value="">(전체 / PO 기준 직접 입고)</option>
                        {shipments
                          .filter((s) => s.status !== "CANCELLED")
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.shipment_number} ({s.status} / {s.carrier || "Carrier"})
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block font-bold text-zinc-600 dark:text-zinc-300 mb-1">실제 입고일자 (Received Date) *</label>
                    <input
                      type="date"
                      required
                      value={receivedDate}
                      onChange={(e) => setReceivedDate(e.target.value)}
                      onClick={(e) => (e.target as any).showPicker?.()}
                      className="w-full rounded-lg border border-zinc-300 text-xs py-1.5 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-600 dark:text-zinc-300 mb-1">실물 검수 입고 창고 (Warehouse) *</label>
                    <select
                      value={receivingWarehouseId}
                      onChange={(e) => setReceivingWarehouseId(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 text-xs py-1.5 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
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
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h5 className="font-bold text-zinc-900 dark:text-white text-xs flex items-center gap-1.5">
                      <span>📦</span>
                      <span>품목별 실물 검수 수량 (Line Items Inspection)</span>
                    </h5>
                    <span className="text-[11px] text-zinc-500">
                      양품 수량 = 입고 수량 - 불량 - 보류 (자동 계산 및 실재고 반영)
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-xl">
                    <table className="w-full text-left text-xs border-collapse bg-white dark:bg-zinc-950">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50/70 text-zinc-600 font-bold dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-200 text-[11px]">
                          <th className="p-3">제품명 / Letusto SKU</th>
                          <th className="p-3 text-right">선적 수량</th>
                          <th className="p-3 text-right">기입고 수량</th>
                          <th className="p-3 text-right">미입고 잔여</th>
                          <th className="p-3 text-right w-24">이번 입고 (Total)</th>
                          <th className="p-3 text-right w-20">불량 (Damaged)</th>
                          <th className="p-3 text-right w-20">보류 (Hold)</th>
                          <th className="p-3 text-right">최종 양품 (Accepted)</th>
                          <th className="p-3 text-right">차이 (Variance)</th>
                          <th className="p-3">특이사항 / 메모</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800/60 text-xs">
                        {receivingLines.map((line, idx) => {
                          const accepted = Math.max(0, (line.received_qty || 0) - (line.damaged_qty || 0) - (line.hold_qty || 0));
                          const lineVariance = (line.received_qty || 0) - (line.remaining_to_receive || 0);

                          return (
                            <tr key={line.inbound_shipment_line_id || line.purchase_order_line_id || idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                              <td className="p-3">
                                <span className="font-bold block text-zinc-900 dark:text-white">{line.product_name}</span>
                                <span className="font-mono text-[10px] text-zinc-400">{line.letusto_sku}</span>
                              </td>
                              <td className="p-3 text-right font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                                {(line.shipped_qty || 0).toLocaleString()}
                              </td>
                              <td className="p-3 text-right font-mono text-zinc-500">
                                {(line.previously_received || 0).toLocaleString()}
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                {(line.remaining_to_receive || 0).toLocaleString()}
                              </td>
                              <td className="p-3 text-right">
                                <input
                                  type="number"
                                  min={0}
                                  value={line.received_qty}
                                  onChange={(e) => {
                                    const updated = [...receivingLines];
                                    updated[idx].received_qty = Number(e.target.value);
                                    setReceivingLines(updated);
                                  }}
                                  className="w-20 text-right rounded-md border border-zinc-300 text-xs px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white font-mono font-bold focus:ring-indigo-500"
                                />
                              </td>
                              <td className="p-3 text-right">
                                <input
                                  type="number"
                                  min={0}
                                  value={line.damaged_qty}
                                  onChange={(e) => {
                                    const updated = [...receivingLines];
                                    updated[idx].damaged_qty = Number(e.target.value);
                                    setReceivingLines(updated);
                                  }}
                                  className="w-18 text-right rounded-md border border-zinc-300 text-xs px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900 dark:text-rose-400 font-mono focus:ring-indigo-500"
                                />
                              </td>
                              <td className="p-3 text-right">
                                <input
                                  type="number"
                                  min={0}
                                  value={line.hold_qty}
                                  onChange={(e) => {
                                    const updated = [...receivingLines];
                                    updated[idx].hold_qty = Number(e.target.value);
                                    setReceivingLines(updated);
                                  }}
                                  className="w-18 text-right rounded-md border border-zinc-300 text-xs px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900 dark:text-amber-400 font-mono focus:ring-indigo-500"
                                />
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {accepted.toLocaleString()}
                              </td>
                              <td className="p-3 text-right font-mono font-semibold">
                                <span className={lineVariance < 0 ? "text-rose-600 font-bold" : lineVariance > 0 ? "text-indigo-600 font-bold" : "text-zinc-400"}>
                                  {lineVariance > 0 ? `+${lineVariance}` : lineVariance}
                                </span>
                              </td>
                              <td className="p-3">
                                <input
                                  type="text"
                                  placeholder="불량 파손 부위 또는 비고"
                                  value={line.line_note || ""}
                                  onChange={(e) => {
                                    const updated = [...receivingLines];
                                    updated[idx].line_note = e.target.value;
                                    setReceivingLines(updated);
                                  }}
                                  className="w-full rounded-md border border-zinc-200 text-xs px-2 py-1 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t-2 border-zinc-200 dark:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-900/60 font-bold text-xs">
                        <tr>
                          <td className="p-3 text-zinc-600 dark:text-zinc-400">검수 합계 (Total)</td>
                          <td className="p-3 text-right font-mono">
                            {receivingLines.reduce((s, l) => s + (l.shipped_qty || 0), 0).toLocaleString()}
                          </td>
                          <td className="p-3 text-right font-mono text-zinc-500">
                            {receivingLines.reduce((s, l) => s + (l.previously_received || 0), 0).toLocaleString()}
                          </td>
                          <td className="p-3 text-right font-mono text-indigo-600">
                            {receivingLines.reduce((s, l) => s + (l.remaining_to_receive || 0), 0).toLocaleString()}
                          </td>
                          <td className="p-3 text-right font-mono text-zinc-900 dark:text-white">
                            {receivingLines.reduce((s, l) => s + (l.received_qty || 0), 0).toLocaleString()}
                          </td>
                          <td className="p-3 text-right font-mono text-rose-600">
                            {receivingLines.reduce((s, l) => s + (l.damaged_qty || 0), 0).toLocaleString()}
                          </td>
                          <td className="p-3 text-right font-mono text-amber-600">
                            {receivingLines.reduce((s, l) => s + (l.hold_qty || 0), 0).toLocaleString()}
                          </td>
                          <td className="p-3 text-right font-mono text-emerald-600">
                            {receivingLines.reduce((s, l) => s + Math.max(0, (l.received_qty || 0) - (l.damaged_qty || 0) - (l.hold_qty || 0)), 0).toLocaleString()}
                          </td>
                          <td className="p-3 text-right font-mono">
                            {(() => {
                              const totalVar = receivingLines.reduce((s, l) => s + ((l.received_qty || 0) - (l.remaining_to_receive || 0)), 0);
                              return (
                                <span className={totalVar < 0 ? "text-rose-600" : totalVar > 0 ? "text-indigo-600" : "text-zinc-500"}>
                                  {totalVar > 0 ? `+${totalVar}` : totalVar}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="p-3 text-zinc-400 font-normal text-[11px]">-</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="text-[11px] text-zinc-500">
                    * <strong>[입고 확정]</strong> 시 실시간 재고 이동(Inventory Movement) 및 가용재고가 자동 반영됩니다.
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowReceivingForm(false);
                        setEditingReceivingId(null);
                      }}
                      className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-lg cursor-pointer"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      disabled={isActionLoading}
                      onClick={(e) => handleSubmitReceiving(e, false)}
                      className="px-3.5 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-800 dark:text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <span>💾</span>
                      <span>{isActionLoading ? "저장 중..." : editingReceivingId ? "초안 수정 저장 (Update Draft)" : "임시저장 (Save Draft)"}</span>
                    </button>
                    <button
                      type="button"
                      disabled={isActionLoading}
                      onClick={(e) => handleSubmitReceiving(e, true)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <span>{isActionLoading ? "⏳" : "✔️"}</span>
                      <span>{isActionLoading ? "입고 확정 중..." : "검수 및 입고 확정 (Save & Finalize)"}</span>
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* List receivings */}
            <div className="grid grid-cols-1 gap-6">
              {receivings.length === 0 && !showReceivingForm ? (
                <div className="py-10 px-6 border-2 border-dashed border-indigo-200 dark:border-indigo-900/60 rounded-xl text-center bg-indigo-50/20 dark:bg-zinc-900/40 space-y-3">
                  <div className="text-3xl">📥</div>
                  <div>
                    <h4 className="font-bold text-sm text-zinc-900 dark:text-white">선적 화물이 출고되어 창고 입고 검수가 가능합니다.</h4>
                    <p className="text-xs text-zinc-500 mt-1">창고에 실물이 도착했을 때 실입고 수량, 불량, 보류 수량을 검수하여 기록하세요.</p>
                  </div>
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => initReceivingForm()}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <span>📥</span>
                      <span>입고 검수 등록 시작 (Start Receiving)</span>
                    </button>
                  )}
                </div>
              ) : (
                receivings.map((r) => (
                  <div key={r.id} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
                    <div className="flex justify-between items-center border-b border-zinc-150 pb-3 dark:border-zinc-850">
                      <div>
                        <span className="font-mono text-sm font-bold text-zinc-900 dark:text-white">{r.receiving_number}</span>
                        <span className="ml-2.5 text-[10px] text-zinc-500">입고일자: {r.received_date}</span>
                        {r.warehouse?.name && (
                          <span className="ml-2 text-[10px] text-zinc-400">| 입고 창고: [{r.warehouse?.code}] {r.warehouse?.name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {r.status === "DRAFT" && !isReadOnly && (
                          <>
                            <button
                              type="button"
                              onClick={() => initReceivingForm(undefined, r)}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded transition-colors cursor-pointer"
                            >
                              ✏️ 초안 수정 (Edit Draft)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFinalizeReceiving(r.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded transition-colors cursor-pointer"
                            >
                              ✔️ 입고 전표 확정 (Finalize)
                            </button>
                          </>
                        )}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          r.status === "FINALIZED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                            : "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                        }`}>
                          {r.status}
                        </span>
                      </div>
                    </div>

                    {/* Table of receiving line results */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px] border-collapse bg-zinc-50 dark:bg-zinc-950 rounded-lg">
                        <thead>
                          <tr className="border-b border-zinc-200 bg-zinc-100/50 text-zinc-600 font-bold dark:border-zinc-850 dark:bg-zinc-900/50 dark:text-zinc-200">
                            <th className="p-2.5">제품 코드 / Letusto SKU</th>
                            <th className="p-2.5">제품명</th>
                            <th className="p-2.5 text-right">총 입고 수량</th>
                            <th className="p-2.5 text-right text-emerald-600">최종 양품 (Accepted)</th>
                            <th className="p-2.5 text-right text-rose-600">불량 (Damaged)</th>
                            <th className="p-2.5 text-right text-amber-600">보류 (Hold)</th>
                            <th className="p-2.5">특이사항</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800">
                          {(r.lines || []).map((line: any) => (
                            <tr key={line.id} className="align-middle">
                              <td className="p-2.5 font-mono font-bold text-zinc-700 dark:text-zinc-300">{line.letusto_sku || "-"}</td>
                              <td className="p-2.5 font-medium">{line.product_name || "Unknown Product"}</td>
                              <td className="p-2.5 text-right font-mono font-semibold">{line.received_qty}개</td>
                              <td className="p-2.5 text-right font-mono font-bold text-emerald-600">
                                {Math.max(0, line.received_qty - (line.damaged_qty || 0) - (line.hold_qty || 0))}개
                              </td>
                              <td className="p-2.5 text-right font-mono text-rose-600">{line.damaged_qty || 0}개</td>
                              <td className="p-2.5 text-right font-mono text-amber-600">{line.hold_qty || 0}개</td>
                              <td className="p-2.5 text-zinc-500">{line.line_note || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* PO Completion Banner when all receivings are finalized */}
            {receivings.some((r) => r.status === "FINALIZED") && !showReceivingForm && !isReadOnly && po.po_status !== "CANCELLED" && (po.fulfillment_status as string) !== "COMPLETED" && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                <div>
                  <h4 className="font-bold text-xs text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                    <span>🏁</span>
                    <span>입고 검수 완료 및 발주 종결 처리 (PO Completion)</span>
                  </h4>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
                    모든 검수가 완료되었거나 추가 입고가 없을 경우 발주를 최종 완료 상태(Step 6 Completed)로 종결합니다.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenCompleteModal(false)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-sm"
                  >
                    발주 완료 종결 (Complete PO)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenCompleteModal(true)}
                    className="px-3.5 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    차이 수량 종결 (Complete with Variance)
                  </button>
                </div>
              </div>
            )}
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

      {/* Complete PO Modal */}
      {showCompletePoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-5">
            <div className="flex justify-between items-center border-b border-zinc-150 pb-3 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎉</span>
                <div>
                  <h3 className="text-sm font-black text-zinc-900 dark:text-white">
                    발주 최종 종결 (Complete Purchase Order)
                  </h3>
                  <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                    {po.po_number}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowCompletePoModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Summary metrics strip */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <div>
                <span className="text-[10px] text-zinc-400 block font-bold">발주 수량</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-white">{po.total_qty.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block font-bold">출고 수량</span>
                <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">{stats.shipped.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block font-bold">최종 양품 입고</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{stats.accepted.toLocaleString()}</span>
              </div>
            </div>

            {/* Variance Warning if shortage or variance exists */}
            {(completeWithVariance || stats.variance !== 0) && (
              <div className="rounded-xl border border-amber-300 bg-amber-50/50 dark:border-amber-900/60 dark:bg-amber-950/30 p-3.5 space-y-1.5 text-xs text-amber-900 dark:text-amber-300">
                <div className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-400">
                  <span>⚠️</span>
                  <span>발주-입고 수량 차이 발생 (Variance: {stats.variance > 0 ? `+${stats.variance}` : stats.variance} PCS)</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-300/80">
                  발주 수량({po.total_qty.toLocaleString()}개) 대비 실제 최종 승인 입고 수량({stats.accepted.toLocaleString()}개)에 차이가 있습니다.
                  공급사와의 협의를 완료하였으며 더 이상의 추가 입고 없이 발주를 종결 처리하시겠습니까?
                </p>
              </div>
            )}

            <form onSubmit={handleExecuteCompletePo} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  종결 사유 및 메모 (Completion Note)
                </label>
                <textarea
                  rows={3}
                  placeholder="발주 종결 관련 특이사항이나 메모를 입력해주세요."
                  value={completePoNote}
                  onChange={(e) => setCompletePoNote(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-white focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-150 dark:border-zinc-850">
                <button
                  type="button"
                  onClick={() => setShowCompletePoModal(false)}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs rounded-xl dark:bg-zinc-800 dark:text-zinc-300"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isCompletingPo}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <span>🎉</span>
                  <span>{isCompletingPo ? "종결 처리 중..." : "발주 최종 종결 확정"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  </div>
);
}
