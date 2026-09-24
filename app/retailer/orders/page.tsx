import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { getRetailerOrders } from "@/lib/retailer/orders";
import { RetailerOrdersList } from "@/components/retailer/orders-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Store Orders | K SELECT HUB Retailer",
  description: "View and track your store purchase orders and wholesale shipments.",
};

export default async function RetailerOrdersPage() {
  await verifyRetailerSession();
  const orders = await getRetailerOrders();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">
            Store Orders
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Track all submitted store replenishment orders, line items, and fulfillment status.
          </p>
        </div>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:opacity-90 transition-opacity shadow-xs self-start sm:self-auto"
        >
          <span>+ New Order</span>
        </Link>
      </div>

      {/* Orders List */}
      <RetailerOrdersList orders={orders} />
    </div>
  );
}
