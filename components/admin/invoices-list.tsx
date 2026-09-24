"use client";

import React, { useState, useMemo } from "react";
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

export function getDueDateIndicator(dueDateStr: string, balanceDue: number) {
  if (balanceDue <= 0 || !dueDateStr) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const daysOverdue = Math.abs(diffDays);
    return {
      type: "OVERDUE",
      label: `연체 (${daysOverdue}일 지남)`,
      badgeClass: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 font-bold"
    };
  } else if (diffDays === 0) {
    return {
      type: "DUE_TODAY",
      label: "오늘 마감 (Due Today)",
      badgeClass: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 font-bold"
    };
  } else if (diffDays <= 7) {
    return {
      type: "DUE_SOON",
      label: `${diffDays}일 후 마감`,
      badgeClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 font-bold"
    };
  } else if (diffDays <= 30) {
    return {
      type: "DUE_WITHIN_30",
      label: `${diffDays}일 남음`,
      badgeClass: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
    };
  }

  return null;
}

export function InvoicesList({ initialInvoices, suppliers }: InvoicesListProps) {
  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedDueDateFilter, setSelectedDueDateFilter] = useState<
    "all" | "due_soon" | "7_days" | "14_days" | "30_days" | "overdue"
  >("all");
  const [selectedInvoiceStatuses, setSelectedInvoiceStatuses] = useState<string[]>(["all"]);
  const [selectedPaymentStatuses, setSelectedPaymentStatuses] = useState<string[]>(["all"]);

  // Format Helper
  const formatCurrency = (val: number, currency = "USD") => {
    return `${currency} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Preset Handlers for Invoice Date
  const handleDatePresetChange = (preset: "ALL" | "THIS_MONTH" | "LAST_30_DAYS" | "LAST_60_DAYS") => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    if (preset === "ALL") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "THIS_MONTH") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      setStartDate(firstDay);
      setEndDate(todayStr);
    } else if (preset === "LAST_30_DAYS") {
      const past30 = new Date(new Date().setDate(now.getDate() - 30)).toISOString().split("T")[0];
      setStartDate(past30);
      setEndDate(todayStr);
    } else if (preset === "LAST_60_DAYS") {
      const past60 = new Date(new Date().setDate(now.getDate() - 60)).toISOString().split("T")[0];
      setStartDate(past60);
      setEndDate(todayStr);
    }
  };

  // Toggle Handlers for Multi-Select Invoice Statuses
  const handleToggleInvoiceStatus = (statusKey: string) => {
    if (statusKey === "all") {
      setSelectedInvoiceStatuses(["all"]);
      return;
    }

    if (selectedInvoiceStatuses.includes("all")) {
      setSelectedInvoiceStatuses([statusKey]);
      return;
    }

    if (selectedInvoiceStatuses.includes(statusKey)) {
      const next = selectedInvoiceStatuses.filter((s) => s !== statusKey);
      setSelectedInvoiceStatuses(next.length === 0 ? ["all"] : next);
    } else {
      setSelectedInvoiceStatuses([...selectedInvoiceStatuses, statusKey]);
    }
  };

  // Toggle Handlers for Multi-Select Payment Statuses
  const handleTogglePaymentStatus = (statusKey: string) => {
    if (statusKey === "all") {
      setSelectedPaymentStatuses(["all"]);
      return;
    }

    if (statusKey === "OUTSTANDING") {
      setSelectedPaymentStatuses(["UNPAID", "PARTIALLY_PAID"]);
      return;
    }

    if (selectedPaymentStatuses.includes("all")) {
      setSelectedPaymentStatuses([statusKey]);
      return;
    }

    if (selectedPaymentStatuses.includes(statusKey)) {
      const next = selectedPaymentStatuses.filter((s) => s !== statusKey);
      setSelectedPaymentStatuses(next.length === 0 ? ["all"] : next);
    } else {
      setSelectedPaymentStatuses([...selectedPaymentStatuses, statusKey]);
    }
  };

  // Reset All Filters
  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedSupplierId("all");
    setStartDate("");
    setEndDate("");
    setSelectedDueDateFilter("all");
    setSelectedInvoiceStatuses(["all"]);
    setSelectedPaymentStatuses(["all"]);
  };

  // Filter Computation
  const filteredInvoices = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return initialInvoices.filter((inv) => {
      // 1. Search Term (Invoice No, AP No, Supplier Name, PO No)
      const s = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !s ||
        inv.internal_ap_number.toLowerCase().includes(s) ||
        inv.supplier_invoice_number.toLowerCase().includes(s) ||
        inv.supplier.name.toLowerCase().includes(s) ||
        inv.po.po_number.toLowerCase().includes(s);

      // 2. Supplier Filter
      const matchesSupplier =
        selectedSupplierId === "all" || inv.supplier.id === selectedSupplierId;

      // 3. Invoice Date Filter
      const matchesStartDate = !startDate || (inv.invoice_date && inv.invoice_date >= startDate);
      const matchesEndDate = !endDate || (inv.invoice_date && inv.invoice_date <= endDate);

      // 4. Due Date / Payment Deadline Filter (applies strictly to balance_due > 0)
      const matchesDueDate = (() => {
        if (selectedDueDateFilter === "all") return true;
        if (inv.balance_due <= 0 || !inv.due_date) return false;

        const due = new Date(inv.due_date);
        due.setHours(0, 0, 0, 0);
        const diffTime = due.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (selectedDueDateFilter === "overdue") {
          return diffDays < 0;
        }
        if (selectedDueDateFilter === "due_soon" || selectedDueDateFilter === "7_days") {
          return diffDays >= 0 && diffDays <= 7;
        }
        if (selectedDueDateFilter === "14_days") {
          return diffDays >= 0 && diffDays <= 14;
        }
        if (selectedDueDateFilter === "30_days") {
          return diffDays >= 0 && diffDays <= 30;
        }
        return true;
      })();

      // 5. Multi-Select Invoice Status
      const matchesInvoiceStatus =
        selectedInvoiceStatuses.includes("all") ||
        selectedInvoiceStatuses.includes(inv.invoice_status);

      // 6. Multi-Select Payment Status
      const matchesPaymentStatus =
        selectedPaymentStatuses.includes("all") ||
        selectedPaymentStatuses.includes(inv.payment_status);

      return (
        matchesSearch &&
        matchesSupplier &&
        matchesStartDate &&
        matchesEndDate &&
        matchesDueDate &&
        matchesInvoiceStatus &&
        matchesPaymentStatus
      );
    });
  }, [
    initialInvoices,
    searchTerm,
    selectedSupplierId,
    startDate,
    endDate,
    selectedDueDateFilter,
    selectedInvoiceStatuses,
    selectedPaymentStatuses,
  ]);

  // Operational Counts (Computed across full dataset)
  const operationalCounts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let overdueCount = 0;
    let dueIn7DaysCount = 0;
    let outstandingCount = 0;

    initialInvoices.forEach((inv) => {
      if (inv.balance_due > 0) {
        outstandingCount++;
        if (inv.due_date) {
          const due = new Date(inv.due_date);
          due.setHours(0, 0, 0, 0);
          const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays < 0) overdueCount++;
          else if (diffDays <= 7) dueIn7DaysCount++;
        }
      }
    });

    return { overdueCount, dueIn7DaysCount, outstandingCount };
  }, [initialInvoices]);

  // Summary Metrics (Computed dynamically from filteredInvoices)
  const summary = useMemo(() => {
    const totalInvoiceAmount = filteredInvoices.reduce((sum, inv) => sum + (inv.invoice_total || 0), 0);
    const totalPaidAmount = filteredInvoices.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0);
    const totalBalanceDue = filteredInvoices.reduce((sum, inv) => sum + (inv.balance_due || 0), 0);

    return { totalInvoiceAmount, totalPaidAmount, totalBalanceDue };
  }, [filteredInvoices]);

  return (
    <div className="space-y-5">
      {/* 1. Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Invoice Amount */}
        <div className="p-4.5 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm space-y-1">
          <div className="flex justify-between items-center text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            <span>총 인보이스 금액 (Total Invoice)</span>
            <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2 py-0.5 rounded font-bold">
              {filteredInvoices.length}건
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-zinc-900 dark:text-white">
            {formatCurrency(summary.totalInvoiceAmount)}
          </div>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
            현재 조건 필터링된 전체 인보이스 합계
          </p>
        </div>

        {/* Card 2: Total Paid Amount */}
        <div className="p-4.5 rounded-xl border border-emerald-200/80 bg-emerald-50/20 dark:border-emerald-900/50 dark:bg-emerald-950/10 shadow-sm space-y-1">
          <div className="flex justify-between items-center text-xs text-emerald-800 dark:text-emerald-300 font-medium">
            <span>총 지급 금액 (Total Paid)</span>
            <span className="text-[10px] bg-emerald-100/80 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded font-bold">
              대금 집행
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
            {formatCurrency(summary.totalPaidAmount)}
          </div>
          <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/70">
            실제 누적 집행 완료된 대금 총액
          </p>
        </div>

        {/* Card 3: Total Balance Due */}
        <div className="p-4.5 rounded-xl border border-amber-200/80 bg-amber-50/20 dark:border-amber-900/50 dark:bg-amber-950/10 shadow-sm space-y-1">
          <div className="flex justify-between items-center text-xs text-amber-800 dark:text-amber-300 font-medium">
            <span>총 잔액 (Total Balance Due)</span>
            <span className="text-[10px] bg-amber-100/80 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded font-bold">
              미지급 채무
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-amber-700 dark:text-amber-400">
            {formatCurrency(summary.totalBalanceDue)}
          </div>
          <p className="text-[11px] text-amber-600/80 dark:text-amber-400/70">
            지급 예정 잔여 채무 총액
          </p>
        </div>
      </div>

      {/* 2. Filter Controls Dashboard */}
      <div className="bg-zinc-50/70 p-4 border border-zinc-200 rounded-xl dark:bg-zinc-950/40 dark:border-zinc-850 space-y-3 text-xs">
        {/* Row 1: Search & Supplier & Reset */}
        <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
          <div className="flex flex-1 flex-col md:flex-row gap-2.5">
            <input
              type="text"
              placeholder="인보이스 번호, AP 번호, 공급사, PO 번호 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white focus:border-indigo-500"
            />
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 font-semibold"
            >
              <option value="all">전체 공급사 (All Suppliers)</option>
              {suppliers.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleResetFilters}
            className="h-9 px-3 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 font-bold rounded-lg transition-colors cursor-pointer text-xs"
          >
            ↺ 필터 초기화 (Reset Filters)
          </button>
        </div>

        {/* Row 2: Invoice Date Filter & Presets */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-zinc-200/60 dark:border-zinc-850">
          <span className="font-bold text-zinc-700 dark:text-zinc-300 w-28">
            발행 일자 (Invoice Date):
          </span>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
            />
            <span className="text-zinc-400">~</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleDatePresetChange("ALL")}
              className={`h-8 px-2.5 rounded-md text-xs font-semibold cursor-pointer border transition-colors ${
                !startDate && !endDate
                  ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 dark:border-zinc-100"
                  : "bg-white text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              전체 (All)
            </button>
            <button
              onClick={() => handleDatePresetChange("THIS_MONTH")}
              className="h-8 px-2.5 rounded-md text-xs font-semibold cursor-pointer border bg-white text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              이번 달
            </button>
            <button
              onClick={() => handleDatePresetChange("LAST_30_DAYS")}
              className="h-8 px-2.5 rounded-md text-xs font-semibold cursor-pointer border bg-white text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              최근 30일
            </button>
            <button
              onClick={() => handleDatePresetChange("LAST_60_DAYS")}
              className="h-8 px-2.5 rounded-md text-xs font-semibold cursor-pointer border bg-white text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              최근 60일
            </button>
          </div>
        </div>

        {/* Row 3: Due Date / Payment Deadline Filter */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-zinc-200/60 dark:border-zinc-850">
          <span className="font-bold text-zinc-700 dark:text-zinc-300 w-28">
            지급 기한 (Payment Due):
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "all", label: "전체 (All Due Dates)" },
              { id: "due_soon", label: `지급기한 임박 (${operationalCounts.dueIn7DaysCount})` },
              { id: "7_days", label: "7일 이내" },
              { id: "14_days", label: "14일 이내" },
              { id: "30_days", label: "30일 이내" },
              { id: "overdue", label: `연체 Overdue (${operationalCounts.overdueCount})` },
            ].map((btn) => {
              const isActive = selectedDueDateFilter === btn.id;
              const isOverdueBtn = btn.id === "overdue";
              return (
                <button
                  key={btn.id}
                  onClick={() => setSelectedDueDateFilter(btn.id as any)}
                  className={`h-8 px-2.5 rounded-md text-xs font-bold cursor-pointer border transition-colors ${
                    isActive
                      ? isOverdueBtn
                        ? "bg-rose-600 text-white border-rose-600"
                        : "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 dark:border-zinc-100"
                      : isOverdueBtn
                      ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60 hover:bg-rose-100"
                      : "bg-white text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 4: Invoice Status Multi-Select */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-zinc-200/60 dark:border-zinc-850">
          <span className="font-bold text-zinc-700 dark:text-zinc-300 w-28">
            문서 상태 (Invoice Status):
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => handleToggleInvoiceStatus("all")}
              className={`h-8 px-2.5 rounded-md text-xs font-bold cursor-pointer border transition-colors ${
                selectedInvoiceStatuses.includes("all")
                  ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 dark:border-zinc-100"
                  : "bg-white text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              전체 (All)
            </button>
            {Object.entries(INVOICE_STATUS_LABELS).map(([k, label]) => {
              const isActive = selectedInvoiceStatuses.includes(k);
              return (
                <button
                  key={k}
                  onClick={() => handleToggleInvoiceStatus(k)}
                  className={`h-8 px-2.5 rounded-md text-xs font-bold cursor-pointer border transition-colors ${
                    isActive
                      ? "bg-indigo-650 text-white border-indigo-650 dark:bg-indigo-600 dark:text-white"
                      : "bg-white text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 5: Payment Status Multi-Select & Outstanding Quick Filter */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-zinc-200/60 dark:border-zinc-850">
          <span className="font-bold text-zinc-700 dark:text-zinc-300 w-28">
            지급 상태 (Payment Status):
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => handleTogglePaymentStatus("all")}
              className={`h-8 px-2.5 rounded-md text-xs font-bold cursor-pointer border transition-colors ${
                selectedPaymentStatuses.includes("all")
                  ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 dark:border-zinc-100"
                  : "bg-white text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              전체 (All)
            </button>
            {Object.entries(PAYMENT_STATUS_LABELS).map(([k, label]) => {
              const isActive = selectedPaymentStatuses.includes(k);
              return (
                <button
                  key={k}
                  onClick={() => handleTogglePaymentStatus(k)}
                  className={`h-8 px-2.5 rounded-md text-xs font-bold cursor-pointer border transition-colors ${
                    isActive
                      ? "bg-teal-650 text-white border-teal-650 dark:bg-teal-600 dark:text-white"
                      : "bg-white text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  {label}
                </button>
              );
            })}
            <button
              onClick={() => handleTogglePaymentStatus("OUTSTANDING")}
              className={`h-8 px-2.5 rounded-md text-xs font-bold cursor-pointer border transition-colors ${
                selectedPaymentStatuses.includes("UNPAID") &&
                selectedPaymentStatuses.includes("PARTIALLY_PAID") &&
                !selectedPaymentStatuses.includes("PAID")
                  ? "bg-amber-600 text-white border-amber-600"
                  : "bg-amber-50 text-amber-800 border-amber-250 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 hover:bg-amber-100"
              }`}
            >
              ⚡ Outstanding (미지급/부분지급 - {operationalCounts.outstandingCount}건)
            </button>
          </div>
        </div>
      </div>

      {/* 3. Results Table */}
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
                <th className="px-5 py-3 text-right">지급액 (Paid Amount)</th>
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
                  <td colSpan={11} className="px-5 py-12 text-center text-zinc-400 font-semibold">
                    일치하는 공급사 인보이스/AP 내역이 존재하지 않습니다.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const dueDateIndicator = getDueDateIndicator(inv.due_date, inv.balance_due);
                  return (
                    <tr key={inv.id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-850/5 transition-colors">
                      {/* AP Number */}
                      <td className="px-5 py-3.5 font-mono font-bold text-indigo-650 hover:underline">
                        <Link href={`/admin/finance/invoices/${inv.id}`}>
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
                        {formatCurrency(inv.invoice_total, inv.currency)}
                      </td>

                      {/* Paid Amount */}
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(inv.amount_paid, inv.currency)}
                      </td>

                      {/* Balance Due */}
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-zinc-900 dark:text-white">
                        {formatCurrency(inv.balance_due, inv.currency)}
                      </td>

                      {/* Invoice Date */}
                      <td className="px-5 py-3.5 font-mono text-zinc-550 dark:text-zinc-400">
                        {inv.invoice_date}
                      </td>

                      {/* Due Date + Visual Indicator */}
                      <td className="px-5 py-3.5 font-mono text-zinc-550 dark:text-zinc-400">
                        <div>{inv.due_date}</div>
                        {dueDateIndicator && (
                          <div className="mt-0.5">
                            <span className={`inline-flex items-center px-1.5 py-0.2 text-[9px] rounded border ${dueDateIndicator.badgeClass}`}>
                              {dueDateIndicator.label}
                            </span>
                          </div>
                        )}
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
