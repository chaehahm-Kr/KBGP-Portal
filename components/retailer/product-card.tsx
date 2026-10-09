"use client";

import React from "react";
import Link from "next/link";
import { RetailerProductSummary } from "@/lib/retailer/products";
import { useTranslation } from "@/lib/i18n";

interface ProductCardProps {
  product: RetailerProductSummary;
}

export function RetailerProductCard({ product }: ProductCardProps) {
  const { t, locale } = useTranslation();
  const badges = product.activeMarketingBadges || [];

  return (
    <Link
      href={`/retailer/products/${product.id}`}
      className="group relative flex flex-col rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200 text-left"
    >
      {/* Product Image Container */}
      <div className="relative aspect-[4/3] w-full bg-zinc-100/90 dark:bg-zinc-800/60 overflow-hidden flex items-center justify-center p-3">
        {product.thumbnailUrl ? (
          <img
            src={product.thumbnailUrl}
            alt={product.name}
            className="w-full h-full object-contain object-center group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 gap-1.5">
            <svg
              className="w-8 h-8 stroke-current opacity-40"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
              />
            </svg>
            <span className="text-[10px] font-medium">{t.common.noData}</span>
          </div>
        )}

        {/* Top Left: Category & Out of Stock Overlay */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start max-w-[65%] pointer-events-none">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold bg-white/95 dark:bg-zinc-900/95 text-zinc-700 dark:text-zinc-300 backdrop-blur-md shadow-2xs border border-zinc-200/50 dark:border-zinc-700/50 truncate">
            {product.categoryLabel}
          </span>
          {product.isSoldOut && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-600 text-white shadow-2xs">
              {t.products.outOfStock}
            </span>
          )}
        </div>

        {/* Top Right: Marketing Badges (Promotion, Sale, New) */}
        {badges.length > 0 && (
          <div className="absolute top-2.5 right-2.5 flex flex-col gap-1 items-end pointer-events-none">
            {badges.map((b, idx) => (
              <span
                key={idx}
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold border backdrop-blur-md ${b.badgeStyle}`}
              >
                {b.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Content Container */}
      <div className="flex-1 flex flex-col p-3 sm:p-3.5 space-y-2">
        {/* Brand & Sku */}
        <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
          <span className="font-semibold text-zinc-900 dark:text-zinc-200 truncate max-w-[60%]">
            {product.brandName}
          </span>
          <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
            {product.sku}
          </span>
        </div>

        {/* Title */}
        <div className="flex-1 min-h-[36px]">
          <h3 className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white line-clamp-2 leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {product.name}
          </h3>
          {product.nameEn && product.nameEn !== product.name && (
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5 font-normal">
              {product.nameEn}
            </p>
          )}
        </div>

        {/* Commercial Pricing Strip: Wholesale | Margin | MSRP */}
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 space-y-0.5">
          <div className="grid grid-cols-3 items-end gap-1 text-left">
            {/* 1. Wholesale */}
            <div>
              <div className="text-[9px] uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500 truncate">
                {product.isPromoActive ? t.products.promoBadge : t.products.wholesalePrice}
              </div>
              <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white flex items-baseline gap-0.5 truncate">
                <span>{product.wholesalePrice > 0 ? `$${product.wholesalePrice.toFixed(2)}` : "—"}</span>
                <span className="text-[8px] font-normal text-zinc-400">/EA</span>
              </div>
            </div>

            {/* 2. Margin */}
            <div className="text-center">
              <div className="text-[9px] uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500 truncate">
                {t.products.margin}
              </div>
              <div className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 truncate">
                {product.marginPercent > 0 && product.msrp > 0 ? `${product.marginPercent}%` : "—"}
              </div>
            </div>

            {/* 3. MSRP */}
            <div className="text-right">
              <div className="text-[9px] uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500 truncate">
                {t.products.msrp}
              </div>
              <div className="text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-300 truncate">
                {product.msrp > 0 ? `$${product.msrp.toFixed(2)}` : "—"}
              </div>
            </div>
          </div>

          {/* Volume discount subtitle */}
          {product.hasTiers && product.maxDiscountPercent && product.maxDiscountPercent > 0 && !product.isPromoActive ? (
            <div className="text-[9px] font-medium text-indigo-600 dark:text-indigo-400 truncate">
              {t.products.bulkDiscountUpTo.replace("{percent}", String(product.maxDiscountPercent))}
            </div>
          ) : null}
        </div>

        {/* Retailer Purchasing Conditions: Clean MOQ */}
        <div className="flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1 rounded-md border border-zinc-150 dark:border-zinc-800">
          <span className="text-zinc-500 font-medium text-[10px]">{t.products.moq}:</span>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-[10px] sm:text-[11px]">
            {product.moq} {locale === "ko" ? "개" : "units"}
          </span>
        </div>
      </div>
    </Link>
  );
}
