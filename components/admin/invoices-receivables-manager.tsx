"use client";

import React, { useState, useMemo } from "react";
import {
  type RetailerInvoice,
  type GlobalARSummary,
  type ARStatus,
} from "@/lib/finance/invoice-types";
import {
  issueInvoiceForOrderAction,
  voidInvoiceAction,
  getAdminInvoiceDetailAction,
} from "@/lib/finance/invoice-actions";

interface InvoicesReceivablesManagerProps {
  initialInvoices: RetailerInvoice[];
  initialSummary: GlobalARSummary;
  eligibleOrders: Array<{
    id: string;
    order_number: string;
    company_id: string;
    company_name: string;
    company_code?: string;
    order_status: string;
    payment_method: string;
    payment_terms?: string;
    total_amount: number;
    created_at: string;
  }>;
}

export function InvoicesReceivablesManager({
  initialInvoices,
  initialSummary,
  eligibleOrders: initialEligibleOrders,
}: InvoicesReceivablesManagerProps) {
  const [invoices, setInvoices] = useState<RetailerInvoice[]>(initialInvoices);
  const [summary, setSummary] = useState<GlobalARSummary>(initialSummary);
  const [eligibleOrders, setEligibleOrders] = useState(initialEligibleOrders);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Issue Invoice Modal State
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [issueNotes, setIssueNotes] = useState<string>("");
  const [customDueDays, setCustomDueDays] = useState<string>("");
  const [isIssuing, setIsIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);

  // Detail Modal State
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState<any | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Void confirmation state
  const [isVoiding, setIsVoiding] = useState<string | null>(null);

  // Compute live tab counts
  const tabCounts = useMemo(() => {
    let open = 0;
    let dueSoon = 0;
    let pastDue = 0;
    let paid = 0;

    for (const inv of invoices) {
      if (inv.ar_status === "OPEN") open++;
      else if (inv.ar_status === "DUE_SOON") dueSoon++;
      else if (inv.ar_status === "PAST_DUE") pastDue++;
      else if (inv.ar_status === "PAID") paid++;
    }

    return { all: invoices.length, open, dueSoon, pastDue, paid };
  }, [invoices]);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Tab filter
      if (activeTab === "open" && inv.ar_status !== "OPEN" && inv.ar_status !== "DUE_SOON") return false;
      if (activeTab === "due_soon" && inv.ar_status !== "DUE_SOON") return false;
      if (activeTab === "past_due" && inv.ar_status !== "PAST_DUE") return false;
      if (activeTab === "paid" && inv.ar_status !== "PAID") return false;

      // Date range filter
      if (startDate && inv.invoice_date < startDate) return false;
      if (endDate && inv.invoice_date > endDate) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesNumber = inv.invoice_number.toLowerCase().includes(q);
        const matchesOrder = inv.order?.order_number?.toLowerCase().includes(q);
        const matchesRetailer = inv.retailer?.name?.toLowerCase().includes(q);
        const matchesCode = inv.retailer?.company_code?.toLowerCase().includes(q);
        if (!matchesNumber && !matchesOrder && !matchesRetailer && !matchesCode) {
          return false;
        }
      }

      return true;
    });
  }, [invoices, activeTab, searchQuery, startDate, endDate]);

  const handleOpenIssueModal = () => {
    setSelectedOrderId(eligibleOrders[0]?.id || "");
    setIssueNotes("");
    setCustomDueDays("");
    setIssueError(null);
    setIsIssueModalOpen(true);
  };

  const handleIssueInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) {
      setIssueError("Please select an order to issue an invoice.");
      return;
    }

    setIsIssuing(true);
    setIssueError(null);

    try {
      const res = await issueInvoiceForOrderAction(selectedOrderId, {
        notes: issueNotes.trim() || undefined,
        customDueDays: customDueDays ? parseInt(customDueDays, 10) : undefined,
      });

      if (!res.success || !res.invoice) {
        throw new Error(res.error || "Failed to create invoice");
      }

      // Add new invoice to list
      const targetOrder = eligibleOrders.find((o) => o.id === selectedOrderId);
      const newInvFormatted: RetailerInvoice = {
        ...res.invoice,
        retailer: targetOrder
          ? {
              id: targetOrder.company_id,
              name: targetOrder.company_name,
              company_code: targetOrder.company_code,
            }
          : undefined,
        order: targetOrder
          ? {
              id: targetOrder.id,
              order_number: targetOrder.order_number,
              order_status: targetOrder.order_status,
              total_amount: targetOrder.total_amount,
            }
          : undefined,
        ar_status: res.invoice.balance_due > 0 ? "OPEN" : "PAID",
      };

      setInvoices((prev) => [newInvFormatted, ...prev]);
      setEligibleOrders((prev) => prev.filter((o) => o.id !== selectedOrderId));

      // Update summary
      setSummary((prev) => ({
        ...prev,
        totalOpenAR: prev.totalOpenAR + Number(res.invoice!.balance_due || 0),
        openInvoiceCount: prev.openInvoiceCount + (res.invoice!.balance_due > 0 ? 1 : 0),
        paidInvoiceCount: prev.paidInvoiceCount + (res.invoice!.balance_due <= 0 ? 1 : 0),
      }));

      setIsIssueModalOpen(false);
    } catch (err: any) {
      setIssueError(err.message || "Failed to issue invoice");
    } finally {
      setIsIssuing(false);
    }
  };

  const handleOpenDetailModal = async (inv: RetailerInvoice) => {
    setIsDetailModalOpen(true);
    setIsLoadingDetail(true);
    setSelectedInvoiceDetail(inv);

    try {
      const res = await getAdminInvoiceDetailAction(inv.id);
      if (res.success && res.invoice) {
        setSelectedInvoiceDetail(res.invoice);
      }
    } catch (err) {
      console.error("Failed to fetch invoice detail:", err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleVoidInvoice = async (invoiceId: string) => {
    if (!confirm("Are you sure you want to void this invoice? This action cannot be reversed.")) {
      return;
    }

    setIsVoiding(invoiceId);
    try {
      const res = await voidInvoiceAction(invoiceId, "Voided by administrator");
      if (!res.success) throw new Error(res.error);

      setInvoices((prev) =>
        prev.map((i) =>
          i.id === invoiceId
            ? { ...i, invoice_status: "void", ar_status: "VOID" as ARStatus }
            : i
        )
      );

      // Recompute summary
      const target = invoices.find((i) => i.id === invoiceId);
      if (target && target.balance_due > 0) {
        setSummary((prev) => ({
          ...prev,
          totalOpenAR: Math.max(0, prev.totalOpenAR - target.balance_due),
          openInvoiceCount: Math.max(0, prev.openInvoiceCount - 1),
        }));
      }
    } catch (err: any) {
      alert(err.message || "Failed to void invoice");
    } finally {
      setIsVoiding(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
            Invoices & Accounts Receivable (AR)
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Manage retailer Net Terms invoices, due dates, payment status, and network receivables.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenIssueModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <span>+ Issue Invoice</span>
        </button>
      </div>

      {/* AR KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total Open AR */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400">
            Total Open AR
          </div>
          <div className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white mt-1">
            ${summary.totalOpenAR.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
            {summary.openInvoiceCount} active open invoices
          </div>
        </div>

        {/* Past Due */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-rose-200/80 dark:border-rose-900/50 shadow-xs bg-rose-50/20">
          <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-rose-500">
            Past Due Amount
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            ${summary.totalPastDueAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-rose-500/80 mt-1 font-semibold">
            {summary.pastDueInvoiceCount} overdue invoices
          </div>
        </div>

        {/* Due Soon (<= 7 days) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-amber-200/80 dark:border-amber-900/50 shadow-xs bg-amber-50/20">
          <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-500">
            Due Soon (7 Days)
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            ${summary.totalDueSoonAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-amber-600/80 mt-1 font-medium">
            Requires upcoming collection
          </div>
        </div>

        {/* Paid Invoices */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-emerald-200/80 dark:border-emerald-900/50 shadow-xs bg-emerald-50/20">
          <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-500">
            Settled / Paid
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {summary.paidInvoiceCount}
          </div>
          <div className="text-[11px] text-emerald-600/80 mt-1 font-medium">
            Invoices fully settled
          </div>
        </div>
      </div>

      {/* Tabs, Search & Date Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Status Tabs */}
        <div className="inline-flex p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 overflow-x-auto max-w-full shrink-0">
          {[
            { id: "all", label: "All Invoices", count: tabCounts.all },
            { id: "open", label: "Open", count: tabCounts.open },
            { id: "due_soon", label: "Due Soon", count: tabCounts.dueSoon },
            { id: "past_due", label: "Past Due", count: tabCounts.pastDue },
            { id: "paid", label: "Paid", count: tabCounts.paid },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeTab === tab.id
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                  : "bg-zinc-200/60 dark:bg-zinc-700/60 text-zinc-500"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Date Range */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 flex-1 max-w-2xl justify-end">
          <input
            type="text"
            placeholder="Search invoice #, order #, retailer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-hidden focus:border-indigo-500"
          />
          <div className="flex items-center gap-1 shrink-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-2 py-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs bg-transparent border-0 text-zinc-900 dark:text-white focus:outline-hidden"
            />
          </div>
          <div className="flex items-center gap-1 shrink-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-2 py-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs bg-transparent border-0 text-zinc-900 dark:text-white focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Main Invoices Table */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Retailer</th>
                <th className="py-3 px-4">Order #</th>
                <th className="py-3 px-4">Invoice Date</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Terms</th>
                <th className="py-3 px-4 text-right">Invoice Total</th>
                <th className="py-3 px-4 text-right">Amount Paid</th>
                <th className="py-3 px-4 text-right">Balance Due</th>
                <th className="py-3 px-4 text-center">AR Status</th>
                <th className="py-3 px-4 text-center">Payment</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-zinc-400">
                    No invoices match your selected criteria.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                      onClick={() => handleOpenDetailModal(inv)}
                    >
                      {/* Invoice # */}
                      <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                        {inv.invoice_number}
                      </td>

                      {/* Retailer */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-zinc-900 dark:text-white truncate max-w-[160px]">
                          {inv.retailer?.name || "Unknown Retailer"}
                        </div>
                        {inv.retailer?.company_code && (
                          <div className="text-[10px] font-mono text-zinc-400">
                            {inv.retailer.company_code}
                          </div>
                        )}
                      </td>

                      {/* Order # & Dispatch */}
                      <td className="py-3 px-4 font-mono text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                        <div>{inv.order?.order_number || "-"}</div>
                        {inv.fulfillment_number && (
                          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-sans font-medium flex items-center gap-0.5 mt-0.5">
                            <span>🚚</span>
                            <span>{inv.fulfillment_number}</span>
                          </div>
                        )}
                      </td>

                      {/* Invoice Date */}
                      <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                        {inv.invoice_date}
                      </td>

                      {/* Due Date */}
                      <td className="py-3 px-4 text-zinc-900 dark:text-white font-medium whitespace-nowrap">
                        {inv.due_date}
                      </td>

                      {/* Terms */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                          {inv.terms_name}
                        </span>
                      </td>

                      {/* Invoice Total */}
                      <td className="py-3 px-4 text-right font-medium text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                        ${inv.total_amount.toFixed(2)}
                      </td>

                      {/* Amount Paid */}
                      <td className="py-3 px-4 text-right font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        ${inv.amount_paid.toFixed(2)}
                      </td>

                      {/* Balance Due */}
                      <td className="py-3 px-4 text-right font-bold text-zinc-900 dark:text-white whitespace-nowrap">
                        {inv.ar_status === "VOID" || inv.invoice_status === "void" || inv.invoice_status === "cancelled" ? (
                          <div className="flex flex-col items-end">
                            <span className="text-zinc-500 dark:text-zinc-400">$0.00</span>
                            <span className="text-[10px] font-normal text-zinc-400 line-through">
                              Orig. ${inv.total_amount.toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          `$${inv.balance_due.toFixed(2)}`
                        )}
                      </td>

                      {/* AR Status */}
                      <td className="py-3 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.ar_status === "PAID"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : inv.ar_status === "PAST_DUE"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              : inv.ar_status === "DUE_SOON"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : inv.ar_status === "VOID"
                              ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                              : "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                          }`}
                        >
                          {inv.ar_status === "DUE_SOON" ? "Due Soon" : inv.ar_status === "PAST_DUE" ? "Past Due" : inv.ar_status}
                        </span>
                      </td>

                      {/* Payment Status */}
                      <td className="py-3 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold capitalize ${
                            inv.payment_status === "paid"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : inv.payment_status === "partial"
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          {inv.payment_status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenDetailModal(inv)}
                            className="px-2 py-1 rounded text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 font-bold hover:bg-indigo-50 dark:hover:bg-zinc-800 cursor-pointer"
                          >
                            View
                          </button>
                          {inv.invoice_status !== "void" && inv.invoice_status !== "paid" && (
                            <button
                              type="button"
                              disabled={isVoiding === inv.id}
                              onClick={() => handleVoidInvoice(inv.id)}
                              className="px-2 py-1 rounded text-rose-500 hover:text-rose-700 font-medium hover:bg-rose-50 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
                            >
                              {isVoiding === inv.id ? "Voiding..." : "Void"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ISSUE INVOICE MODAL */}
      {isIssueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-lg w-full flex flex-col max-h-[90vh] border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
            {/* STICKY HEADER */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                  Issue Net Terms Invoice
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Generate an official invoice document for a retailer Net Terms order.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsIssueModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* MODAL BODY */}
            <form id="issue-form" onSubmit={handleIssueInvoice} className="flex-1 overflow-y-auto p-6 space-y-4">
              {issueError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 font-medium">
                  ⚠️ {issueError}
                </div>
              )}

              {eligibleOrders.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500">
                  There are currently no uninvoiced orders available.
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      Select Order to Invoice *
                    </label>
                    <select
                      value={selectedOrderId}
                      onChange={(e) => setSelectedOrderId(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-hidden focus:border-indigo-500"
                    >
                      {eligibleOrders.map((ord) => (
                        <option key={ord.id} value={ord.id}>
                          {ord.order_number} — {ord.company_name} (${ord.total_amount.toFixed(2)}) [{ord.payment_method.toUpperCase()}]
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Order Preview Card */}
                  {selectedOrderId && (() => {
                    const sel = eligibleOrders.find((o) => o.id === selectedOrderId);
                    if (!sel) return null;
                    return (
                      <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/80 space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Retailer:</span>
                          <span className="font-bold text-zinc-900 dark:text-white">{sel.company_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Order Total:</span>
                          <span className="font-bold text-zinc-900 dark:text-white">${sel.total_amount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Payment Method:</span>
                          <span className="font-semibold uppercase text-indigo-600 dark:text-indigo-400">{sel.payment_method}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Snapshot Terms:</span>
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">{sel.payment_terms || "Net 30"}</span>
                        </div>
                      </div>
                    );
                  })()}

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      Terms Due Days Override (Optional)
                    </label>
                    <input
                      type="number"
                      placeholder="Leave blank to use order snapshot terms (e.g. 30)"
                      value={customDueDays}
                      onChange={(e) => setCustomDueDays(e.target.value)}
                      min="1"
                      max="180"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                    />
                    <p className="text-[11px] text-zinc-500 mt-1">
                      Defaults to the historical Terms snapshot agreed at order checkout.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      Internal Notes
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Optional notes for accounting / audit log"
                      value={issueNotes}
                      onChange={(e) => setIssueNotes(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>
              )}
            </form>

            {/* STICKY FOOTER */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/90 shrink-0">
              <button
                type="button"
                onClick={() => setIsIssueModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="issue-form"
                disabled={isIssuing || eligibleOrders.length === 0}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isIssuing ? "Issuing..." : "Confirm & Issue Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INVOICE DETAIL MODAL */}
      {isDetailModalOpen && selectedInvoiceDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-3xl w-full flex flex-col max-h-[92vh] border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
            {/* STICKY HEADER */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-900">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold font-mono text-zinc-900 dark:text-white">
                    {selectedInvoiceDetail.invoice_number}
                  </h2>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedInvoiceDetail.ar_status === "PAID"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : selectedInvoiceDetail.ar_status === "PAST_DUE"
                        ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                        : selectedInvoiceDetail.ar_status === "DUE_SOON"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                    }`}
                  >
                    {selectedInvoiceDetail.ar_status}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Issued on {selectedInvoiceDetail.invoice_date} • Due on {selectedInvoiceDetail.due_date} ({selectedInvoiceDetail.terms_name})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* SCROLLABLE BODY */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {isLoadingDetail ? (
                <div className="py-12 text-center text-xs text-zinc-400">Loading invoice details...</div>
              ) : (
                <>
                  {/* Retailer & Billing Snapshot */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 text-xs">
                    <div>
                      <div className="text-[10px] font-bold uppercase text-zinc-400">Bill To (Retailer)</div>
                      <div className="text-sm font-bold text-zinc-900 dark:text-white mt-1">
                        {selectedInvoiceDetail.companies?.name || selectedInvoiceDetail.retailer?.name || "Retailer Partner"}
                      </div>
                      <div className="text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
                        {selectedInvoiceDetail.billing_snapshot?.address || "Address on file"}<br />
                        {selectedInvoiceDetail.billing_snapshot?.city && `${selectedInvoiceDetail.billing_snapshot.city}, `}
                        {selectedInvoiceDetail.billing_snapshot?.state} {selectedInvoiceDetail.billing_snapshot?.zip}
                      </div>
                      {selectedInvoiceDetail.billing_snapshot?.contact_name && (
                        <div className="text-zinc-500 mt-1">
                          Attn: {selectedInvoiceDetail.billing_snapshot.contact_name}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="text-[10px] font-bold uppercase text-zinc-400">Invoice Information</div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-zinc-500">Related Order:</span>
                        <span className="font-mono font-bold text-zinc-900 dark:text-white">
                          {selectedInvoiceDetail.retailer_orders?.order_number || selectedInvoiceDetail.order?.order_number}
                        </span>
                      </div>
                      {selectedInvoiceDetail.fulfillment_number && (
                        <div className="flex justify-between py-0.5">
                          <span className="text-zinc-500">Related Dispatch:</span>
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            🚚 {selectedInvoiceDetail.fulfillment_number}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between py-0.5">
                        <span className="text-zinc-500">Invoice Date:</span>
                        <span className="font-medium text-zinc-900 dark:text-white">{selectedInvoiceDetail.invoice_date}</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-zinc-500">Payment Due Date:</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{selectedInvoiceDetail.due_date}</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-zinc-500">Payment Terms:</span>
                        <span className="font-semibold text-zinc-900 dark:text-white">{selectedInvoiceDetail.terms_name}</span>
                      </div>
                    </div>
                  </div>

                  {/* Line Items */}
                  {selectedInvoiceDetail.items && selectedInvoiceDetail.items.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                        Order Line Items ({selectedInvoiceDetail.items.length})
                      </div>
                      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden text-xs">
                        <table className="w-full text-left">
                          <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-bold text-zinc-400">
                            <tr>
                              <th className="py-2.5 px-3">Item / SKU</th>
                              <th className="py-2.5 px-3 text-center">Qty</th>
                              <th className="py-2.5 px-3 text-right">Unit Price</th>
                              <th className="py-2.5 px-3 text-right">Line Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {selectedInvoiceDetail.items.map((item: any) => (
                              <tr key={item.id}>
                                <td className="py-2 px-3">
                                  <div className="font-medium text-zinc-900 dark:text-white">{item.product_name}</div>
                                  <div className="font-mono text-[10px] text-zinc-400">{item.sku}</div>
                                </td>
                                <td className="py-2 px-3 text-center font-bold">{item.quantity}</td>
                                <td className="py-2 px-3 text-right">${Number(item.unit_wholesale_price || 0).toFixed(2)}</td>
                                <td className="py-2 px-3 text-right font-bold">${Number(item.line_total || 0).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Financial Breakdown & Balances */}
                  <div className="flex justify-end">
                    <div className="w-full max-w-xs space-y-1.5 text-xs">
                      <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                        <span>Subtotal:</span>
                        <span>${Number(selectedInvoiceDetail.subtotal || 0).toFixed(2)}</span>
                      </div>
                      {Number(selectedInvoiceDetail.discount_total || 0) > 0 && (
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                          <span>Discount:</span>
                          <span>-${Number(selectedInvoiceDetail.discount_total).toFixed(2)}</span>
                        </div>
                      )}
                      {Number(selectedInvoiceDetail.shipping || 0) > 0 && (
                        <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                          <span>Shipping:</span>
                          <span>${Number(selectedInvoiceDetail.shipping).toFixed(2)}</span>
                        </div>
                      )}
                      {Number(selectedInvoiceDetail.tax || 0) > 0 && (
                        <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                          <span>Tax:</span>
                          <span>${Number(selectedInvoiceDetail.tax).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-sm text-zinc-900 dark:text-white pt-2 border-t border-zinc-200 dark:border-zinc-800">
                        <span>Total Invoice:</span>
                        <span>${Number(selectedInvoiceDetail.total_amount || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-emerald-600 dark:text-emerald-400">
                        <span>Amount Paid:</span>
                        <span>${Number(selectedInvoiceDetail.amount_paid || 0).toFixed(2)}</span>
                      </div>
                      {Number(selectedInvoiceDetail.prepayment_allocated_amount || 0) > 0 && (
                        <div className="flex justify-between text-indigo-600 dark:text-indigo-400 text-[11px] font-medium">
                          <span>(Prepayment Allocated):</span>
                          <span>-${Number(selectedInvoiceDetail.prepayment_allocated_amount).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-black text-sm text-indigo-600 dark:text-indigo-400 pt-1 border-t border-dashed border-zinc-200 dark:border-zinc-800">
                        <span>Balance Due:</span>
                        {selectedInvoiceDetail.ar_status === "VOID" || selectedInvoiceDetail.invoice_status === "void" || selectedInvoiceDetail.invoice_status === "cancelled" ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="text-zinc-500 dark:text-zinc-400">$0.00</span>
                            <span className="text-xs font-normal text-zinc-400 line-through">
                              (Orig. ${Number(selectedInvoiceDetail.total_amount || 0).toFixed(2)})
                            </span>
                          </span>
                        ) : (
                          <span>${Number(selectedInvoiceDetail.balance_due || 0).toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Payment History Foundation */}
                  <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                    <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                      Payment History / Transactions
                    </div>
                    {selectedInvoiceDetail.payments && selectedInvoiceDetail.payments.length > 0 ? (
                      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden text-xs">
                        <table className="w-full text-left">
                          <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-bold text-zinc-400">
                            <tr>
                              <th className="py-2 px-3">Date</th>
                              <th className="py-2 px-3">Method</th>
                              <th className="py-2 px-3">Status</th>
                              <th className="py-2 px-3 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {selectedInvoiceDetail.payments.map((p: any) => (
                              <tr key={p.id}>
                                <td className="py-2 px-3 text-zinc-500">
                                  {new Date(p.created_at).toLocaleDateString()}
                                </td>
                                <td className="py-2 px-3 font-semibold uppercase">{p.payment_method}</td>
                                <td className="py-2 px-3 capitalize font-bold text-emerald-600">{p.status}</td>
                                <td className="py-2 px-3 text-right font-bold">${Number(p.amount || 0).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="py-4 text-center text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                        No payments recorded against this invoice yet.
                      </div>
                    )}
                  </div>

                  {/* Prepayment Allocations Audit Trail */}
                  {selectedInvoiceDetail.allocations && selectedInvoiceDetail.allocations.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                      <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                        <span>💳</span>
                        <span>Prepayment Allocations ({selectedInvoiceDetail.allocations.length})</span>
                      </div>
                      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden text-xs">
                        <table className="w-full text-left">
                          <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-bold text-zinc-400">
                            <tr>
                              <th className="py-2 px-3">Allocated Date</th>
                              <th className="py-2 px-3">Notes</th>
                              <th className="py-2 px-3 text-right">Allocated Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {selectedInvoiceDetail.allocations.map((a: any) => (
                              <tr key={a.id}>
                                <td className="py-2 px-3 text-zinc-500">
                                  {new Date(a.allocated_at || a.created_at).toLocaleDateString()}
                                </td>
                                <td className="py-2 px-3 text-zinc-700 dark:text-zinc-300">
                                  {a.notes || "Prepayment auto-allocated to dispatch invoice"}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                  ${Number(a.allocated_amount || 0).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* STICKY FOOTER */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/90 shrink-0">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
