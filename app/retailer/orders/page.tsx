import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { getRetailerOrders } from "@/lib/retailer/orders";
import { RetailerOrdersList } from "@/components/retailer/orders-list";
import { getServerTranslations } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Orders | K SELECT HUB Retailer",
  description: "View and track your store purchase orders and wholesale shipments.",
};

export default async function RetailerOrdersPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await verifyRetailerSession();
  const resolvedParams = searchParams ? await searchParams : {};
  const search = typeof resolvedParams.search === "string" ? resolvedParams.search : undefined;
  const sku = typeof resolvedParams.sku === "string" ? resolvedParams.sku : undefined;
  const startDate = typeof resolvedParams.startDate === "string" ? resolvedParams.startDate : undefined;
  const endDate = typeof resolvedParams.endDate === "string" ? resolvedParams.endDate : undefined;

  const parseMultiParam = (val: string | string[] | undefined): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) {
      return val.flatMap((v) => v.split(",")).map((s) => s.trim().toLowerCase()).filter(Boolean);
    }
    return val.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  };

  const orderStatuses = parseMultiParam(resolvedParams.orderStatus || resolvedParams.orderStatuses);
  const paymentMethods = parseMultiParam(resolvedParams.paymentMethod || resolvedParams.paymentMethods);
  const invoiceStatuses = parseMultiParam(
    resolvedParams.invoiceStatus || resolvedParams.invoiceStatuses || resolvedParams.paymentStatus
  );

  const initialFilters = {
    search,
    sku,
    startDate,
    endDate,
    orderStatus: orderStatuses.length > 0 ? orderStatuses.join(",") : undefined,
    orderStatuses: orderStatuses.length > 0 ? orderStatuses : undefined,
    paymentMethods: paymentMethods.length > 0 ? paymentMethods : undefined,
    paymentStatus: invoiceStatuses.length > 0 ? invoiceStatuses.join(",") : undefined,
    invoiceStatuses: invoiceStatuses.length > 0 ? invoiceStatuses : undefined,
  };

  const orders = await getRetailerOrders(initialFilters);
  const { t } = await getServerTranslations();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">
            {t.orders.title}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {t.orders.subtitle}
          </p>
        </div>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:opacity-90 transition-opacity shadow-xs self-start sm:self-auto"
        >
          <span>{t.orders.newOrder}</span>
        </Link>
      </div>

      {/* Orders List */}
      <RetailerOrdersList
        initialOrders={orders}
        initialFilters={initialFilters}
      />
    </div>
  );
}
