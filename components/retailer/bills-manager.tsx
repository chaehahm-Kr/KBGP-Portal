"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { RetailerBillsFeed, RetailerBillSummary, RetailerBillDetail } from "@/lib/retailer/bill-types";
import { BillDetailModal } from "@/components/retailer/bill-detail-modal";
import { PayBillModal } from "@/components/retailer/pay-bill-modal";
import { MultiPayBillModal } from "@/components/retailer/multi-pay-bill-modal";
import { EffectivePaymentPolicy } from "@/lib/retailer/payment-policy";

interface BillsManagerProps {
  initialFeed: RetailerBillsFeed;
  effectivePolicy?: EffectivePaymentPolicy | null;
}

export function RetailerBillsManager({
  initialFeed,
  effectivePolicy,
}: BillsManagerProps) {
  const [selectedTab, setSelectedTab] = useState<"all" | "open" | "due_soon" | "past_due" | "paid">("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeDetailId, setActiveDetailId] = useState<string | null>(null);
  const [activePayBill, setActivePayBill] = useState<RetailerBillSummary | RetailerBillDetail | null>(null);

  // Multi-invoice selection state
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [isMultiPayOpen, setIsMultiPayOpen] = useState<boolean>(false);

  const { summary, invoices } = initialFeed;

  // Filtered bills list
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // 1. Tab filter
      if (selectedTab === "open" && inv.ar_status !== "OPEN" && inv.ar_status !== "DUE_SOON") return false;
      if (selectedTab === "due_soon" && inv.ar_status !== "DUE_SOON") return false;
      if (selectedTab === "past_due" && inv.ar_status !== "PAST_DUE") return false;
      if (selectedTab === "paid" && inv.ar_status !== "PAID") return false;

      // 2. Search filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchesInvoice = inv.invoice_number.toLowerCase().includes(query);
        const matchesOrder = inv.order_number.toLowerCase().includes(query);
        const matchesTerms = inv.terms_name.toLowerCase().includes(query);
        return matchesInvoice || matchesOrder || matchesTerms;
      }

      return true;
    });
  }, [invoices, selectedTab, searchTerm]);

  // Payable invoices currently visible in the filtered view (balance_due > 0 and non-void)
  const payableFilteredInvoices = useMemo(() => {
    return filteredInvoices.filter(
      (inv) =>
        Number(inv.balance_due || 0) > 0 &&
        inv.invoice_status !== "void" &&
        inv.invoice_status !== "cancelled" &&
        inv.ar_status !== "PAID"
    );
  }, [filteredInvoices]);

  // Selected bill objects
  const selectedBills = useMemo(() => {
    return invoices.filter(
      (inv) =>
        selectedInvoiceIds.has(inv.id) &&
        Number(inv.balance_due || 0) > 0 &&
        inv.invoice_status !== "void" &&
        inv.invoice_status !== "cancelled"
    );
  }, [invoices, selectedInvoiceIds]);

  const selectedTotalBalance = useMemo(() => {
    return selectedBills.reduce((acc, b) => acc + Number(b.balance_due || 0), 0);
  }, [selectedBills]);

  // Selection toggle handlers
  const toggleInvoiceSelection = (id: string) => {
    setSelectedInvoiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isAllPayableSelected =
    payableFilteredInvoices.length > 0 &&
    payableFilteredInvoices.every((inv) => selectedInvoiceIds.has(inv.id));

  const toggleSelectAll = () => {
    if (isAllPayableSelected) {
      setSelectedInvoiceIds((prev) => {
        const next = new Set(prev);
        payableFilteredInvoices.forEach((inv) => next.delete(inv.id));
        return next;
      });
    } else {
      setSelectedInvoiceIds((prev) => {
        const next = new Set(prev);
        payableFilteredInvoices.forEach((inv) => next.add(inv.id));
        return next;
      });
    }
  };

  const getStatusBadge = (arStatus: string, invoiceStatus?: string) => {
    if (invoiceStatus === "void" || invoiceStatus === "cancelled") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border border-zinc-500/20">
          Void
        </span>
      );
    }
    switch (arStatus) {
      case "PAST_DUE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            Past Due
          </span>
        );
      case "DUE_SOON":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Due Soon
          </span>
        );
      case "PAID":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Paid
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Open
          </span>
        );
    }
  };

  const formatDateOnly = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    const [y, m, d] = dateStr.split("T")[0].split("-").map(Number);
    if (y && m && d) {
      return new Date(y, m - 1, d).toLocaleDateString();
    }
    return new Date(dateStr).toLocaleDateString();
  };

  const formatDueRelative = (dueDateStr: string, arStatus: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = dueDateStr.split("T")[0].split("-").map(Number);
    const dueDate = y && m && d ? new Date(y, m - 1, d) : new Date(dueDateStr);
    dueDate.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (arStatus === "PAID") {
      return "Paid in full";
    }
    if (diffDays < 0) {
      return `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"} overdue`;
    }
    if (diffDays === 0) {
      return "Due today";
    }
    if (diffDays === 1) {
      return "Due tomorrow";
    }
    return `Due in ${diffDays} days`;
  };

  return (
    <div className="space-y-6">
      {/* 1. Top Summary KPI Cards (Rule 4) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Due - Primary Financial KPI */}
        <div className="rounded-2xl border-2 border-zinc-900 dark:border-white bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 p-4 sm:p-5 shadow-md space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-300 dark:text-zinc-600">
              Total Due
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/15 dark:bg-black/10 text-white dark:text-zinc-900 border border-white/20 dark:border-black/15">
              Primary AR
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black tracking-tight text-white dark:text-zinc-950">
            ${summary.openAR.toFixed(2)}
          </div>
          <p className="text-xs text-zinc-300/90 dark:text-zinc-600 font-medium">
            Across {summary.openInvoiceCount} open bill{summary.openInvoiceCount === 1 ? "" : "s"}
          </p>
        </div>

        {/* Past Due */}
        <div
          className={`rounded-2xl border p-4 sm:p-5 shadow-xs space-y-1 transition-colors ${
            summary.pastDueAmount > 0
              ? "border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20"
              : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-[11px] font-bold uppercase tracking-wider ${
                summary.pastDueAmount > 0
                  ? "text-rose-700 dark:text-rose-400"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              Past Due
            </span>
            {summary.pastDueInvoiceCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white">
                {summary.pastDueInvoiceCount} Overdue
              </span>
            )}
          </div>
          <div
            className={`text-2xl sm:text-3xl font-extrabold ${
              summary.pastDueAmount > 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-zinc-900 dark:text-white"
            }`}
          >
            ${summary.pastDueAmount.toFixed(2)}
          </div>
          <p
            className={`text-xs ${
              summary.pastDueAmount > 0
                ? "text-rose-600/90 dark:text-rose-400/80 font-medium"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {summary.pastDueAmount > 0 ? "Immediate settlement recommended" : "No overdue balance"}
          </p>
        </div>

        {/* Due Soon (Next 7 Days) */}
        <div
          className={`rounded-2xl border p-4 sm:p-5 shadow-xs space-y-1 transition-colors ${
            summary.dueSoonAmount > 0
              ? "border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20"
              : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60"
          }`}
        >
          <span
            className={`text-[11px] font-bold uppercase tracking-wider ${
              summary.dueSoonAmount > 0
                ? "text-amber-700 dark:text-amber-400"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            Due Soon (7 Days)
          </span>
          <div
            className={`text-2xl sm:text-3xl font-extrabold ${
              summary.dueSoonAmount > 0
                ? "text-amber-600 dark:text-amber-400"
                : "text-zinc-900 dark:text-white"
            }`}
          >
            ${summary.dueSoonAmount.toFixed(2)}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {summary.dueSoonAmount > 0 ? "Due within next 7 calendar days" : "No bills due this week"}
          </p>
        </div>

        {/* Available Credit - Secondary Metric */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 sm:p-5 shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Available Credit
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-zinc-800 dark:text-zinc-200">
            ${summary.availableCredit.toFixed(2)}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {summary.creditLimit > 0
              ? `Credit Limit: $${summary.creditLimit.toFixed(2)}`
              : "Prepaid Account"}
          </p>
        </div>
      </div>

      {/* 2. Filter Bar, Search & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 self-start sm:self-auto overflow-x-auto max-w-full">
          {[
            { key: "all", label: "All Bills" },
            { key: "open", label: "Open" },
            { key: "due_soon", label: "Due Soon" },
            { key: "past_due", label: "Past Due" },
            { key: "paid", label: "Paid" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSelectedTab(tab.key as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedTab === tab.key
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right Controls: Search + Pay Selected Bills Button */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-full sm:w-56">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">
              🔍
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search invoice or order #..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
            />
          </div>

          {/* Primary Action Button: Pay Selected Bills (N) */}
          <button
            type="button"
            disabled={selectedBills.length === 0}
            onClick={() => setIsMultiPayOpen(true)}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:opacity-90"
          >
            <span>💳</span>
            <span>Pay Selected Bills ({selectedBills.length})</span>
          </button>
        </div>
      </div>

      {/* Selection Summary Bar (When bills are selected) */}
      {selectedBills.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 px-4 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 animate-in fade-in duration-150">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">
              {selectedBills.length}
            </span>
            <div>
              <p className="text-xs font-bold text-blue-950 dark:text-blue-100">
                {selectedBills.length} Bill{selectedBills.length === 1 ? "" : "s"} Selected for Payment
              </p>
              <p className="text-[11px] text-blue-700 dark:text-blue-300">
                Total Principal: <span className="font-bold">${selectedTotalBalance.toFixed(2)}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setSelectedInvoiceIds(new Set())}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              Clear Selection
            </button>
            <button
              type="button"
              onClick={() => setIsMultiPayOpen(true)}
              className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition-colors cursor-pointer"
            >
              Pay ${selectedTotalBalance.toFixed(2)} Now
            </button>
          </div>
        </div>
      )}

      {/* 3. Bills List / Table */}
      {filteredInvoices.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-12 text-center space-y-3 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center text-2xl mx-auto">
            📄
          </div>
          <div className="max-w-sm mx-auto space-y-1">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              {invoices.length === 0 ? "You're all caught up" : "No bills match your filter"}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {invoices.length === 0
                ? "You have no outstanding invoices or pending payments at this time."
                : "Try clearing your search query or selecting a different status tab."}
            </p>
          </div>
          {invoices.length === 0 && (
            <div className="pt-2">
              <Link
                href="/products"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:opacity-90 shadow-xs transition-opacity"
              >
                <span>Browse Wholesale Catalog</span>
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 overflow-hidden shadow-xs">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[960px]">
              <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                <tr>
                  {/* Multi-selection Checkbox Column */}
                  <th className="w-10 py-3 px-3 text-center">
                    <input
                      type="checkbox"
                      checked={isAllPayableSelected}
                      onChange={toggleSelectAll}
                      disabled={payableFilteredInvoices.length === 0}
                      aria-label="Select all payable bills"
                      className="w-4 h-4 rounded-sm border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-zinc-900 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    />
                  </th>
                  {/* Distinct Independent Columns per Prompt */}
                  <th className="py-3 px-3">Invoice #</th>
                  <th className="py-3 px-3">Issue Date</th>
                  <th className="py-3 px-3">Order #</th>
                  <th className="py-3 px-3">Due Date</th>
                  <th className="py-3 px-3">Terms</th>
                  <th className="py-3 px-3 text-center"># of SKUs</th>
                  <th className="py-3 px-3 text-right">Total</th>
                  <th className="py-3 px-3 text-right">Balance Due</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {filteredInvoices.map((inv) => {
                  const isPayable =
                    Number(inv.balance_due || 0) > 0 &&
                    inv.invoice_status !== "void" &&
                    inv.invoice_status !== "cancelled" &&
                    inv.ar_status !== "PAID";
                  const isSelected = selectedInvoiceIds.has(inv.id);

                  return (
                    <tr
                      key={inv.id}
                      className={`transition-colors ${
                        isSelected
                          ? "bg-blue-50/50 dark:bg-blue-950/20"
                          : "hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40"
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-3 text-center">
                        {isPayable ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleInvoiceSelection(inv.id)}
                            aria-label={`Select invoice ${inv.invoice_number}`}
                            className="w-4 h-4 rounded-sm border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                          />
                        ) : (
                          <span className="text-zinc-300 dark:text-zinc-700 text-xs">—</span>
                        )}
                      </td>

                      {/* Invoice # (NO stacked Issue Date) */}
                      <td className="py-3.5 px-3 font-bold text-zinc-900 dark:text-white">
                        {inv.invoice_number}
                      </td>

                      {/* Issue Date (Independent Column) */}
                      <td className="py-3.5 px-3 text-zinc-600 dark:text-zinc-400 font-medium">
                        {formatDateOnly(inv.invoice_date)}
                      </td>

                      {/* Order # */}
                      <td className="py-3.5 px-3 text-zinc-600 dark:text-zinc-400 font-mono">
                        <Link
                          href={`/orders/${inv.order_id}`}
                          className="hover:text-zinc-900 dark:hover:text-white hover:underline"
                        >
                          {inv.order_number}
                        </Link>
                      </td>

                      {/* Due Date */}
                      <td className="py-3.5 px-3">
                        <p className="font-semibold text-zinc-900 dark:text-white">
                          {formatDateOnly(inv.due_date)}
                        </p>
                        <p
                          className={`text-[10px] font-medium ${
                            inv.ar_status === "PAST_DUE"
                              ? "text-rose-600 dark:text-rose-400"
                              : inv.ar_status === "DUE_SOON"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-zinc-400"
                          }`}
                        >
                          {formatDueRelative(inv.due_date, inv.ar_status)}
                        </p>
                      </td>

                      {/* Terms */}
                      <td className="py-3.5 px-3 text-zinc-600 dark:text-zinc-400 font-medium">
                        {inv.terms_name}
                      </td>

                      {/* # of SKUs (Independent Column) */}
                      <td className="py-3.5 px-3 text-center font-semibold text-zinc-700 dark:text-zinc-300">
                        {inv.total_skus_count ?? 1}
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-3 text-right font-medium text-zinc-700 dark:text-zinc-300">
                        ${inv.total_amount.toFixed(2)}
                      </td>

                      {/* Balance Due */}
                      <td className="py-3.5 px-3 text-right text-sm">
                        {inv.invoice_status === "void" || inv.invoice_status === "cancelled" ? (
                          <div className="flex flex-col items-end">
                            <span className="font-extrabold text-zinc-500 dark:text-zinc-400">$0.00</span>
                            <span className="line-through text-[10px] text-zinc-400 font-medium">
                              Orig. ${inv.total_amount.toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <span className="font-extrabold text-zinc-900 dark:text-white">
                            ${inv.balance_due.toFixed(2)}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 text-center">
                        {getStatusBadge(inv.ar_status, inv.invoice_status)}
                      </td>

                      {/* Action: Only View Bill (Per-row Pay Bill REMOVED per prompt) */}
                      <td className="py-3.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setActiveDetailId(inv.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                        >
                          View Bill
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Responsive Cards */}
          <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
            {filteredInvoices.map((inv) => {
              const isPayable =
                Number(inv.balance_due || 0) > 0 &&
                inv.invoice_status !== "void" &&
                inv.invoice_status !== "cancelled" &&
                inv.ar_status !== "PAID";
              const isSelected = selectedInvoiceIds.has(inv.id);

              return (
                <div
                  key={inv.id}
                  className={`p-4 space-y-3 transition-colors ${
                    isSelected ? "bg-blue-50/40 dark:bg-blue-950/20" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      {isPayable && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleInvoiceSelection(inv.id)}
                          className="mt-1 w-4 h-4 rounded-sm border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                        />
                      )}
                      <div>
                        <span className="font-bold text-sm text-zinc-900 dark:text-white block">
                          {inv.invoice_number}
                        </span>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          Issued {formatDateOnly(inv.invoice_date)} · Order #{inv.order_number}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(inv.ar_status, inv.invoice_status)}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800/60">
                    <div>
                      <span className="text-[10px] text-zinc-400 uppercase font-bold">Due Date</span>
                      <p className="font-semibold text-zinc-900 dark:text-white mt-0.5">
                        {formatDateOnly(inv.due_date)}
                      </p>
                    </div>

                    <div className="text-center">
                      <span className="text-[10px] text-zinc-400 uppercase font-bold">SKUs</span>
                      <p className="font-semibold text-zinc-900 dark:text-white mt-0.5">
                        {inv.total_skus_count ?? 1}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-zinc-400 uppercase font-bold">Balance Due</span>
                      {inv.invoice_status === "void" || inv.invoice_status === "cancelled" ? (
                        <p className="mt-0.5">
                          <span className="text-sm font-extrabold text-zinc-500 dark:text-zinc-400 mr-1">$0.00</span>
                          <span className="line-through text-[10px] text-zinc-400">Orig. ${inv.total_amount.toFixed(2)}</span>
                        </p>
                      ) : (
                        <p className="text-sm font-extrabold text-zinc-900 dark:text-white mt-0.5">
                          ${inv.balance_due.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveDetailId(inv.id)}
                      className="w-full py-2 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 text-center"
                    >
                      View Bill
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bill Detail Modal */}
      {activeDetailId && (
        <BillDetailModal
          invoiceId={activeDetailId}
          isOpen={Boolean(activeDetailId)}
          onClose={() => setActiveDetailId(null)}
          onPayBill={(bill) => {
            setActiveDetailId(null);
            setActivePayBill(bill);
          }}
        />
      )}

      {/* Pay Single Bill Modal (Triggered from Bill Detail if desired) */}
      {activePayBill && (
        <PayBillModal
          bill={activePayBill}
          effectivePolicy={effectivePolicy}
          isOpen={Boolean(activePayBill)}
          onClose={() => setActivePayBill(null)}
        />
      )}

      {/* Multi-Invoice Payment Modal */}
      {isMultiPayOpen && (
        <MultiPayBillModal
          selectedBills={selectedBills}
          effectivePolicy={effectivePolicy}
          isOpen={isMultiPayOpen}
          onClose={() => setIsMultiPayOpen(false)}
        />
      )}
    </div>
  );
}
