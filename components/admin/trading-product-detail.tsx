"use client";

import React from "react";
import Link from "next/link";
const ArrowLeftIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

interface ResolvedProduct {
  id: string;
  name: string;
  display_name: string;
  manufacture_sku: string | null;
  letusto_sku: string | null;
  parent_sku: string | null;
  child_sku: string | null;
  category: string;
  brand_id: string;
  company_id: string;
  companyName: string;
  brandName: string;
  photoUrl: string | null;
  selection_status: string;
  sales_status: string;
  category_code: string | null;
  category_full_path: string;
  price_usd_fob: number;
}

interface TradingProductDetailProps {
  product: ResolvedProduct;
}

const SALES_COLORS: Record<string, string> = {
  PREPARING: "bg-zinc-100 text-zinc-650 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  ON_SALE: "bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
  PAUSED: "bg-amber-50 text-amber-700 border-amber-250 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50",
  ENDED: "bg-zinc-250 text-zinc-650 border-zinc-300 dark:bg-zinc-950 dark:text-zinc-500 dark:border-zinc-850",
};

const SALES_LABELS: Record<string, string> = {
  PREPARING: "판매 준비",
  ON_SALE: "판매 중",
  PAUSED: "일시 중지",
  ENDED: "판매 종료",
};

export function TradingProductDetail({ product }: TradingProductDetailProps) {
  return (
    <div className="space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/products/trading"
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
        >
          <span>← 목록으로 돌아가기</span>
        </Link>
      </div>

      {/* Main Operations 360 View Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Product Summary Card (Read-Only) */}
        <div className="lg:col-span-1 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            {/* Header Title */}
            <div>
              <h2 className="text-sm font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Product Summary (Read-Only)</h2>
            </div>

            {/* Thumbnail */}
            <div className="flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-850 p-4 aspect-square max-w-[200px] mx-auto overflow-hidden shadow-sm">
              {product.photoUrl ? (
                <img
                  src={product.photoUrl}
                  alt={product.display_name}
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-zinc-400 dark:text-zinc-500 text-xs font-semibold">대표 이미지 없음</span>
              )}
            </div>

            {/* Fields List */}
            <div className="space-y-3.5 divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
              <div className="pt-3 first:pt-0">
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">제품명 (Name)</span>
                <span className="font-bold text-zinc-900 dark:text-white text-sm block">{product.display_name}</span>
                {product.name !== product.display_name && (
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 block">{product.name}</span>
                )}
              </div>

              <div className="pt-3">
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">Letusto SKU</span>
                <span className="font-mono font-bold text-zinc-955 dark:text-white">
                  {product.letusto_sku || <span className="text-zinc-350 dark:text-zinc-600 italic font-sans font-normal">지정 대기</span>}
                </span>
              </div>

              <div className="pt-3">
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">제조사 SKU (Manufacturer SKU)</span>
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-300">
                  {product.manufacture_sku || <span className="text-zinc-350 dark:text-zinc-600 italic font-sans font-normal">미입력</span>}
                </span>
              </div>

              <div className="pt-3">
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">브랜드 & 공급사</span>
                <div className="font-semibold text-zinc-800 dark:text-zinc-300">
                  {product.brandName} <span className="text-zinc-400 dark:text-zinc-500">|</span> {product.companyName}
                </div>
              </div>

              <div className="pt-3">
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">카테고리 경로</span>
                <span className="font-semibold text-zinc-650 dark:text-zinc-400">{product.category_full_path || "미지정"}</span>
              </div>

              <div className="pt-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1">판매 상태</span>
                  <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold border ${SALES_COLORS[product.sales_status] || SALES_COLORS.PREPARING}`}>
                    {SALES_LABELS[product.sales_status] || SALES_LABELS.PREPARING}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 block mb-1 text-right">FOB 공급가</span>
                  <span className="font-bold text-zinc-900 dark:text-white text-right block">
                    {product.price_usd_fob ? `$${product.price_usd_fob.toFixed(2)}` : "미정"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Link to editable Product Master */}
          <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800">
            <Link
              href={`/admin/products/${product.id}`}
              className="w-full text-center block py-2.5 px-4 bg-zinc-950 hover:bg-zinc-900 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
            >
              Product Master 상세 보기
            </Link>
          </div>
        </div>

        {/* Right Side: Operational Information (Future Modules Placeholders) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Section: Inventory Summary */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-white">물류창고 재고 현황 (Inventory Summary)</h3>
            <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-6 flex flex-col items-center justify-center text-center bg-zinc-50/50 dark:bg-zinc-950/20">
              <span className="text-zinc-400 dark:text-zinc-500 text-xs font-semibold">Inventory module is not connected yet.</span>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-650 mt-1 max-w-sm">
                향후 Inventory 및 Warehouse 설정 기능이 활성화되면 각 물류창고별 실시간 가용 재고(On Hand, Available, Incoming) 수치가 이 영역에 집계됩니다.
              </p>
            </div>
          </div>

          {/* Section: Purchase & Receiving History */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-white">구매 및 입출고 내역 (Purchase / Receiving History)</h3>
            <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-6 flex flex-col items-center justify-center text-center bg-zinc-50/50 dark:bg-zinc-950/20">
              <span className="text-zinc-400 dark:text-zinc-500 text-xs font-semibold">No purchasing or receiving data available yet.</span>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-650 mt-1 max-w-sm">
                실제 발주(Purchase Order) 및 입고 검수(Receiving) 기록이 발생하면 상세 타임라인이 여기에 누적되어 표시됩니다.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Section: Landed Cost Summary */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
              <h3 className="text-sm font-bold text-zinc-800 dark:text-white">원가 구조 정보 (Cost Summary)</h3>
              <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-6 flex flex-col items-center justify-center text-center bg-zinc-50/50 dark:bg-zinc-950/20 min-h-[140px]">
                <span className="text-zinc-400 dark:text-zinc-500 text-xs font-semibold">Actual cost will be available later.</span>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-650 mt-1">
                  입고 시점의 부대 비용 배분(Landed Cost) 및 평균 재고 원가 모델이 적용될 예정입니다.
                </p>
              </div>
            </div>

            {/* Section: Sales Summary */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
              <h3 className="text-sm font-bold text-zinc-800 dark:text-white">판매 실적 요약 (Sales Summary)</h3>
              <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-6 flex flex-col items-center justify-center text-center bg-zinc-50/50 dark:bg-zinc-950/20 min-h-[140px]">
                <span className="text-zinc-400 dark:text-zinc-500 text-xs font-semibold">Connected from Sales & Performance.</span>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-650 mt-1">
                  최근 30일/90일 판매수량 및 연도별 실적이 연동될 예정입니다.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
