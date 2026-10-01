import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalPoRequestDetail } from "@/lib/purchase-order/request-actions";
import { PoRequestDetailView } from "@/components/portal/po-request-detail";
import { hasPortalPermission } from "@/lib/company/permissions";
import { AccessDeniedView } from "@/components/portal/access-denied";

export const metadata: Metadata = {
  title: "발주 요청 상세 | K SELECT NETWORK 파트너 포털",
};

export default async function PortalPoRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const canRead = await hasPortalPermission("orders", "read");
  if (!canRead) {
    return (
      <AccessDeniedView
        title="접근 권한이 없습니다."
        message="발주 요청 메뉴를 이용할 권한이 없습니다. 권한 조정을 원하시면 회사 관리자에게 문의해주세요."
      />
    );
  }

  const canWrite = await hasPortalPermission("orders", "write");
  const { id } = await params;

  let request;
  try {
    request = await getPortalPoRequestDetail(id);
  } catch (err) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PoRequestDetailView request={request} canWrite={canWrite} />
    </div>
  );
}
