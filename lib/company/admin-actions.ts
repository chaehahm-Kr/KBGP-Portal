"use server";

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSignedFileUrl } from "@/lib/files/storage";
import { validateUploadedFile } from "@/lib/files/validate";
import { publicEnv } from "@/lib/env/public";
import { sendTemplatedEmail } from "@/lib/notifications/templates";

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
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  website: string;
  adminMemo: string;
  contacts: CompanyContact[];
  type: string;
  types: string[];
  companyCode: string;
  status: string;
  logoPath?: string | null;
  logoUrl?: string | null;
}

export async function parseCompanyMetadata(company: any): Promise<CompanyParsedMetadata> {
  const intro = company.intro || "";
  let types: string[] = ["Brand Owner"];
  let companyCode = company.company_code || "";

  if (company.company_roles && Array.isArray(company.company_roles)) {
    types = company.company_roles.map((r: any) => r.role);
  }

  if (intro.startsWith("__COMPANY_METADATA__:")) {
    try {
      const jsonStr = intro.substring("__COMPANY_METADATA__:".length);
      const data = JSON.parse(jsonStr);
      
      const addr1 = data.address_1 || "";
      const addr2 = data.address_2 || "";
      const cityVal = data.city || "";
      const stateVal = data.state || "";
      const zipVal = data.zip_code || "";
      
      const fullAddress = addr1
        ? `${addr1}${addr2 ? " " + addr2 : ""}${cityVal ? ", " + cityVal : ""}${stateVal ? ", " + stateVal : ""}${zipVal ? " (" + zipVal + ")" : ""}`
        : (data.address || "");

      const logoPath = data.logo_path || null;
      const logoUrl = logoPath ? await getSignedFileUrl(logoPath) : null;

      // If roles not already fetched from company_roles table, fallback to metadata types
      if (!company.company_roles) {
        if (Array.isArray(data.types)) {
          types = data.types;
        } else if (typeof data.type === "string" && data.type) {
          types = [data.type];
        }
      }

      return {
        description: data.description || "",
        address: fullAddress,
        address_1: addr1,
        address_2: addr2,
        city: cityVal,
        state: stateVal,
        zip_code: zipVal,
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
        type: types[0] || "Brand Owner",
        types: types,
        companyCode,
        status: data.status || (company.status === "active" ? "Active" : "Inactive"),
        logoPath,
        logoUrl,
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
    address_1: "",
    address_2: "",
    city: "",
    state: "",
    zip_code: "",
    website: "",
    adminMemo: "",
    contacts: defaultContacts,
    type: types[0] || "Brand Owner",
    types: types,
    companyCode,
    status: company.status === "active" ? "Active" : "Inactive",
    logoPath: null,
    logoUrl: null,
  };
}

export async function updateCompanyAdminMetadata(
  companyId: string,
  payload: {
    name?: string;
    country?: string;
    address: string;
    address_1?: string;
    address_2?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    website: string;
    adminMemo: string;
    contacts: CompanyContact[];
    types: string[];
    status: string;
    companyCode?: string;
    businessRegistrationNumber?: string;
    createdAt?: string;
  }
) {
  await verifyAdminSession();
  const supabase = createAdminClient(); // Bypasses RLS to allow admin updates

  // Fetch current company record to preserve the original intro description, logo path, and company_code
  const { data: company } = await supabase
    .from("companies")
    .select("intro, company_code")
    .eq("id", companyId)
    .single();

  let baseDescription = "";
  let baseLogoPath = null;
  if (company) {
    if (company.intro && company.intro.startsWith("__COMPANY_METADATA__:")) {
      try {
        const jsonStr = company.intro.substring("__COMPANY_METADATA__:".length);
        const parsed = JSON.parse(jsonStr);
        baseDescription = parsed.description || "";
        baseLogoPath = parsed.logo_path || null;
      } catch (e) {}
    } else {
      baseDescription = company.intro || "";
    }
  }

  const metaObj = {
    description: baseDescription,
    address: payload.address,
    address_1: payload.address_1 || "",
    address_2: payload.address_2 || "",
    city: payload.city || "",
    state: payload.state || "",
    zip_code: payload.zipCode || "",
    website: payload.website,
    admin_memo: payload.adminMemo,
    contacts: payload.contacts,
    type: payload.types[0] || "",
    types: payload.types,
    logo_path: baseLogoPath,
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

  if (payload.name) {
    updatePayload.name = payload.name;
  }
  if (payload.country) {
    updatePayload.country = payload.country;
  }
  if (payload.businessRegistrationNumber) {
    updatePayload.business_registration_number = payload.businessRegistrationNumber;
  }
  if (payload.createdAt) {
    updatePayload.created_at = new Date(payload.createdAt).toISOString();
  }

  // Handle company_code update if authorized
  if (payload.companyCode && company) {
    const { userId } = await verifyAdminSession();
    const { data: userRoles } = await supabase
      .from("staff_roles")
      .select("role")
      .eq("staff_id", userId);
    const isSuperAdmin = (userRoles ?? []).some((r) => r.role === "super_admin");

    if (isSuperAdmin && payload.companyCode !== company.company_code) {
      const codeRegex = /^[A-Z]{3}-\d{3}$/;
      if (!codeRegex.test(payload.companyCode)) {
        throw new Error("올바른 형태의 Company Code가 아닙니다 (예: ABC-123)");
      }
      const { data: duplicate } = await supabase
        .from("companies")
        .select("id")
        .eq("company_code", payload.companyCode)
        .neq("id", companyId)
        .maybeSingle();

      if (duplicate) {
        throw new Error("이미 존재하는 Company Code입니다.");
      }
      updatePayload.company_code = payload.companyCode;
    }
  }

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
    throw new Error(`회사 정보 수정 실패: ${error.message}`);
  }

  // Sync normalized company_roles table
  // Clear old roles
  const { error: delRolesErr } = await supabase
    .from("company_roles")
    .delete()
    .eq("company_id", companyId);

  if (delRolesErr) {
    throw new Error(`회사 역할 정보 초기화 실패: ${delRolesErr.message}`);
  }

  // Insert new roles
  if (payload.types.length > 0) {
    const roleInserts = payload.types.map(role => ({ company_id: companyId, role }));
    const { error: insRolesErr } = await supabase
      .from("company_roles")
      .insert(roleInserts);

    if (insRolesErr) {
      throw new Error(`회사 역할 정보 저장 실패: ${insRolesErr.message}`);
    }
  }

  // Inactivate supplier profile if 'Supplier' role is deselected (preserve data)
  if (!payload.types.includes("Supplier")) {
    await supabase
      .from("supplier_profiles")
      .update({ status: "inactive" })
      .eq("company_id", companyId);
  }

  revalidatePath(`/admin/companies/${companyId}`);
}

export async function adminUploadCompanyLogo(companyId: string, formData: FormData) {
  await verifyAdminSession();
  const supabase = createAdminClient();

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

  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/admin/companies");
}

import { deactivateUserSessions } from "@/lib/auth/admin-actions";

export async function adminInviteCompanyUser(
  companyId: string,
  payload: {
    name: string;
    email: string;
    title: string;
    position: string;
    phone: string;
    companyRole: "company_admin" | "company_staff";
    isPrimary: boolean;
    permissions: Record<string, any>;
  }
) {
  await verifyAdminSession();
  const admin = createAdminClient();

  // 1. Check if email already registered
  const { data: existing } = await admin
    .from("company_users")
    .select("id")
    .eq("email", payload.email)
    .maybeSingle();

  if (existing) {
    throw new Error("이미 이메일로 등록된 담당자가 존재합니다.");
  }

  // 2. Invite Auth User
  const { data: invited, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(payload.email, {
      data: { role: "portal", display_name: payload.name },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3010'}/portal/invite/accept`,
    });

  if (inviteError || !invited.user) {
    throw new Error(`사용자 초대 실패: ${inviteError?.message || "알 수 없는 에러"}`);
  }

  // 3. Handle isPrimary
  if (payload.isPrimary) {
    await admin
      .from("company_users")
      .update({ is_primary: false })
      .eq("company_id", companyId);
  }

  // 4. Insert into company_users
  const { error: insertError } = await admin.from("company_users").insert({
    id: invited.user.id,
    company_id: companyId,
    name: payload.name,
    email: payload.email,
    company_role: payload.companyRole,
    status: "invited",
    title: payload.title,
    position: payload.position,
    phone: payload.phone,
    is_primary: payload.isPrimary,
    permissions: payload.permissions,
    invited_at: new Date().toISOString(),
  });

  if (insertError) {
    console.error("Insert error:", insertError);
    throw new Error(`담당자 정보 저장 실패: ${insertError.message}`);
  }

  revalidatePath(`/admin/companies/${companyId}`);
}

export async function adminUpdateCompanyUser(
  companyId: string,
  targetUserId: string,
  payload: {
    name: string;
    title: string;
    position: string;
    phone: string;
    companyRole: "company_admin" | "company_staff";
    status: "active" | "suspended" | "invited";
    isPrimary: boolean;
    permissions: Record<string, any>;
  }
) {
  await verifyAdminSession();
  const admin = createAdminClient();

  // 1. Fetch current status to detect changes
  const { data: target } = await admin
    .from("company_users")
    .select("status, company_role")
    .eq("id", targetUserId)
    .single();

  if (!target) {
    throw new Error("대상 사용자를 찾을 수 없습니다.");
  }

  // 2. Handle isPrimary
  if (payload.isPrimary) {
    await admin
      .from("company_users")
      .update({ is_primary: false })
      .eq("company_id", companyId)
      .neq("id", targetUserId);
  }

  // 3. Update company_users
  const { error: updateError } = await admin
    .from("company_users")
    .update({
      name: payload.name,
      title: payload.title,
      position: payload.position,
      phone: payload.phone,
      company_role: payload.companyRole,
      status: payload.status,
      is_primary: payload.isPrimary,
      permissions: payload.permissions,
    })
    .eq("id", targetUserId);

  if (updateError) {
    throw new Error(`담당자 정보 업데이트 실패: ${updateError.message}`);
  }

  // 4. Force log out sessions if suspended or role changed
  const deactivated = payload.status === "suspended" && target.status !== "suspended";
  const roleChanged = payload.companyRole !== target.company_role;
  if (deactivated || roleChanged) {
    await deactivateUserSessions(targetUserId);
  }

  revalidatePath(`/admin/companies/${companyId}`);
}

export async function adminDeleteCompanyUser(companyId: string, targetUserId: string) {
  await verifyAdminSession();
  const admin = createAdminClient();

  // Delete from company_users (which cascade deletes profiles or we can delete auth)
  const { error: deleteError } = await admin
    .from("company_users")
    .delete()
    .eq("id", targetUserId);

  if (deleteError) {
    throw new Error(`담당자 삭제 실패: ${deleteError.message}`);
  }

  // Also delete Auth User
  await admin.auth.admin.deleteUser(targetUserId);

  revalidatePath(`/admin/companies/${companyId}`);
}

/**
 * Super Admin 또는 Admin이 특정 회사 유저에게 포털 가입 요청 이메일을 발송합니다.
 */
export async function sendPortalInvitationAction(companyUserId: string) {
  const session = await verifyAdminSession();
  const admin = createAdminClient();

  const { data: target } = await admin
    .from("company_users")
    .select("email, name, company_id, status")
    .eq("id", companyUserId)
    .single();

  if (!target) {
    throw new Error("대상 사용자를 찾을 수 없습니다.");
  }
  if (target.status !== "invited") {
    throw new Error("초대 대기중인 사용자에게만 가입 요청을 보낼 수 있습니다.");
  }

  const siteUrl = publicEnv.NEXT_PUBLIC_SITE_URL;
  const portalUrl = `${siteUrl}/portal/signup`;

  await sendTemplatedEmail("portal_signup_request", target.email, {
    contactName: target.name || "브랜드사 담당자",
    portalUrl: portalUrl,
  });

  const { error: updateError } = await admin
    .from("company_users")
    .update({
      invited_at: new Date().toISOString(),
    })
    .eq("id", companyUserId);

  if (updateError) {
    throw new Error("DB 업데이트 실패: " + updateError.message);
  }

  revalidatePath("/admin/applications");
  revalidatePath("/admin/companies");
  revalidatePath(`/admin/companies/${target.company_id}`);
}

const adminCompanySchema = z.object({
  name: z.string().trim().min(1, "회사명을 입력해주세요."),
  businessNumber: z.string().trim().min(1, "사업자등록번호를 입력해주세요."),
  country: z.string().trim().min(1, "국가를 입력해주세요."),
  type: z.string().trim().min(1, "회사 유형을 선택해주세요."),
  status: z.string().trim().min(1, "파트너 상태를 선택해주세요."),
  address1: z.string().trim().optional(),
  address2: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  zipCode: z.string().trim().optional(),
  website: z.string().trim().optional(),
  adminMemo: z.string().trim().optional(),
  contactName: z.string().trim().min(1, "담당자 이름을 입력해주세요."),
  contactEmail: z.string().trim().email("올바른 이메일 형식이 아닙니다."),
  contactPhone: z.string().trim().min(1, "담당자 연락처를 입력해주세요."),
  contactTitle: z.string().trim().optional(),
  contactPosition: z.string().trim().optional(),
});

export type AdminCompanyFormState = { error: string } | undefined;

export async function adminCreateCompany(
  _prevState: AdminCompanyFormState,
  formData: FormData
): Promise<AdminCompanyFormState> {
  await verifyAdminSession();
  const admin = createAdminClient();

  const parsed = adminCompanySchema.safeParse({
    name: formData.get("name"),
    businessNumber: formData.get("businessNumber"),
    country: formData.get("country"),
    type: formData.get("type"),
    status: formData.get("status"),
    address1: formData.get("address1"),
    address2: formData.get("address2"),
    city: formData.get("city"),
    state: formData.get("state"),
    zipCode: formData.get("zipCode"),
    website: formData.get("website"),
    adminMemo: formData.get("adminMemo"),
    contactName: formData.get("contactName"),
    contactEmail: formData.get("contactEmail"),
    contactPhone: formData.get("contactPhone"),
    contactTitle: formData.get("contactTitle"),
    contactPosition: formData.get("contactPosition"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요." };
  }

  const data = parsed.data;
  
  // Build fullAddress
  const fullAddress = data.address1
    ? `${data.address1}${data.address2 ? " " + data.address2 : ""}${data.city ? ", " + data.city : ""}${data.state ? ", " + data.state : ""}${data.zipCode ? " (" + data.zipCode + ")" : ""}`
    : "";

  const intro = `__COMPANY_METADATA__:${JSON.stringify({
    description: "",
    address: fullAddress,
    address_1: data.address1 || "",
    address_2: data.address2 || "",
    city: data.city || "",
    state: data.state || "",
    zip_code: data.zipCode || "",
    website: data.website || "",
    admin_memo: data.adminMemo || "",
    contacts: [
      {
        id: crypto.randomUUID(),
        name: data.contactName,
        title: data.contactTitle || "",
        position: data.contactPosition || "",
        email: data.contactEmail,
        phone: data.contactPhone,
        isPrimary: true,
      }
    ],
    type: data.type,
    status: data.status,
    logo_path: null,
  })}`;

  const { data: newCompany, error: insertError } = await admin
    .from("companies")
    .insert({
      name: data.name,
      business_registration_number: data.businessNumber,
      country: data.country,
      status: data.status === "Active" ? "active" : "inactive",
      intro: intro,
      contact_name: data.contactName,
      contact_phone: data.contactPhone,
    })
    .select("id")
    .single();

  if (insertError || !newCompany) {
    console.error("adminCreateCompany insert failed:", insertError);
    if (insertError?.code === "23505") {
      return { error: "이미 등록된 사업자등록번호 또는 회사명입니다." };
    }
    return { error: "회사 등록에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }

  revalidatePath("/admin/companies");
  redirect(`/admin/companies/${newCompany.id}`);
}

export async function adminSaveSupplierData(
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
    internal_note?: string;
  },
  remittance?: {
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
  const { userId } = await verifyAdminSession();
  const supabase = createAdminClient();

  // 1. Verify access to remittance details if provided
  if (remittance) {
    const { data: userRoles } = await supabase
      .from("staff_roles")
      .select("role")
      .eq("staff_id", userId);
    const isSuperAdmin = (userRoles ?? []).some((r) => r.role === "super_admin");

    // Check if user is assigned settlement_inquiry for this company
    const { data: assignment } = await supabase
      .from("company_task_assignments")
      .select("id")
      .eq("company_id", companyId)
      .eq("staff_id", userId)
      .eq("task_code", "settlement_inquiry")
      .maybeSingle();

    const isFinanceUser = !!assignment;

    if (!isSuperAdmin && !isFinanceUser) {
      throw new Error("은행 송금 정보(Remittance)를 수정할 권한이 없습니다.");
    }
  }

  // 2. Save Supplier Profile
  const { error: profileErr } = await supabase
    .from("supplier_profiles")
    .upsert({
      company_id: companyId,
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
      internal_note: profile.internal_note || null,
      updated_at: new Date().toISOString(),
    });

  if (profileErr) {
    throw new Error(`Supplier Profile 저장 실패: ${profileErr.message}`);
  }

  // 3. Save Supplier Remittance if provided and authorized
  if (remittance) {
    const { error: remErr } = await supabase
      .from("supplier_remittances")
      .upsert({
        company_id: companyId,
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

    if (remErr) {
      throw new Error(`Supplier Remittance 저장 실패: ${remErr.message}`);
    }
  }

  revalidatePath(`/admin/companies/${companyId}`);
  return { success: true };
}
