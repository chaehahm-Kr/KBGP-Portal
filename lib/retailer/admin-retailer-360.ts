import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdminSession } from "@/lib/auth/dal";
import { RetailerRole } from "@/lib/retailer/onboarding-types";
import { resolveEffectiveSku } from "@/lib/product/types";
import { formatCategoryName } from "@/lib/retailer/products";
import {
  ReportingPeriod,
  MovementStatus,
  ReorderSignal,
  ReorderConfidence,
  TARGET_WEEKS_OF_SUPPLY,
} from "./performance";

export interface NeedsAttentionItem {
  id: string;
  type: "order_fulfillment" | "weekly_check" | "protection_review" | "support_case" | "terms_review";
  title: string;
  description: string;
  severity: "urgent" | "warning" | "info";
  href: string;
  badge: string;
}

export interface Retailer360OverviewMetrics {
  retailerStatus: string;
  totalStoresCount: number;
  activeUsersCount: number;
  pendingInvitesCount: number;
  openOrdersCount: number;
  ordersAwaitingFulfillmentCount: number;
  termsStatus: string;
  approvedTerms: string;
  creditLimit: number;
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
  city?: string | null;
  state?: string | null;
  address?: string | null;
  phone?: string | null;
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
  hasAllStoresAccess: boolean;
  assignedStores: Array<{ id: string; name: string }>;
  joinedAt: string;
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
    businessRegistrationNumber?: string | null;
    country: string;
    status: string;
    createdAt: string;
  };
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
  };
  needsAttention: NeedsAttentionItem[];
  metrics: Retailer360OverviewMetrics;
  stores: Retailer360StoreItem[];
  members: Retailer360MemberItem[];
  invitations: Retailer360InvitationItem[];
  agreements: Array<{
    id: string;
    agreement_type: string;
    agreement_version: string;
    accepted_name: string;
    accepted_ip?: string | null;
    accepted_at: string;
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
    : company.retailer_profiles || {
        status: company.status || "active",
        payment_terms: "PREPAID_CARD",
        credit_limit: 0,
        payment_method_card_enabled: true,
        payment_method_ach_enabled: true,
        terms_enabled: false,
        approved_terms: "PREPAID",
        terms_status: "not_applied",
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
  let storeUserCountMap: Record<string, number> = {};

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
      if (sa.stores) {
        userStoresMap[sa.user_id].push(sa.stores);
        storeUserCountMap[sa.store_id] = (storeUserCountMap[sa.store_id] || 0) + 1;
      }
    });
  }

  const members: Retailer360MemberItem[] = (companyUsers || []).map((cu: any) => {
    const prof = cu.profiles;
    const r = userRolesMap[cu.user_id];
    const isOwner = r?.role === "owner" || cu.company_role === "owner";
    return {
      userId: cu.user_id,
      email: prof?.email || "Unknown",
      displayName: prof?.display_name || "",
      role: (r?.role || cu.company_role || "employee") as RetailerRole,
      hasAllStoresAccess: isOwner || Boolean(r?.has_all_stores_access),
      assignedStores: isOwner ? stores.map((s) => ({ id: s.id, name: s.name })) : userStoresMap[cu.user_id] || [],
      joinedAt: cu.created_at,
    };
  });

  // 4. Fetch Invitations & Agreements
  const [invitationsRes, agreementsRes] = await Promise.all([
    adminClient
      .from("retailer_invitations")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    adminClient
      .from("retailer_agreement_acceptances")
      .select("*")
      .eq("company_id", companyId)
      .order("accepted_at", { ascending: false }),
  ]);

  const invitations: Retailer360InvitationItem[] = invitationsRes.data || [];
  const agreements = agreementsRes.data || [];

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
  if (profile.terms_status === "pending_review" || (profile.terms_enabled && !profile.terms_approved_by_admin)) {
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
      city: s.city,
      state: s.state,
      address: s.address,
      phone: s.phone,
      status: s.status || "active",
      assignedUsersCount: storeUserCountMap[s.id] || 0,
      assortmentCount: productsCatalog.length,
      latestWeeklyCheckDate: lCheck?.report_date || null,
      latestWeeklyCheckStatus: lCheck?.status || "missing",
      createdAt: s.created_at,
    };
  });

  // 12. Aggregate Overview Real Metrics
  const activeProtectionsCount = protections.filter((p) => p.status === "active").length;

  const metrics: Retailer360OverviewMetrics = {
    retailerStatus: profile.status || company.status || "active",
    totalStoresCount: stores.length,
    activeUsersCount: members.length,
    pendingInvitesCount: invitations.filter((i) => i.status === "pending").length,
    openOrdersCount: orders.filter((o) => o.orderStatus !== "delivered" && o.orderStatus !== "cancelled").length,
    ordersAwaitingFulfillmentCount: pendingOrders.length,
    termsStatus: profile.terms_status || (profile.terms_enabled ? "active" : "prepaid"),
    approvedTerms: profile.approved_terms || profile.payment_terms || "PREPAID_CARD",
    creditLimit: Number(profile.credit_limit || 0),
    reportingCoveragePercent: coveragePercent,
    productsNeedingReorderCount,
    trainingCompletionPercent: avgTrainingPct,
    activeProtectionTrialsCount: activeProtectionsCount,
    protectionReviewsActionCount: pendingProtectionReviews.length,
    openSupportCasesCount: openCases.length,
  };

  return {
    company: {
      id: company.id,
      name: company.name,
      businessRegistrationNumber: company.business_registration_number,
      country: company.country || "US",
      status: company.status || "active",
      createdAt: company.created_at,
    },
    profile,
    needsAttention,
    metrics,
    stores: storeItems,
    members,
    invitations,
    agreements,
    orders,
    performance: performanceSummary,
    training: {
      products: trainingProducts,
      overallCompletionPercent: avgTrainingPct,
      totalProductsCount: trainingProducts.length,
    },
    protections,
    cases,
  };
}
