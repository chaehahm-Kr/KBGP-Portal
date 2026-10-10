"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { ContentProductItem } from "@/lib/product/content-actions";
import { MediaAssetsWorkspace } from "./media-assets-workspace";
import { FaqWorkspace } from "./faq-workspace";

// Native SVG Icons
function ArrowLeftIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

function FileTextIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function BookOpenIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}

function ImageIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function HelpCircleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function MessageSquareIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function QrCodeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
    </svg>
  );
}

function BarChartIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function EyeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function UsersIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function ClockIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function SparklesIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}

function VideoIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function LayersIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}

interface ContentProductDetailProps {
  product: ContentProductItem;
}

type TabType =
  | "customer-pages"
  | "training"
  | "media-assets"
  | "faq"
  | "reviews"
  | "qr-publishing"
  | "analytics";

export function ContentProductDetail({ product }: ContentProductDetailProps) {
  const [activeTab, setActiveTab] = useState<TabType>("customer-pages");

  const tabs: { id: TabType; name: string; labelKo: string; icon: React.ComponentType<{ className?: string }>; badge?: string; badgeColor?: string }[] = [
    {
      id: "customer-pages",
      name: "Customer Pages",
      labelKo: "고객 안내 페이지",
      icon: FileTextIcon,
      badge: product.customer_page_status.toUpperCase(),
      badgeColor:
        product.customer_page_status === "published"
          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
    },
    {
      id: "training",
      name: "Training",
      labelKo: "교육 자료 / SOP",
      icon: BookOpenIcon,
      badge: product.training_status.toUpperCase(),
      badgeColor:
        product.training_status === "ready"
          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400",
    },
    {
      id: "media-assets",
      name: "Media Assets",
      labelKo: "미디어 에셋",
      icon: ImageIcon,
      badge: product.media_status === "complete" ? `COMPLETE (${product.image_count})` : product.media_status.toUpperCase(),
      badgeColor:
        product.media_status === "complete"
          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
    },
    {
      id: "faq",
      name: "FAQ",
      labelKo: "상품 FAQ",
      icon: HelpCircleIcon,
      badge: product.faq_status.toUpperCase(),
      badgeColor: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400",
    },
    {
      id: "reviews",
      name: "Reviews",
      labelKo: "리뷰 및 피드백",
      icon: MessageSquareIcon,
      badge: product.review_status.toUpperCase(),
      badgeColor: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400",
    },
    {
      id: "qr-publishing",
      name: "QR & Publishing",
      labelKo: "QR 코드 및 발행",
      icon: QrCodeIcon,
      badge: product.qr_status.toUpperCase(),
      badgeColor:
        product.qr_status === "live"
          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400",
    },
    {
      id: "analytics",
      name: "Analytics",
      labelKo: "콘텐츠 분석",
      icon: BarChartIcon,
      badge: "READY",
      badgeColor: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Back button */}
      <div>
        <Link
          href="/admin/products/content"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          <span>Back to Content & Training</span>
        </Link>
      </div>

      {/* Product Summary Header Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-850 overflow-hidden shrink-0 flex items-center justify-center">
              {product.photoUrl ? (
                <img
                  src={product.photoUrl}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs font-semibold text-zinc-400">No Image</span>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                  {product.brand_name}
                </span>
                <span className="text-zinc-300 dark:text-zinc-700">•</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {product.category_full_path || product.category}
                </span>
              </div>

              <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {product.name}
              </h1>

              <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 font-mono">
                <span>SKU: <strong className="text-zinc-800 dark:text-zinc-200">{product.letusto_sku || "-"}</strong></span>
                {product.upc && <span>UPC: <strong className="text-zinc-800 dark:text-zinc-200">{product.upc}</strong></span>}
                <span>Last Updated: {product.last_updated}</span>
              </div>
            </div>
          </div>

          {/* Right Status Badges (Read-Only) */}
          <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end gap-2 shrink-0 bg-zinc-50 dark:bg-zinc-850/50 p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Operational:</span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                  product.operational_status === "active"
                    ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                    : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {product.operational_status.toUpperCase()}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Visibility:</span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                  product.visibility === "visible"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                    : "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {product.visibility.toUpperCase()}
              </span>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-zinc-200 dark:border-zinc-750 w-full justify-between md:justify-end">
              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Overall Content:</span>
              <span
                className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${
                  product.overall_status === "published"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : product.overall_status === "ready"
                    ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300"
                    : product.overall_status === "in_progress"
                    ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                    : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {product.overall_status.replace("_", " ").toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 7 Tab Navigation */}
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="flex space-x-1.5 overflow-x-auto pb-px" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 py-2.5 px-3.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                    : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.name}</span>
                <span className="hidden xl:inline text-[10.5px] opacity-70">({tab.labelKo})</span>
                {tab.badge && (
                  <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${tab.badgeColor}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Panels */}
      <div className="mt-6">
        {/* Tab 1: Customer Pages */}
        {activeTab === "customer-pages" && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-zinc-100 dark:border-zinc-800 gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <FileTextIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    Customer Pages (고객 안내 페이지)
                  </h2>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  리테일 매장 QR 스캔 시 소비자가 보게 되는 상품 상세 설명, 특장점, 사용법 페이지를 관리합니다.
                </p>
              </div>
              <span className="px-3 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 shrink-0">
                Module Foundation
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-850 border border-zinc-200/80 dark:border-zinc-750 space-y-2">
                <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">1. Hero & Highlights</div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  대표 썸네일, 제품 핵심 USP, 인증 마크 및 혜택 요약 배너
                </p>
              </div>
              <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-850 border border-zinc-200/80 dark:border-zinc-750 space-y-2">
                <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">2. How to Use & Specs</div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  단계별 권장 사용법, 전성분/소재 상세 규격 및 보관 유의사항
                </p>
              </div>
              <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-850 border border-zinc-200/80 dark:border-zinc-750 space-y-2">
                <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">3. Retailer & Store Info</div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  매장별 프로모션 안내, 추가 구매처 링크 및 브랜드 스토리 연계
                </p>
              </div>
            </div>

            <div className="p-6 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-850/30 flex flex-col items-center justify-center text-center py-10">
              <FileTextIcon className="w-10 h-10 text-zinc-400 mb-3" />
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                Customer Page Visual Builder Framework Ready
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mt-1">
                Visual block editor, multi-language support, and mobile responsive layout customization will be configurable in subsequent task updates.
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: Training */}
        {activeTab === "training" && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-zinc-100 dark:border-zinc-800 gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <BookOpenIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    Training & Staff SOP (교육 자료 및 매장 직원 가이드)
                  </h2>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  리테일 매장 판매 직원 대상 세일즈 포인트, 상담 스크립트, 취급 가이드를 제공합니다.
                </p>
              </div>
              <span className="px-3 py-1 rounded-md text-xs font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 shrink-0">
                Module Foundation
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-850 border border-zinc-200/80 dark:border-zinc-750 space-y-2">
                <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Selling Points & Hooks</div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  고객 방문 시 첫 10초 내 관심을 끄는 3대 차별화 포인트 요약
                </p>
              </div>
              <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-850 border border-zinc-200/80 dark:border-zinc-750 space-y-2">
                <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Customer Objections & Answers</div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  자주 묻는 질문 및 가격/성분 의문에 대한 현장 대응 스크립트
                </p>
              </div>
              <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-850 border border-zinc-200/80 dark:border-zinc-750 space-y-2">
                <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Storage & Handling SOP</div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  매장 진열 조건, 유통기한 관리법 및 파손 방지 지침
                </p>
              </div>
            </div>

            <div className="p-6 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-850/30 flex flex-col items-center justify-center text-center py-10">
              <BookOpenIcon className="w-10 h-10 text-zinc-400 mb-3" />
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                Staff Training Module Framework Ready
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mt-1">
                Interactive quiz, staff onboarding verification, and downloadable PDF cards will be managed in upcoming training updates.
              </p>
            </div>
          </div>
        )}

        {/* Tab 3: Media Assets */}
        {activeTab === "media-assets" && (
          <MediaAssetsWorkspace product={product} />
        )}

        {/* Tab 4: FAQ */}
        {activeTab === "faq" && (
          <FaqWorkspace product={product} />
        )}

        {/* Tab 5: Reviews */}
        {activeTab === "reviews" && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-zinc-100 dark:border-zinc-800 gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <MessageSquareIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    Reviews & Testimonials (리뷰 및 피드백)
                  </h2>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  소비자 실사용 후기, 검증된 구매자 평점, 리테일러 추천사를 선별하여 표시합니다.
                </p>
              </div>
              <span className="px-3 py-1 rounded-md text-xs font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 shrink-0">
                Module Foundation
              </span>
            </div>

            <div className="p-6 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-850/30 flex flex-col items-center justify-center text-center py-10">
              <MessageSquareIcon className="w-10 h-10 text-zinc-400 mb-3" />
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                Review & Curation Framework Ready
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mt-1">
                Featured review highlights, photo reviews moderation, and rating aggregations will be enabled here.
              </p>
            </div>
          </div>
        )}

        {/* Tab 6: QR & Publishing */}
        {activeTab === "qr-publishing" && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-zinc-100 dark:border-zinc-800 gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <QrCodeIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    QR & Publishing (QR 코드 및 발행 관리)
                  </h2>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  동적 QR 코드 생성, 매장용 POP 인쇄물 다운로드, 고객 페이지 실시간 발행을 제어합니다.
                </p>
              </div>
              <span className="px-3 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 shrink-0">
                Module Foundation
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-850 border border-zinc-200/80 dark:border-zinc-750 space-y-2">
                <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Dynamic Short URL & Routing</div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  매장별/캠페인별 UTM 파라미터가 포함된 고유 단축 URL 자동 생성
                </p>
              </div>
              <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-850 border border-zinc-200/80 dark:border-zinc-750 space-y-2">
                <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Print Asset Generator</div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  매장 비치용 아크릴 텐트 카드, 선반 래블(Shelf Talker) 인쇄용 고해상도 PDF/SVG 내보내기
                </p>
              </div>
            </div>

            <div className="p-6 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-850/30 flex flex-col items-center justify-center text-center py-10">
              <QrCodeIcon className="w-10 h-10 text-zinc-400 mb-3" />
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                QR Publishing System Ready
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mt-1">
                High-resolution vector QR code exporter and real-time page publishing toggles will be activated in upcoming releases.
              </p>
            </div>
          </div>
        )}

        {/* Tab 7: Analytics */}
        {activeTab === "analytics" && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-zinc-100 dark:border-zinc-800 gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <BarChartIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    Content Analytics & Performance (콘텐츠 분석 및 성과)
                  </h2>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  소비자 페이지 조회수, QR 스캔수, 매장 직원 교육 이수율 및 전환 기여도를 분석합니다.
                </p>
              </div>
              <span className="px-3 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 shrink-0">
                Module Foundation
              </span>
            </div>

            {/* Metrics preview cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-200/80 dark:border-zinc-750">
                <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                  <span>Total Views</span>
                  <EyeIcon className="w-3.5 h-3.5" />
                </div>
                <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">-</div>
                <div className="text-[11px] text-zinc-400 mt-0.5">Page views</div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-200/80 dark:border-zinc-750">
                <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                  <span>QR Scans</span>
                  <QrCodeIcon className="w-3.5 h-3.5" />
                </div>
                <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">-</div>
                <div className="text-[11px] text-zinc-400 mt-0.5">Store scans</div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-200/80 dark:border-zinc-750">
                <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                  <span>Staff Training</span>
                  <UsersIcon className="w-3.5 h-3.5" />
                </div>
                <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">-</div>
                <div className="text-[11px] text-zinc-400 mt-0.5">Completed SOP</div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-200/80 dark:border-zinc-750">
                <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                  <span>Avg Duration</span>
                  <ClockIcon className="w-3.5 h-3.5" />
                </div>
                <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">-</div>
                <div className="text-[11px] text-zinc-400 mt-0.5">Time on page</div>
              </div>
            </div>

            <div className="p-6 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-850/30 flex flex-col items-center justify-center text-center py-10">
              <BarChartIcon className="w-10 h-10 text-zinc-400 mb-3" />
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                Real-time Analytics Dashboard Framework Ready
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mt-1">
                Store-by-store scanning attribution, conversion funnel tracking, and retention metrics will be active once live traffic commences.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
