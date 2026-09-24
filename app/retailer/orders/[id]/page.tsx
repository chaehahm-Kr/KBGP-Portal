import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { getRetailerOrderDetail } from "@/lib/retailer/orders";
import { RetailerOrderDetailView } from "@/components/retailer/order-detail-view";

export const dynamic = "force-dynamic";

interface OrderDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({
  params,
}: OrderDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const order = await getRetailerOrderDetail(id);
    if (!order) {
      return {
        title: "Order Not Found | K SELECT HUB Retailer",
      };
    }
    return {
      title: `Order #${order.orderNumber} | K SELECT HUB Retailer`,
      description: `Wholesale order placed for ${order.storeName} with ${order.totalItemsCount} units total.`,
    };
  } catch {
    return {
      title: "Order Detail | K SELECT HUB Retailer",
    };
  }
}

export default async function RetailerOrderDetailPage({
  params,
}: OrderDetailPageProps) {
  await verifyRetailerSession();
  const { id } = await params;

  const order = await getRetailerOrderDetail(id);

  if (!order) {
    notFound();
  }

  return <RetailerOrderDetailView order={order} />;
}
