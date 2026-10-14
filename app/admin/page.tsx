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
            "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800",
        };
      case "processing":
        return {
          label: "처리 중",
          className:
            "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
        };
      case "partially_shipped":
        return {
          label: "부분 출고",
          className:
            "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800",
        };
      case "shipped":
        return {
          label: "출고 완료",
          className:
            "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
        };
      case "delivered":
        return {
          label: "배송 완료",
          className:
            "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
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
          className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
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

  // Helper for Domain Tag
  const getDomainTag = (domain: ActionDomain) => {
    switch (domain) {
      case "hub":
        return {
          label: "K SELECT HUB",
          className:
            "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50",
        };
      case "network":
        return {
          label: "K SELECT NETWORK",
          className:
            "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-900/50",
        };
      case "finance":
        return {
          label: "Finance",
          className:
            "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700",
        };
    }
  };

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

      {/* 2. Top 4 Executive KPI Strip (100% Authoritative Production DB) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Retail Order Value — MTD */}
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
              {metrics.retailOrdersMTDCount}건 확정 (취소 제외)
            </span>
          </div>
        </Link>

        {/* KPI 2: Total Open AR */}
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
              {metrics.openAR.openInvoiceCount}건 진행 중 (연체 $0.00)
            </span>
          </div>
        </Link>

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

      {/* 3. Priority Action Center (State-driven Operational Queue) */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                우선 조치 과제 (Priority Action Center)
              </h2>
              {metrics.priorityActions.length > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  {metrics.priorityActions.length}건 활성 조치
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  정상 운영
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              실제 데이터베이스 미결 레코드 기반 실시간 운영 조치 큐 (우선순위 자동 정렬)
            </p>
          </div>
          <div className="text-[11px] text-zinc-400 self-start sm:self-auto">
            정렬 기준: Critical → High → Medium → Low
          </div>
        </div>

        {metrics.priorityActions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {metrics.priorityActions.map((action) => {
              const pBadge = getPriorityBadge(action.priority);
              const dTag = getDomainTag(action.domain);
              return (
                <div
                  key={action.id}
                  className="flex flex-col justify-between rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-4 transition-all hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/40 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/70"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${pBadge.className}`}>
                        {pBadge.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${dTag.className}`}>
                        {dTag.label}
                      </span>
                    </div>
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-white leading-snug">
                      {action.title}
                    </h3>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                      {action.description}
                    </p>
                  </div>
                  <div className="mt-3 pt-3 border-t border-zinc-200/60 dark:border-zinc-800/80 flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-zinc-400">
                      {action.count !== undefined ? `${action.count}건 대상` : action.amount !== undefined ? `$${action.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "조치 대기"}
                    </span>
                    <Link
                      href={action.actionUrl}
                      className="inline-flex items-center text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline cursor-pointer"
                    >
                      {action.actionLabel}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800">
            <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
              현재 조치가 필요한 긴급 작업이 없습니다.
            </span>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
              모든 발주, 출고 및 신청서 심사가 정상적으로 처리되었습니다.
            </p>
          </div>
        )}
      </div>

      {/* 4. Business Section 1: K SELECT HUB (Retail Operations) — Subtle Blue Accent */}
      <div className="rounded-xl border border-blue-200/70 bg-white p-5 shadow-xs dark:border-blue-900/40 dark:bg-zinc-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-blue-100/60 dark:border-blue-950 pb-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                K SELECT HUB · Retail Operations (리테일 발주 및 배송)
              </h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50">
                HUB Retail
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              리테일러 주문 파이프라인, 출고 지시 및 패키징 박스 운송장 상태
            </p>
          </div>
          <Link
            href="/admin/sales/orders"
            className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline shrink-0"
          >
            Order Processing 바로가기 →
          </Link>
        </div>

        {/* Actionable Counters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            href="/admin/sales/orders?status=submitted"
            className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-150 dark:border-zinc-800 hover:border-amber-300 transition-colors"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">신규 주문 (New)</span>
            <div className="text-lg font-black text-zinc-900 dark:text-white mt-1">
              {metrics.activeOrdersSummary.newOrders}건
            </div>
            <span className="text-[10px] text-zinc-400 block mt-0.5">주문 확인 필요</span>
          </Link>

          <Link
            href="/admin/sales/orders?quickFilter=ready"
            className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-150 dark:border-zinc-800 hover:border-blue-300 transition-colors"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">출고 준비 (Ready)</span>
            <div className="text-lg font-black text-zinc-900 dark:text-white mt-1">
              {metrics.activeOrdersSummary.readyToProcess}건
            </div>
            <span className="text-[10px] text-zinc-400 block mt-0.5">즉시 패키징 가능</span>
          </Link>

          <Link
            href="/admin/sales/orders?quickFilter=tracking_missing"
            className={`p-3 rounded-lg border transition-colors ${
              metrics.activeOrdersSummary.trackingMissing > 0
                ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40"
                : "bg-zinc-50 dark:bg-zinc-800/60 border-zinc-150 dark:border-zinc-800"
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">송장 등록 필요</span>
            <div className="text-lg font-black text-amber-600 dark:text-amber-400 mt-1">
              {metrics.activeOrdersSummary.trackingMissing}건
            </div>
            <span className="text-[10px] text-zinc-400 block mt-0.5">Tracking 누락</span>
          </Link>

          <Link
            href="/admin/sales/orders?status=processing"
            className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-150 dark:border-zinc-800 hover:border-indigo-300 transition-colors"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">처리 중 (Processing)</span>
            <div className="text-lg font-black text-zinc-900 dark:text-white mt-1">
              {metrics.activeOrdersSummary.processing}건
            </div>
            <span className="text-[10px] text-zinc-400 block mt-0.5">피킹/검수 진행</span>
          </Link>

          <Link
            href="/admin/sales/orders?status=partially_shipped"
            className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-150 dark:border-zinc-800 hover:border-zinc-300 transition-colors"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">부분 출고</span>
            <div className="text-lg font-black text-zinc-900 dark:text-white mt-1">
              {metrics.activeOrdersSummary.partiallyShipped}건
            </div>
            <span className="text-[10px] text-zinc-400 block mt-0.5">잔여 출고 대기</span>
          </Link>

          <Link
            href="/admin/sales/orders?quickFilter=on_hold"
            className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-150 dark:border-zinc-800 hover:border-zinc-300 transition-colors"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">출고 보류 (Hold)</span>
            <div className="text-lg font-black text-zinc-900 dark:text-white mt-1">
              {metrics.activeOrdersSummary.onHold}건
            </div>
            <span className="text-[10px] text-zinc-400 block mt-0.5">취소/주소 보류</span>
          </Link>

          <Link
            href="/admin/sales/orders?status=submitted,processing,partially_shipped"
            className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-150 dark:border-zinc-800 hover:border-zinc-300 transition-colors"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">3일 이상 미완료</span>
            <div className="text-lg font-black text-zinc-900 dark:text-white mt-1">
              {metrics.activeOrdersSummary.open3PlusDays}건
            </div>
            <span className="text-[10px] text-zinc-400 block mt-0.5">Aging 지연 점검</span>
          </Link>

          <div className="p-3 rounded-lg bg-zinc-50/50 dark:bg-zinc-800/40 border border-zinc-150 dark:border-zinc-800 opacity-80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">완료 주문 (Completed)</span>
            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {metrics.activeOrdersSummary.completed}건
            </div>
            <span className="text-[10px] text-zinc-400 block mt-0.5">배송/취소 종결</span>
          </div>
        </div>

        {/* Compact Retail Order Volume Contextual Strip (Replacing large redundant chart) */}
        <div className="mt-4 pt-3 border-t border-blue-50 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              Retail Order Value · 2026년 10월 MTD:
            </span>
            <span className="font-bold text-zinc-900 dark:text-white">
              ${metrics.retailOrderValueMTD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-zinc-400">
              ({metrics.retailOrdersMTDCount}건 확정 · 발주일자 기준 · 취소 제외)
            </span>
          </div>
          <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
            <span>데이터 신뢰성 정책 준수 (100% 확정 DB 레코드 기준 집계)</span>
          </div>
        </div>
      </div>

      {/* 5. Business Section 2: K SELECT NETWORK (Brand & Product Operations) — Subtle Purple Accent */}
      <div className="rounded-xl border border-purple-200/70 bg-white p-5 shadow-xs dark:border-purple-900/40 dark:bg-zinc-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-purple-100/60 dark:border-purple-950 pb-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                K SELECT NETWORK · Brand & Product Operations (브랜드 및 제품)
              </h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-900/50">
                Brand Network
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              브랜드 입점 신청 심사, 파트너십 및 제품 카탈로그·물류 규격 통합 관리
            </p>
          </div>
          <Link
            href="/admin/applications"
            className="text-xs font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 hover:underline shrink-0"
          >
            신청서 관리 바로가기 →
          </Link>
        </div>

        {/* Group A: Brand Partnerships & Applications */}
        <div className="mb-4">
          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
            입점 신청 및 파트너사 현황 (Brand Applications & Partnerships)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Link
              href="/admin/applications?status=submitted"
              className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 hover:border-blue-300 transition-colors"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">관리자 심사 대기</span>
              <div className="text-lg font-black text-blue-700 dark:text-blue-300 mt-1">
                {metrics.brandOps.pendingAdminReviewCount}건
              </div>
              <span className="text-[10px] text-blue-600/70 block mt-0.5">Admin Action</span>
            </Link>

            <Link
              href="/admin/applications?status=info_requested"
              className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 hover:border-amber-300 transition-colors"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">보완 자료 회신 대기</span>
              <div className="text-lg font-black text-amber-700 dark:text-amber-300 mt-1">
                {metrics.brandOps.waitingForBrandCount}건
              </div>
              <span className="text-[10px] text-amber-600/70 block mt-0.5">Waiting for Brand</span>
            </Link>

            <Link
              href="/admin/partner-inquiries"
              className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-150 dark:border-zinc-800 hover:border-zinc-300 transition-colors"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">오픈 파트너 문의</span>
              <div className="text-lg font-black text-zinc-900 dark:text-white mt-1">
                {metrics.brandOps.openPartnerInquiriesCount}건
              </div>
              <span className="text-[10px] text-zinc-400 block mt-0.5">미응대 문의</span>
            </Link>

            <Link
              href="/admin/brands"
              className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-150 dark:border-zinc-800 hover:border-zinc-300 transition-colors"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">등록 브랜드</span>
              <div className="text-lg font-black text-zinc-900 dark:text-white mt-1">
                {metrics.brandOps.totalBrands}개
              </div>
              <span className="text-[10px] text-zinc-400 block mt-0.5">파트너 브랜드</span>
            </Link>

            <Link
              href="/admin/companies"
              className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-150 dark:border-zinc-800 hover:border-zinc-300 transition-colors"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">활성 입점사</span>
              <div className="text-lg font-black text-zinc-900 dark:text-white mt-1">
                {metrics.brandOps.activeCompanies}개사
              </div>
              <span className="text-[10px] text-zinc-400 block mt-0.5">전체 {metrics.brandOps.totalCompanies}개사</span>
            </Link>

            <Link
              href="/admin/applications"
              className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-150 dark:border-zinc-800 hover:border-zinc-300 transition-colors"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">전체 접수 신청서</span>
              <div className="text-lg font-black text-zinc-900 dark:text-white mt-1">
                {metrics.brandOps.totalNonDraftApplications}건
              </div>
              <span className="text-[10px] text-zinc-400 block mt-0.5">승인 {metrics.brandOps.approvedApplicationsCount}건</span>
            </Link>
          </div>
        </div>

        {/* Group B: Product Catalog & Logistics Specifications (Grouped under Brand Operations) */}
        <div className="pt-3 border-t border-purple-50 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              제품 카탈로그 및 물류 규격 (Product Catalog & Logistics Specs)
            </span>
            <Link
              href="/admin/products/trading"
              className="text-xs font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 hover:underline"
            >
              Trading Products 바로가기 →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Link
              href="/admin/products/trading"
              className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 hover:border-blue-300 transition-colors"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">거래 대상 (Active)</span>
              <div className="text-lg font-black text-blue-700 dark:text-blue-300 mt-1">
                {metrics.catalogSummary.activeTrading}개
              </div>
              <span className="text-[10px] text-blue-600/70 block mt-0.5">Trading Active</span>
            </Link>

            <Link
              href="/admin/products/trading"
              className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 hover:border-emerald-300 transition-colors"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">HUB 공개 (Published)</span>
              <div className="text-lg font-black text-emerald-700 dark:text-emerald-300 mt-1">
                {metrics.catalogSummary.hubPublished}개
              </div>
              <span className="text-[10px] text-emerald-600/70 block mt-0.5">리테일러 구매 가능</span>
            </Link>

            <Link
              href="/admin/products"
              className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-150 dark:border-zinc-800 hover:border-zinc-300 transition-colors"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">입점 미검토 제품</span>
              <div className="text-lg font-black text-zinc-900 dark:text-white mt-1">
                {metrics.catalogSummary.unreviewed}개
              </div>
              <span className="text-[10px] text-zinc-400 block mt-0.5">선정 심사 대기</span>
            </Link>

            <Link
              href="/admin/products"
              className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 hover:border-amber-300 transition-colors"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">물류 스펙 미기입</span>
              <div className="text-lg font-black text-amber-700 dark:text-amber-300 mt-1">
                {metrics.catalogSummary.missingRequiredSpecs}개
              </div>
              <span className="text-[10px] text-amber-600/70 block mt-0.5">CBM/무게 미입력</span>
            </Link>

            <Link
              href="/admin/products"
              className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-150 dark:border-zinc-800 hover:border-zinc-300 transition-colors col-span-2 sm:col-span-1"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">전체 등록 카탈로그</span>
              <div className="text-lg font-black text-zinc-900 dark:text-white mt-1">
                {metrics.catalogSummary.totalProducts}개
              </div>
              <span className="text-[10px] text-zinc-400 block mt-0.5">DB 등록 전체 품목</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 6. Business Section 3: Finance & Credit Control (Neutral with Meaningful Risk Colors) */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                Finance & Credit Control (외상매출 및 정산 관리)
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
              Net Terms 인보이스 미수금, 연체 위험 관리 및 인보이스 결제 상태
            </p>
          </div>
          <Link
            href="/admin/finance/receivables"
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:underline shrink-0"
          >
            Invoices & Receivables 바로가기 →
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

      {/* 7. Recent Activity Section (Clearly Marked: Recent Orders [HUB] vs Recent Applications [NETWORK]) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Column: Recent Retailer Orders (K SELECT HUB) */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                최근 리테일러 발주 (Recent Orders)
              </h2>
              <span className="text-[9px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                K SELECT HUB
              </span>
            </div>
            <Link
              href="/admin/sales/orders"
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            >
              전체보기 →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs text-zinc-500 dark:text-zinc-400">
              <thead>
                <tr className="border-b border-zinc-100 font-bold text-zinc-950 dark:border-zinc-800 dark:text-white">
                  <th className="py-2.5">주문번호</th>
                  <th className="py-2.5">발주처 / 매장</th>
                  <th className="py-2.5">상태</th>
                  <th className="py-2.5 text-right">금액</th>
                  <th className="py-2.5 text-right">발주일시</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
                {metrics.recentOrders.map((ord) => {
                  const badge = getOrderStatusBadge(ord.orderStatus);
                  return (
                    <tr key={ord.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                      <td className="py-3 font-semibold text-zinc-950 dark:text-white">
                        <Link href="/admin/sales/orders" className="hover:underline">
                          {ord.orderNumber}
                        </Link>
                      </td>
                      <td className="py-3">
                        <div className="font-medium text-zinc-800 dark:text-zinc-200">
                          {ord.companyName}
                        </div>
                        <div className="text-[10px] text-zinc-400">{ord.storeName}</div>
                      </td>
                      <td className="py-3">
                        <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3 text-right font-semibold text-zinc-900 dark:text-white">
                        ${Number(ord.totalAmount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 text-right text-[11px]">
                        {formatEasternDate(ord.createdAt)}
                      </td>
                    </tr>
                  );
                })}
                {metrics.recentOrders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-zinc-400">
                      접수된 리테일러 발주가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Recent Brand Applications (K SELECT NETWORK) */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                최근 입점 신청서 (Recent Applications)
              </h2>
              <span className="text-[9px] font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                K SELECT NETWORK
              </span>
            </div>
            <Link
              href="/admin/applications"
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            >
              전체보기 →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs text-zinc-500 dark:text-zinc-400">
              <thead>
                <tr className="border-b border-zinc-100 font-bold text-zinc-950 dark:border-zinc-800 dark:text-white">
                  <th className="py-2.5">신청번호</th>
                  <th className="py-2.5">회사명</th>
                  <th className="py-2.5">상태</th>
                  <th className="py-2.5">신청일</th>
                  <th className="py-2.5 text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
                {metrics.recentApplications.map((app) => (
                  <tr key={app.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                    <td className="py-3 font-semibold text-zinc-950 dark:text-white">
                      {app.applicationNumber}
                    </td>
                    <td className="py-3 font-medium text-zinc-800 dark:text-zinc-200">
                      {app.companyName}
                    </td>
                    <td className="py-3">
                      <span className="inline-block rounded bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        {APPLICATION_STATUS_LABEL[app.status as ApplicationStatus] || app.status}
                      </span>
                    </td>
                    <td className="py-3 text-[11px]">
                      {formatEasternDate(app.submittedAt || app.createdAt)}
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        href={`/admin/applications/${app.id}`}
                        className="font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
                      >
                        심사하기 →
                      </Link>
                    </td>
                  </tr>
                ))}
                {metrics.recentApplications.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-zinc-400">
                      현재 대기중인 신청서가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
