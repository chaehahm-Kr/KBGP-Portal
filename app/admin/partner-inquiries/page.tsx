import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getAdminPartnerInquiries, answerPartnerInquiry } from "@/lib/inquiry/actions";
import { AdminPartnerInquiries } from "@/components/admin/admin-partner-inquiries";

export const metadata: Metadata = {
  title: "파트너 문의 관리 | K SELECT NETWORK 어드민",
};

export default async function AdminPartnerInquiriesPage() {
  await verifyAdminSession();
  const inquiries = await getAdminPartnerInquiries();

  return (
    <div className="w-full max-w-7xl">
      <AdminPartnerInquiries initialInquiries={inquiries} answerAction={answerPartnerInquiry} />
    </div>
  );
}
