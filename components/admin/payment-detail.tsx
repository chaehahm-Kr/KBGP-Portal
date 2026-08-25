"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { transitionPaymentStatus, deleteDraftPayment } from "@/lib/supplier-payment/actions";
import { getInvoiceAttachmentUrl } from "@/lib/supplier-invoice/actions";

interface PaymentDetailProps {
  payment: any;
}

const METHOD_LABELS: Record<string, string> = {
  WIRE: "해외송금 (WIRE)",
  ACH: "ACH (계좌이체)",
  CHECK: "수표 (CHECK)",
  OTHER: "기타 (OTHER)",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-650 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
  VOID: "bg-zinc-200 text-zinc-500 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-600 dark:border-zinc-800",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "초안 (Draft)",
  COMPLETED: "지급완료 (Completed)",
  VOID: "무효 (Void)",
};

export function PaymentDetail({ payment }: PaymentDetailProps) {
  const router = useRouter();

  const [isActionLoading, setIsActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    if (payment.attachment_path) {
      const getFileUrl = async () => {
        try {
          const url = await getInvoiceAttachmentUrl(payment.attachment_path);
          setDownloadUrl(url);
        } catch (err) {
          console.error("Failed to load attachment link:", err);
        }
      };
      getFileUrl();
    }
  }, [payment.attachment_path]);

  const handleStatusTransition = async (status: "COMPLETED" | "VOID") => {
    const confirmMsg =
      status === "COMPLETED"
        ? "이 지급 거래를 지급 완료(COMPLETED)로 확정하시겠습니까? 확정 시 인보이스 대금 차감액에 반영됩니다."
        : "이 지급 거래를 무효화(VOID) 처리하시겠습니까? 무효 처리된 거래는 인보이스 지급 완료액 계산에서 즉시 제외됩니다.";

    if (!confirm(confirmMsg)) return;

    setIsActionLoading(true);
    setErrorMessage("");
    try {
      await transitionPaymentStatus(payment.id, status);
      setSuccessMessage("지급 상태가 업데이트되었습니다.");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "상태 업데이트 도중 오류가 발생했습니다.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("이 초안(DRAFT) 지급 내역을 삭제하시겠습니까? 삭제 시 데이터는 물리적으로 제거됩니다.")) return;

    setIsActionLoading(true);
    setErrorMessage("");
    try {
      await deleteDraftPayment(payment.id);
      router.push("/admin/finance/payments");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "삭제 도중 오류가 발생했습니다.");
      setIsActionLoading(false);
    }
  };

  // Calculations for Invoice Summary Card (Section 25)
  const invoice = payment.invoice || {};
  const adjustments = invoice.adjustments || [];
  const originalInvoiceTotal = Number(invoice.invoice_total || 0);

  const approvedCredits = adjustments
    .filter((a: any) => a.status === "APPROVED" && a.adjustment_direction === "CREDIT")
    .reduce((sum: number, a: any) => sum + Number(a.adjustment_amount), 0);

  const approvedCharges = adjustments
    .filter((a: any) => a.status === "APPROVED" && a.adjustment_direction === "CHARGE")
    .reduce((sum: number, a: any) => sum + Number(a.adjustment_amount), 0);

  const finalPayable = originalInvoiceTotal + approvedCharges - approvedCredits;

  // Previously Paid represents completed payments recorded PRIOR to this payment
  // (i.e. invoice.amount_paid minus this payment if this payment is completed)
  const isCompleted = payment.status === "COMPLETED";
  const previouslyPaid = Number(invoice.amount_paid || 0) - (isCompleted ? Number(payment.payment_amount) : 0);
  const thisPayment = Number(payment.payment_amount);

  const totalPaidAfterThis = previouslyPaid + thisPayment;
  const remainingBalance = Math.max(Number((finalPayable - totalPaidAfterThis).toFixed(2)), 0);
  const overpayment = Math.max(Number((totalPaidAfterThis - finalPayable).toFixed(2)), 0);

  return (
    <div className="space-y-6 text-xs">
      
      {/* Breadcrumbs */}
      <div className="flex flex-col gap-2">
        <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider">
          Admin / Finance / Payments
        </div>
        <div>
          <Link
            href="/admin/finance/payments"
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
          >
            ← 지급 내역 목록으로 돌아가기
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
        <div className="flex items-center gap-2">
          <span className="font-bold text-zinc-400">지급 거래 상태</span>
          <span className={`inline-flex items-center rounded px-2.5 py-0.5 border ${STATUS_COLORS[payment.status]}`}>
            {STATUS_LABELS[payment.status]}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* DRAFT */}
          {payment.status === "DRAFT" && (
            <>
              <Link
                href={`/admin/finance/payments/${payment.id}/edit`}
                className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 font-bold rounded-xl cursor-pointer transition-colors"
              >
                수정 (Edit)
              </Link>
              <button
                onClick={() => handleStatusTransition("COMPLETED")}
                disabled={isActionLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer transition-colors disabled:opacity-50"
              >
                📥 지급 확정 (Complete)
              </button>
              <button
                onClick={handleDelete}
                disabled={isActionLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl cursor-pointer transition-colors disabled:opacity-50"
              >
                삭제 (Delete)
              </button>
            </>
          )}

          {/* COMPLETED */}
          {payment.status === "COMPLETED" && (
            <button
              onClick={() => handleStatusTransition("VOID")}
              disabled={isActionLoading}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl cursor-pointer transition-colors disabled:opacity-50"
            >
              취소 및 무효화 (Void Reversal)
            </button>
          )}
        </div>
      </div>

      {/* Grid details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Columns: Transaction Details & Remittance info */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Transaction details card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <h3 className="text-xs font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-150 pb-2 dark:border-zinc-800">
              지급 거래 내역 상세 (Payment Transaction)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-zinc-400 block mb-0.5">지급 번호</span>
                <span className="font-mono text-sm font-bold text-zinc-900 dark:text-white">{payment.payment_number}</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block mb-0.5">실제 지급액</span>
                <span className="font-mono text-sm font-bold text-zinc-900 dark:text-white">
                  {payment.currency} {Number(payment.payment_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-zinc-100 pt-3 dark:border-zinc-850">
              <div>
                <span className="text-[10px] text-zinc-400 block mb-0.5">지급 일자</span>
                <span className="font-mono font-bold text-zinc-850 dark:text-zinc-200">{payment.payment_date}</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block mb-0.5">지급 수단</span>
                <span className="font-bold text-zinc-850 dark:text-zinc-200">{METHOD_LABELS[payment.payment_method]}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-zinc-100 pt-3 dark:border-zinc-850">
              <div>
                <span className="text-[10px] text-zinc-400 block mb-0.5">은행 거래 참조번호 (Bank Ref)</span>
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-300">{payment.bank_reference || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block mb-0.5">수취 참조번호 (Remittance Ref)</span>
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-300">{payment.remittance_reference || "-"}</span>
              </div>
            </div>

            {/* Remittance Destination details */}
            <div className="border-t border-zinc-100 pt-3 dark:border-zinc-850 space-y-2">
              <span className="text-[10px] text-zinc-400 block">당시 지급 은행 및 예금주 정보 (Remittance Destination Snapshot)</span>
              {payment.remittance_bank_name ? (
                <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-850 p-3 rounded-lg space-y-1.5 font-medium">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[9px] text-zinc-400 block">수취 은행</span>
                      <span>{payment.remittance_bank_name}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-400 block">예금주</span>
                      <span>{payment.remittance_beneficiary_name}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-400 block">계좌 번호</span>
                      <span className="font-mono">**** {payment.remittance_account_last4}</span>
                    </div>
                  </div>
                  {payment.remittance_swift_bic_masked && (
                    <div className="text-[9px] text-zinc-400 font-mono mt-1">
                      SWIFT Code: {payment.remittance_swift_bic_masked}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-zinc-400 italic">지급 시 등록된 Remittance 마스터 정보가 없었습니다.</span>
              )}
            </div>

            {/* Wire confirmation attachment link */}
            <div className="border-t border-zinc-100 pt-3 dark:border-zinc-850">
              <span className="text-[10px] text-zinc-400 block mb-1">송금확인서 / 증빙 첨부</span>
              {downloadUrl ? (
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 font-bold rounded-xl transition-colors"
                >
                  📎 송금 증빙 파일 보기
                </a>
              ) : (
                <span className="text-zinc-400 italic">등록된 증빙 파일이 없습니다.</span>
              )}
            </div>
          </div>

          {/* Audit trail details */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-2">
            <h4 className="font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wide">처리 감사 정보 (Audit Trail)</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 border-t border-zinc-100 pt-3 dark:border-zinc-850">
              <div>
                <span className="text-[10px] text-zinc-400 block mb-0.5">최초 기안자</span>
                <span className="font-bold">{payment.creator?.full_name || "System"}</span>
                <span className="text-[9px] text-zinc-400 font-mono block mt-0.5">{new Date(payment.created_at).toLocaleString()}</span>
              </div>
              {payment.completed_at && (
                <div>
                  <span className="text-[10px] text-zinc-400 block mb-0.5">최종 지급 승인자</span>
                  <span className="font-bold text-emerald-600">{payment.completer?.full_name || "-"}</span>
                  <span className="text-[9px] text-zinc-400 font-mono block mt-0.5">{new Date(payment.completed_at).toLocaleString()}</span>
                </div>
              )}
              {payment.voided_at && (
                <div>
                  <span className="text-[10px] text-zinc-400 block mb-0.5">지급 취소(무효)자</span>
                  <span className="font-bold text-rose-500">{payment.voider?.full_name || "-"}</span>
                  <span className="text-[9px] text-zinc-400 font-mono block mt-0.5">{new Date(payment.voided_at).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-2">
            <h4 className="font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wide">지급 내부 메모</h4>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium">
              {payment.internal_note || <span className="text-zinc-350 italic font-normal">등록된 메모가 없습니다.</span>}
            </p>
          </div>
        </div>

        {/* Right Column: Invoice Details Summary & Traceability Links */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Invoice Summary Card (Section 25) */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3.5">
            <h3 className="text-xs font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-150 pb-2 dark:border-zinc-800">
              대상 인보이스 지급 현황 (Invoice Summary)
            </h3>

            <div className="space-y-3.5">
              <div>
                <span className="text-[10px] text-zinc-400 block mb-0.5">Original Invoice Total</span>
                <span className="font-mono font-bold text-zinc-850 dark:text-zinc-200">
                  {payment.currency} {originalInvoiceTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-zinc-100 pt-3 dark:border-zinc-850">
                <div>
                  <span className="text-[10px] text-rose-500 block mb-0.5">Approved Credits</span>
                  <span className="font-mono font-bold text-rose-600">
                    -{payment.currency} {approvedCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-blue-500 block mb-0.5">Approved Charges</span>
                  <span className="font-mono font-bold text-blue-600">
                    +{payment.currency} {approvedCharges.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              <div className="border-t border-zinc-100 pt-3 dark:border-zinc-850">
                <span className="text-[10px] text-emerald-650 block mb-0.5 font-bold">최종 미지급 채무 (Final Payable)</span>
                <span className="text-sm font-mono font-bold text-emerald-700 dark:text-emerald-400">
                  {payment.currency} {finalPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="border-t border-zinc-150 pt-3 dark:border-zinc-850 space-y-2 bg-zinc-50 dark:bg-zinc-950 p-3 rounded-lg">
                <div>
                  <span className="text-[10px] text-zinc-400 block">이전 지급액 (Previously Paid)</span>
                  <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">
                    {payment.currency} {previouslyPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-indigo-650 block font-bold">현재 지급액 (This Payment)</span>
                  <span className="font-mono font-bold text-indigo-650">
                    {payment.currency} {thisPayment.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block">지급 후 남은 잔액 (Remaining Balance)</span>
                  <span className="font-mono font-bold text-zinc-900 dark:text-white">
                    {payment.currency} {remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {overpayment > 0 && (
                  <div>
                    <span className="text-[10px] text-rose-500 block font-bold">지급 후 과지급액 (Overpayment)</span>
                    <span className="font-mono font-bold text-rose-600">
                      {payment.currency} {overpayment.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Traceability chain card (Section 27) */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
            <h3 className="text-xs font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-150 pb-2 dark:border-zinc-800">
              업스트림 거래 추적 (Traceability)
            </h3>

            <div className="space-y-3.5">
              <div>
                <span className="text-[10px] text-zinc-400 block mb-0.5">공급업체 (Supplier)</span>
                <Link href={`/admin/companies/${invoice.supplier?.id}`} className="font-bold text-indigo-650 hover:underline">
                  {invoice.supplier?.name}
                </Link>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block mb-0.5">지급 대상 인보이스 (AP)</span>
                <Link href={`/admin/finance/invoices/${invoice.id}`} className="font-mono font-bold text-indigo-650 hover:underline">
                  {invoice.internal_ap_number}
                </Link>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block mb-0.5">연계 발주서 (PO)</span>
                <Link href={`/admin/purchasing/${invoice.po?.id}`} className="font-mono font-bold text-indigo-650 hover:underline">
                  {invoice.po?.po_number}
                </Link>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
