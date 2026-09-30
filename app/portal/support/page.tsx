import { Suspense } from "react";
import type { Metadata } from "next";
import { getPartnerInquiries, createPartnerInquiry } from "@/lib/inquiry/actions";
import { PortalSupportView } from "@/components/support/portal-support-view";
import { hasPortalPermission } from "@/lib/company/permissions";
import { AccessDeniedView } from "@/components/portal/access-denied";

export const metadata: Metadata = {
  title: "1:1 문의 | 파트너 포털",
};

export default async function PortalSupportPage() {
  const canRead = await hasPortalPermission("support", "read");
  if (!canRead) {
    return (
      <AccessDeniedView
        title="접근 권한이 없습니다."
        message="문의 지원 메뉴를 이용할 권한이 없습니다. 권한 조정을 원하시면 회사 관리자에게 문의해주세요."
      />
    );
  }

  const inquiries = await getPartnerInquiries();

  return (
    <div className="w-full max-w-7xl">
      <Suspense fallback={null}>
        <PortalSupportView initialInquiries={inquiries} createAction={createPartnerInquiry} />
      </Suspense>
    </div>
  );
}
