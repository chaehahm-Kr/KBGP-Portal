"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env/public";
import { sendEmail } from "@/lib/notifications/email";
import { sendTemplatedEmail } from "@/lib/notifications/templates";
import {
  createRetailerInvitation,
  resendRetailerInvitation,
  revokeRetailerInvitation,
} from "@/lib/retailer/onboarding-actions";
import { normalizeEmail } from "@/lib/user/validation";
import { sendPortalInvitationAction } from "@/lib/company/admin-actions";
import { generateNextApplicationNumber } from "@/lib/application/number-generator";
import { buildBrandPortalInvitationUrl, getCanonicalBrandPortalDomain } from "@/lib/utils/url-builder";
import { syncCompanyUserAclRow } from "@/lib/company/permission-store";
import { companyInsertFieldsFromMeta, replaceCompanyContacts } from "@/lib/company/company-meta-store";

function formatSubmittedDateKo(submittedAt?: string | null): string {
  if (!submittedAt) return "-";
  const dt = new Date(submittedAt);
  if (isNaN(dt.getTime())) return "-";
  return `${dt.getFullYear()}. ${dt.getMonth() + 1}. ${dt.getDate()}.`;
}

async function logApplicationActivity(
  admin: any,
  applicationId: string,
  beforeState: string,
  afterState: string,
  actorId: string,
  reason?: string
) {
  try {
    await admin.from("activity_logs").insert({
      entity_type: "application",
      entity_id: applicationId,
      before_state: beforeState,
      after_state: afterState,
      changed_by: actorId,
      reason: reason || null,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[logApplicationActivity] Failed to write activity log:", err);
  }
}

/**
 * Admin direct Brand Partner invitation flow
 */
export type DuplicateEmailCheckResult = {
  isDuplicate: boolean;
  type?: "active_user" | "pending_invitation";
  message?: string;
  details?: string;
  companyName?: string;
  companyId?: string;
};

/**
 * ADM-APP-005-R1: Global Server-side Duplicate Email Guard
 * Checks normalized email against Supabase Auth users, company_users, applications, and retailer invitations.
 */
export async function checkDuplicateEmailAction(
  email: string
): Promise<DuplicateEmailCheckResult> {
  const session = await verifyAdminSession();
  const admin = createAdminClient();

  const normalized = (email || "").trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    return { isDuplicate: false };
  }

  // 1. Check Supabase Auth users globally across the system
  try {
    const { data: authData } = await admin.auth.admin.listUsers();
    const foundAuth = (authData?.users || []).find(
      (u) => (u.email || "").trim().toLowerCase() === normalized
    );
    if (foundAuth) {
      return {
        isDuplicate: true,
        type: "active_user",
        message: "이미 K SELECT 시스템에 등록된 이메일입니다.",
        details: "Admin, Brand Portal 또는 Retailer Portal의 기존 사용자 정보를 확인해 주세요.",
      };
    }
  } catch (err) {
    console.warn("[checkDuplicateEmailAction] auth.admin.listUsers check error:", err);
  }

  // 2. Check company_users table for active portal user or pending invitation
  const { data: activeUsers } = await admin
    .from("company_users")
    .select("id, name, status, company_id, companies!company_users_company_id_fkey(name)")
    .ilike("email", normalized);

  if (activeUsers && activeUsers.length > 0) {
    const activeUser = activeUsers.find((u) => u.status === "active");
    if (activeUser) {
      const compName = (activeUser as any)?.companies?.name || "";
      return {
        isDuplicate: true,
        type: "active_user",
        message: "이미 K SELECT 시스템에 등록된 이메일입니다.",
        details: compName
          ? `등록된 회사: ${compName} — Admin, Brand Portal 또는 Retailer Portal의 기존 사용자 정보를 확인해 주세요.`
          : "Admin, Brand Portal 또는 Retailer Portal의 기존 사용자 정보를 확인해 주세요.",
        companyName: compName,
        companyId: activeUser.company_id,
      };
    }

    const pendingUser = activeUsers.find((u) => u.status === "invited");
    if (pendingUser) {
      const compName = (pendingUser as any)?.companies?.name || "";
      return {
        isDuplicate: true,
        type: "pending_invitation",
        message: "이미 초청된 이메일입니다.",
        details: compName
          ? `초청된 회사: ${compName} — 기존 초청 내역을 확인하거나 필요한 경우 초청 메일을 다시 보내주세요.`
          : "기존 초청 내역을 확인하거나 필요한 경우 초청 메일을 다시 보내주세요.",
        companyName: compName,
        companyId: pendingUser.company_id,
      };
    }

    const compName = (activeUsers[0] as any)?.companies?.name || "";
    return {
      isDuplicate: true,
      type: "active_user",
      message: "이미 K SELECT 시스템에 등록된 이메일입니다.",
      details: "Admin, Brand Portal 또는 Retailer Portal의 기존 사용자 정보를 확인해 주세요.",
      companyName: compName,
      companyId: activeUsers[0].company_id,
    };
  }

  // 3. Check applications table for existing pending/active applications
  const { data: activeApps } = await admin
    .from("applications")
    .select("id, application_number, applicant_company_name, status, partner_type")
    .ilike("applicant_contact_email", normalized)
    .neq("status", "deleted");

  if (activeApps && activeApps.length > 0) {
    const app = activeApps[0];
    return {
      isDuplicate: true,
      type: "pending_invitation",
      message: "이미 동일한 이메일로 진행 중인 신청 또는 초청 내역이 있습니다.",
      details: `기존 신청/초청 번호(${app.application_number || app.id})가 존재합니다. 기존 초청 상태를 확인하거나 초청 메일을 다시 보내주세요.`,
      companyName: app.applicant_company_name || "",
    };
  }

  // 4. Check retailer_invitations table for pending retailer invites
  const { data: pendingRetInv } = await admin
    .from("retailer_invitations")
    .select("id, email, status, company_id")
    .ilike("email", normalized)
    .neq("status", "expired")
    .maybeSingle();

  if (pendingRetInv) {
    return {
      isDuplicate: true,
      type: "pending_invitation",
      message: "이미 초청된 이메일입니다.",
      details: "리테일러 포털 초청 내역이 존재합니다. 기존 초청 상태를 확인해 주세요.",
    };
  }

  return { isDuplicate: false };
}

/**
 * Admin direct Brand Partner invitation flow
 */
export async function adminInviteBrandPartner(payload: {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  adminNotes?: string;
}): Promise<{
  success: boolean;
  error?: string;
  details?: string;
  isDuplicate?: boolean;
  duplicateType?: string;
  applicationId?: string;
  companyId?: string;
}> {
  const session = await verifyAdminSession();
  const admin = createAdminClient();

  const normalizedEmail = normalizeEmail(payload.email);
  if (!normalizedEmail) {
    return { success: false, error: "Please enter a valid email address." };
  }

  if (!payload.companyName?.trim()) {
    return { success: false, error: "Company Name is required." };
  }
  if (!payload.contactName?.trim()) {
    return { success: false, error: "Primary Contact Name is required." };
  }

  // === ADM-APP-005: Mandatory Server-Side Duplicate Check BEFORE Record Creation ===
  const dupCheck = await checkDuplicateEmailAction(normalizedEmail);
  if (dupCheck.isDuplicate) {
    return {
      success: false,
      error: dupCheck.message || "이미 등록되거나 초청된 이메일입니다.",
      details: dupCheck.details,
      isDuplicate: true,
      duplicateType: dupCheck.type,
    };
  }

  // 1. Company lookup or creation
  const { data: existingComp } = await admin
    .from("companies")
    .select("id, name")
    .ilike("name", payload.companyName.trim())
    .maybeSingle();

  let companyId: string;

  if (existingComp) {
    companyId = existingComp.id;
  } else {
    const { fields: profileFields, contacts: profileContacts } = companyInsertFieldsFromMeta({
      description: "",
      address: "",
      website: "",
      admin_memo: payload.adminNotes || "",
      contacts: [
        {
          id: crypto.randomUUID(),
          name: payload.contactName.trim(),
          email: normalizedEmail,
          phone: payload.phone?.trim() || "",
          isPrimary: true,
        },
      ],
      type: "Brand Owner",
      status: "Active",
    });

    const { data: newComp, error: compErr } = await admin
      .from("companies")
      .insert({
        name: payload.companyName.trim(),
        business_registration_number: "PENDING",
        country: "대한민국",
        status: "active",
        contact_name: payload.contactName.trim(),
        contact_phone: payload.phone?.trim() || null,
        ...profileFields,
      })
      .select("id")
      .single();

    if (compErr || !newComp) {
      console.error("[adminInviteBrandPartner] Company insert failed:", compErr);
      return { success: false, error: "Failed to create company record." };
    }
    companyId = newComp.id;
    if (profileContacts) await replaceCompanyContacts(admin, companyId, profileContacts);
  }

  // 2. Generate Secure Invitation Token (PORT-ONB-003)
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // 3. Create or update Company User
  const { data: existingUser } = await admin
    .from("company_users")
    .select("id, status")
    .eq("company_id", companyId)
    .eq("email", normalizedEmail)
    .maybeSingle();

  let companyUserId: string;

  if (existingUser) {
    companyUserId = existingUser.id;
    await admin
      .from("company_users")
      .update({
        status: "invited",
        invited_at: new Date().toISOString(),
        invitation_token_hash: tokenHash,
        invitation_expires_at: expiresAt,
        name: payload.contactName.trim(),
        phone: payload.phone?.trim() || null,
      })
      .eq("id", existingUser.id);
  } else {
    const { data: invitedAuth } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: false,
      user_metadata: { role: "portal", display_name: payload.contactName.trim() },
    });

    companyUserId = invitedAuth?.user?.id || crypto.randomUUID();

    await admin.from("company_users").insert({
      id: companyUserId,
      company_id: companyId,
      name: payload.contactName.trim(),
      email: normalizedEmail,
      company_role: "company_admin",
      status: "invited",
      invited_at: new Date().toISOString(),
      invitation_token_hash: tokenHash,
      invitation_expires_at: expiresAt,
      phone: payload.phone?.trim() || null,
      is_primary: true,
    });
    await syncCompanyUserAclRow(admin, {
      userId: companyUserId,
      companyId,
      permissionsJson: {},
      companyRole: "company_admin",
    });
  }

  // 4. Generate Application Number & Record (ADM-APP-005-R1: APP-YYYYMMDD-I####)
  const { applicationNumber } = await generateNextApplicationNumber(admin, "admin_invitation");

  const { data: appRow, error: appErr } = await admin
    .from("applications")
    .insert({
      company_id: companyId,
      onboarded_company_id: null,
      application_number: applicationNumber,
      partner_type: "brand",
      entry_mode: "admin_invitation",
      status: "invitation_sent",
      applicant_company_name: payload.companyName.trim(),
      applicant_contact_name: payload.contactName.trim(),
      applicant_contact_email: normalizedEmail,
      applicant_contact_phone: payload.phone?.trim() || null,
      submitted_at: new Date().toISOString(),
      motivation_note: payload.adminNotes || "Admin Brand Direct Invitation",
    })
    .select("id")
    .single();

  if (appErr || !appRow) {
    console.error("[adminInviteBrandPartner] Application insert error:", appErr);
    return { success: false, error: "Failed to create application record." };
  }

  await logApplicationActivity(admin, appRow.id, "none", "invitation_sent", session.userId, "Admin Direct Brand Invitation");

  // 5. ADM-EMAIL-005: Send Templated Brand Invitation Email with Secure Activation Link
  const portalSignupUrl = buildBrandPortalInvitationUrl(rawToken);

  const sendRes = await sendTemplatedEmail("portal_signup_request", normalizedEmail, {
    contact_name: payload.contactName.trim(),
    contactName: payload.contactName.trim(),
    company_name: payload.companyName.trim(),
    companyName: payload.companyName.trim(),
    entry_mode: "admin_invitation",
    isDirectInvite: "true",
    portal_signup_url: portalSignupUrl,
    portalSignupUrl: portalSignupUrl,
    button_label: "브랜드 포털 가입하기",
    buttonLabel: "브랜드 포털 가입하기",
    support_email: "support@kselectnetwork.com",
    supportEmail: "support@kselectnetwork.com",
  });

  if (!sendRes.success) {
    console.warn("[adminInviteBrandPartner] Email delivery warning:", sendRes.error);
  }

  revalidatePath("/admin/applications");
  return { success: true, applicationId: appRow.id, companyId };
}

/**
 * Admin direct Retailer Partner invitation flow
 */
export async function adminInviteRetailerPartner(payload: {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  companyAddress?: string;
  adminNotes?: string;
}): Promise<{ success: boolean; error?: string; applicationId?: string; companyId?: string }> {
  const session = await verifyAdminSession();
  const admin = createAdminClient();

  const normalizedEmail = normalizeEmail(payload.email);
  if (!normalizedEmail) {
    return { success: false, error: "Please enter a valid email address." };
  }

  if (!payload.companyName?.trim()) {
    return { success: false, error: "Company Name is required." };
  }
  if (!payload.contactName?.trim()) {
    return { success: false, error: "Owner / Primary Contact Name is required." };
  }

  // === ADM-APP-005: Mandatory Server-Side Duplicate Check BEFORE Record Creation ===
  const dupCheck = await checkDuplicateEmailAction(normalizedEmail);
  if (dupCheck.isDuplicate) {
    return {
      success: false,
      error: dupCheck.message || "이미 등록되거나 초청된 이메일입니다.",
    };
  }

  // 1. Check or create Company
  const { data: existingComp } = await admin
    .from("companies")
    .select("id, name")
    .ilike("name", payload.companyName.trim())
    .maybeSingle();

  let companyId: string;

  if (existingComp) {
    companyId = existingComp.id;
  } else {
    const { fields: profileFields, contacts: profileContacts } = companyInsertFieldsFromMeta({
      description: "",
      address: payload.companyAddress || "",
      website: "",
      admin_memo: payload.adminNotes || "",
      contacts: [
        {
          id: crypto.randomUUID(),
          name: payload.contactName.trim(),
          email: normalizedEmail,
          phone: payload.phone?.trim() || "",
          isPrimary: true,
        },
      ],
      type: "Retailer Partner",
      status: "Active",
    });

    const { data: newComp, error: compErr } = await admin
      .from("companies")
      .insert({
        name: payload.companyName.trim(),
        business_registration_number: "PENDING",
        country: "USA",
        status: "active",
        contact_name: payload.contactName.trim(),
        contact_phone: payload.phone?.trim() || null,
        ...profileFields,
      })
      .select("id")
      .single();

    if (compErr || !newComp) {
      console.error("[adminInviteRetailerPartner] Company insert failed:", compErr);
      return { success: false, error: "Failed to create company record." };
    }
    companyId = newComp.id;
    if (profileContacts) await replaceCompanyContacts(admin, companyId, profileContacts);
  }

  // 2. Generate Application number
  const { data: appNum } = await admin.rpc("generate_application_number");
  const applicationNumber = appNum || `APP-${Date.now().toString().slice(-6)}`;

  // 3. Create Retailer Invitation via single-use hashed token framework (RTP-ONB-001)
  const inviteRes = await createRetailerInvitation({
    companyId,
    email: normalizedEmail,
    name: payload.contactName.trim(),
    role: "owner",
    hasAllStoresAccess: true,
  });

  if (!inviteRes.success) {
    return { success: false, error: inviteRes.error || "Failed to create retailer invitation." };
  }

  // 4. Create Application intake record
  const { data: appRow, error: appErr } = await admin
    .from("applications")
    .insert({
      company_id: companyId,
      onboarded_company_id: null,
      invitation_id: inviteRes.invitationId,
      application_number: applicationNumber,
      partner_type: "retailer",
      entry_mode: "admin_invitation",
      status: "invitation_sent",
      applicant_company_name: payload.companyName.trim(),
      applicant_contact_name: payload.contactName.trim(),
      applicant_contact_email: normalizedEmail,
      applicant_contact_phone: payload.phone?.trim() || null,
      applicant_address: payload.companyAddress ? { address: payload.companyAddress } : {},
      submitted_at: new Date().toISOString(),
      motivation_note: payload.adminNotes || "Admin Retailer Direct Invitation",
    })
    .select("id")
    .single();

  if (appErr || !appRow) {
    console.error("[adminInviteRetailerPartner] Application insert error:", appErr);
    return { success: false, error: "Failed to create application record." };
  }

  await logApplicationActivity(admin, appRow.id, "none", "invitation_sent", session.userId, "Admin Direct Retailer Invitation");

  revalidatePath("/admin/applications");
  return { success: true, applicationId: appRow.id, companyId };
}

/**
 * Approve & Invite action from Application detail view
 */
/**
 * Approve & Invite action from Application detail view
 */
export async function approveAndInviteApplication(
  applicationId: string,
  reviewerNotes?: string
): Promise<{ success: boolean; emailSent?: boolean; messageId?: string; error?: string }> {
  const session = await verifyAdminSession();
  const admin = createAdminClient();

  const { data: app, error: findErr } = await admin
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .single();

  if (findErr || !app) {
    return { success: false, error: "신청서 정보를 찾을 수 없습니다." };
  }

  const beforeState = app.status || "submitted";
  const partnerType = app.partner_type || "brand";
  const compName = app.applicant_company_name || "Partner Company";
  const contactName = app.applicant_contact_name || "Partner Contact";
  const contactEmail = app.applicant_contact_email;

  if (partnerType === "retailer") {
    let emailToUse = contactEmail;
    let nameToUse = contactName;

    if (!emailToUse && app.company_id) {
      const { data: cu } = await admin
        .from("company_users")
        .select("email, name")
        .eq("company_id", app.company_id)
        .maybeSingle();

      if (cu) {
        emailToUse = cu.email;
        nameToUse = cu.name || nameToUse;
      }
    }

    if (!emailToUse) {
      return { success: false, error: "초대 이메일을 발송할 담당자 이메일 주소가 없습니다." };
    }

    let companyId = app.company_id || app.onboarded_company_id;
    if (!companyId) {
      const { data: newComp } = await admin
        .from("companies")
        .insert({
          name: compName,
          business_registration_number: "PENDING",
          country: "USA",
          status: "active",
          contact_name: nameToUse,
        })
        .select("id")
        .single();
      companyId = newComp?.id;
    }

    if (!companyId) {
      return { success: false, error: "리테일러 회사 레코드를 생성할 수 없습니다." };
    }

    const inviteRes = await createRetailerInvitation({
      companyId,
      email: emailToUse,
      name: nameToUse,
      role: "owner",
      hasAllStoresAccess: true,
    });

    if (!inviteRes.success) {
      return { success: false, error: inviteRes.error || "리테일러 초대 생성에 실패했습니다." };
    }

    await admin
      .from("applications")
      .update({
        status: "invitation_sent",
        invitation_id: inviteRes.invitationId,
        company_id: companyId,
        onboarded_company_id: null,
        review_notes: reviewerNotes || "Approved & Invited Retailer",
        updated_at: new Date().toISOString(),
      })
      .eq("id", applicationId);

    await logApplicationActivity(admin, applicationId, beforeState, "invitation_sent", session.userId, reviewerNotes || "Approved & Invited Retailer");

    revalidatePath("/admin/applications");
    revalidatePath(`/admin/applications/${applicationId}`);
    return { success: true, emailSent: true };
  }

  // === Brand Approve & Invite ===
  let emailToUse = contactEmail;
  let nameToUse = contactName;

  if (!emailToUse && app.company_id) {
    const { data: cu } = await admin
      .from("company_users")
      .select("email, name")
      .eq("company_id", app.company_id)
      .maybeSingle();

    if (cu) {
      emailToUse = cu.email;
      nameToUse = cu.name || nameToUse;
    }
  }

  if (!emailToUse) {
    return { success: false, error: "초대 이메일을 발송할 담당자 이메일 주소가 없습니다." };
  }

  let companyId = app.company_id || app.onboarded_company_id;
  if (!companyId) {
    const { data: newComp } = await admin
      .from("companies")
      .insert({
        name: compName,
        business_registration_number: "PENDING",
        country: "대한민국",
        status: "active",
        contact_name: nameToUse,
      })
      .select("id")
      .single();
    companyId = newComp?.id;
  }

  if (!companyId) {
    return { success: false, error: "회사 레코드를 생성 또는 연결할 수 없습니다." };
  }

  // Ensure Company User exists & update invited_at
  const { data: existingCu } = await admin
    .from("company_users")
    .select("id, status")
    .eq("company_id", companyId)
    .eq("email", emailToUse)
    .maybeSingle();

  if (!existingCu) {
    const { data: invitedAuth } = await admin.auth.admin.createUser({
      email: emailToUse,
      email_confirm: false,
      user_metadata: { role: "portal", display_name: nameToUse },
    });

    if (invitedAuth?.user) {
      await admin.from("company_users").insert({
        id: invitedAuth.user.id,
        company_id: companyId,
        name: nameToUse,
        email: emailToUse,
        company_role: "company_admin",
        status: "invited",
        invited_at: new Date().toISOString(),
        is_primary: true,
      });
      await syncCompanyUserAclRow(admin, {
        userId: invitedAuth.user.id,
        companyId,
        permissionsJson: {},
        companyRole: "company_admin",
      });
    }
  } else {
    // Update existing company_users to set invited_at
    await admin
      .from("company_users")
      .update({
        status: "invited",
        invited_at: new Date().toISOString(),
      })
      .eq("id", existingCu.id);
  }

  // Update Application state to approved
  await admin
    .from("applications")
    .update({
      status: "approved",
      company_id: companyId,
      onboarded_company_id: null,
      review_notes: reviewerNotes || "Approved & Invited Brand",
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  await logApplicationActivity(admin, applicationId, beforeState, "approved", session.userId, reviewerNotes || "Approved & Invited Brand");

  // Send Brand Invitation email via templated system
  const submittedDateStr = formatSubmittedDateKo(app.submitted_at);
  const portalSignupUrl = "https://portal.kselectnetwork.com/portal/signup";
  const sendRes = await sendTemplatedEmail("portal_signup_request", emailToUse, {
    contact_name: nameToUse,
    contactName: nameToUse,
    company_name: compName,
    companyName: compName,
    application_id: app.application_number || applicationId,
    applicationId: app.application_number || applicationId,
    applicationNumber: app.application_number || applicationId,
    submitted_date: submittedDateStr,
    submittedDate: submittedDateStr,
    portal_signup_url: portalSignupUrl,
    portalUrl: portalSignupUrl,
    support_email: "support@kselectnetwork.com",
    supportEmail: "support@kselectnetwork.com",
  });

  if (sendRes.success) {
    await logApplicationActivity(
      admin,
      applicationId,
      "approved",
      "approved",
      session.userId,
      `파트너 초대 메일 발송 완료: ${emailToUse} (Message ID: ${sendRes.messageId || "sent"})`
    );
    revalidatePath("/admin/applications");
    revalidatePath(`/admin/applications/${applicationId}`);
    return { success: true, emailSent: true, messageId: sendRes.messageId };
  } else {
    await logApplicationActivity(
      admin,
      applicationId,
      "approved",
      "approved",
      session.userId,
      `파트너 초대 메일 발송 실패: ${emailToUse} (${sendRes.error})`
    );
    revalidatePath("/admin/applications");
    revalidatePath(`/admin/applications/${applicationId}`);
    return {
      success: true,
      emailSent: false,
      error: `파트너 승인은 완료되었지만 초대 이메일 발송에 실패했습니다: ${sendRes.error}`,
    };
  }
}

/**
 * Resend Invitation for Application
 */
export async function resendApplicationInvitation(
  applicationId: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const session = await verifyAdminSession();
  const admin = createAdminClient();

  const { data: app } = await admin
    .from("applications")
    .select("id, application_number, partner_type, status, invitation_id, company_id, applicant_company_name, applicant_contact_name, applicant_contact_email, submitted_at")
    .eq("id", applicationId)
    .single();

  if (!app) return { success: false, error: "신청서 정보를 찾을 수 없습니다." };

  if (app.partner_type === "retailer" && app.invitation_id) {
    const res = await resendRetailerInvitation(app.invitation_id);
    if (!res.success) return { success: false, error: res.error || "리테일러 초대장 재발송에 실패했습니다." };
    await logApplicationActivity(admin, applicationId, app.status, app.status, session.userId, "리테일러 초대장 재발송 완료");
    revalidatePath(`/admin/applications/${applicationId}`);
    return { success: true };
  }

  // === Brand Resend ===
  let emailToUse = app.applicant_contact_email;
  let nameToUse = app.applicant_contact_name || "브랜드사 담당자";

  if (app.company_id) {
    const { data: cu } = await admin
      .from("company_users")
      .select("id, email, name, status")
      .eq("company_id", app.company_id)
      .maybeSingle();

    if (cu) {
      emailToUse = cu.email || emailToUse;
      nameToUse = cu.name || nameToUse;
      await admin
        .from("company_users")
        .update({
          invited_at: new Date().toISOString(),
        })
        .eq("id", cu.id);
    }
  }

  if (!emailToUse) {
    return { success: false, error: "초대 이메일을 재발송할 수신자 이메일 주소가 없습니다." };
  }

  const submittedDateStr = formatSubmittedDateKo(app.submitted_at);
  const portalSignupUrl = "https://portal.kselectnetwork.com/portal/signup";
  const sendRes = await sendTemplatedEmail("portal_signup_request", emailToUse, {
    contact_name: nameToUse,
    contactName: nameToUse,
    company_name: app.applicant_company_name || "",
    companyName: app.applicant_company_name || "",
    application_id: app.application_number || applicationId,
    applicationId: app.application_number || applicationId,
    applicationNumber: app.application_number || applicationId,
    submitted_date: submittedDateStr,
    submittedDate: submittedDateStr,
    portal_signup_url: portalSignupUrl,
    portalUrl: portalSignupUrl,
    support_email: "support@kselectnetwork.com",
    supportEmail: "support@kselectnetwork.com",
  });

  if (!sendRes.success) {
    await logApplicationActivity(
      admin,
      applicationId,
      app.status,
      app.status,
      session.userId,
      `파트너 초대장 재발송 실패: ${emailToUse} (${sendRes.error})`
    );
    return { success: false, error: sendRes.error || "초대장 이메일 발송에 실패했습니다." };
  }

  await logApplicationActivity(
    admin,
    applicationId,
    app.status,
    app.status,
    session.userId,
    `파트너 초대장 재발송 완료: ${emailToUse} (Message ID: ${sendRes.messageId || "sent"})`
  );
  revalidatePath(`/admin/applications/${applicationId}`);
  return { success: true, messageId: sendRes.messageId };
}

/**
 * Revoke Invitation for Application and return to initial review state
 */
export async function revokeApplicationInvitation(
  applicationId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const session = await verifyAdminSession();
  const admin = createAdminClient();

  const { data: app, error: appFetchErr } = await admin
    .from("applications")
    .select("id, application_number, partner_type, status, invitation_id, company_id, applicant_company_name, applicant_contact_email, applicant_contact_name")
    .eq("id", applicationId)
    .single();

  if (appFetchErr || !app) {
    return { success: false, error: "신청서 정보를 찾을 수 없습니다." };
  }

  // 1. Retailer invitation revocation if applicable
  if (app.partner_type === "retailer" && app.invitation_id) {
    const res = await revokeRetailerInvitation(app.invitation_id);
    if (!res.success) {
      return { success: false, error: res.error || "리테일러 초대 취소에 실패했습니다." };
    }
  }

  // 2. Brand Partner / Company User invitation eligibility invalidation
  // Reset invited_at to null for any unactivated users so they cannot activate with old invite
  if (app.company_id) {
    const { error: cuUpdateErr } = await admin
      .from("company_users")
      .update({
        invited_at: null,
      })
      .eq("company_id", app.company_id)
      .neq("status", "active");

    if (cuUpdateErr) {
      console.error("[revokeApplicationInvitation] Error clearing company_users invited_at:", cuUpdateErr);
    }
  }

  // 3. Reset Application status back to 'submitted' (initial review state)
  const beforeState = app.status || "approved";
  const targetStatus = "submitted";

  const { error: appUpdateErr } = await admin
    .from("applications")
    .update({
      status: targetStatus,
      invitation_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  if (appUpdateErr) {
    return { success: false, error: appUpdateErr.message || "신청서 상태 초기화에 실패했습니다." };
  }

  // 4. Record granular audit log
  await logApplicationActivity(
    admin,
    applicationId,
    beforeState,
    targetStatus,
    session.userId,
    `PARTNER_INVITATION_REVOKED: Invitation revoked by Admin. Application returned to initial review state. (Company: ${app.applicant_company_name || app.company_id}, Email: ${app.applicant_contact_email || "N/A"})`
  );

  revalidatePath("/admin/applications");
  revalidatePath(`/admin/applications/${applicationId}`);
  return {
    success: true,
    message: "초대장이 취소되었으며, 신청서가 초기 심사(접수/검토) 상태로 복구되었습니다.",
  };
}

/**
 * Reject application action with structured reason and customer notification
 */
export async function rejectApplication(
  applicationId: string,
  internalReason: string,
  applicantMessage?: string
): Promise<{ success: boolean; emailSent?: boolean; messageId?: string; error?: string }> {
  const session = await verifyAdminSession();
  const admin = createAdminClient();

  const { data: app, error: findErr } = await admin
    .from("applications")
    .select("id, application_number, status, partner_type, applicant_company_name, applicant_contact_name, applicant_contact_email, company_id")
    .eq("id", applicationId)
    .single();

  if (findErr || !app) {
    return { success: false, error: "신청서 정보를 찾을 수 없습니다." };
  }

  if (app.status === "rejected") {
    return { success: false, error: "이미 거절 처리된 신청서입니다." };
  }

  const beforeState = app.status || "under_review";
  const appNumber = app.application_number || applicationId;
  const compName = app.applicant_company_name || "파트너사";
  const contactName = app.applicant_contact_name || "신청자";
  const contactEmail = app.applicant_contact_email;

  const { error: updateErr } = await admin
    .from("applications")
    .update({
      status: "rejected",
      review_notes: internalReason || "Application Rejected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  if (updateErr) {
    console.error("[rejectApplication] Update error:", updateErr);
    return { success: false, error: "신청서 상태 변경에 실패했습니다." };
  }

  await logApplicationActivity(
    admin,
    applicationId,
    beforeState,
    "rejected",
    session.userId,
    `거절 사유: ${internalReason || "사유 미입력"}`
  );

  if (!contactEmail) {
    revalidatePath("/admin/applications");
    revalidatePath(`/admin/applications/${applicationId}`);
    return {
      success: true,
      emailSent: false,
      error: "신청서에 등록된 담당자 이메일이 없어 안내 메일은 발송되지 않았습니다.",
    };
  }

  const sendRes = await sendTemplatedEmail("brand_application_rejected", contactEmail, {
    contact_name: contactName,
    company_name: compName,
    application_id: appNumber,
    applicant_message: applicantMessage || "",
    support_email: "support@kselectnetwork.com",
  });

  if (sendRes.success) {
    await logApplicationActivity(
      admin,
      applicationId,
      "rejected",
      "rejected",
      session.userId,
      `거절 안내 메일 발송 완료: ${contactEmail} (Message ID: ${sendRes.messageId || "sent"})`
    );
    revalidatePath("/admin/applications");
    revalidatePath(`/admin/applications/${applicationId}`);
    return { success: true, emailSent: true, messageId: sendRes.messageId };
  } else {
    await logApplicationActivity(
      admin,
      applicationId,
      "rejected",
      "rejected",
      session.userId,
      `거절 안내 메일 발송 실패: ${contactEmail} (${sendRes.error})`
    );
    revalidatePath("/admin/applications");
    revalidatePath(`/admin/applications/${applicationId}`);
    return {
      success: true,
      emailSent: false,
      error: `신청은 거절 처리되었지만 안내 이메일 발송에 실패했습니다: ${sendRes.error}`,
    };
  }
}

/**
 * Resend Application Rejection Email
 */
export async function resendApplicationRejectionEmail(
  applicationId: string,
  applicantMessage?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const session = await verifyAdminSession();
  const admin = createAdminClient();

  const { data: app } = await admin
    .from("applications")
    .select("id, application_number, status, applicant_company_name, applicant_contact_name, applicant_contact_email")
    .eq("id", applicationId)
    .single();

  if (!app) return { success: false, error: "신청서 정보를 찾을 수 없습니다." };
  if (app.status !== "rejected") {
    return { success: false, error: "거절 상태의 신청서에만 거절 안내 메일을 재발송할 수 있습니다." };
  }

  if (!app.applicant_contact_email) {
    return { success: false, error: "수신자 이메일 주소가 등록되어 있지 않습니다." };
  }

  const sendRes = await sendTemplatedEmail("brand_application_rejected", app.applicant_contact_email, {
    contact_name: app.applicant_contact_name || "신청자",
    company_name: app.applicant_company_name || "",
    application_id: app.application_number || "",
    applicant_message: applicantMessage || "",
    support_email: "support@kselectnetwork.com",
  });

  if (!sendRes.success) {
    await logApplicationActivity(
      admin,
      applicationId,
      "rejected",
      "rejected",
      session.userId,
      `거절 안내 메일 재발송 실패: ${app.applicant_contact_email} (${sendRes.error})`
    );
    return { success: false, error: sendRes.error || "거절 안내 메일 재발송에 실패했습니다." };
  }

  await logApplicationActivity(
    admin,
    applicationId,
    "rejected",
    "rejected",
    session.userId,
    `거절 안내 메일 재발송 완료: ${app.applicant_contact_email} (Message ID: ${sendRes.messageId || "sent"})`
  );
  revalidatePath(`/admin/applications/${applicationId}`);
  return { success: true, messageId: sendRes.messageId };
}
