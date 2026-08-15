import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getPurchaseOrderDetail } from "@/lib/purchase-order/actions";
import { PurchaseOrderDetail } from "@/components/admin/purchase-order-detail";

export const metadata: Metadata = {
  title: "발주서 상세 정보 (PO Detail) | K SELECT NETWORK 어드민",
};

export default async function AdminPurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await verifyAdminSession();

  let po;
  try {
    po = await getPurchaseOrderDetail(id);
  } catch (err) {
    console.error("Failed to load PO detail", err);
    notFound();
  }

  return (
    <div className="space-y-6">
      <PurchaseOrderDetail po={po} />
    </div>
  );
}
