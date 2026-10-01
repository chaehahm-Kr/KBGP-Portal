"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandActionButtons } from "@/components/brand/brand-action-buttons";

export interface BrandItemResolved {
  id: string;
  name: string;
  introText: string | null;
  logoUrl: string | null;
  hasKr: boolean;
  hasUs: boolean;
  isActive: boolean;
  productCount: number;
}

interface BrandListClientProps {
  brands: BrandItemResolved[];
  canWrite: boolean;
  canManage: boolean;
}

export function BrandListClient({ brands, canWrite, canManage }: BrandListClientProps) {
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  const activeBrands = brands.filter((b) => b.isActive);
  const inactiveBrands = brands.filter((b) => !b.isActive);

  const displayedBrands = filter === "ACTIVE"
    ? activeBrands
    : filter === "INACTIVE"
    ? inactiveBrands
    : brands;

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-850 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setFilter("ALL")}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
              filter === "ALL"
                ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-white"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            전체 ({brands.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("ACTIVE")}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              filter === "ACTIVE"
                ? "bg-white text-emerald-700 shadow-xs dark:bg-zinc-800 dark:text-emerald-400"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>활성 브랜드 ({activeBrands.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter("INACTIVE")}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              filter === "INACTIVE"
                ? "bg-white text-amber-700 shadow-xs dark:bg-zinc-800 dark:text-amber-400"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>사용 중단 ({inactiveBrands.length})</span>
          </button>
        </div>

        {inactiveBrands.length > 0 && (
          <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50/80 dark:bg-amber-950/30 px-3 py-1 rounded-md border border-amber-200/60 dark:border-amber-900/60">
            ℹ️ 사용 중단된 브랜드 {inactiveBrands.length}개 보존 중 (신규 상품 생성 목록에서는 제외)
          </p>
        )}
      </div>

      {/* Brands Grid */}
      {displayedBrands.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white py-12 text-center text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500 text-xs">
          {filter === "INACTIVE"
            ? "사용 중단 처리된 브랜드가 없습니다."
            : filter === "ACTIVE"
            ? "활성화된 브랜드가 없습니다. 상단 '새 브랜드 추가' 단추를 이용해 첫 브랜드를 개설해 보세요."
            : canWrite
            ? "등록된 브랜드가 아직 존재하지 않습니다. 상단 '새 브랜드 추가' 단추를 이용해 첫 브랜드를 개설해 보세요."
            : "등록된 브랜드가 존재하지 않습니다."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {displayedBrands.map((brand) => (
            <div
              key={brand.id}
              className={`flex flex-col justify-between rounded-lg border p-5 shadow-sm transition-all ${
                brand.isActive
                  ? "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 hover:shadow-md hover:border-[#131E2E] dark:hover:border-zinc-700"
                  : "border-amber-200/80 bg-amber-50/20 dark:border-amber-900/40 dark:bg-zinc-900/80 opacity-90"
              }`}
            >
              <div className="space-y-4">
                {/* Header with Logo, Name & Badges */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {brand.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={brand.logoUrl}
                        alt=""
                        className="h-10 w-10 rounded border border-zinc-200 dark:border-zinc-800 object-cover bg-zinc-50 dark:bg-zinc-950 shrink-0"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-zinc-100 dark:bg-zinc-850 text-[10px] font-bold text-zinc-400 select-none">
                        LOGO
                      </div>
                    )}
                    <div>
                      <h3 className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                        <span>{brand.name}</span>
                      </h3>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">
                        연결된 상품: <strong className="text-zinc-700 dark:text-zinc-300 font-bold">{brand.productCount}개</strong>
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  {brand.isActive ? (
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold border border-emerald-200 dark:border-emerald-900/60 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>활성</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-100/80 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 px-2 py-0.5 text-[10px] font-bold border border-amber-300/60 dark:border-amber-800 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span>사용 중단</span>
                    </span>
                  )}
                </div>

                {/* Professional Trademark Statuses */}
                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2 text-xs font-semibold text-zinc-550 dark:text-zinc-400">
                  <div className="flex items-center justify-between">
                    <span>대한민국 상표권 등록 여부</span>
                    {brand.hasKr ? (
                      <span className="text-[#131E2E] dark:text-[#a8c5eb] bg-[#F2F1EE] dark:bg-zinc-800/80 px-2 py-0.5 rounded text-[10px] font-extrabold border border-zinc-200/60 dark:border-zinc-700">보유</span>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-400 font-medium px-2 py-0.5 rounded text-[10px] border border-transparent">미보유</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span>미국 USPTO 상표권 등록 여부</span>
                    {brand.hasUs ? (
                      <span className="text-[#131E2E] dark:text-[#a8c5eb] bg-[#F2F1EE] dark:bg-zinc-800/80 px-2 py-0.5 rounded text-[10px] font-extrabold border border-zinc-200/60 dark:border-zinc-700">보유</span>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-400 font-medium px-2 py-0.5 rounded text-[10px] border border-transparent">미보유</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <BrandActionButtons
                brandId={brand.id}
                isActive={brand.isActive}
                productCount={brand.productCount}
                canWrite={canWrite}
                canManage={canManage}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
