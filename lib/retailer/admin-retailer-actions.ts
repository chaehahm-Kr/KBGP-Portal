"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createRetailerInvitation } from "@/lib/retailer/onboarding-actions";
import { RetailerRole } from "@/lib/retailer/onboarding-types";
import { revalidatePath } from "next/cache";

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

    const { data: companyUsers } = await adminClient
      .from("company_users")
      .select("company_id")
      .in("company_id", companyIds);

    (companyUsers || []).forEach((cu) => {
      userCounts[cu.company_id] = (userCounts[cu.company_id] || 0) + 1;
    });
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
      country: comp.country || "US",
      status: profile?.status || comp.status || "active",
      paymentTerms: profile?.payment_terms || "PREPAID_CARD",
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
      business_registration_number,
      country,
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
      country: company.country || "US",
      createdAt: company.created_at,
    },
    profile: profile || {
      status: "active",
      payment_terms: "PREPAID_CARD",
      credit_limit: 0,
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
        country: payload.country || "US",
        company_type: "retailer",
        business_type: "retailer",
        status: "active",
      })
      .select("id, name")
      .single();

    if (companyError || !company) {
      console.error("Error creating retailer company:", companyError);
      return { success: false, error: "Failed to create retailer company record." };
    }

    // 2. Insert Retailer Profile (Commercial Terms)
    const { error: profileError } = await adminClient
      .from("retailer_profiles")
      .insert({
        company_id: company.id,
        status: "active",
        payment_terms: payload.paymentTerms || "PREPAID_CARD",
        credit_limit: payload.creditLimit || 0.0,
        terms_approved_by_admin: true,
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
    internalNote?: string;
  }
) {
  await verifyAdminSession();
  const adminClient = createAdminClient();

  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  if (payload.status !== undefined) updateData.status = payload.status;
  if (payload.paymentTerms !== undefined) updateData.payment_terms = payload.paymentTerms;
  if (payload.creditLimit !== undefined) updateData.credit_limit = payload.creditLimit;
  if (payload.paymentMethodCardEnabled !== undefined)
    updateData.payment_method_card_enabled = payload.paymentMethodCardEnabled;
  if (payload.paymentMethodAchEnabled !== undefined)
    updateData.payment_method_ach_enabled = payload.paymentMethodAchEnabled;
  if (payload.termsEnabled !== undefined) updateData.terms_enabled = payload.termsEnabled;
  if (payload.approvedTerms !== undefined) updateData.approved_terms = payload.approvedTerms;
  if (payload.termsStatus !== undefined) updateData.terms_status = payload.termsStatus;
  if (payload.resaleCertificateNumber !== undefined)
    updateData.resale_certificate_number = payload.resaleCertificateNumber;
  if (payload.internalNote !== undefined) updateData.internal_note = payload.internalNote;

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
  return { success: true };
}

export async function createRetailerStoreAction(
  companyId: string,
  payload: {
    name: string;
    city?: string;
    state?: string;
    address?: string;
    phone?: string;
  }
) {
  await verifyAdminSession();
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("stores")
    .insert({
      company_id: companyId,
      name: payload.name.trim(),
      city: payload.city?.trim() || null,
      state: payload.state?.trim() || null,
      address: payload.address?.trim() || null,
      phone: payload.phone?.trim() || null,
      status: "active",
      type: "Independent Beauty Supply",
    })
    .select("id, name")
    .single();

  if (error) {
    console.error("Error creating store:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/admin/retailers/${companyId}`);
  revalidatePath("/admin/stores");
  return { success: true, store: data };
}
