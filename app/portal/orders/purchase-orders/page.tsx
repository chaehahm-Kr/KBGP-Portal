import type { Metadata } from "next";
import { getPortalPurchaseOrders } from "@/lib/portal/actions";
import { PortalPoList } from "@/components/portal/portal-po-list";
import { hasPortalPermission } from "@/lib/company/permissions";
import { AccessDeniedView } from "@/components/portal/access-denied";

export const metadata: Metadata = {
  title: "발주 관리 | 파트너 포털",
};

export default async function PortalPurchaseOrdersPage() {
  const canRead = await hasPortalPermission("orders", "read");
  if (!canRead) {
    return (
      <AccessDeniedView
        title="접근 권한이 없습니다."
        message="주문 / 발주서 메뉴를 이용할 권한이 없습니다. 권한 조정을 원하시면 회사 관리자에게 문의해주세요."
      />
    );
  }

  const pos = await getPortalPurchaseOrders();

  return (
    <div className="w-full max-w-7xl space-y-6">
      <PortalPoList pos={pos} />
    </div>
  );
}
