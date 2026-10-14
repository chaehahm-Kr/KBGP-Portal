import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdminSession } from "@/lib/auth/dal";
import { RetailerRole } from "@/lib/retailer/onboarding-types";
import { resolveEffectiveSku } from "@/lib/product/types";
import { formatCategoryName } from "@/lib/retailer/products";
import { formatCanonicalCountryName } from "@/lib/constants/countries";
import {
  ReportingPeriod,
  MovementStatus,
  ReorderSignal,
  ReorderConfidence,
  TARGET_WEEKS_OF_SUPPLY,
} from "./performance";
import {
  normalizeApprovedTerms,
  formatApprovedTermsDisplay,
  normalizeTermsStatus,
  formatTermsStatusDisplay,
  normalizeRetailerAccountStatus,
  formatRetailerAccountStatusDisplay,
} from "./commercial-types";
import { getRetailerARStatus } from "@/lib/finance/invoice-actions";
import type { RetailerARStatus } from "@/lib/finance/invoice-types";
import type { RetailerShippingAddress } from "./shipping-address-types";
import { computeAuthoritativeOrderStatus } from "@/lib/orders/order-status-utils";

export interface NeedsAttentionItem {
  id: string;
  type: "order_fulfillment" | "weekly_check" | "protection_review" | "support_case" | "terms_review";
  title: string;
  description: string;
  severity: "urgent" | "warning" | "info";
  href: string;
  badge: string;
}

export interface Retailer360PaymentBreakdown {
  paidCount: number;
  paidAmount: number;
  pendingCount: number;
  pendingAmount: number;
  unpaidCount: number;
  unpaidAmount: number;
  failedCount: number;
  failedAmount: number;
}

export interface Retailer360OverviewMetrics {
  retailerStatus: string;
  totalStoresCount: number;
  activeUsersCount: number;
  pendingInvitesCount: number;
  openOrdersCount: number;
  ordersAwaitingFulfillmentCount: number;
  totalDeliveredUnits: number;
  // Financial KPI Semantics (Order-derived, not an A/R ledger)
  submittedOrderValue: number;
  submittedOrdersCount: number;
  estimatedUnpaidOrderValue: number;
  paidOrderValue: number;
  paymentBreakdown: Retailer360PaymentBreakdown;
  testOrdersCount: number;
  // Commercial Terms
  termsStatus: string;
  approvedTerms: string;
  creditLimit: number;
  // Operational metrics
  reportingCoveragePercent: number;
  productsNeedingReorderCount: number;
  trainingCompletionPercent: number;
  activeProtectionTrialsCount: number;
  protectionReviewsActionCount: number;
  openSupportCasesCount: number;
}

export interface Retailer360StoreItem {
  id: string;
  name: string;
  storeCode?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  managerName?: string | null;
  managerPhone?: string | null;
  status: string;
  assignedUsersCount: number;
  assortmentCount: number;
  latestWeeklyCheckDate: string | null;
  latestWeeklyCheckStatus: string | null;
  createdAt: string;
}

export interface Retailer360MemberItem {
  userId: string;
  email: string;
  displayName: string;
  role: RetailerRole;
  status: string;
  hasAllStoresAccess: boolean;
  assignedStores: Array<{ id: string; name: string }>;
  joinedAt: string;
  isPrimary?: boolean;
}

export interface Retailer360InvitationItem {
  id: string;
  email: string;
  invited_name?: string | null;
  role: RetailerRole;
  has_all_stores_access: boolean;
  store_ids?: string[] | null;
  status: string;
  expires_at: string;
  created_at: string;
}

export interface Retailer360OrderItem {
  id: string;
  orderNumber: string;
  storeId: string;
  storeName: string;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  paymentTerms: string;
  subtotalAmount: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  totalSkusCount: number;
  totalItemsCount: number;
  notes?: string | null;
  isTest: boolean;
  createdAt: string;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    productNameEn?: string | null;
    brandName: string;
    sku: string;
    quantity: number;
    unitWholesalePrice: number;
    lineTotal: number;
    quantityShipped: number;
    quantityDelivered: number;
    quantityCancelled: number;
    quantityRemaining: number;
  }>;
  fulfillments: Array<{
    id: string;
    fulfillmentNumber: string;
    orderId: string;
    status: string;
    carrier?: string | null;
    trackingNumber?: string | null;
    trackingUrl?: string | null;
    shippedAt?: string | null;
    deliveredAt?: string | null;
    notes?: string | null;
    createdAt: string;
    items: Array<{
      id: string;
      orderItemId: string;
      productId: string;
      sku: string;
      productName: string;
      quantityShipped: number;
      quantityDelivered: number;
    }>;
  }>;
}

export interface Retailer360PerformanceProduct {
  productId: string;
  productName: string;
  productNameEn?: string | null;
  brandName: string;
  sku: string;
  category: string;
  cartonPackQty: number;
  wholesalePrice: number;
  msrp: number;
  totalReportedRemaining: number;
  estimatedMovement: number;
  movementStatus: MovementStatus;
  averageWeeklyMovement: number;
  estimatedRetailSales: number;
  estimatedGrossProfit: number;
  estimatedGrossMargin: number;
  currentWeeksOfSupply: number | null;
  reorderSignal: ReorderSignal;
  reorderConfidence: ReorderConfidence;
  recommendedOrderQtyUnits: number;
  recommendedOrderCartons: number;
  approxReorderWholesaleCost: number;
}

export interface Retailer360PerformanceSummary {
  estimatedMovement: number;
  estimatedRetailSales: number;
  estimatedGrossProfit: number;
  estimatedGrossMargin: number;
  coveragePercent: number;
  totalStores: number;
  reportingStores: number;
  productsNeedingReorder: number;
  products: Retailer360PerformanceProduct[];
  weeklyCheckHistory: Array<{
    id: string;
    storeId: string;
    storeName: string;
    reportingWeek: string;
    reportDate: string;
    status: string;
    itemsCount: number;
    totalMovement: number;
    submittedAt: string;
  }>;
}

export interface Retailer360TrainingItem {
  productId: string;
  productName: string;
  productNameEn?: string | null;
  brandName: string;
  sku: string;
  category: string;
  completedUsersCount: number;
  totalEligibleUsersCount: number;
  completionPercent: number;
}

export interface Retailer360ProtectionItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  brandName: string;
  storeId?: string | null;
  storeName?: string | null;
  trialStartDate: string;
  trialEndDate: string;
  protectedQuantity: number;
  status: string;
  reviewRequestedAt?: string | null;
  reviewNotes?: string | null;
  resolutionDecision?: string | null;
  approvedCreditAmount?: number | null;
  createdAt: string;
}

export interface Retailer360CaseItem {
  id: string;
  caseNumber: string;
  category: string;
  title: string;
  content: string;
  storeName?: string | null;
  relatedOrderNumber?: string | null;
  relatedProductName?: string | null;
  status: string;
  isActionRequired: boolean;
  messagesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Retailer360Data {
  company: {
    id: string;
    name: string;
    companyCode?: string | null;
    businessRegistrationNumber?: string | null;
    country: string;
    status: string;
    createdAt: string;
    address1?: string | null;
    address2?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
    formattedHqAddress?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
  };
  billing: import("@/lib/retailer/organization-mapping").EffectiveRetailerBillingInfo;
  profile: {
    status: string;
    payment_terms: string;
    payment_terms_custom?: string | null;
    credit_limit: number;
    payment_method_card_enabled: boolean;
    payment_method_ach_enabled: boolean;
    terms_enabled: boolean;
    approved_terms?: string | null;
    terms_status?: string | null;
    terms_approved_by_admin?: boolean;
    resale_certificate_number?: string | null;
    tax_exempt_status?: boolean;
    billing_contact_name?: string | null;
    billing_contact_email?: string | null;
    billing_contact_phone?: string | null;
    billing_address?: string | null;
    billing_city?: string | null;
    billing_state?: string | null;
    billing_zip?: string | null;
    internal_note?: string | null;
    card_fee_override?: number | null;
    card_fee_waived?: boolean;
    ach_fee_override?: number | null;
    ach_fee_waived?: boolean;
  };
  needsAttention: NeedsAttentionItem[];
  metrics: Retailer360OverviewMetrics;
  stores: Retailer360StoreItem[];
  members: Retailer360MemberItem[];
  invitations: Retailer360InvitationItem[];
  agreements: Array<{
    id: string;
    agreement_id?: string | null;
    agreement_type: string;
    agreement_version: string;
    accepted_name: string;
    signer_title?: string | null;
    signer_email?: string | null;
    accepted_ip?: string | null;
    accepted_at: string;
    effective_date?: string | null;
    expiration_date?: string | null;
    status?: string | null;
    pdf_status?: "pending" | "generated" | "failed" | null;
    pdf_storage_path?: string | null;
    pdf_filename?: string | null;
    pdf_generated_at?: string | null;
    pdf_error?: string | null;
    signedPdfUrl?: string | null;
  }>;
  documents?: Array<{
    id: string;
    documentType: string;
    title: string;
    filename: string;
    storagePath: string;
    mimeType: string;
    fileSizeBytes?: number | null;
    createdAt: string;
    signedUrl?: string | null;
  }>;
  orders: Retailer360OrderItem[];
  performance: Retailer360PerformanceSummary;
  training: {
    products: Retailer360TrainingItem[];
    overallCompletionPercent: number;
    totalProductsCount: number;
  };
  protections: Retailer360ProtectionItem[];
  cases: Retailer360CaseItem[];
  arStatus?: RetailerARStatus;
  shippingAddresses?: RetailerShippingAddress[];
}

export async function getAdminRetailer360Data(companyId: string): Promise<Retailer360Data | null> {
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
      status,
      created_at,
      address_1,
      address_2,
      city,
      state,
      zip_code,
      contact_name,
      contact_phone,
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

  const rawProfile = Array.isArray(company.retailer_profiles)
    ? company.retailer_profiles[0]
    : company.retailer_profiles;

  // Safe fetch of fee overrides (resilient if migration 0160 execution is pending)
  let feeOverrides: {
    card_fee_override?: number | null;
    card_fee_waived?: boolean;
    ach_fee_override?: number | null;
    ach_fee_waived?: boolean;
  } = {};

  try {
    const { data: feeData, error: feeErr } = await adminClient
      .from("retailer_profiles")
      .select("card_fee_override, card_fee_waived, ach_fee_override, ach_fee_waived")
      .eq("company_id", companyId)
      .maybeSingle();

    if (!feeErr && feeData) {
      feeOverrides = {
        card_fee_override:
          feeData.card_fee_override !== null && feeData.card_fee_override !== undefined
            ? Number(feeData.card_fee_override)
            : null,
        card_fee_waived: Boolean(feeData.card_fee_waived),
        ach_fee_override:
          feeData.ach_fee_override !== null && feeData.ach_fee_override !== undefined
            ? Number(feeData.ach_fee_override)
            : null,
        ach_fee_waived: Boolean(feeData.ach_fee_waived),
      };
    }
  } catch {
    // Graceful fallback
  }

  const profile = {
    status: normalizeRetailerAccountStatus(rawProfile?.status || company.status),
    payment_terms: rawProfile?.payment_terms || "PREPAID_CARD",
    payment_terms_custom: rawProfile?.payment_terms_custom || null,
    credit_limit: Number(rawProfile?.credit_limit || 0),
    payment_method_card_enabled: rawProfile?.payment_method_card_enabled ?? true,
    payment_method_ach_enabled: rawProfile?.payment_method_ach_enabled ?? true,
    terms_enabled: rawProfile?.terms_enabled ?? false,
    approved_terms: rawProfile?.approved_terms || normalizeApprovedTerms(rawProfile?.payment_terms),
    terms_status: normalizeTermsStatus(rawProfile?.terms_status),
    terms_approved_by_admin: rawProfile?.terms_approved_by_admin ?? false,
    resale_certificate_number: rawProfile?.resale_certificate_number || null,
    tax_exempt_status: rawProfile?.tax_exempt_status ?? false,
    billing_contact_name: rawProfile?.billing_contact_name || null,
    billing_contact_email: rawProfile?.billing_contact_email || null,
    billing_contact_phone: rawProfile?.billing_contact_phone || null,
    billing_address: rawProfile?.billing_address || null,
    billing_city: rawProfile?.billing_city || null,
    billing_state: rawProfile?.billing_state || null,
    billing_zip: rawProfile?.billing_zip || null,
    internal_note: rawProfile?.internal_note || null,
    card_fee_override: feeOverrides.card_fee_override ?? null,
    card_fee_waived: feeOverrides.card_fee_waived ?? false,
    ach_fee_override: feeOverrides.ach_fee_override ?? null,
    ach_fee_waived: feeOverrides.ach_fee_waived ?? false,
  };

  // 2. Fetch Stores
  const { data: storesData } = await adminClient
    .from("stores")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  const stores = storesData || [];
  const storeIds = stores.map((s) => s.id);

  // 3. Fetch Members, Roles & Store Access
  const { data: companyUsers, error: cuError } = await adminClient
    .from("company_users")
    .select(`
      id,
      name,
      email,
      phone,
      company_role,
      is_primary,
      status,
      created_at
    `)
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (cuError) {
    console.error("[getAdminRetailer360Data] Error fetching company_users:", cuError);
  }

  const userIds = (companyUsers || []).map((cu: any) => cu.id);
  let profilesMap: Record<string, any> = {};
  let userRolesMap: Record<string, any> = {};
  let userStoresMap: Record<string, any[]> = {};
  let storeUserCountMap: Record<string, number> = {};

  if (userIds.length > 0) {
    // 3.1 Fetch profiles for display_name
    const { data: profilesData, error: profErr } = await adminClient
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);

    if (profErr) {
      console.warn("[getAdminRetailer360Data] Warning fetching profiles:", profErr);
    } else if (profilesData) {
      profilesData.forEach((p) => {
        profilesMap[p.id] = p;
      });
    }

    // 3.2 Fetch retailer specific roles
    const { data: roles, error: rolesErr } = await adminClient
      .from("retailer_user_roles")
      .select("user_id, role, has_all_stores_access")
      .in("user_id", userIds)
      .eq("company_id", companyId);

    if (rolesErr) {
      console.error("[getAdminRetailer360Data] Error fetching retailer_user_roles:", rolesErr);
    } else if (roles) {
      roles.forEach((r) => {
        userRolesMap[r.user_id] = r;
      });
    }

    // 3.3 Fetch retailer store access assignments
    const { data: storeAccess, error: saErr } = await adminClient
      .from("retailer_user_store_access")
      .select("user_id, store_id, stores(id, name, city)")
      .in("user_id", userIds)
      .eq("company_id", companyId);

    if (saErr) {
      console.error("[getAdminRetailer360Data] Error fetching retailer_user_store_access:", saErr);
    } else if (storeAccess) {
      storeAccess.forEach((sa: any) => {
        if (!userStoresMap[sa.user_id]) userStoresMap[sa.user_id] = [];
        if (sa.stores) {
          userStoresMap[sa.user_id].push(sa.stores);
        }
      });
    }
  }

  const validRoles: RetailerRole[] = ["owner", "buyer", "store_manager", "employee", "accounting"];

  const members: Retailer360MemberItem[] = (companyUsers || []).map((cu: any) => {
    const prof = profilesMap[cu.id];
    const r = userRolesMap[cu.id];

    // Resolve retailer role strictly from retailer_user_roles, fallback to company_role / default
    let resolvedRole: RetailerRole = "employee";
    if (r?.role && validRoles.includes(r.role as RetailerRole)) {
      resolvedRole = r.role as RetailerRole;
    } else if (cu.company_role === "owner" || cu.company_role === "company_admin") {
      resolvedRole = "owner";
    } else if (cu.company_role && validRoles.includes(cu.company_role as RetailerRole)) {
      resolvedRole = cu.company_role as RetailerRole;
    }

    // Evaluate Store Access (has_all_stores_access or role === 'owner')
    const hasAllStoresAccess = resolvedRole === "owner" || Boolean(r?.has_all_stores_access);
    const assignedStores = hasAllStoresAccess
      ? stores.map((s) => ({ id: s.id, name: s.name }))
      : userStoresMap[cu.id] || [];

    return {
      userId: cu.id,
      email: cu.email || "Unknown",
      displayName: prof?.display_name || cu.name || cu.email?.split("@")[0] || "Retailer User",
      role: resolvedRole,
      status: cu.status || "active",
      hasAllStoresAccess,
      assignedStores,
      joinedAt: cu.created_at,
      isPrimary: Boolean(cu.is_primary),
    };
  });

  // Calculate store user count accurately from resolved members access
  stores.forEach((s) => {
    storeUserCountMap[s.id] = members.filter(
      (m) => m.hasAllStoresAccess || m.assignedStores.some((as) => as.id === s.id)
    ).length;
  });

  // 4. Fetch Invitations & Authoritative Company Agreements & Documents
  const [invitationsRes, companyAgreementsRes, rawAcceptancesRes, rawDocsRes] = await Promise.all([
    adminClient
      .from("retailer_invitations")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    adminClient
      .from("company_agreements")
      .select("*, agreement_templates(id, name, version, agreement_type)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    adminClient
      .from("retailer_agreement_acceptances")
      .select("*")
      .eq("company_id", companyId)
      .order("accepted_at", { ascending: false }),
    adminClient
      .from("retailer_documents")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
  ]);

  const invitations: Retailer360InvitationItem[] = invitationsRes.data || [];
  const companyAgreements = companyAgreementsRes.data || [];
  const rawAcceptances = rawAcceptancesRes.data || [];

  const agreements: Retailer360Data["agreements"] = [];

  if (companyAgreements.length > 0) {
    for (const ca of companyAgreements) {
      let signedPdfUrl: string | null = null;
      if (ca.final_pdf_path) {
        const { data: signedData } = await adminClient.storage
          .from("company-uploads")
          .createSignedUrl(ca.final_pdf_path, 3600);
        signedPdfUrl = signedData?.signedUrl || null;
      }

      agreements.push({
        id: ca.id,
        agreement_id: ca.agreement_id,
        agreement_type: ca.agreement_templates?.agreement_type || "RETAILER",
        agreement_version: ca.version || "1.0",
        accepted_name: ca.signer_name || "Authorized Representative",
        signer_title: ca.signer_title || null,
        signer_email: ca.signer_email || null,
        accepted_ip: null,
        accepted_at: ca.signed_at || ca.created_at,
        effective_date: ca.effective_date || null,
        expiration_date: ca.expiration_date || null,
        status: ca.status,
        pdf_status: ca.status === "active" && ca.final_pdf_path ? "generated" : ca.status === "pending" ? "pending" : "failed",
        pdf_storage_path: ca.final_pdf_path,
        pdf_filename: ca.final_pdf_path ? `K_SELECT_Retailer_Agreement_${ca.agreement_id}.pdf` : null,
        pdf_generated_at: ca.signed_at || null,
        pdf_error: null,
        signedPdfUrl,
      });
    }
  } else {
    for (const acc of rawAcceptances) {
      let signedPdfUrl: string | null = null;
      if (acc.pdf_storage_path && acc.pdf_status === "generated") {
        const { data: signedData } = await adminClient.storage
          .from("company-uploads")
          .createSignedUrl(acc.pdf_storage_path, 3600);
        signedPdfUrl = signedData?.signedUrl || null;
      }

      agreements.push({
        id: acc.id,
        agreement_type: acc.agreement_type,
        agreement_version: acc.agreement_version,
        accepted_name: acc.accepted_name,
        signer_title: acc.signer_title,
        signer_email: acc.signer_email,
        accepted_ip: acc.accepted_ip,
        accepted_at: acc.accepted_at,
        pdf_status: acc.pdf_status,
        pdf_storage_path: acc.pdf_storage_path,
        pdf_filename: acc.pdf_filename,
        pdf_generated_at: acc.pdf_generated_at,
        pdf_error: acc.pdf_error,
        signedPdfUrl,
      });
    }
  }

  const documents: NonNullable<Retailer360Data["documents"]> = [];
  for (const doc of rawDocsRes.data || []) {
    let signedUrl: string | null = null;
    if (doc.file_path) {
      const { data: signedData } = await adminClient.storage
        .from("company-uploads")
        .createSignedUrl(doc.file_path, 3600);
      signedUrl = signedData?.signedUrl || null;
    }

    documents.push({
      id: doc.id,
      documentType: doc.document_type || "OTHER",
      title: doc.title || doc.file_name,
      filename: doc.file_name,
      storagePath: doc.file_path,
      mimeType: doc.mime_type || "application/pdf",
      fileSizeBytes: doc.file_size_bytes,
      createdAt: doc.created_at,
      signedUrl,
    });
  }

  // 5. Fetch Retailer Orders & Fulfillments
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

  const orders: Retailer360OrderItem[] = (rawOrders || []).map((o: any) => {
    const oFulfillments = fulfillmentsByOrderId[o.id] || [];
    const items = (o.retailer_order_items || []).map((it: any) => {
      const p = it.products || {};
      const sku = p.letusto_sku || p.manufacture_sku || "KS-SKU";

      let qtyShipped = 0;
      let qtyDelivered = 0;
      oFulfillments
        .filter((f) => f.status === "shipped" || f.status === "delivered")
        .forEach((f) => {
          f.items.forEach((fit: any) => {
            if (fit.orderItemId === it.id) {
              qtyShipped += fit.quantityShipped;
              qtyDelivered += fit.quantityDelivered;
            }
          });
        });

      const qOrdered = Number(it.quantity || 0);
      const qCancelled = Number(it.quantity_cancelled || (o.order_status === "cancelled" ? qOrdered : 0));
      const qRemaining = Math.max(0, qOrdered - qtyShipped - qCancelled);

      return {
        id: it.id,
        productId: it.product_id,
        productName: p.name || "Product",
        productNameEn: p.name_en || null,
        brandName: p.brands?.name || "K SELECT Brand",
        sku,
        quantity: qOrdered,
        unitWholesalePrice: Number(it.unit_wholesale_price || 0),
        lineTotal: Number(it.line_total || 0),
        quantityShipped: qtyShipped,
        quantityDelivered: qtyDelivered,
        quantityCancelled: qCancelled,
        quantityRemaining: qRemaining,
      };
    });

    const totalOrderedUnits = items.reduce((s: number, i: any) => s + i.quantity, 0);
    const totalShippedUnits = items.reduce((s: number, i: any) => s + i.quantityShipped, 0);
    const totalCancelledUnits = items.reduce((s: number, i: any) => s + i.quantityCancelled, 0);
    const authoritativeStatus = computeAuthoritativeOrderStatus(
      o.order_status,
      totalOrderedUnits,
      totalShippedUnits,
      totalCancelledUnits
    );

    return {
      id: o.id,
      orderNumber: o.order_number,
      storeId: o.store_id,
      storeName: o.stores?.name || "Store",
      orderStatus: authoritativeStatus,
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

  // 6. Fetch Weekly Checks & Compute Performance
  const { data: rawWeeklyChecks } = await adminClient
    .from("retailer_weekly_checks")
    .select(`
      id,
      store_id,
      reporting_week,
      report_date,
      status,
      submitted_at,
      stores (
        id,
        name
      ),
      retailer_weekly_check_items (
        id,
        product_id,
        reported_remaining_qty,
        previous_reported_qty,
        delivered_since_previous,
        estimated_movement,
        is_counted,
        retail_price_snapshot,
        retail_price_basis
      )
    `)
    .eq("company_id", companyId)
    .order("report_date", { ascending: false });

  const weeklyChecks = rawWeeklyChecks || [];
  const submittedChecks = weeklyChecks.filter((c) => c.status === "submitted");

  // Map latest check per store
  let latestCheckByStore: Record<string, any> = {};
  weeklyChecks.forEach((wc) => {
    if (!latestCheckByStore[wc.store_id]) {
      latestCheckByStore[wc.store_id] = wc;
    }
  });

  // Compute Performance products metrics using standard formulas
  const { data: rawProducts } = await adminClient
    .from("products")
    .select(`
      id,
      name,
      name_en,
      category,
      category_code,
      brand_id,
      letusto_sku,
      manufacture_sku,
      status,
      estimated_retail_price,
      carton_pack_qty,
      price_additional_info,
      brands (
        id,
        name
      )
    `)
    .eq("status", "selling")
    .order("name", { ascending: true });

  const productsCatalog = rawProducts || [];

  // Group check items by product
  const itemsByProduct: Record<string, any[]> = {};
  submittedChecks.forEach((c) => {
    (c.retailer_weekly_check_items || []).forEach((item: any) => {
      if (!itemsByProduct[item.product_id]) itemsByProduct[item.product_id] = [];
      itemsByProduct[item.product_id].push({
        ...item,
        storeId: c.store_id,
        reportDate: c.report_date,
      });
    });
  });

  let totalEstimatedMovement = 0;
  let totalEstimatedRetailSales = 0;
  let totalEstimatedGrossProfit = 0;
  let productsNeedingReorderCount = 0;

  const performanceProducts: Retailer360PerformanceProduct[] = productsCatalog.map((prod: any) => {
    const sku = resolveEffectiveSku(prod) || "KS-SKU";
    const pItems = itemsByProduct[prod.id] || [];

    // Pricing
    const wholesalePrice = prod.price_additional_info?.wholesale_price || 15;
    const msrp = prod.estimated_retail_price || wholesalePrice * 2;
    const cartonPackQty = prod.carton_pack_qty || 12;

    // Movement & Remaining
    let totalMovement = 0;
    let totalRemaining = 0;
    const storeLatestRemaining: Record<string, number> = {};

    pItems.forEach((it) => {
      totalMovement += Number(it.estimated_movement || 0);
      if (storeLatestRemaining[it.storeId] === undefined && it.reported_remaining_qty !== null) {
        storeLatestRemaining[it.storeId] = Number(it.reported_remaining_qty);
      }
    });

    Object.values(storeLatestRemaining).forEach((qty) => {
      totalRemaining += qty;
    });

    const usableWeeksCount = new Set(pItems.map((it) => it.reportDate)).size;
    const avgWeeklyMovement = usableWeeksCount > 0 ? totalMovement / usableWeeksCount : 0;

    let movementStatus: MovementStatus = "no_data";
    if (usableWeeksCount >= 2) movementStatus = "normal";
    else if (usableWeeksCount === 1) movementStatus = "baseline";

    // Financials
    const estRetailSales = totalMovement * msrp;
    const estGrossProfit = totalMovement * (msrp - wholesalePrice);
    const estGrossMargin = estRetailSales > 0 ? (estGrossProfit / estRetailSales) * 100 : 0;

    totalEstimatedMovement += totalMovement;
    totalEstimatedRetailSales += estRetailSales;
    totalEstimatedGrossProfit += estGrossProfit;

    // Supply & Reorder
    let weeksOfSupply: number | null = null;
    let reorderSignal: ReorderSignal = "insufficient_data";
    let reorderConfidence: ReorderConfidence = "insufficient_data";
    let recommendedOrderUnits = 0;
    let recommendedCartons = 0;

    if (avgWeeklyMovement > 0) {
      weeksOfSupply = Math.round((totalRemaining / avgWeeklyMovement) * 10) / 10;
      if (usableWeeksCount >= 2) {
        reorderConfidence = "recommendation_available";
        if (weeksOfSupply < 2) {
          reorderSignal = "reorder_needed";
          productsNeedingReorderCount++;
          const targetStock = avgWeeklyMovement * TARGET_WEEKS_OF_SUPPLY;
          const deficit = Math.max(0, targetStock - totalRemaining);
          recommendedCartons = Math.ceil(deficit / cartonPackQty);
          recommendedOrderUnits = recommendedCartons * cartonPackQty;
        } else if (weeksOfSupply <= 5) {
          reorderSignal = "sufficient_stock";
        } else {
          reorderSignal = "overstock";
        }
      } else {
        reorderConfidence = "early_signal";
        if (weeksOfSupply < 2) {
          reorderSignal = "reorder_needed";
          productsNeedingReorderCount++;
        } else {
          reorderSignal = "sufficient_stock";
        }
      }
    } else if (usableWeeksCount > 0) {
      reorderSignal = "sufficient_stock";
      reorderConfidence = "early_signal";
    }

    return {
      productId: prod.id,
      productName: prod.name,
      productNameEn: prod.name_en,
      brandName: prod.brands?.name || "K SELECT Brand",
      sku,
      category: prod.category || "General",
      cartonPackQty,
      wholesalePrice,
      msrp,
      totalReportedRemaining: totalRemaining,
      estimatedMovement: totalMovement,
      movementStatus,
      averageWeeklyMovement: Math.round(avgWeeklyMovement * 10) / 10,
      estimatedRetailSales: Math.round(estRetailSales),
      estimatedGrossProfit: Math.round(estGrossProfit),
      estimatedGrossMargin: Math.round(estGrossMargin * 10) / 10,
      currentWeeksOfSupply: weeksOfSupply,
      reorderSignal,
      reorderConfidence,
      recommendedOrderQtyUnits: recommendedOrderUnits,
      recommendedOrderCartons: recommendedCartons,
      approxReorderWholesaleCost: Math.round(recommendedOrderUnits * wholesalePrice),
    };
  });

  const reportingStoresCount = new Set(submittedChecks.map((c) => c.store_id)).size;
  const coveragePercent = stores.length > 0 ? Math.round((reportingStoresCount / stores.length) * 100) : 0;
  const overallGrossMargin = totalEstimatedRetailSales > 0 ? (totalEstimatedGrossProfit / totalEstimatedRetailSales) * 100 : 0;

  const performanceSummary: Retailer360PerformanceSummary = {
    estimatedMovement: totalEstimatedMovement,
    estimatedRetailSales: Math.round(totalEstimatedRetailSales),
    estimatedGrossProfit: Math.round(totalEstimatedGrossProfit),
    estimatedGrossMargin: Math.round(overallGrossMargin * 10) / 10,
    coveragePercent,
    totalStores: stores.length,
    reportingStores: reportingStoresCount,
    productsNeedingReorder: productsNeedingReorderCount,
    products: performanceProducts,
    weeklyCheckHistory: weeklyChecks.map((wc: any) => {
      let mvtSum = 0;
      (wc.retailer_weekly_check_items || []).forEach((it: any) => {
        mvtSum += Number(it.estimated_movement || 0);
      });
      return {
        id: wc.id,
        storeId: wc.store_id,
        storeName: wc.stores?.name || "Store",
        reportingWeek: wc.reporting_week || "-",
        reportDate: wc.report_date,
        status: wc.status,
        itemsCount: (wc.retailer_weekly_check_items || []).length,
        totalMovement: mvtSum,
        submittedAt: wc.submitted_at || wc.report_date,
      };
    }),
  };

  // 7. Fetch Product Training Completion
  const { data: trainingProgress } = await adminClient
    .from("retailer_product_training_progress")
    .select("product_id, user_id, is_completed, completed_at")
    .eq("company_id", companyId)
    .eq("is_completed", true);

  const completedByProduct: Record<string, number> = {};
  (trainingProgress || []).forEach((tp) => {
    completedByProduct[tp.product_id] = (completedByProduct[tp.product_id] || 0) + 1;
  });

  const totalEligibleMembersCount = Math.max(1, members.length);
  const trainingProducts: Retailer360TrainingItem[] = productsCatalog.map((p: any) => {
    const doneCount = completedByProduct[p.id] || 0;
    const pct = Math.min(100, Math.round((doneCount / totalEligibleMembersCount) * 100));
    return {
      productId: p.id,
      productName: p.name,
      productNameEn: p.name_en,
      brandName: p.brands?.name || "K SELECT Brand",
      sku: resolveEffectiveSku(p) || "KS-SKU",
      category: p.category || "General",
      completedUsersCount: doneCount,
      totalEligibleUsersCount: totalEligibleMembersCount,
      completionPercent: pct,
    };
  });

  const totalTrainingItems = trainingProducts.length;
  const avgTrainingPct = totalTrainingItems > 0
    ? Math.round(trainingProducts.reduce((sum, item) => sum + item.completionPercent, 0) / totalTrainingItems)
    : 0;

  // 8. Fetch 90-Day Initial Protection Records & Resolutions
  const { data: rawProtections } = await adminClient
    .from("retailer_initial_trial_protections")
    .select(`
      id,
      product_id,
      store_id,
      trial_start_date,
      trial_end_date,
      protected_quantity,
      status,
      review_requested_at,
      review_notes,
      created_at,
      products (
        id,
        name,
        letusto_sku,
        manufacture_sku,
        brands (
          name
        )
      ),
      stores (
        id,
        name
      ),
      retailer_protection_resolutions (
        id,
        decision,
        approved_credit_amount,
        resolution_notes,
        created_at
      )
    `)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  const protections: Retailer360ProtectionItem[] = (rawProtections || []).map((prot: any) => {
    const p = prot.products || {};
    const res = Array.isArray(prot.retailer_protection_resolutions)
      ? prot.retailer_protection_resolutions[0]
      : prot.retailer_protection_resolutions;

    return {
      id: prot.id,
      productId: prot.product_id,
      productName: p.name || "Product",
      productSku: p.letusto_sku || p.manufacture_sku || "KS-SKU",
      brandName: p.brands?.name || "K SELECT Brand",
      storeId: prot.store_id,
      storeName: prot.stores?.name || "Store",
      trialStartDate: prot.trial_start_date,
      trialEndDate: prot.trial_end_date,
      protectedQuantity: Number(prot.protected_quantity || 0),
      status: prot.status,
      reviewRequestedAt: prot.review_requested_at,
      reviewNotes: prot.review_notes,
      resolutionDecision: res?.decision || null,
      approvedCreditAmount: res?.approved_credit_amount ? Number(res.approved_credit_amount) : null,
      createdAt: prot.created_at,
    };
  });

  // 9. Fetch Retailer Support Cases
  const { data: rawCases } = await adminClient
    .from("partner_inquiries")
    .select(`
      id,
      case_number,
      category,
      title,
      content,
      status,
      is_action_required,
      created_at,
      updated_at,
      stores (
        name
      ),
      retailer_orders (
        order_number
      ),
      products (
        name
      ),
      partner_inquiry_messages (
        id
      )
    `)
    .eq("source_type", "retailer")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  const cases: Retailer360CaseItem[] = (rawCases || []).map((c: any) => ({
    id: c.id,
    caseNumber: c.case_number || "CASE",
    category: c.category,
    title: c.title,
    content: c.content,
    storeName: c.stores?.name || null,
    relatedOrderNumber: c.retailer_orders?.order_number || null,
    relatedProductName: c.products?.name || null,
    status: c.status,
    isActionRequired: Boolean(c.is_action_required),
    messagesCount: (c.partner_inquiry_messages || []).length,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }));

  // 10. Compute Needs Attention Action Center
  const needsAttention: NeedsAttentionItem[] = [];

  // A. Orders awaiting fulfillment
  const pendingOrders = orders.filter(
    (o) => (o.orderStatus === "confirmed" || o.orderStatus === "processing" || o.orderStatus === "paid") &&
      (!o.fulfillments || o.fulfillments.length === 0 || o.fulfillments.some((f) => f.status === "pending"))
  );

  if (pendingOrders.length > 0) {
    needsAttention.push({
      id: "orders-awaiting-fulfillment",
      type: "order_fulfillment",
      title: `${pendingOrders.length} Order(s) Awaiting Fulfillment`,
      description: `Orders #${pendingOrders.map((o) => o.orderNumber).slice(0, 3).join(", ")} require packing or dispatch.`,
      severity: "urgent",
      href: "#orders",
      badge: "Action Required",
    });
  }

  // B. Stores Missing Weekly Check
  const storesMissingCheck = stores.filter((s) => {
    const latest = latestCheckByStore[s.id];
    if (!latest) return true;
    const checkDate = new Date(latest.report_date);
    const diffDays = (Date.now() - checkDate.getTime()) / (1000 * 3600 * 24);
    return diffDays > 10;
  });

  if (storesMissingCheck.length > 0) {
    needsAttention.push({
      id: "stores-missing-check",
      type: "weekly_check",
      title: `${storesMissingCheck.length} Store(s) Missing Weekly Check`,
      description: `Stores: ${storesMissingCheck.map((s) => s.name).slice(0, 3).join(", ")} have not submitted recent inventory counts.`,
      severity: "warning",
      href: "#performance",
      badge: "Reporting Gap",
    });
  }

  // C. Protection Reviews Requested
  const pendingProtectionReviews = protections.filter(
    (p) => p.status === "review_requested" || p.status === "needs_review"
  );

  if (pendingProtectionReviews.length > 0) {
    needsAttention.push({
      id: "protection-reviews-pending",
      type: "protection_review",
      title: `${pendingProtectionReviews.length} Protection Review(s) Requiring Admin Action`,
      description: `Retailer requested 90-day trial review for ${pendingProtectionReviews.map((p) => p.productName).slice(0, 2).join(", ")}.`,
      severity: "urgent",
      href: "/admin/protection-reviews",
      badge: "Review Requested",
    });
  }

  // D. Open Support Cases
  const openCases = cases.filter((c) => c.status !== "closed" && c.status !== "resolved");
  const actionReqCases = openCases.filter((c) => c.isActionRequired || c.status === "action_required" || c.status === "open");

  if (actionReqCases.length > 0) {
    needsAttention.push({
      id: "support-cases-open",
      type: "support_case",
      title: `${actionReqCases.length} Open Support Case(s) Awaiting Response`,
      description: `Inquiries #${actionReqCases.map((c) => c.caseNumber).slice(0, 3).join(", ")} from this retailer are open.`,
      severity: "warning",
      href: "/admin/partner-inquiries",
      badge: "Open Ticket",
    });
  }

  // E. Pending Commercial Terms
  if (profile.terms_status === "pending" || (profile.terms_enabled && !profile.terms_approved_by_admin)) {
    needsAttention.push({
      id: "terms-pending-review",
      type: "terms_review",
      title: "Commercial Terms Review Pending",
      description: `Retailer requested Net Terms / Credit Limit review ($${profile.credit_limit || 0}).`,
      severity: "info",
      href: "#payments",
      badge: "Terms Review",
    });
  }

  // 11. Stores list with assortment & latest check
  const storeItems: Retailer360StoreItem[] = stores.map((s) => {
    const lCheck = latestCheckByStore[s.id];
    return {
      id: s.id,
      name: s.name,
      storeCode: s.store_code || null,
      city: s.city,
      state: s.state,
      zip: s.zip || null,
      address: s.address,
      phone: s.phone,
      email: s.email || null,
      managerName: s.manager_name || null,
      managerPhone: s.manager_phone || null,
      status: s.status || "active",
      assignedUsersCount: storeUserCountMap[s.id] || 0,
      assortmentCount: productsCatalog.length,
      latestWeeklyCheckDate: lCheck?.report_date || null,
      latestWeeklyCheckStatus: lCheck?.status || "missing",
      createdAt: s.created_at,
    };
  });

  // 12. Aggregate Overview Real Metrics & Financial KPIs
  const activeProtectionsCount = protections.filter((p) => p.status === "active").length;

  // Real business orders (exclude cancelled & test orders from real business revenue metrics)
  const nonCancelledOrders = orders.filter((o) => o.orderStatus !== "cancelled");
  const businessOrders = nonCancelledOrders.filter((o) => !o.isTest);
  const testOrders = orders.filter((o) => o.isTest);

  let submittedOrderValue = 0;
  let paidOrderValue = 0;
  let estimatedUnpaidOrderValue = 0;

  const paymentBreakdown: Retailer360PaymentBreakdown = {
    paidCount: 0,
    paidAmount: 0,
    pendingCount: 0,
    pendingAmount: 0,
    unpaidCount: 0,
    unpaidAmount: 0,
    failedCount: 0,
    failedAmount: 0,
  };

  businessOrders.forEach((o) => {
    submittedOrderValue += o.totalAmount;

    const pStatus = (o.paymentStatus || "").toLowerCase();
    if (pStatus === "paid" || pStatus === "settled" || pStatus === "completed") {
      paidOrderValue += o.totalAmount;
      paymentBreakdown.paidCount += 1;
      paymentBreakdown.paidAmount += o.totalAmount;
    } else if (pStatus === "pending" || pStatus === "processing" || pStatus === "authorized") {
      estimatedUnpaidOrderValue += o.totalAmount;
      paymentBreakdown.pendingCount += 1;
      paymentBreakdown.pendingAmount += o.totalAmount;
    } else if (pStatus === "failed" || pStatus === "declined") {
      estimatedUnpaidOrderValue += o.totalAmount;
      paymentBreakdown.failedCount += 1;
      paymentBreakdown.failedAmount += o.totalAmount;
    } else {
      // Default / Net Terms / Unpaid
      estimatedUnpaidOrderValue += o.totalAmount;
      paymentBreakdown.unpaidCount += 1;
      paymentBreakdown.unpaidAmount += o.totalAmount;
    }
  });

  // Calculate total delivered units from fulfillment items
  let totalDeliveredUnits = 0;
  orders.forEach((o) => {
    o.fulfillments.forEach((f) => {
      if (f.status !== "cancelled") {
        f.items.forEach((fit) => {
          totalDeliveredUnits += fit.quantityDelivered;
        });
      }
    });
  });

  const metrics: Retailer360OverviewMetrics = {
    retailerStatus: normalizeRetailerAccountStatus(profile.status),
    totalStoresCount: stores.length,
    activeUsersCount: members.filter((m) => (m.status || "active").toLowerCase() === "active").length,
    pendingInvitesCount: invitations.filter((i) => i.status === "pending").length,
    openOrdersCount: orders.filter((o) => o.orderStatus !== "delivered" && o.orderStatus !== "cancelled").length,
    ordersAwaitingFulfillmentCount: pendingOrders.length,
    totalDeliveredUnits,
    submittedOrderValue: Math.round(submittedOrderValue * 100) / 100,
    submittedOrdersCount: businessOrders.length,
    estimatedUnpaidOrderValue: Math.round(estimatedUnpaidOrderValue * 100) / 100,
    paidOrderValue: Math.round(paidOrderValue * 100) / 100,
    paymentBreakdown: {
      paidCount: paymentBreakdown.paidCount,
      paidAmount: Math.round(paymentBreakdown.paidAmount * 100) / 100,
      pendingCount: paymentBreakdown.pendingCount,
      pendingAmount: Math.round(paymentBreakdown.pendingAmount * 100) / 100,
      unpaidCount: paymentBreakdown.unpaidCount,
      unpaidAmount: Math.round(paymentBreakdown.unpaidAmount * 100) / 100,
      failedCount: paymentBreakdown.failedCount,
      failedAmount: Math.round(paymentBreakdown.failedAmount * 100) / 100,
    },
    testOrdersCount: testOrders.length,
    termsStatus: formatTermsStatusDisplay(profile.terms_status),
    approvedTerms: formatApprovedTermsDisplay(profile.approved_terms || profile.payment_terms),
    creditLimit: Number(profile.credit_limit || 0),
    reportingCoveragePercent: coveragePercent,
    productsNeedingReorderCount,
    trainingCompletionPercent: avgTrainingPct,
    activeProtectionTrialsCount: activeProtectionsCount,
    protectionReviewsActionCount: pendingProtectionReviews.length,
    openSupportCasesCount: openCases.length,
  };

  const { resolveAuthoritativeCompanyCore, resolveEffectiveRetailerBilling } = await import("@/lib/retailer/organization-mapping");
  const companyCore = resolveAuthoritativeCompanyCore(company);
  const billingInfo = resolveEffectiveRetailerBilling(profile, companyCore);

  // Authoritative live AR Status & Shipping Addresses
  let arStatus: RetailerARStatus | undefined;
  try {
    arStatus = await getRetailerARStatus(companyId);
  } catch (arErr) {
    console.warn("Could not load AR status for retailer 360:", arErr);
  }

  let savedShippingAddresses: RetailerShippingAddress[] = [];
  try {
    const { data: addressRows } = await adminClient
      .from("retailer_shipping_addresses")
      .select("*")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("is_default", { ascending: false });

    if (addressRows) {
      savedShippingAddresses = addressRows.map((r: any) => ({
        id: r.id,
        companyId: r.company_id,
        label: r.label,
        recipientName: r.recipient_name,
        attentionName: r.attention_name || null,
        addressLine1: r.address_line1,
        addressLine2: r.address_line2 || null,
        city: r.city,
        state: r.state,
        zip: r.zip,
        country: r.country || "US",
        phone: r.phone || null,
        deliveryNotes: r.delivery_notes || null,
        isDefault: Boolean(r.is_default),
        isActive: Boolean(r.is_active),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    }
  } catch (shipErr) {
    // pending migration / schema fallback
  }

  return {
    company: {
      id: companyCore.id,
      name: companyCore.name,
      companyCode: companyCore.companyCode,
      businessRegistrationNumber: companyCore.businessRegistrationNumber,
      country: companyCore.country,
      status: companyCore.status,
      createdAt: companyCore.createdAt || company.created_at,
      address1: companyCore.address1,
      address2: companyCore.address2,
      city: companyCore.city,
      state: companyCore.state,
      zipCode: companyCore.zipCode,
      formattedHqAddress: companyCore.formattedHqAddress,
      contactName: companyCore.contactName,
      contactPhone: companyCore.contactPhone,
    },
    billing: billingInfo,
    profile,
    needsAttention,
    metrics,
    stores: storeItems,
    members,
    invitations,
    agreements,
    documents,
    orders,
    performance: performanceSummary,
    training: {
      products: trainingProducts,
      overallCompletionPercent: avgTrainingPct,
      totalProductsCount: trainingProducts.length,
    },
    protections,
    cases,
    arStatus,
    shippingAddresses: savedShippingAddresses,
  };
}
