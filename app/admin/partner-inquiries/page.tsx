import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import {
  getAdminPartnerInquiries,
  answerPartnerInquiry,
  getCompaniesAndUsersForCaseCreation,
  createAdminPartnerInquiry
} from "@/lib/inquiry/actions";
import { AdminPartnerInquiries } from "@/components/admin/admin-partner-inquiries";

export const metadata: Metadata = {
  title: "파트너 문의 관리 | K SELECT NETWORK 어드민",
};

export default async function AdminPartnerInquiriesPage() {
  await verifyAdminSession();
  const [inquiries, caseCreationData] = await Promise.all([
    getAdminPartnerInquiries(),
    getCompaniesAndUsersForCaseCreation()
  ]);

  return (
    <div className="w-full space-y-6">
      <AdminPartnerInquiries
        initialInquiries={inquiries}
        companies={caseCreationData.companies}
        companyUsers={caseCreationData.companyUsers}
        answerAction={answerPartnerInquiry}
        createCaseAction={createAdminPartnerInquiry}
      />
    </div>
  );
}
