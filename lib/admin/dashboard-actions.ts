// lib/admin/dashboard-actions.ts
// Authoritative Dashboard V2 Phase 1 Aggregation Service
// Strictly database-backed, zero mock data, zero artificial offsets

"use server";

import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGlobalARSummary } from "@/lib/finance/invoice-actions";
import { getAdminRetailerOrdersAction } from "@/lib/admin/orders-actions";
import { evaluateHubVisibility } from "@/lib/product/hub-visibility";
import { getPendingPartnerInquiriesCount } from "@/lib/inquiry/actions";

export interface AdminDashboardV2Metrics {
  // Top 4 Executive Core KPIs
  retailOrderValueMTD: number;
  retailOrdersMTDCount: number;
  openAR: {
    totalOpenAR: number;
    openInvoiceCount: number;
    pastDueAmount: number;
    dueSoonAmount: number;
    paidInvoiceCount: number;
    voidInvoiceCount: number;
  };
  activeOrdersSummary: {
    total: number;
    newOrders: number;
    readyToProcess: number;
    processing: number;
    partiallyShipped: number;
    onHold: number;
    trackingMissing: number;
    completed: number;
    open3PlusDays: number;
    open7PlusDays: number;
  };
  catalogSummary: {
    totalProducts: number;
    activeTrading: number;
    hubPublished: number;
    unreviewed: number;
    missingRequiredSpecs: number;
  };

  // Brand Operations Overview
  brandOps: {
    totalApplications: number;
    totalNonDraftApplications: number;
    pendingAdminReviewCount: number;
    waitingForBrandCount: number;
    approvedApplicationsCount: number;
    totalCompanies: number;
    activeCompanies: number;
    totalBrands: number;
    openPartnerInquiriesCount: number;
  };

  // Recent Activity
  recentOrders: {
    id: string;
    orderNumber: string;
    companyName: string;
    storeName: string;
    orderStatus: string;
    totalAmount: number;
    createdAt: string;
  }[];
  recentApplications: {
    id: string;
    applicationNumber: string;
    companyName: string;
    status: string;
    submittedAt: string | null;
    createdAt: string;
  }[];

  // Inquiries Banner
  pendingPartnerInquiriesCount: number;
}

/**
 * Single Authoritative Resolver for Admin Dashboard V2
 * Fetches all operational metrics in parallel using bounded, non-N+1 queries.
 */
export async function getAdminDashboardMetrics(): Promise<AdminDashboardV2Metrics> {
  await verifyAdminSession();
  const adminClient = createAdminClient();

  // Run all authoritative domain queries in parallel
  const [
    arSummary,
    ordersResult,
    pendingInquiriesCount,
    appsRes,
    companiesRes,
    brandsRes,
    productsRes,
    voidInvoicesRes,
    inboundShipmentsRes
  ] = await Promise.all([
    // 1. Finance & Receivables
    getGlobalARSummary(),

    // 2. Retailer Orders & Multi-Box Logistics
    getAdminRetailerOrdersAction(),

    // 3. Partner Inquiries
    getPendingPartnerInquiriesCount(),

    // 4. Brand Applications
    adminClient
      .from("applications")
      .select("id, status, application_number, company_id, created_at, submitted_at")
      .neq("status", "deleted")
      .order("created_at", { ascending: false }),

    // 5. Companies
    adminClient
      .from("companies")
      .select("id, name, status"),

    // 6. Brands
    adminClient
      .from("brands")
      .select("id, name, brand_code"),

    // 7. Products Catalog
    adminClient
      .from("products")
      .select(`
        id,
        name,
        manufacture_sku,
        letusto_sku,
        status,
        selection_status,
        trading_status,
        sales_status,
        retailer_visibility,
        price_additional_info,
        trading_wholesale_price,
        trading_promo_wholesale_price,
        trading_promo_start_date,
        trading_promo_end_date,
        trading_srp_price,
        price_krw_retail,
        estimated_retail_price,
        carton_pack_qty,
        carton_cbm,
        carton_weight,
        item_weight
      `),

    // 8. Void Invoices Count
    adminClient
      .from("retailer_invoices")
      .select("id", { count: "exact", head: true })
      .eq("invoice_status", "void"),

    // 9. Open Inbound Shipments for Hub Visibility restock ETAs
    adminClient
      .from("inbound_shipments")
      .select("id, status, eta, shipment_lines:inbound_shipment_lines(product_id)")
      .not("status", "in", '("CANCELLED","COMPLETED")')
  ]);

  // A. Build company lookup map
  const companies = companiesRes.data || [];
  const companyNameMap = new Map<string, string>(companies.map((c) => [c.id, c.name]));
  const totalCompanies = companies.length;
  const activeCompanies = companies.filter((c) => c.status === "active").length;

  // B. Process Applications
  const applications = appsRes.data || [];
  const totalApplications = applications.length;
  const nonDraftApps = applications.filter((a) => a.status !== "draft");
  const totalNonDraftApplications = nonDraftApps.length;
  const pendingAdminReviewCount = applications.filter((a) =>
    ["submitted", "under_review", "re_review"].includes(a.status)
  ).length;
  const waitingForBrandCount = applications.filter((a) =>
    ["info_requested"].includes(a.status)
  ).length;
  const approvedApplicationsCount = applications.filter((a) =>
    ["approved", "partial_approved"].includes(a.status)
  ).length;

  const recentApplications = nonDraftApps.slice(0, 5).map((a) => ({
    id: a.id,
    applicationNumber: a.application_number,
    companyName: companyNameMap.get(a.company_id) || "미지정",
    status: a.status,
    submittedAt: a.submitted_at || null,
    createdAt: a.created_at,
  }));

  // C. Process Brands
  const brands = brandsRes.data || [];
  const totalBrands = brands.length;

  // D. Process Products & Canonical HUB Visibility
  const products = productsRes.data || [];
  const totalProducts = products.length;

  // Build restock ETA map from inbound shipments
  const restockEtaMap = new Map<string, string>();
  (inboundShipmentsRes.data || []).forEach((s: any) => {
    if (s.eta && s.shipment_lines) {
      s.shipment_lines.forEach((sl: any) => {
        if (sl.product_id) {
          const current = restockEtaMap.get(sl.product_id);
          if (!current || new Date(s.eta) < new Date(current)) {
            restockEtaMap.set(sl.product_id, s.eta);
          }
        }
      });
    }
  });

  let activeTrading = 0;
  let hubPublished = 0;
  let unreviewed = 0;
  let missingRequiredSpecs = 0;

  products.forEach((p) => {
    const tradingStatus =
      p.trading_status || (p.selection_status === "SELECTED" ? "active" : "inactive");
    if (tradingStatus === "active") activeTrading++;
    if (p.selection_status === "UNREVIEWED") unreviewed++;

    // Authoritative Hub Visibility Evaluation
    const eta = restockEtaMap.get(p.id) || null;
    const visEval = evaluateHubVisibility(p, 0, eta);
    if (visEval.effectiveVisibility === "PUBLISHED") {
      hubPublished++;
    }

    // Required logistics specifications check
    const hasMissingSpecs = !p.carton_cbm || !p.carton_weight || !p.item_weight;
    if (hasMissingSpecs) {
      missingRequiredSpecs++;
    }
  });

  // E. Process Retailer Orders & Metrics
  const mappedOrders = ordersResult.orders || [];
  const summaryCounters = ordersResult.summaryCounters || {
    total: 0,
    newOrders: 0,
    readyToProcess: 0,
    partiallyShipped: 0,
    onHold: 0,
    trackingMissing: 0,
    completed: 0,
  };

  // Calculate MTD Wholesale Order Value (only non-cancelled orders)
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();

  let retailOrderValueMTD = 0;
  let retailOrdersMTDCount = 0;
  let open3PlusDays = 0;
  let open7PlusDays = 0;
  let processingCount = 0;

  mappedOrders.forEach((ord) => {
    // Exclude cancelled orders from GMV
    if (ord.orderStatus !== "cancelled") {
      const orderDate = new Date(ord.createdAt);
      if (orderDate.getUTCFullYear() === currentYear && orderDate.getUTCMonth() === currentMonth) {
        retailOrderValueMTD += Number(ord.totalAmount || 0);
        retailOrdersMTDCount++;
      }
    }

    // Count processing orders
    if (ord.orderStatus === "processing") {
      processingCount++;
    }

    // Aging counters for operationally uncompleted orders
    if (!ord.isCompleted && ord.daysOpen !== null) {
      if (ord.daysOpen >= 3) open3PlusDays++;
      if (ord.daysOpen >= 7) open7PlusDays++;
    }
  });

  const recentOrders = mappedOrders.slice(0, 5).map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    companyName: o.companyName,
    storeName: o.storeName,
    orderStatus: o.orderStatus,
    totalAmount: o.totalAmount,
    createdAt: o.createdAt,
  }));

  return {
    retailOrderValueMTD: Math.round(retailOrderValueMTD * 100) / 100,
    retailOrdersMTDCount,
    openAR: {
      totalOpenAR: arSummary.totalOpenAR,
      openInvoiceCount: arSummary.openInvoiceCount,
      pastDueAmount: arSummary.totalPastDueAmount,
      dueSoonAmount: arSummary.totalDueSoonAmount,
      paidInvoiceCount: arSummary.paidInvoiceCount,
      voidInvoiceCount: voidInvoicesRes.count || 0,
    },
    activeOrdersSummary: {
      total: summaryCounters.total,
      newOrders: summaryCounters.newOrders,
      readyToProcess: summaryCounters.readyToProcess,
      processing: processingCount,
      partiallyShipped: summaryCounters.partiallyShipped,
      onHold: summaryCounters.onHold,
      trackingMissing: summaryCounters.trackingMissing,
      completed: summaryCounters.completed,
      open3PlusDays,
      open7PlusDays,
    },
    catalogSummary: {
      totalProducts,
      activeTrading,
      hubPublished,
      unreviewed,
      missingRequiredSpecs,
    },
    brandOps: {
      totalApplications,
      totalNonDraftApplications,
      pendingAdminReviewCount,
      waitingForBrandCount,
      approvedApplicationsCount,
      totalCompanies,
      activeCompanies,
      totalBrands,
      openPartnerInquiriesCount: pendingInquiriesCount,
    },
    recentOrders,
    recentApplications,
    pendingPartnerInquiriesCount: pendingInquiriesCount,
  };
}
