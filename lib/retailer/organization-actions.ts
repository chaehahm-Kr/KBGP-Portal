"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { RetailerRole } from "@/lib/retailer/onboarding-types";
import { formatCanonicalCountryName } from "@/lib/constants/countries";

/**
 * Lightweight helper to safely record organization audit logs without throwing
 */
async function recordOrgAuditLog(params: {
  companyId: string;
  entityType: "company" | "store" | "user" | "role" | "store_access" | "invitation";
  entityId: string;
  action: string;
  actorId: string;
  actorType?: "retailer" | "admin";
  oldData?: any;
  newData?: any;
  reason?: string;
}) {
  try {
    const adminClient = createAdminClient();
    await adminClient.from("retailer_organization_audit_logs").insert({
      company_id: params.companyId,
      entity_type: params.entityType,
      entity_id: params.entityId,
      action: params.action,
      actor_id: params.actorId,
      actor_type: params.actorType || "retailer",
      old_data: params.oldData || null,
      new_data: params.newData || null,
      reason: params.reason || null,
    });
  } catch (err) {
    // Graceful fallback if audit table is not yet migrated
    console.warn("[Org Audit] Non-fatal audit log insertion note:", err);
  }
}

/**
 * Helper to get authenticated user's company context and role
 */
async function getCallerCompanyAndRole(userId: string) {
  const adminClient = createAdminClient();

  const { data: cu } = await adminClient
    .from("company_users")
    .select("company_id, company_role, status")
    .eq("id", userId)
    .maybeSingle();

  if (!cu || cu.status !== "active") {
    return null;
  }

  const { data: rur } = await adminClient
    .from("retailer_user_roles")
    .select("role, has_all_stores_access")
    .eq("user_id", userId)
    .eq("company_id", cu.company_id)
    .maybeSingle();

  const role = (rur?.role || cu.company_role || "employee").toLowerCase() as RetailerRole;

  return {
    companyId: cu.company_id,
    role,
    hasAllStoresAccess: rur?.has_all_stores_access ?? (role === "owner"),
  };
}

/**
 * 1. Personal Profile Update (Display Name & Phone)
 */
export async function updatePersonalProfileAction(payload: {
  displayName: string;
  phone?: string;
}) {
  try {
    const session = await verifyRetailerSession();
    const adminClient = createAdminClient();

    const cleanDisplayName = payload.displayName.trim();
    if (!cleanDisplayName) {
      return { success: false, error: "Display name cannot be empty." };
    }

    // 1. Update profiles table
    const { error: profError } = await adminClient
      .from("profiles")
      .update({ display_name: cleanDisplayName })
      .eq("id", session.userId);

    if (profError) {
      return { success: false, error: profError.message };
    }

    // 2. Update company_users table (name and optional phone)
    const updateCU: any = { name: cleanDisplayName };
    if (payload.phone !== undefined) {
      updateCU.phone = payload.phone.trim() || null;
    }

    await adminClient
      .from("company_users")
      .update(updateCU)
      .eq("id", session.userId);

    revalidatePath("/account");
    revalidatePath("/retailer/account");
    return { success: true };
  } catch (err: any) {
    console.error("Error in updatePersonalProfileAction:", err);
    return { success: false, error: err.message || "Failed to update profile." };
  }
}

/**
 * 2. Company Information Self-Service Update (Owner Only)
 * Allows Retailer Owner to update business contact & legal info.
 * Explicitly guards against altering commercial terms (credit limit, payment terms, internal notes).
 */
export async function updateRetailerCompanyInfoAction(payload: {
  companyId?: string;
  name: string;
  businessRegistrationNumber?: string;
  country?: string;
  contactName?: string;
  contactPhone?: string;
  // HQ Address Fields (Authoritative Company Core):
  address?: string; // HQ address line 1
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  zipCode?: string;

  // Billing & Commercial Fields (Retailer Commercial Profile):
  billingSameAsHq?: boolean;
  billingAddress?: string;
  billingCity?: string;
  billingState?: string;
  billingZip?: string;

  billingContactSameAsPrimary?: boolean;
  billingContactName?: string;
  billingContactPhone?: string;
  billingContactEmail?: string;
  contactEmail?: string; // legacy alias
  resaleCertificateNumber?: string;
}) {
  try {
    const session = await verifyRetailerSession();
    const caller = await getCallerCompanyAndRole(session.userId);

    if (!caller) {
      return { success: false, error: "Unauthorized company access." };
    }

    const targetCompanyId = payload.companyId || caller.companyId;
    if (targetCompanyId !== caller.companyId) {
      return { success: false, error: "Cannot edit another organization's information." };
    }

    if (caller.role !== "owner") {
      return { success: false, error: "Only the Company Owner is authorized to edit company details." };
    }

    const cleanName = payload.name.trim();
    if (!cleanName) {
      return { success: false, error: "Company name cannot be empty." };
    }

    const adminClient = createAdminClient();

    // Fetch existing data for audit log
    const { data: existingComp } = await adminClient
      .from("companies")
      .select("name, business_registration_number, country, contact_name, contact_phone, address_1, address_2, city, state, zip_code")
      .eq("id", targetCompanyId)
      .single();

    const { data: existingProf } = await adminClient
      .from("retailer_profiles")
      .select("billing_same_as_hq, billing_contact_same_as_primary, billing_contact_name, billing_contact_email, billing_contact_phone, billing_address, billing_city, billing_state, billing_zip")
      .eq("company_id", targetCompanyId)
      .maybeSingle();

    // 1. Authoritative Company Core Update in `companies`
    const hqAddress1 = (payload.address1 ?? payload.address)?.trim();
    const hqAddress2 = payload.address2?.trim();
    const hqCity = payload.city?.trim();
    const hqState = payload.state?.trim();
    const hqZip = (payload.zipCode ?? payload.zip)?.trim();

    const compUpdates: any = {
      name: cleanName,
      business_registration_number: payload.businessRegistrationNumber !== undefined ? payload.businessRegistrationNumber.trim() : (existingComp?.business_registration_number || ""),
      country: formatCanonicalCountryName(payload.country?.trim() || existingComp?.country) || "United States",
      contact_name: payload.contactName !== undefined ? (payload.contactName.trim() || null) : existingComp?.contact_name,
      contact_phone: payload.contactPhone !== undefined ? (payload.contactPhone.trim() || null) : existingComp?.contact_phone,
      updated_at: new Date().toISOString(),
    };

    if (payload.address !== undefined || payload.address1 !== undefined) compUpdates.address_1 = hqAddress1 || null;
    if (payload.address2 !== undefined) compUpdates.address_2 = hqAddress2 || null;
    if (payload.city !== undefined) compUpdates.city = hqCity || null;
    if (payload.state !== undefined) compUpdates.state = hqState || null;
    if (payload.zip !== undefined || payload.zipCode !== undefined) compUpdates.zip_code = hqZip || null;

    const { error: compError } = await adminClient
      .from("companies")
      .update(compUpdates)
      .eq("id", targetCompanyId);

    if (compError) {
      return { success: false, error: compError.message };
    }

    // 2. Retailer Commercial Profile Update in `retailer_profiles`
    const profUpdates: any = {
      updated_at: new Date().toISOString(),
    };

    // Address override behavior
    if (payload.billingSameAsHq !== undefined) {
      profUpdates.billing_same_as_hq = payload.billingSameAsHq;
      if (payload.billingSameAsHq) {
        // When set to same as HQ, mirror HQ values for backwards compatibility
        const effectiveHq1 = compUpdates.address_1 ?? existingComp?.address_1;
        const effectiveHqCity = compUpdates.city ?? existingComp?.city;
        const effectiveHqState = compUpdates.state ?? existingComp?.state;
        const effectiveHqZip = compUpdates.zip_code ?? existingComp?.zip_code;
        if (effectiveHq1 !== undefined) profUpdates.billing_address = effectiveHq1;
        if (effectiveHqCity !== undefined) profUpdates.billing_city = effectiveHqCity;
        if (effectiveHqState !== undefined) profUpdates.billing_state = effectiveHqState;
        if (effectiveHqZip !== undefined) profUpdates.billing_zip = effectiveHqZip;
      }
    }

    if (payload.billingSameAsHq === false) {
      if (payload.billingAddress !== undefined) profUpdates.billing_address = payload.billingAddress.trim() || null;
      if (payload.billingCity !== undefined) profUpdates.billing_city = payload.billingCity.trim() || null;
      if (payload.billingState !== undefined) profUpdates.billing_state = payload.billingState.trim() || null;
      if (payload.billingZip !== undefined) profUpdates.billing_zip = payload.billingZip.trim() || null;
    }

    // Contact override behavior
    if (payload.billingContactSameAsPrimary !== undefined) {
      profUpdates.billing_contact_same_as_primary = payload.billingContactSameAsPrimary;
      if (payload.billingContactSameAsPrimary) {
        const effectiveName = compUpdates.contact_name ?? existingComp?.contact_name;
        const effectivePhone = compUpdates.contact_phone ?? existingComp?.contact_phone;
        if (effectiveName !== undefined) profUpdates.billing_contact_name = effectiveName;
        if (effectivePhone !== undefined) profUpdates.billing_contact_phone = effectivePhone;
      }
    }

    if (payload.billingContactSameAsPrimary === false) {
      if (payload.billingContactName !== undefined) profUpdates.billing_contact_name = payload.billingContactName.trim() || null;
      if (payload.billingContactPhone !== undefined) profUpdates.billing_contact_phone = payload.billingContactPhone.trim() || null;
    }

    const billingEmailVal = payload.billingContactEmail ?? payload.contactEmail;
    if (billingEmailVal !== undefined) {
      profUpdates.billing_contact_email = billingEmailVal.trim() || null;
    }

    if (payload.resaleCertificateNumber !== undefined) {
      profUpdates.resale_certificate_number = payload.resaleCertificateNumber.trim() || null;
    }

    if (Object.keys(profUpdates).length > 1) {
      const { error: profError } = await adminClient
        .from("retailer_profiles")
        .update(profUpdates)
        .eq("company_id", targetCompanyId);

      if (profError && profError.message?.includes("does not exist")) {
        delete profUpdates.billing_same_as_hq;
        delete profUpdates.billing_contact_same_as_primary;
        await adminClient
          .from("retailer_profiles")
          .update(profUpdates)
          .eq("company_id", targetCompanyId);
      }
    }

    // Record audit log
    await recordOrgAuditLog({
      companyId: targetCompanyId,
      entityType: "company",
      entityId: targetCompanyId,
      action: "update_company_info",
      actorId: session.userId,
      oldData: { ...existingComp, ...existingProf },
      newData: { ...payload, name: cleanName },
    });

    revalidatePath("/account");
    revalidatePath("/retailer/account");
    revalidatePath("/retailer/settings/company");
    revalidatePath(`/admin/retailers/${targetCompanyId}`);
    revalidatePath("/admin/retailers");
    revalidatePath(`/admin/companies/${targetCompanyId}`);
    revalidatePath("/admin/companies");

    return { success: true };
  } catch (err: any) {
    console.error("Error in updateRetailerCompanyInfoAction:", err);
    return { success: false, error: err.message || "Failed to update company information." };
  }
}

/**
 * 3. Add Store Location (Retailer Owner / Buyer)
 */
export async function addRetailerStoreByOwnerAction(payload: {
  companyId?: string;
  name: string;
  storeCode?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  email?: string;
  managerName?: string;
  managerPhone?: string;
}) {
  try {
    const session = await verifyRetailerSession();
    const caller = await getCallerCompanyAndRole(session.userId);

    if (!caller) {
      return { success: false, error: "Unauthorized access." };
    }

    const targetCompanyId = payload.companyId || caller.companyId;
    if (targetCompanyId !== caller.companyId) {
      return { success: false, error: "Cannot add stores to another organization." };
    }

    if (!["owner", "buyer"].includes(caller.role)) {
      return { success: false, error: "Only Company Owners and Buyers are authorized to add store locations." };
    }

    const cleanName = payload.name.trim();
    if (!cleanName) {
      return { success: false, error: "Store name is required." };
    }

    const adminClient = createAdminClient();

    const { data: newStore, error: insertError } = await adminClient
      .from("stores")
      .insert({
        company_id: targetCompanyId,
        name: cleanName,
        store_code: payload.storeCode?.trim() || null,
        address: payload.address?.trim() || null,
        city: payload.city?.trim() || null,
        state: payload.state?.trim() || null,
        zip: payload.zip?.trim() || null,
        phone: payload.phone?.trim() || null,
        email: payload.email?.trim() || null,
        manager_name: payload.managerName?.trim() || null,
        manager_phone: payload.managerPhone?.trim() || null,
        status: "active",
        type: "Independent Beauty Supply",
      })
      .select("*")
      .single();

    if (insertError || !newStore) {
      return { success: false, error: insertError?.message || "Failed to create store." };
    }

    // Record audit log
    await recordOrgAuditLog({
      companyId: targetCompanyId,
      entityType: "store",
      entityId: newStore.id,
      action: "add_store",
      actorId: session.userId,
      newData: newStore,
    });

    revalidatePath("/account");
    revalidatePath("/retailer/account");
    revalidatePath("/retailer/stores");
    revalidatePath("/stores");
    revalidatePath("/retailer/settings/company");
    revalidatePath("/settings/company");
    revalidatePath(`/admin/retailers/${targetCompanyId}`);
    revalidatePath("/admin/retailers");
    revalidatePath("/admin/stores");

    return { success: true, store: newStore };
  } catch (err: any) {
    console.error("Error in addRetailerStoreByOwnerAction:", err);
    return { success: false, error: err.message || "Failed to add store." };
  }
}

/**
 * 4. Edit Store Location (Retailer Owner / Buyer)
 */
export async function updateRetailerStoreByOwnerAction(payload: {
  storeId: string;
  name: string;
  storeCode?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  email?: string;
  managerName?: string;
  managerPhone?: string;
}) {
  try {
    const session = await verifyRetailerSession();
    const caller = await getCallerCompanyAndRole(session.userId);

    if (!caller || !["owner", "buyer"].includes(caller.role)) {
      return { success: false, error: "Only Company Owners and Buyers are authorized to edit store locations." };
    }

    const cleanName = payload.name.trim();
    if (!cleanName) {
      return { success: false, error: "Store name is required." };
    }

    const adminClient = createAdminClient();

    // Verify store ownership
    const { data: existingStore } = await adminClient
      .from("stores")
      .select("*")
      .eq("id", payload.storeId)
      .eq("company_id", caller.companyId)
      .maybeSingle();

    if (!existingStore) {
      return { success: false, error: "Store not found in your organization." };
    }

    const { error: updateError } = await adminClient
      .from("stores")
      .update({
        name: cleanName,
        store_code: payload.storeCode?.trim() || null,
        address: payload.address?.trim() || null,
        city: payload.city?.trim() || null,
        state: payload.state?.trim() || null,
        zip: payload.zip?.trim() || null,
        phone: payload.phone?.trim() || null,
        email: payload.email?.trim() || null,
        manager_name: payload.managerName?.trim() || null,
        manager_phone: payload.managerPhone?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.storeId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    await recordOrgAuditLog({
      companyId: caller.companyId,
      entityType: "store",
      entityId: payload.storeId,
      action: "update_store",
      actorId: session.userId,
      oldData: existingStore,
      newData: payload,
    });

    revalidatePath("/account");
    revalidatePath("/retailer/account");
    revalidatePath("/retailer/stores");
    revalidatePath("/stores");
    revalidatePath("/retailer/settings/company");
    revalidatePath("/settings/company");
    revalidatePath(`/admin/retailers/${caller.companyId}`);
    revalidatePath("/admin/retailers");
    revalidatePath("/admin/stores");

    return { success: true };
  } catch (err: any) {
    console.error("Error in updateRetailerStoreByOwnerAction:", err);
    return { success: false, error: err.message || "Failed to update store." };
  }
}

/**
 * 5. Soft-Deactivate / Reactivate Store (Retailer Owner / Buyer)
 * Preserves historical orders, weekly checks, price tags, and training scope intact.
 */
export async function setRetailerStoreStatusByOwnerAction(payload: {
  storeId: string;
  status: "active" | "inactive";
}) {
  try {
    const session = await verifyRetailerSession();
    const caller = await getCallerCompanyAndRole(session.userId);

    if (!caller || !["owner", "buyer"].includes(caller.role)) {
      return { success: false, error: "Only Company Owners and Buyers are authorized to change store status." };
    }

    const adminClient = createAdminClient();

    // Verify store ownership
    const { data: existingStore } = await adminClient
      .from("stores")
      .select("id, name, status, company_id")
      .eq("id", payload.storeId)
      .eq("company_id", caller.companyId)
      .maybeSingle();

    if (!existingStore) {
      return { success: false, error: "Store not found in your organization." };
    }

    const { error: updateError } = await adminClient
      .from("stores")
      .update({
        status: payload.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.storeId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    await recordOrgAuditLog({
      companyId: caller.companyId,
      entityType: "store",
      entityId: payload.storeId,
      action: payload.status === "active" ? "reactivate_store" : "deactivate_store",
      actorId: session.userId,
      oldData: { status: existingStore.status },
      newData: { status: payload.status },
    });

    revalidatePath("/account");
    revalidatePath("/retailer/account");
    revalidatePath("/retailer/stores");
    revalidatePath("/stores");
    revalidatePath("/retailer/settings/company");
    revalidatePath("/settings/company");
    revalidatePath(`/admin/retailers/${caller.companyId}`);
    revalidatePath("/admin/retailers");
    revalidatePath("/admin/stores");
    revalidatePath("/retailer/checkout");
    revalidatePath("/checkout");

    return { success: true };
  } catch (err: any) {
    console.error("Error in setRetailerStoreStatusByOwnerAction:", err);
    return { success: false, error: err.message || "Failed to update store status." };
  }
}

/**
 * 6. Change Team Member Role with Final Owner Protection (Owner Only)
 */
export async function updateTeamMemberRoleAction(payload: {
  targetUserId: string;
  newRole: RetailerRole;
  hasAllStoresAccess?: boolean;
  storeIds?: string[];
}) {
  try {
    const session = await verifyRetailerSession();
    const caller = await getCallerCompanyAndRole(session.userId);

    if (!caller || caller.role !== "owner") {
      return { success: false, error: "Only Company Owners are authorized to modify team roles." };
    }

    const adminClient = createAdminClient();

    // 1. Fetch current target member role & status
    const { data: targetRole } = await adminClient
      .from("retailer_user_roles")
      .select("role, has_all_stores_access")
      .eq("user_id", payload.targetUserId)
      .eq("company_id", caller.companyId)
      .maybeSingle();

    const { data: targetCU } = await adminClient
      .from("company_users")
      .select("status, company_role")
      .eq("id", payload.targetUserId)
      .eq("company_id", caller.companyId)
      .maybeSingle();

    if (!targetCU) {
      return { success: false, error: "User is not a member of your company." };
    }

    const currentRole = (targetRole?.role || targetCU.company_role || "employee").toLowerCase();

    // 2. Final Owner Protection
    if (currentRole === "owner" && payload.newRole !== "owner") {
      const { data: activeOwners } = await adminClient
        .from("retailer_user_roles")
        .select(`
          user_id,
          company_users!inner(status)
        `)
        .eq("company_id", caller.companyId)
        .eq("role", "owner")
        .eq("company_users.status", "active");

      const activeCount = (activeOwners || []).length;
      if (activeCount <= 1) {
        return {
          success: false,
          error: "Cannot change the role of the only active Owner. Please assign another active Owner first.",
        };
      }
    }

    // 3. Update retailer_user_roles
    const isOwnerOrBuyer = ["owner", "buyer"].includes(payload.newRole);
    const hasAllStores = payload.hasAllStoresAccess ?? (payload.newRole === "owner");

    await adminClient
      .from("retailer_user_roles")
      .upsert({
        user_id: payload.targetUserId,
        company_id: caller.companyId,
        role: payload.newRole,
        has_all_stores_access: hasAllStores,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,role" });

    // Ensure any other stale role records for this user are cleaned if different
    await adminClient
      .from("retailer_user_roles")
      .delete()
      .eq("user_id", payload.targetUserId)
      .eq("company_id", caller.companyId)
      .neq("role", payload.newRole);

    // 4. Update company_users role mapping
    await adminClient
      .from("company_users")
      .update({
        company_role: isOwnerOrBuyer ? "company_admin" : "company_staff",
      })
      .eq("id", payload.targetUserId);

    // 5. Update store access mappings
    if (!hasAllStores && payload.storeIds && payload.storeIds.length > 0) {
      // Clear existing
      await adminClient
        .from("retailer_user_store_access")
        .delete()
        .eq("user_id", payload.targetUserId)
        .eq("company_id", caller.companyId);

      // Insert new
      const accessInserts = payload.storeIds.map((sId) => ({
        user_id: payload.targetUserId,
        store_id: sId,
        company_id: caller.companyId,
        can_submit_checks: true,
        can_print_tags: true,
      }));

      await adminClient.from("retailer_user_store_access").insert(accessInserts);
    } else if (hasAllStores) {
      await adminClient
        .from("retailer_user_store_access")
        .delete()
        .eq("user_id", payload.targetUserId)
        .eq("company_id", caller.companyId);
    }

    // 6. Record audit log
    await recordOrgAuditLog({
      companyId: caller.companyId,
      entityType: "role",
      entityId: payload.targetUserId,
      action: "change_user_role",
      actorId: session.userId,
      oldData: { role: currentRole },
      newData: { role: payload.newRole, hasAllStoresAccess: hasAllStores },
    });

    revalidatePath("/account");
    revalidatePath("/retailer/account");
    revalidatePath(`/admin/retailers/${caller.companyId}`);

    return { success: true };
  } catch (err: any) {
    console.error("Error in updateTeamMemberRoleAction:", err);
    return { success: false, error: err.message || "Failed to update member role." };
  }
}

/**
 * 7. Change Team Member Store Access (Owner / Buyer)
 */
export async function updateTeamMemberStoreAccessAction(payload: {
  targetUserId: string;
  hasAllStoresAccess: boolean;
  storeIds?: string[];
}) {
  try {
    const session = await verifyRetailerSession();
    const caller = await getCallerCompanyAndRole(session.userId);

    if (!caller || !["owner", "buyer"].includes(caller.role)) {
      return { success: false, error: "Only Company Owners and Buyers are authorized to change store access permissions." };
    }

    const adminClient = createAdminClient();

    // Verify target user is in same company
    const { data: targetCU } = await adminClient
      .from("company_users")
      .select("id, status")
      .eq("id", payload.targetUserId)
      .eq("company_id", caller.companyId)
      .maybeSingle();

    if (!targetCU) {
      return { success: false, error: "User is not a member of your company." };
    }

    // Update retailer_user_roles flag
    await adminClient
      .from("retailer_user_roles")
      .update({
        has_all_stores_access: payload.hasAllStoresAccess,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", payload.targetUserId)
      .eq("company_id", caller.companyId);

    // Sync retailer_user_store_access
    await adminClient
      .from("retailer_user_store_access")
      .delete()
      .eq("user_id", payload.targetUserId)
      .eq("company_id", caller.companyId);

    if (!payload.hasAllStoresAccess && payload.storeIds && payload.storeIds.length > 0) {
      const inserts = payload.storeIds.map((sId) => ({
        user_id: payload.targetUserId,
        store_id: sId,
        company_id: caller.companyId,
        can_submit_checks: true,
        can_print_tags: true,
      }));
      await adminClient.from("retailer_user_store_access").insert(inserts);
    }

    await recordOrgAuditLog({
      companyId: caller.companyId,
      entityType: "store_access",
      entityId: payload.targetUserId,
      action: "change_store_access",
      actorId: session.userId,
      newData: { hasAllStoresAccess: payload.hasAllStoresAccess, storeIds: payload.storeIds },
    });

    revalidatePath("/account");
    revalidatePath("/retailer/account");
    revalidatePath(`/admin/retailers/${caller.companyId}`);

    return { success: true };
  } catch (err: any) {
    console.error("Error in updateTeamMemberStoreAccessAction:", err);
    return { success: false, error: err.message || "Failed to update store access." };
  }
}

/**
 * 8. Disable / Reactivate Team Member (Owner Only)
 * Sets company_users.status to 'active' or 'suspended'.
 * Preserves historical orders, cases, weekly checks, and training history intact!
 */
export async function setTeamMemberStatusAction(payload: {
  targetUserId: string;
  status: "active" | "suspended";
}) {
  try {
    const session = await verifyRetailerSession();
    const caller = await getCallerCompanyAndRole(session.userId);

    if (!caller || caller.role !== "owner") {
      return { success: false, error: "Only Company Owners are authorized to activate or disable team accounts." };
    }

    const adminClient = createAdminClient();

    // 1. Fetch current target member role
    const { data: targetRole } = await adminClient
      .from("retailer_user_roles")
      .select("role")
      .eq("user_id", payload.targetUserId)
      .eq("company_id", caller.companyId)
      .maybeSingle();

    const { data: targetCU } = await adminClient
      .from("company_users")
      .select("status, company_role")
      .eq("id", payload.targetUserId)
      .eq("company_id", caller.companyId)
      .maybeSingle();

    if (!targetCU) {
      return { success: false, error: "User is not a member of your company." };
    }

    const currentRole = (targetRole?.role || targetCU.company_role || "employee").toLowerCase();

    // 2. Final Owner Protection when disabling
    if (payload.status === "suspended" && currentRole === "owner") {
      const { data: activeOwners } = await adminClient
        .from("retailer_user_roles")
        .select(`
          user_id,
          company_users!inner(status)
        `)
        .eq("company_id", caller.companyId)
        .eq("role", "owner")
        .eq("company_users.status", "active");

      const activeCount = (activeOwners || []).length;
      if (activeCount <= 1) {
        return {
          success: false,
          error: "Cannot disable the only active Owner of the company. Please assign another active Owner first.",
        };
      }
    }

    // 3. Update status
    const { error: statusError } = await adminClient
      .from("company_users")
      .update({
        status: payload.status,
      })
      .eq("id", payload.targetUserId)
      .eq("company_id", caller.companyId);

    if (statusError) {
      return { success: false, error: statusError.message };
    }

    // 4. Record audit log
    await recordOrgAuditLog({
      companyId: caller.companyId,
      entityType: "user",
      entityId: payload.targetUserId,
      action: payload.status === "active" ? "reactivate_user" : "disable_user",
      actorId: session.userId,
      oldData: { status: targetCU.status },
      newData: { status: payload.status },
    });

    revalidatePath("/account");
    revalidatePath("/retailer/account");
    revalidatePath(`/admin/retailers/${caller.companyId}`);

    return { success: true };
  } catch (err: any) {
    console.error("Error in setTeamMemberStatusAction:", err);
    return { success: false, error: err.message || "Failed to update member status." };
  }
}
