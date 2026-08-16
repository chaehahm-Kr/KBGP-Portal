"use server";

import { revalidatePath } from "next/cache";
import { requireCompanyAdmin } from "./dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { type CompanyContact } from "./admin-actions";
import { validateUploadedFile } from "@/lib/files/validate";
import { logRemittanceChanges } from "@/lib/company/remittance-log";

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

export async function portalUpdateSupplierProfile(
  companyId: string,
  profile: {
    status: string;
    default_currency: string;
    default_payment_terms: string;
    default_payment_terms_custom?: string;
    default_incoterms?: string;
    default_ship_from_warehouse_id?: string | null;
    default_port_of_loading?: string;
    default_production_lead_time?: string;
    default_moq?: number | null;
    po_receiving_email?: string;
    default_shipping_responsibility?: string;
  }
) {
  const membership = await requireCompanyAdmin();
  if (membership.companyId !== companyId) {
    throw new Error("소속 회사 정보만 변경할 수 있습니다.");
  }

  const adminDb = createAdminClient();

  // Fetch existing profile to preserve internal_note
  const { data: existing } = await adminDb
    .from("supplier_profiles")
    .select("internal_note")
    .eq("company_id", membership.companyId)
    .maybeSingle();

  const { error } = await adminDb
    .from("supplier_profiles")
    .upsert({
      company_id: membership.companyId,
      status: profile.status,
      default_currency: profile.default_currency || null,
      default_payment_terms: profile.default_payment_terms || null,
      default_payment_terms_custom: profile.default_payment_terms_custom || null,
      default_incoterms: profile.default_incoterms || null,
      default_ship_from_warehouse_id: profile.default_ship_from_warehouse_id || null,
      default_port_of_loading: profile.default_port_of_loading || null,
      default_production_lead_time: profile.default_production_lead_time || null,
      default_moq: profile.default_moq !== undefined ? profile.default_moq : null,
      po_receiving_email: profile.po_receiving_email || null,
      default_shipping_responsibility: profile.default_shipping_responsibility || 'LETUSTO_ARRANGED',
      internal_note: existing?.internal_note || null,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error("Portal update supplier profile error:", error);
    throw new Error(`거래 정보를 업데이트하지 못했습니다: ${error.message}`);
  }

  revalidatePath("/portal/company/info");
  revalidatePath(`/admin/companies/${companyId}`);
  return { success: true };
}

export async function portalUpdateSupplierRemittance(
  companyId: string,
  remittance: {
    payment_method?: string;
    beneficiary_name?: string;
    beneficiary_address?: string;
    bank_name?: string;
    bank_address?: string;
    bank_country?: string;
    account_number?: string;
    swift_bic?: string;
    routing_number?: string;
    account_currency?: string;
    intermediary_bank_info?: string;
    remittance_note?: string;
  }
) {
  const membership = await requireCompanyAdmin();
  if (membership.companyId !== companyId) {
    throw new Error("소속 회사 정보만 변경할 수 있습니다.");
  }

  const adminDb = createAdminClient();

  const { data: oldRemittance } = await adminDb
    .from("supplier_remittances")
    .select("*")
    .eq("company_id", membership.companyId)
    .maybeSingle();

  const { data: user } = await adminDb
    .from("company_users")
    .select("name")
    .eq("id", membership.userId)
    .maybeSingle();
  const changedByName = user?.name ? `${user.name} (Portal)` : "Portal User";

  await logRemittanceChanges(
    adminDb,
    membership.companyId,
    membership.userId,
    changedByName,
    "portal_admin",
    oldRemittance,
    remittance
  );

  const { error } = await adminDb
    .from("supplier_remittances")
    .upsert({
      company_id: membership.companyId,
      payment_method: remittance.payment_method || null,
      beneficiary_name: remittance.beneficiary_name || null,
      beneficiary_address: remittance.beneficiary_address || null,
      bank_name: remittance.bank_name || null,
      bank_address: remittance.bank_address || null,
      bank_country: remittance.bank_country || null,
      account_number: remittance.account_number || null,
      swift_bic: remittance.swift_bic || null,
      routing_number: remittance.routing_number || null,
      account_currency: remittance.account_currency || null,
      intermediary_bank_info: remittance.intermediary_bank_info || null,
      remittance_note: remittance.remittance_note || null,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error("Portal update supplier remittance error:", error);
    throw new Error(`계좌 정보를 업데이트하지 못했습니다: ${error.message}`);
  }

  revalidatePath("/portal/company/info");
  revalidatePath(`/admin/companies/${companyId}`);
  return { success: true };
}
