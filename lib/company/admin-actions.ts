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
