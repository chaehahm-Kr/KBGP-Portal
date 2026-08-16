"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { transitionPoStatus, deleteDraftPo, reviewSupplierPoChangeRequest } from "@/lib/purchase-order/actions";

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
      address: string | null;
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
}

const PO_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-150 text-zinc-700 border-zinc-250 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  APPROVED: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50",
  SENT: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/50",
  CANCELLED: "bg-rose-50 text-rose-700 border-rose-250 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50",
};

const PO_STATUS_LABELS: Record<string, string> = {
  DRAFT: "초안 (Draft)",
  APPROVED: "승인됨 (Approved)",
  SENT: "발송완료 (Sent)",
  CANCELLED: "취소됨 (Cancelled)",
};

const FULFILLMENT_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-zinc-50 text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-500",
  IN_PRODUCTION: "bg-amber-50 text-amber-700 border-amber-250 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50",
  READY_TO_SHIP: "bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
  SHIPPED: "bg-teal-50 text-teal-700 border-teal-250 dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-900/50",
  RECEIVED: "bg-sky-50 text-sky-700 border-sky-250 dark:bg-sky-950/20 dark:text-sky-400 dark:border-sky-900/50",
};

const FULFILLMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "대기 (Pending)",
  IN_PRODUCTION: "생산중 (In Production)",
  READY_TO_SHIP: "선적대기 (Ready to Ship)",
  SHIPPED: "선적완료 (Shipped)",
  RECEIVED: "입고완료 (Received)",
};

export function PurchaseOrderDetail({ po, isReadOnly = false, invoices = [], changeRequests = [] }: PurchaseOrderDetailProps) {
  const router = useRouter();
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isPrinting, setIsPrinting] = useState(false);

  // Trigger print mode layout
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

  // Handle transitions
  const handleTransition = async (targetStatus: string) => {
    const label = PO_STATUS_LABELS[targetStatus] || FULFILLMENT_STATUS_LABELS[targetStatus] || targetStatus;
    const message = `발주서 상태를 "${label}" 상태로 변경하시겠습니까?`;
    if (!confirm(message)) return;

    setErrorMessage("");
    setIsActionLoading(true);

    try {
      await transitionPoStatus(po.id, targetStatus);
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "상태 변경 중 오류가 발생했습니다.");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Delete Draft PO
  const handleDelete = async () => {
    if (!confirm("이 초안 발주서를 영구적으로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
      return;
    }

    setErrorMessage("");
    setIsActionLoading(true);

    try {
      await deleteDraftPo(po.id);
      router.push("/admin/purchasing");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "발주서 삭제 중 오류가 발생했습니다.");
      setIsActionLoading(false);
    }
  };

  const [reviewLoading, setReviewLoading] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const handleReviewRequest = async (requestId: string, action: "APPROVE" | "REJECT") => {
    const note = reviewNotes[requestId]?.trim() || "";
    if (action === "APPROVE" && !confirm("이 수량 변경 제안을 승인하고 발주서의 Confirmed Qty를 업데이트하시겠습니까?")) return;
    if (action === "REJECT" && !confirm("이 변경 제안을 거절하시겠습니까?")) return;

    setReviewLoading(requestId);
    setErrorMessage("");
    try {
      await reviewSupplierPoChangeRequest(po.id, requestId, action, note);
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "심사 처리 실패");
    } finally {
      setReviewLoading(null);
    }
  };

  // Print Mode Rendering
  if (isPrinting) {
    return (
      <div className="bg-white text-zinc-955 p-8 min-h-screen text-xs space-y-6 max-w-4xl mx-auto leading-relaxed">
        {/* Print controls (Hidden when printing) */}
        <div className="print:hidden flex justify-between items-center bg-zinc-50 p-4 border border-zinc-200 rounded-xl mb-6">
          <span className="font-bold text-zinc-700">인쇄 미리보기 모드 활성화됨</span>
          <button
            onClick={() => setIsPrinting(false)}
            className="px-3 py-1.5 bg-zinc-950 text-white rounded text-[10px] font-bold cursor-pointer"
          >
            ← 닫기 (Close Preview)
          </button>
        </div>

        {/* PO Header Layout */}
        <div className="flex justify-between items-start border-b-2 border-zinc-950 pb-6">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wide text-zinc-955">Purchase Order</h1>
            <p className="font-mono text-sm mt-1 font-bold">PO No: {po.po_number}</p>
            <p className="text-zinc-650 mt-0.5">Date: {po.order_date}</p>
          </div>
          <div className="text-right text-[10px] text-zinc-700">
            <h2 className="font-bold text-xs text-zinc-955 uppercase tracking-wider">Letusto Inc.</h2>
            <p>23B Roland Avenue</p>
            <p>Mount Laurel, NJ 08054</p>
            <p>United States</p>
            <p>Email: operations@letusto.com</p>
          </div>
        </div>

        {/* Supplier / Ship From / Ship To - Three Column Separation */}
        <div className="grid grid-cols-3 gap-6 text-[11px]">
          {/* Supplier */}
          <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-150 space-y-1">
            <h3 className="font-black text-zinc-950 uppercase border-b border-zinc-300 pb-1 mb-1">Supplier (공급사)</h3>
            <p className="font-bold text-zinc-950">{po.supplier.name}</p>
            {po.supplier.address && <p>{po.supplier.address}</p>}
            {po.supplier.business_registration_number && (
              <p className="font-mono text-[10px]">Biz Reg: {po.supplier.business_registration_number}</p>
            )}
            {po.po_receiving_email && <p>PO Email: {po.po_receiving_email}</p>}
          </div>

          {/* Ship From */}
          <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-150 space-y-1">
            <h3 className="font-black text-zinc-955 uppercase border-b border-zinc-300 pb-1 mb-1">Ship From (출고지)</h3>
            {po.ship_from_warehouse ? (
              <>
                <p className="font-bold text-zinc-955">{po.ship_from_warehouse.name} [{po.ship_from_warehouse.code}]</p>
                <p>{po.ship_from_warehouse.address1}</p>
                <p>{po.ship_from_warehouse.city}, {po.ship_from_warehouse.state} {po.ship_from_warehouse.zip_code}</p>
                <p>{po.ship_from_warehouse.country}</p>
              </>
            ) : (
              <p className="text-zinc-400 italic">출고지 정보 미지정</p>
            )}
          </div>

          {/* Destination */}
          <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-150 space-y-1">
            <h3 className="font-black text-zinc-955 uppercase border-b border-zinc-300 pb-1 mb-1">Ship To (입고지)</h3>
            <p className="font-bold text-zinc-955">{po.warehouse.name} [{po.warehouse.code}]</p>
            <p>{po.warehouse.address1}</p>
            <p>{po.warehouse.city}, {po.warehouse.state} {po.warehouse.zip_code}</p>
            <p>{po.warehouse.country}</p>
          </div>
        </div>

        {/* Commercial Conditions */}
        <div className="p-4 border border-zinc-200 rounded-lg text-[10px]">
          <h3 className="font-black text-zinc-955 uppercase mb-2 border-b border-zinc-150 pb-0.5">Commercial Conditions (거래 조건)</h3>
          <div className="grid grid-cols-4 gap-4 font-semibold text-zinc-800">
            <div>
              <span className="text-[9px] text-zinc-400 block uppercase">Incoterms</span>
              <span className="text-zinc-955">{po.incoterms || "-"}</span>
            </div>
            <div>
              <span className="text-[9px] text-zinc-400 block uppercase">Payment Terms</span>
              <span className="text-zinc-955">{po.payment_terms || "-"}</span>
            </div>
            <div>
              <span className="text-[9px] text-zinc-400 block uppercase">Port of Loading</span>
              <span className="text-zinc-955">{po.port_of_loading || "-"}</span>
            </div>
            <div>
              <span className="text-[9px] text-zinc-400 block uppercase">Expected Ready Date</span>
              <span className="text-zinc-955 font-mono">{po.expected_ready_date || "-"}</span>
            </div>
          </div>
        </div>

        {/* Lines Table */}
        <div className="space-y-1.5">
          <h3 className="font-black text-zinc-955 uppercase border-b border-zinc-900 pb-1">Order Line Items (주문 품목)</h3>
          <table className="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr className="border-b border-zinc-950 font-bold text-zinc-900 bg-zinc-50">
                <th className="py-2 px-2">Brand</th>
                <th className="py-2 px-2">Letusto SKU</th>
                <th className="py-2 px-2">Mfg SKU</th>
                <th className="py-2 px-2">Product Description</th>
                <th className="py-2 px-2 text-right">Quantity</th>
                <th className="py-2 px-2 text-right">Unit Price</th>
                <th className="py-2 px-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {po.lines.map((l) => (
                <tr key={l.id} className="align-top">
                  <td className="py-2 px-2 font-medium text-zinc-700">{l.brand_name}</td>
                  <td className="py-2 px-2 font-mono font-bold">{l.letusto_sku || "-"}</td>
                  <td className="py-2 px-2 font-mono text-zinc-650">{l.manufacture_sku || "-"}</td>
                  <td className="py-2 px-2">
                    <p className="font-bold text-zinc-955">{l.product_name}</p>
                    {l.line_note && <p className="text-[9px] text-zinc-500 italic mt-0.5">Note: {l.line_note}</p>}
                  </td>
                  <td className="py-2 px-2 text-right font-mono font-bold">{l.qty.toLocaleString()}</td>
                  <td className="py-2 px-2 text-right font-mono">{po.currency} {l.unit_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="py-2 px-2 text-right font-mono font-bold">{po.currency} {l.line_total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Summary */}
        <div className="flex justify-end pt-4">
          <div className="w-64 border-t-2 border-zinc-950 p-2 space-y-1.5 font-bold text-right text-xs">
            <div className="flex justify-between text-zinc-500 text-[10px]">
              <span>Total Quantity:</span>
              <span className="font-mono text-zinc-955">{po.total_qty.toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t border-zinc-200 pt-1 text-sm text-zinc-955">
              <span>Total Amount ({po.currency}):</span>
              <span className="font-mono">{po.currency} {po.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* Terms / Signatures */}
        <div className="grid grid-cols-2 gap-8 pt-12 border-t border-zinc-300">
          <div className="space-y-1 text-[9px] text-zinc-500">
            <h4 className="font-bold text-zinc-800 uppercase mb-1">Notes & Terms</h4>
            <p>{po.supplier_facing_note || "No special terms or packaging instructions specified."}</p>
          </div>
          <div className="flex flex-col justify-end items-end h-24">
            <div className="w-48 border-b border-zinc-950 text-center pb-1 text-[10px] font-bold text-zinc-900">
              Authorized Letusto Officer
            </div>
            <span className="text-[8px] text-zinc-400 mt-1">Order Date: {po.order_date}</span>
          </div>
        </div>
      </div>
    );
  }

  // Screen display mode layout
  return (
    <div className="space-y-6">
      {/* Breadcrumb / Error message */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/purchasing"
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
        >
          ← 발주 목록으로 돌아가기
        </Link>

        {/* Print PDF Trigger */}
        <button
          onClick={handlePrint}
          className="px-3.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-lg transition-colors"
        >
          🖨️ PDF / 인쇄 화면 출력 (Print PO)
        </button>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 font-bold dark:bg-rose-955/10 dark:border-rose-900/50 dark:text-rose-400 text-xs">
          ⚠️ {errorMessage}
        </div>
      )}

      {/* Top action status triggers */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">진행 상태</span>
          <span className={`inline-flex items-center rounded px-3 py-1 text-xs font-bold border ${PO_STATUS_COLORS[po.po_status] || PO_STATUS_COLORS.DRAFT}`}>
            {PO_STATUS_LABELS[po.po_status] || po.po_status}
          </span>
          {po.po_status === "SENT" && (
            <span className={`inline-flex items-center rounded px-3 py-1 text-xs font-bold border ${FULFILLMENT_STATUS_COLORS[po.fulfillment_status] || FULFILLMENT_STATUS_COLORS.PENDING}`}>
              {FULFILLMENT_STATUS_LABELS[po.fulfillment_status] || po.fulfillment_status}
            </span>
          )}
        </div>

        {/* Operational buttons */}
        {!isReadOnly && (
          <div className="flex items-center gap-2 flex-wrap">
            {po.po_status === "DRAFT" && (
              <>
                <Link
                  href={`/admin/purchasing/${po.id}/edit`}
                  className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-xl cursor-pointer transition-colors"
                >
                  발주 초안 수정 (Edit)
                </Link>
                <button
                  onClick={() => handleTransition("APPROVED")}
                  disabled={isActionLoading}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors disabled:opacity-50"
                >
                  발주서 내부 승인 (Approve)
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isActionLoading}
                  className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-950 text-white dark:bg-zinc-800 dark:hover:bg-zinc-750 text-xs font-bold rounded-xl cursor-pointer transition-colors disabled:opacity-50"
                >
                  초안 삭제 (Delete)
                </button>
              </>
            )}

            {po.po_status === "APPROVED" && (
              <button
                onClick={() => handleTransition("SENT")}
                disabled={isActionLoading}
                className="px-3.5 py-2 bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors disabled:opacity-50"
              >
                Supplier에게 전송 처리 (Mark Sent)
              </button>
            )}

            {po.po_status === "SENT" && po.fulfillment_status === "PENDING" && (
              <button
                onClick={() => handleTransition("IN_PRODUCTION")}
                disabled={isActionLoading}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors disabled:opacity-50"
              >
                생산 개시 처리 (In Production)
              </button>
            )}

            {po.po_status === "SENT" && po.fulfillment_status === "IN_PRODUCTION" && (
              <button
                onClick={() => handleTransition("READY_TO_SHIP")}
                disabled={isActionLoading}
                className="px-3.5 py-2 bg-emerald-650 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors disabled:opacity-50"
              >
                생산 완료 / 선적대기 (Ready to Ship)
              </button>
            )}

            {po.po_status !== "CANCELLED" && (
              <button
                onClick={() => handleTransition("CANCELLED")}
                disabled={isActionLoading}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-250 text-xs font-bold rounded-xl cursor-pointer transition-colors disabled:opacity-50"
              >
                발주 취소 (Cancel PO)
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main PO detail layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
        
        {/* Left column: Header summary & commercial terms */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* PO General Information */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
              발주 요약 정보
            </h3>
            
            <div className="space-y-3.5">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">발주 고유 번호 (PO Number)</span>
                <span className="font-mono text-sm font-bold text-zinc-955 dark:text-white">{po.po_number}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">공급사 (Supplier)</span>
                <span className="font-bold text-zinc-900 dark:text-white block">{po.supplier.name}</span>
                {po.supplier.address && <span className="text-[10px] text-zinc-450 mt-1 block">{po.supplier.address}</span>}
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">출고지 창고 (Ship From)</span>
                {po.ship_from_warehouse ? (
                  <>
                    <span className="font-semibold text-zinc-900 dark:text-white block">
                      [{po.ship_from_warehouse.code}] {po.ship_from_warehouse.name}
                    </span>
                    <span className="text-[10px] text-zinc-450 block mt-0.5">
                      {po.ship_from_warehouse.address1}, {po.ship_from_warehouse.city}, {po.ship_from_warehouse.state}
                    </span>
                  </>
                ) : (
                  <span className="text-zinc-400 italic">미지정 (Not Set)</span>
                )}
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">입고 목적 물류창고 (Destination / Ship To)</span>
                <span className="font-semibold text-zinc-900 dark:text-white block">
                  [{po.warehouse.code}] {po.warehouse.name}
                </span>
                <span className="text-[10px] text-zinc-450 block mt-0.5">{po.warehouse.address1}, {po.warehouse.city}, {po.warehouse.state}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">발주 요청 일자 (Order Date)</span>
                <span className="font-medium text-zinc-850 dark:text-zinc-200">{po.order_date}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">공급사 확인 상태 (Confirmation)</span>
                {po.supplier_confirmation_status === "CONFIRMED" && (
                  <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-bold text-green-700 ring-1 ring-inset ring-green-600/20">확인 완료 (Confirmed)</span>
                )}
                {po.supplier_confirmation_status === "CHANGE_REQUESTED" && (
                  <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700 ring-1 ring-inset ring-indigo-700/10">변경 요청됨 (Change Requested)</span>
                )}
                {po.supplier_confirmation_status === "PENDING" && (
                  <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800 ring-1 ring-inset ring-amber-650/10">대기 중 (Pending)</span>
                )}
                {!po.supplier_confirmation_status && (
                  <span className="text-zinc-400 italic">미결정 (Pending)</span>
                )}
              </div>
            </div>
          </div>

          {/* PO Commercial Terms */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
              상업 및 물류 인도 조건
            </h3>

            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">결제 통화</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-300">{po.currency}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">거래 인도 조건</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-300">{po.incoterms || "-"}</span>
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">결제 조건 (Payment Terms)</span>
                <span className="font-semibold text-zinc-850 dark:text-zinc-200">{po.payment_terms || "-"}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">선적항</span>
                  <span className="font-semibold text-zinc-850 dark:text-zinc-200">{po.port_of_loading || "-"}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">PO 수신 이메일</span>
                  <span className="font-semibold text-zinc-850 dark:text-zinc-200 truncate block" title={po.po_receiving_email || ""}>
                    {po.po_receiving_email || "-"}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">생산완료예정일</span>
                  <span className="font-mono text-zinc-850 dark:text-zinc-200">{po.expected_ready_date || "-"}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">선적예정일</span>
                  <span className="font-mono text-zinc-850 dark:text-zinc-200">{po.expected_ship_date || "-"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Audit trail */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
              Audit Trail (이력 기록)
            </h3>
            
            <div className="space-y-3 font-medium text-zinc-600 dark:text-zinc-400 text-[11px]">
              <div className="flex justify-between">
                <span>작성자 (Created By):</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-300">{po.creator?.full_name || "System"} ({new Date(po.created_at).toLocaleDateString("ko-KR")})</span>
              </div>
              {po.approved_at && (
                <div className="flex justify-between">
                  <span>승인자 (Approved By):</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-300">{po.approver?.full_name || "-"} ({new Date(po.approved_at).toLocaleDateString("ko-KR")})</span>
                </div>
              )}
              {po.sent_at && (
                <div className="flex justify-between">
                  <span>발송일 (Sent At):</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-300">{new Date(po.sent_at).toLocaleDateString("ko-KR")}</span>
                </div>
              )}
              {po.cancelled_at && (
                <div className="flex justify-between">
                  <span>취소자 (Cancelled By):</span>
                  <span className="font-bold text-rose-500">{po.canceller?.full_name || "-"} ({new Date(po.cancelled_at).toLocaleDateString("ko-KR")})</span>
                </div>
              )}
            </div>
          </div>

          {/* Associated Supplier Invoices */}
          {invoices && invoices.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
              <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
                연계 인보이스 내역 (Supplier Invoices)
              </h3>
              <div className="space-y-3 font-medium text-xs">
                {invoices.map((inv) => (
                  <div key={inv.id} className="flex justify-between items-center border-b border-zinc-50 pb-2 last:border-0 last:pb-0 dark:border-zinc-850">
                    <div>
                      <Link
                        href={`/admin/purchasing/invoices/${inv.id}`}
                        className="font-mono font-bold text-indigo-650 hover:underline block"
                      >
                        {inv.internal_ap_number}
                      </Link>
                      <span className="text-[10px] text-zinc-400">인보이스: {inv.supplier_invoice_number}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-zinc-900 dark:text-white">
                        {inv.currency} {Number(inv.invoice_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-zinc-450 block font-bold">{inv.invoice_status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Right column: Line items list & Totals */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Order Lines table */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-white">주문 품목 상세 (Order Line Items)</h3>
            
            <div className="overflow-x-auto rounded-lg border border-zinc-150 dark:border-zinc-800/80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50/50 text-zinc-500 font-bold border-b border-zinc-150 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-zinc-350">
                    <th className="px-4 py-2.5">Brand</th>
                    <th className="px-4 py-2.5">SKU</th>
                    <th className="px-4 py-2.5">제품명</th>
                    <th className="px-4 py-2.5 text-right w-16">발주량</th>
                    <th className="px-4 py-2.5 text-right w-16">확정량</th>
                    <th className="px-4 py-2.5 text-right w-16">선적량</th>
                    <th className="px-4 py-2.5 text-right w-16">입고량</th>
                    <th className="px-4 py-2.5 text-right w-20">구매 단가</th>
                    <th className="px-4 py-2.5 text-right w-24">합계 금액</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {po.lines.map((l) => (
                    <tr key={l.id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-850/5">
                      <td className="px-4 py-3 font-medium text-zinc-650 dark:text-zinc-400">{l.brand_name}</td>
                      <td className="px-4 py-3 font-mono font-bold text-zinc-900 dark:text-white">
                        <div>
                          <span className="block text-[10px]">{l.letusto_sku || "-"}</span>
                          <span className="block text-[9px] text-zinc-400 font-normal">Mfg: {l.manufacture_sku || "-"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-bold text-zinc-900 dark:text-white max-w-xs truncate" title={l.product_name}>
                        <div>
                          <span>{l.product_name}</span>
                          {l.line_note && (
                            <span className="text-[10px] text-zinc-450 block font-normal italic mt-0.5">Note: {l.line_note}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold">{l.qty.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold">
                        {l.confirmed_qty !== null ? (
                          <span className={l.confirmed_qty !== l.qty ? "text-indigo-650 dark:text-indigo-400" : "text-zinc-900 dark:text-white"}>
                            {l.confirmed_qty.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-zinc-400 dark:text-zinc-500 font-normal">대기</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-indigo-650 dark:text-indigo-400">{l.shipped_qty?.toLocaleString() || "0"}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-650 dark:text-emerald-400">{l.received_qty?.toLocaleString() || "0"}</td>
                      <td className="px-4 py-3 text-right font-mono">{po.currency} {l.unit_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-zinc-900 dark:text-white">
                        {po.currency} {l.line_total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total aggregation banner */}
            <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-950 p-4 border border-zinc-150 dark:border-zinc-850 rounded-xl">
              <span className="font-bold text-zinc-500">주문 및 물류 집계 요약</span>
              <div className="flex gap-6">
                <div className="text-right">
                  <span className="text-[10px] text-zinc-400 uppercase block mb-0.5">총 발주 수량</span>
                  <span className="text-sm font-bold font-mono text-zinc-900 dark:text-white">{po.total_qty.toLocaleString()}</span>
                </div>
                <div className="text-right border-l border-zinc-200 pl-6 dark:border-zinc-800">
                  <span className="text-[10px] text-zinc-400 uppercase block mb-0.5">총 확정 수량</span>
                  <span className="text-sm font-bold font-mono text-zinc-900 dark:text-white">
                    {po.lines.every(l => l.confirmed_qty !== null)
                      ? po.lines.reduce((sum, l) => sum + (l.confirmed_qty || 0), 0).toLocaleString()
                      : "-"
                    }
                  </span>
                </div>
                <div className="text-right border-l border-zinc-200 pl-6 dark:border-zinc-800">
                  <span className="text-[10px] text-zinc-400 uppercase block mb-0.5">총 선적 수량</span>
                  <span className="text-sm font-bold font-mono text-indigo-650 dark:text-indigo-400">{(po as any).total_shipped?.toLocaleString() || "0"}</span>
                </div>
                <div className="text-right border-l border-zinc-200 pl-6 dark:border-zinc-800">
                  <span className="text-[10px] text-zinc-400 uppercase block mb-0.5">총 입고 수량</span>
                  <span className="text-sm font-bold font-mono text-emerald-650 dark:text-emerald-400">{(po as any).total_received?.toLocaleString() || "0"}</span>
                </div>
                <div className="text-right border-l border-zinc-200 pl-6 dark:border-zinc-800">
                  <span className="text-[10px] text-zinc-400 uppercase block mb-0.5">총 주문 대금</span>
                  <span className="text-sm font-bold font-mono text-zinc-900 dark:text-white">
                    {po.currency} {po.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes summary panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-2">
              <h4 className="font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wide">내부 관리 메모</h4>
              <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium">
                {po.internal_note || <span className="text-zinc-350 italic font-normal">등록된 관리 메모가 없습니다.</span>}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-2">
              <h4 className="font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wide">공급사 전달 메모</h4>
              <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium">
                {po.supplier_facing_note || <span className="text-zinc-350 italic font-normal">등록된 전달 메모가 없습니다.</span>}
              </p>
            </div>
          </div>

          {/* Supplier Collaboration Change Requests Section */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-white">파트너 협업 및 수량 변경 제안 (Partner Collaboration)</h3>
            
            <div className="divide-y divide-zinc-150 dark:divide-zinc-800">
              {changeRequests.length === 0 ? (
                <div className="py-6 text-center text-zinc-500">
                  제출된 파트너 변경 제안이 없습니다.
                </div>
              ) : (
                changeRequests.map((req) => {
                  const matchedLine = po.lines.find(l => l.id === req.purchaseOrderLineId);
                  return (
                    <div key={req.id} className="py-4 space-y-3 last:pb-0">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-bold text-zinc-900 dark:text-white">
                            {matchedLine?.product_name || "Unknown Item"}
                          </span>
                          <span className="ml-2 font-mono text-[10px] text-zinc-405">
                            (Mfg SKU: {matchedLine?.manufacture_sku || "-"})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-400">
                            요청: {req.requestedByName} ({req.companyName}) | {new Date(req.createdAt).toLocaleString()}
                          </span>
                          {req.status === "PENDING" && (
                            <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-bold">Pending</span>
                          )}
                          {req.status === "APPROVED" && (
                            <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-250 rounded text-[10px] font-bold">Approved</span>
                          )}
                          {req.status === "REJECTED" && (
                            <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-250 rounded text-[10px] font-bold">Rejected</span>
                          )}
                          {req.status === "WITHDRAWN" && (
                            <span className="px-1.5 py-0.5 bg-zinc-100 text-zinc-650 border border-zinc-250 rounded text-[10px] font-bold">Withdrawn</span>
                          )}
                        </div>
                      </div>

                      {/* Detail Metrics */}
                      <div className="grid grid-cols-4 gap-4 text-center bg-zinc-50 dark:bg-zinc-950 p-3 rounded-lg border border-zinc-150 dark:border-zinc-850">
                        <div>
                          <div className="text-[10px] text-zinc-400">원래 수량 (Ordered)</div>
                          <div className="font-bold font-mono text-sm text-zinc-700 dark:text-zinc-300">{req.originalQty}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-zinc-400">제안 수량 (Proposed)</div>
                          <div className="font-bold font-mono text-sm text-zinc-900 dark:text-white">{req.proposedQty}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-zinc-400">수량 차이 (Diff)</div>
                          <div className="font-bold font-mono text-sm text-indigo-600 dark:text-indigo-400">
                            {req.proposedQty - req.originalQty}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-zinc-400">제안 유형</div>
                          <div className="font-bold text-sm text-zinc-700 dark:text-zinc-300">{req.requestType}</div>
                        </div>
                      </div>

                      {/* Partner Reason */}
                      <div className="space-y-1">
                        <div className="font-bold text-zinc-500 uppercase tracking-wide text-[10px]">파트너 변경 사유 (Reason)</div>
                        <div className="p-2.5 border-l-2 border-zinc-300 bg-zinc-50/50 text-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-300">
                          {req.reason || "(사유 기재 없음)"}
                        </div>
                      </div>

                      {/* Admin Decision Actions */}
                      {req.status === "PENDING" && !isReadOnly && (
                        <div className="space-y-2 pt-2">
                          <label className="block text-[10px] font-bold text-zinc-405 uppercase">검토 메모 / 거절 사유 (Review Note)</label>
                          <textarea
                            rows={2}
                            placeholder="변경 제안 승인/반려에 대한 메모를 입력하세요."
                            value={reviewNotes[req.id] || ""}
                            onChange={(e) => setReviewNotes({ ...reviewNotes, [req.id]: e.target.value })}
                            className="w-full rounded-md border-zinc-350 bg-white text-xs text-zinc-900 shadow-sm focus:border-zinc-500 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleReviewRequest(req.id, "REJECT")}
                              disabled={reviewLoading === req.id}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-250 text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50"
                            >
                              {reviewLoading === req.id ? "심사중..." : "반려 (Reject)"}
                            </button>
                            <button
                              onClick={() => handleReviewRequest(req.id, "APPROVE")}
                              disabled={reviewLoading === req.id}
                              className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50"
                            >
                              {reviewLoading === req.id ? "심사중..." : "승인 (Approve)"}
                            </button>
                          </div>
                        </div>
                      )}

                      {req.reviewNote && (
                        <div className="p-3 bg-amber-50/20 border border-amber-100 rounded-lg text-zinc-700 dark:bg-amber-950/10 dark:border-amber-900/30 dark:text-zinc-300 space-y-1">
                          <div className="font-bold text-amber-800 dark:text-amber-400 text-[10px]">어드민 검토 의견:</div>
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
      </div>
    </div>
  );
}
