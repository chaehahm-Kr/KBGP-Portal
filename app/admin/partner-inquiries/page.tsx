import type { Metadata } from "next";
import { Suspense } from "react";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAdminPartnerInquiries,
  answerPartnerInquiry,
  getCompaniesAndUsersForCaseCreation,
  createAdminPartnerInquiry,
} from "@/lib/inquiry/actions";
import {
  getComplianceSectionKoreanLabel,
  formatComplianceInquiryTitle,
  formatComplianceInquiryContent,
  type CompliancePrefillData,
} from "@/lib/inquiry/compliance-prefill";
import { AdminPartnerInquiries } from "@/components/admin/admin-partner-inquiries";

export const metadata: Metadata = {
  title: "파트너 문의 관리 | K SELECT NETWORK 어드민",
};

export default async function AdminPartnerInquiriesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    tab?: string;
    type?: string;
    source?: string;
    newCase?: string;
    productId?: string;
    section?: string;
  }>;
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
    getCompaniesAndUsersForCaseCreation(),
  ]);

  let initialNewCase: CompliancePrefillData | null = null;

  // Authoritatively resolve product information if opening from Compliance shortcuts
  if (sp.newCase && sp.productId) {
    const admin = createAdminClient();
    const { data: product } = await admin
      .from("products")
      .select("id, name, name_en, letusto_sku, manufacture_sku, brand_id, company_id, brands(name), companies(id, name)")
      .eq("id", sp.productId)
      .maybeSingle();

    if (product) {
      const productName = product.name || product.name_en || "미확인 제품";
      const sku = product.letusto_sku || product.manufacture_sku || "N/A";
      const brandName = (product.brands as any)?.name || "미지정 브랜드";
      const targetCompanyId = product.company_id || (product.companies as any)?.id || "";

      // Match targetCompanyId in active case creation companies
      const companyExists = caseCreationData.companies.some((c) => c.id === targetCompanyId);
      const resolvedCompanyId = companyExists ? targetCompanyId : (caseCreationData.companies[0]?.id || "");

      // Contact Person: Select only if an existing valid contact can be identified unambiguously.
      // Otherwise leave it unselected.
      const companyContacts = caseCreationData.companyUsers.filter((u) => u.company_id === resolvedCompanyId);
      const contactUserId = companyContacts.length === 1 ? companyContacts[0].id : "";

      const sectionLabel = getComplianceSectionKoreanLabel(sp.section);
      const title = formatComplianceInquiryTitle(productName);
      const content = formatComplianceInquiryContent({
        productName,
        sku,
        brandName,
        complianceSection: sectionLabel,
      });

      initialNewCase = {
        isOpen: true,
        companyId: resolvedCompanyId,
        contactUserId,
        category: "product",
        priority: "normal",
        title,
        content,
        productId: product.id,
        productName,
        productSku: sku,
        sectionId: sp.section || "",
      };
    }
  }

  return (
    <div className="w-full space-y-6">
      <Suspense fallback={null}>
        <AdminPartnerInquiries
          initialInquiries={inquiries}
          initialSource={initialSource}
          companies={caseCreationData.companies}
          companyUsers={caseCreationData.companyUsers}
          initialNewCase={initialNewCase}
          answerAction={answerPartnerInquiry}
          createCaseAction={createAdminPartnerInquiry}
        />
      </Suspense>
    </div>
  );
}
