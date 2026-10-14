import type { Metadata } from "next";
import Link from "next/link";
import { verifyAdminSession } from "@/lib/auth/dal";
import {
  getAdminDashboardMetrics,
  type PriorityLevel,
  type ActionDomain,
} from "@/lib/admin/dashboard-actions";
import { APPLICATION_STATUS_LABEL, type ApplicationStatus } from "@/lib/application/types";
import { formatEasternDate, formatEasternDateTime } from "@/lib/utils/timezone";

export const metadata: Metadata = {
  title: "통합 운영 대시보드 | K SELECT NETWORK 어드민",
  description: "K SELECT NETWORK Brand & K SELECT HUB Retail 통합 운영 관제 대시보드",
};

export default async function AdminHomePage() {
  await verifyAdminSession();
  const metrics = await getAdminDashboardMetrics();

  // Helper for Order Status Badge
  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case "submitted":
        return {
          label: "신규 접수",
          className:
            "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
        };
      case "processing":
        return {
          label: "처리 중",
          className:
            "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800",
        };
      case "partially_shipped":
        return {
          label: "부분 출고",
          className:
            "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800",
        };
      case "shipped":
        return {
          label: "출고 완료",
          className:
            "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
        };
      case "delivered":
        return {
          label: "배송 완료",
          className:
            "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
        };
      case "cancelled":
        return {
          label: "주문 취소",
          className:
            "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700",
        };
      default:
        return {
          label: status,
          className:
            "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700",
        };
    }
  };

  // Helper for Application Status Badge
  const getApplicationStatusBadge = (status: string) => {
    switch (status) {
      case "submitted":
        return {
          label: APPLICATION_STATUS_LABEL[status as ApplicationStatus] || "신규 접수",
          className:
            "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
        };
      case "assigned":
      case "under_review":
      case "re_review":
        return {
          label: APPLICATION_STATUS_LABEL[status as ApplicationStatus] || "심사 중",
          className:
            "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800",
        };
      case "info_requested":
      case "on_hold":
        return {
          label: APPLICATION_STATUS_LABEL[status as ApplicationStatus] || "보완 대기",
          className:
            "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800",
        };
      case "approved":
      case "partial_approved":
      case "onboarding":
      case "onboarded":
        return {
          label: APPLICATION_STATUS_LABEL[status as ApplicationStatus] || "승인 완료",
          className:
            "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
        };
      case "rejected":
      case "cancelled":
        return {
          label: APPLICATION_STATUS_LABEL[status as ApplicationStatus] || "반려/취소",
          className:
            "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700",
        };
      default:
        return {
          label: APPLICATION_STATUS_LABEL[status as ApplicationStatus] || status,
          className:
            "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700",
        };
    }
  };

  // Helper for Priority Badge
  const getPriorityBadge = (priority: PriorityLevel) => {
    switch (priority) {
      case "critical":
        return {
          label: "CRITICAL",
          className:
            "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800",
        };
      case "high":
        return {
          label: "HIGH",
          className:
            "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800",
        };
      case "medium":
        return {
          label: "MEDIUM",
          className:
            "bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
        };
      case "low":
        return {
          label: "LOW",
          className:
            "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700",
        };
    }
  };

  // Critical Actions (Company-wide urgent exceptions)
  const criticalActions = metrics.priorityActions.filter((a) => a.priority === "critical");

  // Domain-specific action queues (top 3-5 items each, excluding critical actions promoted to strip)
  const hubActions = metrics.priorityActions
    .filter((a) => a.domain === "hub" && a.priority !== "critical")
    .slice(0, 5);

  const networkActions = metrics.priorityActions
    .filter((a) => a.domain === "network" && a.priority !== "critical")
    .slice(0, 5);

  const formattedFreshness = `Production Data · As of ${formatEasternDateTime(metrics.generatedAt)} EDT`;

  return (
    <div className="space-y-6">
      {/* 1. Header with Title and Truthful Data Freshness Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white">
            통합 운영 대시보드
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            K SELECT HUB 리테일 발주·물류 및 K SELECT NETWORK 브랜드 파트너십 통합 관제
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
            <span>{formattedFreshness}</span>
          </span>
        </div>
      </div>

      {/* 2. Common Executive Overview (Full Width — 4 Authoritative Production KPIs) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Retail Order Value — MTD */}
        {metrics.permissions.canAccessExecutiveKPIs ? (
          <Link
            href="/admin/sales/orders"
            className="group block rounded-xl border border-zinc-200 bg-white p-5 shadow-xs transition-all hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Retail Order Value — MTD
              </span>
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 group-hover:underline">
                Orders →
              </span>
            </div>
            <div className="mt-2 text-2xl font-black text-zinc-900 dark:text-white">
              ${metrics.retailOrderValueMTD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
              <span>당월 확정 도매 발주액</span>
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                {metrics.retailOrdersMTDCount}건 확정 (취소·테스트 제외)
              </span>
            </div>
          </Link>
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Retail Order Value — MTD
              </span>
              <span className="text-[10px] font-medium text-zinc-400">접근 제한</span>
            </div>
            <div className="mt-2 text-lg font-bold text-zinc-400 dark:text-zinc-500">
              — — —
            </div>
            <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
              경영진 / Super Admin 전용 지표
            </div>
          </div>
        )}

        {/* KPI 2: Total Open AR */}
        {metrics.permissions.canAccessFinance ? (
          <Link
            href="/admin/finance/receivables"
            className="group block rounded-xl border border-zinc-200 bg-white p-5 shadow-xs transition-all hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Total Open AR (외상매출)
              </span>
              <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 group-hover:underline">
                Finance →
              </span>
            </div>
            <div className="mt-2 text-2xl font-black text-zinc-900 dark:text-white">
              ${metrics.openAR.totalOpenAR.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
              <span>미수금 잔액</span>
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                {metrics.openAR.openInvoiceCount}건 진행 중
              </span>
            </div>
          </Link>
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Total Open AR (외상매출)
              </span>
              <span className="text-[10px] font-medium text-zinc-400">접근 제한</span>
            </div>
            <div className="mt-2 text-lg font-bold text-zinc-400 dark:text-zinc-500">
              — — —
            </div>
            <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
              Finance 회계 담당자 전용 지표
            </div>
          </div>
        )}

        {/* KPI 3: Active Orders (Ready to Ship) */}
        <Link
          href="/admin/sales/orders?quickFilter=ready"
          className="group block rounded-xl border border-zinc-200 bg-white p-5 shadow-xs transition-all hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Active Orders (출고 대기)
            </span>
            <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 group-hover:underline">
              Dispatch →
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-zinc-900 dark:text-white">
            {metrics.activeOrdersSummary.readyToProcess}건 Ready
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
            <span>즉시 출고 준비 건수</span>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              신규 {metrics.activeOrdersSummary.newOrders} · 처리 중 {metrics.activeOrdersSummary.processing}
            </span>
          </div>
        </Link>

        {/* KPI 4: Active Trading Catalog */}
        <Link
          href="/admin/products/trading"
          className="group block rounded-xl border border-zinc-200 bg-white p-5 shadow-xs transition-all hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Trading Catalog (거래 제품)
            </span>
            <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 group-hover:underline">
              Products →
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-zinc-900 dark:text-white">
            {metrics.catalogSummary.activeTrading}개 Active
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
            <span>거래 활성 품목</span>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              HUB 노출 {metrics.catalogSummary.hubPublished}개 · 미검토 {metrics.catalogSummary.unreviewed}개
            </span>
          </div>
        </Link>
      </div>

      {/* 3. Common Critical Action Strip (Full Width — Conditional: Hidden when 0 verified critical exceptions) */}
      {criticalActions.length > 0 && (
        <div className="rounded-xl border border-rose-300 bg-rose-50/70 p-4 shadow-xs dark:border-rose-900/60 dark:bg-rose-950/40">
          <div className="flex items-center justify-between border-b border-rose-200 dark:border-rose-900/60 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-600 animate-pulse shrink-0" />
              <h2 className="text-xs font-bold text-rose-950 dark:text-rose-100 uppercase tracking-wider">
                긴급 조치 과제 (Critical Actions) — 전사 즉시 대응 요망
              </h2>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-200 text-rose-800 dark:bg-rose-900 dark:text-rose-200">
              {criticalActions.length}건 긴급
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {criticalActions.map((action) => (
              <div
                key={action.id}
                className="flex items-center justify-between p-3 rounded-lg bg-white/80 dark:bg-zinc-900/80 border border-rose-200 dark:border-rose-900/50"
              >
                <div>
                  <h3 className="text-xs font-bold text-rose-950 dark:text-rose-200">{action.title}</h3>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">{action.description}</p>
                </div>
                <Link
                  href={action.actionUrl}
                  className="ml-3 shrink-0 px-3 py-1 rounded text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {action.actionLabel}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Two-Column Business Operations Layout (Desktop: 50/50 Side-by-Side, Mobile: Stacked) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ========================================================
            LEFT COLUMN: K SELECT HUB (Retail Operations) — Subtle Blue Accent
            ======================================================== */}
        <div className="rounded-xl border border-blue-200/80 bg-white p-5 shadow-xs dark:border-blue-900/40 dark:bg-zinc-900 space-y-6">
          {/* Column Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-blue-100/70 dark:border-blue-950 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  K SELECT HUB
                </span>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                  리테일 운영 관제 (Retail Operations)
                </h2>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                Orders, Fulfillment & Retail Stores
              </p>
            </div>
            <Link
              href="/admin/sales/orders"
              className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline shrink-0"
            >
              Order Processing 바로가기 →
            </Link>
          </div>

          {/* Subsection A: Retail Action Queue (Top 3-5 Authoritative Records) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                리테일 조치 과제 (Retail Actions)
              </span>
              <span className="text-[10px] font-semibold text-zinc-400">
                {hubActions.length > 0 ? `${hubActions.length}건 대기` : "조치 과제 없음"}
              </span>
            </div>

            {hubActions.length > 0 ? (
              <div className="space-y-2">
                {hubActions.map((action) => {
                  const pBadge = getPriorityBadge(action.priority);
                  return (
                    <div
                      key={action.id}
                      className="p-2.5 rounded-lg border border-zinc-150 bg-zinc-50/60 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/40 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${pBadge.className}`}>
                            {pBadge.label}
                          </span>
                          <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            Admin Action Required
                          </span>
                          <h3 className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                            {action.title}
                          </h3>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-zinc-200/60 dark:border-zinc-800">
                          {action.count !== undefined && (
                            <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                              {action.count}건
                            </span>
                          )}
                          <Link
                            href={action.actionUrl}
                            className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline shrink-0"
                          >
                            {action.actionLabel}
                          </Link>
                        </div>
                      </div>
                      {action.description && (
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 pl-0.5 line-clamp-1">
                          {action.description}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-center rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 text-xs text-zinc-400">
                현재 지연 또는 보류된 리테일 조치 과제가 없습니다.
              </div>
            )}
          </div>

          {/* Subsection B: Retail KPI Summary (2-Tier Hierarchy: Primary 3 Cards + Secondary 5 Compact Tiles) */}
          <div className="space-y-3 pt-2">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
              주문 및 물류 파이프라인 (Order & Dispatch Pipeline)
            </span>

            {/* Tier 1: Primary Operational Signals */}
            <div className="grid grid-cols-3 gap-2.5">
              <Link
                href="/admin/sales/orders?status=submitted"
                className="p-3 rounded-lg bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200/70 dark:border-blue-900/40 hover:border-blue-300 transition-colors"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 block">
                  신규 접수
                </span>
                <div className="text-xl font-black text-blue-900 dark:text-blue-100 mt-0.5">
                  {metrics.activeOrdersSummary.newOrders}건
                </div>
                <span className="text-[10px] text-blue-600/70 dark:text-blue-400/70 block mt-0.5">New Orders</span>
              </Link>

              <Link
                href="/admin/sales/orders?quickFilter=ready"
                className="p-3 rounded-lg bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/70 dark:border-indigo-900/40 hover:border-indigo-300 transition-colors"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 block">
                  출고 준비
                </span>
                <div className="text-xl font-black text-indigo-900 dark:text-indigo-100 mt-0.5">
                  {metrics.activeOrdersSummary.readyToProcess}건
                </div>
                <span className="text-[10px] text-indigo-600/70 dark:text-indigo-400/70 block mt-0.5">Ready to Ship</span>
              </Link>

              <Link
                href="/admin/sales/orders?quickFilter=tracking_missing"
                className={`p-3 rounded-lg border transition-colors ${
                  metrics.activeOrdersSummary.trackingMissing > 0
                    ? "bg-amber-50/60 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800"
                    : "bg-zinc-50 dark:bg-zinc-800/60 border-zinc-150 dark:border-zinc-800"
                }`}
              >
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider block ${
                    metrics.activeOrdersSummary.trackingMissing > 0
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  송장 미등록
                </span>
                <div
                  className={`text-xl font-black mt-0.5 ${
                    metrics.activeOrdersSummary.trackingMissing > 0
                      ? "text-amber-800 dark:text-amber-200"
                      : "text-zinc-800 dark:text-zinc-200"
                  }`}
                >
                  {metrics.activeOrdersSummary.trackingMissing}건
                </div>
                <span
                  className={`text-[10px] block mt-0.5 ${
                    metrics.activeOrdersSummary.trackingMissing > 0
                      ? "text-amber-600/80 dark:text-amber-400/80"
                      : "text-zinc-400"
                  }`}
                >
                  Tracking Needed
                </span>
              </Link>
            </div>

            {/* Tier 2: Secondary Informational Metrics (Compact Row) */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
              <Link
                href="/admin/sales/orders?status=processing"
                className="p-2 rounded bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-150 dark:border-zinc-800 hover:border-indigo-300 transition-colors"
              >
                <span className="text-[9px] font-semibold text-zinc-400 block">처리 중</span>
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{metrics.activeOrdersSummary.processing}건</span>
              </Link>
              <Link
                href="/admin/sales/orders?status=partially_shipped"
                className="p-2 rounded bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-150 dark:border-zinc-800 hover:border-zinc-300 transition-colors"
              >
                <span className="text-[9px] font-semibold text-zinc-400 block">부분 출고</span>
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{metrics.activeOrdersSummary.partiallyShipped}건</span>
              </Link>
              <Link
                href="/admin/sales/orders?quickFilter=on_hold"
                className="p-2 rounded bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-150 dark:border-zinc-800 hover:border-zinc-300 transition-colors"
              >
                <span className="text-[9px] font-semibold text-zinc-400 block">출고 보류</span>
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{metrics.activeOrdersSummary.onHold}건</span>
              </Link>
              <Link
                href="/admin/sales/orders?status=submitted,processing,partially_shipped"
                className="p-2 rounded bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-150 dark:border-zinc-800 hover:border-zinc-300 transition-colors"
              >
                <span className="text-[9px] font-semibold text-zinc-400 block">3일+ 미결</span>
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{metrics.activeOrdersSummary.open3PlusDays}건</span>
              </Link>
              <Link
                href="/admin/sales/orders?status=delivered"
                className="p-2 rounded bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-150 dark:border-zinc-800 hover:border-zinc-300 transition-colors col-span-2 sm:col-span-1"
              >
                <span className="text-[9px] font-semibold text-zinc-400 block">완료 주문</span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{metrics.activeOrdersSummary.completed}건</span>
              </Link>
            </div>

            {/* Context Note */}
            <div className="pt-2 text-[10px] text-zinc-400 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800/80">
              <span>October 2026 · Order Date Basis · Cancelled Excluded</span>
              <span className="font-semibold text-zinc-600 dark:text-zinc-400">Total {metrics.activeOrdersSummary.total}건</span>
            </div>
          </div>

          {/* Subsection C: Recent Retail Orders (Moved inside HUB column) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                최근 리테일 발주 (Recent Orders)
              </span>
              <Link
                href="/admin/sales/orders"
                className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
              >
                전체 주문 보기 →
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs text-zinc-500 dark:text-zinc-400">
                <thead>
                  <tr className="border-b border-zinc-200/80 dark:border-zinc-800 font-bold text-zinc-800 dark:text-zinc-200 h-9">
                    <th className="py-2 pl-0">주문번호</th>
                    <th className="py-2 px-2">발주처 / 매장</th>
                    <th className="py-2 px-2">상태</th>
                    <th className="py-2 px-2 text-right">금액</th>
                    <th className="py-2 pr-0 text-right">접수일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {metrics.recentOrders.slice(0, 5).map((ord) => {
                    const badge = getOrderStatusBadge(ord.orderStatus);
                    return (
                      <tr key={ord.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="py-2.5 pl-0 font-semibold text-zinc-950 dark:text-white">
                          <Link href="/admin/sales/orders" className="hover:underline">
                            {ord.orderNumber}
                          </Link>
                        </td>
                        <td className="py-2.5 px-2">
                          <div className="font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[130px]">
                            {ord.companyName}
                          </div>
                          <div className="text-[10px] text-zinc-400 truncate max-w-[130px]">{ord.storeName}</div>
                        </td>
                        <td className="py-2.5 px-2">
                          <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right font-semibold text-zinc-900 dark:text-white">
                          ${Number(ord.totalAmount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 pr-0 text-right text-[11px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                          {formatEasternDate(ord.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                  {metrics.recentOrders.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-zinc-400 text-xs">
                        접수된 리테일러 발주가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ========================================================
            RIGHT COLUMN: K SELECT NETWORK (Brand & Product Operations) — Subtle Purple Accent
            ======================================================== */}
        <div className="rounded-xl border border-purple-200/80 bg-white p-5 shadow-xs dark:border-purple-900/40 dark:bg-zinc-900 space-y-6">
          {/* Column Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-purple-100/70 dark:border-purple-950 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  K SELECT NETWORK
                </span>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                  브랜드 및 제품 관제 (Brand & Product Operations)
                </h2>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                Applications, Onboarding & Curation
              </p>
            </div>
            <Link
              href="/admin/applications"
              className="text-xs font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 hover:underline shrink-0"
            >
              신청서 관리 바로가기 →
            </Link>
          </div>

          {/* Subsection A: Brand Action Queue (Top 3-5 Authoritative Records) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                브랜드 조치 과제 (Brand Actions)
              </span>
              <span className="text-[10px] font-semibold text-zinc-400">
                {networkActions.length > 0 ? `${networkActions.length}건 대기` : "조치 과제 없음"}
              </span>
            </div>

            {networkActions.length > 0 ? (
              <div className="space-y-2">
                {networkActions.map((action) => {
                  const pBadge = getPriorityBadge(action.priority);
                  const isWaitingForBrand = action.id === "low-waiting-for-brand";
                  return (
                    <div
                      key={action.id}
                      className="p-2.5 rounded-lg border border-zinc-150 bg-zinc-50/60 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/40 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${pBadge.className}`}>
                            {pBadge.label}
                          </span>
                          <span
                            className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              isWaitingForBrand
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                                : "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                            }`}
                          >
                            {isWaitingForBrand ? "Waiting for Brand" : "Admin Action Required"}
                          </span>
                          <h3 className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                            {action.title}
                          </h3>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-zinc-200/60 dark:border-zinc-800">
                          {action.count !== undefined && (
                            <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                              {action.count}건
                            </span>
                          )}
                          <Link
                            href={action.actionUrl}
                            className="text-xs font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 hover:underline shrink-0"
                          >
                            {action.actionLabel}
                          </Link>
                        </div>
                      </div>
                      {action.description && (
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 pl-0.5 line-clamp-1">
                          {action.description}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-center rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 text-xs text-zinc-400">
                현재 대기 중인 브랜드 조치 과제가 없습니다.
              </div>
            )}
          </div>

          {/* Subsection B: Brand & Product KPI Summary (2-Tier Hierarchy: Primary 3 Cards + Secondary 5 Compact Tiles) */}
          <div className="space-y-3 pt-2">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
              파트너십 및 카탈로그 현황 (Partnerships & Catalog)
            </span>

            {/* Tier 1: Primary Operational Signals */}
            <div className="grid grid-cols-3 gap-2.5">
              <Link
                href="/admin/applications?status=submitted"
                className="p-3 rounded-lg bg-purple-50/40 dark:bg-purple-950/20 border border-purple-200/70 dark:border-purple-900/40 hover:border-purple-300 transition-colors"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 block">
                  관리자 심사 대기
                </span>
                <div className="text-xl font-black text-purple-900 dark:text-purple-100 mt-0.5">
                  {metrics.brandOps.pendingAdminReviewCount}건
                </div>
                <span className="text-[10px] text-purple-600/70 dark:text-purple-400/70 block mt-0.5">Admin Review</span>
              </Link>

              <Link
                href="/admin/partner-inquiries"
                className="p-3 rounded-lg bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/70 dark:border-indigo-900/40 hover:border-indigo-300 transition-colors"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 block">
                  미확인 파트너 문의
                </span>
                <div className="text-xl font-black text-indigo-900 dark:text-indigo-100 mt-0.5">
                  {metrics.brandOps.openPartnerInquiriesCount}건
                </div>
                <span className="text-[10px] text-indigo-600/70 dark:text-indigo-400/70 block mt-0.5">Partner Inquiries</span>
              </Link>

              <Link
                href="/admin/products"
                className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-150 dark:border-zinc-800 hover:border-zinc-300 transition-colors"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
                  카탈로그 미검토
                </span>
                <div className="text-xl font-black text-zinc-800 dark:text-zinc-200 mt-0.5">
                  {metrics.catalogSummary.unreviewed}개
                </div>
                <span className="text-[10px] text-zinc-400 block mt-0.5">Selection Review</span>
              </Link>
            </div>

            {/* Tier 2: Secondary Informational Metrics (Compact Row) */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
              <Link
                href="/admin/applications?status=info_requested"
                className="p-2 rounded bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-150 dark:border-zinc-800 hover:border-amber-300 transition-colors"
              >
                <span className="text-[9px] font-semibold text-zinc-400 block">보완 대기</span>
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{metrics.brandOps.waitingForBrandCount}건</span>
              </Link>
              <Link
                href="/admin/brands"
                className="p-2 rounded bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-150 dark:border-zinc-800 hover:border-zinc-300 transition-colors"
              >
                <span className="text-[9px] font-semibold text-zinc-400 block">등록 브랜드</span>
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{metrics.brandOps.totalBrands}개</span>
              </Link>
              <Link
                href="/admin/products/trading"
                className="p-2 rounded bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-150 dark:border-zinc-800 hover:border-purple-300 transition-colors"
              >
                <span className="text-[9px] font-semibold text-zinc-400 block">거래 활성</span>
                <span className="text-xs font-bold text-purple-700 dark:text-purple-300">{metrics.catalogSummary.activeTrading}개</span>
              </Link>
              <Link
                href="/admin/products"
                className="p-2 rounded bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-150 dark:border-zinc-800 hover:border-emerald-300 transition-colors"
              >
                <span className="text-[9px] font-semibold text-zinc-400 block">HUB 노출</span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{metrics.catalogSummary.hubPublished}개</span>
              </Link>
              <Link
                href="/admin/products"
                className="p-2 rounded bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-150 dark:border-zinc-800 hover:border-amber-300 transition-colors col-span-2 sm:col-span-1"
              >
                <span className="text-[9px] font-semibold text-zinc-400 block">규격 누락</span>
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{metrics.catalogSummary.missingRequiredSpecs}개</span>
              </Link>
            </div>

            {/* Context Note */}
            <div className="pt-2 text-[10px] text-zinc-400 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800/80">
              <span>Catalog Grouped under Brand & Product Operations</span>
              <span className="font-semibold text-zinc-600 dark:text-zinc-400">Total {metrics.catalogSummary.totalProducts}개 제품</span>
            </div>
          </div>

          {/* Subsection C: Recent Brand Applications (Moved inside NETWORK column) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                최근 브랜드 신청 (Recent Applications)
              </span>
              <Link
                href="/admin/applications"
                className="text-xs font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 hover:underline"
              >
                전체 신청서 보기 →
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs text-zinc-500 dark:text-zinc-400">
                <thead>
                  <tr className="border-b border-zinc-200/80 dark:border-zinc-800 font-bold text-zinc-800 dark:text-zinc-200 h-9">
                    <th className="py-2 pl-0">신청번호</th>
                    <th className="py-2 px-2">회사명</th>
                    <th className="py-2 px-2">상태</th>
                    <th className="py-2 px-2">접수일</th>
                    <th className="py-2 pr-0 text-right">심사</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {metrics.recentApplications.slice(0, 5).map((app) => {
                    const badge = getApplicationStatusBadge(app.status);
                    return (
                      <tr key={app.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="py-2.5 pl-0 font-semibold text-zinc-950 dark:text-white">
                          <Link href={`/admin/applications/${app.id}`} className="hover:underline">
                            {app.applicationNumber}
                          </Link>
                        </td>
                        <td className="py-2.5 px-2">
                          <div className="font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[130px]">
                            {app.companyName}
                          </div>
                        </td>
                        <td className="py-2.5 px-2">
                          <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-[11px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                          {formatEasternDate(app.submittedAt || app.createdAt)}
                        </td>
                        <td className="py-2.5 pr-0 text-right">
                          <Link
                            href={`/admin/applications/${app.id}`}
                            className="text-xs font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 hover:underline"
                          >
                            심사 →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {metrics.recentApplications.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-zinc-400 text-xs">
                        대기 중인 브랜드 신청서가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Common Finance & Credit Control (Full Width — Exception-Oriented Layout below the Two Business Columns) */}
      {metrics.permissions.canAccessFinance && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                재무 및 채권 관리 (Finance & Accounts Receivable)
              </h2>
              {metrics.openAR.pastDueAmount > 0 ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                  연체 발생
                </span>
              ) : (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
                  정상 정산
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              B3-R1 출고 기반 인보이스 자동 발행 및 B5 취소 연동 authoritative Finance 데이터
            </p>
          </div>
          <Link
            href="/admin/finance/receivables"
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:underline shrink-0"
          >
            외상매출장(Receivables) 상세 →
          </Link>
        </div>

        {/* Financial Exception & Breakdown Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Link
            href="/admin/finance/receivables"
            className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-150 dark:border-zinc-800 hover:border-indigo-300 transition-colors"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">진행 중 인보이스</span>
            <div className="text-lg font-black text-zinc-900 dark:text-white mt-1">
              {metrics.openAR.openInvoiceCount}건
            </div>
            <span className="text-[10px] text-zinc-400 block mt-0.5">
              미수금 ${metrics.openAR.totalOpenAR.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </Link>

          <Link
            href="/admin/finance/receivables"
            className={`p-3 rounded-lg border transition-colors ${
              metrics.openAR.pastDueAmount > 0
                ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40"
                : "bg-zinc-50 dark:bg-zinc-800/60 border-zinc-150 dark:border-zinc-800"
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500">연체액 (Past Due)</span>
            <div className={`text-lg font-black mt-1 ${metrics.openAR.pastDueAmount > 0 ? "text-rose-600 dark:text-rose-400" : "text-zinc-900 dark:text-white"}`}>
              ${metrics.openAR.pastDueAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-zinc-400 block mt-0.5">
              {metrics.openAR.pastDueAmount > 0 ? "기한 초과 미수금" : "연체 없음 (정상)"}
            </span>
          </Link>

          <Link
            href="/admin/finance/receivables"
            className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-150 dark:border-zinc-800 hover:border-amber-300 transition-colors"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">만기 도래 (7 Days)</span>
            <div className="text-lg font-black text-zinc-900 dark:text-white mt-1">
              ${metrics.openAR.dueSoonAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-zinc-400 block mt-0.5">7일 이내 만기 도래</span>
          </Link>

          <Link
            href="/admin/finance/receivables"
            className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-150 dark:border-zinc-800 hover:border-emerald-300 transition-colors"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">결제 완료 인보이스</span>
            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {metrics.openAR.paidInvoiceCount}건
            </div>
            <span className="text-[10px] text-emerald-600/70 block mt-0.5">Settled</span>
          </Link>

          <Link
            href="/admin/finance/receivables"
            className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-150 dark:border-zinc-800 hover:border-zinc-300 transition-colors col-span-2 sm:col-span-1"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">취소/무효 인보이스</span>
            <div className="text-lg font-black text-zinc-600 dark:text-zinc-400 mt-1">
              {metrics.openAR.voidInvoiceCount}건
            </div>
            <span className="text-[10px] text-zinc-400 block mt-0.5">주문취소 연동 Void</span>
          </Link>
        </div>
      </div>
      )}
    </div>
  );
}
