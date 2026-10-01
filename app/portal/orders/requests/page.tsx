import type { Metadata } from "next";
import { requireCompanyMembership } from "@/lib/company/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPortalPoRequests } from "@/lib/purchase-order/request-actions";
import { PoRequestList } from "@/components/portal/po-request-list";
import { hasPortalPermission } from "@/lib/company/permissions";
import { AccessDeniedView } from "@/components/portal/access-denied";

export const metadata: Metadata = {
  title: "발주 요청 목록 | K SELECT NETWORK 파트너 포털",
};

export default async function PortalPoRequestsPage() {
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
  const membership = await requireCompanyMembership();
  const admin = createAdminClient();
  const { data: comp } = await admin
    .from("companies")
    .select("name")
    .eq("id", membership.companyId)
    .maybeSingle();

  const requests = await getPortalPoRequests();

  return (
    <div className="space-y-6">
      <PoRequestList
        requests={requests}
        companyName={comp?.name || "파트너사"}
        canWrite={canWrite}
      />
    </div>
  );
}
