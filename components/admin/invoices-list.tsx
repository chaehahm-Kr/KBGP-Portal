"use client";

import React, { useState } from "react";
import Link from "next/link";

interface SupplierInvoiceItem {
  id: string;
  internal_ap_number: string;
  supplier_invoice_number: string;
  invoice_date: string;
  due_date: string;
  currency: string;
  invoice_total: number;
  amount_paid: number;
  balance_due: number;
  invoice_status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "VOID";
  payment_status: "UNPAID" | "PARTIALLY_PAID" | "PAID";
  supplier: { id: string; name: string };
  po: { id: string; po_number: string };
}

interface SupplierOption {
  id: string;
  name: string;
}

interface InvoicesListProps {
  initialInvoices: SupplierInvoiceItem[];
  suppliers: SupplierOption[];
}

const INVOICE_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-650 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  SUBMITTED: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50",
  APPROVED: "bg-emerald-50 text-emerald-750 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-250 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50",
  VOID: "bg-zinc-200 text-zinc-500 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-600 dark:border-zinc-800",
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "초안 (Draft)",
  SUBMITTED: "제출됨 (Submitted)",
  APPROVED: "승인됨 (Approved)",
  REJECTED: "반려됨 (Rejected)",
  VOID: "무효 (Void)",
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

export function InvoicesList({ initialInvoices, suppliers }: InvoicesListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("all");
  const [selectedInvoiceStatus, setSelectedInvoiceStatus] = useState("all");
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState("all");

  const filteredInvoices = initialInvoices.filter((inv) => {
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      !s ||
      inv.internal_ap_number.toLowerCase().includes(s) ||
      inv.supplier_invoice_number.toLowerCase().includes(s) ||
      inv.supplier.name.toLowerCase().includes(s) ||
      inv.po.po_number.toLowerCase().includes(s);

    const matchesSupplier =
      selectedSupplierId === "all" || inv.supplier.id === selectedSupplierId;

    const matchesInvoiceStatus =
      selectedInvoiceStatus === "all" || inv.invoice_status === selectedInvoiceStatus;

    const matchesPaymentStatus =
      selectedPaymentStatus === "all" || inv.payment_status === selectedPaymentStatus;

    return matchesSearch && matchesSupplier && matchesInvoiceStatus && matchesPaymentStatus;
  });

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-3 bg-zinc-50/50 p-4 border border-zinc-150 rounded-xl dark:bg-zinc-950/25 dark:border-zinc-850">
        {/* Search */}
        <div className="flex-1">
          <input
            type="text"
            placeholder="인보이스 번호, AP 번호, 공급사, PO 번호로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-9 rounded-xl border border-zinc-200 bg-white px-3 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2.5">
          {/* Supplier */}
          <select
            value={selectedSupplierId}
            onChange={(e) => setSelectedSupplierId(e.target.value)}
            className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
          >
            <option value="all">전체 공급사 (All Suppliers)</option>
            {suppliers.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>

          {/* Invoice Status */}
          <select
            value={selectedInvoiceStatus}
            onChange={(e) => setSelectedInvoiceStatus(e.target.value)}
            className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
          >
            <option value="all">전체 문서 상태 (All Invoice Status)</option>
            {Object.entries(INVOICE_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          {/* Payment Status */}
          <select
            value={selectedPaymentStatus}
            onChange={(e) => setSelectedPaymentStatus(e.target.value)}
            className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
          >
            <option value="all">전체 지급 상태 (All Payment Status)</option>
            {Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 text-zinc-500 font-bold border-b border-zinc-150 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-zinc-350">
                <th className="px-5 py-3">AP 번호 (AP No.)</th>
                <th className="px-5 py-3">인보이스 번호</th>
                <th className="px-5 py-3">공급사 (Supplier)</th>
                <th className="px-5 py-3">발주 번호 (PO No.)</th>
                <th className="px-5 py-3 text-right">인보이스 총액</th>
                <th className="px-5 py-3 text-right">잔여 채무액 (Balance Due)</th>
                <th className="px-5 py-3">발행일 (Invoice Date)</th>
                <th className="px-5 py-3">지급 기한 (Due Date)</th>
                <th className="px-5 py-3">인보이스 상태</th>
                <th className="px-5 py-3">지급 상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center text-zinc-400 font-semibold">
                    일치하는 공급사 인보이스/AP 내역이 존재하지 않습니다.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-850/5 transition-colors">
                    {/* AP Number */}
                    <td className="px-5 py-3.5 font-mono font-bold text-indigo-650 hover:underline">
                      <Link href={`/admin/purchasing/invoices/${inv.id}`}>
                        {inv.internal_ap_number}
                      </Link>
                    </td>

                    {/* Invoice Number */}
                    <td className="px-5 py-3.5 font-mono text-zinc-900 dark:text-white font-semibold">
                      {inv.supplier_invoice_number}
                    </td>

                    {/* Supplier */}
                    <td className="px-5 py-3.5 text-zinc-900 dark:text-zinc-200 font-semibold">
                      {inv.supplier.name}
                    </td>

                    {/* PO Number */}
                    <td className="px-5 py-3.5 font-mono font-bold text-indigo-650 hover:underline">
                      <Link href={`/admin/purchasing/${inv.po.id}`}>
                        {inv.po.po_number}
                      </Link>
                    </td>

                    {/* Total Amount */}
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-zinc-900 dark:text-white">
                      {inv.currency} {inv.invoice_total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Balance Due */}
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-zinc-900 dark:text-white">
                      {inv.currency} {inv.balance_due.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Invoice Date */}
                    <td className="px-5 py-3.5 font-mono text-zinc-550 dark:text-zinc-400">
                      {inv.invoice_date}
                    </td>

                    {/* Due Date */}
                    <td className="px-5 py-3.5 font-mono text-zinc-550 dark:text-zinc-400">
                      {inv.due_date}
                    </td>

                    {/* Invoice Status */}
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${INVOICE_STATUS_COLORS[inv.invoice_status]}`}>
                        {INVOICE_STATUS_LABELS[inv.invoice_status]}
                      </span>
                    </td>

                    {/* Payment Status */}
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${PAYMENT_STATUS_COLORS[inv.payment_status]}`}>
                        {PAYMENT_STATUS_LABELS[inv.payment_status]}
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
