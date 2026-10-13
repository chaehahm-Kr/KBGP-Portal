"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { RetailerBillsFeed, RetailerBillSummary, RetailerBillDetail } from "@/lib/retailer/bill-types";
import { BillDetailModal } from "@/components/retailer/bill-detail-modal";
import { PayBillModal } from "@/components/retailer/pay-bill-modal";
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

  const getStatusBadge = (arStatus: string) => {
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

  const formatDueRelative = (dueDateStr: string, arStatus: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(dueDateStr);
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
        {/* Total Due */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 sm:p-5 shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Total Due
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white">
            ${summary.openAR.toFixed(2)}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
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

        {/* Available Credit */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 sm:p-5 shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Available Credit
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
            ${summary.availableCredit.toFixed(2)}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {summary.creditLimit > 0
              ? `Credit Limit: $${summary.creditLimit.toFixed(2)}`
              : "Prepaid Account"}
          </p>
        </div>
      </div>

      {/* 2. Filter Bar & Search */}
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

        {/* Search */}
        <div className="relative w-full sm:w-64">
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
      </div>

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
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Terms</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {filteredInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-bold text-zinc-900 dark:text-white">
                      {inv.invoice_number}
                      <p className="text-[10px] text-zinc-400 font-normal">
                        Issued {new Date(inv.invoice_date).toLocaleDateString()}
                      </p>
                    </td>

                    <td className="py-3.5 px-4 text-zinc-600 dark:text-zinc-400 font-medium">
                      <Link
                        href={`/orders/${inv.order_id}`}
                        className="hover:text-zinc-900 dark:hover:text-white hover:underline"
                      >
                        {inv.order_number}
                      </Link>
                    </td>

                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-zinc-900 dark:text-white">
                        {new Date(inv.due_date).toLocaleDateString()}
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

                    <td className="py-3.5 px-4 text-zinc-600 dark:text-zinc-400 font-medium">
                      {inv.terms_name}
                    </td>

                    <td className="py-3.5 px-4 text-right font-medium text-zinc-700 dark:text-zinc-300">
                      ${inv.total_amount.toFixed(2)}
                    </td>

                    <td className="py-3.5 px-4 text-right font-extrabold text-sm text-zinc-900 dark:text-white">
                      ${inv.balance_due.toFixed(2)}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {getStatusBadge(inv.ar_status)}
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => setActiveDetailId(inv.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                      >
                        View Bill
                      </button>
                      {inv.balance_due > 0 && (
                        <button
                          type="button"
                          onClick={() => setActivePayBill(inv)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-zinc-900 dark:bg-white dark:text-zinc-950 hover:opacity-90 shadow-xs transition-opacity"
                        >
                          Pay Bill
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Responsive Cards */}
          <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
            {filteredInvoices.map((inv) => (
              <div key={inv.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-bold text-sm text-zinc-900 dark:text-white block">
                      {inv.invoice_number}
                    </span>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Order #{inv.order_number} · {inv.terms_name}
                    </p>
                  </div>
                  {getStatusBadge(inv.ar_status)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800/60">
                  <div>
                    <span className="text-[10px] text-zinc-400 uppercase font-bold">Due Date</span>
                    <p className="font-semibold text-zinc-900 dark:text-white mt-0.5">
                      {new Date(inv.due_date).toLocaleDateString()}
                    </p>
                    <p
                      className={`text-[10px] ${
                        inv.ar_status === "PAST_DUE"
                          ? "text-rose-600 font-bold"
                          : inv.ar_status === "DUE_SOON"
                          ? "text-amber-600 font-bold"
                          : "text-zinc-400"
                      }`}
                    >
                      {formatDueRelative(inv.due_date, inv.ar_status)}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-zinc-400 uppercase font-bold">Balance Due</span>
                    <p className="text-base font-extrabold text-zinc-900 dark:text-white mt-0.5">
                      ${inv.balance_due.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-zinc-400">
                      of ${inv.total_amount.toFixed(2)} total
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveDetailId(inv.id)}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 text-center"
                  >
                    View Bill
                  </button>
                  {inv.balance_due > 0 && (
                    <button
                      type="button"
                      onClick={() => setActivePayBill(inv)}
                      className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-zinc-900 dark:bg-white dark:text-zinc-950 text-center shadow-xs"
                    >
                      Pay Bill
                    </button>
                  )}
                </div>
              </div>
            ))}
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

      {/* Pay Bill Modal */}
      {activePayBill && (
        <PayBillModal
          bill={activePayBill}
          effectivePolicy={effectivePolicy}
          isOpen={Boolean(activePayBill)}
          onClose={() => setActivePayBill(null)}
        />
      )}
    </div>
  );
}
