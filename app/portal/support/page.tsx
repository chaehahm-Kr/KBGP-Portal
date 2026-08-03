import type { Metadata } from "next";
import { getPartnerInquiries, createPartnerInquiry } from "@/lib/inquiry/actions";
import { PortalSupportView } from "@/components/support/portal-support-view";

export const metadata: Metadata = {
  title: "1:1 문의 | 파트너 포털",
};

export default async function PortalSupportPage() {
  const inquiries = await getPartnerInquiries();

  return (
    <div className="w-full max-w-7xl">
      <PortalSupportView initialInquiries={inquiries} createAction={createPartnerInquiry} />
    </div>
  );
}
