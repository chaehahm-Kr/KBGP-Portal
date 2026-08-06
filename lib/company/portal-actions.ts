"use server";

import { revalidatePath } from "next/cache";
import { requireCompanyAdmin } from "./dal";
import { createClient } from "@/lib/supabase/server";
import { type CompanyContact } from "./admin-actions";

export async function updateCompanyPortalMetadata(
  companyId: string,
  payload: {
    address: string;
    address_1?: string;
    address_2?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    website: string;
    contacts: CompanyContact[];
  }
) {
  // 1. Verify that the user is an admin of this specific company
  const membership = await requireCompanyAdmin();
  if (membership.companyId !== companyId) {
    throw new Error("소속 회사 정보만 변경할 수 있습니다.");
  }

  const supabase = await createClient();

  // 2. Fetch the current company record to preserve the original intro description and other metadata fields
  const { data: company } = await supabase
    .from("companies")
    .select("intro")
    .eq("id", companyId)
    .single();

  let baseDescription = "";
  let currentType = "Brand Owner";
  let currentStatus = "Active";

  if (company && company.intro) {
    if (company.intro.startsWith("__COMPANY_METADATA__:")) {
      try {
        const jsonStr = company.intro.substring("__COMPANY_METADATA__:".length);
        const parsed = JSON.parse(jsonStr);
        baseDescription = parsed.description || "";
        currentType = parsed.type || "Brand Owner";
        currentStatus = parsed.status || "Active";
      } catch (e) {}
    } else {
      baseDescription = company.intro;
    }
  }

  // 3. Construct the serialized metadata object.
  // Note: We preserve the 'type' and 'status' that were configured by Letusto Admins.
  const metaObj = {
    description: baseDescription,
    address: payload.address,
    address_1: payload.address_1 || "",
    address_2: payload.address_2 || "",
    city: payload.city || "",
    state: payload.state || "",
    zip_code: payload.zip_code || "",
    website: payload.website,
    admin_memo: company && (company as any).admin_memo ? (company as any).admin_memo : "", // Preserve admin notes if any
    contacts: payload.contacts,
    type: currentType,
    status: currentStatus,
  };

  const introString = `__COMPANY_METADATA__:${JSON.stringify(metaObj)}`;

  // Find the primary contact or fall back to the first contact
  const primaryContact = payload.contacts.find((c) => c.isPrimary) || payload.contacts[0];
  const updatePayload: Record<string, any> = {
    intro: introString,
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
    console.error("Portal company update database error:", error);
    throw new Error(`회사 정보를 업데이트하지 못했습니다: ${error.message}`);
  }

  revalidatePath(`/portal/company/info`);
  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/admin/companies");
}
