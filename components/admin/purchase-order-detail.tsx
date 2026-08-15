"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { transitionPoStatus, deleteDraftPo } from "@/lib/purchase-order/actions";

interface LineItem {
  id: string;
  product_id: string;
  product_name: string;
  letusto_sku: string | null;
  manufacture_sku: string | null;
  qty: number;
  unit_cost: number;
  line_total: number;
  line_note: string | null;
  brand_name: string;
}

interface PurchaseOrderDetailProps {
  po: {
    id: string;
    po_number: string;
    supplier_id: string;
    order_date: string;
    status: "DRAFT" | "APPROVED" | "SENT" | "IN_PRODUCTION" | "READY_TO_SHIP" | "CANCELLED";
    currency: string;
    payment_terms: string | null;
    incoterms: string | null;
    port_of_loading: string | null;
    expected_ready_date: string | null;
    expected_ship_date: string | null;
    destination_warehouse_id: string;
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
    creator: { full_name: string } | null;
    approver: { full_name: string } | null;
    canceller: { full_name: string } | null;
    lines: LineItem[];
    total_qty: number;
    total_amount: number;
  };
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-650 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  APPROVED: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50",
  SENT: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/50",
  IN_PRODUCTION: "bg-amber-50 text-amber-700 border-amber-250 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50",
  READY_TO_SHIP: "bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
  CANCELLED: "bg-rose-50 text-rose-700 border-rose-250 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "초안 (Draft)",
  APPROVED: "승인됨 (Approved)",
  SENT: "발송완료 (Sent)",
  IN_PRODUCTION: "생산중 (In Production)",
  READY_TO_SHIP: "선적대기 (Ready to Ship)",
  CANCELLED: "취소됨 (Cancelled)",
};

export function PurchaseOrderDetail({ po }: PurchaseOrderDetailProps) {
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
      // Reset back to screen display layout shortly after print dialog closes
      const timer = setTimeout(() => {
        setIsPrinting(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isPrinting]);

  // Handle transitions
  const handleTransition = async (targetStatus: string) => {
    const message = `발주서 상태를 "${STATUS_LABELS[targetStatus]}" 상태로 변경하시겠습니까?`;
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

  // Print Mode Rendering
  if (isPrinting) {
    return (
      <div className="bg-white text-zinc-950 p-8 min-h-screen text-xs space-y-6 max-w-4xl mx-auto leading-relaxed">
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
            <h1 className="text-2xl font-black uppercase tracking-wide text-zinc-950">Purchase Order</h1>
            <p className="font-mono text-sm mt-1 font-bold">PO No: {po.po_number}</p>
            <p className="text-zinc-650 mt-0.5">Date: {po.order_date}</p>
          </div>
          <div className="text-right text-[10px] text-zinc-700">
            <h2 className="font-bold text-xs text-zinc-950 uppercase tracking-wider">Letusto Inc.</h2>
            <p>23B Roland Avenue</p>
            <p>Mount Laurel, NJ 08054</p>
            <p>United States</p>
            <p>Email: operations@letusto.com</p>
          </div>
        </div>

        {/* Commercial addresses */}
        <div className="grid grid-cols-2 gap-8 text-[11px]">
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

          {/* Destination */}
          <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-150 space-y-1">
            <h3 className="font-black text-zinc-950 uppercase border-b border-zinc-300 pb-1 mb-1">Ship To (입고 배송지)</h3>
            <p className="font-bold text-zinc-950">{po.warehouse.name} [{po.warehouse.code}]</p>
            <p>{po.warehouse.address1}</p>
            <p>{po.warehouse.city}, {po.warehouse.state} {po.warehouse.zip_code}</p>
            <p>{po.warehouse.country}</p>
          </div>
        </div>

        {/* Commercial Conditions */}
        <div className="p-4 border border-zinc-200 rounded-lg text-[10px]">
          <h3 className="font-black text-zinc-950 uppercase mb-2 border-b border-zinc-150 pb-0.5">Commercial Conditions (거래 조건)</h3>
          <div className="grid grid-cols-4 gap-4 font-semibold text-zinc-800">
            <div>
              <span className="text-[9px] text-zinc-400 block uppercase">Incoterms</span>
              <span className="text-zinc-950">{po.incoterms || "-"}</span>
            </div>
            <div>
              <span className="text-[9px] text-zinc-400 block uppercase">Payment Terms</span>
              <span className="text-zinc-950">{po.payment_terms || "-"}</span>
            </div>
            <div>
              <span className="text-[9px] text-zinc-400 block uppercase">Port of Loading</span>
              <span className="text-zinc-950">{po.port_of_loading || "-"}</span>
            </div>
            <div>
              <span className="text-[9px] text-zinc-400 block uppercase">Expected Ready Date</span>
              <span className="text-zinc-950 font-mono">{po.expected_ready_date || "-"}</span>
            </div>
          </div>
        </div>

        {/* Lines Table */}
        <div className="space-y-1.5">
          <h3 className="font-black text-zinc-950 uppercase border-b border-zinc-900 pb-1">Order Line Items (주문 품목)</h3>
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
                    <p className="font-bold text-zinc-950">{l.product_name}</p>
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
              <span className="font-mono text-zinc-950">{po.total_qty.toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t border-zinc-200 pt-1 text-sm text-zinc-950">
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
          className="px-3.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-lg cursor-pointer transition-colors"
        >
          🖨️ PDF / 인쇄 화면 출력 (Print PO)
        </button>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 font-bold dark:bg-rose-950/10 dark:border-rose-900/50 dark:text-rose-400 text-xs">
          ⚠️ {errorMessage}
        </div>
      )}

      {/* Top action status triggers */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">진행 상태</span>
          <span className={`inline-flex items-center rounded px-3 py-1 text-xs font-bold border ${STATUS_COLORS[po.status] || STATUS_COLORS.DRAFT}`}>
            {STATUS_LABELS[po.status] || po.status}
          </span>
        </div>

        {/* Operational buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {po.status === "DRAFT" && (
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

          {po.status === "APPROVED" && (
            <button
              onClick={() => handleTransition("SENT")}
              disabled={isActionLoading}
              className="px-3.5 py-2 bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors disabled:opacity-50"
            >
              Supplier에게 전송 처리 (Mark Sent)
            </button>
          )}

          {po.status === "SENT" && (
            <button
              onClick={() => handleTransition("IN_PRODUCTION")}
              disabled={isActionLoading}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors disabled:opacity-50"
            >
              생산 개시 처리 (In Production)
            </button>
          )}

          {po.status === "IN_PRODUCTION" && (
            <button
              onClick={() => handleTransition("READY_TO_SHIP")}
              disabled={isActionLoading}
              className="px-3.5 py-2 bg-emerald-650 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors disabled:opacity-50"
            >
              생산 완료 / 선적대기 (Ready to Ship)
            </button>
          )}

          {po.status !== "CANCELLED" && (
            <button
              onClick={() => handleTransition("CANCELLED")}
              disabled={isActionLoading}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-250 text-xs font-bold rounded-xl cursor-pointer transition-colors disabled:opacity-50"
            >
              발주 취소 (Cancel PO)
            </button>
          )}
        </div>
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
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">발주 요청 일자 (Order Date)</span>
                <span className="font-medium text-zinc-850 dark:text-zinc-200">{po.order_date}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">입고 목적 물류창고 (Destination)</span>
                <span className="font-semibold text-zinc-900 dark:text-white block">
                  [{po.warehouse.code}] {po.warehouse.name}
                </span>
                <span className="text-[10px] text-zinc-450 block mt-0.5">{po.warehouse.address1}, {po.warehouse.city}, {po.warehouse.state}</span>
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
                    <th className="px-4 py-2.5">Letusto SKU</th>
                    <th className="px-4 py-2.5">Mfg SKU</th>
                    <th className="px-4 py-2.5">제품명</th>
                    <th className="px-4 py-2.5 text-right w-20">수량</th>
                    <th className="px-4 py-2.5 text-right w-24">구매 단가</th>
                    <th className="px-4 py-2.5 text-right w-28">합계 금액</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {po.lines.map((l) => (
                    <tr key={l.id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-850/5">
                      <td className="px-4 py-3 font-medium text-zinc-650 dark:text-zinc-400">{l.brand_name}</td>
                      <td className="px-4 py-3 font-mono font-bold text-zinc-900 dark:text-white">
                        {l.letusto_sku || <span className="text-zinc-350 italic font-sans font-normal">-</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-700 dark:text-zinc-400">
                        {l.manufacture_sku || <span className="text-zinc-350 italic font-sans font-normal">-</span>}
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
              <span className="font-bold text-zinc-500">주문 집계 요약</span>
              <div className="flex gap-6">
                <div className="text-right">
                  <span className="text-[10px] text-zinc-400 uppercase block mb-0.5">총 주문 수량</span>
                  <span className="text-base font-bold font-mono text-zinc-900 dark:text-white">{po.total_qty.toLocaleString()}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-zinc-400 uppercase block mb-0.5">총 주문 대금</span>
                  <span className="text-base font-bold font-mono text-zinc-900 dark:text-white">
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

        </div>
      </div>
    </div>
  );
}
