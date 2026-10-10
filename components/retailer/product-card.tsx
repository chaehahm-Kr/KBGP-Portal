"use client";

import React, { useState } from "react";
import Link from "next/link";
import { RetailerProductSummary } from "@/lib/retailer/products";
import { useTranslation } from "@/lib/i18n";
import { useCart } from "@/components/retailer/cart-context";

interface ProductCardProps {
  product: RetailerProductSummary;
}

export function RetailerProductCard({ product }: ProductCardProps) {
  const { t, locale } = useTranslation();
  const { addItem } = useCart();
  const badges = product.activeMarketingBadges || [];

  // Carousel Image state
  const images: string[] =
    product.imageUrls && product.imageUrls.length > 0
      ? product.imageUrls
      : product.thumbnailUrl
      ? [product.thumbnailUrl]
      : [];

  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [justAdded, setJustAdded] = useState(false);

  const activeImage = images.length > 0 ? images[currentImgIndex] : null;

  const handlePrevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (images.length < 2) return;
    setCurrentImgIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (images.length < 2) return;
    setCurrentImgIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handleDotClick = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImgIndex(index);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product.isOrderable || product.isSoldOut) return;

    addItem(
      {
        id: product.id,
        name: product.name,
        nameEn: product.nameEn,
        brandName: product.brandName,
        sku: product.sku,
        thumbnailUrl: product.thumbnailUrl,
        wholesalePrice: product.wholesalePrice,
        msrp: product.msrp,
        marginPercent: product.marginPercent,
      },
      product.moq || 1
    );

    setJustAdded(true);
    setTimeout(() => {
      setJustAdded(false);
    }, 1500);
  };

  return (
    <Link
      href={`/retailer/products/${product.id}`}
      className="group relative flex flex-col rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200 text-left"
    >
      {/* Product Image Container with Carousel */}
      <div className="relative aspect-[4/3] w-full bg-zinc-100/90 dark:bg-zinc-800/60 overflow-hidden flex items-center justify-center p-3">
        {activeImage ? (
          <img
            src={activeImage}
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

        {/* Carousel Chevron Controls (Shown when >= 2 images) */}
        {images.length >= 2 && (
          <>
            <button
              type="button"
              onClick={handlePrevImage}
              aria-label="Previous Image"
              className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10 p-1 rounded-full bg-white/80 dark:bg-zinc-900/80 text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-900 shadow-sm transition-opacity opacity-0 group-hover:opacity-100"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              type="button"
              onClick={handleNextImage}
              aria-label="Next Image"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 z-10 p-1 rounded-full bg-white/80 dark:bg-zinc-900/80 text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-900 shadow-sm transition-opacity opacity-0 group-hover:opacity-100"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Carousel Dot Indicators */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-black/30 dark:bg-black/50 backdrop-blur-xs px-2 py-0.5 rounded-full">
              {images.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => handleDotClick(e, idx)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    idx === currentImgIndex
                      ? "bg-white w-2.5"
                      : "bg-white/50 hover:bg-white/80"
                  }`}
                />
              ))}
            </div>
          </>
        )}

        {/* Top Left Overlay: Brand Name + Category */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start max-w-[65%] pointer-events-none z-10">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-white/90 dark:bg-zinc-900/90 text-zinc-800 dark:text-zinc-200 backdrop-blur-md shadow-2xs border border-zinc-200/60 dark:border-zinc-700/60 truncate">
            {product.brandName}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-medium bg-zinc-100/90 dark:bg-zinc-800/90 text-zinc-600 dark:text-zinc-400 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-700/50 truncate">
            {product.categoryLabel}
          </span>
        </div>

        {/* Top Right Overlay: Marketing Badges (Promotion, Sale, Hot, New) & Out of Stock */}
        <div className="absolute top-2.5 right-2.5 flex flex-col gap-1 items-end pointer-events-none z-10">
          {badges.map((b, idx) => (
            <span
              key={idx}
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold border backdrop-blur-md ${b.badgeStyle}`}
            >
              {b.label}
            </span>
          ))}
          {product.isSoldOut && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-600 text-white shadow-2xs">
              {t.products.outOfStock}
            </span>
          )}
        </div>
      </div>

      {/* Content Container */}
      <div className="flex-1 flex flex-col p-3 sm:p-3.5 space-y-2">
        {/* SKU */}
        <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
          <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
            SKU: {product.sku}
          </span>
          {product.origin && (
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
              {product.origin}
            </span>
          )}
        </div>

        {/* Title & Retailer Short Description */}
        <div className="flex-1 min-h-[44px]">
          <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white line-clamp-2 leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {product.name}
          </h3>
          {product.shortDescription ? (
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed mt-1 font-normal">
              {product.shortDescription}
            </p>
          ) : product.nameEn && product.nameEn !== product.name ? (
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5 font-normal">
              {product.nameEn}
            </p>
          ) : null}
        </div>

        {/* Commercial Pricing Strip: Wholesale | Margin | MSRP */}
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 space-y-1">
          <div className="grid grid-cols-3 items-end gap-1 text-left">
            {/* 1. Wholesale */}
            <div>
              <div className="flex items-center gap-1">
                <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500 truncate">
                  {product.isPromoActive ? t.products.promoBadge : t.products.wholesalePrice}
                </span>
                {product.isPromoActive && (
                  <span className="px-1 py-0.2 text-[8px] font-black rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    PROMO
                  </span>
                )}
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
        </div>

        {/* Retailer Purchasing Conditions & Quick Add to Cart CTA */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
          <div className="text-[10px] text-zinc-500 font-semibold truncate">
            {t.products.moq}: <strong className="text-zinc-900 dark:text-zinc-100">{product.moq} {locale === "ko" ? "개" : "units"}</strong>
          </div>

          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!product.isOrderable || product.isSoldOut}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 shadow-xs shrink-0 ${
              justAdded
                ? "bg-emerald-600 text-white"
                : !product.isOrderable || product.isSoldOut
                ? "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600 cursor-not-allowed shadow-none"
                : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            }`}
          >
            {justAdded ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>{locale === "ko" ? "담김!" : "Added!"}</span>
              </>
            ) : !product.isOrderable || product.isSoldOut ? (
              <span>{t.products.outOfStock}</span>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span>{locale === "ko" ? "빠른 담기" : "Quick Add"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Link>
  );
}
