import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getSystemCompanyConfigs } from "@/lib/settings/actions";
import { CompanyConfigsEditor } from "@/components/admin/company-configs-editor";

export const metadata: Metadata = {
  title: "회사 설정 관리 | K SELECT NETWORK 어드민",
};

export default async function AdminCompanyConfigsPage() {
  await verifyAdminSession();
  const configs = await getSystemCompanyConfigs();

  return <CompanyConfigsEditor initialConfigs={configs} />;
}
