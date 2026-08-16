"use client";

import React, { useState } from "react";
import Link from "next/link";

interface FinanceClientProps {
  initialInvoices: any[];
  initialAdjustments: any[];
  initialPayments: any[];
}

export function FinanceClient({
  initialInvoices,
  initialAdjustments,
  initialPayments
}: FinanceClientProps) {
  const [activeTab, setActiveTab] = useState<"invoices" | "settlements" | "payments">("invoices");

  const formatCurrency = (val: number, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation & Creation Button */}
      <div className="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("invoices")}
            className={`text-sm font-bold pb-2 border-b-2 cursor-pointer transition-colors ${
              activeTab === "invoices"
                ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-650"
            }`}
          >
            인보이스 (Invoices)
          </button>
          <button
            onClick={() => setActiveTab("settlements")}
            className={`text-sm font-bold pb-2 border-b-2 cursor-pointer transition-colors ${
              activeTab === "settlements"
                ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-650"
            }`}
          >
            정산 (Settlements / Adjustments)
          </button>
          <button
            onClick={() => setActiveTab("payments")}
            className={`text-sm font-bold pb-2 border-b-2 cursor-pointer transition-colors ${
              activeTab === "payments"
                ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-650"
            }`}
          >
            지급 내역 (Payments)
          </button>
        </div>

        {activeTab === "invoices" && (
          <Link
            href="/portal/finance/new"
            className="px-3.5 py-1.5 bg-zinc-950 hover:bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 text-xs font-bold rounded-lg cursor-pointer transition-colors"
          >
            + 새 인보이스 발행 (New Invoice)
          </Link>
        )}
      </div>

      {/* TAB 1: INVOICES LIST */}
      {activeTab === "invoices" && (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 text-zinc-500 font-bold border-b border-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-zinc-400">
                <th className="px-4 py-3">인보이스 번호</th>
                <th className="px-4 py-3">발행 일자</th>
                <th className="px-4 py-3">관련 PO</th>
                <th className="px-4 py-3 text-right">송장 총액</th>
                <th className="px-4 py-3 text-center">결제 상태</th>
                <th className="px-4 py-3 text-center">정산 상태</th>
                <th className="px-4 py-3 text-right">지급 금액</th>
                <th className="px-4 py-3 text-right">잔액</th>
                <th className="px-4 py-3 text-right">상세 정보</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {initialInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-zinc-400">
                    등록된 청구 인보이스 내역이 존재하지 않습니다.
                  </td>
                </tr>
              ) : (
                initialInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-850/5">
                    <td className="px-4 py-3.5 font-bold font-mono text-zinc-900 dark:text-white">
                      {inv.supplierInvoiceNumber}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-700 dark:text-zinc-300">{inv.invoiceDate}</td>
                    <td className="px-4 py-3.5 text-zinc-650 dark:text-zinc-400 font-mono">{inv.poNumber}</td>
                    <td className="px-4 py-3.5 text-right font-bold text-zinc-900 dark:text-white">
                      {formatCurrency(inv.invoiceTotal, inv.currency)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {inv.invoiceStatus === "DRAFT" && (
                        <span className="px-1.5 py-0.5 bg-zinc-100 text-zinc-700 rounded font-bold text-[10px]">임시저장</span>
                      )}
                      {inv.invoiceStatus === "SUBMITTED" && (
                        <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-bold text-[10px]">제출됨</span>
                      )}
                      {inv.invoiceStatus === "APPROVED" && (
                        <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded font-bold text-[10px]">승인됨</span>
                      )}
                      {inv.invoiceStatus === "REJECTED" && (
                        <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded font-bold text-[10px]">반려됨</span>
                      )}
                      {inv.invoiceStatus === "VOID" && (
                        <span className="px-1.5 py-0.5 bg-zinc-200 text-zinc-500 rounded font-bold text-[10px]">무효</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {inv.settlementStatus === "OPEN" && (
                        <span className="px-1.5 py-0.5 bg-zinc-100 text-zinc-700 rounded font-bold text-[10px]">미정산</span>
                      )}
                      {inv.settlementStatus === "PENDING_ADJUSTMENT" && (
                        <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded font-bold text-[10px]">조정 진행중</span>
                      )}
                      {inv.settlementStatus === "SETTLED" && (
                        <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded font-bold text-[10px]">정산 완료</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right text-zinc-700 dark:text-zinc-350">
                      {formatCurrency(inv.amountPaid, inv.currency)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-zinc-900 dark:text-white">
                      {formatCurrency(inv.balanceDue, inv.currency)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href={`/portal/finance/${inv.id}`}
                        className="text-indigo-600 font-bold hover:underline"
                      >
                        상세 보기 →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: SETTLEMENTS (ADJUSTMENTS) */}
      {activeTab === "settlements" && (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 text-zinc-500 font-bold border-b border-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-zinc-400">
                <th className="px-4 py-3">인보이스 번호</th>
                <th className="px-4 py-3">조정 타입</th>
                <th className="px-4 py-3">구분</th>
                <th className="px-4 py-3">수량</th>
                <th className="px-4 py-3 text-right">조정 금액</th>
                <th className="px-4 py-3">사유</th>
                <th className="px-4 py-3 text-center">상태</th>
                <th className="px-4 py-3">발생 일자</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {initialAdjustments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-zinc-400">
                    진행 중이거나 승인된 정산 조정 내역이 존재하지 않습니다.
                  </td>
                </tr>
              ) : (
                initialAdjustments.map((adj) => (
                  <tr key={adj.id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-850/5">
                    <td className="px-4 py-3.5 font-bold font-mono text-zinc-900 dark:text-white">
                      {adj.invoiceNumber}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-700 dark:text-zinc-300">
                      {adj.type === "SHORTAGE" && "수량 부족 (Shortage)"}
                      {adj.type === "DAMAGE" && "파손 (Damage)"}
                      {adj.type === "PRICE_DIFFERENCE" && "단가 차액"}
                      {adj.type === "OTHER" && "기타"}
                    </td>
                    <td className="px-4 py-3.5 font-bold">
                      {adj.direction === "CREDIT" ? (
                        <span className="text-emerald-600">- 감액 (Credit)</span>
                      ) : (
                        <span className="text-rose-600">+ 증액 (Charge)</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-650 dark:text-zinc-400 font-mono">
                      {adj.qty !== null ? `${adj.qty} 개` : "-"}
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-zinc-905 dark:text-white">
                      {formatCurrency(adj.amount, adj.currency)}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-750 dark:text-zinc-300">{adj.reason}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="px-1.5 py-0.5 border rounded text-[10px] font-bold bg-zinc-100 text-zinc-650">
                        {adj.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-500 font-mono">
                      {new Date(adj.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: PAYMENTS LIST */}
      {activeTab === "payments" && (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 text-zinc-500 font-bold border-b border-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-zinc-400">
                <th className="px-4 py-3">지급 번호</th>
                <th className="px-4 py-3">인보이스 번호</th>
                <th className="px-4 py-3">지급 일자</th>
                <th className="px-4 py-3 text-right">지급 금액</th>
                <th className="px-4 py-3">지급 방법</th>
                <th className="px-4 py-3">송금 은행</th>
                <th className="px-4 py-3">계좌 (마스킹)</th>
                <th className="px-4 py-3 text-center">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {initialPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-zinc-400">
                    지급 내역이 존재하지 않습니다.
                  </td>
                </tr>
              ) : (
                initialPayments.map((pmt) => (
                  <tr key={pmt.id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-850/5">
                    <td className="px-4 py-3.5 font-bold font-mono text-zinc-900 dark:text-white">
                      {pmt.paymentNumber}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-zinc-700 dark:text-zinc-350">
                      {pmt.invoiceNumber}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-700 dark:text-zinc-300 font-mono">
                      {pmt.paymentDate}
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-zinc-900 dark:text-white">
                      {formatCurrency(pmt.amount, pmt.currency)}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-650 dark:text-zinc-450 font-bold">
                      {pmt.method}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-650 dark:text-zinc-450">
                      {pmt.bankName || "-"}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-500 font-mono">
                      {pmt.accountLast4 ? `**** ${pmt.accountLast4}` : "-"}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="px-1.5 py-0.5 border rounded text-[10px] font-bold bg-green-50 text-green-700">
                        {pmt.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
