"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RetailerProductSummary } from "@/lib/retailer/products";
import { useTranslation } from "@/lib/i18n";
import { useCart } from "@/components/retailer/cart-context";
import { SaveCollectionModal } from "@/components/retailer/save-collection-modal";
import { type RetailerCollection } from "@/lib/retailer/saved-products";

interface ProductCardProps {
  product: RetailerProductSummary;
  isSaved?: boolean;
  savedCollectionIds?: string[];
  allCollections?: RetailerCollection[];
  onSaveToggle?: (productId: string, isSaved: boolean, collectionIds: string[]) => void;
  onCollectionsUpdated?: (allCols: RetailerCollection[]) => void;
}

export function RetailerProductCard({
  product,
  isSaved: initialIsSaved = false,
  savedCollectionIds: initialSavedCollectionIds = [],
  allCollections = [],
  onSaveToggle,
  onCollectionsUpdated,
}: ProductCardProps) {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { addItem, items } = useCart();
  const badges = product.activeMarketingBadges || [];

  // Check if product is currently in cart
  const cartItem = items.find((i) => i.productId === product.id);
  const isInCart = Boolean(cartItem);

  // Carousel Image state
  const images: string[] =
    product.imageUrls && product.imageUrls.length > 0
      ? product.imageUrls
      : product.thumbnailUrl
      ? [product.thumbnailUrl]
      : [];

  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [isSaved, setIsSaved] = useState(initialIsSaved);
  const [savedCollectionIds, setSavedCollectionIds] = useState<string[]>(initialSavedCollectionIds);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const activeImage = images.length > 0 ? images[currentImgIndex] : null;

  // Authoritative English product name resolution
  const displayName = product.nameEn || product.name;
  const secondaryName = product.nameEn && product.nameEn !== product.name ? product.name : null;

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

  const handleHeartClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsModalOpen(true);
  };

  const handleSaveStateChanged = (prodId: string, newSavedState: boolean, colIds: string[]) => {
    setIsSaved(newSavedState);
    setSavedCollectionIds(colIds);
    if (onSaveToggle) {
      onSaveToggle(prodId, newSavedState, colIds);
    }
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product.isOrderable || product.isSoldOut) return;

    if (isInCart) {
      router.push("/cart");
      return;
    }

    const effectivePrice =
      product.isPromoActive && product.promoWholesalePrice
        ? product.promoWholesalePrice
        : product.wholesalePrice;

    addItem(
      {
        id: product.id,
        name: displayName,
        nameEn: product.nameEn,
        brandName: product.brandName,
        sku: product.sku,
        thumbnailUrl: product.thumbnailUrl,
        wholesalePrice: effectivePrice,
        msrp: product.msrp,
        marginPercent: product.marginPercent,
        cartonPackQty: product.moq || 1,
        salesPolicy: product.salesPolicy,
      },
      product.moq || 1
    );
  };

  return (
    <>
      <Link
        href={`/retailer/products/${product.id}`}
        className="group relative flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs hover:shadow-xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200 text-left"
      >
        {/* 1. TOP HEADER BAR: Brand Pill (Left) & Active Badges (Right) */}
        <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-1">
          {/* Brand Pill */}
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800/90 text-zinc-800 dark:text-zinc-200 border border-zinc-200/70 dark:border-zinc-700/70 truncate max-w-[55%]">
            <span className="truncate">{product.brandName}</span>
            <svg className="w-2.5 h-2.5 opacity-60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>

          {/* Active Badges */}
          <div className="flex items-center gap-1 shrink-0 overflow-x-auto no-scrollbar">
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

        {/* 2. PRODUCT IMAGE CONTAINER with Carousel (Clean, no category overlay) */}
        <div className="relative aspect-[4/3] w-full bg-zinc-100/90 dark:bg-zinc-800/50 overflow-hidden flex items-center justify-center p-3 mt-1">
          {activeImage ? (
            <img
              src={activeImage}
              alt={displayName}
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
                className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-white/90 dark:bg-zinc-900/90 text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-900 shadow-md transition-opacity opacity-0 group-hover:opacity-100"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <button
                type="button"
                onClick={handleNextImage}
                aria-label="Next Image"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-white/90 dark:bg-zinc-900/90 text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-900 shadow-md transition-opacity opacity-0 group-hover:opacity-100"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Carousel Dot Indicators */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-black/40 dark:bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded-full">
                {images.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => handleDotClick(e, idx)}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === currentImgIndex
                        ? "bg-white w-3"
                        : "bg-white/50 w-1.5 hover:bg-white/80"
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* 3. BODY SECTION: Monospace SKU + [Category Badge | Heart] & Product Title */}
        <div className="flex-1 flex flex-col px-3.5 pt-3 pb-2 space-y-2">
          {/* Action Row: SKU (Left) | Category Badge + Heart (Right) */}
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[11px] font-medium text-zinc-400 dark:text-zinc-500 truncate tracking-tight">
              SKU | {product.sku}
            </span>

            {/* Right Action Area: Category Badge | Heart */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Category Badge */}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800/90 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60 truncate max-w-[125px]">
                <span>🏷️</span>
                <span className="truncate">{product.categoryLabel}</span>
              </span>

              {/* Heart Save Button */}
              <button
                type="button"
                onClick={handleHeartClick}
                aria-label={isSaved ? "Saved to collection" : "Save product"}
                className={`p-1 rounded-full transition-transform hover:scale-115 shrink-0 ${
                  isSaved
                    ? "text-rose-500 fill-rose-500"
                    : "text-zinc-400 hover:text-rose-500 dark:text-zinc-500 dark:hover:text-rose-400"
                }`}
              >
                <svg
                  className="w-4 h-4"
                  fill={isSaved ? "currentColor" : "none"}
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={isSaved ? 0 : 2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Title & Short Description */}
          <div className="flex-1 min-h-[48px]">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {displayName}
            </h3>
            {product.shortDescription ? (
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed mt-1 font-normal">
                {product.shortDescription}
              </p>
            ) : secondaryName ? (
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5 font-normal">
                {secondaryName}
              </p>
            ) : null}
          </div>

          {/* 4. PRICING STRIP (3 Columns with Vertical Dividers) */}
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <div className="grid grid-cols-3 items-center divide-x divide-zinc-200 dark:divide-zinc-800 text-center py-1">
              {/* Col 1: Wholesale */}
              <div className="px-1 text-left">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500 truncate">
                    WHOLESALE
                  </span>
                  {product.isPromoActive && (
                    <span className="px-1 py-0.2 text-[8px] font-black rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      PROMO
                    </span>
                  )}
                </div>
                <div className="text-xs sm:text-sm font-black text-zinc-900 dark:text-zinc-100 flex items-baseline gap-0.5 truncate mt-0.5">
                  <span>
                    {product.wholesalePrice > 0
                      ? `$${(product.isPromoActive && product.promoWholesalePrice ? product.promoWholesalePrice : product.wholesalePrice).toFixed(2)}`
                      : "—"}
                  </span>
                  <span className="text-[8px] font-normal text-zinc-400">/EA</span>
                </div>
              </div>

              {/* Col 2: Margin */}
              <div className="px-1 text-center">
                <div className="text-[9px] uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500 truncate">
                  MARGIN
                </div>
                <div className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 truncate mt-0.5">
                  {product.marginPercent > 0 && product.msrp > 0 ? `${product.marginPercent}%` : "—"}
                </div>
              </div>

              {/* Col 3: MSRP */}
              <div className="px-1 text-right">
                <div className="text-[9px] uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500 truncate">
                  MSRP
                </div>
                <div className="text-xs sm:text-sm font-bold text-zinc-600 dark:text-zinc-300 truncate mt-0.5">
                  {product.msrp > 0 ? `$${product.msrp.toFixed(2)}` : "—"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 5. BOTTOM BAR: Inner Dark Container with MOQ & Quick Add */}
        <div className="p-2.5 sm:p-3 pt-0">
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200/60 dark:border-zinc-800/80">
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium truncate pl-1">
              {t.products.moq} <strong className="text-zinc-900 dark:text-zinc-100 font-bold">· {product.moq} {locale === "ko" ? "개" : "units"}</strong>
            </div>

            {isInCart ? (
              <button
                type="button"
                onClick={handleAddToCart}
                title={locale === "ko" ? "장바구니 보기" : "View Cart"}
                className="px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 shadow-xs shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>{locale === "ko" ? `담김 (${cartItem?.quantity})` : `Added (${cartItem?.quantity})`}</span>
              </button>
            ) : !product.isOrderable || product.isSoldOut ? (
              <button
                type="button"
                disabled
                className="px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 shrink-0 bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600 cursor-not-allowed shadow-none"
              >
                <span>{t.products.outOfStock}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleAddToCart}
                className="px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 shadow-xs shrink-0 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span>{locale === "ko" ? "빠른 담기" : "Quick Add"}</span>
              </button>
            )}
          </div>
        </div>
      </Link>

      {/* Save Collection Modal */}
      <SaveCollectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        productId={product.id}
        productName={displayName}
        brandName={product.brandName}
        thumbnailUrl={product.thumbnailUrl}
        initialCollectionIds={savedCollectionIds}
        allCollections={allCollections}
        onCollectionsUpdated={onCollectionsUpdated}
        onSaveStateChanged={handleSaveStateChanged}
      />
    </>
  );
}
