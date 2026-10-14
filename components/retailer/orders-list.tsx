"use client";

import React, { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import {
  RetailerOrderSummary,
  GetRetailerOrdersFilter,
  getRetailerOrdersAction,
} from "@/lib/retailer/orders";
import { useTranslation } from "@/lib/i18n";
import { CalendarDatePicker } from "@/components/shared/calendar-date-picker";
import { TrackingPopover } from "@/components/retailer/tracking-popover";

interface OrdersListProps {
  orders?: RetailerOrderSummary[];
  initialOrders?: RetailerOrderSummary[];
  initialFilters?: GetRetailerOrdersFilter;
}

const FULFILLMENT_OPTIONS = [
  { key: "submitted", label: "Submitted" },
  { key: "processing", label: "Processing" },
  { key: "partially_shipped", label: "Partially Shipped" },
  { key: "shipped", label: "Shipped" },
  { key: "partially_cancelled", label: "Partially Cancelled" },
  { key: "cancelled", label: "Cancelled" },
];

const PAYMENT_METHOD_OPTIONS = [
  { key: "card", label: "Credit Card", icon: "💳" },
  { key: "ach", label: "ACH", icon: "🏦" },
  { key: "terms", label: "Net Terms", icon: "📄" },
];

const INVOICE_STATUS_OPTIONS = [
  { key: "paid", label: "Paid" },
  { key: "unpaid", label: "Unpaid" },
  { key: "partially_paid", label: "Partially Paid" },
  { key: "not_issued", label: "Not Issued" },
  { key: "void", label: "Void" },
];

export function RetailerOrdersList({
  orders: propOrders,
  initialOrders,
  initialFilters,
}: OrdersListProps) {
  const { t, locale } = useTranslation();

  const [orders, setOrders] = useState<RetailerOrderSummary[]>(
    initialOrders || propOrders || []
  );
  const [isPending, startTransition] = useTransition();

  // Filter States
  const [searchTerm, setSearchTerm] = useState(initialFilters?.search || "");
  const [skuTerm, setSkuTerm] = useState(initialFilters?.sku || "");
  const [startDate, setStartDate] = useState(initialFilters?.startDate || "");
  const [endDate, setEndDate] = useState(initialFilters?.endDate || "");

  const [selectedOrderStatuses, setSelectedOrderStatuses] = useState<string[]>(() => {
    if (initialFilters?.orderStatuses && initialFilters.orderStatuses.length > 0) {
      return initialFilters.orderStatuses.map((s) => s.toLowerCase());
    }
    if (initialFilters?.orderStatus && initialFilters.orderStatus !== "all") {
      return initialFilters.orderStatus
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    }
    return [];
  });

  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>(() => {
    if (initialFilters?.paymentMethods && initialFilters.paymentMethods.length > 0) {
      return initialFilters.paymentMethods.map((m) => m.toLowerCase());
    }
    return [];
  });

  const [selectedInvoiceStatuses, setSelectedInvoiceStatuses] = useState<string[]>(() => {
    if (initialFilters?.invoiceStatuses && initialFilters.invoiceStatuses.length > 0) {
      return initialFilters.invoiceStatuses.map((s) => s.toLowerCase());
    }
    if (initialFilters?.paymentStatus && initialFilters.paymentStatus !== "all") {
      return initialFilters.paymentStatus
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    }
    return [];
  });

  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
      skuTerm.trim() ||
      startDate ||
      endDate ||
      selectedOrderStatuses.length > 0 ||
      selectedPaymentMethods.length > 0 ||
      selectedInvoiceStatuses.length > 0
  );

  // Synchronize when parent prop orders update
  useEffect(() => {
    if (propOrders && !hasActiveFilters) {
      setOrders(propOrders);
    }
  }, [propOrders, hasActiveFilters]);

  // Sync URL parameters without page refresh
  const syncUrlParams = (params: {
    search?: string;
    sku?: string;
    startDate?: string;
    endDate?: string;
    orderStatuses?: string[];
    paymentMethods?: string[];
    invoiceStatuses?: string[];
  }) => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      if (params.search) url.searchParams.set("search", params.search);
      else url.searchParams.delete("search");

      if (params.sku) url.searchParams.set("sku", params.sku);
      else url.searchParams.delete("sku");

      if (params.startDate) url.searchParams.set("startDate", params.startDate);
      else url.searchParams.delete("startDate");

      if (params.endDate) url.searchParams.set("endDate", params.endDate);
      else url.searchParams.delete("endDate");

      if (params.orderStatuses && params.orderStatuses.length > 0) {
        url.searchParams.set("orderStatus", params.orderStatuses.join(","));
      } else {
        url.searchParams.delete("orderStatus");
      }

      if (params.paymentMethods && params.paymentMethods.length > 0) {
        url.searchParams.set("paymentMethod", params.paymentMethods.join(","));
      } else {
        url.searchParams.delete("paymentMethod");
      }

      if (params.invoiceStatuses && params.invoiceStatuses.length > 0) {
        url.searchParams.set("invoiceStatus", params.invoiceStatuses.join(","));
      } else {
        url.searchParams.delete("invoiceStatus");
        url.searchParams.delete("paymentStatus");
      }

      window.history.replaceState(null, "", url.toString());
    } catch (e) {
      // ignore
    }
  };

  // Execute server query
  const executeFilterQuery = (customFilters?: {
    search?: string;
    sku?: string;
    startDate?: string;
    endDate?: string;
    orderStatuses?: string[];
    paymentMethods?: string[];
    invoiceStatuses?: string[];
  }) => {
    const nextSearch = customFilters?.search !== undefined ? customFilters.search : searchTerm.trim();
    const nextSku = customFilters?.sku !== undefined ? customFilters.sku : skuTerm.trim();
    const nextStartDate = customFilters?.startDate !== undefined ? customFilters.startDate : startDate;
    const nextEndDate = customFilters?.endDate !== undefined ? customFilters.endDate : endDate;
    const nextOrderStatuses = customFilters?.orderStatuses !== undefined ? customFilters.orderStatuses : selectedOrderStatuses;
    const nextPaymentMethods = customFilters?.paymentMethods !== undefined ? customFilters.paymentMethods : selectedPaymentMethods;
    const nextInvoiceStatuses = customFilters?.invoiceStatuses !== undefined ? customFilters.invoiceStatuses : selectedInvoiceStatuses;

    syncUrlParams({
      search: nextSearch,
      sku: nextSku,
      startDate: nextStartDate,
      endDate: nextEndDate,
      orderStatuses: nextOrderStatuses,
      paymentMethods: nextPaymentMethods,
      invoiceStatuses: nextInvoiceStatuses,
    });

    startTransition(async () => {
      const activeQuery: GetRetailerOrdersFilter = {
        search: nextSearch || undefined,
        sku: nextSku || undefined,
        startDate: nextStartDate || undefined,
        endDate: nextEndDate || undefined,
        orderStatuses: nextOrderStatuses.length > 0 ? nextOrderStatuses : undefined,
        paymentMethods: nextPaymentMethods.length > 0 ? nextPaymentMethods : undefined,
        invoiceStatuses: nextInvoiceStatuses.length > 0 ? nextInvoiceStatuses : undefined,
      };

      const results = await getRetailerOrdersAction(activeQuery);
      setOrders(results);
    });
  };

  const toggleOrderStatus = (status: string) => {
    const normalized = status.toLowerCase();
    const next = selectedOrderStatuses.includes(normalized)
      ? selectedOrderStatuses.filter((s) => s !== normalized)
      : [...selectedOrderStatuses, normalized];
    setSelectedOrderStatuses(next);
    executeFilterQuery({ orderStatuses: next });
  };

  const togglePaymentMethod = (method: string) => {
    const normalized = method.toLowerCase();
    const next = selectedPaymentMethods.includes(normalized)
      ? selectedPaymentMethods.filter((m) => m !== normalized)
      : [...selectedPaymentMethods, normalized];
    setSelectedPaymentMethods(next);
    executeFilterQuery({ paymentMethods: next });
  };

  const toggleInvoiceStatus = (invStatus: string) => {
    const normalized = invStatus.toLowerCase();
    const next = selectedInvoiceStatuses.includes(normalized)
      ? selectedInvoiceStatuses.filter((s) => s !== normalized)
      : [...selectedInvoiceStatuses, normalized];
    setSelectedInvoiceStatuses(next);
    executeFilterQuery({ invoiceStatuses: next });
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setSkuTerm("");
    setStartDate("");
    setEndDate("");
    setSelectedOrderStatuses([]);
    setSelectedPaymentMethods([]);
    setSelectedInvoiceStatuses([]);

    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        url.search = "";
        window.history.replaceState(null, "", url.toString());
      } catch (e) {
        // ignore
      }
    }

    startTransition(async () => {
      const results = await getRetailerOrdersAction({});
      setOrders(results);
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "submitted":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/20">
            {t.status.submitted || "Submitted"}
          </span>
        );
      case "confirmed":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
            {t.status.confirmed || "Confirmed"}
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            {t.status.processing || "Processing"}
          </span>
        );
      case "partially_shipped":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
            Partially Shipped
          </span>
        );
      case "shipped":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            {t.status.shipped || "Shipped"}
          </span>
        );
      case "delivered":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            {t.status.delivered || "Delivered"}
          </span>
        );
      case "partially_cancelled":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-500/20">
            Partially Cancelled
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/20">
            {t.status.cancelled || "Cancelled"}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 border border-zinc-500/20">
            {status}
          </span>
        );
    }
  };

  const getPaymentBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "paid":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            {t.status.paid}
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400">
            {t.status.paymentPending}
          </span>
        );
      case "unpaid":
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
            {t.status.unpaid}
          </span>
        );
    }
  };

  const renderPaymentMethod = (order: RetailerOrderSummary) => {
    const snap = order.paymentSnapshot as any;
    const method = snap?.payment_method || snap?.method || order.paymentMethod;

    if (method === "card") {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
          <span>💳</span>
          <span>Card</span>
        </span>
      );
    }
    if (method === "ach") {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
          <span>🏦</span>
          <span>ACH</span>
        </span>
      );
    }
    if (method === "terms" || (order.paymentTerms && order.paymentTerms.toLowerCase().includes("net"))) {
      const termsLabel = order.paymentTerms ? order.paymentTerms.replace(/_/g, " ") : "Net Terms";
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
          <span>📄</span>
          <span>{termsLabel}</span>
        </span>
      );
    }
    if (order.paymentTerms && order.paymentTerms.toLowerCase().includes("prepaid")) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
          <span>⚡</span>
          <span>Prepaid</span>
        </span>
      );
    }
    return (
      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
        {order.paymentTerms || "Standard"}
      </span>
    );
  };

  const resolveOrderInvoiceStatus = (order: RetailerOrderSummary): {
    status: string;
    badgeClass: string;
    invoiceNumbers: string[];
  } => {
    if (order.invoiceSummary) {
      const s = order.invoiceSummary.status;
      let badgeClass = "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700";
      if (s === "paid") {
        badgeClass = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800";
      } else if (s === "unpaid") {
        badgeClass = "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800";
      } else if (s === "partially_paid") {
        badgeClass = "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800";
      } else if (s === "void") {
        badgeClass = "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800";
      }
      return {
        status: order.invoiceSummary.displayStatus,
        badgeClass,
        invoiceNumbers: order.invoiceSummary.invoices.map((i) => i.invoiceNumber),
      };
    }

    const invs = order.invoices || [];
    if (invs.length === 0) {
      return {
        status: "Not Issued",
        badgeClass: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700",
        invoiceNumbers: [],
      };
    }

    const activeInvoices = invs.filter(
      (inv) => !["void", "cancelled"].includes(inv.invoiceStatus?.toLowerCase())
    );
    const voidInvoices = invs.filter(
      (inv) => ["void", "cancelled"].includes(inv.invoiceStatus?.toLowerCase())
    );

    if (activeInvoices.length === 0) {
      if (voidInvoices.length > 0) {
        return {
          status: "Void",
          badgeClass: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800",
          invoiceNumbers: voidInvoices.map((i) => i.invoiceNumber),
        };
      }
      return {
        status: "Not Issued",
        badgeClass: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700",
        invoiceNumbers: [],
      };
    }

    const hasFailed = activeInvoices.some((i) => i.paymentStatus?.toLowerCase() === "failed");
    if (hasFailed) {
      return {
        status: "Failed",
        badgeClass: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800",
        invoiceNumbers: activeInvoices.map((i) => i.invoiceNumber),
      };
    }

    const hasPending = activeInvoices.some((i) => i.paymentStatus?.toLowerCase() === "pending");

    const paidInvoices = activeInvoices.filter(
      (i) => i.invoiceStatus?.toLowerCase() === "paid" || i.paymentStatus?.toLowerCase() === "paid" || Number(i.balanceDue || 0) <= 0
    );

    if (paidInvoices.length === activeInvoices.length) {
      return {
        status: "Paid",
        badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
        invoiceNumbers: activeInvoices.map((i) => i.invoiceNumber),
      };
    }

    if (paidInvoices.length > 0 && paidInvoices.length < activeInvoices.length) {
      return {
        status: "Partially Paid",
        badgeClass: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800",
        invoiceNumbers: activeInvoices.map((i) => i.invoiceNumber),
      };
    }

    if (hasPending) {
      return {
        status: "Pending",
        badgeClass: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
        invoiceNumbers: activeInvoices.map((i) => i.invoiceNumber),
      };
    }

    return {
      status: "Unpaid",
      badgeClass: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800",
      invoiceNumbers: activeInvoices.map((i) => i.invoiceNumber),
    };
  };

  const getDestinationBadge = (type: string) => {
    switch (type) {
      case "saved_address":
        return (
          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-medium bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            Saved
          </span>
        );
      case "custom_address":
        return (
          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-medium bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            One-Time
          </span>
        );
      case "store":
      default:
        return null;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
      month: locale === "ko" ? "numeric" : "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-4">
      {/* 1. Filter Bar & Search Controls */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 sm:p-4 shadow-xs space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Order # Search */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              Order # Search
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">
                🔍
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && executeFilterQuery()}
                placeholder="Search Order #..."
                className="w-full pl-7 pr-2.5 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white"
              />
            </div>
          </div>

          {/* SKU Search */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              SKU Search
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">
                🏷️
              </span>
              <input
                type="text"
                value={skuTerm}
                onChange={(e) => setSkuTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && executeFilterQuery()}
                placeholder="SKU (e.g. DR120-SB-001)..."
                className="w-full pl-7 pr-2.5 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white"
              />
            </div>
          </div>

          {/* Date Range: From */}
          <div>
            <CalendarDatePicker
              label="From Date"
              value={startDate}
              maxDate={endDate || undefined}
              onChange={(val) => {
                setStartDate(val);
                executeFilterQuery({ startDate: val });
              }}
            />
          </div>

          {/* Date Range: To */}
          <div>
            <CalendarDatePicker
              label="To Date"
              value={endDate}
              minDate={startDate || undefined}
              onChange={(val) => {
                setEndDate(val);
                executeFilterQuery({ endDate: val });
              }}
            />
          </div>
        </div>

        {/* Multi-Select Toggle Filter Groups */}
        <div className="pt-2.5 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
          {/* Group 1: Fulfillment Status */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1 sm:w-24 shrink-0">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                Fulfillment:
              </span>
              {selectedOrderStatuses.length === 0 ? (
                <span className="text-[10px] text-zinc-400 font-medium">(All)</span>
              ) : (
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1 py-0.2 rounded">
                  {selectedOrderStatuses.length}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {FULFILLMENT_OPTIONS.map((opt) => {
                const isSelected = selectedOrderStatuses.includes(opt.key);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => toggleOrderStatus(opt.key)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all select-none ${
                      isSelected
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs ring-1 ring-zinc-900 dark:ring-white"
                        : "bg-zinc-100/80 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/60 border border-zinc-200/80 dark:border-zinc-700/60"
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-zinc-950 inline-block ml-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Group 2: Payment Method */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1 sm:w-24 shrink-0">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                Payment:
              </span>
              {selectedPaymentMethods.length === 0 ? (
                <span className="text-[10px] text-zinc-400 font-medium">(All)</span>
              ) : (
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1 py-0.2 rounded">
                  {selectedPaymentMethods.length}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {PAYMENT_METHOD_OPTIONS.map((opt) => {
                const isSelected = selectedPaymentMethods.includes(opt.key);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => togglePaymentMethod(opt.key)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all select-none ${
                      isSelected
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs ring-1 ring-zinc-900 dark:ring-white"
                        : "bg-zinc-100/80 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/60 border border-zinc-200/80 dark:border-zinc-700/60"
                    }`}
                  >
                    <span>{opt.icon}</span>
                    <span>{opt.label}</span>
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-zinc-950 inline-block ml-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Group 3: Invoice Status */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1 sm:w-24 shrink-0">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                Invoice:
              </span>
              {selectedInvoiceStatuses.length === 0 ? (
                <span className="text-[10px] text-zinc-400 font-medium">(All)</span>
              ) : (
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1 py-0.2 rounded">
                  {selectedInvoiceStatuses.length}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {INVOICE_STATUS_OPTIONS.map((opt) => {
                const isSelected = selectedInvoiceStatuses.includes(opt.key);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => toggleInvoiceStatus(opt.key)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all select-none ${
                      isSelected
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs ring-1 ring-zinc-900 dark:ring-white"
                        : "bg-zinc-100/80 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/60 border border-zinc-200/80 dark:border-zinc-700/60"
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-zinc-950 inline-block ml-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Row */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <div className="text-[11px] text-zinc-500">
            {hasActiveFilters ? (
              <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
                <span>Active filters applied</span>
              </span>
            ) : (
              <span className="text-zinc-400">Showing all records</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => executeFilterQuery()}
              disabled={isPending}
              className="px-3 py-1 rounded-lg text-xs font-bold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 dark:hover:text-zinc-950 transition-colors shadow-xs"
            >
              {isPending ? "Filtering..." : "Apply Filters"}
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between px-1 text-xs text-zinc-500">
        <span>
          Showing <strong>{orders.length}</strong> store order{orders.length === 1 ? "" : "s"}
        </span>
        {isPending && (
          <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-medium">
            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Updating...
          </span>
        )}
      </div>

      {/* 2. Desktop Table View */}
      {orders.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-12 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-3xl mx-auto font-bold">
            📦
          </div>
          <div className="max-w-sm mx-auto space-y-1">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">
              {hasActiveFilters ? "No orders match your filter" : t.orders.noOrdersTitle}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {hasActiveFilters
                ? "Try adjusting your search query, clearing SKU filter, or expanding the date range."
                : t.orders.noOrdersDesc}
            </p>
          </div>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 dark:bg-white text-white dark:text-zinc-950"
            >
              Clear All Filters
            </button>
          ) : (
            <div className="pt-2">
              <Link
                href="/products"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:opacity-90 transition-opacity shadow-xs"
              >
                {t.orders.startFirstOrder}
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="hidden md:block rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs table-auto">
              <thead className="bg-zinc-50/80 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 uppercase tracking-wider font-semibold text-[10px]">
                <tr>
                  <th className="py-2.5 px-2 whitespace-nowrap">Order #</th>
                  <th className="py-2.5 px-1.5 whitespace-nowrap">Date</th>
                  <th className="py-2.5 px-2 whitespace-nowrap">Destination</th>
                  <th className="py-2.5 px-1 text-center whitespace-nowrap">SKUs</th>
                  <th className="py-2.5 px-1 text-center whitespace-nowrap">Units</th>
                  <th className="py-2.5 px-1 text-center whitespace-nowrap">Shipped</th>
                  <th className="py-2.5 px-1.5 text-center whitespace-nowrap">Tracking</th>
                  <th className="py-2.5 px-2 whitespace-nowrap">Status</th>
                  <th className="py-2.5 px-1.5 whitespace-nowrap">Payment</th>
                  <th className="py-2.5 px-2 whitespace-nowrap">Invoice</th>
                  <th className="py-2.5 px-2 text-right whitespace-nowrap">Total</th>
                  <th className="py-2.5 px-2 text-right whitespace-nowrap">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {orders.map((order) => {
                  const invSummary = resolveOrderInvoiceStatus(order);

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      {/* Order # (Never wrap, single line) */}
                      <td className="py-2.5 px-2 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <Link
                            href={`/orders/${order.orderNumber}`}
                            className="font-bold font-mono text-zinc-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors whitespace-nowrap"
                          >
                            {order.orderNumber}
                          </Link>
                          {order.isTest && (
                            <span className="px-1 py-0.2 rounded text-[9px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 shrink-0">
                              TEST
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Order Date (Single line) */}
                      <td className="py-2.5 px-1.5 text-zinc-600 dark:text-zinc-400 whitespace-nowrap text-xs">
                        {formatDate(order.createdAt)}
                      </td>

                      {/* Destination (Single line with controlled ellipsis) */}
                      <td className="py-2.5 px-2 whitespace-nowrap">
                        <div className="flex items-center gap-1 max-w-[140px] xl:max-w-[200px]">
                          <span
                            className="font-semibold text-zinc-900 dark:text-white truncate"
                            title={order.destinationLabel || order.storeName}
                          >
                            {order.destinationLabel || order.storeName}
                          </span>
                          {order.destinationType && order.destinationType !== "store" && (
                            <span className="shrink-0">{getDestinationBadge(order.destinationType)}</span>
                          )}
                        </div>
                      </td>

                      {/* SKUs */}
                      <td className="py-2.5 px-1 text-center whitespace-nowrap font-extrabold text-zinc-900 dark:text-white">
                        {order.totalSkusCount}
                      </td>

                      {/* Units */}
                      <td className="py-2.5 px-1 text-center whitespace-nowrap font-medium text-zinc-600 dark:text-zinc-400">
                        {order.totalItemsCount.toLocaleString()}
                      </td>

                      {/* Shipped Qty */}
                      <td className="py-2.5 px-1 text-center whitespace-nowrap font-semibold text-zinc-900 dark:text-white">
                        {order.totalShippedUnits || 0}
                      </td>

                      {/* Tracking */}
                      <td className="py-2.5 px-1.5 text-center whitespace-nowrap">
                        <TrackingPopover
                          orderNumber={order.orderNumber}
                          packages={order.packages as any}
                          fulfillments={order.fulfillments as any}
                        />
                      </td>

                      {/* Unified Status */}
                      <td className="py-2.5 px-2 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-0.5">
                          {getStatusBadge(order.orderStatus)}
                          {order.totalCancelledUnits > 0 && (
                            <span className="text-[9px] text-orange-600 font-bold leading-none">
                              ({order.totalCancelledUnits} void)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Payment Method */}
                      <td className="py-2.5 px-1.5 whitespace-nowrap">
                        {renderPaymentMethod(order)}
                      </td>

                      {/* Invoice (Stacked badge and primary invoice with tooltip for secondary) */}
                      <td className="py-2.5 px-2 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-0.5">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold leading-tight shrink-0 ${invSummary.badgeClass}`}
                          >
                            {invSummary.status}
                          </span>
                          {invSummary.invoiceNumbers.length > 0 && (
                            <div
                              className="text-[10px] text-zinc-500 font-mono leading-tight hover:text-indigo-600 dark:hover:text-indigo-400"
                              title={invSummary.invoiceNumbers.join(", ")}
                            >
                              <Link href="/bills" className="hover:underline">
                                {invSummary.invoiceNumbers[0]}
                              </Link>
                              {invSummary.invoiceNumbers.length > 1 && (
                                <span className="ml-1 text-[9px] font-sans font-semibold text-zinc-400">
                                  +{invSummary.invoiceNumbers.length - 1}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Total Amount */}
                      <td className="py-2.5 px-2 text-right font-extrabold text-zinc-900 dark:text-white text-xs whitespace-nowrap">
                        ${order.totalAmount.toFixed(2)}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-2 text-right whitespace-nowrap">
                        <Link
                          href={`/orders/${order.orderNumber}`}
                          className="inline-flex items-center gap-0.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          <span>{t.common.details || "Details"}</span>
                          <span className="text-[10px]">→</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Mobile Card List View */}
      {orders.length > 0 && (
        <div className="md:hidden space-y-3">
          {orders.map((order) => {
            const invSummary = resolveOrderInvoiceStatus(order);

            return (
              <div
                key={order.id}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/orders/${order.orderNumber}`}
                      className="font-bold text-sm text-zinc-900 dark:text-white hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                    {order.isTest && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-400">
                        TEST
                      </span>
                    )}
                  </div>
                  <div>{getStatusBadge(order.orderStatus)}</div>
                </div>

                <div className="space-y-2 text-xs text-zinc-500 dark:text-zinc-400 border-t border-b border-zinc-100 dark:border-zinc-800/80 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-900 dark:text-white">
                      📍 {order.destinationLabel || order.storeName}
                    </span>
                    {order.destinationType && order.destinationType !== "store" && (
                      <div>{getDestinationBadge(order.destinationType)}</div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                      <span className="font-bold text-zinc-900 dark:text-white">{order.totalSkusCount}</span> SKUs •{" "}
                      <span className="font-bold text-zinc-900 dark:text-white">{order.totalItemsCount}</span> units
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-zinc-900 dark:text-white">
                        ${order.totalAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Shipped Qty & Tracking */}
                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-zinc-500">Shipped:</span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">
                        {order.totalShippedUnits || 0}
                      </span>
                    </div>
                    <div>
                      <TrackingPopover
                        orderNumber={order.orderNumber}
                        packages={order.packages as any}
                        fulfillments={order.fulfillments as any}
                      />
                    </div>
                  </div>

                  {/* Payment Method & Invoice */}
                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-zinc-500">Payment:</span>
                      {renderPaymentMethod(order)}
                    </div>
                    <div className="flex items-center gap-1">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${invSummary.badgeClass}`}
                      >
                        {invSummary.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>{formatDate(order.createdAt)}</span>
                  <Link
                    href={`/orders/${order.orderNumber}`}
                    className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline"
                  >
                    {t.orders.viewDetails} →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
