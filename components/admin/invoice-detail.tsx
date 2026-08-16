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
  getInvoiceAttachmentUrl,
  createAdjustment,
  updateAdjustment,
  transitionAdjustmentStatus,
  closeSettlement,
  reopenSettlement
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

interface AdjustmentItem {
  id: string;
  supplier_invoice_line_id: string | null;
  adjustment_type: "SHORTAGE" | "DAMAGE" | "PRICE_DIFFERENCE" | "OTHER";
  adjustment_direction: "CREDIT" | "CHARGE";
  quantity: number | null;
  unit_amount: number | null;
  adjustment_amount: number;
  currency: string;
  reason: string;
  reference_type: "SHIPMENT" | "RECEIVING" | "VARIANCE_CLOSE" | "OTHER" | null;
  reference_id: string | null;
  supplier_credit_reference: string | null;
  status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "VOID";
  internal_note: string | null;
  rejection_reason: string | null;
  created_at: string;
  creator: { full_name: string } | null;
  approver: { full_name: string } | null;
  rejecter: { full_name: string } | null;
  voider: { full_name: string } | null;
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
    settlement_status: "OPEN" | "PENDING_ADJUSTMENT" | "SETTLED";
    attachment_path: string | null;
    internal_note: string | null;
    rejection_reason: string | null;
    submitted_at: string | null;
    approved_at: string | null;
    rejected_at: string | null;
    voided_at: string | null;
    created_at: string;
    supplier: { id: string; name: string };
    po: { id: string; po_number: string } | null;
    lines: InvoiceLine[];
    creator: { full_name: string } | null;
    submitter: { full_name: string } | null;
    approver: { full_name: string } | null;
    rejecter: { full_name: string } | null;
    voider: { full_name: string } | null;
    adjustments: AdjustmentItem[];
    payments: Array<{
      id: string;
      payment_number: string;
      payment_date: string;
      payment_amount: number;
      currency: string;
      payment_method: "WIRE" | "ACH" | "CHECK" | "OTHER";
      status: "DRAFT" | "COMPLETED" | "VOID";
      created_at: string;
    }>;
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
  poRelationBroken?: boolean;
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

const SETTLEMENT_STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-zinc-100 text-zinc-650 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  PENDING_ADJUSTMENT: "bg-amber-50 text-amber-700 border-amber-250 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50",
  SETTLED: "bg-emerald-50 text-emerald-750 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
};

const SETTLEMENT_STATUS_LABELS: Record<string, string> = {
  OPEN: "정산 대기 (Open)",
  PENDING_ADJUSTMENT: "분쟁/조정 중 (Pending Adjustment)",
  SETTLED: "정산 종결 (Settled)",
};

const ADJ_TYPE_LABELS: Record<string, string> = {
  SHORTAGE: "수량 부족 (Shortage)",
  DAMAGE: "품목 파손 (Damage)",
  PRICE_DIFFERENCE: "단가 불일치 (Price Diff)",
  OTHER: "기타 (Other)",
};

export function InvoiceDetail({ invoice, po, prevInvoicesTotal, poMerchandiseTotal, poRelationBroken }: InvoiceDetailProps) {
  const router = useRouter();
  
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  
  const [remittance, setRemittance] = useState<any>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Adjustment Modal State
  const [showAdjModal, setShowAdjModal] = useState(false);
  const [editingAdj, setEditingAdj] = useState<AdjustmentItem | null>(null);
  const [adjType, setAdjType] = useState<"SHORTAGE" | "DAMAGE" | "PRICE_DIFFERENCE" | "OTHER">("SHORTAGE");
  const [adjDirection, setAdjDirection] = useState<"CREDIT" | "CHARGE">("CREDIT");
  const [selectedLineId, setSelectedLineId] = useState<string>("");
  const [adjQty, setAdjQty] = useState<number>(0);
  const [adjUnitAmount, setAdjUnitAmount] = useState<number>(0);
  const [adjAmount, setAdjAmount] = useState<number>(0);
  const [adjReason, setAdjReason] = useState<string>("");
  const [adjRefType, setAdjRefType] = useState<string>("");
  const [adjRefId, setAdjRefId] = useState<string>("");
  const [adjCreditRef, setAdjCreditRef] = useState<string>("");
  const [adjNote, setAdjNote] = useState<string>("");

  // Adjustment Rejection Modal
  const [showAdjRejectModal, setShowAdjRejectModal] = useState(false);
  const [rejectingAdjId, setRejectingAdjId] = useState<string | null>(null);
  const [adjRejectReason, setAdjRejectReason] = useState<string>("");

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

  // Suggest values based on line/type in modal
  useEffect(() => {
    if (!selectedLineId) {
      setAdjQty(0);
      setAdjUnitAmount(0);
      setAdjAmount(0);
      return;
    }

    const line = invoice.lines.find(l => l.id === selectedLineId);
    if (!line) return;

    const poLine = po.lines.find(pl => pl.id === line.purchase_order_line_id);
    if (!poLine) return;

    if (adjType === "SHORTAGE") {
      const suggestedQty = poLine.shortage_qty;
      setAdjQty(suggestedQty);
      setAdjUnitAmount(Number(poLine.unit_cost));
      setAdjAmount(suggestedQty * Number(poLine.unit_cost));
    } else if (adjType === "DAMAGE") {
      const suggestedQty = poLine.damaged_qty;
      setAdjQty(suggestedQty);
      setAdjUnitAmount(Number(poLine.unit_cost));
      setAdjAmount(suggestedQty * Number(poLine.unit_cost));
    } else if (adjType === "PRICE_DIFFERENCE") {
      const priceDiff = Math.abs(line.unit_price - Number(poLine.unit_cost));
      setAdjQty(line.invoiced_qty);
      setAdjUnitAmount(priceDiff);
      setAdjAmount(line.invoiced_qty * priceDiff);
    } else {
      setAdjQty(0);
      setAdjUnitAmount(0);
      setAdjAmount(0);
    }
  }, [selectedLineId, adjType]);

  // Adjust amount when qty or unit cost changes manually
  const handleQtyUnitChange = (qty: number, unit: number) => {
    setAdjQty(qty);
    setAdjUnitAmount(unit);
    setAdjAmount(Number((qty * unit).toFixed(2)));
  };

  // Action Handlers for Invoice
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

  // Settlement Close / Reopen Handlers
  const handleCloseSettlement = async () => {
    if (!confirm("정산을 최종 종결(Settlement Close)하시겠습니까? 종결 시 조정 항목 수정이 불가능하며 Final Payable이 최종 대금으로 확정됩니다.")) return;
    setIsActionLoading(true);
    setErrorMessage("");
    try {
      await closeSettlement(invoice.id);
      setSuccessMessage("대금 정산이 성공적으로 종결 처리되었습니다.");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "정산 종결 처리에 실패했습니다.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReopenSettlement = async () => {
    if (!confirm("정산을 다시 재개(Reopen Settlement)하시겠습니까?")) return;
    setIsActionLoading(true);
    setErrorMessage("");
    try {
      await reopenSettlement(invoice.id);
      setSuccessMessage("대금 정산이 재개되었습니다.");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "정산 재개 처리에 실패했습니다.");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Adjustment CRUD Handlers
  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjReason.trim() || adjAmount <= 0) {
      alert("금액 및 사유를 입력해 주세요.");
      return;
    }

    setIsActionLoading(true);
    setErrorMessage("");

    const payload = {
      supplier_invoice_id: invoice.id,
      supplier_invoice_line_id: selectedLineId || null,
      adjustment_type: adjType,
      adjustment_direction: adjDirection,
      quantity: adjQty || null,
      unit_amount: adjUnitAmount || null,
      adjustment_amount: adjAmount,
      currency: invoice.currency,
      reason: adjReason,
      reference_type: (adjRefType as any) || null,
      reference_id: adjRefId || null,
      supplier_credit_reference: adjCreditRef || null,
      internal_note: adjNote || null,
    };

    try {
      if (editingAdj) {
        await updateAdjustment(editingAdj.id, payload);
        setSuccessMessage("조정 항목이 수정되었습니다.");
      } else {
        await createAdjustment(payload);
        setSuccessMessage("새로운 조정 항목이 추가되었습니다.");
      }
      setShowAdjModal(false);
      setEditingAdj(null);
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "조정 저장 처리에 실패했습니다.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleEditAdjClick = (adj: AdjustmentItem) => {
    setEditingAdj(adj);
    setAdjType(adj.adjustment_type);
    setAdjDirection(adj.adjustment_direction);
    setSelectedLineId(adj.supplier_invoice_line_id || "");
    setAdjQty(adj.quantity || 0);
    setAdjUnitAmount(adj.unit_amount || 0);
    setAdjAmount(adj.adjustment_amount);
    setAdjReason(adj.reason);
    setAdjRefType(adj.reference_type || "");
    setAdjRefId(adj.reference_id || "");
    setAdjCreditRef(adj.supplier_credit_reference || "");
    setAdjNote(adj.internal_note || "");
    setShowAdjModal(true);
  };

  const handleAdjStatusTransition = async (adjId: string, status: "PENDING" | "APPROVED" | "VOID") => {
    let msg = "";
    if (status === "PENDING") msg = "조정 항목을 제출하시겠습니까?";
    else if (status === "APPROVED") msg = "조정 항목을 공급사 최종 합의로 승인(APPROVED)하시겠습니까?";
    else if (status === "VOID") msg = "조정 항목을 무효(VOID) 처리하시겠습니까?";

    if (!confirm(msg)) return;

    setIsActionLoading(true);
    setErrorMessage("");
    try {
      await transitionAdjustmentStatus(adjId, status);
      setSuccessMessage("조정 상태가 변경되었습니다.");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "조정 상태 변경에 실패했습니다.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleAdjRejectSubmit = async () => {
    if (!rejectingAdjId || !adjRejectReason.trim()) {
      alert("반려 사유를 입력해 주세요.");
      return;
    }

    setIsActionLoading(true);
    setErrorMessage("");
    try {
      await transitionAdjustmentStatus(rejectingAdjId, "REJECTED", adjRejectReason);
      setSuccessMessage("조정 항목이 반려되었습니다.");
      setShowAdjRejectModal(false);
      setRejectingAdjId(null);
      setAdjRejectReason("");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "조정 반려 처리에 실패했습니다.");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Calculations for approved adjustments
  const approvedAdjustments = invoice.adjustments.filter(a => a.status === "APPROVED");
  const approvedCredits = approvedAdjustments
    .filter(a => a.adjustment_direction === "CREDIT")
    .reduce((sum, a) => sum + a.adjustment_amount, 0);
  const approvedCharges = approvedAdjustments
    .filter(a => a.adjustment_direction === "CHARGE")
    .reduce((sum, a) => sum + a.adjustment_amount, 0);

  const finalPayable = invoice.invoice_total + approvedCharges - approvedCredits;
  const balanceDue = finalPayable - invoice.amount_paid;

  // Logistics mapping for summaries
  const poLinesMap = new Map(po.lines.map(l => [l.id, l]));

  // Logistics warning check (if unresolved items exist)
  const hasUnresolvedLogistics = po.lines.some(l => l.qty > l.resolved_qty);

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
            ← 공급사 인보이스 목록으로 돌아가기
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

      {poRelationBroken && (
        <div className="p-3.5 rounded-lg bg-rose-55 border border-rose-250 text-rose-600 font-bold dark:bg-rose-950/10 dark:border-rose-900/50 dark:text-rose-400">
          ⚠️ 데이터 정합성 주의: 이 인보이스는 발주서 ID ({invoice.purchase_order_id})를 참조하고 있으나, 연결된 발주서 데이터가 누락되었거나 조회가 불가능합니다.
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
          <div className="flex items-center gap-2">
            <span className="font-bold text-zinc-400">정산 상태</span>
            <span className={`inline-flex items-center rounded px-2.5 py-0.5 border ${SETTLEMENT_STATUS_COLORS[invoice.settlement_status]}`}>
              {SETTLEMENT_STATUS_LABELS[invoice.settlement_status]}
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
              {invoice.settlement_status !== "SETTLED" ? (
                <button
                  onClick={handleCloseSettlement}
                  disabled={isActionLoading}
                  className="px-4 py-2 bg-emerald-650 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer transition-colors disabled:opacity-50 shadow-sm"
                >
                  🔒 정산 종결 (Close Settlement)
                </button>
              ) : (
                <button
                  onClick={handleReopenSettlement}
                  disabled={isActionLoading}
                  className="px-4 py-2 bg-zinc-955 hover:bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 text-xs font-bold rounded-xl cursor-pointer transition-colors disabled:opacity-50"
                >
                  🔓 정산 재개 (Reopen Settlement)
                </button>
              )}
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
                className="px-3.5 py-2 bg-zinc-955 hover:bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 font-bold rounded-xl cursor-pointer transition-colors"
              >
                재작성 (Resubmit)
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Logistics unresolved Alert warning */}
      {hasUnresolvedLogistics && (
        <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-250 text-amber-800 font-medium leading-relaxed dark:bg-amber-950/10 dark:border-amber-900/50 dark:text-amber-400">
          ⚠️ <strong>물류 미결 경고 (Logistics Unresolved)</strong>:
          해당 발주서(PO)의 일부 품목이 아직 예약 선적 또는 입고 검수가 최종 종결되지 않았습니다. 
          물류 정보 확인 후 종결(RECEIVED) 처리가 완료될 때까지 재무 정산 종결(Close Settlement)이 차단됩니다.
        </div>
      )}

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
                {invoice.purchase_order_id ? (
                  invoice.po ? (
                    <Link href={`/admin/purchasing/${invoice.purchase_order_id}`} className="font-mono font-bold text-indigo-650 hover:underline">
                      {invoice.po.po_number}
                    </Link>
                  ) : (
                    <span className="text-rose-600 font-bold flex items-center gap-1 text-[11px]">
                      ⚠️ PO 연결 오류 (ID: {invoice.purchase_order_id})
                    </span>
                  )
                ) : (
                  <span className="text-zinc-400 italic">연결된 PO 없음</span>
                )}
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

        {/* Right Column: Lines, 3-Way Match, Adjustments, and Summary */}
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
          </div>

          {/* Adjustments & Credits Card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-2 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-850 dark:text-white font-sans">
                대금 조정 내역 (Supplier Invoice Adjustments)
              </h3>
              {invoice.invoice_status === "APPROVED" && invoice.settlement_status !== "SETTLED" && (
                <button
                  onClick={() => {
                    setEditingAdj(null);
                    setAdjType("SHORTAGE");
                    setAdjDirection("CREDIT");
                    setSelectedLineId("");
                    setAdjQty(0);
                    setAdjUnitAmount(0);
                    setAdjAmount(0);
                    setAdjReason("");
                    setAdjRefType("");
                    setAdjRefId("");
                    setAdjCreditRef("");
                    setAdjNote("");
                    setShowAdjModal(true);
                  }}
                  className="px-2.5 py-1.5 bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:opacity-85 font-bold rounded-lg text-[10px] cursor-pointer"
                >
                  + 조정 항목 추가 (Add Adjustment)
                </button>
              )}
            </div>

            <div className="overflow-hidden rounded-lg border border-zinc-150 dark:border-zinc-800/80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50/50 text-zinc-500 font-bold border-b border-zinc-150 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-zinc-350">
                    <th className="px-3 py-2">조정 유형</th>
                    <th className="px-3 py-2">방향</th>
                    <th className="px-3 py-2 text-right">수량</th>
                    <th className="px-3 py-2 text-right">조정금액</th>
                    <th className="px-3 py-2">사유 및 참조 정보</th>
                    <th className="px-3 py-2">상태</th>
                    {invoice.settlement_status !== "SETTLED" && <th className="px-3 py-2 text-right">조작</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {invoice.adjustments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-zinc-400 italic">
                        추가된 대금 조정 및 크레딧 명세가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    invoice.adjustments.map((adj) => (
                      <tr key={adj.id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-850/5">
                        <td className="px-3 py-2.5 font-bold text-zinc-900 dark:text-white">
                          {ADJ_TYPE_LABELS[adj.adjustment_type]}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold border ${adj.adjustment_direction === "CREDIT" ? "bg-rose-50 text-rose-700 border-rose-100" : "bg-blue-50 text-blue-700 border-blue-100"}`}>
                            {adj.adjustment_direction === "CREDIT" ? "차감 (Credit)" : "가산 (Charge)"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-zinc-650">
                          {adj.quantity ? adj.quantity.toLocaleString() : "-"}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-zinc-900 dark:text-white">
                          {adj.currency} {adj.adjustment_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2.5 leading-normal max-w-xs">
                          <p className="font-semibold text-zinc-700 dark:text-zinc-350">{adj.reason}</p>
                          {adj.supplier_credit_reference && (
                            <span className="text-[10px] text-zinc-400 block font-bold">Credit Memo: {adj.supplier_credit_reference}</span>
                          )}
                          {adj.reference_type && (
                            <span className="text-[9px] text-zinc-400 font-mono block">Logistics Ref: [{adj.reference_type}] {adj.reference_id}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[8px] font-bold ${STATUS_COLORS[adj.status]}`}>
                            {STATUS_LABELS[adj.status]}
                          </span>
                          {adj.status === "REJECTED" && adj.rejection_reason && (
                            <span className="text-[9px] text-rose-500 block leading-tight font-semibold mt-0.5">반려 사유: {adj.rejection_reason}</span>
                          )}
                        </td>
                        {invoice.settlement_status !== "SETTLED" && (
                          <td className="px-3 py-2.5 text-right space-x-1.5 whitespace-nowrap">
                            {/* DRAFT */}
                            {adj.status === "DRAFT" && (
                              <>
                                <button
                                  onClick={() => handleEditAdjClick(adj)}
                                  className="text-zinc-500 hover:text-zinc-800 font-bold"
                                >
                                  수정
                                </button>
                                <button
                                  onClick={() => handleAdjStatusTransition(adj.id, "PENDING")}
                                  className="text-blue-600 hover:text-blue-800 font-bold"
                                >
                                  제출
                                </button>
                                <button
                                  onClick={() => handleAdjStatusTransition(adj.id, "VOID")}
                                  className="text-rose-600 hover:text-rose-800 font-bold"
                                >
                                  무효
                                </button>
                              </>
                            )}

                            {/* PENDING */}
                            {adj.status === "PENDING" && (
                              <>
                                <button
                                  onClick={() => handleAdjStatusTransition(adj.id, "APPROVED")}
                                  className="text-emerald-650 hover:text-emerald-800 font-bold"
                                >
                                  승인
                                </button>
                                <button
                                  onClick={() => {
                                    setRejectingAdjId(adj.id);
                                    setAdjRejectReason("");
                                    setShowAdjRejectModal(true);
                                  }}
                                  className="text-rose-600 hover:text-rose-800 font-bold"
                                >
                                  반려
                                </button>
                              </>
                            )}

                            {/* REJECTED */}
                            {adj.status === "REJECTED" && (
                              <>
                                <button
                                  onClick={() => handleEditAdjClick(adj)}
                                  className="text-zinc-500 hover:text-zinc-800 font-bold"
                                >
                                  재수정
                                </button>
                                <button
                                  onClick={() => handleAdjStatusTransition(adj.id, "VOID")}
                                  className="text-rose-600 hover:text-rose-800 font-bold"
                                >
                                  무효
                                </button>
                              </>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Settlement Summary Card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <h3 className="text-sm font-bold text-zinc-850 dark:text-white font-sans">
              최종 정산 요약 (Settlement Summary)
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-zinc-50 dark:bg-zinc-950 p-4 border border-zinc-150 dark:border-zinc-850 rounded-xl">
              <div>
                <span className="text-[10px] text-zinc-400 block mb-0.5">인보이스 원 청구 총액</span>
                <span className="text-sm font-mono font-bold text-zinc-900 dark:text-white">
                  {invoice.currency} {invoice.invoice_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="border-l border-zinc-200 pl-4 dark:border-zinc-850">
                <span className="text-[10px] text-rose-500 block mb-0.5">차감 합계 (Approved Credits)</span>
                <span className="text-sm font-mono font-bold text-rose-600">
                  -{invoice.currency} {approvedCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="border-l border-zinc-200 pl-4 dark:border-zinc-850">
                <span className="text-[10px] text-blue-500 block mb-0.5">가산 합계 (Approved Charges)</span>
                <span className="text-sm font-mono font-bold text-blue-600">
                  +{invoice.currency} {approvedCharges.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="border-l border-zinc-200 pl-4 dark:border-zinc-850">
                <span className="text-[10px] text-emerald-650 block mb-0.5 font-bold">최종 미지급 채무 (Final Payable)</span>
                <span className="text-sm font-mono font-bold text-emerald-700 dark:text-emerald-400">
                  {invoice.currency} {finalPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center text-[10px] text-zinc-400 font-bold border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <div className="space-x-4">
                <span>지급 완료액: {invoice.currency} {invoice.amount_paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                <span>지급 잔액 (Balance Due): {invoice.currency} {balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                {invoice.amount_paid > finalPayable && (
                  <span className="text-rose-600 font-bold ml-2">
                    과지급액 (Overpayment): {invoice.currency} {(invoice.amount_paid - finalPayable).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
              <div>
                <span>* 실제 대금 지급은 종결된 최종 미지급 채무(Final Payable) 기준으로 지급 기한에 진행됩니다.</span>
              </div>
            </div>
          </div>

          {/* Payment History */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-2 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-850 dark:text-white font-sans">
                지급 거래 내역 (Payment History)
              </h3>
              {invoice.invoice_status === "APPROVED" && invoice.settlement_status === "SETTLED" && balanceDue > 0 && (
                <Link
                  href={`/admin/finance/payments/new?invoice_id=${invoice.id}`}
                  className="px-2.5 py-1.5 bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:opacity-85 font-bold rounded-lg text-[10px] cursor-pointer"
                >
                  + 지급 등록 (Record Payment)
                </Link>
              )}
            </div>

            <div className="overflow-hidden rounded-lg border border-zinc-150 dark:border-zinc-800/80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50/50 text-zinc-500 font-bold border-b border-zinc-150 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-zinc-350">
                    <th className="px-3 py-2">지급 번호</th>
                    <th className="px-3 py-2">지급 일자</th>
                    <th className="px-3 py-2 text-right">지급 금액</th>
                    <th className="px-3 py-2">지급 방식</th>
                    <th className="px-3 py-2">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {(!invoice.payments || invoice.payments.length === 0) ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-zinc-400 italic">
                        기록된 지급 내역이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    invoice.payments.map((p) => (
                      <tr key={p.id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-850/5">
                        <td className="px-3 py-2.5 font-mono font-bold text-indigo-650 hover:underline">
                          <Link href={`/admin/finance/payments/${p.id}`}>
                            {p.payment_number}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-zinc-650">
                          {p.payment_date}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-zinc-900 dark:text-white">
                          {p.currency} {p.payment_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-zinc-700 dark:text-zinc-300">
                          {p.payment_method}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[8px] font-bold ${
                            p.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50" :
                            p.status === "VOID" ? "bg-zinc-200 text-zinc-500 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-600 dark:border-zinc-800" :
                            "bg-zinc-100 text-zinc-650 border-zinc-200"
                          }`}>
                            {p.status === "COMPLETED" ? "완료 (Completed)" : p.status === "VOID" ? "무효 (Void)" : "초안 (Draft)"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
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

      {/* Reject Invoice Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-sm rounded-xl p-5 shadow-xl space-y-4">
            <h4 className="text-sm font-bold text-zinc-850 dark:text-white font-sans">인보이스 반려 사유 작성</h4>
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 mb-1">반려 사유 (Required) *</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="단가 불일치, 첨부 누락 등 반려 사유를 상세하게 기입하세요..."
                className="w-full border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs bg-zinc-50 dark:bg-zinc-950 dark:text-white outline-none min-h-[90px]"
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

      {/* Adjustment Rejection Modal */}
      {showAdjRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-sm rounded-xl p-5 shadow-xl space-y-4">
            <h4 className="text-sm font-bold text-zinc-850 dark:text-white font-sans">조정 항목 반려 사유</h4>
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 mb-1">반려 사유 *</label>
              <textarea
                value={adjRejectReason}
                onChange={(e) => setAdjRejectReason(e.target.value)}
                placeholder="반려 사유(예: 공급사 미승인, 재입고 확인 등)를 기입하세요..."
                className="w-full border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs bg-zinc-50 dark:bg-zinc-955 dark:text-white outline-none min-h-[90px]"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAdjRejectModal(false);
                  setRejectingAdjId(null);
                }}
                className="px-3 py-1.5 border border-zinc-200 text-zinc-650 hover:bg-zinc-50 dark:border-zinc-850 dark:text-zinc-300 rounded-lg font-bold transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleAdjRejectSubmit}
                disabled={isActionLoading}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                반려 처리 (Reject)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Adjustment Modal */}
      {showAdjModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleSaveAdjustment} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-md rounded-xl p-5 shadow-xl space-y-4 my-8">
            <h4 className="text-sm font-bold text-zinc-850 dark:text-white font-sans border-b border-zinc-100 pb-2 dark:border-zinc-800">
              {editingAdj ? "대금 조정 항목 수정" : "대금 조정 항목 추가 (Add Adjustment)"}
            </h4>

            <div className="grid grid-cols-2 gap-4">
              {/* Type */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 mb-1">조정 유형 *</label>
                <select
                  value={adjType}
                  onChange={(e) => setAdjType(e.target.value as any)}
                  className="w-full h-8 rounded-lg border border-zinc-200 bg-white px-2 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white font-bold"
                  required
                >
                  <option value="SHORTAGE">수량 부족 (SHORTAGE)</option>
                  <option value="DAMAGE">품목 파손 (DAMAGE)</option>
                  <option value="PRICE_DIFFERENCE">단가 불일치 (PRICE_DIFFERENCE)</option>
                  <option value="OTHER">기타 정산 (OTHER)</option>
                </select>
              </div>

              {/* Direction */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 mb-1">조정 방향 *</label>
                <select
                  value={adjDirection}
                  onChange={(e) => setAdjDirection(e.target.value as any)}
                  className="w-full h-8 rounded-lg border border-zinc-200 bg-white px-2 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white font-bold"
                  required
                >
                  <option value="CREDIT">차감 (CREDIT - 대금 감소)</option>
                  <option value="CHARGE">가산 (CHARGE - 대금 증가)</option>
                </select>
              </div>
            </div>

            {/* Line Item Link */}
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 mb-1">매핑 품목 (optional)</label>
              <select
                value={selectedLineId}
                onChange={(e) => setSelectedLineId(e.target.value)}
                className="w-full h-8 rounded-lg border border-zinc-200 bg-white px-2 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
              >
                <option value="">품목 매핑 없음 (General)</option>
                {invoice.lines.map(l => (
                  <option key={l.id} value={l.id}>
                    [{l.sku_snapshot}] {l.product_name_snapshot}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {/* Qty */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 mb-1">수량 (optional)</label>
                <input
                  type="number"
                  min="0"
                  value={adjQty || ""}
                  onChange={(e) => handleQtyUnitChange(parseInt(e.target.value) || 0, adjUnitAmount)}
                  className="w-full h-8 rounded-lg border border-zinc-200 bg-white px-2 outline-none dark:border-zinc-800 dark:bg-zinc-955 dark:text-white font-mono"
                />
              </div>

              {/* Unit Amount */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 mb-1">개별 단가 (optional)</label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={adjUnitAmount || ""}
                  onChange={(e) => handleQtyUnitChange(adjQty, parseFloat(e.target.value) || 0)}
                  className="w-full h-8 rounded-lg border border-zinc-200 bg-white px-2 outline-none dark:border-zinc-800 dark:bg-zinc-955 dark:text-white font-mono"
                />
              </div>

              {/* Final Amount */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 mb-1">조정 총액 *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={adjAmount || ""}
                  onChange={(e) => setAdjAmount(parseFloat(e.target.value) || 0)}
                  className="w-full h-8 rounded-lg border border-zinc-200 bg-white px-2 outline-none dark:border-zinc-800 dark:bg-zinc-955 dark:text-white font-mono font-bold"
                  required
                />
              </div>
            </div>

            {selectedLineId && (
              <div className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-150 text-[10px] text-zinc-500 leading-normal">
                💡 <strong>자동 제안(Suggested) 계산 내역:</strong><br />
                - 수량 부족 시: shortage_qty × PO단가<br />
                - 품목 파손 시: damaged_qty × PO단가<br />
                - 단가 불일치 시: invoiced_qty × |청구단가 - PO단가|<br />
                * 공급사와의 협상 또는 보장 한도에 따라 필요시 입력 값을 수동 수정할 수 있습니다.
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 mb-1">조정 및 청구 사유 (Reason) *</label>
              <input
                type="text"
                placeholder="예: 3차 선적 컨테이너 누수로 인한 2개 완손실 크레딧 합의"
                value={adjReason}
                onChange={(e) => setAdjReason(e.target.value)}
                className="w-full h-8 rounded-lg border border-zinc-200 bg-white px-2 outline-none dark:border-zinc-800 dark:bg-zinc-955 dark:text-white"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Reference Type */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 mb-1">물류 근거 유형 (Evidence Type)</label>
                <select
                  value={adjRefType}
                  onChange={(e) => setAdjRefType(e.target.value)}
                  className="w-full h-8 rounded-lg border border-zinc-200 bg-white px-2 outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                >
                  <option value="">참조 없음</option>
                  <option value="SHIPMENT">Inbound Shipment</option>
                  <option value="RECEIVING">Receiving Document</option>
                  <option value="VARIANCE_CLOSE">Variance Close Details</option>
                  <option value="OTHER">기타 증적</option>
                </select>
              </div>

              {/* Reference ID/Name */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 mb-1">물류 참조 ID / 문서번호</label>
                <input
                  type="text"
                  placeholder="예: 선적 ID 또는 전표번호"
                  value={adjRefId}
                  onChange={(e) => setAdjRefId(e.target.value)}
                  className="w-full h-8 rounded-lg border border-zinc-200 bg-white px-2 outline-none dark:border-zinc-800 dark:bg-zinc-955 dark:text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {/* Credit Memo Ref */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 mb-1">공급사 Credit Memo 참조번호 (Supplier Credit Ref)</label>
                <input
                  type="text"
                  placeholder="예: CM-2026-102"
                  value={adjCreditRef}
                  onChange={(e) => setAdjCreditRef(e.target.value)}
                  className="w-full h-8 rounded-lg border border-zinc-200 bg-white px-2 outline-none dark:border-zinc-800 dark:bg-zinc-955 dark:text-white font-mono"
                />
              </div>
            </div>

            {/* Note */}
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 mb-1">조정 상세 메모 (Note)</label>
              <textarea
                placeholder="정산 관련 세부 합의 조건이나 회계 담당자 특이사항을 적어두세요..."
                value={adjNote}
                onChange={(e) => setAdjNote(e.target.value)}
                className="w-full border border-zinc-200 dark:border-zinc-800 rounded-lg p-2 text-xs bg-zinc-50 dark:bg-zinc-950 dark:text-white outline-none min-h-[50px]"
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setShowAdjModal(false);
                  setEditingAdj(null);
                }}
                className="px-3.5 py-1.5 border border-zinc-200 text-zinc-650 hover:bg-zinc-50 dark:border-zinc-850 dark:text-zinc-300 rounded-lg font-bold cursor-pointer transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isActionLoading}
                className="px-4 py-1.5 bg-zinc-950 hover:bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 rounded-lg font-bold cursor-pointer transition-colors disabled:opacity-50"
              >
                {isActionLoading ? "저장 중..." : "항목 저장 (Save)"}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
