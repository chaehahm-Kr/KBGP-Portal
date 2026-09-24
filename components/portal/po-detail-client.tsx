"use client";

// Task ID: ADM-PUR-UI-001-R3 / PORT-PO-UI-001-R3 (Shipment Confirmation & Progress Synchronization)
import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  confirmPortalPurchaseOrder,
  withdrawPortalPoChangeRequest,
  submitPortalGoodsReady,
  submitPortalSupplierArrangedShipment,
  supplierRespondCancellation,
} from "@/lib/portal/actions";
import {
  getOverallStatus,
  OVERALL_STATUS_LABELS,
  OVERALL_STATUS_COLORS,
} from "@/lib/purchase-order/status-helper";
import { PoUnifiedStepper } from "@/components/shared/po-unified-stepper";
import {
  PoDocument,
  PoDocumentType,
  PO_DOCUMENT_TYPE_LABELS,
  PO_DOCUMENT_TYPE_BADGES,
} from "@/lib/purchase-order/document-types";
import { uploadPoDocument } from "@/lib/purchase-order/document-actions";
import { parseSpecialInstructions } from "@/lib/purchase-order/forwarder-helper";
import { formatActionError } from "@/lib/utils/error-formatter";
import {
  buildPoChangeInquiryUrl,
  getNormalizedStatus,
  OFFICIAL_STATUS_LABEL,
  OFFICIAL_STATUS_COLOR,
} from "@/lib/inquiry/types";

interface PoLine {
  id: string;
  qty: number;
  confirmed_qty: number | null;
  unit_cost: number;
  line_note: string | null;
  product: {
    id: string;
    name: string;
    letusto_sku: string;
    manufacture_sku: string;
  };
}

interface ChangeRequest {
  id: string;
  purchaseOrderLineId: string;
  requestType: "QUANTITY" | "PRICE" | "OTHER";
  originalQty: number;
  proposedQty: number;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  reviewerName: string | null;
}

interface PoDetailClientProps {
  po: {
    id: string;
    po_number: string;
    po_status: string;
    fulfillment_status: string;
    supplier_confirmation_status: string;
    shipping_responsibility?: "LETUSTO_ARRANGED" | "SUPPLIER_ARRANGED";
    order_date: string;
    currency: string;
    created_at: string;
    payment_terms?: string | null;
    incoterms?: string | null;
    port_of_loading?: string | null;
    expected_ready_date?: string | null;
    expected_ship_date?: string | null;
    eta?: string | null;
    destination_warehouse_id?: string;
    ship_from_warehouse_id?: string | null;
    supplier_facing_note?: string | null;
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
    supplier?: any;
    company?: any;
    warehouse?: any;
    ship_from_warehouse?: any;
    total_qty?: number;
    total_amount?: number;
    lines: PoLine[];
  };
  changeRequests: ChangeRequest[];
  shipments?: any[];
  receivings?: any[];
  goodsReadiness?: any[];
  warehouses?: any[];
  shippingOrigins?: any[];
  documents?: PoDocument[];
  linkedCases?: any[];
}

export default function PoDetailClient({
  po,
  changeRequests,
  shipments = [],
  receivings = [],
  goodsReadiness = [],
  warehouses = [],
  shippingOrigins = [],
  documents = [],
  linkedCases = [],
}: PoDetailClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const [isConfirming, setIsConfirming] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState<string | null>(null);

  const [generalError, setGeneralError] = useState<string | null>(null);
  const [generalSuccess, setGeneralSuccess] = useState<string | null>(null);
  const [isRespondingCancel, setIsRespondingCancel] = useState(false);

  // Active or closed linked change request cases
  const allLinkedCases = useMemo(() => {
    return linkedCases.length > 0 ? linkedCases : (po.linked_cases || []);
  }, [linkedCases, po.linked_cases]);

  const activeChangeCase = useMemo(() => {
    return allLinkedCases.find((c: any) => getNormalizedStatus(c.status) !== "CLOSED");
  }, [allLinkedCases]);

  const latestClosedCase = useMemo(() => {
    return allLinkedCases.find((c: any) => getNormalizedStatus(c.status) === "CLOSED");
  }, [allLinkedCases]);

  // Confirm Modal state & per-line confirmed qty
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmLines, setConfirmLines] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    po.lines.forEach((l) => {
      init[l.id] = l.confirmed_qty ?? l.qty;
    });
    return init;
  });

  // Line quantities aggregation for 5-stage qty flow
  const lineQuantities = useMemo(() => {
    const map: Record<string, { readyQty: number; shippedQty: number; receivedQty: number }> = {};
    
    (goodsReadiness || []).forEach((gr) => {
      const grLines = gr.lines || gr.items || [];
      grLines.forEach((item: any) => {
        const lineId = item.purchase_order_line_id;
        if (!map[lineId]) map[lineId] = { readyQty: 0, shippedQty: 0, receivedQty: 0 };
        map[lineId].readyQty += Number(item.ready_qty || 0);
      });
    });

    (shipments || []).forEach((shp) => {
      if (shp.status === "CANCELLED") return;
      (shp.lines || []).forEach((sl: any) => {
        const lineId = sl.purchase_order_line_id;
        if (!map[lineId]) map[lineId] = { readyQty: 0, shippedQty: 0, receivedQty: 0 };
        map[lineId].shippedQty += Number(sl.shipped_qty || 0);
      });
    });

    (receivings || []).forEach((rcv) => {
      (rcv.lines || []).forEach((rl: any) => {
        const lineId = rl.purchase_order_line_id;
        if (!map[lineId]) map[lineId] = { readyQty: 0, shippedQty: 0, receivedQty: 0 };
        map[lineId].receivedQty += Number(rl.received_qty || 0);
      });
    });

    return map;
  }, [goodsReadiness, shipments, receivings]);

  // Goods Readiness Form State
  const [showGoodsReadyForm, setShowGoodsReadyForm] = useState(false);
  const [selectedOriginId, setSelectedOriginId] = useState("");
  const [goodsReadyDate, setGoodsReadyDate] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [handoverLocation, setHandoverLocation] = useState("");
  const [fobPort, setFobPort] = useState("");
  const [warehouseFactoryAddress, setWarehouseFactoryAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [forwarderName, setForwarderName] = useState("");
  const [forwarderContact, setForwarderContact] = useState("");
  const [forwarderEmail, setForwarderEmail] = useState("");
  const [forwarderPhone, setForwarderPhone] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [packingListPath, setPackingListPath] = useState("");
  const [packingListFilename, setPackingListFilename] = useState("");
  const [commercialInvoicePath, setCommercialInvoicePath] = useState("");
  const [commercialInvoiceFilename, setCommercialInvoiceFilename] = useState("");
  const [readyLines, setReadyLines] = useState<Array<{
    purchase_order_line_id: string;
    product_id: string;
    product_name: string;
    letusto_sku: string;
    qty: number;
    ready_qty: number;
    cartons: number;
    gross_weight: number;
    cbm: number;
    product?: any;
  }>>([]);

  const [editingReadinessId, setEditingReadinessId] = useState<string | null>(null);

  // Document Upload Modal state
  const [showDocUploadModal, setShowDocUploadModal] = useState(false);
  const [uploadDocType, setUploadDocType] = useState<PoDocumentType>("PACKING_LIST");
  const [uploadRelatedType, setUploadRelatedType] = useState<"PO" | "GOODS_READY" | "SHIPMENT">("PO");
  const [uploadRelatedId, setUploadRelatedId] = useState<string>("");
  const [uploadNote, setUploadNote] = useState<string>("");
  const [selectedDocFile, setSelectedDocFile] = useState<File | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  // Helper: check if readiness record is linked to an active shipment
  const isLinkedToActiveShipment = (gr: any) => {
    const grLineIds = (gr.lines || []).map((l: any) => l.id);
    return (shipments || []).some((shp: any) => {
      if (shp.status === "CANCELLED") return false;
      return (shp.lines || []).some((sl: any) => grLineIds.includes(sl.goods_readiness_line_id));
    });
  };

  const totalTargetQty = useMemo(() => {
    return po.lines.reduce((sum, l) => sum + (l.confirmed_qty ?? l.qty), 0);
  }, [po.lines]);

  const totalReadyCommitted = useMemo(() => {
    return (goodsReadiness || []).reduce((sum, gr) => {
      if (gr.handover_status === "CANCELLED") return sum;
      const lines = gr.lines || [];
      return sum + lines.reduce((lSum: number, l: any) => lSum + Number(l.ready_qty || 0), 0);
    }, 0);
  }, [goodsReadiness]);

  const unlinkedReadiness = useMemo(() => {
    return (goodsReadiness || []).find((gr) => gr.handover_status !== "CANCELLED" && !isLinkedToActiveShipment(gr));
  }, [goodsReadiness, shipments]);

  const remainingTargetQty = Math.max(0, totalTargetQty - totalReadyCommitted);

  // Direct Shipment submission for Supplier Arranged shipping
  const [showSupplierShipmentForm, setShowSupplierShipmentForm] = useState<string | null>(null);
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [billOfLading, setBillOfLading] = useState("");
  const [etd, setEtd] = useState("");
  const [eta, setEta] = useState("");

  const overallStatus = useMemo(() => {
    return getOverallStatus(po, shipments, receivings, goodsReadiness);
  }, [po, shipments, receivings, goodsReadiness]);

  // Aggregate quantities
  const stats = useMemo(() => {
    const activeShipments = shipments.filter((s) => s.status !== "CANCELLED");
    const finalizedReceivings = receivings.filter((r) => r.status === "FINALIZED");

    const totalShipped = Math.max(
      activeShipments.reduce(
        (sum, s) => sum + (s.lines ?? []).reduce((lSum: number, sl: any) => lSum + (Number(sl.shipped_qty) || 0), 0),
        0
      ),
      po.lines.reduce((sum, l) => sum + Number((l as any).shipped_qty !== undefined ? (l as any).shipped_qty : lineQuantities[l.id]?.shippedQty || 0), 0)
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

    const variance = totalAccepted - po.lines.reduce((sum, l) => sum + l.qty, 0);

    return {
      shipped: totalShipped,
      received: totalReceived,
      accepted: totalAccepted,
      damaged: totalDamaged,
      variance,
    };
  }, [po.lines, shipments, receivings]);

  // Helper function for packaging auto-calculation
  const calcPackaging = (readyQty: number, prod: any) => {
    const packQty = Math.max(1, Number(prod?.carton_pack_qty) || 1);
    const cartons = Math.ceil(readyQty / packQty);
    const weightPerCarton = Number(prod?.carton_weight) || (Number(prod?.piece_weight || 0) * packQty) || 0;
    const cbmPerCarton = Number(prod?.carton_cbm) || 0;
    return {
      cartons: cartons > 0 ? cartons : 1,
      gross_weight: Math.round(cartons * weightPerCarton * 100) / 100,
      cbm: Math.round(cartons * cbmPerCarton * 1000) / 1000,
    };
  };

  // Initialize goods readiness form lines (Edit vs Create / Additional)
  const initGoodsReadinessForm = (targetGr?: any) => {
    if (targetGr) {
      // EDIT MODE
      setEditingReadinessId(targetGr.id);
      setGoodsReadyDate(targetGr.goods_ready_date || "");
      setSelectedOriginId("");
      setPickupLocation(targetGr.pickup_location || "");
      setHandoverLocation(targetGr.handover_location || "공장 상차 / CY 전달");
      setFobPort(targetGr.fob_port || po.port_of_loading || "Busan Port");
      setWarehouseFactoryAddress(targetGr.warehouse_factory_address || "");
      setContactPerson(targetGr.contact_person || "");
      const parts = (targetGr.contact_person || "").split(" / ");
      setContactName(parts[0] || "");
      setContactEmail(parts[1] || "");
      setContactPhone(parts[2] || "");

      const fwd = parseSpecialInstructions(targetGr.special_instructions);
      setForwarderName(fwd.forwarderName || "");
      setForwarderContact(fwd.forwarderContact || "");
      setForwarderEmail(fwd.forwarderEmail || "");
      setForwarderPhone(fwd.forwarderPhone || "");
      setSpecialInstructions(fwd.notes || "");

      setPackingListPath(targetGr.packing_list_path || "");
      setPackingListFilename(targetGr.packing_list_filename || "");
      setCommercialInvoicePath(targetGr.commercial_invoice_path || "");
      setCommercialInvoiceFilename(targetGr.commercial_invoice_filename || "");

      const items = po.lines.map((l) => {
        const existingLine = (targetGr.lines || []).find((gl: any) => gl.purchase_order_line_id === l.id);
        const readyQty = existingLine ? existingLine.ready_qty : (l.confirmed_qty ?? l.qty);
        const cartons = existingLine && existingLine.cartons !== undefined ? existingLine.cartons : calcPackaging(readyQty, l.product).cartons;
        const grossWeight = existingLine && existingLine.gross_weight !== undefined ? Number(existingLine.gross_weight) : calcPackaging(readyQty, l.product).gross_weight;
        const cbm = existingLine && existingLine.cbm !== undefined ? Number(existingLine.cbm) : calcPackaging(readyQty, l.product).cbm;

        return {
          purchase_order_line_id: l.id,
          product_id: l.product.id,
          product_name: l.product.name,
          letusto_sku: l.product.letusto_sku,
          qty: l.qty,
          ready_qty: readyQty,
          cartons,
          gross_weight: grossWeight,
          cbm,
          product: l.product,
        };
      });
      setReadyLines(items);
    } else {
      // CREATE MODE (New or Additional)
      setEditingReadinessId(null);
      setGoodsReadyDate(po.expected_ready_date || new Date().toISOString().split("T")[0]);
      
      const defaultOrigin = shippingOrigins.find((o) => o.is_default) || shippingOrigins[0];
      if (defaultOrigin) {
        setSelectedOriginId(defaultOrigin.id);
        setPickupLocation(defaultOrigin.name || "");
        setWarehouseFactoryAddress([defaultOrigin.address_line1, defaultOrigin.address_line2, defaultOrigin.city, defaultOrigin.country].filter(Boolean).join(", "));
        setContactName(defaultOrigin.contact_name || "");
        setContactEmail(defaultOrigin.email || "");
        setContactPhone(defaultOrigin.phone || "");
        setContactPerson([defaultOrigin.contact_name, defaultOrigin.email, defaultOrigin.phone].filter(Boolean).join(" / "));
      } else {
        setSelectedOriginId("");
        setPickupLocation("");
        setWarehouseFactoryAddress("");
        setContactName("");
        setContactEmail("");
        setContactPhone("");
        setContactPerson("");
      }
      setHandoverLocation("공장 상차 / CY 전달");
      setFobPort(po.port_of_loading || "Busan Port");
      setForwarderName("");
      setForwarderContact("");
      setForwarderEmail("");
      setForwarderPhone("");
      setSpecialInstructions("");
      setPackingListPath("");
      setPackingListFilename("");
      setCommercialInvoicePath("");
      setCommercialInvoiceFilename("");

      // Calculate remaining allowable qty per line
      const items = po.lines.map((l) => {
        const targetQty = l.confirmed_qty ?? l.qty;
        const otherActiveSum = (goodsReadiness || []).reduce((sum, otherGr) => {
          if (otherGr.handover_status === "CANCELLED") return sum;
          const line = (otherGr.lines || []).find((gl: any) => gl.purchase_order_line_id === l.id);
          return sum + Number(line?.ready_qty || 0);
        }, 0);

        const remainingAvailable = Math.max(0, targetQty - otherActiveSum);
        const pack = calcPackaging(remainingAvailable, l.product);

        return {
          purchase_order_line_id: l.id,
          product_id: l.product.id,
          product_name: l.product.name,
          letusto_sku: l.product.letusto_sku,
          qty: l.qty,
          ready_qty: remainingAvailable,
          cartons: pack.cartons,
          gross_weight: pack.gross_weight,
          cbm: pack.cbm,
          product: l.product,
        };
      });
      setReadyLines(items);
    }

    setShowGoodsReadyForm(true);
  };

  // Handle direct document upload
  const handleDocumentUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocFile) {
      alert("업로드할 파일을 선택해주세요.");
      return;
    }
    setIsUploadingDoc(true);
    setGeneralError(null);
    setGeneralSuccess(null);
    try {
      const formData = new FormData();
      formData.append("poId", po.id);
      formData.append("documentType", uploadDocType);
      formData.append("relatedType", uploadRelatedType);
      if (uploadRelatedId) formData.append("relatedId", uploadRelatedId);
      if (uploadNote) formData.append("note", uploadNote);
      formData.append("file", selectedDocFile);

      await uploadPoDocument(formData);
      setGeneralSuccess("증빙 서류가 성공적으로 업로드되었습니다.");
      setShowDocUploadModal(false);
      setSelectedDocFile(null);
      setUploadNote("");
      router.refresh();
    } catch (err: any) {
      setGeneralError(formatActionError(err, "서류 업로드 실패"));
    } finally {
      setIsUploadingDoc(false);
    }
  };

  // Confirm PO with per-line Confirmed Quantities
  const handleConfirmSubmit = async () => {
    setIsConfirming(true);
    setGeneralError(null);
    setGeneralSuccess(null);
    try {
      const payloadLines = po.lines.map((l) => ({
        lineId: l.id,
        confirmedQty: Number(confirmLines[l.id] ?? l.qty),
      }));
      await confirmPortalPurchaseOrder(po.id, payloadLines);
      setShowConfirmModal(false);
      setGeneralSuccess("발주 확인 처리가 성공적으로 완료되었습니다.");
      router.refresh();
    } catch (err: any) {
      setGeneralError(formatActionError(err, "확인 처리 중 오류가 발생했습니다."));
    } finally {
      setIsConfirming(false);
    }
  };

  // Supplier Cancellation Responses
  const handleApproveCancellation = async () => {
    if (!window.confirm("발주 취소 요청에 동의하시겠습니까? 동의 시 이 발주서는 취소(CANCELLED) 처리됩니다.")) return;
    setIsRespondingCancel(true);
    setGeneralError(null);
    setGeneralSuccess(null);
    try {
      await supplierRespondCancellation(po.id, "APPROVE");
      setGeneralSuccess("발주 취소에 동의하여 취소 처리가 완료되었습니다.");
      router.refresh();
    } catch (err: any) {
      setGeneralError(formatActionError(err, "취소 동의 처리 실패"));
    } finally {
      setIsRespondingCancel(false);
    }
  };

  const handleRejectCancellation = async () => {
    const reason = window.prompt("발주 취소 거절 사유를 입력해주세요 (예: 이미 원자재 발주 완료 및 생산 착수):");
    if (reason === null) return;
    if (!reason.trim()) {
      alert("취소 거절 사유를 반드시 입력해주세요.");
      return;
    }
    setIsRespondingCancel(true);
    setGeneralError(null);
    setGeneralSuccess(null);
    try {
      await supplierRespondCancellation(po.id, "REJECT", reason.trim());
      setGeneralSuccess("발주 취소 요청을 거절하였습니다. 발주는 유효 상태로 유지됩니다.");
      router.refresh();
    } catch (err: any) {
      setGeneralError(formatActionError(err, "취소 거절 처리 실패"));
    } finally {
      setIsRespondingCancel(false);
    }
  };

  // Withdraw legacy change request
  const handleWithdraw = async (requestId: string) => {
    if (!window.confirm("제출한 변경 요청을 철회하시겠습니까?")) return;
    setIsWithdrawing(requestId);
    setGeneralError(null);
    setGeneralSuccess(null);
    try {
      await withdrawPortalPoChangeRequest(requestId);
      setGeneralSuccess("변경 요청 철회가 완료되었습니다.");
      router.refresh();
    } catch (err: any) {
      setGeneralError(err.message || "철회 처리 실패");
    } finally {
      setIsWithdrawing(null);
    }
  };

  // Submit Goods readiness inline
  const handleSubmitGoodsReady = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setGeneralSuccess(null);
    setIsConfirming(true);

    const fullContact = contactPerson.trim() || [contactName, contactEmail, contactPhone].filter(Boolean).join(" / ");

    try {
      const res = await submitPortalGoodsReady({
        id: editingReadinessId || undefined,
        purchaseOrderId: po.id,
        goodsReadyDate,
        pickupLocation,
        handoverLocation,
        fobPort,
        warehouseFactoryAddress,
        contactPerson: fullContact,
        forwarderName,
        forwarderContact,
        forwarderEmail,
        forwarderPhone,
        specialInstructions,
        packingListPath: packingListPath || null,
        packingListFilename: packingListFilename || null,
        commercialInvoicePath: commercialInvoicePath || null,
        commercialInvoiceFilename: commercialInvoiceFilename || null,
        handoverStatus: "READY_SUBMITTED",
        lines: readyLines.map((l) => ({
          purchaseOrderLineId: l.purchase_order_line_id,
          productId: l.product_id,
          readyQty: l.ready_qty,
          cartons: l.cartons,
          grossWeight: l.gross_weight,
          cbm: l.cbm,
        })),
      });

      setGeneralSuccess(
        res.isUpdate
          ? "출고 준비(Goods Readiness) 정보 수정이 성공적으로 완료되었습니다."
          : "출고 준비(Goods Readiness) 등록이 완료되었습니다."
      );
      setShowGoodsReadyForm(false);
      router.refresh();
    } catch (err: any) {
      setGeneralError(formatActionError(err, "출고 준비 정보 저장 실패"));
    } finally {
      setIsConfirming(false);
    }
  };

  // Submit Supplier Arranged Shipment
  const handleSupplierShipmentSubmit = async (e: React.FormEvent, grId: string) => {
    e.preventDefault();
    setGeneralError(null);
    setGeneralSuccess(null);
    setIsConfirming(true);

    try {
      await submitPortalSupplierArrangedShipment(grId, {
        carrier,
        trackingNumber,
        billOfLading,
        etd,
        eta,
      });

      setGeneralSuccess("선적물 물류 정보 연동이 성공적으로 완료되었습니다.");
      setShowSupplierShipmentForm(null);
      router.refresh();
    } catch (err: any) {
      setGeneralError(formatActionError(err, "선적 정보 등록 실패"));
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/portal/orders/purchase-orders"
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
        >
          ← 주문 목록으로 돌아가기
        </Link>
      </div>

      {/* Messages */}
      {generalError && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 font-bold dark:bg-rose-955/10 dark:border-rose-900/50 dark:text-rose-400 text-xs">
          ⚠️ {generalError}
        </div>
      )}
      {generalSuccess && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-250 text-emerald-700 font-bold dark:bg-emerald-950/10 dark:border-emerald-900/50 dark:text-emerald-400 text-xs">
          ✓ {generalSuccess}
        </div>
      )}

      {/* Cancellation Request Review Banner */}
      {po.cancellation_status === "CANCELLATION_REQUESTED" && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 dark:bg-amber-950/20 dark:border-amber-900 dark:text-amber-300 text-xs space-y-3 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200 dark:border-amber-900/60 pb-2">
            <span className="font-bold text-sm flex items-center gap-1.5">
              ⚠️ [어드민 발주 취소 동의 요청 접수]
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRejectCancellation}
                disabled={isRespondingCancel}
                className="px-3 py-1.5 bg-white hover:bg-zinc-100 text-zinc-700 font-bold rounded-lg border border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700 cursor-pointer disabled:opacity-50"
              >
                취소 거절 (Reject)
              </button>
              <button
                onClick={handleApproveCancellation}
                disabled={isRespondingCancel}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg cursor-pointer disabled:opacity-50"
              >
                {isRespondingCancel ? "처리 중..." : "취소 동의 (Agree)"}
              </button>
            </div>
          </div>
          <div className="text-xs">
            <span className="font-bold">취소 요청 사유: </span>
            <span>{po.cancellation_reason || "(사유 미기재)"}</span>
          </div>
          <p className="text-[11px] text-amber-700 dark:text-amber-400">
            * 이미 원부자재 수급이나 생산이 진행 중인 경우 취소를 거절하실 수 있으며, 동의 시 본 발주서는 즉시 취소(CANCELLED)됩니다.
          </p>
        </div>
      )}


      {/* Confirm PO Modal with per-line Confirmed Qty */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-zinc-150 pb-3 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">✓ 발주서 확인 및 수량 확정</h3>
                <p className="text-xs text-zinc-500 mt-0.5 font-mono">PO: {po.po_number}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="text-zinc-400 hover:text-zinc-650 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              각 품목별 납품 가능 확정 수량을 확인해 주세요. 수량 변동이 없는 경우 발주 수량 그대로 확정됩니다.
            </p>

            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-850/50 text-zinc-500 font-bold border-b border-zinc-200 dark:border-zinc-800">
                    <th className="p-3">품목명 / SKU</th>
                    <th className="p-3 text-right">발주 수량</th>
                    <th className="p-3 text-right w-36">확정 납품 수량</th>
                    <th className="p-3 text-right">단가</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800">
                  {po.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="p-3">
                        <span className="font-bold text-zinc-900 dark:text-white block">{l.product.name}</span>
                        <span className="font-mono text-[10px] text-zinc-450 block">{l.product.letusto_sku}</span>
                      </td>
                      <td className="p-3 text-right font-mono font-semibold">{l.qty.toLocaleString()} PCS</td>
                      <td className="p-3 text-right">
                        <input
                          type="number"
                          min="0"
                          value={confirmLines[l.id] ?? l.qty}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setConfirmLines((prev) => ({ ...prev, [l.id]: val }));
                          }}
                          className="w-full text-right font-mono font-bold rounded-lg border border-zinc-300 p-1.5 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                        />
                      </td>
                      <td className="p-3 text-right font-mono">
                        {po.currency} {l.unit_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-zinc-150 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  const reset: Record<string, number> = {};
                  po.lines.forEach((l) => { reset[l.id] = l.qty; });
                  setConfirmLines(reset);
                }}
                className="text-xs text-indigo-600 hover:underline cursor-pointer"
              >
                전체 수량 발주량으로 초기화
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSubmit}
                  disabled={isConfirming}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  {isConfirming ? "확정 처리 중..." : "✓ 발주 확정 제출 (Confirm)"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Open PO Change Request Case Banner */}
      {activeChangeCase && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base leading-none">📝</span>
            <span className="font-bold">PO 변경 요청 진행 중</span>
            {activeChangeCase.case_number && (
              <span className="font-mono font-bold text-zinc-600 dark:text-zinc-300">#{activeChangeCase.case_number}</span>
            )}
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${OFFICIAL_STATUS_COLOR[getNormalizedStatus(activeChangeCase.status)]}`}>
              {OFFICIAL_STATUS_LABEL[getNormalizedStatus(activeChangeCase.status)].ko}
            </span>
            <span className="text-[11px] text-amber-800 dark:text-amber-300 truncate max-w-xs">{activeChangeCase.title}</span>
          </div>
          <Link
            href={`/portal/support?case=${activeChangeCase.case_number || activeChangeCase.id}`}
            className="font-bold text-xs text-amber-800 hover:text-amber-950 dark:text-amber-300 dark:hover:text-white underline whitespace-nowrap cursor-pointer"
          >
            문의 보기 →
          </Link>
        </div>
      )}

      {!activeChangeCase && latestClosedCase && (
        <div className="p-3 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-600 dark:bg-zinc-800/60 dark:border-zinc-700 dark:text-zinc-300 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm">🔒</span>
            <span className="font-semibold text-zinc-700 dark:text-zinc-200">PO 변경 요청 종료</span>
            {latestClosedCase.case_number && (
              <span className="font-mono text-[11px] text-zinc-500">#{latestClosedCase.case_number}</span>
            )}
            <span className="text-[11px] text-zinc-500 truncate max-w-xs">{latestClosedCase.title}</span>
          </div>
          <Link
            href={`/portal/support?case=${latestClosedCase.case_number || latestClosedCase.id}`}
            className="text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 underline whitespace-nowrap cursor-pointer"
          >
            문의 내역 보기 →
          </Link>
        </div>
      )}

      {/* Unified 6-Step Stepper Component */}
      <PoUnifiedStepper
        overallStatus={overallStatus || "Draft"}
        revisionNo={po.revision_no ?? 1}
        supplierConfirmationStatus={po.supplier_confirmation_status}
        confirmedByName={po.confirmed_by_name}
        confirmedAt={po.confirmed_at}
        cancellationStatus={po.cancellation_status}
        cancellationReason={po.cancellation_reason}
        cancellationRequestedAt={po.cancellation_requested_at}
        cancellationRejectReason={po.cancellation_reject_reason}
        cancellationRejectedAt={po.cancellation_rejected_at}
        nextActionSlot={
          <div className="flex items-center flex-wrap gap-2">
            {po.cancellation_status === "CANCELLATION_REQUESTED" && (
              <>
                <button
                  type="button"
                  onClick={handleApproveCancellation}
                  disabled={isRespondingCancel}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-sm disabled:opacity-50"
                >
                  ✓ 취소 요청 동의 (Approve)
                </button>
                <button
                  type="button"
                  onClick={handleRejectCancellation}
                  disabled={isRespondingCancel}
                  className="px-3 py-1.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 font-bold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  ✕ 취소 거절 (Reject)
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                const url = buildPoChangeInquiryUrl({
                  po_id: po.id,
                  po_no: po.po_number,
                  order_date: po.order_date,
                  company_name: po.supplier?.name || po.company?.name || "",
                  po_status: po.po_status,
                  revision_no: po.revision_no || 1,
                });
                router.push(url);
              }}
              disabled={isConfirming}
              className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>📝</span>
              <span>PO 변경 요청</span>
            </button>

            {po.po_status === "SENT" && po.supplier_confirmation_status === "PENDING" && (
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                disabled={isConfirming}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-sm"
              >
                ✓ 발주 확인 (Confirm PO)
              </button>
            )}
          </div>
        }
      />

      {/* Overview Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 text-center">
          <span className="text-[10px] text-zinc-400 block uppercase font-bold">발주 수량</span>
          <span className="text-sm font-bold font-mono text-zinc-900 dark:text-white">{totalTargetQty.toLocaleString()}</span>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 text-center">
          <span className="text-[10px] text-zinc-400 block uppercase font-bold">확정 수량</span>
          <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {po.lines.reduce((s, l) => s + (l.confirmed_qty ?? l.qty), 0).toLocaleString()}
          </span>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 text-center">
          <span className="text-[10px] text-zinc-400 block uppercase font-bold">출고 준비 수량</span>
          <span className="text-sm font-bold font-mono text-indigo-600 dark:text-indigo-400">{totalReadyCommitted.toLocaleString()}</span>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 text-center">
          <span className="text-[10px] text-zinc-400 block uppercase font-bold">출고/선적 수량</span>
          <span className="text-sm font-bold font-mono text-zinc-900 dark:text-white font-bold">{stats.shipped.toLocaleString()}</span>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 text-center">
          <span className="text-[10px] text-zinc-400 block uppercase font-bold">창고 입고 수량</span>
          <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">{stats.received.toLocaleString()}</span>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 text-center">
          <span className="text-[10px] text-zinc-400 block uppercase font-bold">미입고/잔여</span>
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
              품목별 발주 수량, 공급사 확정 수량, 출고 준비, 출고(선적), 입고 완료 현황입니다.
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
                <th className="px-4 py-3.5">제품명 / Letusto SKU</th>
                <th className="px-4 py-3.5 text-right">발주 수량 (PO)</th>
                <th className="px-4 py-3.5 text-right">공급사 확정 (Confirmed)</th>
                <th className="px-4 py-3.5 text-right">출고 준비 (Ready)</th>
                <th className="px-4 py-3.5 text-right">출고/선적 (Shipped)</th>
                <th className="px-4 py-3.5 text-right">창고 입고 (Received)</th>
                <th className="px-4 py-3.5 text-right">단가</th>
                <th className="px-4 py-3.5 text-right">합계</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800/80">
              {po.lines.map((l) => {
                const q = lineQuantities[l.id] || { readyQty: 0, shippedQty: 0, receivedQty: 0 };
                const readyVal = (l as any).ready_qty !== undefined ? Number((l as any).ready_qty) : q.readyQty;
                const shippedVal = (l as any).shipped_qty !== undefined ? Number((l as any).shipped_qty) : q.shippedQty;
                const receivedVal = (l as any).received_qty !== undefined ? Number((l as any).received_qty) : q.receivedQty;
                const targetQty = (l.confirmed_qty !== null && l.confirmed_qty !== undefined) ? Number(l.confirmed_qty) : Number(l.qty);
                return (
                  <tr key={l.id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-850/10">
                    <td className="px-4 py-3">
                      <span className="font-bold text-zinc-900 dark:text-white block">{l.product.name}</span>
                      <span className="font-mono text-[10px] text-zinc-450 mt-0.5 block">{l.product.letusto_sku}</span>
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
                      {readyVal.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-zinc-900 dark:text-white font-bold">
                      {shippedVal.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400 font-bold">
                      {receivedVal.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-600 dark:text-zinc-400">
                      {po.currency} {l.unit_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-black text-zinc-950 dark:text-white">
                      {po.currency} {(targetQty * l.unit_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-zinc-200 dark:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-900/60 font-bold">
              <tr>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">합계 (Total)</td>
                <td className="px-4 py-3 text-right font-mono text-zinc-900 dark:text-white">
                  {po.lines.reduce((s, l) => s + Number(l.qty || 0), 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono text-zinc-900 dark:text-white">
                  {po.lines.reduce((s, l) => s + (l.confirmed_qty ?? l.qty), 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono text-indigo-600 dark:text-indigo-400">
                  {po.lines.reduce((s, l) => s + Number((l as any).ready_qty !== undefined ? (l as any).ready_qty : lineQuantities[l.id]?.readyQty || 0), 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono text-zinc-900 dark:text-white">
                  {Math.max(stats.shipped, po.lines.reduce((s, l) => s + Number((l as any).shipped_qty !== undefined ? (l as any).shipped_qty : lineQuantities[l.id]?.shippedQty || 0), 0)).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                  {stats.received.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono text-zinc-400">-</td>
                <td className="px-4 py-3 text-right font-mono font-black text-zinc-950 dark:text-white">
                  {po.currency} {po.lines.reduce((s, l) => s + ((l.confirmed_qty ?? l.qty) * l.unit_cost), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-200 dark:border-zinc-850">
        <nav className="flex space-x-6 text-xs font-bold overflow-x-auto">
          {[
            { id: "overview", label: "주문 개요 (Overview)" },
            { id: "shipments", label: "출고 & 선적 관리 (Shipments)" },
            { id: "receiving", label: "창고 입고 현황 (Receiving)" },
            { id: "documents", label: "서류 및 송장 (Documents)" },
            { id: "communication", label: "이력 및 협업 (Collaboration)" },
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
          <div className="space-y-6 text-xs">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
              <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-150 pb-2 dark:border-zinc-850">
                주문 상세 조건
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <span className="text-[10px] text-zinc-400 block mb-0.5">발주 번호</span>
                  <span className="font-mono font-bold text-sm text-zinc-900 dark:text-white">{po.po_number}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block mb-0.5">주문 일자</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">{po.order_date}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block mb-0.5">정산 화폐</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 font-mono">{po.currency}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block mb-0.5">대금 지급 조건 (Payment Terms)</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">{po.payment_terms || "-"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block mb-0.5">인코텀즈 (Incoterms)</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">{po.incoterms || "-"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block mb-0.5">선적항 (Port of Loading)</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">{po.port_of_loading || "-"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block mb-0.5">출고지 창고 (Ship From)</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                    {po.ship_from_warehouse ? `${po.ship_from_warehouse.name} (${po.ship_from_warehouse.city || ""}, ${po.ship_from_warehouse.country || ""})` : "-"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block mb-0.5">목적지 창고 (Destination)</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                    {po.warehouse ? `${po.warehouse.name} (${po.warehouse.city || ""}, ${po.warehouse.state || ""})` : "-"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block mb-0.5">생산완료예정일 (Ready Date)</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">{po.expected_ready_date || "-"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block mb-0.5">ETD (예상 출항일)</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">{po.expected_ship_date || "-"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block mb-0.5">ETA (예상 도착일)</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 font-mono">{po.eta || "-"}</span>
                </div>
              </div>

              {/* Supplier Note (Internal Note is NEVER displayed here) */}
              {po.supplier_facing_note && (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-950 space-y-1">
                  <h4 className="font-bold text-zinc-500 uppercase text-[10px] tracking-wide">
                    전달 사항 (Buyer Note to Supplier)
                  </h4>
                  <p className="text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">
                    {po.supplier_facing_note}
                  </p>
                </div>
              )}
            </div>

            {/* Linked Inquiries / Cases */}
            {po.linked_cases && po.linked_cases.length > 0 && (
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
                <h4 className="font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide flex items-center justify-between">
                  <span>🔗 연계된 문의 / 변경 요청 케이스 ({po.linked_cases.length}건)</span>
                  <Link href="/portal/support" className="text-xs text-indigo-600 font-normal hover:underline">
                    고객센터 바로가기 →
                  </Link>
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
                          접수일시: {cs.created_at ? cs.created_at.split("T")[0] : "-"}
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
                <h4 className="font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                  📜 발주 개정 이력 (Revision History)
                </h4>
                <div className="divide-y divide-zinc-150 dark:divide-zinc-800 text-xs">
                  {po.revisions.map((rev: any, idx: number) => (
                    <div key={idx} className="py-3 space-y-1">
                      <div className="flex justify-between items-center font-bold">
                        <span className="text-purple-600 dark:text-purple-400">Rev {rev.revision_no} 스냅샷</span>
                        <span className="text-zinc-400 text-[10px]">{rev.revised_at ? rev.revised_at.split("T")[0] : "-"}</span>
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
        )}

        {/* Tab 3: Shipment */}
        {activeTab === "shipments" && (
          <div className="space-y-6 text-xs">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-zinc-800 dark:text-white">출고 및 선적 관리</h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  총 발주 확정 수량: <strong>{totalTargetQty.toLocaleString()}</strong> PCS | 등록된 출고 준비 수량: <strong className="text-indigo-600">{totalReadyCommitted.toLocaleString()}</strong> PCS {remainingTargetQty > 0 ? `| 잔여 수량: ${remainingTargetQty.toLocaleString()} PCS` : ''}
                </p>
              </div>
              {po.po_status === "SENT" && po.supplier_confirmation_status === "CONFIRMED" && !showGoodsReadyForm && (
                <div>
                  {totalReadyCommitted === 0 ? (
                    <button
                      onClick={() => initGoodsReadinessForm()}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
                    >
                      + 출고 준비 등록 (Create Goods Readiness)
                    </button>
                  ) : remainingTargetQty > 0 ? (
                    <button
                      onClick={() => initGoodsReadinessForm()}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
                    >
                      + 추가 출고 준비 등록 (Create Additional Goods Ready)
                    </button>
                  ) : (
                    <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold dark:bg-emerald-950/20 dark:text-emerald-400">
                      ✓ 전량 출고 준비 완료 ({totalReadyCommitted.toLocaleString()} PCS)
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Goods Readiness form */}
            {showGoodsReadyForm && (
              <form onSubmit={handleSubmitGoodsReady} className="rounded-xl border border-zinc-300 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/50 space-y-5">
                <div className="flex justify-between items-center border-b border-zinc-200 pb-3 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-zinc-900 dark:text-white text-xs">
                      {editingReadinessId ? "✏️ 출고 준비 정보 수정 (Edit Goods Readiness)" : "📥 출고 준비 정보 등록 (Create Goods Readiness)"}
                    </h4>
                    {editingReadinessId && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded text-[10px] font-bold dark:bg-amber-950/40 dark:text-amber-300">
                        기존 레코드 수정 모드 (기존 수량 대체)
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGoodsReadyForm(false)}
                    className="text-zinc-400 hover:text-zinc-650 cursor-pointer text-xs font-bold"
                  >
                    닫기
                  </button>
                </div>

                {/* Section 1: 출고지 정보 (Shipping Origin) */}
                <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-2 dark:border-zinc-850">
                    <h5 className="font-bold text-zinc-800 dark:text-zinc-200 text-xs flex items-center gap-1.5">
                      <span>🏢</span>
                      <span>1. 출고지 및 현장 담당자 정보 (Shipping Origin)</span>
                    </h5>
                    <span className="text-[10px] text-zinc-400 font-medium">
                      * 공급사 출고지/공장 위치 및 현장 출고 담당자 연락처
                    </span>
                  </div>

                  {shippingOrigins && shippingOrigins.length > 0 && (
                    <div>
                      <label className="block font-bold text-zinc-500 mb-1 text-[11px]">등록된 출고지 선택 (Shipping Origin Select)</label>
                      <select
                        value={selectedOriginId}
                        onChange={(e) => {
                          const origId = e.target.value;
                          setSelectedOriginId(origId);
                          const matched = shippingOrigins.find((o) => o.id === origId);
                          if (matched) {
                            setPickupLocation(matched.name || "");
                            setWarehouseFactoryAddress([matched.address_line1, matched.address_line2, matched.city, matched.country].filter(Boolean).join(", "));
                            setContactName(matched.contact_name || "");
                            setContactEmail(matched.email || "");
                            setContactPhone(matched.phone || "");
                          }
                        }}
                        className="w-full rounded-lg border-zinc-300 text-xs py-1.5 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                      >
                        <option value="">-- 직접 입력 (Direct Input) --</option>
                        {shippingOrigins.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name} {o.is_default ? "(기본 출고지)" : ""} - {o.city || ""}, {o.country || ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-zinc-500 mb-1 text-[11px]">출고 완료 예정일 (Ready Date) *</label>
                      <input
                        type="date"
                        required
                        value={goodsReadyDate}
                        onChange={(e) => setGoodsReadyDate(e.target.value)}
                        onClick={(e) => (e.target as any).showPicker?.()}
                        className="w-full rounded-lg border-zinc-300 text-xs py-1.5 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-zinc-500 mb-1 text-[11px]">인수지/출고지 명칭 (Pickup Location)</label>
                      <input
                        type="text"
                        placeholder="예: 인천 제1물류센터 / 안성공장"
                        value={pickupLocation}
                        onChange={(e) => setPickupLocation(e.target.value)}
                        className="w-full rounded-lg border-zinc-300 text-xs py-1.5 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-zinc-500 mb-1 text-[11px]">공장/창고 상세 주소</label>
                      <input
                        type="text"
                        placeholder="상세 도로명 주소 및 건물명"
                        value={warehouseFactoryAddress}
                        onChange={(e) => setWarehouseFactoryAddress(e.target.value)}
                        className="w-full rounded-lg border-zinc-300 text-xs py-1.5 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-zinc-500 mb-1 text-[11px]">출고 담당자 성명 (Contact Name)</label>
                      <input
                        type="text"
                        placeholder="홍길동"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        className="w-full rounded-lg border-zinc-300 text-xs py-1.5 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-zinc-500 mb-1 text-[11px]">출고 담당자 이메일 (Contact Email)</label>
                      <input
                        type="email"
                        placeholder="contact@company.com"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        className="w-full rounded-lg border-zinc-300 text-xs py-1.5 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-zinc-500 mb-1 text-[11px]">출고 담당자 전화번호 (Contact Phone)</label>
                      <input
                        type="text"
                        placeholder="010-0000-0000"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        className="w-full rounded-lg border-zinc-300 text-xs py-1.5 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: 인도 / 포워딩 정보 (Handover & Forwarder Info) */}
                <div className="rounded-lg border border-indigo-150 bg-indigo-50/20 p-4 dark:border-indigo-950 dark:bg-indigo-950/20 space-y-3">
                  <div className="flex items-center justify-between border-b border-indigo-100/60 pb-2 dark:border-indigo-900/40">
                    <h5 className="font-bold text-indigo-900 dark:text-indigo-300 text-xs flex items-center gap-1.5">
                      <span>🚢</span>
                      <span>2. 인도 조건 및 포워더 정보 (Handover & Forwarder Info)</span>
                    </h5>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                      * FOB 항구, 인도 방식 및 지정 포워딩사 정보 (관리자/공급사 공통 조회 및 수정)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-zinc-500 mb-1 text-[11px]">FOB 항구명 또는 선적 기준 위치</label>
                      <input
                        type="text"
                        placeholder="예: Busan Port, Incheon Port"
                        value={fobPort}
                        onChange={(e) => setFobPort(e.target.value)}
                        className="w-full rounded-lg border-zinc-300 text-xs py-1.5 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-zinc-500 mb-1 text-[11px]">인도 장소 / 방식 (Handover Location)</label>
                      <input
                        type="text"
                        placeholder="예: 공장 상차 / CY 전달 / 지정 물류센터 입고"
                        value={handoverLocation}
                        onChange={(e) => setHandoverLocation(e.target.value)}
                        className="w-full rounded-lg border-zinc-300 text-xs py-1.5 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-zinc-500 mb-1 text-[11px]">포워딩 회사명 (Forwarder Company)</label>
                      <input
                        type="text"
                        placeholder="예: 현대글로비스 / CJ대한통운 / Letusto Logistics"
                        value={forwarderName}
                        onChange={(e) => setForwarderName(e.target.value)}
                        className="w-full rounded-lg border-zinc-300 text-xs py-1.5 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-zinc-500 mb-1 text-[11px]">포워딩 담당자 성명 (Forwarder Contact)</label>
                      <input
                        type="text"
                        placeholder="예: 김물류 팀장"
                        value={forwarderContact}
                        onChange={(e) => setForwarderContact(e.target.value)}
                        className="w-full rounded-lg border-zinc-300 text-xs py-1.5 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-zinc-500 mb-1 text-[11px]">포워딩 담당자 연락처 / 이메일</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="email"
                          placeholder="forwarder@email.com"
                          value={forwarderEmail}
                          onChange={(e) => setForwarderEmail(e.target.value)}
                          className="w-full rounded-lg border-zinc-300 text-xs py-1.5 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                        />
                        <input
                          type="text"
                          placeholder="010-0000-0000"
                          value={forwarderPhone}
                          onChange={(e) => setForwarderPhone(e.target.value)}
                          className="w-full rounded-lg border-zinc-300 text-xs py-1.5 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-zinc-500 mb-1 text-[11px]">인도/포워딩 특이사항 및 메모 (Special Instructions / Notes)</label>
                    <textarea
                      rows={2}
                      placeholder="통관 관련 특이사항, 픽업 시 주의사항, 팔레트 작업 요청 등"
                      value={specialInstructions}
                      onChange={(e) => setSpecialInstructions(e.target.value)}
                      className="w-full rounded-lg border-zinc-300 text-xs p-2 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Section 3: 준비 수량 및 패키징 자동 계산 정보 */}
                <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-2 dark:border-zinc-850">
                    <h5 className="font-bold text-zinc-800 dark:text-zinc-200 text-xs flex items-center gap-1.5">
                      <span>📦</span>
                      <span>3. 준비 수량 및 패키징 자동 계산 정보 (Quantities & Packaging)</span>
                    </h5>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                      * 출고 수량 변경 시 박스 수/중량/부피가 상품 마스터 기준으로 자동 산출되며 직접 수정(Override) 가능합니다.
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px] border-collapse bg-white dark:bg-zinc-950 rounded-lg">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50/50 text-zinc-550 font-bold dark:border-zinc-850 dark:bg-zinc-900/50 dark:text-white">
                          <th className="p-2.5">제품명 / Letusto SKU</th>
                          <th className="p-2.5 text-right w-24">출고 준비 수량</th>
                          <th className="p-2.5 text-right w-24">카톤(Box) 수</th>
                          <th className="p-2.5 text-right w-24">중량(kg)</th>
                          <th className="p-2.5 text-right w-24">CBM 부피</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800">
                        {readyLines.map((line, idx) => (
                          <tr key={line.purchase_order_line_id} className="align-middle">
                            <td className="p-2.5">
                              <span className="font-bold block text-zinc-850 dark:text-zinc-300">{line.product_name}</span>
                              <span className="font-mono text-[10px] text-zinc-450">{line.letusto_sku}</span>
                            </td>
                            <td className="p-2.5 text-right">
                              <input
                                type="number"
                                min={0}
                                value={line.ready_qty}
                                onChange={(e) => {
                                  const newQty = Number(e.target.value) || 0;
                                  const pack = calcPackaging(newQty, line.product);
                                  const updated = [...readyLines];
                                  updated[idx] = {
                                    ...updated[idx],
                                    ready_qty: newQty,
                                    cartons: pack.cartons,
                                    gross_weight: pack.gross_weight,
                                    cbm: pack.cbm,
                                  };
                                  setReadyLines(updated);
                                }}
                                className="w-20 text-right rounded-md border-zinc-300 text-xs px-2 py-1 dark:border-zinc-850 dark:bg-zinc-900 dark:text-white focus:ring-indigo-500 font-bold text-indigo-600"
                              />
                            </td>
                            <td className="p-2.5 text-right">
                              <input
                                type="number"
                                min={0}
                                value={line.cartons}
                                onChange={(e) => {
                                  const updated = [...readyLines];
                                  updated[idx].cartons = Number(e.target.value);
                                  setReadyLines(updated);
                                }}
                                className="w-20 text-right rounded-md border-zinc-300 text-xs px-2 py-1 dark:border-zinc-850 dark:bg-zinc-900 dark:text-white font-mono"
                              />
                            </td>
                            <td className="p-2.5 text-right">
                              <input
                                type="number"
                                step="0.01"
                                value={line.gross_weight}
                                onChange={(e) => {
                                  const updated = [...readyLines];
                                  updated[idx].gross_weight = Number(e.target.value);
                                  setReadyLines(updated);
                                }}
                                className="w-20 text-right rounded-md border-zinc-300 text-xs px-2 py-1 dark:border-zinc-850 dark:bg-zinc-900 dark:text-white font-mono"
                              />
                            </td>
                            <td className="p-2.5 text-right">
                              <input
                                type="number"
                                step="0.001"
                                value={line.cbm}
                                onChange={(e) => {
                                  const updated = [...readyLines];
                                  updated[idx].cbm = Number(e.target.value);
                                  setReadyLines(updated);
                                }}
                                className="w-20 text-right rounded-md border-zinc-300 text-xs px-2 py-1 dark:border-zinc-850 dark:bg-zinc-900 dark:text-white font-mono"
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
                    onClick={() => setShowGoodsReadyForm(false)}
                    className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-lg cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer shadow-sm"
                  >
                    {editingReadinessId ? "출고 준비 정보 수정 저장" : "출고 준비 등록 완료"}
                  </button>
                </div>
              </form>
            )}

            {/* List goods readiness with clear Section separation */}
            {goodsReadiness.map((gr) => {
              const isLocked = isLinkedToActiveShipment(gr);
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
                    <span className="font-bold text-zinc-800 dark:text-zinc-250">출고 준비 내역 (Ready Date: {gr.goods_ready_date})</span>
                    {isLocked ? (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-bold dark:bg-blue-950/20 dark:text-blue-400">
                        🔒 선적 연결됨 (Shipment Linked)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold dark:bg-emerald-950/20 dark:text-emerald-400">
                        수정 가능 (Editable)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!isLocked && !showGoodsReadyForm && (
                      <button
                        onClick={() => initGoodsReadinessForm(gr)}
                        className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 font-bold rounded text-xs cursor-pointer transition-colors flex items-center gap-1"
                      >
                        ✏️ 수정 (Edit)
                      </button>
                    )}
                    {po.shipping_responsibility === "SUPPLIER_ARRANGED" && gr.handover_status === "READY_SUBMITTED" && (
                      <button
                        onClick={() => setShowSupplierShipmentForm(gr.id)}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded cursor-pointer transition-colors"
                      >
                        📦 직접 선적 정보 입력 (Submit Shipment)
                      </button>
                    )}
                    <span className="px-2 py-0.5 bg-zinc-100 text-zinc-650 border border-zinc-200 rounded text-[10px] font-bold dark:bg-zinc-800 dark:text-zinc-300">
                      {gr.handover_status}
                    </span>
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

                {/* Direct shipment input form */}
                {showSupplierShipmentForm === gr.id && (
                  <form
                    onSubmit={(e) => handleSupplierShipmentSubmit(e, gr.id)}
                    className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-950/20 space-y-3"
                  >
                    <h5 className="font-bold text-zinc-800 dark:text-zinc-300 text-xs border-b pb-1">배송 물류 정보 입력</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-0.5">운송사 (Carrier)</label>
                        <input
                          type="text"
                          required
                          value={carrier}
                          onChange={(e) => setCarrier(e.target.value)}
                          className="w-full rounded-md border-zinc-300 text-xs py-1 px-2 dark:border-zinc-800 dark:bg-zinc-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-0.5">트래킹 번호</label>
                        <input
                          type="text"
                          required
                          value={trackingNumber}
                          onChange={(e) => setTrackingNumber(e.target.value)}
                          className="w-full rounded-md border-zinc-300 text-xs py-1 px-2 dark:border-zinc-800 dark:bg-zinc-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-0.5">B/L (Bill of Lading)</label>
                        <input
                          type="text"
                          value={billOfLading}
                          onChange={(e) => setBillOfLading(e.target.value)}
                          className="w-full rounded-md border-zinc-300 text-xs py-1 px-2 dark:border-zinc-800 dark:bg-zinc-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-0.5">실제 출항일 (ETD)</label>
                        <input
                          type="date"
                          required
                          value={etd}
                          onChange={(e) => setEtd(e.target.value)}
                          onClick={(e) => (e.target as any).showPicker?.()}
                          className="w-full rounded-md border-zinc-300 text-xs py-1 px-2 dark:border-zinc-800 dark:bg-zinc-900 cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-0.5">도착 예정일 (ETA)</label>
                        <input
                          type="date"
                          required
                          value={eta}
                          onChange={(e) => setEta(e.target.value)}
                          onClick={(e) => (e.target as any).showPicker?.()}
                          className="w-full rounded-md border-zinc-300 text-xs py-1 px-2 dark:border-zinc-800 dark:bg-zinc-900 cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t">
                      <button
                        type="button"
                        onClick={() => setShowSupplierShipmentForm(null)}
                        className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold rounded"
                      >
                        취소
                      </button>
                      <button
                        type="submit"
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded"
                      >
                        등록 완료
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}

            {/* List active shipments */}
            <div className="space-y-4 pt-4 border-t">
              <h4 className="font-bold text-zinc-800 dark:text-white">활성화 선적 현황</h4>
              {shipments.length === 0 ? (
                <div className="py-6 text-center text-zinc-400">선적 진행 기록이 없습니다.</div>
              ) : (
                shipments.map((shp) => (
                  <div key={shp.id} className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/20 grid grid-cols-2 md:grid-cols-4 gap-4 font-sans">
                    <div>
                      <span className="text-[10px] text-zinc-400 block">선적 번호</span>
                      <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{shp.shipment_number}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 block">운송사 / 트래킹</span>
                      <span className="font-semibold text-zinc-850 dark:text-zinc-300">{shp.carrier || "-"} / {shp.tracking_number || "-"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 block">출항일 (ETD)</span>
                      <span className="font-mono text-zinc-850 dark:text-zinc-300">{shp.etd || "-"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 block">선적 상태</span>
                      <span className="px-2 py-0.5 bg-white text-zinc-650 border rounded text-[9px] font-bold dark:bg-zinc-800 dark:text-zinc-300">{shp.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Receiving (Read Only) */}
        {activeTab === "receiving" && (
          <div className="space-y-6 text-xs">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-white">Letusto 창고 실물 입고 검수 내역</h3>
            <div className="grid grid-cols-1 gap-6">
              {receivings.length === 0 ? (
                <div className="py-12 border-2 border-dashed border-zinc-200 dark:border-zinc-850 rounded-xl text-center text-zinc-500">
                  창고 입고 검수 기록이 존재하지 않습니다.
                </div>
              ) : (
                receivings.map((r) => (
                  <div key={r.id} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
                    <div className="flex justify-between items-center border-b border-zinc-150 pb-3 dark:border-zinc-850">
                      <div>
                        <span className="font-mono text-sm font-bold text-zinc-900 dark:text-white">{r.receiving_number}</span>
                        <span className="ml-2.5 text-[10px] text-zinc-400">입고검수 완료일: {r.received_date}</span>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold">
                        {r.status}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px] border-collapse bg-zinc-50 dark:bg-zinc-950 rounded-lg">
                        <thead>
                          <tr className="border-b border-zinc-200 bg-zinc-100/50 text-zinc-550 font-bold dark:border-zinc-850 dark:bg-zinc-900/50 dark:text-white">
                            <th className="p-2">Letusto SKU</th>
                            <th className="p-2">제품명</th>
                            <th className="p-2 text-right">정상 입고</th>
                            <th className="p-2 text-right">불량/파손</th>
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
            <div className="flex justify-between items-center border-b border-zinc-150 pb-3 dark:border-zinc-850">
              <div>
                <h3 className="text-sm font-bold text-zinc-800 dark:text-white">발주 및 선적 공유 서류 (Shared Documents)</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  출고 준비, 선적, 통관 및 원산지 증명 관련 모든 서류가 실시간 동기화되어 통합 관리됩니다.
                </p>
              </div>
              <button
                onClick={() => setShowDocUploadModal(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors cursor-pointer text-xs flex items-center gap-1.5 shadow-sm"
              >
                + 문서 업로드 (Upload Document)
              </button>
            </div>

            {/* Document Upload Modal */}
            {showDocUploadModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
                  <div className="flex justify-between items-center border-b border-zinc-150 pb-3 dark:border-zinc-850">
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-white">📄 증빙 서류 업로드</h4>
                    <button
                      onClick={() => setShowDocUploadModal(false)}
                      className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleDocumentUploadSubmit} className="space-y-3.5 text-xs">
                    <div>
                      <label className="block font-bold text-zinc-600 dark:text-zinc-300 mb-1">문서 유형 (Document Type) *</label>
                      <select
                        value={uploadDocType}
                        onChange={(e) => setUploadDocType(e.target.value as PoDocumentType)}
                        className="w-full rounded-lg border-zinc-300 text-xs py-2 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white font-medium"
                      >
                        <option value="PACKING_LIST">패킹 리스트 (Packing List)</option>
                        <option value="COMMERCIAL_INVOICE">상업 송장 (Commercial Invoice)</option>
                        <option value="CERTIFICATE_OF_ORIGIN">원산지 증명서 (Certificate of Origin)</option>
                        <option value="PRODUCT_SPECIFICATION">성분표 / 사양서 (Product Spec)</option>
                        <option value="CUSTOMS_DOCUMENT">통관 서류 (Customs Document)</option>
                        <option value="OTHER">기타 선적 서류 (Other Shipping Document)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-zinc-600 dark:text-zinc-300 mb-1">관련 항목 연결 (Related To)</label>
                      <select
                        value={uploadRelatedType}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          setUploadRelatedType(val);
                          if (val === 'GOODS_READY' && goodsReadiness.length > 0) setUploadRelatedId(goodsReadiness[0].id);
                          else if (val === 'SHIPMENT' && shipments.length > 0) setUploadRelatedId(shipments[0].id);
                          else setUploadRelatedId('');
                        }}
                        className="w-full rounded-lg border-zinc-300 text-xs py-2 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                      >
                        <option value="PO">발주서 전체 ({po.po_number})</option>
                        {goodsReadiness.length > 0 && (
                          <option value="GOODS_READY">출고 준비 (Ready Date: {goodsReadiness[0].goods_ready_date})</option>
                        )}
                        {shipments.map((s) => (
                          <option key={s.id} value="SHIPMENT">선적물 ({s.shipment_number})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-zinc-600 dark:text-zinc-300 mb-1">파일 선택 (File) *</label>
                      <input
                        type="file"
                        required
                        onChange={(e) => setSelectedDocFile(e.target.files?.[0] || null)}
                        className="w-full text-xs text-zinc-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-950/40 dark:file:text-indigo-400"
                      />
                      <span className="text-[10px] text-zinc-400 mt-1 block">PDF, Excel, Word, 이미지, ZIP 지원 (최대 20MB)</span>
                    </div>

                    <div>
                      <label className="block font-bold text-zinc-600 dark:text-zinc-300 mb-1">메모 (Note - 선택 사항)</label>
                      <input
                        type="text"
                        placeholder="서류 관련 참고 메모"
                        value={uploadNote}
                        onChange={(e) => setUploadNote(e.target.value)}
                        className="w-full rounded-lg border-zinc-300 text-xs py-1.5 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-zinc-150 dark:border-zinc-850">
                      <button
                        type="button"
                        onClick={() => setShowDocUploadModal(false)}
                        className="px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold dark:bg-zinc-800 dark:text-zinc-300 text-xs"
                      >
                        취소
                      </button>
                      <button
                        type="submit"
                        disabled={isUploadingDoc}
                        className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs disabled:opacity-50"
                      >
                        {isUploadingDoc ? "업로드 중..." : "업로드 완료"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Documents List Table */}
            {documents.length === 0 ? (
              <div className="py-8 text-center text-zinc-400">
                등록된 서류가 없습니다. [+ 문서 업로드] 버튼을 눌러 서류를 등록할 수 있습니다.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50/50 text-zinc-550 font-bold dark:border-zinc-850 dark:bg-zinc-900/50 dark:text-white">
                      <th className="py-2.5 px-3">문서 유형</th>
                      <th className="py-2.5 px-3">파일명</th>
                      <th className="py-2.5 px-3">관련 대상</th>
                      <th className="py-2.5 px-3">등록자</th>
                      <th className="py-2.5 px-3">등록일시</th>
                      <th className="py-2.5 px-3 text-right">다운로드 / 보기</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/20">
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${PO_DOCUMENT_TYPE_BADGES[doc.documentType] || PO_DOCUMENT_TYPE_BADGES.OTHER}`}>
                            {PO_DOCUMENT_TYPE_LABELS[doc.documentType] || doc.documentType}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-medium text-zinc-800 dark:text-zinc-200">
                          {doc.fileName}
                          {doc.note && <span className="text-[10px] text-zinc-400 block font-normal">{doc.note}</span>}
                        </td>
                        <td className="py-3 px-3 text-zinc-500 font-mono text-[11px]">
                          {doc.relatedLabel}
                        </td>
                        <td className="py-3 px-3 text-zinc-500">
                          {doc.uploaderName || '공급사'}
                        </td>
                        <td className="py-3 px-3 text-zinc-400 font-mono text-[11px]">
                          {doc.uploadedAt ? (doc.uploadedAt.includes('T') ? doc.uploadedAt.split('T')[0] : doc.uploadedAt) : '-'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {doc.signedUrl ? (
                            <a
                              href={doc.signedUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900 text-xs font-bold rounded transition-colors"
                            >
                              📂 열기 / 다운로드
                            </a>
                          ) : (
                            <span className="text-zinc-400 italic text-[10px]">다운로드 불가</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 6: Communication */}
        {activeTab === "communication" && (
          <div className="space-y-6">
            {/* System / Operational Activity Logs Timeline */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
              <h3 className="text-sm font-bold text-zinc-800 dark:text-white flex items-center justify-between">
                <span>⏱️ 발주 진행 히스토리 (Activity Log)</span>
                <span className="text-xs text-zinc-400 font-normal">Eastern Time (ET) 기준</span>
              </h3>
              {(!po.activity_logs || po.activity_logs.length === 0) ? (
                <div className="py-6 text-center text-zinc-400 text-xs">
                  기록된 진행 히스토리가 없습니다.
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
                          {log.timestamp ? (log.timestamp.includes("T") ? log.timestamp.split("T")[0] : log.timestamp) : "-"} ({log.actor || "System"})
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

            {/* Linked Support & Change Request Cases */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-zinc-800 dark:text-white flex items-center gap-1.5">
                  <span>📋</span>
                  <span>연계된 PO 변경 요청 케이스 (Linked Change Request Cases)</span>
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    const url = buildPoChangeInquiryUrl({
                      po_id: po.id,
                      po_no: po.po_number,
                      order_date: po.order_date,
                      company_name: po.supplier?.name || po.company?.name || "",
                      po_status: po.po_status,
                      revision_no: po.revision_no || 1,
                    });
                    router.push(url);
                  }}
                  className="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>+</span>
                  <span>새 PO 변경 요청 작성</span>
                </button>
              </div>

              {allLinkedCases.length === 0 ? (
                <div className="py-6 text-center text-zinc-400 text-xs">
                  연계된 PO 변경 요청 및 문의 케이스가 없습니다.
                </div>
              ) : (
                <div className="divide-y divide-zinc-150 dark:divide-zinc-800 text-xs">
                  {allLinkedCases.map((c: any) => {
                    const norm = getNormalizedStatus(c.status);
                    return (
                      <div key={c.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {c.case_number && (
                              <span className="font-mono font-bold text-zinc-500">#{c.case_number}</span>
                            )}
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${OFFICIAL_STATUS_COLOR[norm]}`}>
                              {OFFICIAL_STATUS_LABEL[norm].ko}
                            </span>
                            <span className="font-bold text-zinc-900 dark:text-white">{c.title}</span>
                          </div>
                          <div className="text-[11px] text-zinc-400">
                            접수일: {c.created_at ? (c.created_at.includes("T") ? c.created_at.split("T")[0] : c.created_at) : "-"}
                          </div>
                        </div>
                        <Link
                          href={`/portal/support?case=${c.case_number || c.id}`}
                          className="font-bold text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 underline shrink-0"
                        >
                          문의 상세 대화 보기 →
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Legacy Collaboration Logs (Read Only) */}
            {changeRequests.length > 0 && (
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-white">
                    📜 기존 수량 조율 제안 기록 (Legacy Proposals - Read Only)
                  </h3>
                  <span className="text-[10px] text-zinc-400 font-medium">이전 시스템 보존 데이터</span>
                </div>
                <div className="divide-y divide-zinc-150 dark:divide-zinc-800 text-xs">
                  {changeRequests.map((req) => {
                    const matchedLine = po.lines.find((l) => l.id === req.purchaseOrderLineId);
                    return (
                      <div key={req.id} className="py-4 space-y-3 last:pb-0">
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="font-bold text-zinc-900 dark:text-white">
                              {matchedLine?.product.name || "전체 변경"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-zinc-400">
                              제안일자: {new Date(req.createdAt).toLocaleString()}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              req.status === "PENDING" ? "bg-amber-50 text-amber-700" :
                              req.status === "APPROVED" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                            }`}>
                              {req.status}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-center bg-zinc-50 dark:bg-zinc-950 p-3 rounded-lg border text-xs">
                          <div>
                            <div className="text-[10px] text-zinc-400">발주 수량</div>
                            <div className="font-bold font-mono text-zinc-700 dark:text-zinc-300">{req.originalQty}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-zinc-400">제안 수량</div>
                            <div className="font-bold font-mono text-zinc-900 dark:text-white">{req.proposedQty}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-zinc-400">수량 차이</div>
                            <div className="font-bold font-mono text-indigo-650 dark:text-indigo-400">
                              {req.proposedQty - req.originalQty}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="font-bold text-zinc-400 uppercase tracking-wide text-[10px]">파트너 변경 제안 사유</div>
                          <div className="p-2 bg-zinc-50/50 border-l-2 border-zinc-300">{req.reason}</div>
                        </div>

                        {req.status === "PENDING" && (
                          <div className="flex justify-end pt-2">
                            <button
                              onClick={() => handleWithdraw(req.id)}
                              disabled={isWithdrawing === req.id}
                              className="px-3 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold rounded text-xs transition-colors cursor-pointer"
                            >
                              {isWithdrawing === req.id ? "철회중..." : "제안 철회 (Withdraw)"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
