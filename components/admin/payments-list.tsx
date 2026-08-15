"use client";

import React, { useState } from "react";
import Link from "next/link";

interface PaymentListProps {
  initialPayments: any[];
}

const METHOD_LABELS: Record<string, string> = {
  WIRE: "해외송금 (WIRE)",
  ACH: "ACH",
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

export function PaymentsList({ initialPayments }: PaymentListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");

  const filteredPayments = initialPayments.filter((p) => {
    const supplierName = p.invoice?.supplier?.name || "";
    const pNumber = p.payment_number || "";
    const invNumber = p.invoice?.supplier_invoice_number || "";
    const apNumber = p.invoice?.internal_ap_number || "";

    const matchSearch =
      supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      apNumber.toLowerCase().includes(searchTerm.toLowerCase());

    const matchStatus = statusFilter === "" || p.status === statusFilter;
    const matchMethod = methodFilter === "" || p.payment_method === methodFilter;

    return matchSearch && matchStatus && matchMethod;
  });

  return (
    <div className="space-y-4 text-xs">
      {/* Filters bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-950 p-4 border border-zinc-200 dark:border-zinc-850 rounded-xl">
        <div className="flex flex-1 flex-wrap gap-2">
          <input
            type="text"
            placeholder="지급 번호, 공급사, 인보이스 번호 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-[200px] h-9 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 dark:text-white px-3 outline-none rounded-xl"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 dark:text-white px-3 outline-none rounded-xl"
          >
            <option value="">모든 지급 상태</option>
            <option value="DRAFT">초안 (Draft)</option>
            <option value="COMPLETED">지급완료 (Completed)</option>
            <option value="VOID">무효 (Void)</option>
          </select>
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="h-9 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 dark:text-white px-3 outline-none rounded-xl"
          >
            <option value="">모든 지급 방식</option>
            <option value="WIRE">WIRE</option>
            <option value="ACH">ACH</option>
            <option value="CHECK">CHECK</option>
            <option value="OTHER">OTHER</option>
          </select>
        </div>
      </div>

      {/* Table grid */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 text-zinc-500 font-bold dark:text-zinc-350">
                <th className="px-5 py-3 w-32">지급 번호</th>
                <th className="px-5 py-3">공급사 (Supplier)</th>
                <th className="px-5 py-3">대상 인보이스 (AP)</th>
                <th className="px-5 py-3 w-28">지급 일자</th>
                <th className="px-5 py-3 text-right w-36">지급 금액</th>
                <th className="px-5 py-3 w-32">지급 방식</th>
                <th className="px-5 py-3 w-28">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-zinc-400 font-medium">
                    등록된 공급사 지급 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-850/5 transition-colors">
                    {/* Payment Number */}
                    <td className="px-5 py-3.5 font-mono font-bold text-indigo-650 hover:underline">
                      <Link href={`/admin/finance/payments/${p.id}`}>
                        {p.payment_number}
                      </Link>
                    </td>

                    {/* Supplier */}
                    <td className="px-5 py-3.5 font-semibold text-zinc-900 dark:text-zinc-200">
                      {p.invoice?.supplier?.name || "-"}
                    </td>

                    {/* Invoice Ref */}
                    <td className="px-5 py-3.5">
                      {p.invoice ? (
                        <div className="space-y-0.5">
                          <Link href={`/admin/finance/invoices/${p.supplier_invoice_id}`} className="font-mono font-bold text-indigo-650 hover:underline">
                            {p.invoice.internal_ap_number}
                          </Link>
                          <span className="text-[10px] text-zinc-400 block">Inv: {p.invoice.supplier_invoice_number}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-350 italic">-</span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-5 py-3.5 font-mono text-zinc-650">
                      {p.payment_date}
                    </td>

                    {/* Amount */}
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-zinc-900 dark:text-white">
                      {p.currency} {Number(p.payment_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Method */}
                    <td className="px-5 py-3.5 font-semibold text-zinc-700 dark:text-zinc-300">
                      {METHOD_LABELS[p.payment_method]}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[8px] font-bold ${STATUS_COLORS[p.status]}`}>
                        {STATUS_LABELS[p.status]}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
