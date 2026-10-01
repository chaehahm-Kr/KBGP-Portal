import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getAdminPoRequestDetail } from "@/lib/purchase-order/request-actions";
import { AdminPoRequestDetailView } from "@/components/admin/po-request-detail";
import { markAdminItemAsRead } from "@/lib/notifications/admin-read-state";

export const metadata: Metadata = {
  title: "PO Request Review & Convert | K SELECT NETWORK 어드민",
};

export default async function AdminPoRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await verifyAdminSession();

  let request;
  try {
    request = await getAdminPoRequestDetail(id);
  } catch (err) {
    notFound();
  }

  // Mark PO request as read for admin notification system
  if (request && !request.admin_read_at) {
    await markAdminItemAsRead("po_request", request.id, session.userId);
  }

  return (
    <div className="space-y-6">
      <AdminPoRequestDetailView request={request} />
    </div>
  );
}

