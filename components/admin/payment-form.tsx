"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createPayment, updatePayment } from "@/lib/supplier-payment/actions";
import { uploadInvoiceAttachment } from "@/lib/supplier-invoice/actions";

interface EligibleInvoice {
  id: string;
  internal_ap_number: string;
  supplier_invoice_number: string;
  currency: string;
  invoice_total: number;
  amount_paid: number;
  balance_due: number;
  supplier_name: string;
  final_payable: number;
}

interface PaymentFormProps {
  isEdit?: boolean;
  payment?: any;
  eligibleInvoices: EligibleInvoice[];
  preselectedInvoiceId?: string | null;
}

export function PaymentForm({ isEdit = false, payment, eligibleInvoices, preselectedInvoiceId }: PaymentFormProps) {
  const router = useRouter();

  const [selectedInvoiceId, setSelectedInvoiceId] = useState(
    isEdit ? payment.supplier_invoice_id : (preselectedInvoiceId || "")
  );
  const [paymentDate, setPaymentDate] = useState(
    isEdit ? payment.payment_date : new Date().toISOString().split("T")[0]
  );
  const [paymentAmount, setPaymentAmount] = useState<number>(
    isEdit ? Number(payment.payment_amount) : 0
  );
  const [paymentMethod, setPaymentMethod] = useState<"WIRE" | "ACH" | "CHECK" | "OTHER">(
    isEdit ? payment.payment_method : "WIRE"
  );
  const [bankReference, setBankReference] = useState(isEdit ? payment.bank_reference || "" : "");
  const [remittanceReference, setRemittanceReference] = useState(
    isEdit ? payment.remittance_reference || "" : ""
  );
  const [internalNote, setInternalNote] = useState(isEdit ? payment.internal_note || "" : "");
  const [attachmentPath, setAttachmentPath] = useState(isEdit ? payment.attachment_path || "" : "");

  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const selectedInvoice = eligibleInvoices.find((inv) => inv.id === selectedInvoiceId);

  // Auto-fill currency and remaining balance when invoice changes
  useEffect(() => {
    if (selectedInvoice && !isEdit) {
      setPaymentAmount(Number(selectedInvoice.balance_due));
    }
  }, [selectedInvoiceId, eligibleInvoices]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMessage("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await uploadInvoiceAttachment(formData);
      if (res.path) {
        setAttachmentPath(res.path);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "파일 업로드에 실패했습니다.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceId) {
      alert("지급 대상 인보이스를 선택하세요.");
      return;
    }
    if (paymentAmount <= 0) {
      alert("지급 금액은 0보다 커야 합니다.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    const payload = {
      supplier_invoice_id: selectedInvoiceId,
      payment_date: paymentDate,
      payment_amount: paymentAmount,
      currency: selectedInvoice ? selectedInvoice.currency : "USD",
      payment_method: paymentMethod,
      bank_reference: bankReference || null,
      remittance_reference: remittanceReference || null,
      internal_note: internalNote || null,
      attachment_path: attachmentPath || null,
    };

    try {
      if (isEdit) {
        await updatePayment(payment.id, payload);
        router.push(`/admin/finance/payments/${payment.id}`);
      } else {
        const created = await createPayment(payload);
        router.push(`/admin/finance/payments/${created.id}`);
      }
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "지급 내역 저장에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Math variables for summary preview
  const finalPayable = selectedInvoice ? selectedInvoice.final_payable : 0;
  const previouslyPaid = selectedInvoice ? selectedInvoice.amount_paid : 0;
  const currency = selectedInvoice ? selectedInvoice.currency : "USD";
  
  // Balance due calculation (excluding current payment in new, or previous payments)
  const calculatedRemaining = Number((finalPayable - previouslyPaid - paymentAmount).toFixed(2));
  const isOverpayment = previouslyPaid + paymentAmount > finalPayable;
  const overpaymentAmount = Math.max(Number((previouslyPaid + paymentAmount - finalPayable).toFixed(2)), 0);

  return (
    <div className="max-w-2xl text-xs space-y-6">
      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-250 text-rose-600 font-bold dark:bg-rose-950/10 dark:border-rose-900/50 dark:text-rose-400">
          ⚠️ {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm space-y-5">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 pb-3 dark:border-zinc-800">
          {isEdit ? `지급 거래 정보 수정 (Edit Payment #${payment.payment_number})` : "신규 지급 등록 (Record Supplier Payment)"}
        </h2>

        {/* Invoice Dropdown selection */}
        <div>
          <label className="block text-[10px] font-bold text-zinc-400 mb-1">지급 대상 공급사 인보이스 (AP 번호) *</label>
          {isEdit ? (
            <div className="h-9 border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 flex items-center px-3 rounded-xl font-mono font-bold dark:text-white">
              {payment.invoice?.internal_ap_number} (Invoice: {payment.invoice?.supplier_invoice_number}) - {payment.invoice?.supplier?.name}
            </div>
          ) : (
            <select
              value={selectedInvoiceId}
              onChange={(e) => setSelectedInvoiceId(e.target.value)}
              className="w-full h-9 border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white px-3 outline-none rounded-xl font-semibold"
              required
            >
              <option value="">지급 대상을 선택하세요...</option>
              {eligibleInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.internal_ap_number} (Inv: {inv.supplier_invoice_number}) — {inv.supplier_name} [잔액: {inv.currency} {inv.balance_due.toLocaleString()}]
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Financial Flow summary details card */}
        {selectedInvoice && (
          <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl space-y-3">
            <h4 className="font-bold text-zinc-850 dark:text-zinc-300">정산 및 지급 실시간 계산 현황</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-zinc-400 block mb-0.5">최종 지급 금액 (Final Payable)</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-white">
                  {currency} {finalPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block mb-0.5">기지급 누계액 (Previously Paid)</span>
                <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">
                  {currency} {previouslyPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-zinc-150 pt-2.5 dark:border-zinc-850">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 block mb-0.5">이번 지급액 (This Payment)</span>
                <span className="font-mono font-bold text-indigo-650">
                  {currency} {paymentAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 block mb-0.5">지급 후 남은 잔액 (Remaining)</span>
                <span className={`font-mono font-bold ${calculatedRemaining < 0 ? "text-rose-600" : "text-emerald-700"}`}>
                  {currency} {calculatedRemaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {isOverpayment && (
              <div className="p-2.5 bg-rose-50 border border-rose-150 text-[10px] text-rose-700 rounded-lg font-bold">
                ⚠️ 주의: 청구 잔액을 초과하여 {currency} {overpaymentAmount.toLocaleString()}만큼 과지급 상태가 예상됩니다. 송금 전액이 맞는지 검토하세요.
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {/* Payment Date */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 mb-1">실제 지급 일자 *</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full h-9 border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white px-3 outline-none rounded-xl font-mono"
              required
            />
          </div>

          {/* Payment Amount input */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 mb-1">지급 금액 (Amount) *</label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={paymentAmount || ""}
                onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                className="w-full h-9 border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-955 dark:text-white pl-3 pr-12 outline-none rounded-xl font-mono font-bold"
                required
              />
              <span className="absolute right-3 top-2.5 text-[10px] font-bold text-zinc-400">{currency}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Payment Method */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 mb-1">지급 방식 (Method) *</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as any)}
              className="w-full h-9 border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white px-3 outline-none rounded-xl font-bold"
              required
            >
              <option value="WIRE">WIRE (해외송금)</option>
              <option value="ACH">ACH (계좌이체)</option>
              <option value="CHECK">CHECK (수표)</option>
              <option value="OTHER">OTHER (기타)</option>
            </select>
          </div>

          {/* File Attachment */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 mb-1">지급 증빙 첨부 (Wire Receipt / Bank confirmation)</label>
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={handleFileUpload}
              className="w-full text-xs text-zinc-550 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-bold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 cursor-pointer"
            />
            {isUploading && <span className="text-[10px] text-zinc-400 block mt-1">파일 업로드 중...</span>}
            {attachmentPath && (
              <span className="text-[10px] text-emerald-650 font-bold block mt-1">
                ✓ 파일 업로드 완료 (경로: {attachmentPath.split("/").pop()})
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Bank Reference */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 mb-1">은행 거래 참조번호 (Bank Reference / Transaction ID)</label>
            <input
              type="text"
              placeholder="예: TXN1039485"
              value={bankReference}
              onChange={(e) => setBankReference(e.target.value)}
              className="w-full h-9 border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-955 dark:text-white px-3 outline-none rounded-xl font-mono"
            />
          </div>

          {/* Remittance Reference */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 mb-1">수취 참조번호 (Remittance Reference / Memo)</label>
            <input
              type="text"
              placeholder="예: CM-2026-102 Payment"
              value={remittanceReference}
              onChange={(e) => setRemittanceReference(e.target.value)}
              className="w-full h-9 border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-955 dark:text-white px-3 outline-none rounded-xl font-mono"
            />
          </div>
        </div>

        {/* Note */}
        <div>
          <label className="block text-[10px] font-bold text-zinc-400 mb-1">지급 내부 비고 (Note)</label>
          <textarea
            placeholder="지급 관련 특이사항이나 은행 세부 처리에 대해 기록하세요..."
            value={internalNote}
            onChange={(e) => setInternalNote(e.target.value)}
            className="w-full border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 outline-none bg-zinc-50 dark:bg-zinc-950 dark:text-white min-h-[70px]"
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <Link
            href={isEdit ? `/admin/finance/payments/${payment.id}` : "/admin/finance/payments"}
            className="px-4 py-2 border border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-350 font-bold rounded-xl cursor-pointer transition-colors"
          >
            취소
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || isUploading}
            className="px-4 py-2 bg-zinc-950 hover:bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 font-bold rounded-xl cursor-pointer transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "저장 중..." : "지급 내역 저장 (Save)"}
          </button>
        </div>
      </form>
    </div>
  );
}
