"use client";

import React, { useState } from "react";
import Link from "next/link";
import { RetailerOrderDetail } from "@/lib/retailer/orders";
import { PackagesPopover } from "@/components/admin/orders/packages-popover";
import { RetailerCancellationModal } from "./retailer-cancellation-modal";

interface OrderDetailViewProps {
  order: RetailerOrderDetail;
}

export function RetailerOrderDetailView({ order }: OrderDetailViewProps) {
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelModalMode, setCancelModalMode] = useState<"direct_cancel" | "request_cancel">("direct_cancel");
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "submitted":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/20">
            Order Submitted
          </span>
        );
      case "confirmed":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
            Order Confirmed
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            Processing in Warehouse
          </span>
        );
      case "partially_shipped":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
            Partially Shipped
          </span>
        );
      case "shipped":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            Shipped
          </span>
        );
      case "delivered":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            Shipped
          </span>
        );
      case "partially_cancelled":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-500/20">
            Partially Cancelled
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/20">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 border border-zinc-500/20">
            {status}
          </span>
        );
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "paid":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <span>✓</span> Paid
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <span>⏳</span> Processing
          </span>
        );
      case "partially_paid":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            Partially Paid
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
            Payment Failed
          </span>
        );
      case "unpaid":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            Unpaid (Invoice Settlement)
          </span>
        );
    }
  };

  const paymentMethodLabel =
    order.paymentMethod === "terms"
      ? `${order.paymentTerms.replace(/_/g, " ")} Terms`
      : order.paymentMethod === "ach"
      ? "ACH Bank Transfer (Invoice Settlement)"
      : order.paymentMethod === "card"
      ? "Credit / Debit Card (Invoice / Manual Settlement)"
      : order.paymentTerms.replace(/_/g, " ");

  return (
    <div className="space-y-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <Link href="/orders" className="hover:underline flex items-center gap-1 font-medium">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Store Orders
        </Link>
        <span>/</span>
        <span className="text-zinc-900 dark:text-white font-semibold">
          Order #{order.orderNumber}
        </span>
      </nav>

      {/* Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
              Order #{order.orderNumber}
            </h1>
            {order.isTest && (
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                TEST ORDER
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Placed on{" "}
            {new Date(order.createdAt).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {getStatusBadge(order.orderStatus)}

          {/* Direct Cancel for Submitted Orders */}
          {order.orderStatus.toLowerCase() === "submitted" && (
            <button
              type="button"
              onClick={() => {
                setCancelModalMode("direct_cancel");
                setCancelModalOpen(true);
              }}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-400 border border-rose-500/30 transition-colors"
            >
              <span>✕</span>
              <span>Cancel Order</span>
            </button>
          )}

          {/* Request Cancellation for Processing Orders */}
          {order.orderStatus.toLowerCase() === "processing" && !order.cancellationRequested && (
            <button
              type="button"
              onClick={() => {
                setCancelModalMode("request_cancel");
                setCancelModalOpen(true);
              }}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 border border-amber-500/30 transition-colors"
            >
              <span>⚠️</span>
              <span>Request Cancellation</span>
            </button>
          )}

          {/* Cancel Remaining for Partially Shipped Orders */}
          {order.orderStatus.toLowerCase() === "partially_shipped" &&
            !order.cancellationRequested &&
            order.totalRemainingUnits > 0 && (
              <button
                type="button"
                onClick={() => {
                  setCancelModalMode("request_cancel");
                  setCancelModalOpen(true);
                }}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 border border-amber-500/30 transition-colors"
              >
                <span>⚠️</span>
                <span>Cancel Remaining Units</span>
              </button>
            )}

          {Boolean(order.cancellationRequested) && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-500/30">
              Cancellation In Review
            </span>
          )}

          <Link
            href={`/support?new=1&category=order_delivery&order_id=${order.id}&store_id=${order.storeId || ""}&title=${encodeURIComponent(`[Order #${order.orderNumber}] Order & Delivery Inquiry`)}`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 transition-colors"
          >
            <span>🛟</span>
            <span>Support</span>
          </Link>
        </div>
      </div>

      {/* Visual Lifecycle Progress Tracker (Strict Order-Level: Submitted -> Processing -> Shipped) */}
      <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-zinc-500">
          <span>Order Lifecycle Progress</span>
          <span className="text-indigo-600 dark:text-indigo-400">
            {order.orderStatus === "cancelled"
              ? "Cancelled / Voided"
              : order.totalOrderedUnits > 0
              ? `${Math.round(((order.totalShippedUnits || 0) / order.totalOrderedUnits) * 100)}% Shipped`
              : "In Progress"}
          </span>
        </div>

        {order.orderStatus === "cancelled" ? (
          <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/70 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 text-xs font-semibold flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span>⛔</span>
              <span>This order has been cancelled and voided. No further shipments will occur.</span>
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-200/60 dark:bg-rose-900/60 px-2 py-0.5 rounded">
              Order Cancelled
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center text-xs">
            {/* Stage 1: Order Submitted */}
            <div className="p-2.5 rounded-xl border bg-blue-50/60 dark:bg-blue-950/40 border-blue-200 text-blue-700 dark:text-blue-400 font-bold">
              1. Order Submitted ✓
            </div>

            {/* Stage 2: Warehouse Processing */}
            <div
              className={`p-2.5 rounded-xl border ${
                ["processing", "partially_shipped", "shipped"].includes(order.orderStatus.toLowerCase())
                  ? "bg-amber-50/60 dark:bg-amber-950/40 border-amber-200 text-amber-700 dark:text-amber-400 font-bold"
                  : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 text-zinc-400"
              }`}
            >
              2. Warehouse Processing
              {["partially_shipped", "shipped"].includes(order.orderStatus.toLowerCase()) && " ✓"}
            </div>

            {/* Stage 3: Shipped (Terminal Fulfillment State) */}
            <div
              className={`p-2.5 rounded-xl border ${
                order.orderStatus.toLowerCase() === "shipped"
                  ? "bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-200 text-emerald-700 dark:text-emerald-400 font-bold"
                  : order.orderStatus.toLowerCase() === "partially_shipped"
                  ? "bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-200 text-indigo-700 dark:text-indigo-400 font-bold"
                  : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 text-zinc-400"
              }`}
            >
              {order.orderStatus.toLowerCase() === "shipped"
                ? "3. Shipped ✓"
                : order.orderStatus.toLowerCase() === "partially_shipped"
                ? `3. Partially Shipped (${order.totalShippedUnits || 0}/${order.totalOrderedUnits || order.totalItemsCount})`
                : "3. Shipped"}
            </div>
          </div>
        )}

        {order.orderStatus === "partially_cancelled" && (
          <div className="text-[11px] text-orange-600 dark:text-orange-400 font-medium px-1">
            ⚠️ Partial order cancellation: {order.totalCancelledUnits} unit{order.totalCancelledUnits === 1 ? "" : "s"} cancelled/voided.
          </div>
        )}
      </div>

      {/* 4-Way Units Reconciliation Summary Card */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800">
            <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">Total Ordered</span>
            <span className="text-xl font-black text-zinc-900 dark:text-white">
              {order.totalOrderedUnits || order.totalItemsCount}
            </span>
            <span className="text-[10px] text-zinc-500 block">units across {order.totalSkusCount} SKUs</span>
          </div>

          <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900">
            <span className="text-[10px] uppercase font-bold text-indigo-500 block mb-1">Dispatched / Shipped</span>
            <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
              {order.totalShippedUnits || 0}
            </span>
            <span className="text-[10px] text-indigo-400 block">
              units {order.packages && order.packages.length > 0 ? `in ${order.packages.length} boxes` : order.fulfillments && order.fulfillments.length > 0 ? `across ${order.fulfillments.length} dispatch${order.fulfillments.length === 1 ? "" : "es"}` : ""}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-orange-50/60 dark:bg-orange-950/40 border border-orange-100 dark:border-orange-900">
            <span className="text-[10px] uppercase font-bold text-orange-500 block mb-1">Cancelled / Shorted</span>
            <span className="text-xl font-black text-orange-600 dark:text-orange-400">
              {order.totalCancelledUnits || 0}
            </span>
            <span className="text-[10px] text-orange-400 block">units voided</span>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900">
            <span className="text-[10px] uppercase font-bold text-amber-500 block mb-1">Remaining to Ship</span>
            <span className="text-xl font-black text-amber-600 dark:text-amber-400">
              {order.totalRemainingUnits !== undefined ? order.totalRemainingUnits : Math.max(0, (order.totalOrderedUnits || order.totalItemsCount) - (order.totalShippedUnits || 0))}
            </span>
            <span className="text-[10px] text-amber-400 block">units pending</span>
          </div>
        </div>
      </div>

      {/* Details Grid: Left Info + Right Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Destination, Terms, Payments & Items (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Destination & Payment Terms Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Delivery Destination */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                Delivery Destination
              </span>
              <div className="font-bold text-sm text-zinc-900 dark:text-white">
                📍 {order.storeName}
              </div>
              {order.shippingAddress && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {order.shippingAddress}
                  {order.shippingCity && `, ${order.shippingCity}`}
                  {order.shippingState && ` ${order.shippingState}`}
                  {order.shippingZip && ` ${order.shippingZip}`}
                </p>
              )}
              {order.shippingPhone && (
                <p className="text-[11px] text-zinc-400">Tel: {order.shippingPhone}</p>
              )}
            </div>

            {/* Commercial Terms & Payment Info */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                Commercial Terms & Payment
              </span>
              <div className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-1.5">
                <span>💳</span>
                <span>{paymentMethodLabel}</span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-zinc-500">Status:</span>
                {getPaymentStatusBadge(order.paymentStatus)}
              </div>
              {order.paymentDueDate && (
                <div className="pt-1">
                  <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                    Estimated Due Date: {new Date(order.paymentDueDate).toLocaleDateString()}
                  </p>
                  <p className="text-[10px] text-zinc-400">
                    (Provisional based on Order Date — formal invoice issued upon dispatch)
                  </p>
                </div>
              )}
              {order.paidAt && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  Settled on: {new Date(order.paidAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>

          {/* Special Instructions Note */}
          {order.notes && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 text-xs space-y-1">
              <span className="font-bold text-zinc-700 dark:text-zinc-300">
                Delivery Instructions / Notes:
              </span>
              <p className="text-zinc-500 dark:text-zinc-400 whitespace-pre-line">
                {order.notes}
              </p>
            </div>
          )}

          {/* Fulfillment & Delivery Tracking Section */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white flex items-center gap-2">
                <span>🚚</span>
                <span>Fulfillment & Delivery Status</span>
              </h2>
              {order.fulfillments && order.fulfillments.length > 0 && (
                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                  {order.fulfillments.length} {order.fulfillments.length === 1 ? "Shipment" : "Shipments"}
                </span>
              )}
            </div>

            {(!order.fulfillments || order.fulfillments.length === 0) ? (
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-3">
                <span className="text-lg">📦</span>
                <div>
                  <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                    Awaiting Warehouse Shipment Preparation
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Carrier tracking numbers and confirmed delivery records will appear here once dispatched.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {order.fulfillments.map((f, idx) => (
                  <div
                    key={f.id}
                    className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40 space-y-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/60 dark:border-zinc-800 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-900 dark:text-white">
                          Shipment #{idx + 1} ({f.fulfillmentNumber})
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            f.status === "delivered"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                              : f.status === "shipped"
                              ? "bg-purple-100 text-purple-700 dark:text-purple-400 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                          }`}
                        >
                          {f.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {order.packages && order.packages.some((p: any) => p.fulfillmentId === f.id) && (
                          <PackagesPopover
                            packages={order.packages.filter((p: any) => p.fulfillmentId === f.id) as any}
                            orderNumber={order.orderNumber}
                          />
                        )}
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {f.shippedAt && (
                            <span>
                              Shipped: {new Date(f.shippedAt).toLocaleDateString()}{" "}
                            </span>
                          )}
                          {f.deliveredAt && (
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 ml-2">
                              • Delivered: {new Date(f.deliveredAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-zinc-400 block">Carrier & Tracking</span>
                        <div className="font-semibold text-zinc-900 dark:text-white mt-0.5">
                          {f.carrier || "Standard Freight"}
                          {f.trackingNumber && (
                            <span className="ml-2 font-mono text-indigo-600 dark:text-indigo-400">
                              {f.trackingUrl ? (
                                <a
                                  href={f.trackingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline hover:text-indigo-500"
                                >
                                  {f.trackingNumber} ↗
                                </a>
                              ) : (
                                f.trackingNumber
                              )}
                            </span>
                          )}
                        </div>
                      </div>

                      {f.notes && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-zinc-400 block">Shipment Note</span>
                          <p className="text-zinc-600 dark:text-zinc-400 mt-0.5">{f.notes}</p>
                        </div>
                      )}
                    </div>

                    {/* Shipment Line Items */}
                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                      <div className="text-[10px] uppercase font-bold text-zinc-400 mb-1.5">
                        Shipped Products in this Package:
                      </div>
                      <div className="space-y-1">
                        {f.items.map((fit) => (
                          <div
                            key={fit.id}
                            className="flex items-center justify-between text-xs py-1 px-2 rounded bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800"
                          >
                            <span className="font-medium text-zinc-900 dark:text-white">
                              {fit.productName} <span className="text-zinc-400 font-mono text-[10px]">({fit.sku})</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-zinc-600 dark:text-zinc-300">
                                Shipped: <strong>{fit.quantityShipped}</strong> units
                              </span>
                              {f.status === "delivered" && (
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                  ✓ Delivered: {fit.quantityDelivered} units
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment Transactions Log (if present) */}
          {order.payments && order.payments.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white flex items-center gap-2">
                <span>🧾</span>
                <span>Payment Settlement History</span>
              </h2>

              <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                {order.payments.map((p) => (
                  <div key={p.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-zinc-900 dark:text-white capitalize">
                        {p.paymentMethod} Payment
                      </span>
                      <p className="text-[11px] text-zinc-400">
                        {new Date(p.createdAt).toLocaleDateString()} • {p.provider}
                        {p.providerPaymentId ? ` (${p.providerPaymentId})` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-zinc-900 dark:text-white">
                        ${p.amount.toFixed(2)}
                      </span>
                      <div>{getPaymentStatusBadge(p.status)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Items Table */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
                Ordered Products ({order.totalSkusCount} SKUs • {order.totalItemsCount} units)
              </h2>
            </div>

            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {order.items.map((item) => (
                <div key={item.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0 flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      {item.brandName}
                    </span>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white leading-snug">
                      <Link href={`/products/${item.productId}`} className="hover:underline">
                        {item.productName}
                      </Link>
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                      <span>SKU: {item.sku}</span>
                      <span>•</span>
                      <span>Case Pack: {item.casePackQty} units</span>
                    </div>

                    {/* Fulfillment Delivery Progress per item */}
                    <div className="pt-1.5 flex flex-wrap items-center gap-3 text-[11px]">
                      <span className="text-zinc-600 dark:text-zinc-400">
                        Ordered: <strong>{item.quantity}</strong>
                      </span>
                      <span className="text-zinc-400">•</span>
                      <span className={(item.quantityShipped || 0) > 0 ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-zinc-400"}>
                        Shipped: <strong>{item.quantityShipped || 0}</strong>
                      </span>
                      <span className="text-zinc-400">•</span>
                      <span className={(item.quantityRemaining ?? (item.quantity - (item.quantityShipped || 0))) > 0 ? "text-amber-600 dark:text-amber-400 font-bold" : "text-zinc-400"}>
                        Remaining: <strong>{item.quantityRemaining ?? Math.max(0, item.quantity - (item.quantityShipped || 0))}</strong>
                      </span>
                      {(item.quantityCancelled || 0) > 0 && (
                        <>
                          <span className="text-zinc-400">•</span>
                          <span className="text-orange-600 dark:text-orange-400 font-bold">
                            Cancelled: <strong>{item.quantityCancelled}</strong>
                          </span>
                        </>
                      )}
                      {(item.quantityDelivered || 0) > 0 && (
                        <>
                          <span className="text-zinc-400">•</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            ✓ Delivered: <strong>{item.quantityDelivered}</strong>
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-left sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800">
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {item.quantity} units @ ${item.unitWholesalePrice.toFixed(2)}
                    </div>
                    <div className="text-sm sm:text-base font-extrabold text-zinc-900 dark:text-white mt-0.5">
                      ${item.lineTotal.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Financial Breakdown (5 cols) */}
        <div className="lg:col-span-5 space-y-4 sticky top-20">
          {/* Related Invoices / Bills Card */}
          {order.invoices && order.invoices.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                <h3 className="font-bold text-zinc-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <span>🧾</span>
                  <span>Related Invoices & Bills</span>
                </h3>
                <Link href="/bills" className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                  All Bills ↗
                </Link>
              </div>

              <div className="space-y-2">
                {order.invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/40 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-mono font-bold text-zinc-900 dark:text-white block">
                        {inv.invoiceNumber}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        Due Date: {new Date(inv.dueDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-zinc-900 dark:text-white">
                        ${inv.balanceDue.toFixed(2)}
                      </span>
                      <span className="text-[10px] uppercase font-bold block text-indigo-600 dark:text-indigo-400">
                        {inv.invoiceStatus}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cancellation & Refund Alert (if applicable) */}
          {(Boolean(order.cancellationRequested) || ((order.refundAmount || 0) > 0)) && (
            <div className="rounded-2xl border border-orange-200 dark:border-orange-900/60 bg-orange-50/60 dark:bg-orange-950/30 p-4 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-orange-800 dark:text-orange-300 font-bold">
                <span>⚠️</span>
                <span>Order Cancellation / Refund Notice</span>
              </div>
              {(order.refundAmount || 0) > 0 && (
                <div className="flex items-center justify-between font-bold text-orange-900 dark:text-orange-200">
                  <span>Refunded / Reversal Amount:</span>
                  <span className="text-sm font-black">${(order.refundAmount || 0).toFixed(2)}</span>
                </div>
              )}
              {order.cancellationRequested && (
                <p className="text-[11px] text-orange-700 dark:text-orange-400">
                  Cancellation request submitted. Customer support will review remainder allocations.
                </p>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-950 p-6 shadow-xs space-y-5">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-zinc-800 pb-3">
              Order Financial Summary
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Total SKUs:</span>
                <span className="font-semibold text-zinc-900 dark:text-white">{order.totalSkusCount}</span>
              </div>
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Total Units:</span>
                <span className="font-semibold text-zinc-900 dark:text-white">{order.totalItemsCount} units</span>
              </div>
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Wholesale Subtotal:</span>
                <span className="font-bold text-zinc-900 dark:text-white">
                  ${order.subtotalAmount.toFixed(2)}
                </span>
              </div>
              {order.discountAmount && order.discountAmount > 0 ? (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className="flex items-center gap-1.5">
                    <span>Promotional Discount:</span>
                    {order.couponCode && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                        {order.couponCode}
                      </span>
                    )}
                  </span>
                  <span className="font-bold">
                    -${order.discountAmount.toFixed(2)}
                  </span>
                </div>
              ) : null}
              {order.processingFee && order.processingFee > 0 ? (
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>Processing Fee:</span>
                  <span className="font-semibold text-zinc-900 dark:text-white">
                    +${order.processingFee.toFixed(2)}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between text-zinc-500">
                <span>Shipping & Freight:</span>
                <span className="italic text-zinc-400">
                  {order.shippingAmount > 0 ? `$${order.shippingAmount.toFixed(2)}` : "Calculated at dispatch"}
                </span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>Sales Tax:</span>
                <span className="italic text-zinc-400">
                  {order.taxAmount > 0 ? `$${order.taxAmount.toFixed(2)}` : "Exempt (Resale)"}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-baseline">
              <div>
                <div className="text-xs font-bold text-zinc-900 dark:text-white">Total Amount</div>
                <div className="text-[10px] text-zinc-400">Snapshotted B2B Total</div>
              </div>
              <div className="text-2xl font-black text-zinc-900 dark:text-white">
                ${order.totalAmount.toFixed(2)}
              </div>
            </div>

            <div className="pt-2">
              <Link
                href="/orders"
                className="w-full py-3 px-4 rounded-xl text-center text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors block"
              >
                ← Back to All Orders
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Cancellation Modal */}
      <RetailerCancellationModal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        order={order}
        mode={cancelModalMode}
      />
    </div>
  );
}
