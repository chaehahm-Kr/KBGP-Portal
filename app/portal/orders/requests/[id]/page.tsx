import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCompanyMembership } from "@/lib/company/dal";
import { getPortalPoRequestDetail } from "@/lib/purchase-order/request-actions";
import { PoRequestDetailView } from "@/components/portal/po-request-detail";

export const metadata: Metadata = {
  title: "발주 요청 상세 | K SELECT NETWORK 파트너 포털",
};

export default async function PortalPoRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCompanyMembership();

  let request;
  try {
    request = await getPortalPoRequestDetail(id);
  } catch (err) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PoRequestDetailView request={request} />
    </div>
  );
}
