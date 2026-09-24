"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  PaymentDashboardKPIs,
  PaymentScheduleItem,
  PaymentHistoryItem,
} from "@/lib/supplier-payment/actions";
import { getInvoiceAttachmentUrl } from "@/lib/supplier-invoice/actions";

interface PaymentsListProps {
  kpis: PaymentDashboardKPIs;
  schedule: PaymentScheduleItem[];
  history: PaymentHistoryItem[];
}

const METHOD_LABELS: Record<string, string> = {
  WIRE: "해외송금 (WIRE)",
  ACH: "ACH",
  CHECK: "수표 (CHECK)",
  OTHER: "기타 (OTHER)",
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
  PENDING_ADJUSTMENT: "분쟁/조정 중 (Pending)",
  SETTLED: "정산 종결 (Settled)",
};

const PAYMENT_RECORD_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-650 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
  VOID: "bg-zinc-200 text-zinc-500 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-600 dark:border-zinc-800",
};

const PAYMENT_RECORD_STATUS_LABELS: Record<string, string> = {
  DRAFT: "초안 (Draft)",
  COMPLETED: "지급완료 (Completed)",
  VOID: "무효 (Void)",
};

export function PaymentsList({ kpis, schedule, history }: PaymentsListProps) {
  const [activeTab, setActiveTab] = useState<"schedule" | "history">("schedule");

  // Schedule Filters
  const [scheduleSearch, setScheduleSearch] = useState("");
  const [scheduleDueFilter, setScheduleDueFilter] = useState("");
  const [schedulePaymentStatusFilter, setSchedulePaymentStatusFilter] = useState("");
  const [scheduleSettlementFilter, setScheduleSettlementFilter] = useState("");

  // History Filters
  const [historySearch, setHistorySearch] = useState("");
  const [historyMethodFilter, setHistoryMethodFilter] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("");

  const handleViewReceipt = async (path: string) => {
    try {
      const url = await getInvoiceAttachmentUrl(path);
      if (url) {
        window.open(url, "_blank");
      } else {
        alert("영수증 첨부 파일을 찾을 수 없습니다.");
      }
    } catch (err: any) {
      alert("영수증 열람 실패: " + err.message);
    }
  };

  // Filter Schedule Items
  const filteredSchedule = schedule.filter((item) => {
    const q = scheduleSearch.toLowerCase();
    const matchSearch =
      !q ||
      item.internal_ap_number.toLowerCase().includes(q) ||
      item.supplier_invoice_number.toLowerCase().includes(q) ||
      item.supplier_name.toLowerCase().includes(q) ||
      (item.po_number && item.po_number.toLowerCase().includes(q));

    let matchDue = true;
    if (scheduleDueFilter === "OVERDUE") {
      matchDue = item.is_overdue && item.balance_due > 0;
    } else if (scheduleDueFilter === "TODAY") {
      matchDue = item.d_day_label.includes("오늘") && item.balance_due > 0;
    } else if (scheduleDueFilter === "WEEK") {
      matchDue = (item.d_day_label.includes("D-") || item.d_day_label.includes("오늘")) && item.balance_due > 0;
    } else if (scheduleDueFilter === "UNPAID_ONLY") {
      matchDue = item.balance_due > 0;
    } else if (scheduleDueFilter === "PAID_ONLY") {
      matchDue = item.balance_due === 0;
    }

    const matchPaymentStatus =
      !schedulePaymentStatusFilter || item.payment_status === schedulePaymentStatusFilter;

    const matchSettlement =
      !scheduleSettlementFilter || item.settlement_status === scheduleSettlementFilter;

    return matchSearch && matchDue && matchPaymentStatus && matchSettlement;
  });

  // Filter History Items
  const filteredHistory = history.filter((item) => {
    const q = historySearch.toLowerCase();
    const matchSearch =
      !q ||
      item.payment_number.toLowerCase().includes(q) ||
      item.supplier_name.toLowerCase().includes(q) ||
      item.internal_ap_number.toLowerCase().includes(q) ||
      item.supplier_invoice_number.toLowerCase().includes(q) ||
      (item.bank_reference && item.bank_reference.toLowerCase().includes(q)) ||
      (item.remittance_reference && item.remittance_reference.toLowerCase().includes(q));

    const matchMethod = !historyMethodFilter || item.payment_method === historyMethodFilter;
    const matchStatus = !historyStatusFilter || item.status === historyStatusFilter;

    return matchSearch && matchMethod && matchStatus;
  });

  const outstandingCount = schedule.filter((s) => s.balance_due > 0).length;

  return (
    <div className="space-y-6 text-xs">
      {/* 1. KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Due Today */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
          <div className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
            오늘 만기 (Due Today)
          </div>
          <div className="text-base font-extrabold font-mono text-blue-950 dark:text-blue-100 mt-1">
            ${kpis.dueTodayAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 font-semibold">
            {kpis.dueTodayCount}건 대기
          </div>
        </div>

        {/* Due Next 7 Days */}
        <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4 dark:border-sky-900/50 dark:bg-sky-950/20">
          <div className="text-[10px] font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wider">
            7일 내 만기 (This Week)
          </div>
          <div className="text-base font-extrabold font-mono text-sky-950 dark:text-sky-100 mt-1">
            ${kpis.dueThisWeekAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-sky-600 dark:text-sky-400 mt-1 font-semibold">
            {kpis.dueThisWeekCount}건 예정
          </div>
        </div>

        {/* Due Next 30 Days */}
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
          <div className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
            30일 내 만기 (Next 30D)
          </div>
          <div className="text-base font-extrabold font-mono text-indigo-950 dark:text-indigo-100 mt-1">
            ${kpis.dueNext30DaysAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1 font-semibold">
            {kpis.dueNext30DaysCount}건 예정
          </div>
        </div>

        {/* Overdue */}
        <div className={`rounded-xl border p-4 ${
          kpis.overdueCount > 0
            ? "border-rose-300 bg-rose-50/60 dark:border-rose-900/60 dark:bg-rose-950/30"
            : "border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900"
        }`}>
          <div className={`text-[10px] font-bold uppercase tracking-wider ${
            kpis.overdueCount > 0 ? "text-rose-700 dark:text-rose-400" : "text-zinc-500"
          }`}>
            만기 경과 (Overdue)
          </div>
          <div className={`text-base font-extrabold font-mono mt-1 ${
            kpis.overdueCount > 0 ? "text-rose-950 dark:text-rose-100" : "text-zinc-800 dark:text-zinc-200"
          }`}>
            ${kpis.overdueAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className={`text-[10px] mt-1 font-semibold ${
            kpis.overdueCount > 0 ? "text-rose-600 dark:text-rose-400 font-bold" : "text-zinc-400"
          }`}>
            {kpis.overdueCount > 0 ? `⚠️ ${kpis.overdueCount}건 연체 중` : "0건 연체"}
          </div>
        </div>

        {/* Total Outstanding */}
        <div className="rounded-xl border border-zinc-250 bg-zinc-100/60 p-4 dark:border-zinc-750 dark:bg-zinc-850/60">
          <div className="text-[10px] font-bold text-zinc-650 dark:text-zinc-350 uppercase tracking-wider">
            총 미지급 잔액 (Outstanding)
          </div>
          <div className="text-base font-extrabold font-mono text-zinc-950 dark:text-white mt-1">
            ${kpis.totalOutstandingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 font-semibold">
            {outstandingCount}건 미지급 잔여
          </div>
        </div>

        {/* Paid This Month */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
            당월 지급액 (Paid This Month)
          </div>
          <div className="text-base font-extrabold font-mono text-emerald-950 dark:text-emerald-100 mt-1">
            ${kpis.paidThisMonthAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">
            ✓ 실지행 완료
          </div>
        </div>
      </div>

      {/* Workflow Guidance Banner */}
      <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 dark:bg-zinc-900/60 dark:border-zinc-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-indigo-600 dark:text-indigo-400 font-bold">💡 실무 지급 등록 팁:</span>
          <span className="text-zinc-600 dark:text-zinc-300">
            대금 송금(지급)은 아래 일정 목록에서 인보이스 상세로 이동하여 <strong>[+ 지급 등록 (Record Payment)]</strong>을 통해 1-Click 자동 연계로 등록할 수 있습니다.
          </span>
        </div>
      </div>

      {/* 2. Tab Navigation */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("schedule")}
            className={`px-4 py-2.5 font-bold text-xs border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "schedule"
                ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            <span>📅 지급 예정 / 미지급 일정 (Upcoming & Outstanding)</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {schedule.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2.5 font-bold text-xs border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "history"
                ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            <span>📜 지급 실행 이력 (Payment History Ledger)</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {history.length}
            </span>
          </button>
        </div>
      </div>

      {/* 3. TAB 1: Upcoming / Outstanding Schedule */}
      {activeTab === "schedule" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-950 p-4 border border-zinc-200 dark:border-zinc-850 rounded-xl">
            <div className="flex flex-1 flex-wrap gap-2">
              <input
                type="text"
                placeholder="AP 번호, 인보이스 번호, 공급사, PO 번호 검색..."
                value={scheduleSearch}
                onChange={(e) => setScheduleSearch(e.target.value)}
                className="flex-1 min-w-[220px] h-9 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 dark:text-white px-3 outline-none rounded-xl"
              />
              <select
                value={scheduleDueFilter}
                onChange={(e) => setScheduleDueFilter(e.target.value)}
                className="h-9 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 dark:text-white px-3 outline-none rounded-xl"
              >
                <option value="">모든 일정 상태</option>
                <option value="OVERDUE">⚠️ 연체 건만 보기 (Overdue)</option>
                <option value="TODAY">오늘 만기 건만 (Due Today)</option>
                <option value="WEEK">7일 내 만기 예정 (This Week)</option>
                <option value="UNPAID_ONLY">미지급 잔액 있는 건만</option>
                <option value="PAID_ONLY">전액 지급 완료 건만</option>
              </select>
              <select
                value={schedulePaymentStatusFilter}
                onChange={(e) => setSchedulePaymentStatusFilter(e.target.value)}
                className="h-9 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 dark:text-white px-3 outline-none rounded-xl"
              >
                <option value="">모든 지급 상태</option>
                <option value="UNPAID">미지급 (UNPAID)</option>
                <option value="PARTIALLY_PAID">일부 지급 (PARTIALLY_PAID)</option>
                <option value="PAID">지급 완료 (PAID)</option>
              </select>
              <select
                value={scheduleSettlementFilter}
                onChange={(e) => setScheduleSettlementFilter(e.target.value)}
                className="h-9 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 dark:text-white px-3 outline-none rounded-xl"
              >
                <option value="">모든 정산 상태</option>
                <option value="OPEN">정산 대기 (OPEN)</option>
                <option value="SETTLED">정산 종결 (SETTLED)</option>
              </select>
            </div>
          </div>

          {/* Schedule Table */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 text-zinc-500 font-bold dark:text-zinc-350">
                    <th className="px-4 py-3">AP 번호 / 인보이스</th>
                    <th className="px-4 py-3">공급사 (Supplier)</th>
                    <th className="px-4 py-3">연계 PO</th>
                    <th className="px-4 py-3">지급 기한 (Due Date)</th>
                    <th className="px-4 py-3 text-right">최종 청구액</th>
                    <th className="px-4 py-3 text-right">기지급액</th>
                    <th className="px-4 py-3 text-right">지급 잔액 (Due)</th>
                    <th className="px-4 py-3 text-center">지급 상태</th>
                    <th className="px-4 py-3 text-center">정산 상태</th>
                    <th className="px-4 py-3 text-center">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filteredSchedule.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-5 py-12 text-center text-zinc-400 font-medium">
                        조건에 일치하는 공급사 지급 예정 일정이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredSchedule.map((item) => (
                      <tr key={item.id} className="hover:bg-zinc-50/40 dark:hover:bg-zinc-850/10 transition-colors">
                        {/* AP & Invoice No */}
                        <td className="px-4 py-3.5">
                          <Link
                            href={`/admin/finance/invoices/${item.id}`}
                            className="font-mono font-bold text-indigo-650 hover:underline block"
                          >
                            {item.internal_ap_number}
                          </Link>
                          <span className="text-[10px] text-zinc-400 block font-mono">
                            Inv: {item.supplier_invoice_number}
                          </span>
                        </td>

                        {/* Supplier */}
                        <td className="px-4 py-3.5 font-bold text-zinc-850 dark:text-zinc-200">
                          {item.supplier_name}
                        </td>

                        {/* PO No */}
                        <td className="px-4 py-3.5 font-mono text-zinc-600 dark:text-zinc-400">
                          {item.po_number ? (
                            <span>{item.po_number}</span>
                          ) : (
                            <span className="text-zinc-350 italic">-</span>
                          )}
                        </td>

                        {/* Due Date with D-Day Badge */}
                        <td className="px-4 py-3.5">
                          <div className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                            {item.due_date || "-"}
                          </div>
                          {item.due_date && (
                            <span
                              className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[9px] font-bold border ${
                                item.is_overdue
                                  ? "bg-rose-100 text-rose-800 border-rose-250 dark:bg-rose-950/40 dark:text-rose-300"
                                  : item.d_day_label.includes("오늘")
                                  ? "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300"
                                  : "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                              }`}
                            >
                              {item.d_day_label}
                            </span>
                          )}
                        </td>

                        {/* Final Payable */}
                        <td className="px-4 py-3.5 text-right font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                          {item.currency} {item.final_payable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>

                        {/* Amount Paid */}
                        <td className="px-4 py-3.5 text-right font-mono text-zinc-600 dark:text-zinc-400">
                          {item.currency} {item.amount_paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>

                        {/* Balance Due */}
                        <td className="px-4 py-3.5 text-right font-mono font-bold text-zinc-950 dark:text-white">
                          <span className={item.balance_due > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-400"}>
                            {item.currency} {item.balance_due.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </td>

                        {/* Payment Status */}
                        <td className="px-4 py-3.5 text-center">
                          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-bold ${PAYMENT_STATUS_COLORS[item.payment_status]}`}>
                            {PAYMENT_STATUS_LABELS[item.payment_status]}
                          </span>
                        </td>

                        {/* Settlement Status */}
                        <td className="px-4 py-3.5 text-center">
                          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-bold ${SETTLEMENT_STATUS_COLORS[item.settlement_status]}`}>
                            {SETTLEMENT_STATUS_LABELS[item.settlement_status]}
                          </span>
                        </td>

                        {/* Action Button */}
                        <td className="px-4 py-3.5 text-center">
                          <Link
                            href={`/admin/finance/invoices/${item.id}`}
                            className="inline-flex items-center px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-950 font-bold text-[10px] shadow-sm transition-colors cursor-pointer"
                          >
                            인보이스 보기 / 지급 →
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. TAB 2: Payment History Ledger */}
      {activeTab === "history" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-950 p-4 border border-zinc-200 dark:border-zinc-850 rounded-xl">
            <div className="flex flex-1 flex-wrap gap-2">
              <input
                type="text"
                placeholder="지급 번호, 공급사, AP 번호, 인보이스 번호, 참조 ID 검색..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="flex-1 min-w-[220px] h-9 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 dark:text-white px-3 outline-none rounded-xl"
              />
              <select
                value={historyMethodFilter}
                onChange={(e) => setHistoryMethodFilter(e.target.value)}
                className="h-9 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 dark:text-white px-3 outline-none rounded-xl"
              >
                <option value="">모든 지급 방식</option>
                <option value="WIRE">해외송금 (WIRE)</option>
                <option value="ACH">ACH 계좌이체</option>
                <option value="CHECK">수표 (CHECK)</option>
                <option value="OTHER">기타 (OTHER)</option>
              </select>
              <select
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value)}
                className="h-9 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 dark:text-white px-3 outline-none rounded-xl"
              >
                <option value="">모든 상태</option>
                <option value="COMPLETED">지급완료 (Completed)</option>
                <option value="DRAFT">초안 (Draft)</option>
                <option value="VOID">무효 (Void)</option>
              </select>
            </div>
          </div>

          {/* History Table */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 text-zinc-500 font-bold dark:text-zinc-350">
                    <th className="px-4 py-3">지급 번호</th>
                    <th className="px-4 py-3">지급 일자</th>
                    <th className="px-4 py-3">공급사 (Supplier)</th>
                    <th className="px-4 py-3">대상 인보이스 (AP)</th>
                    <th className="px-4 py-3 text-right">지급 금액</th>
                    <th className="px-4 py-3">지급 방식</th>
                    <th className="px-4 py-3">은행 / 송금 참조</th>
                    <th className="px-4 py-3 text-center">영수증</th>
                    <th className="px-4 py-3 text-center">상태</th>
                    <th className="px-4 py-3">등록자</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-5 py-12 text-center text-zinc-400 font-medium">
                        등록된 공급사 대금 지급 내역이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((p) => (
                      <tr key={p.id} className="hover:bg-zinc-50/40 dark:hover:bg-zinc-850/10 transition-colors">
                        {/* Payment Number */}
                        <td className="px-4 py-3.5 font-mono font-bold text-indigo-650 hover:underline">
                          <Link href={`/admin/finance/payments/${p.id}`}>
                            {p.payment_number}
                          </Link>
                        </td>

                        {/* Payment Date */}
                        <td className="px-4 py-3.5 font-mono text-zinc-650 dark:text-zinc-350">
                          {p.payment_date}
                        </td>

                        {/* Supplier */}
                        <td className="px-4 py-3.5 font-semibold text-zinc-900 dark:text-zinc-200">
                          {p.supplier_name}
                        </td>

                        {/* Invoice Ref */}
                        <td className="px-4 py-3.5">
                          <Link
                            href={`/admin/finance/invoices/${p.invoice_id}`}
                            className="font-mono font-bold text-indigo-650 hover:underline block"
                          >
                            {p.internal_ap_number}
                          </Link>
                          <span className="text-[10px] text-zinc-400 block font-mono">
                            Inv: {p.supplier_invoice_number}
                          </span>
                        </td>

                        {/* Amount */}
                        <td className="px-4 py-3.5 text-right font-mono font-bold text-zinc-950 dark:text-white">
                          {p.currency} {Number(p.payment_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>

                        {/* Method */}
                        <td className="px-4 py-3.5 font-semibold text-zinc-700 dark:text-zinc-300">
                          {METHOD_LABELS[p.payment_method] || p.payment_method}
                        </td>

                        {/* Reference */}
                        <td className="px-4 py-3.5 font-mono text-zinc-600 dark:text-zinc-400 text-[11px]">
                          {p.bank_reference || p.remittance_reference || "-"}
                        </td>

                        {/* Receipt */}
                        <td className="px-4 py-3.5 text-center">
                          {p.attachment_path ? (
                            <button
                              type="button"
                              onClick={() => handleViewReceipt(p.attachment_path!)}
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 cursor-pointer transition-colors"
                            >
                              📎 영수증
                            </button>
                          ) : (
                            <span className="text-zinc-350 italic">-</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5 text-center">
                          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[8px] font-bold ${PAYMENT_RECORD_STATUS_COLORS[p.status]}`}>
                            {PAYMENT_RECORD_STATUS_LABELS[p.status] || p.status}
                          </span>
                        </td>

                        {/* Creator */}
                        <td className="px-4 py-3.5 text-zinc-500 text-[11px]">
                          {p.creator_name || "System"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
