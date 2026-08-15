"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  submitInvoice,
  approveInvoice,
  rejectInvoice,
  voidInvoice,
  getSupplierRemittanceMasked,
  getInvoiceAttachmentUrl
} from "@/lib/supplier-invoice/actions";

interface InvoiceLine {
  id: string;
  purchase_order_line_id: string;
  product_id: string;
  sku_snapshot: string;
  product_name_snapshot: string;
  invoiced_qty: number;
  unit_price: number;
  line_amount: number;
  line_note: string | null;
}

interface InvoiceDetailProps {
  invoice: {
    id: string;
    internal_ap_number: string;
    supplier_invoice_number: string;
    purchase_order_id: string;
    supplier_company_id: string;
    invoice_date: string;
    received_date: string;
    due_date: string;
    currency: string;
    payment_terms_snapshot: string | null;
    incoterms_snapshot: string | null;
    subtotal: number;
    tax_amount: number;
    other_charges: number;
    invoice_total: number;
    amount_paid: number;
    balance_due: number;
    invoice_status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "VOID";
    payment_status: "UNPAID" | "PARTIALLY_PAID" | "PAID";
    attachment_path: string | null;
    internal_note: string | null;
    rejection_reason: string | null;
    submitted_at: string | null;
    approved_at: string | null;
    rejected_at: string | null;
    voided_at: string | null;
    created_at: string;
    supplier: { id: string; name: string };
    po: { id: string; po_number: string };
    lines: InvoiceLine[];
    creator: { full_name: string } | null;
    submitter: { full_name: string } | null;
    approver: { full_name: string } | null;
    rejecter: { full_name: string } | null;
    voider: { full_name: string } | null;
  };
  po: {
    lines: Array<{
      id: string;
      qty: number; // Ordered Qty
      unit_cost: number; // PO Cost
      resolved_qty: number; // Resolved Qty
      inventory_received: number; // Good + Hold
      good_qty: number;
      hold_qty: number;
      damaged_qty: number;
      shortage_qty: number;
    }>;
  };
  prevInvoicesTotal: number;
  poMerchandiseTotal: number;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-650 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  SUBMITTED: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50",
  APPROVED: "bg-emerald-50 text-emerald-750 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-250 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50",
  VOID: "bg-zinc-200 text-zinc-500 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-600 dark:border-zinc-800",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "초안 (Draft)",
  SUBMITTED: "제출됨 (Submitted)",
  APPROVED: "승인됨 (Approved)",
  REJECTED: "반려됨 (Rejected)",
  VOID: "무효화됨 (Void)",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  UNPAID: "bg-amber-50 text-amber-700 border-amber-250 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50",
  PARTIALLY_PAID: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-900/50",
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: "미지급 (Unpaid)",
  PARTIALLY_PAID: "일부 지급 (Partially Paid)",
  PAID: "지급 완료 (Paid)",
};

export function InvoiceDetail({ invoice, po, prevInvoicesTotal, poMerchandiseTotal }: InvoiceDetailProps) {
  const router = useRouter();
  
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [remittance, setRemittance] = useState<any>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Load bank info and attachment URL on client mount
  useEffect(() => {
    const fetchExtraData = async () => {
      try {
        const bankData = await getSupplierRemittanceMasked(invoice.supplier_company_id);
        setRemittance(bankData);
      } catch (err) {
        console.error("Failed to load remittance details:", err);
      }

      if (invoice.attachment_path) {
        try {
          const url = await getInvoiceAttachmentUrl(invoice.attachment_path);
          setDownloadUrl(url);
        } catch (err) {
          console.error("Failed to load attachment link:", err);
        }
      }
    };
    fetchExtraData();
  }, [invoice]);

  // Action Handlers
  const handleSubmit = async () => {
    if (!confirm("이 인보이스를 제출하시겠습니까? 제출 후에는 승인 검토 단계로 이관됩니다.")) return;
    setIsActionLoading(true);
    setErrorMessage("");
    try {
      await submitInvoice(invoice.id);
      setSuccessMessage("인보이스가 성공적으로 제출되었습니다!");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "제출 처리에 실패했습니다.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!confirm("이 인보이스를 최종 승인하시겠습니까? 승인 시 채무(AP)가 확정됩니다.")) return;
    setIsActionLoading(true);
    setErrorMessage("");
    try {
      await approveInvoice(invoice.id);
      setSuccessMessage("인보이스가 최종 승인 처리되었습니다.");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "승인 처리에 실패했습니다.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectReason.trim()) {
      alert("반려 사유를 기입해 주세요.");
      return;
    }
    setIsActionLoading(true);
    setErrorMessage("");
    try {
      await rejectInvoice(invoice.id, rejectReason);
      setSuccessMessage("인보이스가 반려되었습니다.");
      setShowRejectModal(false);
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "반려 처리에 실패했습니다.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleVoid = async () => {
    if (!confirm("이 인보이스를 무효화(Void)하시겠습니까? 무효 처리된 문서는 취소할 수 없습니다.")) return;
    setIsActionLoading(true);
    setErrorMessage("");
    try {
      await voidInvoice(invoice.id);
      setSuccessMessage("인보이스가 무효 처리되었습니다.");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "무효 처리에 실패했습니다.");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Map PO lines for matching comparisons
  const poLinesMap = new Map(po.lines.map(l => [l.id, l]));

  // Variance calculations
  const remainingUninvoiced = Math.max(poMerchandiseTotal - prevInvoicesTotal - invoice.invoice_total, 0);

  return (
    <div className="space-y-6 text-xs">
      
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-col gap-2">
        <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider">
          Admin / Finance / Supplier Invoices
        </div>
        <div>
          <Link
            href="/admin/finance/invoices"
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
          >
            ← 공급사 인보이스 목록으로 돌아기
          </Link>
        </div>
      </div>

      {successMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-250 text-emerald-700 font-bold">
          ✅ {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-250 text-rose-600 font-bold dark:bg-rose-950/10 dark:border-rose-900/50 dark:text-rose-400">
          ⚠️ {errorMessage}
        </div>
      )}

      {/* Top Operations Panel */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-zinc-400">문서 상태</span>
            <span className={`inline-flex items-center rounded px-2.5 py-0.5 border ${STATUS_COLORS[invoice.invoice_status]}`}>
              {STATUS_LABELS[invoice.invoice_status]}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-zinc-400">지급 상태</span>
            <span className={`inline-flex items-center rounded px-2.5 py-0.5 border ${PAYMENT_STATUS_COLORS[invoice.payment_status]}`}>
              {PAYMENT_STATUS_LABELS[invoice.payment_status]}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* DRAFT */}
          {invoice.invoice_status === "DRAFT" && (
            <>
              <Link
                href={`/admin/finance/invoices/${invoice.id}/edit`}
                className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 font-bold rounded-xl cursor-pointer transition-colors"
              >
                수정 (Edit)
              </Link>
              <button
                onClick={handleSubmit}
                disabled={isActionLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-750 text-white font-bold rounded-xl cursor-pointer transition-colors disabled:opacity-50"
              >
                제출 (Submit)
              </button>
              <button
                onClick={handleVoid}
                disabled={isActionLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl cursor-pointer transition-colors disabled:opacity-50"
              >
                무효 (Void)
              </button>
            </>
          )}

          {/* SUBMITTED */}
          {invoice.invoice_status === "SUBMITTED" && (
            <>
              <button
                onClick={handleApprove}
                disabled={isActionLoading}
                className="px-4 py-2 bg-emerald-650 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer transition-colors disabled:opacity-50"
              >
                📥 승인 (Approve)
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={isActionLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl cursor-pointer transition-colors disabled:opacity-50"
              >
                반려 (Reject)
              </button>
            </>
          )}

          {/* APPROVED */}
          {invoice.invoice_status === "APPROVED" && (
            <>
              <span className="text-[10px] text-zinc-400 font-bold mr-2">✓ 승인 처리가 완료되어 채무가 확정되었습니다.</span>
              <button
                onClick={handleVoid}
                disabled={isActionLoading}
                className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 text-[10px] font-bold rounded-xl cursor-pointer transition-colors disabled:opacity-50"
              >
                강제 무효화 (Void)
              </button>
            </>
          )}

          {/* REJECTED */}
          {invoice.invoice_status === "REJECTED" && (
            <>
              <span className="text-[10px] text-rose-500 font-bold mr-2">반려 사유: {invoice.rejection_reason}</span>
              <Link
                href={`/admin/finance/invoices/${invoice.id}/edit`}
                className="px-3.5 py-2 bg-zinc-950 hover:bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 font-bold rounded-xl cursor-pointer transition-colors"
              >
                재작성 (Resubmit)
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Metadata & Bank Details */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Metadata Card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3.5">
            <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
              기본 거래 조건 및 정보
            </h3>

            <div className="space-y-3.5">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 block mb-0.5">내부 AP 번호</span>
                <span className="font-mono text-sm font-bold text-zinc-900 dark:text-white">{invoice.internal_ap_number}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 block mb-0.5">공급사 인보이스 번호</span>
                <span className="font-mono text-xs font-bold text-zinc-850 dark:text-zinc-200">{invoice.supplier_invoice_number}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 block mb-0.5">공급사 (Supplier Company)</span>
                <Link href={`/admin/companies/${invoice.supplier_company_id}`} className="font-bold text-indigo-650 hover:underline">
                  {invoice.supplier.name}
                </Link>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 block mb-0.5">연계 발주서 (PO No.)</span>
                <Link href={`/admin/purchasing/${invoice.purchase_order_id}`} className="font-mono font-bold text-indigo-650 hover:underline">
                  {invoice.po.po_number}
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 block mb-0.5">인보이스 발행일</span>
                  <span className="font-mono font-bold">{invoice.invoice_date}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 block mb-0.5">인보이스 접수일</span>
                  <span className="font-mono font-bold">{invoice.received_date}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 block mb-0.5">지급 기한</span>
                  <span className="font-mono font-bold text-rose-600">{invoice.due_date}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 block mb-0.5">통화 (Currency)</span>
                  <span className="font-bold">{invoice.currency}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 block mb-0.5">결제 조건</span>
                  <span className="font-medium">{invoice.payment_terms_snapshot || "-"}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 block mb-0.5">인코텀즈</span>
                  <span className="font-medium">{invoice.incoterms_snapshot || "-"}</span>
                </div>
              </div>

              {/* Attachment Link */}
              <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-400 block mb-1">인보이스 원본 첨부</span>
                {downloadUrl ? (
                  <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 font-bold rounded-xl transition-colors"
                  >
                    📎 원본 파일 다운로드 / 보기
                  </a>
                ) : (
                  <span className="text-zinc-400 italic">첨부된 파일이 없습니다.</span>
                )}
              </div>
            </div>
          </div>

          {/* Supplier Remittance Bank Details Card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3.5">
            <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 dark:border-zinc-800">
              공급사 수취 계좌 정보 (Remittance Bank)
            </h3>

            {remittance ? (
              <div className="space-y-3">
                <div>
                  <span className="text-[10px] text-zinc-400 block">수취 은행 (Bank Name)</span>
                  <span className="font-bold text-zinc-850 dark:text-zinc-200">{remittance.bank_name || "-"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block">예금주 (Beneficiary)</span>
                  <span className="font-bold text-zinc-850 dark:text-zinc-200">{remittance.beneficiary_name || "-"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block">계좌 번호 (Account Number)</span>
                  <span className="font-mono font-bold text-zinc-850 dark:text-zinc-200">{remittance.account_number || "-"}</span>
                </div>
                {remittance.routing_number && (
                  <div>
                    <span className="text-[10px] text-zinc-400 block">라우팅 번호 (Routing Number)</span>
                    <span className="font-mono font-bold text-zinc-850 dark:text-zinc-200">{remittance.routing_number}</span>
                  </div>
                )}
                {remittance.swift_bic && (
                  <div>
                    <span className="text-[10px] text-zinc-400 block">SWIFT/BIC Code</span>
                    <span className="font-mono font-bold text-zinc-850 dark:text-zinc-200">{remittance.swift_bic}</span>
                  </div>
                )}
                <div className="text-[9px] text-zinc-400 leading-normal border-t border-zinc-100 pt-2.5 dark:border-zinc-800">
                  {remittance.is_masked ? (
                    <span>⚠️ 일반 관리자 모드로 원감 보존을 위해 계좌 마스킹 처리되었습니다.</span>
                  ) : (
                    <span className="text-emerald-650 font-bold">✓ 승인된 계정/보안 권한에 의해 전체 계좌 정보가 노출되었습니다.</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-zinc-400 italic">등록된 송금 계좌가 없습니다.</div>
            )}
          </div>
        </div>

        {/* Right Column: Lines and 3-Way Match */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Table comparison */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <h3 className="text-sm font-bold text-zinc-850 dark:text-white font-sans">
              3-Way Match 검증 비교 (PO ↔ Receiving ↔ Invoice)
            </h3>

            <div className="overflow-x-auto rounded-lg border border-zinc-150 dark:border-zinc-800/80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50/50 text-zinc-500 font-bold border-b border-zinc-150 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-zinc-350">
                    <th className="px-3 py-2.5">SKU / 제품명</th>
                    <th className="px-3 py-2.5 text-right w-16">발주 (PO)</th>
                    <th className="px-3 py-2.5 text-right w-16">재고입고 (Recv)</th>
                    <th className="px-3 py-2.5 text-right w-12">파손 (Dmg)</th>
                    <th className="px-3 py-2.5 text-right w-12">부족 (Shtg)</th>
                    <th className="px-3 py-2.5 text-right w-16">종결량 (Resolved)</th>
                    <th className="px-3 py-2.5 text-right w-16">청구 (Inv)</th>
                    <th className="px-3 py-2.5 text-right w-16">발주단가 (PO)</th>
                    <th className="px-3 py-2.5 text-right w-16">청구단가 (Inv)</th>
                    <th className="px-3 py-2.5 text-center w-16">수량 매칭</th>
                    <th className="px-3 py-2.5 text-center w-16">단가 매칭</th>
                    <th className="px-3 py-2.5 text-center w-16">최종 매치</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {invoice.lines.map((l) => {
                    const poLine = poLinesMap.get(l.purchase_order_line_id);
                    const poQty = poLine?.qty || 0;
                    const poCost = poLine ? Number(poLine.unit_cost) : 0;
                    
                    const inventoryReceived = poLine?.inventory_received || 0;
                    const damaged = poLine?.damaged_qty || 0;
                    const shortage = poLine?.shortage_qty || 0;
                    const resolvedQty = poLine?.resolved_qty || 0;

                    const isQtyMatch = l.invoiced_qty === resolvedQty;
                    const isPriceMatch = Number(l.unit_price) === poCost;
                    const isMatch = isQtyMatch && isPriceMatch;

                    return (
                      <tr key={l.id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-850/5">
                        <td className="px-3 py-3">
                          <span className="font-mono font-bold text-zinc-900 dark:text-white block">{l.sku_snapshot}</span>
                          <span className="text-zinc-500 block max-w-[130px] truncate" title={l.product_name_snapshot}>{l.product_name_snapshot}</span>
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-zinc-550">{poQty.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right font-mono text-zinc-650">{inventoryReceived.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right font-mono text-rose-500">{damaged.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right font-mono text-amber-600">{shortage.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right font-mono font-bold text-zinc-700">{resolvedQty.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right font-mono font-bold text-zinc-900 dark:text-white">{l.invoiced_qty.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right font-mono text-zinc-450">{poCost.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right font-mono font-bold text-zinc-900 dark:text-white">{l.unit_price.toLocaleString()}</td>
                        
                        {/* Qty Match */}
                        <td className="px-3 py-3 text-center">
                          {isQtyMatch ? (
                            <span className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[8px] font-bold text-emerald-700 border border-emerald-100">
                              MATCH
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-rose-50 px-1.5 py-0.5 text-[8px] font-bold text-rose-700 border border-rose-150">
                              VARIANCE
                            </span>
                          )}
                        </td>

                        {/* Price Match */}
                        <td className="px-3 py-3 text-center">
                          {isPriceMatch ? (
                            <span className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[8px] font-bold text-emerald-700 border border-emerald-100">
                              MATCH
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-rose-50 px-1.5 py-0.5 text-[8px] font-bold text-rose-700 border border-rose-150">
                              VARIANCE
                            </span>
                          )}
                        </td>

                        {/* Final Result */}
                        <td className="px-3 py-3 text-center">
                          {isMatch ? (
                            <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-800 border border-emerald-200">
                              MATCH
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-rose-100 px-2 py-0.5 text-[9px] font-bold text-rose-800 border border-rose-200">
                              VARIANCE
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Invoiced Summaries */}
            <div className="flex justify-between items-start bg-zinc-50 dark:bg-zinc-950 p-4 border border-zinc-150 dark:border-zinc-850 rounded-xl">
              <div>
                <span className="font-bold text-zinc-500 block mb-1">인보이스 승인 및 누적 결제 통계</span>
                <p className="text-[10px] text-zinc-400 leading-relaxed max-w-sm">
                  이 발주서(PO)에 대해 이미 결제 승인된 타 인보이스 금액과 이번 인보이스 금액을 합산하여 잔여 예산을 계산합니다.
                </p>
              </div>
              <div className="flex gap-6 font-mono font-bold text-right">
                <div>
                  <span className="text-[10px] font-sans text-zinc-400 block mb-0.5">PO 원 주문 총액</span>
                  <span className="text-xs text-zinc-650">{invoice.currency} {poMerchandiseTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="border-l border-zinc-200 pl-6 dark:border-zinc-850">
                  <span className="text-[10px] font-sans text-zinc-400 block mb-0.5">기승인 완료액</span>
                  <span className="text-xs text-zinc-650">{invoice.currency} {prevInvoicesTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="border-l border-zinc-200 pl-6 dark:border-zinc-850">
                  <span className="text-[10px] font-sans text-zinc-500 block mb-0.5">금회 청구 총액</span>
                  <span className="text-xs text-indigo-650">{invoice.currency} {invoice.invoice_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="border-l border-zinc-200 pl-6 dark:border-zinc-850">
                  <span className="text-[10px] font-sans text-zinc-400 block mb-0.5">잔여 미청구액</span>
                  <span className="text-xs text-zinc-600">{invoice.currency} {remainingUninvoiced.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Audit trail */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-2">
            <h4 className="font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wide">처리 이력 감사 (Audit Trail)</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 border-t border-zinc-100 pt-3 dark:border-zinc-850">
              <div>
                <span className="text-[10px] text-zinc-400 block mb-0.5">생성 담당자</span>
                <span className="font-bold">{invoice.creator?.full_name || "System"}</span>
                <span className="text-[9px] text-zinc-400 font-mono block mt-0.5">{invoice.created_at.split("T")[0]}</span>
              </div>
              {invoice.submitted_at && (
                <div>
                  <span className="text-[10px] text-zinc-400 block mb-0.5">제출 담당자</span>
                  <span className="font-bold">{invoice.submitter?.full_name || "-"}</span>
                  <span className="text-[9px] text-zinc-400 font-mono block mt-0.5">{invoice.submitted_at.split("T")[0]}</span>
                </div>
              )}
              {invoice.approved_at && (
                <div>
                  <span className="text-[10px] text-zinc-400 block mb-0.5">최종 승인자</span>
                  <span className="font-bold text-emerald-600">{invoice.approver?.full_name || "-"}</span>
                  <span className="text-[9px] text-zinc-400 font-mono block mt-0.5">{invoice.approved_at.split("T")[0]}</span>
                </div>
              )}
              {invoice.rejected_at && (
                <div>
                  <span className="text-[10px] text-zinc-400 block mb-0.5">반려 담당자</span>
                  <span className="font-bold text-rose-500">{invoice.rejecter?.full_name || "-"}</span>
                  <span className="text-[9px] text-zinc-400 font-mono block mt-0.5">{invoice.rejected_at.split("T")[0]}</span>
                </div>
              )}
              {invoice.voided_at && (
                <div>
                  <span className="text-[10px] text-zinc-400 block mb-0.5">무효 처리자</span>
                  <span className="font-bold text-zinc-450">{invoice.voider?.full_name || "-"}</span>
                  <span className="text-[9px] text-zinc-400 font-mono block mt-0.5">{invoice.voided_at.split("T")[0]}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-2">
            <h4 className="font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wide">인보이스 내부 비고</h4>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium">
              {invoice.internal_note || <span className="text-zinc-350 italic font-normal">등록된 비고 및 특이사항이 없습니다.</span>}
            </p>
          </div>

        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-sm rounded-xl p-5 shadow-xl space-y-4">
            <h4 className="text-sm font-bold text-zinc-850 dark:text-white">인보이스 반려 사유 작성</h4>
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 mb-1">반려 사유 (Required) *</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="단가 불일치, 첨부 누락 등 반려 사유를 상세하게 기입하세요..."
                className="w-full border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs bg-zinc-50 dark:bg-zinc-955 dark:text-white outline-none min-h-[90px]"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-3.5 py-1.5 border border-zinc-200 text-zinc-650 hover:bg-zinc-50 dark:border-zinc-850 dark:text-zinc-300 rounded-lg font-bold transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleRejectSubmit}
                disabled={isActionLoading}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                제출 및 반려 (Reject)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
