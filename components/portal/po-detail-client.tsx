"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  confirmPortalPurchaseOrder,
  submitPortalPoChangeRequest,
  withdrawPortalPoChangeRequest,
  submitPortalGoodsReady,
  submitPortalSupplierArrangedShipment,
} from "@/lib/portal/actions";
import {
  getOverallStatus,
  OVERALL_STATUS_LABELS,
  OVERALL_STATUS_COLORS,
} from "@/lib/purchase-order/status-helper";

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
    destination_warehouse_id?: string;
    lines: PoLine[];
  };
  changeRequests: ChangeRequest[];
  shipments?: any[];
  receivings?: any[];
  goodsReadiness?: any[];
  warehouses?: any[];
}

export default function PoDetailClient({
  po,
  changeRequests,
  shipments = [],
  receivings = [],
  goodsReadiness = [],
  warehouses = [],
}: PoDetailClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const [isConfirming, setIsConfirming] = useState(false);
  const [isChangeFormOpen, setIsChangeFormOpen] = useState(false);
  const [isSubmittingChange, setIsSubmittingChange] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState<string | null>(null);

  // Proposed change quantities and reasons state
  const [proposedQties, setProposedQties] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    po.lines.forEach((l) => {
      initial[l.id] = l.confirmed_qty ?? l.qty;
    });
    return initial;
  });

  const [reasons, setReasons] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    po.lines.forEach((l) => {
      initial[l.id] = "";
    });
    return initial;
  });

  const [generalError, setGeneralError] = useState<string | null>(null);
  const [generalSuccess, setGeneralSuccess] = useState<string | null>(null);

  // Goods Readiness Form State
  const [showGoodsReadyForm, setShowGoodsReadyForm] = useState(false);
  const [goodsReadyDate, setGoodsReadyDate] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [handoverLocation, setHandoverLocation] = useState("");
  const [fobPort, setFobPort] = useState("");
  const [warehouseFactoryAddress, setWarehouseFactoryAddress] = useState("");
  const [contactPerson, setContactPerson] = useState("");
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
  }>>([]);

  // Direct Shipment submission for Supplier Arranged shipping
  const [showSupplierShipmentForm, setShowSupplierShipmentForm] = useState<string | null>(null);
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [billOfLading, setBillOfLading] = useState("");
  const [etd, setEtd] = useState("");
  const [eta, setEta] = useState("");

  const overallStatus = useMemo(() => {
    return getOverallStatus(po, shipments, receivings);
  }, [po, shipments, receivings]);

  // Aggregate quantities
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

    const variance = totalAccepted - po.lines.reduce((sum, l) => sum + l.qty, 0);

    return {
      shipped: totalShipped,
      received: totalReceived,
      accepted: totalAccepted,
      damaged: totalDamaged,
      variance,
    };
  }, [po.lines, shipments, receivings]);

  // Initialize goods readiness form lines
  const initGoodsReadinessForm = () => {
    const items = po.lines.map((l) => ({
      purchase_order_line_id: l.id,
      product_id: l.product.id,
      product_name: l.product.name,
      letusto_sku: l.product.letusto_sku,
      qty: l.qty,
      ready_qty: l.qty,
      cartons: 1,
      gross_weight: 0,
      cbm: 0,
    }));
    setReadyLines(items);
    setShowGoodsReadyForm(true);
  };

  // Confirm PO
  const handleConfirm = async () => {
    if (!window.confirm("발주 항목 수량을 그대로 수락하고 확인하시겠습니까?")) return;
    setIsConfirming(true);
    setGeneralError(null);
    setGeneralSuccess(null);
    try {
      await confirmPortalPurchaseOrder(po.id);
      setGeneralSuccess("발주 확인 처리가 성공적으로 완료되었습니다.");
      router.refresh();
    } catch (err: any) {
      setGeneralError(err.message || "확인 처리 중 오류가 발생했습니다.");
    } finally {
      setIsConfirming(false);
    }
  };

  // Propose change request
  const handleSubmitChange = async (e: React.FormEvent) => {
    e.preventDefault();
    const requests = po.lines
      .map((l) => ({
        lineId: l.id,
        proposedQty: proposedQties[l.id],
        reason: reasons[l.id].trim(),
      }))
      .filter((req) => {
        const origLine = po.lines.find((l) => l.id === req.lineId);
        return origLine && req.proposedQty !== origLine.qty;
      });

    if (requests.length === 0) {
      alert("변경된 수량이 존재하지 않습니다.");
      return;
    }

    const missingReason = requests.find((r) => !r.reason);
    if (missingReason) {
      alert("수량이 변경된 항목에는 반드시 변경 사유를 입력하셔야 합니다.");
      return;
    }

    if (!window.confirm(`총 ${requests.length}건의 수량 변경 제안을 제출하시겠습니까?`)) return;

    setIsSubmittingChange(true);
    setGeneralError(null);
    setGeneralSuccess(null);
    try {
      await submitPortalPoChangeRequest(po.id, requests);
      setIsChangeFormOpen(false);
      setGeneralSuccess("수량 변경 제안서가 정상 등록되었습니다.");
      router.refresh();
    } catch (err: any) {
      setGeneralError(err.message || "변경 요청 등록 실패");
    } finally {
      setIsSubmittingChange(false);
    }
  };

  // Withdraw change request
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

    try {
      await submitPortalGoodsReady({
        purchaseOrderId: po.id,
        goodsReadyDate,
        pickupLocation,
        handoverLocation,
        fobPort,
        warehouseFactoryAddress,
        contactPerson,
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

      setGeneralSuccess("출고 준비(Goods Readiness) 정보 제출이 완료되었습니다.");
      setShowGoodsReadyForm(false);
      router.refresh();
    } catch (err: any) {
      setGeneralError(err.message || "제출 실패");
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
      setGeneralError(err.message || "선적 등록 실패");
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

      {/* Top Banner mapping Overall Status */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">주문 진행 상태</span>
          <span className={`inline-flex items-center rounded px-3 py-1 text-xs font-bold border ${OVERALL_STATUS_COLORS[overallStatus || "Draft"]}`}>
            {OVERALL_STATUS_LABELS[overallStatus || "Draft"] || overallStatus}
          </span>
        </div>

        {/* Primary Action Button based on Lifecycle */}
        {po.po_status === "SENT" && po.supplier_confirmation_status === "PENDING" && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsChangeFormOpen(true)}
              disabled={isConfirming}
              className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
            >
              수량 변경 제안 (Propose Changes)
            </button>
            <button
              onClick={handleConfirm}
              disabled={isConfirming}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
            >
              발주서 수락 (Confirm PO)
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-200 dark:border-zinc-850">
        <nav className="flex space-x-6 text-xs font-bold overflow-x-auto">
          {[
            { id: "overview", label: "주문 개요 (Overview)" },
            { id: "products", label: "주문 품목 (Products)" },
            { id: "shipment", label: "출고 & 선적 관리 (Shipments)" },
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
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4 text-xs">
            <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-150 pb-2 dark:border-zinc-850">
              주문 요약 상세
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
                <span className="text-[10px] text-zinc-400 block mb-0.5">지급 조건</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{po.payment_terms || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block mb-0.5">인코텀즈</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{po.incoterms || "-"}</span>
              </div>
            </div>

            {/* Change requests list */}
            {isChangeFormOpen && (
              <form onSubmit={handleSubmitChange} className="rounded-xl border border-zinc-300 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/50 space-y-4">
                <div className="flex justify-between items-center border-b border-zinc-200 pb-2 dark:border-zinc-800">
                  <h4 className="font-bold text-zinc-900 dark:text-white text-xs">📝 발주서 품목 수량 변경 제안</h4>
                  <button
                    type="button"
                    onClick={() => setIsChangeFormOpen(false)}
                    className="text-zinc-400 hover:text-zinc-650 cursor-pointer"
                  >
                    닫기
                  </button>
                </div>
                <div className="space-y-4">
                  {po.lines.map((l) => (
                    <div key={l.id} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                      <div>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">{l.product.name}</span>
                        <span className="font-mono text-[10px] text-zinc-450 block">{l.product.letusto_sku}</span>
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className="text-[10px] text-zinc-400">발주량: {l.qty}개 ➔ 제안량:</span>
                        <input
                          type="number"
                          min={0}
                          value={proposedQties[l.id]}
                          onChange={(e) => setProposedQties({ ...proposedQties, [l.id]: Number(e.target.value) })}
                          className="w-20 rounded-md border-zinc-300 px-2 py-1 text-right dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="수량 조율 사유를 입력하십시오."
                          value={reasons[l.id]}
                          onChange={(e) => setReasons({ ...reasons, [l.id]: e.target.value })}
                          className="w-full rounded-md border-zinc-300 px-2.5 py-1 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsChangeFormOpen(false)}
                    className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-lg cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingChange}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    변경 제안 제출
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Tab 2: Products */}
        {activeTab === "products" && (
          <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm dark:border-zinc-800 dark:bg-zinc-900 text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/50 text-zinc-550 font-bold dark:border-zinc-850 dark:bg-zinc-900/50 dark:text-white">
                  <th className="px-4 py-3.5">제품명 / Letusto SKU</th>
                  <th className="px-4 py-3.5 text-right">발주 수량</th>
                  <th className="px-4 py-3.5 text-right">최종 확정 수량</th>
                  <th className="px-4 py-3.5 text-right">단가</th>
                  <th className="px-4 py-3.5 text-right">합계</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800/80">
                {po.lines.map((l) => (
                  <tr key={l.id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-850/10">
                    <td className="px-4 py-3">
                      <span className="font-bold text-zinc-900 dark:text-white block">{l.product.name}</span>
                      <span className="font-mono text-[10px] text-zinc-450 mt-0.5 block">{l.product.letusto_sku}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{l.qty.toLocaleString()}개</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {l.confirmed_qty !== null ? `${l.confirmed_qty.toLocaleString()}개` : <span className="text-zinc-400 italic">미확정</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {po.currency} {l.unit_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold">
                      {po.currency} {(l.qty * l.unit_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Shipment */}
        {activeTab === "shipment" && (
          <div className="space-y-6 text-xs">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-zinc-800 dark:text-white">출고 및 선적 관리</h3>
              {po.po_status === "SENT" && po.supplier_confirmation_status === "CONFIRMED" && !showGoodsReadyForm && (
                <button
                  onClick={initGoodsReadinessForm}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors cursor-pointer"
                >
                  + 출고 준비 등록 (Create Goods Readiness)
                </button>
              )}
            </div>

            {/* Goods Readiness form */}
            {showGoodsReadyForm && (
              <form onSubmit={handleSubmitGoodsReady} className="rounded-xl border border-zinc-300 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/50 space-y-4">
                <div className="flex justify-between items-center border-b border-zinc-200 pb-2 dark:border-zinc-800">
                  <h4 className="font-bold text-zinc-900 dark:text-white text-xs">📥 출고 예정 정보 (Goods Ready Details)</h4>
                  <button
                    type="button"
                    onClick={() => setShowGoodsReadyForm(false)}
                    className="text-zinc-400 hover:text-zinc-650 cursor-pointer"
                  >
                    닫기
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-bold text-zinc-500 mb-1">출고 완료 예정일 (Ready Date)</label>
                    <input
                      type="date"
                      required
                      value={goodsReadyDate}
                      onChange={(e) => setGoodsReadyDate(e.target.value)}
                      className="w-full rounded-lg border-zinc-300 text-xs py-1.5 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-500 mb-1">인수지 위치 (Pickup Location)</label>
                    <input
                      type="text"
                      value={pickupLocation}
                      onChange={(e) => setPickupLocation(e.target.value)}
                      className="w-full rounded-lg border-zinc-300 text-xs py-1.5 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-500 mb-1">인도 장소 (Handover Location)</label>
                    <input
                      type="text"
                      value={handoverLocation}
                      onChange={(e) => setHandoverLocation(e.target.value)}
                      className="w-full rounded-lg border-zinc-300 text-xs py-1.5 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-500 mb-1">FOB 항구명</label>
                    <input
                      type="text"
                      value={fobPort}
                      onChange={(e) => setFobPort(e.target.value)}
                      className="w-full rounded-lg border-zinc-300 text-xs py-1.5 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-500 mb-1">공장/창고 주소</label>
                    <input
                      type="text"
                      value={warehouseFactoryAddress}
                      onChange={(e) => setWarehouseFactoryAddress(e.target.value)}
                      className="w-full rounded-lg border-zinc-300 text-xs py-1.5 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-500 mb-1">담당자 연락처 (Contact)</label>
                    <input
                      type="text"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      className="w-full rounded-lg border-zinc-300 text-xs py-1.5 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    />
                  </div>
                </div>

                {/* Line quantities input */}
                <div className="space-y-2 pt-2">
                  <h5 className="font-bold text-zinc-800 dark:text-zinc-300 text-xs">준비 수량 및 박스 정보</h5>
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
                                  const updated = [...readyLines];
                                  updated[idx].ready_qty = Number(e.target.value);
                                  setReadyLines(updated);
                                }}
                                className="w-20 text-right rounded-md border-zinc-300 text-xs px-2 py-1 dark:border-zinc-850 dark:bg-zinc-900 dark:text-white focus:ring-indigo-500"
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
                                className="w-20 text-right rounded-md border-zinc-300 text-xs px-2 py-1 dark:border-zinc-850 dark:bg-zinc-900 dark:text-white"
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
                                className="w-20 text-right rounded-md border-zinc-300 text-xs px-2 py-1 dark:border-zinc-850 dark:bg-zinc-900 dark:text-white"
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
                                className="w-20 text-right rounded-md border-zinc-300 text-xs px-2 py-1 dark:border-zinc-850 dark:bg-zinc-900 dark:text-white"
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
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    준비 완료 제출
                  </button>
                </div>
              </form>
            )}

            {/* List goods readiness with supplier arranged direct shipping forms */}
            {goodsReadiness.map((gr) => (
              <div key={gr.id} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
                <div className="flex justify-between items-center border-b border-zinc-150 pb-3 dark:border-zinc-850">
                  <div>
                    <span className="font-bold text-zinc-800 dark:text-zinc-250">출고 준비 이력 (Ready Date: {gr.goods_ready_date})</span>
                  </div>
                  <div className="flex items-center gap-2">
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
                          className="w-full rounded-md border-zinc-300 text-xs py-1 px-2 dark:border-zinc-800 dark:bg-zinc-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-0.5">도착 예정일 (ETA)</label>
                        <input
                          type="date"
                          required
                          value={eta}
                          onChange={(e) => setEta(e.target.value)}
                          className="w-full rounded-md border-zinc-300 text-xs py-1 px-2 dark:border-zinc-800 dark:bg-zinc-900"
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
            ))}

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
            <h3 className="text-sm font-bold text-zinc-800 dark:text-white">주문 및 선적 서류 목록</h3>
            <div className="divide-y divide-zinc-150 dark:divide-zinc-850">
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

        {/* Tab 6: Communication */}
        {activeTab === "communication" && (
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-white">수량 변경 및 협업 이력 (Collaboration Logs)</h3>
            <div className="divide-y divide-zinc-150 dark:divide-zinc-800 text-xs">
              {changeRequests.length === 0 ? (
                <div className="py-6 text-center text-zinc-500">조율 제안 내역이 없습니다.</div>
              ) : (
                changeRequests.map((req) => {
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
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
