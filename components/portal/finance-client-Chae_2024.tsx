"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";

interface FinanceClientProps {
  initialInvoices: any[];
  initialAdjustments: any[];
  initialPayments: any[];
}

export function getCanonicalPaymentStatus(inv: {
  invoiceTotal: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus?: string;
}): "UNPAID" | "PARTIALLY_PAID" | "PAID" {
  const paid = Number(inv.amountPaid) || 0;
  const balance = Number(inv.balanceDue) || 0;
  const total = Number(inv.invoiceTotal) || 0;

  if (balance <= 0 && total > 0) return "PAID";
  if (paid > 0 && balance > 0) return "PARTIALLY_PAID";
  return "UNPAID";
}

export function FinanceClient({
  initialInvoices,
  initialAdjustments,
  initialPayments
}: FinanceClientProps) {
  const [activeTab, setActiveTab] = useState<"invoices" | "settlements" | "payments">("invoices");

  // Filters State for Invoices Tab
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [documentStatusFilter, setDocumentStatusFilter] = useState("all");

  const formatCurrency = (val: number, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency
    }).format(val);
  };

  // Helper for Date Presets
  const handlePresetChange = (preset: "ALL" | "THIS_MONTH" | "LAST_30_DAYS") => {
    if (preset === "ALL") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "THIS_MONTH") {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const today = now.toISOString().split("T")[0];
      setStartDate(firstDay);
      setEndDate(today);
    } else if (preset === "LAST_30_DAYS") {
      const now = new Date();
      const past30 = new Date(now.setDate(now.getDate() - 30)).toISOString().split("T")[0];
      const today = new Date().toISOString().split("T")[0];
      setStartDate(past30);
      setEndDate(today);
    }
  };

  // Filter Invoices
  const filteredInvoices = useMemo(() => {
    return initialInvoices.filter((inv) => {
      // 1. Keyword search (Invoice No, PO No, AP No)
      const s = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !s ||
        (inv.supplierInvoiceNumber && inv.supplierInvoiceNumber.toLowerCase().includes(s)) ||
        (inv.poNumber && inv.poNumber.toLowerCase().includes(s)) ||
        (inv.internalApNumber && inv.internalApNumber.toLowerCase().includes(s));

      // 2. Date range search (Invoice Date)
      const matchesStart = !startDate || (inv.invoiceDate && inv.invoiceDate >= startDate);
      const matchesEnd = !endDate || (inv.invoiceDate && inv.invoiceDate <= endDate);

      // 3. Payment Status Filter
      const canonicalPaymentStatus = getCanonicalPaymentStatus(inv);
      const matchesPaymentStatus =
        paymentStatusFilter === "all" || canonicalPaymentStatus === paymentStatusFilter;

      // 4. Document Status Filter
      const matchesDocumentStatus =
        documentStatusFilter === "all" || inv.invoiceStatus === documentStatusFilter;

      return matchesSearch && matchesStart && matchesEnd && matchesPaymentStatus && matchesDocumentStatus;
    });
  }, [initialInvoices, searchTerm, startDate, endDate, paymentStatusFilter, documentStatusFilter]);

  // Summary Metrics (Dynamically computed from filtered invoices)
  const totalInvoiceAmount = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => sum + (Number(inv.invoiceTotal) || 0), 0);
  }, [filteredInvoices]);

  const totalPaidAmount = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => sum + (Number(inv.amountPaid) || 0), 0);
  }, [filteredInvoices]);

  const totalBalanceDue = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => sum + (Number(inv.balanceDue) || 0), 0);
  }, [filteredInvoices]);

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
                : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            인보이스 (Invoices)
          </button>
          <button
            onClick={() => setActiveTab("settlements")}
            className={`text-sm font-bold pb-2 border-b-2 cursor-pointer transition-colors ${
              activeTab === "settlements"
                ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
                : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            정산 (Settlements / Adjustments)
          </button>
          <button
            onClick={() => setActiveTab("payments")}
            className={`text-sm font-bold pb-2 border-b-2 cursor-pointer transition-colors ${
              activeTab === "payments"
                ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
                : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            지급 내역 (Payments)
          </button>
        </div>

        {activeTab === "invoices" && (
          <Link
            href="/portal/finance/new"
            className="px-3.5 py-1.5 bg-zinc-950 hover:bg-zinc-900 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-950 text-xs font-bold rounded-lg cursor-pointer transition-colors"
          >
            + 새 인보이스 발행 (New Invoice)
          </Link>
        )}
      </div>

      {/* TAB 1: INVOICES LIST */}
      {activeTab === "invoices" && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Total Invoice Amount */}
            <div className="p-4 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm space-y-1">
              <div className="flex justify-between items-center text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                <span>총 인보이스 금액</span>
                <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2 py-0.5 rounded font-bold">
                  {filteredInvoices.length}건
                </span>
              </div>
              <div className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
                {formatCurrency(totalInvoiceAmount)}
              </div>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                선택 조건 기준 전체 청구 금액
              </p>
            </div>

            {/* Card 2: Total Paid Amount */}
            <div className="p-4 rounded-xl border border-emerald-200/80 bg-emerald-50/20 dark:border-emerald-900/50 dark:bg-emerald-950/10 shadow-sm space-y-1">
              <div className="flex justify-between items-center text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                <span>총 지급 금액 (Paid)</span>
                <span className="text-[10px] bg-emerald-100/80 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded font-bold">
                  집행 완료
                </span>
              </div>
              <div className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
                {formatCurrency(totalPaidAmount)}
              </div>
              <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/70">
                실제 누적 집행 완료된 대금
              </p>
            </div>

            {/* Card 3: Total Balance Due */}
            <div className="p-4 rounded-xl border border-amber-200/80 bg-amber-50/20 dark:border-amber-900/50 dark:bg-amber-950/10 shadow-sm space-y-1">
              <div className="flex justify-between items-center text-xs text-amber-800 dark:text-amber-300 font-medium">
                <span>총 잔액 (Balance Due)</span>
                <span className="text-[10px] bg-amber-100/80 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded font-bold">
                  미지급 잔액
                </span>
              </div>
              <div className="text-xl font-bold font-mono text-amber-700 dark:text-amber-400">
                {formatCurrency(totalBalanceDue)}
              </div>
              <p className="text-[11px] text-amber-600/80 dark:text-amber-400/70">
                지급 예정 잔여 채무 총액
              </p>
            </div>
          </div>

          {/* Search & Filters Controls */}
          <div className="flex flex-col md:flex-row gap-3 bg-zinc-50/70 p-4 border border-zinc-200 rounded-xl dark:bg-zinc-950/40 dark:border-zinc-850">
            {/* Search Input */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="인보이스 번호, PO 번호, AP 번호 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 focus:border-indigo-500 dark:focus:border-indigo-400"
              />
            </div>

            {/* Date Range Inputs */}
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
              />
              <span>~</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
              />
            </div>

            {/* Date Presets */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePresetChange("ALL")}
                className={`h-9 px-2.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
                  !startDate && !endDate
                    ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 dark:border-zinc-100"
                    : "bg-white text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                전체
              </button>
              <button
                onClick={() => handlePresetChange("THIS_MONTH")}
                className="h-9 px-2.5 rounded-lg text-xs font-semibold cursor-pointer border bg-white text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                이번 달
              </button>
              <button
                onClick={() => handlePresetChange("LAST_30_DAYS")}
                className="h-9 px-2.5 rounded-lg text-xs font-semibold cursor-pointer border bg-white text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                최근 30일
              </button>
            </div>

            {/* Payment Status Dropdown Filter */}
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 font-semibold"
            >
              <option value="all">전체 지급 상태</option>
              <option value="UNPAID">미지급 (Unpaid)</option>
              <option value="PARTIALLY_PAID">일부 지급 (Partially Paid)</option>
              <option value="PAID">지급 완료 (Paid)</option>
            </select>

            {/* Document Status Dropdown Filter */}
            <select
              value={documentStatusFilter}
              onChange={(e) => setDocumentStatusFilter(e.target.value)}
              className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 font-semibold"
            >
              <option value="all">전체 문서 상태</option>
              <option value="DRAFT">임시저장 (Draft)</option>
              <option value="SUBMITTED">제출됨 (Submitted)</option>
              <option value="APPROVED">승인됨 (Approved)</option>
              <option value="REJECTED">반려됨 (Rejected)</option>
              <option value="VOID">무효 (Void)</option>
            </select>
          </div>

          {/* Results Table */}
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50/80 text-zinc-600 font-bold border-b border-zinc-200 dark:bg-zinc-950/60 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="px-4 py-3">인보이스 번호</th>
                  <th className="px-4 py-3">AP 번호 (AP No.)</th>
                  <th className="px-4 py-3">관련 PO</th>
                  <th className="px-4 py-3">발행 일자</th>
                  <th className="px-4 py-3 text-right">송장 총액</th>
                  <th className="px-4 py-3 text-right">지급 금액</th>
                  <th className="px-4 py-3 text-right">잔액</th>
                  <th className="px-4 py-3 text-center">문서 상태</th>
                  <th className="px-4 py-3 text-center">지급 상태</th>
                  <th className="px-4 py-3 text-right">상세 정보</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-zinc-400 dark:text-zinc-500">
                      일치하는 청구 인보이스 내역이 존재하지 않습니다.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => {
                    const canonicalPaymentStatus = getCanonicalPaymentStatus(inv);
                    return (
                      <tr key={inv.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                        {/* Invoice Number */}
                        <td className="px-4 py-3.5 font-bold font-mono text-zinc-900 dark:text-zinc-100">
                          {inv.supplierInvoiceNumber}
                        </td>

                        {/* AP Number */}
                        <td className="px-4 py-3.5 font-mono text-indigo-650 dark:text-indigo-400 font-bold">
                          {inv.internalApNumber || "-"}
                        </td>

                        {/* PO Number */}
                        <td className="px-4 py-3.5 text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                          {inv.poNumber}
                        </td>

                        {/* Invoice Date */}
                        <td className="px-4 py-3.5 text-zinc-700 dark:text-zinc-300 font-mono">
                          {inv.invoiceDate}
                        </td>

                        {/* Total Amount */}
                        <td className="px-4 py-3.5 text-right font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                          {formatCurrency(inv.invoiceTotal, inv.currency)}
                        </td>

                        {/* Paid Amount */}
                        <td className="px-4 py-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                          {formatCurrency(inv.amountPaid, inv.currency)}
                        </td>

                        {/* Balance Due */}
                        <td className="px-4 py-3.5 text-right font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                          {formatCurrency(inv.balanceDue, inv.currency)}
                        </td>

                        {/* Document Status */}
                        <td className="px-4 py-3.5 text-center">
                          {inv.invoiceStatus === "DRAFT" && (
                            <span className="px-2 py-0.5 bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 rounded-md font-bold text-[10px]">
                              임시저장
                            </span>
                          )}
                          {inv.invoiceStatus === "SUBMITTED" && (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 rounded-md font-bold text-[10px]">
                              제출됨
                            </span>
                          )}
                          {inv.invoiceStatus === "APPROVED" && (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 rounded-md font-bold text-[10px]">
                              승인됨
                            </span>
                          )}
                          {inv.invoiceStatus === "REJECTED" && (
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 rounded-md font-bold text-[10px]">
                              반려됨
                            </span>
                          )}
                          {inv.invoiceStatus === "VOID" && (
                            <span className="px-2 py-0.5 bg-zinc-100 text-zinc-500 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 rounded-md font-bold text-[10px]">
                              무효
                            </span>
                          )}
                        </td>

                        {/* Canonical Payment Status */}
                        <td className="px-4 py-3.5 text-center">
                          {canonicalPaymentStatus === "UNPAID" && (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-250 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 rounded-md font-bold text-[10px]">
                              미지급 (Unpaid)
                            </span>
                          )}
                          {canonicalPaymentStatus === "PARTIALLY_PAID" && (
                            <span className="px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800 rounded-md font-bold text-[10px]">
                              일부 지급 (Partially Paid)
                            </span>
                          )}
                          {canonicalPaymentStatus === "PAID" && (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-250 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 rounded-md font-bold text-[10px]">
                              지급 완료 (Paid)
                            </span>
                          )}
                        </td>

                        {/* CTA Detail Link */}
                        <td className="px-4 py-3.5 text-right">
                          <Link
                            href={`/portal/finance/${inv.id}`}
                            className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                          >
                            상세 보기 →
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SETTLEMENTS (ADJUSTMENTS) */}
      {activeTab === "settlements" && (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-50/80 text-zinc-600 font-bold border-b border-zinc-200 dark:bg-zinc-950/60 dark:border-zinc-800 dark:text-zinc-400">
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
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {initialAdjustments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-zinc-400 dark:text-zinc-500">
                    진행 중이거나 승인된 정산 조정 내역이 존재하지 않습니다.
                  </td>
                </tr>
              ) : (
                initialAdjustments.map((adj) => (
                  <tr key={adj.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-3.5 font-bold font-mono text-zinc-900 dark:text-zinc-100">
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
                        <span className="text-emerald-600 dark:text-emerald-400">- 감액 (Credit)</span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400">+ 증액 (Charge)</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-700 dark:text-zinc-300 font-mono">
                      {adj.qty !== null ? `${adj.qty} 개` : "-"}
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                      {formatCurrency(adj.amount, adj.currency)}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-700 dark:text-zinc-300">{adj.reason}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="px-2 py-0.5 border border-zinc-200 dark:border-zinc-700 rounded-md text-[10px] font-bold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {adj.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-500 dark:text-zinc-400 font-mono">
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
              <tr className="bg-zinc-50/80 text-zinc-600 font-bold border-b border-zinc-200 dark:bg-zinc-950/60 dark:border-zinc-800 dark:text-zinc-400">
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
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {initialPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-zinc-400 dark:text-zinc-500">
                    지급 내역이 존재하지 않습니다.
                  </td>
                </tr>
              ) : (
                initialPayments.map((pmt) => (
                  <tr key={pmt.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-3.5 font-bold font-mono text-zinc-900 dark:text-zinc-100">
                      {pmt.paymentNumber}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-zinc-700 dark:text-zinc-300">
                      {pmt.invoiceNumber}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-700 dark:text-zinc-300 font-mono">
                      {pmt.paymentDate}
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                      {formatCurrency(pmt.amount, pmt.currency)}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-700 dark:text-zinc-300 font-bold">
                      {pmt.method}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-700 dark:text-zinc-300">
                      {pmt.bankName || "-"}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-500 dark:text-zinc-400 font-mono">
                      {pmt.accountLast4 ? `**** ${pmt.accountLast4}` : "-"}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="px-2 py-0.5 border border-emerald-200 dark:border-emerald-800/60 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
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
