// lib/admin/dashboard-actions.ts
// Authoritative Dashboard V2 Phase 1 Aggregation Service
// Strictly database-backed, zero mock data, zero artificial offsets

"use server";

import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGlobalARSummary } from "@/lib/finance/invoice-actions";
import { getAdminRetailerOrdersAction } from "@/lib/admin/orders-actions";
import { evaluateHubVisibility } from "@/lib/product/hub-visibility";

export type PriorityLevel = "critical" | "high" | "medium" | "low";
export type ActionDomain = "hub" | "network" | "finance";

export interface PriorityActionItem {
  id: string;
  domain: ActionDomain;
  domainLabel: string;
  title: string;
  description: string;
  priority: PriorityLevel;
  count?: number;
  amount?: number;
  actionUrl: string;
  actionLabel: string;
}

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

  // Priority Action Center
  priorityActions: PriorityActionItem[];

  // Server generation timestamp (truthful, non-streaming indicator)
  generatedAt: string;

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
    openInquiriesRes,
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

    // 3. Partner Inquiries (Status: Open)
    adminClient
      .from("partner_inquiries")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),

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

  // Partner Inquiries (Status: Open)
  const openPartnerInquiriesCount = openInquiriesRes.count || 0;

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

  // F. Dynamic Priority Action Center Evaluation (100% Real Production DB records)
  const priorityActions: PriorityActionItem[] = [];

  // CRITICAL 1: Order Cancellation Hold / Review
  const cancellationRequestedOrders = mappedOrders.filter(
    (o) => o.cancellationRequested && !o.isCompleted && o.orderStatus !== "cancelled"
  );
  if (cancellationRequestedOrders.length > 0) {
    priorityActions.push({
      id: "critical-cancellation-requested",
      domain: "hub",
      domainLabel: "K SELECT HUB",
      title: `${cancellationRequestedOrders.length}건의 주문 취소 요청 (출고 보류 및 승인 필요)`,
      description: "리테일러로부터 취소 요청이 접수되어 출고 진행이 보류되었습니다. 취소 승인 및 크레딧 환불 처리가 필요합니다.",
      priority: "critical",
      count: cancellationRequestedOrders.length,
      actionUrl: "/admin/sales/orders?quickFilter=on_hold",
      actionLabel: "보류 주문 처리 →",
    });
  }

  // CRITICAL 2: Overdue Accounts Receivable (Past Due Invoices)
  if (arSummary.totalPastDueAmount > 0) {
    priorityActions.push({
      id: "critical-past-due-ar",
      domain: "finance",
      domainLabel: "Finance",
      title: `연체 인보이스 미수금 발생 ($${arSummary.totalPastDueAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`,
      description: "결제 기한이 경과된 미수금 인보이스가 존재합니다. 리테일러 입금 확인 또는 독촉 조치가 필요합니다.",
      priority: "critical",
      amount: arSummary.totalPastDueAmount,
      actionUrl: "/admin/finance/receivables",
      actionLabel: "연체 인보이스 관리 →",
    });
  }

  // HIGH 1: New Submitted Orders Awaiting Processing
  if (summaryCounters.newOrders > 0) {
    priorityActions.push({
      id: "high-new-orders",
      domain: "hub",
      domainLabel: "K SELECT HUB",
      title: `${summaryCounters.newOrders}건의 신규 주문 접수 (주문 확인 대기)`,
      description: "리테일러가 발주한 신규 주문이 접수되었습니다. 주문 확인 후 물류 피킹 및 패키징을 시작하세요.",
      priority: "high",
      count: summaryCounters.newOrders,
      actionUrl: "/admin/sales/orders?status=submitted",
      actionLabel: "신규 주문 확인 →",
    });
  }

  // HIGH 2: Tracking Needed on Dispatched Orders
  if (summaryCounters.trackingMissing > 0) {
    priorityActions.push({
      id: "high-tracking-needed",
      domain: "hub",
      domainLabel: "K SELECT HUB",
      title: `${summaryCounters.trackingMissing}건의 출고 건 송장(Tracking) 등록 필요`,
      description: "출고 발송 처리가 진행되었으나 택배사 운송장 번호(Tracking #)가 미등록된 건이 있습니다.",
      priority: "high",
      count: summaryCounters.trackingMissing,
      actionUrl: "/admin/sales/orders?quickFilter=tracking_missing",
      actionLabel: "운송장 등록하기 →",
    });
  }

  // HIGH 3: Orders on Fulfillment Hold (Non-cancellation)
  const remainingOnHoldCount = Math.max(0, summaryCounters.onHold - cancellationRequestedOrders.length);
  if (remainingOnHoldCount > 0) {
    priorityActions.push({
      id: "high-fulfillment-hold",
      domain: "hub",
      domainLabel: "K SELECT HUB",
      title: `${remainingOnHoldCount}건의 물류 출고 보류(Hold) 주문`,
      description: "재고 확인 또는 수취지 정보 확인 등의 사유로 출고가 보류된 주문입니다.",
      priority: "high",
      count: remainingOnHoldCount,
      actionUrl: "/admin/sales/orders?quickFilter=on_hold",
      actionLabel: "보류 주문 확인 →",
    });
  }

  // HIGH 4: Aging Orders 7+ Days
  if (open7PlusDays > 0) {
    priorityActions.push({
      id: "high-aging-7plus",
      domain: "hub",
      domainLabel: "K SELECT HUB",
      title: `${open7PlusDays}건의 장기 미출고 주문 (7일 이상 경과)`,
      description: "발주 접수 후 7영업일 이상 출고가 완료되지 않은 장기 미결 주문입니다.",
      priority: "high",
      count: open7PlusDays,
      actionUrl: "/admin/sales/orders?status=submitted,processing,partially_shipped",
      actionLabel: "지연 주문 점검 →",
    });
  }

  // MEDIUM 1: Brand Applications Awaiting Admin Review
  if (pendingAdminReviewCount > 0) {
    priorityActions.push({
      id: "medium-applications-admin-review",
      domain: "network",
      domainLabel: "K SELECT NETWORK",
      title: `${pendingAdminReviewCount}건의 브랜드 입점 신청서 심사 대기`,
      description: "신규 브랜드사에서 제출한 공식 입점 신청서가 접수되었습니다. 적격성 및 서류 검토가 필요합니다.",
      priority: "medium",
      count: pendingAdminReviewCount,
      actionUrl: "/admin/applications?status=submitted",
      actionLabel: "신청서 심사하기 →",
    });
  }

  // MEDIUM 2: Open Partner Inquiries Awaiting Response
  if (openPartnerInquiriesCount > 0) {
    priorityActions.push({
      id: "medium-partner-inquiries",
      domain: "network",
      domainLabel: "K SELECT NETWORK",
      title: `${openPartnerInquiriesCount}건의 미확인 파트너 문의 접수`,
      description: "파트너사의 기술 지원, 입점 및 거래 문의 메시지가 도착했습니다. 신속한 회신이 필요합니다.",
      priority: "medium",
      count: openPartnerInquiriesCount,
      actionUrl: "/admin/partner-inquiries",
      actionLabel: "문의 응대하기 →",
    });
  }

  // MEDIUM 3: Aging Orders 3-6 Days (Precedence deduplication: orders already counted in 7+ days are excluded)
  const agingBetween3and6 = Math.max(0, open3PlusDays - open7PlusDays);
  if (agingBetween3and6 > 0) {
    priorityActions.push({
      id: "medium-aging-3to6",
      domain: "hub",
      domainLabel: "K SELECT HUB",
      title: `${agingBetween3and6}건의 주문 처리 지연 (3~6일 경과)`,
      description: "발주 후 3일 이상 미완료 상태인 주문입니다. 피킹 및 패키징 진행을 점검하세요.",
      priority: "medium",
      count: agingBetween3and6,
      actionUrl: "/admin/sales/orders?status=submitted,processing,partially_shipped",
      actionLabel: "진행 상태 확인 →",
    });
  }

  // LOW 1: Unreviewed Products Awaiting Selection Review
  if (unreviewed > 0) {
    priorityActions.push({
      id: "low-unreviewed-products",
      domain: "network",
      domainLabel: "K SELECT NETWORK",
      title: `${unreviewed}개 제품 입점 선정(Selection) 심사 대기`,
      description: "브랜드사에서 신규 등록한 제품이 카탈로그 심사를 대기하고 있습니다.",
      priority: "low",
      count: unreviewed,
      actionUrl: "/admin/products",
      actionLabel: "카탈로그 검토 →",
    });
  }

  // LOW 2: Missing Required Logistics Specifications
  if (missingRequiredSpecs > 0) {
    priorityActions.push({
      id: "low-missing-specs",
      domain: "network",
      domainLabel: "K SELECT NETWORK",
      title: `${missingRequiredSpecs}개 제품 물류 규격(CBM/중량) 미입력`,
      description: "배송비 산출 및 표준 카톤 포장 계산을 위해 CBM 및 중량 정보 입력이 필요합니다.",
      priority: "low",
      count: missingRequiredSpecs,
      actionUrl: "/admin/products",
      actionLabel: "제품 규격 입력 →",
    });
  }

  // LOW 3: Brand Applications Waiting for Brand Response
  if (waitingForBrandCount > 0) {
    priorityActions.push({
      id: "low-waiting-for-brand",
      domain: "network",
      domainLabel: "K SELECT NETWORK",
      title: `${waitingForBrandCount}건의 신청서 파트너사 보완 자료 회신 대기`,
      description: "추가 서류 또는 정보 보완을 요청한 상태로 브랜드사의 회신을 대기 중입니다.",
      priority: "low",
      count: waitingForBrandCount,
      actionUrl: "/admin/applications?status=info_requested",
      actionLabel: "신청서 상태 확인 →",
    });
  }

  // Sort by priority weights and slice to top 7
  const priorityWeights: Record<PriorityLevel, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  priorityActions.sort((a, b) => priorityWeights[a.priority] - priorityWeights[b.priority]);
  // unconstrained for two-column domain action queues
  const boundedPriorityActions = priorityActions;

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
      openPartnerInquiriesCount: openPartnerInquiriesCount,
    },
    priorityActions: boundedPriorityActions,
    generatedAt: now.toISOString(),
    recentOrders,
    recentApplications,
    pendingPartnerInquiriesCount: openPartnerInquiriesCount,
  };
}
