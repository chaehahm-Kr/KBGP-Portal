"use client";

import React from "react";
import Link from "next/link";
import { RetailerOrderSummary } from "@/lib/retailer/orders";

interface OrdersListProps {
  orders: RetailerOrderSummary[];
}

export function RetailerOrdersList({ orders }: OrdersListProps) {
  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-12 text-center space-y-4 shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-3xl mx-auto font-bold">
          📦
        </div>
        <div className="max-w-sm mx-auto space-y-1">
          <h2 className="text-base font-bold text-zinc-900 dark:text-white">
            No Orders Placed Yet
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Browse our verified Korean beauty catalog and place wholesale replenishment orders for your stores.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:opacity-90 transition-opacity shadow-xs"
          >
            Start First Order →
          </Link>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "submitted":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/20">
            Submitted
          </span>
        );
      case "confirmed":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
            Confirmed
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            Processing
          </span>
        );
      case "shipped":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/20">
            Shipped
          </span>
        );
      case "delivered":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            Delivered
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/20">
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

  const getPaymentBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "paid":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            Paid
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400">
            Payment Pending
          </span>
        );
      case "unpaid":
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
            Unpaid (Invoice)
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Desktop Table View */}
      <div className="hidden md:block rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 uppercase tracking-wider font-semibold text-[10px]">
            <tr>
              <th className="py-3.5 px-4">Order Number</th>
              <th className="py-3.5 px-4">Date Placed</th>
              <th className="py-3.5 px-4">Store Destination</th>
              <th className="py-3.5 px-4">Items / SKUs</th>
              <th className="py-3.5 px-4">Order Status</th>
              <th className="py-3.5 px-4">Payment</th>
              <th className="py-3.5 px-4 text-right">Total Amount</th>
              <th className="py-3.5 px-4 text-right">Action</th>
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
                <td className="py-3.5 px-4 text-zinc-600 dark:text-zinc-400">
                  {new Date(order.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </td>
                <td className="py-3.5 px-4">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                    📍 {order.storeName}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-zinc-600 dark:text-zinc-400">
                  {order.totalSkusCount} SKUs ({order.totalItemsCount} units)
                </td>
                <td className="py-3.5 px-4">{getStatusBadge(order.orderStatus)}</td>
                <td className="py-3.5 px-4">{getPaymentBadge(order.paymentStatus)}</td>
                <td className="py-3.5 px-4 text-right font-extrabold text-zinc-900 dark:text-white text-sm">
                  ${order.totalAmount.toFixed(2)}
                </td>
                <td className="py-3.5 px-4 text-right">
                  <Link
                    href={`/orders/${order.orderNumber}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Details →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List View */}
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

            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 border-t border-b border-zinc-100 dark:border-zinc-800/80 py-2.5">
              <div>
                <span>📍 {order.storeName}</span>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  {order.totalSkusCount} SKUs • {order.totalItemsCount} units
                </div>
              </div>
              <div className="text-right">
                <div className="text-base font-black text-zinc-900 dark:text-white">
                  ${order.totalAmount.toFixed(2)}
                </div>
                <div>{getPaymentBadge(order.paymentStatus)}</div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>
                {new Date(order.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                View Details →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
