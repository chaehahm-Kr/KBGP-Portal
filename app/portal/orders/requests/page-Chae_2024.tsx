import type { Metadata } from "next";
import { requireCompanyMembership } from "@/lib/company/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPortalPoRequests } from "@/lib/purchase-order/request-actions";
import { PoRequestList } from "@/components/portal/po-request-list";

export const metadata: Metadata = {
  title: "발주 요청 목록 | K SELECT NETWORK 파트너 포털",
};

export default async function PortalPoRequestsPage() {
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
      <PoRequestList requests={requests} companyName={comp?.name || "파트너사"} />
    </div>
  );
}
