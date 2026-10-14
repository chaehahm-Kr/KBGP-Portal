// components/admin/orders/order-detail-view.tsx
"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminRetailerOrderDetail, ApprovedOrderStatus } from "@/lib/admin/orders-types";
import {
  adminUpdateOrderStatusAction,
  adminCancelOrderLineAction,
  adminProcessOrderRefundAction,
} from "@/lib/admin/orders-actions";
import { PackagesPopover } from "./packages-popover";
import { CreateShipmentModal } from "./create-shipment-modal";
import { CancellationRequestReviewCard } from "./cancellation-request-review-card";

interface AdminOrderDetailViewProps {
  order: AdminRetailerOrderDetail;
}

export function AdminOrderDetailView({ order }: AdminOrderDetailViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showShipModal, setShowShipModal] = useState(false);
  const [cancelModalItem, setCancelModalItem] = useState<{ id: string; name: string; max: number } | null>(null);
  const [cancelQty, setCancelQty] = useState(1);
  const [cancelReason, setCancelReason] = useState("Out of stock at warehouse");

  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState(order.refundAmount || 0);
  const [refundNotes, setRefundNotes] = useState("");

  const completionPct =
    order.totalOrderedUnits > 0
      ? Math.round((order.totalShippedUnits / order.totalOrderedUnits) * 100)
      : 0;

  const handleStatusChange = (newStatus: ApprovedOrderStatus) => {
    if (!confirm(`Are you sure you want to change order status to "${newStatus}"?`)) return;
    startTransition(async () => {
      await adminUpdateOrderStatusAction(order.id, newStatus);
      router.refresh();
    });
  };

  const handleCancelItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModalItem) return;
    startTransition(async () => {
      await adminCancelOrderLineAction({
        orderId: order.id,
        orderItemId: cancelModalItem.id,
        quantityToCancel: cancelQty,
        reason: cancelReason,
      });
      setCancelModalItem(null);
      router.refresh();
    });
  };

  const handleRefundSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await adminProcessOrderRefundAction({
        orderId: order.id,
        refundAmount,
        notes: refundNotes,
      });
      setShowRefundModal(false);
      router.refresh();
    });
  };

  const getStatusBadge = (status: ApprovedOrderStatus) => {
    switch (status) {
      case "submitted":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/20">
            Order Submitted
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
            Fully Shipped
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
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/20">
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

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/admin/sales" className="hover:underline">
          Sales & Performance
        </Link>
        <span>/</span>
        <Link href="/admin/sales/orders" className="hover:underline">
          Retailer Orders
        </Link>
        <span>/</span>
        <span className="font-semibold text-zinc-900 dark:text-white">
          {order.orderNumber}
        </span>
      </nav>

      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
              Order #{order.orderNumber}
            </h1>
            {order.isTest && (
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                TEST
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500">
            Placed on {new Date(order.createdAt).toLocaleString()} • Retailer:{" "}
            <strong>{order.companyName}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {getStatusBadge(order.orderStatus)}

          {order.totalRemainingUnits > 0 &&
            !["cancelled", "shipped", "delivered"].includes(order.orderStatus.toLowerCase()) && (
            order.cancellationRequested ? (
              <span
                title="Shipment creation is on hold while a cancellation request is pending review"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1.5 cursor-not-allowed shadow-2xs"
              >
                <span>⏸</span>
                <span>Fulfillment Hold (Cancellation Requested)</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setShowShipModal(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90 transition-opacity shadow-xs"
              >
                + Create Shipment ({order.totalRemainingUnits} units left)
              </button>
            )
          )}

          {order.orderStatus === "submitted" && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleStatusChange("processing")}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors"
            >
              Mark Processing
            </button>
          )}

          {order.orderStatus !== "cancelled" &&
            order.orderStatus !== "shipped" &&
            order.orderStatus !== "partially_cancelled" && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleStatusChange("cancelled")}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 transition-colors"
              >
                {order.totalShippedUnits > 0 ? "Cancel Remaining Units" : "Void / Cancel Order"}
              </button>
            )}
        </div>
      </div>

      {/* SECTION 0: Cancellation Request Review Card (if requested) */}
      <CancellationRequestReviewCard order={order} />

      {/* SECTION 1: 4-Way Units Reconciliation Summary Card */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white flex items-center gap-2">
            <span>📊</span>
            <span>4-Way Units Reconciliation & Fulfillment Progress</span>
          </h2>
          <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
            {completionPct}% Dispatched
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800">
            <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">
              Total Ordered
            </span>
            <span className="text-xl font-black text-zinc-900 dark:text-white">
              {order.totalOrderedUnits}
            </span>
            <span className="text-[10px] text-zinc-500 block">units across {order.totalSkusCount} SKUs</span>
          </div>

          <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900">
            <span className="text-[10px] uppercase font-bold text-indigo-500 block mb-1">
              Dispatched / Shipped
            </span>
            <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
              {order.totalShippedUnits}
            </span>
            <span className="text-[10px] text-indigo-400 block">units in {order.totalBoxCount} boxes</span>
          </div>

          <div className="p-3 rounded-xl bg-orange-50/60 dark:bg-orange-950/40 border border-orange-100 dark:border-orange-900">
            <span className="text-[10px] uppercase font-bold text-orange-500 block mb-1">
              Cancelled / Shorted
            </span>
            <span className="text-xl font-black text-orange-600 dark:text-orange-400">
              {order.totalCancelledUnits}
            </span>
            <span className="text-[10px] text-orange-400 block">units voided</span>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900">
            <span className="text-[10px] uppercase font-bold text-amber-500 block mb-1">
              Remaining to Ship
            </span>
            <span className="text-xl font-black text-amber-600 dark:text-amber-400">
              {order.totalRemainingUnits}
            </span>
            <span className="text-[10px] text-amber-400 block">units awaiting pack</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
          <div
            className="bg-indigo-600 h-full rounded-full transition-all duration-500"
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>

      {/* Grid: Left Column (7 cols) + Right Column (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Ordered Products Table */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
                Line Items & Unit Allocations
              </h2>
              <span className="text-xs text-zinc-500">
                {order.items.length} {order.items.length === 1 ? "Product" : "Products"}
              </span>
            </div>

            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
              {order.items.map((it) => (
                <div key={it.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        {it.brandName}
                      </span>
                      <h3 className="font-bold text-zinc-900 dark:text-white">
                        {it.productName}
                      </h3>
                      <p className="text-[11px] text-zinc-500 font-mono">
                        SKU: {it.sku} • Case Pack: {it.casePackQty}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-sm text-zinc-900 dark:text-white block">
                        ${it.lineTotal.toFixed(2)}
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        ${it.unitWholesalePrice.toFixed(2)} / unit
                      </span>
                    </div>
                  </div>

                  {/* Units Breakdown per Line */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60 text-[11px]">
                    <div className="flex items-center gap-3">
                      <span>Ordered: <strong>{it.quantityOrdered}</strong></span>
                      <span className="text-zinc-300">•</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                        Shipped: <strong>{it.quantityShipped}</strong>
                      </span>
                      <span className="text-zinc-300">•</span>
                      <span className="text-orange-600 font-semibold">
                        Cancelled: <strong>{it.quantityCancelled}</strong>
                      </span>
                      <span className="text-zinc-300">•</span>
                      <span className={it.quantityRemaining > 0 ? "text-amber-600 dark:text-amber-400 font-bold" : "text-emerald-600 dark:text-emerald-400 font-semibold"}>
                        Remaining: <strong>{it.quantityRemaining}</strong>
                      </span>
                    </div>

                    {it.quantityRemaining > 0 && order.orderStatus !== "cancelled" && (
                      <button
                        type="button"
                        onClick={() => {
                          setCancelModalItem({ id: it.id, name: it.productName, max: it.quantityRemaining });
                          setCancelQty(it.quantityRemaining);
                        }}
                        className="text-[10px] font-bold text-orange-600 hover:underline"
                      >
                        Cancel / Short Line
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Dispatch & Shipment History */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white flex items-center gap-2">
                <span>🚚</span>
                <span>Dispatch & Carrier Shipment History</span>
              </h2>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {order.shipments.length} {order.shipments.length === 1 ? "Shipment" : "Shipments"}
              </span>
            </div>

            {order.shipments.length === 0 ? (
              <div className="p-6 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 text-center text-xs text-zinc-500">
                No shipments dispatched yet. Click "+ Create Shipment" to record tracking and packaging.
              </div>
            ) : (
              <div className="space-y-3">
                {order.shipments.map((sh, idx) => (
                  <div
                    key={sh.id}
                    className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/30 space-y-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/60 dark:border-zinc-800 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-900 dark:text-white">
                          Shipment #{idx + 1} ({sh.fulfillmentNumber})
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-500/15 text-indigo-700 dark:text-indigo-400">
                          {sh.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {(() => {
                          const linkedInv = order.invoices?.find(
                            (inv) => inv.fulfillmentId === sh.id || inv.fulfillmentNumber === sh.fulfillmentNumber
                          );
                          if (linkedInv) {
                            return (
                              <Link
                                href={`/admin/finance/invoices/${linkedInv.id}`}
                                className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 hover:underline flex items-center gap-1"
                              >
                                <span>🧾 {linkedInv.invoiceNumber}</span>
                                <span>(${linkedInv.totalAmount.toFixed(2)})</span>
                              </Link>
                            );
                          }
                          if (sh.status === "shipped" || sh.status === "delivered") {
                            return (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                Uninvoiced Dispatch
                              </span>
                            );
                          }
                          return null;
                        })()}
                        <PackagesPopover packages={sh.packages} orderNumber={order.orderNumber} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                          Carrier & Master Tracking
                        </span>
                        <div className="font-mono mt-0.5">
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200 mr-2">
                            {sh.carrier || "Freight"}
                          </span>
                          {sh.trackingNumber && (
                            <span className="text-indigo-600 dark:text-indigo-400">
                              {sh.trackingUrl ? (
                                <a
                                  href={sh.trackingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline hover:opacity-80"
                                >
                                  {sh.trackingNumber} ↗
                                </a>
                              ) : (
                                sh.trackingNumber
                              )}
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                          Dispatched Timestamp
                        </span>
                        <p className="text-zinc-600 dark:text-zinc-400 mt-0.5">
                          {sh.shippedAt ? new Date(sh.shippedAt).toLocaleString() : "Processing"}
                        </p>
                      </div>
                    </div>

                    {sh.notes && (
                      <p className="text-[11px] text-zinc-500 border-t border-zinc-200/50 dark:border-zinc-800 pt-1.5">
                        Note: {sh.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-5 space-y-6">
          {/* 1. Destination & Delivery Address Card */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-2 text-xs">
            <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block">
              Delivery Destination
            </span>
            <div className="font-bold text-sm text-zinc-900 dark:text-white">
              📍 {order.destinationLabel}
            </div>
            {order.shippingAddress && (
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {order.shippingAddress}
                {order.shippingAddressLine2 && ` ${order.shippingAddressLine2}`}
                <br />
                {order.shippingCity}, {order.shippingState} {order.shippingZip}
              </p>
            )}
            {order.recipientName && (
              <p className="text-zinc-500 pt-1">
                Attn: <strong>{order.recipientName}</strong>
              </p>
            )}
            {order.shippingPhone && (
              <p className="text-zinc-400">Tel: {order.shippingPhone}</p>
            )}
          </div>

          {/* 2. Commercial Terms & Financial Breakdown Card */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-4 text-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-2">
              Commercial Terms & Accounting
            </h2>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-zinc-500">Retailer Company:</span>
                <span className="font-bold text-zinc-900 dark:text-white">
                  {order.companyName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Payment Terms:</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {order.paymentTerms}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Payment Status:</span>
                <span className="font-bold capitalize text-zinc-900 dark:text-white">
                  {order.paymentStatus}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Wholesale Subtotal:</span>
                <span className="font-bold">${order.subtotalAmount.toFixed(2)}</span>
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
                  <span className="font-bold">-${order.discountAmount.toFixed(2)}</span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span className="text-zinc-500">Freight & Shipping:</span>
                <span className="font-bold">${order.shippingAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Sales Tax:</span>
                <span className="font-bold">${order.taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800 text-sm font-black text-zinc-900 dark:text-white">
                <span>Total Amount:</span>
                <span>${order.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* 3. Related Invoices & AR Section */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
                Related Invoices & Accounts Receivable
              </h2>
              <span className="text-xs text-zinc-500">
                {order.invoices.length} {order.invoices.length === 1 ? "Invoice" : "Invoices"}
              </span>
            </div>

            {order.invoices.length === 0 ? (
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 text-center text-zinc-500">
                No formal invoice issued yet. Net Terms invoice will generate upon shipment dispatch.
              </div>
            ) : (
              <div className="space-y-2">
                {order.invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/40 flex items-center justify-between"
                  >
                    <div>
                      <Link
                        href={`/admin/finance/invoices/${inv.id}`}
                        className="font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:underline block"
                      >
                        {inv.invoiceNumber}
                      </Link>
                      <span className="text-[10px] text-zinc-500 block">
                        Due: {new Date(inv.dueDate).toLocaleDateString()} • {inv.termsName}
                        {inv.fulfillmentNumber && ` (🚚 ${inv.fulfillmentNumber})`}
                      </span>
                      {inv.prepaymentAllocatedAmount && inv.prepaymentAllocatedAmount > 0 ? (
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 block font-medium">
                          Prepayment: -${inv.prepaymentAllocatedAmount.toFixed(2)} | Due: ${inv.balanceDue.toFixed(2)}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-zinc-900 dark:text-white">
                        ${inv.totalAmount.toFixed(2)}
                      </span>
                      <span className="text-[10px] uppercase font-bold block text-emerald-600">
                        {inv.invoiceStatus}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. Cancellation Requests & Refund Information */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-3 text-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-2">
              Cancellation & Refund Management
            </h2>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Cancellation Status:</span>
                <span className="font-semibold text-zinc-900 dark:text-white">
                  {order.cancellationRequested ? "Requested by Retailer" : "None"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Total Refunded:</span>
                <span className="font-black text-rose-600">
                  ${order.refundAmount.toFixed(2)}
                </span>
              </div>

              {order.cancellationNotes && (
                <p className="text-[11px] text-zinc-500 bg-zinc-50 dark:bg-zinc-800/40 p-2.5 rounded-lg">
                  Notes: {order.cancellationNotes}
                </p>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowRefundModal(true)}
                  className="w-full py-2 px-3 rounded-xl text-xs font-bold border border-zinc-200 dark:border-zinc-700 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors"
                >
                  Record Refund Transaction
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Shipment Modal */}
      {showShipModal && (
        <CreateShipmentModal
          orderId={order.id}
          orderNumber={order.orderNumber}
          items={order.items}
          isOpen={showShipModal}
          onClose={() => setShowShipModal(false)}
          onSuccess={() => {
            setShowShipModal(false);
            router.refresh();
          }}
        />
      )}

      {/* Line Item Cancel Modal */}
      {cancelModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-black text-zinc-900 dark:text-white">
              Cancel Units: {cancelModalItem.name}
            </h3>
            <p className="text-xs text-zinc-500">
              Shorten or void units that cannot be fulfilled. Maximum cancellable:{" "}
              <strong>{cancelModalItem.max} units</strong>.
            </p>

            <form onSubmit={handleCancelItemSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 font-bold mb-1">
                  Quantity to Void / Cancel:
                </label>
                <input
                  type="number"
                  min={1}
                  max={cancelModalItem.max}
                  value={cancelQty}
                  onChange={(e) => setCancelQty(Math.min(cancelModalItem.max, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 font-bold mb-1">
                  Reason for Cancellation:
                </label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setCancelModalItem(null)}
                  className="px-4 py-2 rounded-xl font-semibold text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl font-bold bg-orange-600 text-white hover:bg-orange-700"
                >
                  {isPending ? "Updating..." : "Confirm Cancellation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-black text-zinc-900 dark:text-white">
              Record Refund Amount
            </h3>
            <p className="text-xs text-zinc-500">
              Record credit or payment reversal for Order #{order.orderNumber}.
            </p>

            <form onSubmit={handleRefundSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 font-bold mb-1">
                  Refund Amount ($):
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0.01}
                  max={order.totalAmount}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 font-bold mb-1">
                  Refund Notes / Reference:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Credit issued for 2 damaged units in shipment #1"
                  value={refundNotes}
                  onChange={(e) => setRefundNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowRefundModal(false)}
                  className="px-4 py-2 rounded-xl font-semibold text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl font-bold bg-rose-600 text-white hover:bg-rose-700"
                >
                  {isPending ? "Recording..." : "Save Refund"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
