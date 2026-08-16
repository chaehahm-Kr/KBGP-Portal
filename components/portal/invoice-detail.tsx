"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { submitPortalInvoice, deletePortalInvoiceDraft } from "@/lib/portal/actions";

interface InvoiceDetailProps {
  invoice: any;
  attachmentUrl: string | null;
}

export function InvoiceDetail({ invoice, attachmentUrl }: InvoiceDetailProps) {
  const router = useRouter();
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const formatCurrency = (val: number, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency
    }).format(val);
  };

  const handleSubmitInvoice = async () => {
    if (!window.confirm("정말로 이 인보이스를 제출하시겠습니까? 제출 후에는 인보이스 수정이 불가능합니다.")) {
      return;
    }

    setIsActionLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await submitPortalInvoice(invoice.id);
      setSuccessMessage("인보이스가 성공적으로 제출되었습니다.");
      setTimeout(() => {
        router.refresh();
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || "제출 실패");
      setIsActionLoading(false);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!window.confirm("정말로 이 인보이스 초안을 삭제하시겠습니까?")) {
      return;
    }

    setIsActionLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await deletePortalInvoiceDraft(invoice.id);
      setSuccessMessage("인보이스가 삭제되었습니다.");
      setTimeout(() => {
        router.push("/portal/finance");
        router.refresh();
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || "삭제 실패");
      setIsActionLoading(false);
    }
  };

  // Adjustments summary calculation
  const totalAdjustments = invoice.adjustments.reduce((sum: number, adj: any) => {
    if (adj.status !== "APPROVED") return sum;
    const val = adj.amount;
    return adj.direction === "CREDIT" ? sum - val : sum + val;
  }, 0);

  const finalPayable = invoice.invoiceTotal + totalAdjustments;

  return (
    <div className="space-y-6">
      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-250 text-rose-700 font-bold text-xs font-sans">
          ⚠️ {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-250 text-emerald-700 font-bold text-xs font-sans">
          ✅ {successMessage}
        </div>
      )}

      {/* Header Info Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-5 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 md:col-span-2 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-150 pb-2">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">인보이스 거래 내역</h2>
            <div className="flex items-center gap-1.5">
              {attachmentUrl && (
                <a
                  href={attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 text-[11px] font-bold border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 rounded text-zinc-650 transition-colors"
                >
                  📄 인보이스 파일 보기
                </a>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-zinc-400 font-bold block mb-1">인보이스 번호</span>
              <span className="font-mono text-zinc-900 dark:text-white font-bold">{invoice.supplierInvoiceNumber}</span>
            </div>
            <div>
              <span className="text-zinc-400 font-bold block mb-1">관리 번호 (AP No.)</span>
              <span className="font-mono text-zinc-700 dark:text-zinc-300 font-bold">{invoice.internalApNumber}</span>
            </div>
            <div>
              <span className="text-zinc-400 font-bold block mb-1">발행 일자</span>
              <span className="text-zinc-800 dark:text-zinc-350">{invoice.invoiceDate}</span>
            </div>
            <div>
              <span className="text-zinc-400 font-bold block mb-1">만기 일자</span>
              <span className="text-zinc-800 dark:text-zinc-355">{invoice.dueDate}</span>
            </div>
            <div>
              <span className="text-zinc-400 font-bold block mb-1">관련 발주서 (PO)</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-white">{invoice.poNumber}</span>
            </div>
            <div>
              <span className="text-zinc-400 font-bold block mb-1">결제 조건 / 인도 조건</span>
              <span className="text-zinc-700 dark:text-zinc-300">
                {invoice.paymentTerms || "-"} / {invoice.incoterms || "-"}
              </span>
            </div>
          </div>
        </div>

        {/* Status Card & Actions */}
        <div className="p-5 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 space-y-4 shadow-sm flex flex-col justify-between">
          <div className="space-y-3.5">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-150 pb-2">진행 상태</h2>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-400 font-bold">인보이스 상태:</span>
                <div>
                  {invoice.invoiceStatus === "DRAFT" && (
                    <span className="px-1.5 py-0.5 bg-zinc-100 text-zinc-700 rounded font-bold">임시저장 (Draft)</span>
                  )}
                  {invoice.invoiceStatus === "SUBMITTED" && (
                    <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-bold">제출 완료</span>
                  )}
                  {invoice.invoiceStatus === "APPROVED" && (
                    <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded font-bold">검토 승인됨</span>
                  )}
                  {invoice.invoiceStatus === "REJECTED" && (
                    <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded font-bold">반려됨</span>
                  )}
                  {invoice.invoiceStatus === "VOID" && (
                    <span className="px-1.5 py-0.5 bg-zinc-200 text-zinc-500 rounded font-bold">무효</span>
                  )}
                </div>
              </div>

              <div className="flex justify-between">
                <span className="text-zinc-400 font-bold">대금 정산 상태:</span>
                <div>
                  {invoice.settlementStatus === "OPEN" && (
                    <span className="px-1.5 py-0.5 bg-zinc-100 text-zinc-700 rounded font-bold">미정산</span>
                  )}
                  {invoice.settlementStatus === "PENDING_ADJUSTMENT" && (
                    <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded font-bold">조정 진행중</span>
                  )}
                  {invoice.settlementStatus === "SETTLED" && (
                    <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded font-bold">정산 완료</span>
                  )}
                </div>
              </div>

              <div className="flex justify-between">
                <span className="text-zinc-400 font-bold">지급 지급 상태:</span>
                <div>
                  {invoice.paymentStatus === "UNPAID" && (
                    <span className="px-1.5 py-0.5 bg-zinc-100 text-zinc-700 rounded font-bold">미지급</span>
                  )}
                  {invoice.paymentStatus === "PARTIALLY_PAID" && (
                    <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded font-bold">일부 지급됨</span>
                  )}
                  {invoice.paymentStatus === "PAID" && (
                    <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded font-bold">완납</span>
                  )}
                </div>
              </div>
            </div>

            {invoice.invoiceStatus === "REJECTED" && invoice.rejectionReason && (
              <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-sans">
                <strong>반려 사유:</strong> {invoice.rejectionReason}
              </div>
            )}
          </div>

          {invoice.invoiceStatus === "DRAFT" && (
            <div className="flex flex-col gap-2 pt-4">
              <button
                onClick={handleSubmitInvoice}
                disabled={isActionLoading}
                className="w-full py-2 bg-zinc-950 text-white hover:bg-zinc-900 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                인보이스 제출하기
              </button>
              <div className="flex gap-2">
                <Link
                  href={`/portal/finance/${invoice.id}/edit`}
                  className="flex-1 py-1.5 border border-zinc-300 hover:bg-zinc-50 rounded-lg text-xs font-bold text-center transition-colors"
                >
                  수정
                </Link>
                <button
                  onClick={handleDeleteInvoice}
                  disabled={isActionLoading}
                  className="flex-1 py-1.5 border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  삭제
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invoice Lines Context Table */}
      <div className="p-5 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 space-y-4 shadow-sm">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-white">품목별 수량 매칭 및 대조 정보 (Quantity Facts)</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 text-zinc-500 font-bold border-b border-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-800">
                <th className="px-3 py-2">제품명 / SKU</th>
                <th className="px-3 py-2 text-right">발주수량</th>
                <th className="px-3 py-2 text-right">확정수량</th>
                <th className="px-3 py-2 text-right">출고준비 완료</th>
                <th className="px-3 py-2 text-right">선적수량</th>
                <th className="px-3 py-2 text-right">정상입고 완료</th>
                <th className="px-3 py-2 text-right font-bold text-indigo-700 dark:text-indigo-400">송장청구 수량</th>
                <th className="px-3 py-2 text-right">FOB 단가</th>
                <th className="px-3 py-2 text-right">라인 금액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {invoice.lines.map((line: any) => (
                <tr key={line.id} className="hover:bg-zinc-50/10 dark:hover:bg-zinc-850/5">
                  <td className="px-3 py-3">
                    <div className="font-bold text-zinc-900 dark:text-white">{line.productName}</div>
                    <div className="text-[10px] font-mono text-zinc-400 mt-0.5">{line.sku}</div>
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-zinc-650">{line.orderedQty}</td>
                  <td className="px-3 py-3 text-right font-mono text-zinc-650">{line.confirmedQty}</td>
                  <td className="px-3 py-3 text-right font-mono text-zinc-650">{line.readyQty}</td>
                  <td className="px-3 py-3 text-right font-mono text-zinc-650">{line.shippedQty}</td>
                  <td className="px-3 py-3 text-right font-mono text-emerald-600 font-bold">{line.receivedQty}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-indigo-700 dark:text-indigo-400 text-sm">
                    {line.invoicedQty}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-zinc-700">
                    {formatCurrency(line.unitPrice, invoice.currency)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-zinc-900 dark:text-white">
                    {formatCurrency(line.lineAmount, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settlement Section (VIEW ONLY) */}
      <div className="p-5 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 space-y-4 shadow-sm">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-white">최종 정산 명세 (Settlement Details — View Only)</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Adjustments details */}
          <div className="space-y-2 text-xs">
            <span className="text-[11px] font-bold text-zinc-400 block mb-1">적용된 공제/추가 조정 항목</span>
            {invoice.adjustments.length === 0 ? (
              <p className="text-zinc-400 italic">적용된 조정 내역이 없습니다.</p>
            ) : (
              <div className="space-y-1.5">
                {invoice.adjustments.map((adj: any) => (
                  <div key={adj.id} className="flex items-center justify-between p-2 rounded bg-zinc-50 border border-zinc-150">
                    <div>
                      <div className="font-bold text-zinc-800">
                        {adj.type === "DAMAGE" && "💥 파손 조정 (Damage Credit)"}
                        {adj.type === "SHORTAGE" && "📉 수량 부족 공제 (Shortage Credit)"}
                        {adj.type === "PRICE_DIFFERENCE" && "💵 단가 조율 차액"}
                        {adj.type === "OTHER" && "⚙️ 기타 정산 조정"}
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">{adj.reason}</div>
                    </div>
                    <span className={`font-mono font-bold ${adj.direction === "CREDIT" ? "text-emerald-600" : "text-rose-600"}`}>
                      {adj.direction === "CREDIT" ? "-" : "+"}
                      {formatCurrency(adj.amount, invoice.currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Calculations */}
          <div className="p-4 rounded-xl bg-zinc-50/50 border border-zinc-200 flex flex-col justify-center space-y-2.5">
            <div className="flex justify-between text-xs text-zinc-500">
              <span>송장 기본 청구 금액 (Gross Total):</span>
              <span className="font-mono">{formatCurrency(invoice.invoiceTotal, invoice.currency)}</span>
            </div>
            <div className="flex justify-between text-xs text-zinc-500 border-b border-zinc-200 pb-2">
              <span>정산 조정액 (Approved Adjustments):</span>
              <span className={`font-mono font-bold ${totalAdjustments < 0 ? "text-emerald-600" : totalAdjustments > 0 ? "text-rose-600" : "text-zinc-600"}`}>
                {totalAdjustments > 0 ? "+" : ""}
                {formatCurrency(totalAdjustments, invoice.currency)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm font-extrabold text-zinc-900">
              <span>최종 정산 확정액 (Final Net Payable):</span>
              <span className="font-mono text-base text-zinc-950">
                {formatCurrency(finalPayable, invoice.currency)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment History Section (VIEW ONLY) */}
      <div className="p-5 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white">지급 및 이체 이력 (Payment History — View Only)</h2>

          {invoice.balanceDue > 0 && (
            <Link
              href="/portal/support"
              className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[10px] font-bold rounded"
            >
              정산 이견 문의하기 (Inquiry CTA)
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-zinc-400 font-bold border-b border-zinc-200">
                  <th className="py-2">이체 번호</th>
                  <th className="py-2">지급 일자</th>
                  <th className="py-2">수단</th>
                  <th className="py-2">지급처 은행</th>
                  <th className="py-2 text-right">금액</th>
                  <th className="py-2 text-center">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {invoice.payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-zinc-400">
                      실행된 지급 내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  invoice.payments.map((p: any) => (
                    <tr key={p.id}>
                      <td className="py-2.5 font-bold font-mono text-zinc-800 dark:text-white">{p.paymentNumber}</td>
                      <td className="py-2.5 font-mono">{p.paymentDate}</td>
                      <td className="py-2.5 font-bold text-zinc-650">{p.method}</td>
                      <td className="py-2.5 text-zinc-600">
                        <div>{p.bankName}</div>
                        {p.accountLast4 && <div className="text-[10px] text-zinc-400">계좌 **** {p.accountLast4}</div>}
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold">{formatCurrency(p.amount, p.currency)}</td>
                      <td className="py-2.5 text-center">
                        <span className="px-1.5 py-0.5 border rounded text-[9px] font-bold bg-green-50 text-green-700">
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 rounded-xl bg-zinc-50/50 border border-zinc-200 flex flex-col justify-center space-y-2">
            <div className="flex justify-between text-xs text-zinc-500">
              <span>최종 지급 의무액:</span>
              <span className="font-mono font-bold text-zinc-800">{formatCurrency(finalPayable, invoice.currency)}</span>
            </div>
            <div className="flex justify-between text-xs text-zinc-500">
              <span>총 누적 지급액:</span>
              <span className="font-mono text-emerald-600 font-bold">-{formatCurrency(invoice.amountPaid, invoice.currency)}</span>
            </div>
            <div className="flex justify-between items-center text-sm font-extrabold text-zinc-900 border-t border-zinc-200 pt-2">
              <span>남은 미지급 잔액:</span>
              <span className="font-mono text-base text-indigo-700">
                {formatCurrency(invoice.balanceDue, invoice.currency)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
