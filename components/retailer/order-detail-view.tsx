"use client";

import React from "react";
import Link from "next/link";
import { RetailerOrderDetail } from "@/lib/retailer/orders";

interface OrderDetailViewProps {
  order: RetailerOrderDetail;
}

export function RetailerOrderDetailView({ order }: OrderDetailViewProps) {
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
      case "shipped":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/20">
            Shipped
          </span>
        );
      case "delivered":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            Delivered
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

        <div className="flex items-center gap-2">
          {getStatusBadge(order.orderStatus)}
        </div>
      </div>

      {/* Details Grid: Left Info + Right Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Destination, Terms & Items (7 cols) */}
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

            {/* Commercial Terms */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                Commercial & Terms
              </span>
              <div className="font-bold text-sm text-zinc-900 dark:text-white">
                💳 {order.paymentTerms.replace(/_/g, " ")}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Payment Status:{" "}
                <span className="font-semibold text-zinc-800 dark:text-zinc-200 uppercase text-[11px]">
                  {order.paymentStatus}
                </span>
              </p>
              <p className="text-[11px] text-zinc-400">
                Invoice & payment settlement coordinated by K SELECT.
              </p>
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

          {/* Items Table */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
                Ordered Products ({order.totalSkusCount} SKUs • {order.totalItemsCount} units)
              </h2>
            </div>

            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {order.items.map((item) => (
                <div key={item.id} className="p-4 sm:p-5 flex items-center justify-between gap-4">
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
                  </div>

                  <div className="text-right shrink-0">
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
    </div>
  );
}
