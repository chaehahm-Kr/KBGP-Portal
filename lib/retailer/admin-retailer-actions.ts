"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createRetailerInvitation } from "@/lib/retailer/onboarding-actions";
import { RetailerRole } from "@/lib/retailer/onboarding-types";
import { revalidatePath } from "next/cache";
import { formatCanonicalCountryName } from "@/lib/constants/countries";
import {
  normalizeApprovedTerms,
  formatApprovedTermsDisplay,
  normalizeTermsStatus,
  normalizeRetailerAccountStatus,
} from "@/lib/retailer/commercial-types";

export interface CreateRetailerPayload {
  companyName: string;
  businessRegistrationNumber?: string;
  country?: string;
  paymentTerms: string;
  creditLimit: number;
  initialStoreName: string;
  initialStoreCity?: string;
  initialStoreState?: string;
  initialStoreAddress?: string;
  initialStorePhone?: string;
  ownerEmail: string;
  ownerName?: string;
  internalNote?: string;
}

export async function getAdminRetailersList() {
  await verifyAdminSession();
  const adminClient = createAdminClient();

  // Fetch all companies with type 'retailer' or having a retailer_profile
  const { data: companies, error } = await adminClient
    .from("companies")
    .select(`
      id,
      name,
      business_registration_number,
      country,
      status,
      created_at,
      retailer_profiles (
        status,
        payment_terms,
        approved_terms,
        terms_status,
        terms_enabled,
        tax_exempt_status,
        resale_certificate_number,
        credit_limit,
        internal_note,
        updated_at
      ),
      stores (
        id,
        name,
        city,
        state,
        status
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching admin retailers:", error);
    return [];
  }

  // Also count active users and pending invitations per company
  const companyIds = (companies || []).map((c) => c.id);

  let invitationCounts: Record<string, number> = {};
  let userCounts: Record<string, number> = {};

  if (companyIds.length > 0) {
    const { data: invitations } = await adminClient
      .from("retailer_invitations")
      .select("company_id")
      .in("company_id", companyIds)
      .eq("status", "pending");

    (invitations || []).forEach((inv) => {
      invitationCounts[inv.company_id] = (invitationCounts[inv.company_id] || 0) + 1;
    });

    const { data: companyUsers, error: cuErr } = await adminClient
      .from("company_users")
      .select("company_id, status")
      .in("company_id", companyIds);

    if (cuErr) {
      console.error("[getAdminRetailersList] Error fetching company_users:", cuErr);
    } else if (companyUsers) {
      companyUsers.forEach((cu) => {
        if ((cu.status || "active").toLowerCase() === "active") {
          userCounts[cu.company_id] = (userCounts[cu.company_id] || 0) + 1;
        }
      });
    }
  }

  return (companies || []).map((comp: any) => {
    const profile = Array.isArray(comp.retailer_profiles)
      ? comp.retailer_profiles[0]
      : comp.retailer_profiles;

    const stores = Array.isArray(comp.stores) ? comp.stores : [];

    return {
      id: comp.id,
      name: comp.name,
      businessRegistrationNumber: comp.business_registration_number,
      country: formatCanonicalCountryName(comp.country) || "United States",
      status: normalizeRetailerAccountStatus(profile?.status || comp.status),
      paymentTerms: formatApprovedTermsDisplay(profile?.approved_terms || profile?.payment_terms),
      approvedTerms: profile?.approved_terms || "prepaid",
      termsStatus: profile?.terms_status || "pending",
      termsEnabled: profile?.terms_enabled ?? false,
      taxExemptStatus: profile?.tax_exempt_status ?? false,
      resaleCertificateNumber: profile?.resale_certificate_number || null,
      creditLimit: Number(profile?.credit_limit || 0),
      storesCount: stores.length,
      stores: stores,
      usersCount: userCounts[comp.id] || 0,
      pendingInvitesCount: invitationCounts[comp.id] || 0,
      internalNote: profile?.internal_note || "",
      createdAt: comp.created_at,
    };
  });
}

export async function getAdminRetailerDetail(companyId: string) {
  await verifyAdminSession();
  const adminClient = createAdminClient();

  // 1. Fetch Company & Profile
  const { data: company, error: companyError } = await adminClient
    .from("companies")
    .select(`
      id,
      name,
      company_code,
      business_registration_number,
      country,
      contact_name,
      contact_phone,
      address_1,
      address_2,
      city,
      state,
      zip_code,
      status,
      created_at,
      retailer_profiles (
        status,
        payment_terms,
        payment_terms_custom,
        credit_limit,
        terms_approved_by_admin,
        payment_method_card_enabled,
        payment_method_ach_enabled,
        terms_enabled,
        approved_terms,
        terms_status,
        stripe_customer_id,
        resale_certificate_number,
        tax_exempt_status,
        billing_contact_name,
        billing_contact_email,
        billing_contact_phone,
        billing_address,
        billing_city,
        billing_state,
        billing_zip,
        internal_note,
        created_at,
        updated_at
      )
    `)
    .eq("id", companyId)
    .single();

  if (companyError || !company) {
    return null;
  }

  const profile = Array.isArray(company.retailer_profiles)
    ? company.retailer_profiles[0]
    : company.retailer_profiles;

  // 2. Fetch Stores
  const { data: stores } = await adminClient
    .from("stores")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  // 3. Fetch Active Users & Roles
  const { data: companyUsers } = await adminClient
    .from("company_users")
    .select(`
      user_id,
      company_role,
      created_at,
      profiles:user_id (
        id,
        email,
        display_name,
        created_at
      )
    `)
    .eq("company_id", companyId);

  const userIds = (companyUsers || []).map((cu) => cu.user_id);
  let userRolesMap: Record<string, any> = {};
  let userStoresMap: Record<string, any[]> = {};

  if (userIds.length > 0) {
    const { data: roles } = await adminClient
      .from("retailer_user_roles")
      .select("user_id, role, has_all_stores_access")
      .in("user_id", userIds)
      .eq("company_id", companyId);

    (roles || []).forEach((r) => {
      userRolesMap[r.user_id] = r;
    });

    const { data: storeAccess } = await adminClient
      .from("retailer_user_store_access")
      .select("user_id, store_id, stores(id, name, city)")
      .in("user_id", userIds)
      .eq("company_id", companyId);

    (storeAccess || []).forEach((sa: any) => {
      if (!userStoresMap[sa.user_id]) userStoresMap[sa.user_id] = [];
      if (sa.stores) userStoresMap[sa.user_id].push(sa.stores);
    });
  }

  const activeMembers = (companyUsers || []).map((cu: any) => {
    const prof = cu.profiles;
    const r = userRolesMap[cu.user_id];
    return {
      userId: cu.user_id,
      email: prof?.email || "Unknown",
      displayName: prof?.display_name || "",
      role: (r?.role || cu.company_role || "employee") as RetailerRole,
      hasAllStoresAccess: r?.has_all_stores_access ?? (r?.role === "owner"),
      assignedStores: userStoresMap[cu.user_id] || [],
      joinedAt: cu.created_at,
    };
  });

  // 4. Fetch Invitations
  const { data: invitations } = await adminClient
    .from("retailer_invitations")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  // 5. Fetch Agreement Acceptances
  const { data: agreements } = await adminClient
    .from("retailer_agreement_acceptances")
    .select("*")
    .eq("company_id", companyId)
    .order("accepted_at", { ascending: false });

  // 6. Fetch Retailer Orders & Fulfillments
  const { data: rawOrders } = await adminClient
    .from("retailer_orders")
    .select(`
      id,
      order_number,
      store_id,
      order_status,
      payment_status,
      payment_method,
      payment_terms,
      subtotal_amount,
      shipping_amount,
      tax_amount,
      total_amount,
      total_skus_count,
      total_items_count,
      notes,
      is_test,
      created_at,
      stores (
        id,
        name,
        city,
        state,
        address,
        phone
      ),
      retailer_order_items (
        id,
        product_id,
        quantity,
        unit_wholesale_price,
        line_total,
        products (
          id,
          name,
          name_en,
          letusto_sku,
          manufacture_sku,
          brands (
            name
          )
        )
      )
    `)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  const orderIds = (rawOrders || []).map((o) => o.id);
  let fulfillmentsByOrderId: Record<string, any[]> = {};

  if (orderIds.length > 0) {
    const { data: rawFulfillments } = await adminClient
      .from("retailer_order_fulfillments")
      .select(`
        *,
        retailer_order_fulfillment_items (
          id,
          fulfillment_id,
          order_item_id,
          product_id,
          quantity_shipped,
          quantity_delivered,
          products (
            id,
            name,
            letusto_sku,
            manufacture_sku
          )
        )
      `)
      .in("order_id", orderIds)
      .order("created_at", { ascending: true });

    (rawFulfillments || []).forEach((f: any) => {
      if (!fulfillmentsByOrderId[f.order_id]) {
        fulfillmentsByOrderId[f.order_id] = [];
      }
      fulfillmentsByOrderId[f.order_id].push({
        id: f.id,
        fulfillmentNumber: f.fulfillment_number,
        orderId: f.order_id,
        status: f.status,
        carrier: f.carrier,
        trackingNumber: f.tracking_number,
        trackingUrl: f.tracking_url,
        shippedAt: f.shipped_at,
        deliveredAt: f.delivered_at,
        notes: f.notes,
        createdAt: f.created_at,
        items: (f.retailer_order_fulfillment_items || []).map((fit: any) => ({
          id: fit.id,
          orderItemId: fit.order_item_id,
          productId: fit.product_id,
          sku: fit.products?.letusto_sku || fit.products?.manufacture_sku || "KS-SKU",
          productName: fit.products?.name || "Product",
          quantityShipped: Number(fit.quantity_shipped || 0),
          quantityDelivered: Number(fit.quantity_delivered || 0),
        })),
      });
    });
  }

  const orders = (rawOrders || []).map((o: any) => {
    const oFulfillments = fulfillmentsByOrderId[o.id] || [];
    const items = (o.retailer_order_items || []).map((it: any) => {
      const p = it.products || {};
      const sku = p.letusto_sku || p.manufacture_sku || "KS-SKU";

      // Sum quantities shipped/delivered across active fulfillments
      let qtyShipped = 0;
      let qtyDelivered = 0;
      oFulfillments
        .filter((f) => f.status !== "cancelled")
        .forEach((f) => {
          f.items.forEach((fit: any) => {
            if (fit.orderItemId === it.id) {
              qtyShipped += fit.quantityShipped;
              qtyDelivered += fit.quantityDelivered;
            }
          });
        });

      return {
        id: it.id,
        productId: it.product_id,
        productName: p.name || "Product",
        productNameEn: p.name_en || null,
        brandName: p.brands?.name || "K SELECT Brand",
        sku,
        quantity: Number(it.quantity || 0),
        unitWholesalePrice: Number(it.unit_wholesale_price || 0),
        lineTotal: Number(it.line_total || 0),
        quantityShipped: qtyShipped,
        quantityDelivered: qtyDelivered,
      };
    });

    return {
      id: o.id,
      orderNumber: o.order_number,
      storeId: o.store_id,
      storeName: o.stores?.name || "Store",
      orderStatus: o.order_status,
      paymentStatus: o.payment_status,
      paymentMethod: o.payment_method,
      paymentTerms: o.payment_terms || "PREPAID",
      subtotalAmount: Number(o.subtotal_amount || 0),
      shippingAmount: Number(o.shipping_amount || 0),
      taxAmount: Number(o.tax_amount || 0),
      totalAmount: Number(o.total_amount || 0),
      totalSkusCount: Number(o.total_skus_count || items.length),
      totalItemsCount: Number(o.total_items_count || items.reduce((s: number, i: any) => s + i.quantity, 0)),
      notes: o.notes,
      isTest: Boolean(o.is_test),
      createdAt: o.created_at,
      items,
      fulfillments: oFulfillments,
    };
  });

  return {
    company: {
      id: company.id,
      name: company.name,
      businessRegistrationNumber: company.business_registration_number,
      country: formatCanonicalCountryName(company.country) || "United States",
      createdAt: company.created_at,
    },
    profile: profile
      ? {
          ...profile,
          status: normalizeRetailerAccountStatus(profile.status),
          approved_terms: profile.approved_terms || normalizeApprovedTerms(profile.payment_terms),
          terms_status: normalizeTermsStatus(profile.terms_status),
          terms_enabled: profile.terms_enabled ?? false,
          tax_exempt_status: profile.tax_exempt_status ?? false,
          payment_method_card_enabled: profile.payment_method_card_enabled ?? true,
          payment_method_ach_enabled: profile.payment_method_ach_enabled ?? true,
          credit_limit: Number(profile.credit_limit || 0),
        }
      : {
          status: "active",
          approved_terms: "prepaid",
          terms_status: "pending",
          terms_enabled: false,
          tax_exempt_status: false,
          payment_method_card_enabled: true,
          payment_method_ach_enabled: true,
          credit_limit: 0,
          resale_certificate_number: null,
          internal_note: "",
        },
    stores: stores || [],
    members: activeMembers,
    invitations: invitations || [],
    agreements: agreements || [],
    orders: orders || [],
  };
}

export async function createRetailerWithInitialStoreAndOwnerAction(payload: CreateRetailerPayload) {
  const adminSession = await verifyAdminSession();
  const adminClient = createAdminClient();

  try {
    // 1. Insert Company
    const { data: company, error: companyError } = await adminClient
      .from("companies")
      .insert({
        name: payload.companyName.trim(),
        business_registration_number: payload.businessRegistrationNumber?.trim() || null,
        country: formatCanonicalCountryName(payload.country) || "United States",
        status: "active",
      })
      .select("id, name")
      .single();

    if (companyError || !company) {
      console.error("Error creating retailer company:", companyError);
      return { success: false, error: "Failed to create retailer company record." };
    }

    // 1b. Assign Retailer role in company_roles
    await adminClient
      .from("company_roles")
      .insert({
        company_id: company.id,
        role: "Retailer",
      });

    // 2. Insert Retailer Profile (Commercial Terms)
    const initialApprovedTerms = normalizeApprovedTerms(payload.paymentTerms);
    const hasNetTerms = initialApprovedTerms !== "prepaid";

    const { error: profileError } = await adminClient
      .from("retailer_profiles")
      .insert({
        company_id: company.id,
        status: "active",
        payment_method_card_enabled: true,
        payment_method_ach_enabled: true,
        terms_enabled: hasNetTerms,
        approved_terms: initialApprovedTerms,
        terms_status: hasNetTerms ? "approved" : "pending",
        credit_limit: Math.max(0, payload.creditLimit || 0.0),
        tax_exempt_status: false,
        payment_terms: payload.paymentTerms || "PREPAID_CARD",
        terms_approved_by_admin: hasNetTerms,
        internal_note: payload.internalNote?.trim() || null,
      });

    if (profileError) {
      console.error("Error creating retailer profile:", profileError);
    }

    // 3. Insert Initial Store
    const { data: store, error: storeError } = await adminClient
      .from("stores")
      .insert({
        company_id: company.id,
        name: payload.initialStoreName.trim(),
        city: payload.initialStoreCity?.trim() || null,
        state: payload.initialStoreState?.trim() || null,
        address: payload.initialStoreAddress?.trim() || null,
        phone: payload.initialStorePhone?.trim() || null,
        status: "active",
        type: "Independent Beauty Supply",
      })
      .select("id, name")
      .single();

    if (storeError) {
      console.error("Error creating initial store:", storeError);
    }

    // 4. Invite Retailer Owner
    const inviteResult = await createRetailerInvitation({
      companyId: company.id,
      email: payload.ownerEmail.trim(),
      name: payload.ownerName?.trim() || undefined,
      role: "owner",
      hasAllStoresAccess: true,
      storeIds: store ? [store.id] : [],
      invitedBy: adminSession.userId,
    });

    revalidatePath("/admin/retailers");
    revalidatePath("/admin/stores");

    return {
      success: true,
      companyId: company.id,
      invitationResult: inviteResult,
    };
  } catch (err: any) {
    console.error("Error in createRetailerWithInitialStoreAndOwnerAction:", err);
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}

export async function adminInviteRetailerUserAction(params: {
  companyId: string;
  email: string;
  name?: string;
  role: RetailerRole;
  hasAllStoresAccess?: boolean;
  storeIds?: string[];
}) {
  const adminSession = await verifyAdminSession();

  const res = await createRetailerInvitation({
    companyId: params.companyId,
    email: params.email,
    name: params.name,
    role: params.role,
    hasAllStoresAccess: params.hasAllStoresAccess,
    storeIds: params.storeIds,
    invitedBy: adminSession.userId,
  });

  if (res.success) {
    revalidatePath(`/admin/retailers/${params.companyId}`);
    revalidatePath("/admin/retailers");
  }

  return res;
}

export async function updateRetailerTermsAction(
  companyId: string,
  payload: {
    status?: string;
    paymentTerms?: string;
    creditLimit?: number;
    paymentMethodCardEnabled?: boolean;
    paymentMethodAchEnabled?: boolean;
    termsEnabled?: boolean;
    approvedTerms?: string;
    termsStatus?: string;
    resaleCertificateNumber?: string;
    taxExemptStatus?: boolean;
    internalNote?: string;
    cardFeeOverride?: number | null;
    cardFeeWaived?: boolean;
    achFeeOverride?: number | null;
    achFeeWaived?: boolean;
  }
) {
  await verifyAdminSession();
  const adminClient = createAdminClient();

  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  if (payload.status !== undefined) {
    updateData.status = normalizeRetailerAccountStatus(payload.status);
  }
  if (payload.creditLimit !== undefined) {
    updateData.credit_limit = Math.max(0, Number(payload.creditLimit) || 0);
  }
  if (payload.paymentMethodCardEnabled !== undefined) {
    updateData.payment_method_card_enabled = Boolean(payload.paymentMethodCardEnabled);
  }
  if (payload.paymentMethodAchEnabled !== undefined) {
    updateData.payment_method_ach_enabled = Boolean(payload.paymentMethodAchEnabled);
  }
  if (payload.termsEnabled !== undefined) {
    updateData.terms_enabled = Boolean(payload.termsEnabled);
  }
  if (payload.approvedTerms !== undefined || payload.paymentTerms !== undefined) {
    updateData.approved_terms = normalizeApprovedTerms(payload.approvedTerms || payload.paymentTerms);
  }
  if (payload.termsStatus !== undefined) {
    updateData.terms_status = normalizeTermsStatus(payload.termsStatus);
  }
  if (payload.resaleCertificateNumber !== undefined) {
    updateData.resale_certificate_number = payload.resaleCertificateNumber.trim() || null;
  }
  if (payload.taxExemptStatus !== undefined) {
    updateData.tax_exempt_status = Boolean(payload.taxExemptStatus);
  }
  if (payload.internalNote !== undefined) {
    updateData.internal_note = payload.internalNote.trim() || null;
  }
  if (payload.cardFeeOverride !== undefined) {
    updateData.card_fee_override = payload.cardFeeOverride === null ? null : Math.max(0, Number(payload.cardFeeOverride));
  }
  if (payload.cardFeeWaived !== undefined) {
    updateData.card_fee_waived = Boolean(payload.cardFeeWaived);
  }
  if (payload.achFeeOverride !== undefined) {
    updateData.ach_fee_override = payload.achFeeOverride === null ? null : Math.max(0, Number(payload.achFeeOverride));
  }
  if (payload.achFeeWaived !== undefined) {
    updateData.ach_fee_waived = Boolean(payload.achFeeWaived);
  }

  const { error } = await adminClient
    .from("retailer_profiles")
    .upsert({
      company_id: companyId,
      ...updateData,
    });

  if (error) {
    console.error("Error updating retailer terms:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/admin/retailers/${companyId}`);
  revalidatePath("/admin/retailers");
  revalidatePath("/retailer/settings/company");
  revalidatePath("/retailer/checkout");
  return { success: true };
}

export async function createRetailerStoreAction(
  companyId: string,
  payload: {
    name: string;
    storeCode?: string;
    city?: string;
    state?: string;
    zip?: string;
    address?: string;
    phone?: string;
    email?: string;
    managerName?: string;
    managerPhone?: string;
  }
) {
  const adminSession = await verifyAdminSession();
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("stores")
    .insert({
      company_id: companyId,
      name: payload.name.trim(),
      store_code: payload.storeCode?.trim() || null,
      city: payload.city?.trim() || null,
      state: payload.state?.trim() || null,
      zip: payload.zip?.trim() || null,
      address: payload.address?.trim() || null,
      phone: payload.phone?.trim() || null,
      email: payload.email?.trim() || null,
      manager_name: payload.managerName?.trim() || null,
      manager_phone: payload.managerPhone?.trim() || null,
      status: "active",
      type: "Independent Beauty Supply",
    })
    .select("id, name")
    .single();

  if (error) {
    console.error("Error creating store:", error);
    return { success: false, error: error.message };
  }

  try {
    await adminClient.from("retailer_organization_audit_logs").insert({
      company_id: companyId,
      entity_type: "store",
      entity_id: data.id,
      action: "admin_create_store",
      actor_id: adminSession.userId,
      actor_type: "admin",
      new_data: payload,
    });
  } catch (e) {
    // Graceful audit log fallback
  }

  revalidatePath(`/admin/retailers/${companyId}`);
  revalidatePath("/admin/retailers");
  revalidatePath("/admin/stores");
  revalidatePath("/retailer/settings/company");
  revalidatePath("/settings/company");
  revalidatePath("/retailer/stores");
  revalidatePath("/stores");
  revalidatePath("/account");
  revalidatePath("/retailer/account");
  return { success: true, store: data };
}

export async function adminUpdateRetailerCompanyAction(
  companyId: string,
  payload: {
    name?: string;
    businessRegistrationNumber?: string;
    country?: string;
    contactName?: string;
    contactPhone?: string;
    // Company HQ Address (Authoritative Company Core):
    address?: string; // HQ address line 1
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    zip?: string;
    zipCode?: string;
    companyStatus?: string;

    // Retailer Billing & Commercial Profile:
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
    retailerStatus?: string;
    status?: string; // legacy alias
  }
) {
  const adminSession = await verifyAdminSession();
  const adminClient = createAdminClient();

  // 1. Fetch current data for audit log
  const { data: oldComp } = await adminClient
    .from("companies")
    .select("name, business_registration_number, country, contact_name, contact_phone, address_1, address_2, city, state, zip_code, status")
    .eq("id", companyId)
    .single();

  const { data: oldProf } = await adminClient
    .from("retailer_profiles")
    .select("billing_same_as_hq, billing_contact_same_as_primary, billing_contact_name, billing_contact_email, billing_contact_phone, billing_address, billing_city, billing_state, billing_zip, status")
    .eq("company_id", companyId)
    .maybeSingle();

  // 2. Authoritative Company Core Update in `companies`
  const hqAddress1 = (payload.address1 ?? payload.address)?.trim();
  const hqAddress2 = payload.address2?.trim();
  const hqCity = payload.city?.trim();
  const hqState = payload.state?.trim();
  const hqZip = (payload.zipCode ?? payload.zip)?.trim();

  const compUpdates: any = { updated_at: new Date().toISOString() };
  if (payload.name !== undefined && payload.name.trim()) compUpdates.name = payload.name.trim();
  if (payload.businessRegistrationNumber !== undefined)
    compUpdates.business_registration_number = payload.businessRegistrationNumber.trim();
  if (payload.country !== undefined) compUpdates.country = formatCanonicalCountryName(payload.country) || "United States";
  if (payload.contactName !== undefined) compUpdates.contact_name = payload.contactName.trim() || null;
  if (payload.contactPhone !== undefined) compUpdates.contact_phone = payload.contactPhone.trim() || null;
  if (payload.address !== undefined || payload.address1 !== undefined) compUpdates.address_1 = hqAddress1 || null;
  if (payload.address2 !== undefined) compUpdates.address_2 = hqAddress2 || null;
  if (payload.city !== undefined) compUpdates.city = hqCity || null;
  if (payload.state !== undefined) compUpdates.state = hqState || null;
  if (payload.zip !== undefined || payload.zipCode !== undefined) compUpdates.zip_code = hqZip || null;

  if (payload.companyStatus !== undefined) {
    compUpdates.status = payload.companyStatus === "archived" ? "inactive" : payload.companyStatus;
  }

  const { error: compError } = await adminClient
    .from("companies")
    .update(compUpdates)
    .eq("id", companyId);

  if (compError) {
    return { success: false, error: compError.message };
  }

  // 3. Retailer Commercial Profile Update in `retailer_profiles`
  const profUpdates: any = { updated_at: new Date().toISOString() };

  // Billing address override behavior
  if (payload.billingSameAsHq !== undefined) {
    profUpdates.billing_same_as_hq = payload.billingSameAsHq;
    if (payload.billingSameAsHq) {
      // Mirror current/new HQ values
      const effectiveHq1 = compUpdates.address_1 ?? oldComp?.address_1;
      const effectiveHqCity = compUpdates.city ?? oldComp?.city;
      const effectiveHqState = compUpdates.state ?? oldComp?.state;
      const effectiveHqZip = compUpdates.zip_code ?? oldComp?.zip_code;
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

  // Billing contact override behavior
  if (payload.billingContactSameAsPrimary !== undefined) {
    profUpdates.billing_contact_same_as_primary = payload.billingContactSameAsPrimary;
    if (payload.billingContactSameAsPrimary) {
      const effectiveName = compUpdates.contact_name ?? oldComp?.contact_name;
      const effectivePhone = compUpdates.contact_phone ?? oldComp?.contact_phone;
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

  const effectiveRetailerStatus = payload.retailerStatus ?? payload.status;
  if (effectiveRetailerStatus !== undefined) {
    profUpdates.status = effectiveRetailerStatus;
  }

  if (Object.keys(profUpdates).length > 1) {
    const { error: profError } = await adminClient
      .from("retailer_profiles")
      .update(profUpdates)
      .eq("company_id", companyId);

    if (profError && profError.message?.includes("does not exist")) {
      delete profUpdates.billing_same_as_hq;
      delete profUpdates.billing_contact_same_as_primary;
      await adminClient
        .from("retailer_profiles")
        .update(profUpdates)
        .eq("company_id", companyId);
    }
  }

  try {
    await adminClient.from("retailer_organization_audit_logs").insert({
      company_id: companyId,
      entity_type: "company",
      entity_id: companyId,
      action: "admin_update_company",
      actor_id: adminSession.userId,
      actor_type: "admin",
      old_data: { ...oldComp, ...oldProf },
      new_data: payload,
    });
  } catch (e) {
    // Graceful audit log fallback
  }

  revalidatePath(`/admin/retailers/${companyId}`);
  revalidatePath("/admin/retailers");
  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/admin/companies");
  revalidatePath("/retailer/settings/company");
  revalidatePath("/account");
  revalidatePath("/retailer/account");

  return { success: true };
}

export async function adminUpdateRetailerStoreAction(
  companyId: string,
  storeId: string,
  payload: {
    name: string;
    storeCode?: string;
    city?: string;
    state?: string;
    zip?: string;
    address?: string;
    phone?: string;
    email?: string;
    managerName?: string;
    managerPhone?: string;
  }
) {
  const adminSession = await verifyAdminSession();
  const adminClient = createAdminClient();

  const { data: oldStore } = await adminClient
    .from("stores")
    .select("*")
    .eq("id", storeId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!oldStore) {
    return { success: false, error: "Store not found." };
  }

  const { error } = await adminClient
    .from("stores")
    .update({
      name: payload.name.trim(),
      store_code: payload.storeCode?.trim() || null,
      city: payload.city?.trim() || null,
      state: payload.state?.trim() || null,
      zip: payload.zip?.trim() || null,
      address: payload.address?.trim() || null,
      phone: payload.phone?.trim() || null,
      email: payload.email?.trim() || null,
      manager_name: payload.managerName?.trim() || null,
      manager_phone: payload.managerPhone?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", storeId)
    .eq("company_id", companyId);

  if (error) {
    return { success: false, error: error.message };
  }

  try {
    await adminClient.from("retailer_organization_audit_logs").insert({
      company_id: companyId,
      entity_type: "store",
      entity_id: storeId,
      action: "admin_update_store",
      actor_id: adminSession.userId,
      actor_type: "admin",
      old_data: oldStore,
      new_data: payload,
    });
  } catch (e) {
    // Graceful audit log fallback
  }

  revalidatePath(`/admin/retailers/${companyId}`);
  revalidatePath("/admin/retailers");
  revalidatePath("/admin/stores");
  revalidatePath("/retailer/settings/company");
  revalidatePath("/settings/company");
  revalidatePath("/retailer/stores");
  revalidatePath("/stores");
  revalidatePath("/account");
  revalidatePath("/retailer/account");

  return { success: true };
}

export async function adminSetRetailerStoreStatusAction(
  companyId: string,
  storeId: string,
  status: "active" | "inactive" | "closed"
) {
  const adminSession = await verifyAdminSession();
  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from("stores")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", storeId)
    .eq("company_id", companyId);

  if (error) {
    return { success: false, error: error.message };
  }

  try {
    await adminClient.from("retailer_organization_audit_logs").insert({
      company_id: companyId,
      entity_type: "store",
      entity_id: storeId,
      action: `admin_store_status_${status}`,
      actor_id: adminSession.userId,
      actor_type: "admin",
      new_data: { status },
    });
  } catch (e) {
    // Graceful audit log fallback
  }

  revalidatePath(`/admin/retailers/${companyId}`);
  revalidatePath("/admin/retailers");
  revalidatePath("/admin/stores");
  revalidatePath("/retailer/settings/company");
  revalidatePath("/settings/company");
  revalidatePath("/retailer/stores");
  revalidatePath("/stores");
  revalidatePath("/retailer/checkout");
  revalidatePath("/checkout");
  revalidatePath("/account");
  revalidatePath("/retailer/account");

  return { success: true };
}

export async function adminUpdateRetailerUserRoleAction(
  companyId: string,
  userId: string,
  payload: {
    role: RetailerRole;
    hasAllStoresAccess?: boolean;
    storeIds?: string[];
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminSession = await verifyAdminSession();
    const adminClient = createAdminClient();

    const isOwnerOrBuyer = ["owner", "buyer"].includes(payload.role);
    const hasAllStores = payload.hasAllStoresAccess ?? (payload.role === "owner");

    // Upsert role
    await adminClient
      .from("retailer_user_roles")
      .upsert({
        user_id: userId,
        company_id: companyId,
        role: payload.role,
        has_all_stores_access: hasAllStores,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,role" });

    // Clear obsolete roles
    await adminClient
      .from("retailer_user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .neq("role", payload.role);

    // Update company_users role mapping
    await adminClient
      .from("company_users")
      .update({
        company_role: isOwnerOrBuyer ? "company_admin" : "company_staff",
      })
      .eq("id", userId);

    // Sync store access
    await adminClient
      .from("retailer_user_store_access")
      .delete()
      .eq("user_id", userId)
      .eq("company_id", companyId);

    if (!hasAllStores && payload.storeIds && payload.storeIds.length > 0) {
      const inserts = payload.storeIds.map((sId) => ({
        user_id: userId,
        store_id: sId,
        company_id: companyId,
        can_submit_checks: true,
        can_print_tags: true,
      }));
      await adminClient.from("retailer_user_store_access").insert(inserts);
    }

    try {
      await adminClient.from("retailer_organization_audit_logs").insert({
        company_id: companyId,
        entity_type: "role",
        entity_id: userId,
        action: "admin_change_user_role",
        actor_id: adminSession.userId,
        actor_type: "admin",
        new_data: payload,
      });
    } catch (e) {
      // Graceful audit log fallback
    }

    revalidatePath(`/admin/retailers/${companyId}`);
    revalidatePath("/account");
    revalidatePath("/retailer/account");

    return { success: true };
  } catch (err: any) {
    console.error("Error in adminUpdateRetailerUserRoleAction:", err);
    return { success: false, error: err.message || "Failed to update role." };
  }
}

export async function adminUpdateRetailerUserStoreAccessAction(
  companyId: string,
  userId: string,
  payload: {
    hasAllStoresAccess: boolean;
    storeIds?: string[];
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminSession = await verifyAdminSession();
    const adminClient = createAdminClient();

    await adminClient
      .from("retailer_user_roles")
      .update({
        has_all_stores_access: payload.hasAllStoresAccess,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("company_id", companyId);

    await adminClient
      .from("retailer_user_store_access")
      .delete()
      .eq("user_id", userId)
      .eq("company_id", companyId);

    if (!payload.hasAllStoresAccess && payload.storeIds && payload.storeIds.length > 0) {
      const inserts = payload.storeIds.map((sId) => ({
        user_id: userId,
        store_id: sId,
        company_id: companyId,
        can_submit_checks: true,
        can_print_tags: true,
      }));
      await adminClient.from("retailer_user_store_access").insert(inserts);
    }

    try {
      await adminClient.from("retailer_organization_audit_logs").insert({
        company_id: companyId,
        entity_type: "store_access",
        entity_id: userId,
        action: "admin_change_store_access",
        actor_id: adminSession.userId,
        actor_type: "admin",
        new_data: payload,
      });
    } catch (e) {
      // Graceful audit log fallback
    }

    revalidatePath(`/admin/retailers/${companyId}`);
    revalidatePath("/account");
    revalidatePath("/retailer/account");

    return { success: true };
  } catch (err: any) {
    console.error("Error in adminUpdateRetailerUserStoreAccessAction:", err);
    return { success: false, error: err.message || "Failed to update store access." };
  }
}

export async function adminSetRetailerUserStatusAction(
  companyId: string,
  userId: string,
  status: "active" | "suspended"
) {
  const adminSession = await verifyAdminSession();
  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from("company_users")
    .update({
      status,
    })
    .eq("id", userId)
    .eq("company_id", companyId);

  if (error) {
    return { success: false, error: error.message };
  }

  try {
    await adminClient.from("retailer_organization_audit_logs").insert({
      company_id: companyId,
      entity_type: "user",
      entity_id: userId,
      action: `admin_user_status_${status}`,
      actor_id: adminSession.userId,
      actor_type: "admin",
      new_data: { status },
    });
  } catch (e) {
    // Graceful audit log fallback
  }

  revalidatePath(`/admin/retailers/${companyId}`);
  revalidatePath("/account");
  revalidatePath("/retailer/account");

  return { success: true };
}
