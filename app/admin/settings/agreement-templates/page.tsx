import React from "react";
import { adminListAgreementTemplatesAction } from "@/lib/agreement/actions";
import { AdminAgreementTemplatesManager } from "@/components/admin/admin-agreement-templates-manager";

export const metadata = {
  title: "계약서 템플릿 관리 | K SELECT NETWORK ADMIN",
};

export default async function AdminAgreementTemplatesPage() {
  const { templates } = await adminListAgreementTemplatesAction();

  return <AdminAgreementTemplatesManager initialTemplates={templates} />;
}
