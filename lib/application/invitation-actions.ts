"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env/public";
import { sendEmail } from "@/lib/notifications/email";
import {
  createRetailerInvitation,
  resendRetailerInvitation,
  revokeRetailerInvitation,
} from "@/lib/retailer/onboarding-actions";
import { normalizeEmail } from "@/lib/user/validation";
import { sendPortalInvitationAction } from "@/lib/company/admin-actions";

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
export async function adminInviteBrandPartner(payload: {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
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
    return { success: false, error: "Primary Contact Name is required." };
  }

  // 1. Duplicate check warning & lookup
  const { data: existingComp } = await admin
    .from("companies")
    .select("id, name")
    .ilike("name", payload.companyName.trim())
    .maybeSingle();

  let companyId: string;

  if (existingComp) {
    companyId = existingComp.id;
  } else {
    const introStr = `__COMPANY_METADATA__:${JSON.stringify({
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
    })}`;

    const { data: newComp, error: compErr } = await admin
      .from("companies")
      .insert({
        name: payload.companyName.trim(),
        business_registration_number: "PENDING",
        country: "대한민국",
        status: "active",
        contact_name: payload.contactName.trim(),
        contact_phone: payload.phone?.trim() || null,
        intro: introStr,
      })
      .select("id")
      .single();

    if (compErr || !newComp) {
      console.error("[adminInviteBrandPartner] Company insert failed:", compErr);
      return { success: false, error: "Failed to create company record." };
    }
    companyId = newComp.id;
  }

  // 2. Check if auth user exists or invite auth user
  const { data: existingUser } = await admin
    .from("company_users")
    .select("id, status")
    .eq("company_id", companyId)
    .eq("email", normalizedEmail)
    .maybeSingle();

  let companyUserId: string | null = existingUser?.id || null;

  if (!existingUser) {
    const { data: invitedAuth } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: false,
      user_metadata: { role: "portal", display_name: payload.contactName.trim() },
    });

    if (invitedAuth?.user) {
      companyUserId = invitedAuth.user.id;
      await admin.from("company_users").insert({
        id: invitedAuth.user.id,
        company_id: companyId,
        name: payload.contactName.trim(),
        email: normalizedEmail,
        company_role: "company_admin",
        status: "invited",
        invited_at: new Date().toISOString(),
        phone: payload.phone?.trim() || null,
        is_primary: true,
      });
    }
  }

  // 3. Generate Application number
  const { data: appNum } = await admin.rpc("generate_application_number");
  const applicationNumber = appNum || `APP-${Date.now().toString().slice(-6)}`;

  // 4. Create Application record
  const { data: appRow, error: appErr } = await admin
    .from("applications")
    .insert({
      company_id: companyId,
      onboarded_company_id: companyId,
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

  // 5. Send Brand invitation email strictly pointing to portal.kselectnetwork.com
  const brandSiteUrl = publicEnv.NEXT_PUBLIC_SITE_URL || "https://portal.kselectnetwork.com";
  const activationUrl = `${brandSiteUrl}/portal/login`;

  try {
    await sendEmail({
      to: normalizedEmail,
      subject: `[K SELECT NETWORK] Invitation to join ${payload.companyName} Brand Portal`,
      text: `Hello ${payload.contactName},\n\nYou have been invited by K SELECT Admin to activate your Brand account for ${payload.companyName}.\n\nPlease activate your account here:\n${activationUrl}\n\nThank you,\nK SELECT Operations Team`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 20px; color: #18181b; background-color: #ffffff;">
          <div style="margin-bottom: 24px;">
            <span style="font-size: 20px; font-weight: 900; letter-spacing: -0.5px; color: #18181b;">K SELECT NETWORK</span>
            <span style="font-size: 13px; font-weight: 700; color: #71717a; margin-left: 8px;">Brand Portal</span>
          </div>
          
          <div style="background: #f4f4f5; border-radius: 16px; padding: 24px; margin-bottom: 24px;">
            <h2 style="font-size: 18px; font-weight: 800; margin: 0 0 12px 0; color: #18181b;">Brand Account Activation Invitation</h2>
            <p style="font-size: 14px; line-height: 1.6; color: #3f3f46; margin: 0;">
              Hello <strong>${payload.contactName}</strong>,<br/><br/>
              K SELECT Admin has invited <strong>${payload.companyName}</strong> to join the K SELECT Brand Portal.
            </p>
          </div>

          <div style="text-align: center; margin-bottom: 32px;">
            <a href="${activationUrl}" style="display: inline-block; background-color: #18181b; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 28px; border-radius: 12px;">
              Activate Brand Account →
            </a>
          </div>
        </div>
      `,
    });
  } catch (emailErr) {
    console.warn("[adminInviteBrandPartner] Email delivery warning:", emailErr);
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
    const introStr = `__COMPANY_METADATA__:${JSON.stringify({
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
    })}`;

    const { data: newComp, error: compErr } = await admin
      .from("companies")
      .insert({
        name: payload.companyName.trim(),
        business_registration_number: "PENDING",
        country: "USA",
        status: "active",
        contact_name: payload.contactName.trim(),
        contact_phone: payload.phone?.trim() || null,
        intro: introStr,
      })
      .select("id")
      .single();

    if (compErr || !newComp) {
      console.error("[adminInviteRetailerPartner] Company insert failed:", compErr);
      return { success: false, error: "Failed to create company record." };
    }
    companyId = newComp.id;
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
      onboarded_company_id: companyId,
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
export async function approveAndInviteApplication(
  applicationId: string,
  reviewerNotes?: string
): Promise<{ success: boolean; error?: string }> {
  const session = await verifyAdminSession();
  const admin = createAdminClient();

  const { data: app, error: findErr } = await admin
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .single();

  if (findErr || !app) {
    return { success: false, error: "Application record not found." };
  }

  const beforeState = app.status || "submitted";
  const partnerType = app.partner_type || "brand";
  const compName = app.applicant_company_name || app.company_id || "Partner Company";
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
      return { success: false, error: "Contact email is required to send invitation." };
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
      return { success: false, error: "Failed to resolve company for retailer invitation." };
    }

    const inviteRes = await createRetailerInvitation({
      companyId,
      email: emailToUse,
      name: nameToUse,
      role: "owner",
      hasAllStoresAccess: true,
    });

    if (!inviteRes.success) {
      return { success: false, error: inviteRes.error || "Failed to create retailer invitation." };
    }

    await admin
      .from("applications")
      .update({
        status: "invitation_sent",
        invitation_id: inviteRes.invitationId,
        company_id: companyId,
        onboarded_company_id: companyId,
        review_notes: reviewerNotes || "Approved & Invited Retailer",
        updated_at: new Date().toISOString(),
      })
      .eq("id", applicationId);

    await logApplicationActivity(admin, applicationId, beforeState, "invitation_sent", session.userId, reviewerNotes || "Approved & Invited Retailer");
  } else {
    // Brand Approve & Invite
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
      return { success: false, error: "Contact email is required to send invitation." };
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

    if (companyId) {
      const { data: existingCu } = await admin
        .from("company_users")
        .select("id")
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
        }
      }
    }

    // Send Brand Invitation email strictly pointing to portal.kselectnetwork.com
    const brandSiteUrl = publicEnv.NEXT_PUBLIC_SITE_URL || "https://portal.kselectnetwork.com";
    const activationUrl = `${brandSiteUrl}/portal/login`;

    await sendEmail({
      to: emailToUse,
      subject: `[K SELECT NETWORK] Application Approved & Brand Account Invitation`,
      text: `Hello ${nameToUse},\n\nYour application for ${compName} has been approved by K SELECT NETWORK.\n\nPlease log in to activate your account:\n${activationUrl}\n\nThank you,\nK SELECT Operations Team`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 20px; color: #18181b; background-color: #ffffff;">
          <h2 style="font-size: 18px; font-weight: 800; color: #18181b;">Application Approved!</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #3f3f46;">
            Your application for <strong>${compName}</strong> has been approved by K SELECT NETWORK.
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${activationUrl}" style="background-color: #18181b; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 28px; border-radius: 12px;">
              Access Brand Portal →
            </a>
          </div>
        </div>
      `,
    });

    await admin
      .from("applications")
      .update({
        status: "approved",
        company_id: companyId,
        onboarded_company_id: companyId,
        review_notes: reviewerNotes || "Approved & Invited Brand",
        updated_at: new Date().toISOString(),
      })
      .eq("id", applicationId);

    await logApplicationActivity(admin, applicationId, beforeState, "approved", session.userId, reviewerNotes || "Approved & Invited Brand");
  }

  revalidatePath("/admin/applications");
  revalidatePath(`/admin/applications/${applicationId}`);
  return { success: true };
}

/**
 * Resend Invitation for Application
 */
export async function resendApplicationInvitation(applicationId: string): Promise<{ success: boolean; error?: string }> {
  const session = await verifyAdminSession();
  const admin = createAdminClient();

  const { data: app } = await admin
    .from("applications")
    .select("id, partner_type, status, invitation_id, company_id, applicant_contact_email")
    .eq("id", applicationId)
    .single();

  if (!app) return { success: false, error: "Application not found." };

  if (app.partner_type === "retailer" && app.invitation_id) {
    const res = await resendRetailerInvitation(app.invitation_id);
    if (!res.success) return { success: false, error: res.error || "Failed to resend retailer invitation." };
  } else if (app.company_id) {
    const { data: cu } = await admin
      .from("company_users")
      .select("id")
      .eq("company_id", app.company_id)
      .eq("status", "invited")
      .maybeSingle();

    if (cu) {
      await sendPortalInvitationAction(cu.id);
    }
  }

  await logApplicationActivity(admin, applicationId, app.status, app.status, session.userId, "Resent Invitation");
  revalidatePath(`/admin/applications/${applicationId}`);
  return { success: true };
}

/**
 * Revoke Invitation for Application
 */
export async function revokeApplicationInvitation(applicationId: string): Promise<{ success: boolean; error?: string }> {
  const session = await verifyAdminSession();
  const admin = createAdminClient();

  const { data: app } = await admin
    .from("applications")
    .select("id, partner_type, status, invitation_id, company_id")
    .eq("id", applicationId)
    .single();

  if (!app) return { success: false, error: "Application not found." };

  if (app.partner_type === "retailer" && app.invitation_id) {
    const res = await revokeRetailerInvitation(app.invitation_id);
    if (!res.success) return { success: false, error: res.error || "Failed to revoke retailer invitation." };
  }

  await admin
    .from("applications")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", applicationId);

  await logApplicationActivity(admin, applicationId, app.status, "cancelled", session.userId, "Revoked Invitation");
  revalidatePath(`/admin/applications/${applicationId}`);
  return { success: true };
}

/**
 * Reject application action
 */
export async function rejectApplication(
  applicationId: string,
  rejectReason: string
): Promise<{ success: boolean; error?: string }> {
  const session = await verifyAdminSession();
  const admin = createAdminClient();

  const { data: app } = await admin
    .from("applications")
    .select("status")
    .eq("id", applicationId)
    .single();

  const beforeState = app?.status || "under_review";

  const { error } = await admin
    .from("applications")
    .update({
      status: "rejected",
      review_notes: rejectReason || "Application Rejected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  if (error) {
    return { success: false, error: "Failed to reject application." };
  }

  await logApplicationActivity(admin, applicationId, beforeState, "rejected", session.userId, rejectReason || "Application Rejected");

  revalidatePath("/admin/applications");
  revalidatePath(`/admin/applications/${applicationId}`);
  return { success: true };
}
