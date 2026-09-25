import type { Metadata } from "next";
import Link from "next/link";
import { verifyPortalSession } from "@/lib/auth/dal";
import { requireCompanyMembership } from "@/lib/company/dal";
import { createClient } from "@/lib/supabase/server";
import { APPLICATION_STATUS_LABEL, type ApplicationStatus } from "@/lib/application/types";
import { getPortalPurchaseOrders, getPortalInvoices } from "@/lib/portal/actions";
import { getPartnerInquiries } from "@/lib/inquiry/actions";
import { getNormalizedStatus, OFFICIAL_STATUS_LABEL } from "@/lib/inquiry/types";
import { OVERALL_STATUS_LABELS, OVERALL_STATUS_COLORS } from "@/lib/purchase-order/status-helper";
import { formatEasternDateTime } from "@/lib/utils/timezone";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "대시보드 | 파트너 포털",
};

export default async function PortalHomePage() {
  const session = await verifyPortalSession();
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  // 1. Fetch Company & User Info
  const { data: companyUser } = await supabase
    .from("company_users")
    .select("company_id, company_role")
    .eq("id", session.userId)
    .single();

  const { data: company } = await supabase
    .from("companies")
    .select("name, intro, country, contact_phone")
    .eq("id", companyId)
    .single();

  // 2. Fetch Applications (Scoped to this company)
  const { data: applications } = await supabase
    .from("applications")
    .select("id, application_number, status, submitted_at, reviewed_at, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  const applicationRows = applications ?? [];
  const latestApp = applicationRows[0] || null;

  // Determine Brand Approval Mode:
  const isApprovedApp = applicationRows.some((a) => a.status === "approved");

  // 3. Fetch Pending Info Requests
  const { data: pendingRequests } = await supabase
    .from("additional_info_requests")
    .select("id, application_id, request_content, reply_due_at, created_at")
    .eq("status", "pending")
    .order("reply_due_at", { ascending: true });

  const pendingRequestRows = pendingRequests ?? [];

  // 4. Fetch Purchase Orders (Canonical source)
  let pos: any[] = [];
  try {
    pos = await getPortalPurchaseOrders();
  } catch (err) {
    console.error("Failed to fetch dashboard POs:", err);
  }

  // 5. Fetch Finance / Invoices (Canonical source)
  let invoices: any[] = [];
  try {
    invoices = await getPortalInvoices();
  } catch (err) {
    console.error("Failed to fetch dashboard invoices:", err);
  }

  // 6. Fetch Support Cases (Canonical source)
  let supportCases: any[] = [];
  try {
    supportCases = await getPartnerInquiries();
  } catch (err) {
    console.error("Failed to fetch dashboard support cases:", err);
  }

  // 7. Fetch Products (Canonical source for company)
  const { data: rawProducts } = await supabase
    .from("products")
    .select("id, name, name_en, category, brand_id, letusto_sku, manufacture_sku, price_krw_retail, price_usd_fob, package_width, package_depth, package_height, package_weight, price_additional_info, origin, upc, ean, selling_online, sales_link_1, selection_status, status, updated_at, created_at")
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false });

  const products = rawProducts ?? [];

  // Determine product completeness
  let activeProductCount = 0;
  let incompleteProductCount = 0;
  const productsWithIssues: any[] = [];

  for (const p of products) {
    const adminOverrides = (p.price_additional_info as any)?.admin_overrides || {};
    const effectiveManufactureSku = adminOverrides.manufacture_sku || p.manufacture_sku || "";

    const missingFields: string[] = [];
    if (!p.brand_id) missingFields.push("브랜드");
    if (!p.category) missingFields.push("카테고리");
    if (!p.name_en?.trim()) missingFields.push("영문 제품명");
    if (!effectiveManufactureSku.trim()) missingFields.push("제조사 SKU");
    if (!p.origin?.trim()) missingFields.push("원산지");
    if (!p.price_krw_retail || Number(p.price_krw_retail) <= 0) missingFields.push("소비자 판매가");
    if (!p.price_usd_fob || Number(p.price_usd_fob) <= 0) missingFields.push("FOB 수출 가격");

    const widthVal = Number(p.package_width || 0);
    const depthVal = Number(p.package_depth || 0);
    const heightVal = Number(p.package_height || 0);
    const weightVal = Number(p.package_weight || 0);
    if (widthVal <= 0 || depthVal <= 0 || heightVal <= 0 || weightVal <= 0) {
      missingFields.push("패키지 규격");
    }

    if (!p.upc?.trim() && !p.ean?.trim()) {
      missingFields.push("바코드");
    }

    if (missingFields.length === 0) {
      activeProductCount++;
    } else {
      incompleteProductCount++;
      productsWithIssues.push({ product: p, missingFields });
    }
  }

  // Determine mode: Operational mode if approved or has any active operational data
  const isOperationalMode = isApprovedApp || pos.length > 0 || invoices.length > 0 || products.length > 0;

  // --- KPI CALCULATIONS ---
  const openPoCount = pos.filter((po) => po.overall_status !== "Completed" && po.overall_status !== "Cancelled").length;
  const readyToShipCount = pos.filter((po) => po.overall_status === "Ready to Ship").length;
  const receivingCount = pos.filter((po) => po.overall_status === "Receiving" || po.overall_status === "Arrived").length;

  const totalInvoiceAmount = invoices.reduce((sum, inv) => sum + (Number(inv.invoiceTotal) || 0), 0);
  const totalPaidAmount = invoices.reduce((sum, inv) => sum + (Number(inv.amountPaid) || 0), 0);
  const totalOutstandingBalance = invoices.reduce((sum, inv) => sum + (Number(inv.balanceDue) || 0), 0);

  const now = new Date();
  const totalOverdueAmount = invoices
    .filter((inv) => (Number(inv.balanceDue) || 0) > 0 && inv.dueDate && new Date(inv.dueDate) < now)
    .reduce((sum, inv) => sum + (Number(inv.balanceDue) || 0), 0);

  const nextDueInvoice = invoices
    .filter((inv) => (Number(inv.balanceDue) || 0) > 0 && inv.dueDate)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0] || null;

  const openCases = supportCases.filter((c) => {
    const norm = getNormalizedStatus(c.status);
    return norm !== "CLOSED";
  });
  const openCaseCount = openCases.length;
  const awaitingBrandCasesCount = supportCases.filter((c) => c.status === "action_required" || c.status === "awaiting_reply" || (c as any).status === "AWAITING_SUPPLIER").length;
  const awaitingLetustoCasesCount = supportCases.filter((c) => {
    const norm = getNormalizedStatus(c.status);
    return norm === "RECEIVED" || norm === "UNDER_REVIEW";
  }).length;
  const closedCasesCount = supportCases.filter((c) => getNormalizedStatus(c.status) === "CLOSED").length;

  // --- ACTION REQUIRED ITEMS ---
  interface ActionRequiredItem {
    id: string;
    priority: "URGENT" | "DUE_SOON" | "NORMAL";
    typeLabel: string;
    referenceNumber: string;
    title: string;
    description: string;
    updatedAt?: string | null;
    href: string;
    actionLabel: string;
  }

  const actionRequiredItems: ActionRequiredItem[] = [];

  // 1. POs awaiting supplier confirmation or shipping
  pos.forEach((po) => {
    if (po.supplier_confirmation_status === "PENDING" || po.supplier_confirmation_status === "UNCONFIRMED") {
      actionRequiredItems.push({
        id: `po-conf-${po.id}`,
        priority: "URGENT",
        typeLabel: "발주서 확인",
        referenceNumber: po.po_number,
        title: `발주서 회신/수락 대기`,
        description: `Letusto에서 발송한 발주서의 단가 및 수량 확인 후 수락이 필요합니다.`,
        updatedAt: po.updated_at || po.created_at,
        href: `/portal/orders/purchase-orders/${po.id}`,
        actionLabel: "발주서 확인",
      });
    } else if (po.overall_status === "Ready to Ship") {
      actionRequiredItems.push({
        id: `po-ship-${po.id}`,
        priority: "DUE_SOON",
        typeLabel: "선적 준비",
        referenceNumber: po.po_number,
        title: `출고 준비 완료 / 패킹서류 필요`,
        description: `생산이 완료되었습니다. 출고 수량 및 패킹 서류를 등록하세요.`,
        updatedAt: po.updated_at || po.created_at,
        href: `/portal/orders/purchase-orders/${po.id}`,
        actionLabel: "출고 정보 등록",
      });
    }
  });

  // 2. Unpaid / Overdue Invoices
  invoices.forEach((inv) => {
    const bal = Number(inv.balanceDue) || 0;
    if (bal > 0) {
      const isOverdue = inv.dueDate && new Date(inv.dueDate) < now;
      actionRequiredItems.push({
        id: `inv-${inv.id}`,
        priority: isOverdue ? "URGENT" : "DUE_SOON",
        typeLabel: "정산 인보이스",
        referenceNumber: inv.supplierInvoiceNumber || inv.internalApNumber || "INV",
        title: isOverdue ? `정산 기한 초과 인보이스` : `미지급 정산 인보이스 잔액`,
        description: `미지급 잔액: $${bal.toLocaleString()} (${inv.dueDate ? `지급기한: ${inv.dueDate}` : "기한 미지정"})`,
        updatedAt: inv.createdAt,
        href: `/portal/finance/${inv.id}`,
        actionLabel: "인보이스 확인",
      });
    }
  });

  // 3. Support cases awaiting supplier response
  supportCases.forEach((c) => {
    if (c.status === "action_required" || c.status === "awaiting_reply" || (c as any).status === "AWAITING_SUPPLIER") {
      actionRequiredItems.push({
        id: `case-${c.id}`,
        priority: "URGENT",
        typeLabel: "1:1 문의 회신",
        referenceNumber: c.case_number || "CASE",
        title: `Letusto 담당자 답변 / 자료 요청 회신 대기`,
        description: c.title,
        updatedAt: c.updated_at,
        href: `/portal/support?case=${c.case_number || c.id}`,
        actionLabel: "답변 작성",
      });
    }
  });

  // 4. Products missing specs
  productsWithIssues.slice(0, 3).forEach((item) => {
    actionRequiredItems.push({
      id: `prod-${item.product.id}`,
      priority: "NORMAL",
      typeLabel: "제품 정보 보완",
      referenceNumber: item.product.letusto_sku || item.product.manufacture_sku || "SKU",
      title: `제품 필수 규격/바코드 보완 필요 (${item.product.name})`,
      description: `누락 항목: ${item.missingFields.join(", ")}`,
      updatedAt: item.product.updated_at,
      href: `/portal/products/${item.product.id}`,
      actionLabel: "제품 정보 수정",
    });
  });

  // 5. Additional Info Requests for Applications
  pendingRequestRows.forEach((req) => {
    actionRequiredItems.push({
      id: `app-req-${req.id}`,
      priority: "URGENT",
      typeLabel: "입점 서류 요청",
      referenceNumber: "APP-REQ",
      title: `입점 심사 추가 서류 요청 회신 대기`,
      description: req.request_content.slice(0, 80),
      updatedAt: req.created_at,
      href: `/portal/applications/${req.application_id}`,
      actionLabel: "서류 제출",
    });
  });

  // Sort Action Required Items by priority
  const priorityOrder = { URGENT: 0, DUE_SOON: 1, NORMAL: 2 };
  actionRequiredItems.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // --- RECENT ACTIVITY FEED ---
  interface ActivityItem {
    id: string;
    timestamp: string;
    type: string;
    title: string;
    description: string;
    href: string;
  }

  const activityFeed: ActivityItem[] = [];

  pos.slice(0, 3).forEach((po) => {
    activityFeed.push({
      id: `act-po-${po.id}`,
      timestamp: po.updated_at || po.created_at,
      type: "발주서",
      title: `발주서 [${po.po_number}] 상태 업데이트`,
      description: `현재 상태: ${OVERALL_STATUS_LABELS[po.overall_status] || po.overall_status}`,
      href: `/portal/orders/purchase-orders/${po.id}`,
    });
  });

  supportCases.slice(0, 3).forEach((c) => {
    activityFeed.push({
      id: `act-case-${c.id}`,
      timestamp: c.updated_at || c.created_at,
      type: "1:1 문의",
      title: `문의 [${c.case_number || "CASE"}] 업데이트: ${c.title}`,
      description: `상태: ${OFFICIAL_STATUS_LABEL[getNormalizedStatus(c.status)]?.ko || c.status}`,
      href: `/portal/support?case=${c.case_number || c.id}`,
    });
  });

  invoices.slice(0, 2).forEach((inv) => {
    activityFeed.push({
      id: `act-inv-${inv.id}`,
      timestamp: inv.createdAt,
      type: "정산",
      title: `인보이스 [${inv.supplierInvoiceNumber || inv.internalApNumber}] 등록`,
      description: `총액: $${(inv.invoiceTotal || 0).toLocaleString()} (지급 잔액: $${(inv.balanceDue || 0).toLocaleString()})`,
      href: `/portal/finance/${inv.id}`,
    });
  });

  activityFeed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const recentActivities = activityFeed.slice(0, 5);

  const formatCurrency = (amount: number | null | undefined, currencyCode: string = "USD") => {
    if (amount === null || amount === undefined || isNaN(amount)) return "$0.00";
    const symbol = currencyCode === "KRW" ? "₩" : "$";
    return `${symbol}${amount.toLocaleString(undefined, {
      minimumFractionDigits: currencyCode === "KRW" ? 0 : 2,
      maximumFractionDigits: currencyCode === "KRW" ? 0 : 2,
    })}`;
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
  };

  return (
    <div className="space-y-6 w-full max-w-7xl pb-10">
      {/* 1. Header: Compact Welcome Banner */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-950 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white">
              안녕하세요, {session.email} 님
            </h1>
            <span className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {companyUser?.company_role === "company_admin" ? "관리자" : "담당자"}
            </span>
            <span
              className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-bold border ${
                isOperationalMode
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                  : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
              }`}
            >
              {isOperationalMode ? "✓ 입점 승인 완료 (Approved)" : "⏳ 심사 진행 중 (Under Review)"}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            소속 기업: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{company?.name || "브랜드 파트너"}</span> · Letusto 브랜드 통합 파트너 포털 운영 대시보드입니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/portal/products/new"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 transition-all"
          >
            <span>+</span> 제품 추가
          </Link>
          <Link
            href="/portal/support"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-700 text-xs font-semibold hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-all"
          >
            💬 1:1 문의
          </Link>
        </div>
      </div>

      {/* ----------------- MODE A: PRE-APPROVAL MODE ----------------- */}
      {!isOperationalMode && (
        <div className="space-y-6">
          {/* Info Requests Alert Banner */}
          {pendingRequestRows.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-950 dark:bg-amber-950/30">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold text-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                <span>회신 대기 중인 추가 제출 서류 요청 {pendingRequestRows.length}건이 있습니다.</span>
              </div>
              <div className="mt-3 space-y-2">
                {pendingRequestRows.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white p-3 text-xs dark:border-amber-900/40 dark:bg-zinc-900">
                    <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                      {r.request_content}
                    </span>
                    <Link
                      href={`/portal/applications/${r.application_id}`}
                      className="px-2.5 py-1 rounded bg-amber-600 text-white font-semibold text-[11px] hover:bg-amber-700"
                    >
                      서류 제출하기 →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pre-Approval Status KPI Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="text-xs text-zinc-500">제출된 신청서</div>
              <div className="text-2xl font-bold mt-1 text-zinc-950 dark:text-white">{applicationRows.length}건</div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">심사 검토 중</div>
              <div className="text-2xl font-bold mt-1 text-blue-700 dark:text-blue-300">
                {applicationRows.filter((a) => a.status === "under_review" || a.status === "submitted").length}건
              </div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">자료 보완 요청</div>
              <div className="text-2xl font-bold mt-1 text-amber-700 dark:text-amber-300">
                {applicationRows.filter((a) => a.status === "info_requested").length}건
              </div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">입점 승인 완료</div>
              <div className="text-2xl font-bold mt-1 text-emerald-700 dark:text-emerald-300">
                {applicationRows.filter((a) => a.status === "approved").length}건
              </div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="text-xs text-rose-600 dark:text-rose-400 font-medium">반려 / 보완 필요</div>
              <div className="text-2xl font-bold mt-1 text-rose-700 dark:text-rose-300">
                {applicationRows.filter((a) => a.status === "rejected").length}건
              </div>
            </div>
          </div>

          {/* Pre-Approval Recent Applications */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
              <h2 className="text-sm font-bold text-zinc-950 dark:text-white">입점 신청 내역</h2>
              <Link href="/portal/applications" className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                전체 보기 →
              </Link>
            </div>
            {applicationRows.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-400">제출된 입점 신청서가 없습니다.</div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-zinc-100 text-zinc-500 dark:border-zinc-800 font-semibold">
                      <th className="py-2.5 px-3">신청 번호</th>
                      <th className="py-2.5 px-3">상태</th>
                      <th className="py-2.5 px-3">제출 일자</th>
                      <th className="py-2.5 px-3 text-center">작업</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {applicationRows.map((app) => (
                      <tr key={app.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                        <td className="py-3 px-3 font-mono font-bold text-zinc-950 dark:text-white">{app.application_number}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            {APPLICATION_STATUS_LABEL[app.status as ApplicationStatus] || app.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-zinc-500 font-mono">{formatDate(app.submitted_at || app.created_at)}</td>
                        <td className="py-3 px-3 text-center">
                          <Link href={`/portal/applications/${app.id}`} className="px-2.5 py-1 rounded bg-zinc-100 text-zinc-800 font-semibold hover:bg-zinc-200">
                            상세 보기
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ----------------- MODE B: OPERATIONAL MODE (APPROVED BRAND) ----------------- */}
      {isOperationalMode && (
        <div className="space-y-6">
          {/* Row 1: 6 Operational KPI Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {/* KPI 1: Active Products */}
            <Link
              href="/portal/products"
              className="group rounded-xl border border-zinc-200 bg-white p-4 shadow-xs transition-all hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
            >
              <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white">
                운영 활성 제품
              </div>
              <div className="mt-1 text-2xl font-bold font-mono text-zinc-950 dark:text-white">
                {activeProductCount}
              </div>
              <div className="mt-1 text-[11px] text-zinc-400">
                전체 {products.length}개 등록
              </div>
            </Link>

            {/* KPI 2: Open Purchase Orders */}
            <Link
              href="/portal/orders/purchase-orders"
              className="group rounded-xl border border-zinc-200 bg-white p-4 shadow-xs transition-all hover:border-amber-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-amber-900/50"
            >
              <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                진행중 발주서
              </div>
              <div className="mt-1 text-2xl font-bold font-mono text-amber-900 dark:text-amber-300">
                {openPoCount}
              </div>
              <div className="mt-1 text-[11px] text-zinc-400">
                미완료/미취소 PO
              </div>
            </Link>

            {/* KPI 3: Ready to Ship */}
            <Link
              href="/portal/orders/purchase-orders"
              className="group rounded-xl border border-zinc-200 bg-white p-4 shadow-xs transition-all hover:border-blue-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-blue-900/50"
            >
              <div className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                선적/출고 대기
              </div>
              <div className="mt-1 text-2xl font-bold font-mono text-blue-900 dark:text-blue-300">
                {readyToShipCount}
              </div>
              <div className="mt-1 text-[11px] text-zinc-400">
                출고 등록 대기건
              </div>
            </Link>

            {/* KPI 4: Receiving */}
            <Link
              href="/portal/orders/purchase-orders"
              className="group rounded-xl border border-zinc-200 bg-white p-4 shadow-xs transition-all hover:border-purple-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-purple-900/50"
            >
              <div className="text-xs font-semibold text-purple-700 dark:text-purple-400">
                입고/검수 진행
              </div>
              <div className="mt-1 text-2xl font-bold font-mono text-purple-900 dark:text-purple-300">
                {receivingCount}
              </div>
              <div className="mt-1 text-[11px] text-zinc-400">
                실물 검수 진행건
              </div>
            </Link>

            {/* KPI 5: Outstanding Balance */}
            <Link
              href="/portal/finance"
              className="group rounded-xl border border-zinc-200 bg-white p-4 shadow-xs transition-all hover:border-rose-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-rose-900/50"
            >
              <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                미지급 정산 잔액
              </div>
              <div className="mt-1 text-xl font-bold font-mono text-zinc-950 dark:text-white truncate">
                {formatCurrency(totalOutstandingBalance)}
              </div>
              <div className="mt-1 text-[11px] text-zinc-400">
                {totalOverdueAmount > 0 ? (
                  <span className="text-rose-600 font-bold">초과: ${totalOverdueAmount.toLocaleString()}</span>
                ) : (
                  "정산 잔액 합계"
                )}
              </div>
            </Link>

            {/* KPI 6: Open Support Cases */}
            <Link
              href="/portal/support"
              className="group rounded-xl border border-zinc-200 bg-white p-4 shadow-xs transition-all hover:border-indigo-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-indigo-900/50"
            >
              <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                진행중 1:1 문의
              </div>
              <div className="mt-1 text-2xl font-bold font-mono text-indigo-900 dark:text-indigo-300">
                {openCaseCount}
              </div>
              <div className="mt-1 text-[11px] text-zinc-400">
                {awaitingBrandCasesCount > 0 ? (
                  <span className="text-amber-600 font-bold">회신 대기 {awaitingBrandCasesCount}건</span>
                ) : (
                  "미완료 케이스"
                )}
              </div>
            </Link>
          </div>

          {/* Row 2: Left 70% Action Required | Right 30% Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 70%: Action Required */}
            <div className="lg:col-span-2 rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-950 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
                    <h2 className="text-base font-bold text-zinc-950 dark:text-white">
                      Action Required — 조치 필요 항목
                    </h2>
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 border border-rose-200">
                      {actionRequiredItems.length}건
                    </span>
                  </div>
                  <span className="text-xs text-zinc-400">우선순위순 표출</span>
                </div>

                {actionRequiredItems.length === 0 ? (
                  <div className="py-10 text-center">
                    <div className="text-2xl">🎉</div>
                    <p className="mt-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      현재 공급사 조치가 필요한 긴급/대기 항목이 없습니다.
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      발주 수락, 인보이스 정산, 1:1 문의 회신 대기건이 발생하면 이곳에 즉시 안내됩니다.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {actionRequiredItems.slice(0, 5).map((item) => {
                      const priorityClasses =
                        item.priority === "URGENT"
                          ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
                          : item.priority === "DUE_SOON"
                          ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                          : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800";

                      return (
                        <div
                          key={item.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-zinc-100 bg-zinc-50/50 hover:bg-zinc-50 dark:border-zinc-800/80 dark:bg-zinc-900/40 dark:hover:bg-zinc-900 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold border shrink-0 mt-0.5 ${priorityClasses}`}>
                              {item.priority === "URGENT" ? "URGENT" : item.priority === "DUE_SOON" ? "DUE SOON" : "NORMAL"}
                            </span>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-bold text-xs text-zinc-950 dark:text-white">
                                  {item.referenceNumber}
                                </span>
                                <span className="text-[11px] text-zinc-500 font-medium">
                                  · {item.typeLabel}
                                </span>
                              </div>
                              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5">
                                {item.title}
                              </p>
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                {item.description}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-200/50 dark:border-zinc-800">
                            {item.updatedAt && (
                              <span className="text-[10px] text-zinc-400 whitespace-nowrap">
                                {formatEasternDateTime(item.updatedAt)}
                              </span>
                            )}
                            <Link
                              href={item.href}
                              className="inline-flex items-center rounded-lg bg-zinc-900 text-white px-3 py-1.5 text-xs font-semibold hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 whitespace-nowrap transition-all"
                            >
                              {item.actionLabel} →
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right 30%: Quick Actions */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-950 flex flex-col justify-between">
              <div>
                <h2 className="text-base font-bold text-zinc-950 dark:text-white border-b border-zinc-100 pb-3 dark:border-zinc-800">
                  빠른 작업 (Quick Actions)
                </h2>
                <div className="mt-4 grid grid-cols-1 gap-2.5">
                  <Link
                    href="/portal/products"
                    className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <span>📦</span>
                      <span>제품 등록 및 관리</span>
                    </div>
                    <span className="text-zinc-400">→</span>
                  </Link>

                  <Link
                    href="/portal/orders/purchase-orders"
                    className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <span>📋</span>
                      <span>발주서 현황 조회</span>
                    </div>
                    <span className="text-zinc-400">→</span>
                  </Link>

                  <Link
                    href="/portal/finance"
                    className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <span>💳</span>
                      <span>정산 & 인보이스 관리</span>
                    </div>
                    <span className="text-zinc-400">→</span>
                  </Link>

                  <Link
                    href="/portal/support"
                    className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <span>💬</span>
                      <span>1:1 문의 등록</span>
                    </div>
                    <span className="text-zinc-400">→</span>
                  </Link>
                </div>
              </div>

              {/* Company Info Box */}
              <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500">
                <div className="font-semibold text-zinc-700 dark:text-zinc-300">
                  {company?.name}
                </div>
                <div className="mt-0.5 text-[11px] text-zinc-400">
                  국가: {company?.country || "대한민국"} · 전화: {company?.contact_phone || "-"}
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Left 65% Recent Purchase Orders | Right 35% Finance Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 65%: Recent Purchase Orders */}
            <div className="lg:col-span-2 rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-950 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
                  <h2 className="text-base font-bold text-zinc-950 dark:text-white">
                    최근 발주서 (Recent Purchase Orders)
                  </h2>
                  <Link
                    href="/portal/orders/purchase-orders"
                    className="text-xs font-semibold text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
                  >
                    전체 발주서 보기 →
                  </Link>
                </div>

                {pos.length === 0 ? (
                  <div className="py-10 text-center text-xs text-zinc-400">
                    등록된 발주서가 없습니다. Letusto에서 발주서가 발행되면 이곳에 표출됩니다.
                  </div>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-zinc-100 text-zinc-500 dark:border-zinc-800 font-semibold uppercase tracking-wider">
                          <th className="py-2.5 px-3 whitespace-nowrap">발주 번호</th>
                          <th className="py-2.5 px-3">대표 상품</th>
                          <th className="py-2.5 px-3 text-right whitespace-nowrap">수량</th>
                          <th className="py-2.5 px-3 text-right whitespace-nowrap">금액</th>
                          <th className="py-2.5 px-3 whitespace-nowrap">진행 상태</th>
                          <th className="py-2.5 px-3 whitespace-nowrap">최근 변경</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {pos.slice(0, 5).map((po) => {
                          const statusColor = OVERALL_STATUS_COLORS[po.overall_status] || "bg-zinc-100 text-zinc-700";
                          return (
                            <tr key={po.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                              <td className="py-3 px-3 font-mono font-bold whitespace-nowrap">
                                <Link
                                  href={`/portal/orders/purchase-orders/${po.id}`}
                                  className="text-zinc-950 dark:text-white hover:text-blue-600 hover:underline"
                                >
                                  {po.po_number}
                                </Link>
                              </td>
                              <td className="py-3 px-3 max-w-[180px] truncate text-zinc-800 dark:text-zinc-200">
                                {po.primary_product_name || "발주 상품"}
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-semibold text-zinc-900 dark:text-white whitespace-nowrap">
                                {(po.total_ordered || 0).toLocaleString()}
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-bold text-zinc-950 dark:text-white whitespace-nowrap">
                                {formatCurrency(po.total_amount, po.currency || "USD")}
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${statusColor}`}>
                                  {OVERALL_STATUS_LABELS[po.overall_status] || po.overall_status}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-zinc-400 text-[11px] whitespace-nowrap">
                                {formatEasternDateTime(po.last_status_update)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Right 35%: Finance Summary */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-950 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
                  <h2 className="text-base font-bold text-zinc-950 dark:text-white">
                    정산 요약 (Finance Summary)
                  </h2>
                  <Link
                    href="/portal/finance"
                    className="text-xs font-semibold text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
                  >
                    정산 상세 →
                  </Link>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-100 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <span className="text-xs text-zinc-500">총 인보이스 발행액</span>
                    <span className="font-mono font-bold text-sm text-zinc-950 dark:text-white">
                      {formatCurrency(totalInvoiceAmount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border border-emerald-100 bg-emerald-50/30 dark:border-emerald-900/30 dark:bg-emerald-950/20">
                    <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">지급 완료 금액</span>
                    <span className="font-mono font-bold text-sm text-emerald-800 dark:text-emerald-300">
                      {formatCurrency(totalPaidAmount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border border-amber-100 bg-amber-50/30 dark:border-amber-900/30 dark:bg-amber-950/20">
                    <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">미지급 잔액</span>
                    <span className="font-mono font-bold text-sm text-amber-800 dark:text-amber-300">
                      {formatCurrency(totalOutstandingBalance)}
                    </span>
                  </div>
                </div>

                {nextDueInvoice && (
                  <div className="mt-4 p-3 rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                      다음 예정 정산
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-zinc-900 dark:text-white">
                        {nextDueInvoice.supplierInvoiceNumber || nextDueInvoice.internalApNumber}
                      </span>
                      <span className="font-mono font-bold text-xs text-rose-600 dark:text-rose-400">
                        ${(nextDueInvoice.balanceDue || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-500">
                      지급 예정일: {nextDueInvoice.dueDate ? formatDate(nextDueInvoice.dueDate) : "미정"}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 4: Left 50% Product Summary | Right 50% Support & Cases */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left 50%: Product Summary */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-950 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
                  <h2 className="text-base font-bold text-zinc-950 dark:text-white">
                    제품 현황 (Product Operational Summary)
                  </h2>
                  <Link
                    href="/portal/products"
                    className="text-xs font-semibold text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
                  >
                    전체 제품 보기 →
                  </Link>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-lg border border-zinc-100 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <div className="text-[11px] text-zinc-500">전체 등록 제품</div>
                    <div className="text-lg font-bold font-mono text-zinc-950 dark:text-white mt-0.5">{products.length}개</div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-emerald-100 bg-emerald-50/30 dark:border-emerald-900/30 dark:bg-emerald-950/20">
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">활성 거래 제품</div>
                    <div className="text-lg font-bold font-mono text-emerald-800 dark:text-emerald-300 mt-0.5">{activeProductCount}개</div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-amber-100 bg-amber-50/30 dark:border-amber-900/30 dark:bg-amber-950/20">
                    <div className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">정보 보완 필요</div>
                    <div className="text-lg font-bold font-mono text-amber-800 dark:text-amber-300 mt-0.5">{incompleteProductCount}개</div>
                  </div>
                </div>

                {products.length > 0 && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-zinc-100 text-zinc-500 dark:border-zinc-800 font-semibold">
                          <th className="py-2 px-2">제품명</th>
                          <th className="py-2 px-2">SKU</th>
                          <th className="py-2 px-2">상태</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {products.slice(0, 3).map((p) => (
                          <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                            <td className="py-2.5 px-2 font-medium text-zinc-900 dark:text-white max-w-[180px] truncate">
                              <Link href={`/portal/products/${p.id}`} className="hover:underline">
                                {p.name}
                              </Link>
                            </td>
                            <td className="py-2.5 px-2 font-mono text-zinc-500">{p.letusto_sku || p.manufacture_sku || "-"}</td>
                            <td className="py-2.5 px-2">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                {p.selection_status === "SELECTED" ? "거래 선정" : "등록됨"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Right 50%: Support & Cases */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-950 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
                  <h2 className="text-base font-bold text-zinc-950 dark:text-white">
                    1:1 문의 현황 (Support & Cases)
                  </h2>
                  <Link
                    href="/portal/support"
                    className="text-xs font-semibold text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
                  >
                    전체 문의 보기 →
                  </Link>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 rounded-lg border border-zinc-100 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <div className="text-[10px] text-zinc-500">진행 케이스</div>
                    <div className="text-base font-bold font-mono text-zinc-950 dark:text-white mt-0.5">{openCaseCount}건</div>
                  </div>
                  <div className="p-2 rounded-lg border border-amber-100 bg-amber-50/30 dark:border-amber-900/30 dark:bg-amber-950/20">
                    <div className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">공급사 회신대기</div>
                    <div className="text-base font-bold font-mono text-amber-800 dark:text-amber-300 mt-0.5">{awaitingBrandCasesCount}건</div>
                  </div>
                  <div className="p-2 rounded-lg border border-blue-100 bg-blue-50/30 dark:border-blue-900/30 dark:bg-blue-950/20">
                    <div className="text-[10px] text-blue-700 dark:text-blue-400 font-medium">Letusto 검토중</div>
                    <div className="text-base font-bold font-mono text-blue-800 dark:text-blue-300 mt-0.5">{awaitingLetustoCasesCount}건</div>
                  </div>
                  <div className="p-2 rounded-lg border border-emerald-100 bg-emerald-50/30 dark:border-emerald-900/30 dark:bg-emerald-950/20">
                    <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">종료된 문의</div>
                    <div className="text-base font-bold font-mono text-emerald-800 dark:text-emerald-300 mt-0.5">{closedCasesCount}건</div>
                  </div>
                </div>

                {supportCases.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {supportCases.slice(0, 3).map((c) => {
                      const norm = getNormalizedStatus(c.status);
                      const statusObj = OFFICIAL_STATUS_LABEL[norm] || { ko: c.status, en: c.status };
                      return (
                        <div key={c.id} className="p-2.5 rounded-lg border border-zinc-100 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50 flex items-center justify-between gap-2 text-xs">
                          <div>
                            <div className="flex items-center gap-1.5 font-mono font-bold text-zinc-950 dark:text-white">
                              <span>{c.case_number || "CASE"}</span>
                              <span className="text-[10px] font-normal text-zinc-400">· {c.category}</span>
                            </div>
                            <div className="text-zinc-700 dark:text-zinc-300 font-medium truncate max-w-[220px] mt-0.5">
                              <Link href={`/portal/support?case=${c.case_number || c.id}`} className="hover:underline">
                                {c.title}
                              </Link>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 shrink-0">
                            {statusObj.ko}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 5: Recent Activity Feed */}
          {recentActivities.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="text-base font-bold text-zinc-950 dark:text-white border-b border-zinc-100 pb-3 dark:border-zinc-800">
                최근 운영 활동 (Recent Activity)
              </h2>
              <div className="mt-3 space-y-2.5">
                {recentActivities.map((act) => (
                  <div key={act.id} className="flex items-center justify-between gap-4 p-2.5 rounded-lg border border-zinc-100 bg-zinc-50/40 text-xs dark:border-zinc-800/80 dark:bg-zinc-900/30">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 shrink-0">
                        {act.type}
                      </span>
                      <div>
                        <span className="font-semibold text-zinc-900 dark:text-white">{act.title}</span>
                        <span className="text-zinc-500 ml-2">{act.description}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] text-zinc-400 font-mono">{formatEasternDateTime(act.timestamp)}</span>
                      <Link href={act.href} className="text-zinc-500 hover:text-zinc-900 font-semibold">
                        →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom: Compact Onboarding / Application Reference Card */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-base">🏢</span>
              <div>
                <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span>K SELECT NETWORK 입점 신청 참조</span>
                  {latestApp && (
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                      {latestApp.application_number}
                    </span>
                  )}
                </div>
                <div className="text-zinc-500 mt-0.5">
                  입점 상태: <span className="font-semibold text-emerald-700 dark:text-emerald-400">최종 승인 완료 (Approved)</span> · 제출일: {latestApp ? formatDate(latestApp.submitted_at || latestApp.created_at) : "-"}
                </div>
              </div>
            </div>

            <Link
              href="/portal/applications"
              className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-1.5 font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 whitespace-nowrap"
            >
              입점 신청서 내역 보기 →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
