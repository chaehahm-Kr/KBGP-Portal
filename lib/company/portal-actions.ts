"use server";

import { revalidatePath } from "next/cache";
import { requireCompanyAdmin } from "./dal";
import { createClient } from "@/lib/supabase/server";
import { type CompanyContact } from "./admin-actions";
import { validateUploadedFile } from "@/lib/files/validate";

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

export async function portalUploadCompanyLogo(companyId: string, formData: FormData) {
  const membership = await requireCompanyAdmin();
  if (membership.companyId !== companyId) {
    throw new Error("소속 회사 정보의 로고만 변경할 수 있습니다.");
  }

  const supabase = await createClient();

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("로고 파일이 전송되지 않았습니다.");
  }

  const validation = await validateUploadedFile(file, ["image"]);
  if (!validation.ok) {
    throw new Error(`로고 유효성 에러: ${validation.error}`);
  }

  const ext = validation.detectedMime === "image/png" ? "png" : validation.detectedMime === "image/webp" ? "webp" : "jpg";
  const path = `${companyId}/logo/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("company-uploads")
    .upload(path, file, { contentType: validation.detectedMime, upsert: false });

  if (uploadError) {
    throw new Error("로고 이미지 파일 업로드에 실패했습니다.");
  }

  // Fetch current company intro to update logo path
  const { data: company } = await supabase
    .from("companies")
    .select("intro")
    .eq("id", companyId)
    .single();

  let metaObj: any = {
    description: "",
    address: "",
    website: "",
    admin_memo: "",
    contacts: [],
    type: "Brand Owner",
    status: "Active",
    logo_path: null
  };

  if (company && company.intro && company.intro.startsWith("__COMPANY_METADATA__:")) {
    try {
      metaObj = JSON.parse(company.intro.substring("__COMPANY_METADATA__:".length));
    } catch (e) {}
  }

  metaObj.logo_path = path;
  const introString = `__COMPANY_METADATA__:${JSON.stringify(metaObj)}`;

  const { error: updateError } = await supabase
    .from("companies")
    .update({ intro: introString })
    .eq("id", companyId);

  if (updateError) {
    throw new Error(`로고 메타데이터 DB 저장 실패: ${updateError.message}`);
  }

  revalidatePath(`/portal/company/info`);
  revalidatePath(`/admin/companies/${companyId}`);
}
