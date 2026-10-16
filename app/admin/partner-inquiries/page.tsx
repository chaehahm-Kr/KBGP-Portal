import type { Metadata } from "next";
import { Suspense } from "react";
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

export default async function AdminPartnerInquiriesPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; type?: string; source?: string }>;
}) {
  await verifyAdminSession();
  const sp = searchParams ? await searchParams : {};
  const initialSourceParam = sp.type || sp.tab || sp.source;
  const initialSource =
    initialSourceParam === "brand"
      ? "brand"
      : initialSourceParam === "retailer"
      ? "retailer"
      : "all";

  const [inquiries, caseCreationData] = await Promise.all([
    getAdminPartnerInquiries(),
    getCompaniesAndUsersForCaseCreation()
  ]);

  return (
    <div className="w-full space-y-6">
      <Suspense fallback={null}>
        <AdminPartnerInquiries
          initialInquiries={inquiries}
          initialSource={initialSource}
          companies={caseCreationData.companies}
          companyUsers={caseCreationData.companyUsers}
          answerAction={answerPartnerInquiry}
          createCaseAction={createAdminPartnerInquiry}
        />
      </Suspense>
    </div>
  );
}
