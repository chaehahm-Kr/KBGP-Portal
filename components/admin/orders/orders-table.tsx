// components/admin/orders/orders-table.tsx
"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { AdminRetailerOrderSummary, ApprovedOrderStatus, AdminOrderFilter } from "@/lib/admin/orders-types";
import { getAdminRetailerOrdersAction } from "@/lib/admin/orders-actions";
import { PackagesPopover } from "./packages-popover";

interface OrdersTableProps {
  initialOrders: AdminRetailerOrderSummary[];
  initialTotal: number;
}

export function AdminOrdersTable({ initialOrders, initialTotal }: OrdersTableProps) {
  const [orders, setOrders] = useState<AdminRetailerOrderSummary[]>(initialOrders);
  const [totalCount, setTotalCount] = useState<number>(initialTotal);
  const [isPending, startTransition] = useTransition();

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [skuTerm, setSkuTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
      skuTerm.trim() ||
      statusFilter !== "all" ||
      paymentStatus !== "all" ||
      startDate ||
      endDate
  );

  const executeQuery = (custom?: Partial<AdminOrderFilter>) => {
    startTransition(async () => {
      const activeFilter: AdminOrderFilter = {
        search: custom?.search !== undefined ? custom.search : searchTerm.trim() || undefined,
        sku: custom?.sku !== undefined ? custom.sku : skuTerm.trim() || undefined,
        status: custom?.status !== undefined ? custom.status : statusFilter,
        paymentStatus: custom?.paymentStatus !== undefined ? custom.paymentStatus : paymentStatus,
        startDate: custom?.startDate !== undefined ? custom.startDate : startDate || undefined,
        endDate: custom?.endDate !== undefined ? custom.endDate : endDate || undefined,
      };

      const res = await getAdminRetailerOrdersAction(activeFilter);
      setOrders(res.orders);
      setTotalCount(res.totalCount);
    });
  };

  const handleReset = () => {
    setSearchTerm("");
    setSkuTerm("");
    setStatusFilter("all");
    setPaymentStatus("all");
    setStartDate("");
    setEndDate("");
    startTransition(async () => {
      const res = await getAdminRetailerOrdersAction({});
      setOrders(res.orders);
      setTotalCount(res.totalCount);
    });
  };

  // Status Badge Helper
  const getStatusBadge = (status: ApprovedOrderStatus) => {
    switch (status) {
      case "submitted":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/20">
            Submitted
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            Processing
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
            Shipped
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
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/20">
            Cancelled
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

  // Quick Counter Metrics
  const submittedCount = orders.filter((o) => o.orderStatus === "submitted").length;
  const processingCount = orders.filter((o) => o.orderStatus === "processing").length;
  const partiallyShippedCount = orders.filter((o) => o.orderStatus === "partially_shipped").length;
  const shippedCount = orders.filter((o) => o.orderStatus === "shipped").length;

  return (
    <div className="space-y-5">
      {/* 1. Metric Counter Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => {
            setStatusFilter("all");
            executeQuery({ status: "all" });
          }}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            statusFilter === "all"
              ? "border-zinc-900 dark:border-white bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm"
              : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
          }`}
        >
          <span className="text-[10px] uppercase font-bold tracking-wider opacity-70 block">
            Total Orders
          </span>
          <span className="text-xl font-black">{totalCount}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter("submitted");
            executeQuery({ status: "submitted" });
          }}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            statusFilter === "submitted"
              ? "border-blue-600 bg-blue-600 text-white shadow-sm"
              : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white hover:bg-blue-50/50"
          }`}
        >
          <span className="text-[10px] uppercase font-bold tracking-wider opacity-70 block">
            Submitted
          </span>
          <span className="text-xl font-black">{submittedCount}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter("processing");
            executeQuery({ status: "processing" });
          }}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            statusFilter === "processing"
              ? "border-amber-600 bg-amber-600 text-white shadow-sm"
              : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white hover:bg-amber-50/50"
          }`}
        >
          <span className="text-[10px] uppercase font-bold tracking-wider opacity-70 block">
            Processing
          </span>
          <span className="text-xl font-black">{processingCount}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter("partially_shipped");
            executeQuery({ status: "partially_shipped" });
          }}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            statusFilter === "partially_shipped"
              ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
              : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white hover:bg-indigo-50/50"
          }`}
        >
          <span className="text-[10px] uppercase font-bold tracking-wider opacity-70 block">
            Partial Shipped
          </span>
          <span className="text-xl font-black">{partiallyShippedCount}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter("shipped");
            executeQuery({ status: "shipped" });
          }}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            statusFilter === "shipped"
              ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
              : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white hover:bg-emerald-50/50"
          }`}
        >
          <span className="text-[10px] uppercase font-bold tracking-wider opacity-70 block">
            Shipped
          </span>
          <span className="text-xl font-black">{shippedCount}</span>
        </button>
      </div>

      {/* 2. Filter Bar */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search Term */}
          <div className="sm:col-span-4">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
              Search Orders
            </label>
            <input
              type="text"
              placeholder="Order #, Retailer Name, Store..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && executeQuery()}
              className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white"
            />
          </div>

          {/* SKU Filter */}
          <div className="sm:col-span-3">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
              Filter by SKU
            </label>
            <input
              type="text"
              placeholder="e.g. RL-10293 or Dokdo"
              value={skuTerm}
              onChange={(e) => setSkuTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && executeQuery()}
              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white"
            />
          </div>

          {/* Start Date */}
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                executeQuery({ startDate: e.target.value });
              }}
              className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white"
            />
          </div>

          {/* End Date */}
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                executeQuery({ endDate: e.target.value });
              }}
              className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white"
            />
          </div>

          {/* Action Buttons */}
          <div className="sm:col-span-1 flex items-end gap-1">
            <button
              type="button"
              onClick={() => executeQuery()}
              disabled={isPending}
              className="w-full py-2 px-2 text-xs font-bold rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90 shadow-xs"
            >
              {isPending ? "..." : "Go"}
            </button>
          </div>
        </div>

        {/* Secondary Row: Status Dropdown & Payment */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-zinc-500 font-semibold">Unified Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                executeQuery({ status: e.target.value });
              }}
              className="px-2.5 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium"
            >
              <option value="all">All 6 Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="processing">Processing</option>
              <option value="partially_shipped">Partially Shipped</option>
              <option value="shipped">Shipped</option>
              <option value="partially_cancelled">Partially Cancelled</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <span className="text-zinc-500 font-semibold ml-2">Payment:</span>
            <select
              value={paymentStatus}
              onChange={(e) => {
                setPaymentStatus(e.target.value);
                executeQuery({ paymentStatus: e.target.value });
              }}
              className="px-2.5 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium"
            >
              <option value="all">All Payment Statuses</option>
              <option value="unpaid">Unpaid</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1 text-xs font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* 3. Table Header Count */}
      <div className="flex items-center justify-between px-1 text-xs text-zinc-500">
        <span>
          Showing <strong>{orders.length}</strong> of <strong>{totalCount}</strong> retailer orders
        </span>
        {isPending && (
          <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-medium">
            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Filtering orders...
          </span>
        )}
      </div>

      {/* 4. Desktop Orders Table */}
      {orders.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center space-y-3">
          <div className="text-3xl">📦</div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
            No Retailer Orders Found
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            {hasActiveFilters
              ? "No orders match the selected filters. Try broadening your search or resetting filters."
              : "No retailer orders have been placed in the network yet."}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[1020px]">
              <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 uppercase tracking-wider font-semibold text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Order #</th>
                  <th className="py-3.5 px-4">Order Date</th>
                  <th className="py-3.5 px-4">Retailer & Destination</th>
                  <th className="py-3.5 px-4">Unified Status</th>
                  <th className="py-3.5 px-4 text-center">Units (Ord / Ship / Rem)</th>
                  <th className="py-3.5 px-4 text-center">Boxes</th>
                  <th className="py-3.5 px-4">Invoice / Terms</th>
                  <th className="py-3.5 px-4 text-right">Total Amount</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {orders.map((ord) => {
                  const primaryInv = ord.invoices?.[0];
                  return (
                    <tr
                      key={ord.id}
                      className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/admin/sales/orders/${ord.id}`}
                          className="font-bold text-zinc-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        >
                          {ord.orderNumber}
                        </Link>
                        {ord.isTest && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                            TEST
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                        {new Date(ord.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-zinc-900 dark:text-white">
                          {ord.companyName}
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          📍 {ord.destinationLabel}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getStatusBadge(ord.orderStatus)}
                      </td>

                      {/* 4-Way Units Breakdown Column */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="font-mono text-xs">
                          <span className="font-bold text-zinc-900 dark:text-white">
                            {ord.totalOrderedUnits}
                          </span>
                          <span className="text-zinc-400"> / </span>
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">
                            {ord.totalShippedUnits}
                          </span>
                          <span className="text-zinc-400"> / </span>
                          <span className={ord.totalRemainingUnits > 0 ? "font-bold text-amber-600 dark:text-amber-400" : "text-zinc-400"}>
                            {ord.totalRemainingUnits}
                          </span>
                        </div>
                        {ord.totalCancelledUnits > 0 && (
                          <span className="text-[10px] text-rose-500 font-medium">
                            ({ord.totalCancelledUnits} cancelled)
                          </span>
                        )}
                      </td>

                      {/* Packages / Box Count Column */}
                      <td className="py-3.5 px-4 text-center">
                        <PackagesPopover
                          packages={ord.packages}
                          orderNumber={ord.orderNumber}
                        />
                      </td>

                      {/* Invoice Link */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {ord.invoices && ord.invoices.length > 0 ? (
                          <div className="space-y-1">
                            {ord.invoices.map((inv) => (
                              <div key={inv.id}>
                                <Link
                                  href={`/admin/finance/invoices/${inv.id}`}
                                  className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                                >
                                  <span>{inv.invoiceNumber}</span>
                                  {inv.fulfillmentNumber && (
                                    <span className="text-[9px] font-sans px-1 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                      {inv.fulfillmentNumber}
                                    </span>
                                  )}
                                </Link>
                                <span className="text-[10px] text-zinc-500 block">
                                  {inv.invoiceStatus.toUpperCase()} • {inv.termsName || ord.paymentTerms}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-zinc-400 italic">
                            Uninvoiced ({ord.paymentTerms})
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-extrabold text-zinc-900 dark:text-white whitespace-nowrap">
                        ${ord.totalAmount.toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/admin/sales/orders/${ord.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors"
                        >
                          View ↗
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
    </div>
  );
}
