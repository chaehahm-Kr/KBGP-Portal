import "server-only";

import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications/email";
import { publicEnv } from "@/lib/env/public";
import {
  RetailerRole,
  InvitationValidationResult,
  RetailerTeamMember,
  RetailerInvitationItem,
} from "./onboarding-types";
import { processAgreementPdfGeneration } from "./agreement-actions";

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Validate an invitation token received from the URL
 */
export async function validateInvitationToken(
  rawToken: string
): Promise<InvitationValidationResult> {
  if (!rawToken || typeof rawToken !== "string") {
    return { valid: false, error: "Invalid invitation token provided." };
  }

  const adminClient = createAdminClient();
  const tokenHash = hashToken(rawToken.trim());

  const { data: inv, error } = await adminClient
    .from("retailer_invitations")
    .select(`
      id,
      company_id,
      email,
      role,
      has_all_stores_access,
      store_ids,
      status,
      expires_at,
      companies (
        id,
        name
      )
    `)
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !inv) {
    return {
      valid: false,
      error: "This invitation link is invalid or has expired.",
    };
  }

  if (inv.status === "accepted") {
    return {
      valid: false,
      error: "This invitation has already been accepted. Please log in to your account.",
    };
  }

  if (inv.status === "revoked") {
    return {
      valid: false,
      error: "This invitation has been revoked by your administrator.",
    };
  }

  const now = new Date();
  const expiresAt = new Date(inv.expires_at);
  if (now > expiresAt) {
    // Mark as expired in DB
    await adminClient
      .from("retailer_invitations")
      .update({ status: "expired" })
      .eq("id", inv.id);

    return {
      valid: false,
      error: "This invitation link has expired (7-day validity). Please request a new invitation.",
    };
  }

  const comp = Array.isArray(inv.companies) ? inv.companies[0] : inv.companies;
  const companyName = comp?.name || "K SELECT Retailer Partner";

  // Fetch assigned stores
  const assignedStores: Array<{ id: string; name: string; city?: string }> = [];
  if (inv.has_all_stores_access) {
    const { data: allStores } = await adminClient
      .from("stores")
      .select("id, name, city")
      .eq("company_id", inv.company_id)
      .eq("status", "active");

    if (allStores) {
      assignedStores.push(...allStores);
    }
  } else if (inv.store_ids && inv.store_ids.length > 0) {
    const { data: specificStores } = await adminClient
      .from("stores")
      .select("id, name, city")
      .in("id", inv.store_ids);

    if (specificStores) {
      assignedStores.push(...specificStores);
    }
  }

  return {
    valid: true,
    invitation: {
      id: inv.id,
      companyId: inv.company_id,
      companyName,
      email: inv.email,
      role: inv.role as RetailerRole,
      hasAllStoresAccess: inv.has_all_stores_access,
      assignedStores,
      expiresAt: inv.expires_at,
    },
  };
}

/**
 * Complete Retailer Onboarding & Account Activation
 */
export async function acceptRetailerInvitation(params: {
  rawToken: string;
  name: string;
  password?: string;
  acceptedTerms: boolean;
}): Promise<{ success: boolean; error?: string; redirectTo?: string }> {
  const { rawToken, name, password, acceptedTerms } = params;

  if (!acceptedTerms) {
    return {
      success: false,
      error: "You must accept the K SELECT Retailer Operating Standards & Terms to proceed.",
    };
  }

  if (!name || !name.trim()) {
    return { success: false, error: "Please provide your full name." };
  }

  const validation = await validateInvitationToken(rawToken);
  if (!validation.valid || !validation.invitation) {
    return { success: false, error: validation.error || "Invalid invitation." };
  }

  const inv = validation.invitation;
  const adminClient = createAdminClient();
  const normalizedEmail = inv.email.toLowerCase().trim();

  try {
    let authUserId: string;

    // 1. Check if user already exists in auth
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );

    if (existingUser) {
      authUserId = existingUser.id;
      // If password provided and user wants to update it
      if (password && password.length >= 6) {
        await adminClient.auth.admin.updateUserById(authUserId, {
          password,
          user_metadata: {
            ...existingUser.user_metadata,
            display_name: name.trim(),
            role: "retailer",
          },
        });
      }
    } else {
      if (!password || password.length < 6) {
        return {
          success: false,
          error: "Please create a password of at least 6 characters.",
        };
      }

      const { data: newUser, error: createAuthError } =
        await adminClient.auth.admin.createUser({
          email: normalizedEmail,
          password: password,
          email_confirm: true,
          user_metadata: {
            display_name: name.trim(),
            role: "retailer",
          },
        });

      if (createAuthError || !newUser?.user) {
        throw new Error(createAuthError?.message || "Failed to create authentication user.");
      }

      authUserId = newUser.user.id;
    }

    const now = new Date().toISOString();

    // 2. Ensure profile record exists
    await adminClient
      .from("profiles")
      .upsert({
        id: authUserId,
        email: normalizedEmail,
        display_name: name.trim(),
        role: "retailer",
        updated_at: now,
      });

    // 3. Upsert company_users
    await adminClient
      .from("company_users")
      .upsert(
        {
          id: authUserId,
          company_id: inv.companyId,
          name: name.trim(),
          email: normalizedEmail,
          company_role: inv.role,
          status: "active",
          is_primary: inv.role === "owner",
          updated_at: now,
        },
        { onConflict: "id" }
      );

    // 4. Upsert retailer_user_roles
    await adminClient
      .from("retailer_user_roles")
      .upsert(
        {
          user_id: authUserId,
          company_id: inv.companyId,
          role: inv.role,
          has_all_stores_access: inv.hasAllStoresAccess || inv.role === "owner",
          updated_at: now,
        },
        { onConflict: "user_id,role" }
      );

    // 5. Assign Store Access if specific stores provided
    if (!inv.hasAllStoresAccess && inv.assignedStores.length > 0) {
      for (const store of inv.assignedStores) {
        await adminClient
          .from("retailer_user_store_access")
          .upsert(
            {
              user_id: authUserId,
              store_id: store.id,
              company_id: inv.companyId,
              can_submit_checks: true,
              can_print_tags: true,
            },
            { onConflict: "user_id,store_id" }
          );
      }
    }

    // 6. Ensure retailer_profiles exists
    await adminClient
      .from("retailer_profiles")
      .upsert(
        {
          company_id: inv.companyId,
          status: "active",
          payment_terms: "PREPAID_CARD",
          updated_at: now,
        },
        { onConflict: "company_id" }
      );

    // 7. Record Agreement Acceptance with Signer Metadata
    const roleTitle =
      inv.role === "owner"
        ? "Company Owner"
        : inv.role === "buyer"
        ? "Retail Buyer"
        : inv.role === "store_manager"
        ? "Store Manager"
        : inv.role === "accounting"
        ? "Finance / Accounting"
        : "Store Employee";

    const { data: accData } = await adminClient
      .from("retailer_agreement_acceptances")
      .upsert(
        {
          company_id: inv.companyId,
          user_id: authUserId,
          agreement_type: "retailer_terms_v1",
          agreement_version: "1.0",
          accepted_name: name.trim(),
          signer_title: roleTitle,
          signer_email: normalizedEmail,
          pdf_status: "pending",
          accepted_at: now,
        },
        { onConflict: "company_id,user_id,agreement_version" }
      )
      .select("id")
      .single();

    // Trigger PDF generation & email delivery in background/async
    if (accData?.id) {
      processAgreementPdfGeneration(accData.id).catch((pdfErr) => {
        console.error("[acceptRetailerInvitation] Async PDF generation error:", pdfErr);
      });
    }

    // 8. Mark invitation as accepted
    const tokenHash = hashToken(rawToken.trim());
    await adminClient
      .from("retailer_invitations")
      .update({
        status: "accepted",
        accepted_at: now,
        accepted_by: authUserId,
        updated_at: now,
      })
      .eq("token_hash", tokenHash);

    // 9. Update linked Application record to onboarded status
    try {
      await adminClient
        .from("applications")
        .update({
          status: "onboarded",
          onboarded_company_id: inv.companyId,
          updated_at: now,
        })
        .or(`invitation_id.eq.${inv.id},company_id.eq.${inv.companyId}`);
    } catch (appUpdateErr) {
      console.warn("[acceptRetailerInvitation] Application status update warning:", appUpdateErr);
    }

    return {
      success: true,
      redirectTo: "/retailer",
    };
  } catch (err: any) {
    console.error("[acceptRetailerInvitation] Error:", err);
    return {
      success: false,
      error: err.message || "Failed to complete account activation.",
    };
  }
}

/**
 * Create and dispatch a new Retailer Invitation
 */
export async function createRetailerInvitation(params: {
  companyId: string;
  email: string;
  name?: string;
  role: RetailerRole;
  hasAllStoresAccess?: boolean;
  storeIds?: string[];
  invitedBy?: string;
  isTest?: boolean;
}): Promise<{
  success: boolean;
  error?: string;
  invitationId?: string;
  rawToken?: string;
  emailDeliveryStatus?: "sent" | "failed" | "skipped";
}> {
  const { companyId, email, name, role, hasAllStoresAccess = false, storeIds = [], invitedBy, isTest = false } = params;

  if (!email || !email.includes("@")) {
    return { success: false, error: "Please provide a valid email address." };
  }

  const adminClient = createAdminClient();
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Fetch Company info
  const { data: comp, error: compErr } = await adminClient
    .from("companies")
    .select("id, name")
    .eq("id", companyId)
    .maybeSingle();

  if (compErr || !comp) {
    return { success: false, error: "Retailer company not found." };
  }

  // 2. Revoke any previous pending invitation for this email + company
  await adminClient
    .from("retailer_invitations")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("company_id", companyId)
    .eq("email", normalizedEmail)
    .eq("status", "pending");

  // 3. Generate secure single-use token (32 random bytes)
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // 4. Insert invitation record
  const { data: inserted, error: insertErr } = await adminClient
    .from("retailer_invitations")
    .insert({
      company_id: companyId,
      email: normalizedEmail,
      invited_name: name || null,
      role,
      has_all_stores_access: hasAllStoresAccess || role === "owner",
      store_ids: storeIds,
      token_hash: tokenHash,
      status: "pending",
      expires_at: expiresAt,
      invited_by: invitedBy || null,
      email_delivery_status: "sent",
      is_test: isTest,
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    console.error("[createRetailerInvitation] DB Insert Error:", insertErr);
    return { success: false, error: "Failed to create invitation record." };
  }

  // 5. Send Branded Email via Resend
  let emailDeliveryStatus: "sent" | "failed" | "skipped" = "sent";
  const inviteUrl = `${publicEnv.NEXT_PUBLIC_SITE_URL || "https://portal.kselecthub.com"}/invite/${rawToken}`;

  try {
    const { sendTemplatedEmail } = await import("@/lib/notifications/templates");
    const templateKey = role === "owner" ? "hub_retailer_partner_invited" : "hub_retailer_user_invited";

    await sendTemplatedEmail(templateKey, normalizedEmail, {
      contactName: name || "Retail Partner",
      companyName: comp.name,
      invitationLink: inviteUrl,
      link: inviteUrl,
      supportEmail: "support@kselectnetwork.com",
    });
  } catch (emailErr) {
    console.warn("[createRetailerInvitation] Templated email delivery failed, trying fallback:", emailErr);
    try {
      const roleLabel =
        role === "owner"
          ? "Company Owner"
          : role === "buyer"
          ? "Retail Buyer"
          : role === "store_manager"
          ? "Store Manager"
          : role === "accounting"
          ? "Finance / Accounting"
          : "Store Employee";

      await sendEmail({
        to: normalizedEmail,
        subject: `[K SELECT HUB] Invitation to join ${comp.name} on K SELECT Retailer Portal`,
        text: `Hello,\n\nYou have been invited to join ${comp.name} as ${roleLabel} on the K SELECT Retailer Portal.\n\nPlease activate your account by visiting:\n${inviteUrl}\n\nThis invitation link is valid for 7 days.\n\nThank you,\nK SELECT Operations Team`,
      });
    } catch (fallbackErr) {
      console.warn("[createRetailerInvitation] Email delivery failed:", fallbackErr);
      emailDeliveryStatus = "failed";

      await adminClient
        .from("retailer_invitations")
        .update({ email_delivery_status: "failed" })
        .eq("id", inserted.id);
    }
  }

  return {
    success: true,
    invitationId: inserted.id,
    rawToken,
    emailDeliveryStatus,
  };
}

/**
 * Resend a Retailer Invitation with a refreshed 7-day token
 */
export async function resendRetailerInvitation(invitationId: string): Promise<{
  success: boolean;
  error?: string;
  rawToken?: string;
}> {
  const adminClient = createAdminClient();

  const { data: inv, error: findErr } = await adminClient
    .from("retailer_invitations")
    .select("id, company_id, email, role, has_all_stores_access, store_ids, is_test")
    .eq("id", invitationId)
    .maybeSingle();

  if (findErr || !inv) {
    return { success: false, error: "Invitation not found." };
  }

  return await createRetailerInvitation({
    companyId: inv.company_id,
    email: inv.email,
    role: inv.role as RetailerRole,
    hasAllStoresAccess: inv.has_all_stores_access,
    storeIds: inv.store_ids,
    isTest: inv.is_test,
  });
}

/**
 * Revoke an existing pending Retailer Invitation
 */
export async function revokeRetailerInvitation(invitationId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from("retailer_invitations")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("id", invitationId);

  if (error) {
    return { success: false, error: "Failed to revoke invitation." };
  }

  return { success: true };
}

/**
 * Fetch company team members and pending invitations
 */
export async function getRetailerTeamData(companyId: string): Promise<{
  members: RetailerTeamMember[];
  invitations: RetailerInvitationItem[];
  companyStores: Array<{ id: string; name: string; city?: string }>;
}> {
  const adminClient = createAdminClient();

  // 1. Fetch stores
  const { data: stores } = await adminClient
    .from("stores")
    .select("id, name, city")
    .eq("company_id", companyId)
    .order("name", { ascending: true });

  const companyStores = stores || [];

  // 2. Fetch company_users + retailer_user_roles + retailer_user_store_access
  const { data: users } = await adminClient
    .from("company_users")
    .select(`
      id,
      name,
      email,
      company_role,
      is_primary,
      status,
      created_at
    `)
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  const { data: userRoles } = await adminClient
    .from("retailer_user_roles")
    .select("user_id, role, has_all_stores_access")
    .eq("company_id", companyId);

  const { data: storeAccesses } = await adminClient
    .from("retailer_user_store_access")
    .select("user_id, store_id, stores(id, name, city)")
    .eq("company_id", companyId);

  const rolesMap = new Map<string, { role: RetailerRole; hasAllStoresAccess: boolean }>();
  if (userRoles) {
    for (const r of userRoles) {
      rolesMap.set(r.user_id, {
        role: r.role as RetailerRole,
        hasAllStoresAccess: r.has_all_stores_access,
      });
    }
  }

  const storeAccessMap = new Map<string, Array<{ id: string; name: string; city?: string }>>();
  if (storeAccesses) {
    for (const sa of storeAccesses) {
      const s = sa.stores as any;
      if (s) {
        const list = storeAccessMap.get(sa.user_id) || [];
        list.push({ id: s.id, name: s.name, city: s.city });
        storeAccessMap.set(sa.user_id, list);
      }
    }
  }

  const members: RetailerTeamMember[] = (users || []).map((u) => {
    const roleInfo = rolesMap.get(u.id);
    const role = (roleInfo?.role || u.company_role || "employee") as RetailerRole;
    const hasAllStoresAccess = roleInfo?.hasAllStoresAccess ?? (role === "owner");
    const assignedStores = hasAllStoresAccess ? companyStores : (storeAccessMap.get(u.id) || []);

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role,
      hasAllStoresAccess,
      assignedStores,
      status: (u.status as any) || "active",
      isPrimary: u.is_primary || false,
      joinedAt: u.created_at,
    };
  });

  // 3. Fetch invitations
  const { data: rawInvs } = await adminClient
    .from("retailer_invitations")
    .select(`
      id,
      company_id,
      email,
      role,
      has_all_stores_access,
      store_ids,
      status,
      expires_at,
      email_delivery_status,
      created_at
    `)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  const invitations: RetailerInvitationItem[] = (rawInvs || []).map((inv) => ({
    id: inv.id,
    companyId: inv.company_id,
    email: inv.email,
    role: inv.role as RetailerRole,
    hasAllStoresAccess: inv.has_all_stores_access,
    storeIds: inv.store_ids || [],
    status: inv.status as any,
    expiresAt: inv.expires_at,
    emailDeliveryStatus: inv.email_delivery_status as any,
    createdAt: inv.created_at,
  }));

  return { members, invitations, companyStores };
}
