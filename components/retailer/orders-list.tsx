"use client";

import React, { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import {
  RetailerOrderSummary,
  GetRetailerOrdersFilter,
  getRetailerOrdersAction,
} from "@/lib/retailer/orders";
import { useTranslation } from "@/lib/i18n";
import { PackagesPopover } from "@/components/admin/orders/packages-popover";

interface OrdersListProps {
  orders?: RetailerOrderSummary[];
  initialOrders?: RetailerOrderSummary[];
  initialFilters?: GetRetailerOrdersFilter;
}

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
  const [orderStatus, setOrderStatus] = useState(initialFilters?.orderStatus || "all");
  const [paymentStatus, setPaymentStatus] = useState(initialFilters?.paymentStatus || "all");

  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
      skuTerm.trim() ||
      startDate ||
      endDate ||
      orderStatus !== "all" ||
      paymentStatus !== "all"
  );

  // Synchronize when parent prop orders update
  useEffect(() => {
    if (propOrders && !hasActiveFilters) {
      setOrders(propOrders);
    }
  }, [propOrders, hasActiveFilters]);

  // Execute server query
  const executeFilterQuery = (customFilters?: Partial<GetRetailerOrdersFilter>) => {
    startTransition(async () => {
      const activeQuery: GetRetailerOrdersFilter = {
        search: customFilters?.search !== undefined ? customFilters.search : searchTerm.trim() || undefined,
        sku: customFilters?.sku !== undefined ? customFilters.sku : skuTerm.trim() || undefined,
        startDate: customFilters?.startDate !== undefined ? customFilters.startDate : startDate || undefined,
        endDate: customFilters?.endDate !== undefined ? customFilters.endDate : endDate || undefined,
        orderStatus: customFilters?.orderStatus !== undefined ? customFilters.orderStatus : orderStatus,
        paymentStatus: customFilters?.paymentStatus !== undefined ? customFilters.paymentStatus : paymentStatus,
      };

      const results = await getRetailerOrdersAction(activeQuery);
      setOrders(results);
    });
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setSkuTerm("");
    setStartDate("");
    setEndDate("");
    setOrderStatus("all");
    setPaymentStatus("all");
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

  const getDestinationBadge = (type: string) => {
    switch (type) {
      case "saved_address":
        return (
          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-medium bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            Saved Address
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
        return (
          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
            Store
          </span>
        );
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
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Order # Search */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              Order # Search
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">
                🔍
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && executeFilterQuery()}
                placeholder="Search Order #..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
              />
            </div>
          </div>

          {/* SKU Search */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              SKU Search
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">
                🏷️
              </span>
              <input
                type="text"
                value={skuTerm}
                onChange={(e) => setSkuTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && executeFilterQuery()}
                placeholder="SKU (e.g. DR120-SB-001)..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
              />
            </div>
          </div>

          {/* Date Range: From */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              From Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                executeFilterQuery({ startDate: e.target.value });
              }}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
            />
          </div>

          {/* Date Range: To */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              To Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                executeFilterQuery({ endDate: e.target.value });
              }}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
            />
          </div>
        </div>

        {/* Secondary Row: Status Filters & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Fulfillment Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500 font-medium">Fulfillment:</span>
              <select
                value={orderStatus}
                onChange={(e) => {
                  setOrderStatus(e.target.value);
                  executeFilterQuery({ orderStatus: e.target.value });
                }}
                className="px-2.5 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-medium"
              >
                <option value="all">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="processing">Processing</option>
                <option value="partially_shipped">Partially Shipped</option>
                <option value="shipped">Shipped</option>
                <option value="partially_cancelled">Partially Cancelled</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Payment Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500 font-medium">Payment:</span>
              <select
                value={paymentStatus}
                onChange={(e) => {
                  setPaymentStatus(e.target.value);
                  executeFilterQuery({ paymentStatus: e.target.value });
                }}
                className="px-2.5 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-medium"
              >
                <option value="all">All Payment Statuses</option>
                <option value="unpaid">Unpaid</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => executeFilterQuery()}
              disabled={isPending}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 dark:hover:text-zinc-950 transition-colors shadow-xs"
            >
              {isPending ? "Filtering..." : "Apply Filters"}
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
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
        <div className="hidden md:block rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[920px]">
              <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 uppercase tracking-wider font-semibold text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Order #</th>
                  <th className="py-3.5 px-4">Order Date</th>
                  <th className="py-3.5 px-4">Destination</th>
                  <th className="py-3.5 px-4 text-center">SKUs</th>
                  <th className="py-3.5 px-4 text-center">Units</th>
                  <th className="py-3.5 px-4">Shipping Summary</th>
                  <th className="py-3.5 px-4">Unified Status</th>
                  <th className="py-3.5 px-4">Invoice / Payment</th>
                  <th className="py-3.5 px-4 text-right">Total Amount</th>
                  <th className="py-3.5 px-4 text-right">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/orders/${order.orderNumber}`}
                          className="font-bold text-zinc-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        >
                          {order.orderNumber}
                        </Link>
                        {order.isTest && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                            TEST
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                      {formatDate(order.createdAt)}
                    </td>

                    {/* Destination */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-zinc-900 dark:text-white">
                          📍 {order.destinationLabel || order.storeName}
                        </span>
                        {order.destinationType && order.destinationType !== "store" && (
                          <div>{getDestinationBadge(order.destinationType)}</div>
                        )}
                      </div>
                    </td>

                    {/* Split SKU Column */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-extrabold text-zinc-900 dark:text-white">
                        {order.totalSkusCount}
                      </span>
                    </td>

                    {/* Split Units Column */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-medium text-zinc-600 dark:text-zinc-400">
                        {order.totalItemsCount.toLocaleString()}
                      </span>
                    </td>

                    {/* Shipping Summary with Clickable Box Count */}
                    <td className="py-3.5 px-4">
                      {order.packages && order.packages.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                              {order.totalShippedUnits || 0} / {order.totalOrderedUnits || order.totalItemsCount} Shipped
                            </span>
                            <span className="text-zinc-300 dark:text-zinc-600 font-bold">|</span>
                            <PackagesPopover packages={order.packages as any} orderNumber={order.orderNumber} />
                          </div>
                        </div>
                      ) : order.fulfillments && order.fulfillments.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                            {order.totalShippedUnits || 0} / {order.totalOrderedUnits || order.totalItemsCount} Shipped
                          </span>
                          <div className="flex items-center gap-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                            <span>Dispatch:</span>
                            {order.fulfillments[0].carrier && (
                              <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                                {order.fulfillments[0].carrier}
                              </span>
                            )}
                            {order.fulfillments[0].trackingNumber ? (
                              order.fulfillments[0].trackingUrl ? (
                                <a
                                  href={order.fulfillments[0].trackingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="font-mono text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5"
                                >
                                  <span>{order.fulfillments[0].trackingNumber}</span>
                                  <span className="text-[9px]">↗</span>
                                </a>
                              ) : (
                                <span className="font-mono">{order.fulfillments[0].trackingNumber}</span>
                              )
                            ) : (
                              <span className="italic text-zinc-400">No tracking #</span>
                            )}
                            {order.fulfillments.length > 1 && (
                              <span className="text-[9px] text-zinc-400 font-bold">
                                (+{order.fulfillments.length - 1} more)
                              </span>
                            )}
                          </div>
                        </div>
                      ) : order.totalShippedUnits > 0 ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                            {order.totalShippedUnits || 0} / {order.totalOrderedUnits || order.totalItemsCount} Shipped
                          </span>
                          <span className="text-[10px] text-zinc-400">📦 Dispatched</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                          <span>0 / {order.totalOrderedUnits || order.totalItemsCount} Shipped</span>
                          <span className="text-zinc-300 dark:text-zinc-600">|</span>
                          <span className="text-[10px] text-zinc-400">⏳ Packing in Whs</span>
                        </div>
                      )}
                    </td>

                    {/* Unified Order Status Column */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getStatusBadge(order.orderStatus)}
                      {order.totalCancelledUnits > 0 && (
                        <div className="text-[9px] text-orange-600 font-bold mt-0.5">
                          {order.totalCancelledUnits} units voided
                        </div>
                      )}
                    </td>

                    {/* Invoice & Payment Column */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {order.invoices && order.invoices.length > 0 ? (
                        <div className="space-y-1">
                          {order.invoices.map((inv) => (
                            <div key={inv.id}>
                              <Link
                                href="/bills"
                                className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline inline-flex items-center gap-1"
                              >
                                <span>{inv.invoiceNumber}</span>
                              </Link>
                              <span className="text-[10px] text-zinc-500 block">
                                {inv.invoiceStatus.toUpperCase()} • Due {new Date(inv.dueDate).toLocaleDateString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div>
                          <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 block">
                            {order.paymentTerms || "PREPAID"}
                          </span>
                          {getPaymentBadge(order.paymentStatus)}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right font-extrabold text-zinc-900 dark:text-white text-sm whitespace-nowrap">
                      ${order.totalAmount.toFixed(2)}
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <Link
                        href={`/orders/${order.orderNumber}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {t.common.details} →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Mobile Card List View */}
      {orders.length > 0 && (
        <div className="md:hidden space-y-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.orderNumber}`}
              className="block rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-zinc-900 dark:text-white">
                    {order.orderNumber}
                  </span>
                  {order.isTest && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-400">
                      TEST
                    </span>
                  )}
                </div>
                <div>{getStatusBadge(order.orderStatus)}</div>
              </div>

              <div className="space-y-1.5 text-xs text-zinc-500 dark:text-zinc-400 border-t border-b border-zinc-100 dark:border-zinc-800/80 py-2.5">
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
                    <span className="font-bold text-zinc-900 dark:text-white">{order.totalSkusCount}</span> SKUs • <span className="font-bold text-zinc-900 dark:text-white">{order.totalItemsCount}</span> units
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-zinc-900 dark:text-white mr-2">
                      ${order.totalAmount.toFixed(2)}
                    </span>
                    {getPaymentBadge(order.paymentStatus)}
                  </div>
                </div>

                {/* Shipping Summary in Mobile Card */}
                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <span className="text-zinc-500">Shipping Summary:</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">
                    {order.totalShippedUnits || 0} / {order.totalOrderedUnits || order.totalItemsCount} Shipped
                    {order.packages && order.packages.length > 0
                      ? ` | 📦 ${order.packages.length} ${order.packages.length === 1 ? "Box" : "Boxes"}`
                      : order.fulfillments && order.fulfillments.length > 0 && order.fulfillments[0].trackingNumber
                      ? ` | ${order.fulfillments[0].carrier || "Carrier"}: ${order.fulfillments[0].trackingNumber}`
                      : ""}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>{formatDate(order.createdAt)}</span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  {t.orders.viewDetails} →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
