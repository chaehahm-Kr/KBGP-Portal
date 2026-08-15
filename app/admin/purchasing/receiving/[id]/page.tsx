import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getReceivingDetail } from "@/lib/inbound/actions";
import { ReceivingDetail } from "@/components/admin/receiving-detail";

export const metadata: Metadata = {
  title: "입고 상세 정보 (Receiving Detail) | K SELECT NETWORK 어드민",
};

export default async function AdminReceivingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await verifyAdminSession();

  let rec;
  try {
    rec = await getReceivingDetail(id);
  } catch (err) {
    console.error("Failed to load receiving detail", err);
    notFound();
  }

  return (
    <div className="space-y-6">
      <ReceivingDetail receiving={rec} />
    </div>
  );
}
