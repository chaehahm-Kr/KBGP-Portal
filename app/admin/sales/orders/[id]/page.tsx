// app/admin/sales/orders/[id]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getAdminRetailerOrderDetailAction } from "@/lib/admin/orders-actions";
import { AdminOrderDetailView } from "@/components/admin/orders/order-detail-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Order Detail | K SELECT NETWORK Admin`,
  };
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await verifyAdminSession();
  const { id } = await params;

  const order = await getAdminRetailerOrderDetailAction(id);
  if (!order) {
    notFound();
  }

  return <AdminOrderDetailView order={order} />;
}
