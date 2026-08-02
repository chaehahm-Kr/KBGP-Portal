"use server";

import fs from "fs";
import path from "path";
import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";

export interface CompanyContact {
  id: string;
  name: string;
  phone: string;
  email: string;
  title: string;      // 직함 (e.g. 과장, 부장)
  position: string;   // 포지션/부서 (e.g. 해외영업부)
  isPrimary: boolean; // 주 컨택 여부
}

export interface CompanyParsedMetadata {
  description: string;
  address: string;
  website: string;
  adminMemo: string;
  contacts: CompanyContact[];
  type: string;
  status: string;
}

export async function parseCompanyMetadata(company: any): Promise<CompanyParsedMetadata> {
  const intro = company.intro || "";
  if (intro.startsWith("__COMPANY_METADATA__:")) {
    try {
      const jsonStr = intro.substring("__COMPANY_METADATA__:".length);
      const data = JSON.parse(jsonStr);
      return {
        description: data.description || "",
        address: data.address || "",
        website: data.website || "",
        adminMemo: data.admin_memo || "",
        contacts: (data.contacts || []).map((c: any) => ({
          id: c.id,
          name: c.name || "",
          phone: c.phone || "",
          email: c.email || "",
          title: c.title || "",
          position: c.position || "",
          isPrimary: typeof c.isPrimary === "boolean" ? c.isPrimary : false,
        })),
        type: data.type || "Brand Owner",
        status: data.status || (company.status === "active" ? "Active" : "Inactive"),
      };
    } catch (e) {
      // ignore
    }
  }

  // Fallback to core columns
  const defaultContacts: CompanyContact[] = [];
  if (company.contact_name || company.contact_phone) {
    defaultContacts.push({
      id: "default-contact",
      name: company.contact_name || "",
      phone: company.contact_phone || "",
      email: "",
      title: "",
      position: "기본 담당 부서",
      isPrimary: true,
    });
  }

  return {
    description: company.intro || "",
    address: "",
    website: "",
    adminMemo: "",
    contacts: defaultContacts,
    type: "Brand Owner",
    status: company.status === "active" ? "Active" : "Inactive",
  };
}

export async function updateCompanyAdminMetadata(
  companyId: string,
  payload: {
    address: string;
    website: string;
    adminMemo: string;
    contacts: CompanyContact[];
    type: string;
    status: string;
  }
) {
  await verifyAdminSession();
  const supabase = createAdminClient(); // Bypasses RLS to allow admin updates

  // Fetch current company record to preserve the original intro description
  const { data: company } = await supabase
    .from("companies")
    .select("intro")
    .eq("id", companyId)
    .single();

  let baseDescription = "";
  if (company) {
    if (company.intro && company.intro.startsWith("__COMPANY_METADATA__:")) {
      try {
        const jsonStr = company.intro.substring("__COMPANY_METADATA__:".length);
        const parsed = JSON.parse(jsonStr);
        baseDescription = parsed.description || "";
      } catch (e) {}
    } else {
      baseDescription = company.intro || "";
    }
  }

  const metaObj = {
    description: baseDescription,
    address: payload.address,
    website: payload.website,
    admin_memo: payload.adminMemo,
    contacts: payload.contacts,
    type: payload.type,
    status: payload.status,
  };

  const introString = `__COMPANY_METADATA__:${JSON.stringify(metaObj)}`;

  // Find the primary contact or fall back to the first contact
  const primaryContact = payload.contacts.find((c) => c.isPrimary) || payload.contacts[0];
  const updatePayload: Record<string, any> = {
    intro: introString,
    // Sync native status column: check (status in ('active', 'inactive'))
    status: payload.status === "Active" ? "active" : "inactive",
    updated_at: new Date().toISOString(),
  };

  if (primaryContact) {
    updatePayload.contact_name = primaryContact.name || null;
    updatePayload.contact_phone = primaryContact.phone || null;
  } else {
    updatePayload.contact_name = null;
    updatePayload.contact_phone = null;
  }

  const { error } = await supabase
    .from("companies")
    .update(updatePayload)
    .eq("id", companyId);

  if (error) {
    console.error("Database update error:", error);
    throw new Error(`회사 정보를 업데이트하지 못했습니다: ${error.message}`);
  }

  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/admin/companies");
}
