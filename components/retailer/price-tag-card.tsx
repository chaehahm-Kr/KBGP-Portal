"use client";

import React from "react";
import Image from "next/image";
import { StoreProductTagItem, PHYSICAL_PRICE_TAG_DIMENSIONS } from "@/lib/retailer/store-pricing-types";

interface PriceTagCardProps {
  item: StoreProductTagItem;
  className?: string;
  isPrintVersion?: boolean;
  scale?: number;
}

export function PriceTagCard({ item, className = "", isPrintVersion = false, scale }: PriceTagCardProps) {
  const {
    productName,
    brandName,
    sku,
    hasStorePrice,
    isMsrpDefault,
    regularPrice,
    salePrice,
    discountPercent,
    isSaleActive,
    effectivePrice,
    priceBasis,
    qrDataUrl,
  } = item;

  const isSale =
    isSaleActive &&
    salePrice !== null &&
    salePrice > 0 &&
    regularPrice !== null &&
    regularPrice > 0 &&
    salePrice < regularPrice;

  const effectiveDiscount =
    discountPercent !== null && discountPercent !== undefined
      ? discountPercent
      : isSale && regularPrice && salePrice
      ? Math.round(((regularPrice - salePrice) / regularPrice) * 100)
      : null;

  return (
    <div
      className={`price-tag-container relative bg-white text-black border border-black rounded-lg p-2.5 flex flex-col justify-between select-none overflow-hidden ${
        isPrintVersion ? "print-tag-sheet" : "shadow-sm aspect-[5/3] w-full max-w-[280px]"
      } ${className}`}
      style={{
        width: isPrintVersion ? "50mm" : undefined,
        height: isPrintVersion ? "30mm" : undefined,
        maxWidth: isPrintVersion ? "50mm" : "280px",
        maxHeight: isPrintVersion ? "30mm" : undefined,
        boxSizing: "border-box",
      }}
    >
      {/* Top row: Brand & SKU */}
      <div className="flex items-center justify-between gap-1 leading-none border-b border-black/15 pb-1">
        <span className="text-[10px] font-black uppercase tracking-wider text-black truncate max-w-[65%]">
          {brandName}
        </span>
        <span className="text-[9px] font-mono font-bold text-black/80 flex-shrink-0">
          {sku}
        </span>
      </div>

      {/* Middle row: Product Name (up to 2 lines) */}
      <div className="my-auto py-0.5">
        <div className="text-[11px] font-bold text-black line-clamp-2 leading-tight">
          {productName}
        </div>
      </div>

      {/* Bottom row: Price block + 12x12mm Canonical QR code */}
      <div className="flex items-end justify-between gap-1.5 pt-1 border-t border-black/20">
        {/* Price Display */}
        <div className="flex-1 min-w-0">
          {isSale ? (
            <div className="space-y-0.5">
              <div className="flex items-center gap-1">
                <span className="px-1.5 py-0.2 rounded bg-black text-white text-[8px] font-black uppercase tracking-wider">
                  SALE
                </span>
                {effectiveDiscount !== null && (
                  <span className="px-1 py-0.2 rounded border border-black text-black text-[7.5px] font-black uppercase tracking-tight">
                    SAVE {effectiveDiscount}%
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl sm:text-2xl font-black text-black leading-none tracking-tight">
                  ${salePrice?.toFixed(2)}
                </span>
                <span className="text-[8.5px] text-black/70 line-through font-bold">
                  ${regularPrice?.toFixed(2)}
                </span>
              </div>
            </div>
          ) : hasStorePrice && regularPrice && !isMsrpDefault ? (
            <div className="space-y-0.5">
              <div className="text-[7.5px] font-bold uppercase tracking-wider text-black/60">
                STORE PRICE
              </div>
              <div className="text-xl sm:text-2xl font-black text-black leading-none tracking-tight">
                ${regularPrice.toFixed(2)}
              </div>
            </div>
          ) : isMsrpDefault && regularPrice ? (
            <div className="space-y-0.5">
              <div className="flex items-center gap-1">
                <span className="text-[7.5px] font-extrabold uppercase tracking-wider text-black/60">
                  REGULAR
                </span>
                <span className="px-1 py-0.2 rounded bg-zinc-100 border border-black/30 text-[7px] font-bold uppercase tracking-tight text-black">
                  MSRP
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-black leading-none tracking-tight">
                ${regularPrice.toFixed(2)}
              </div>
            </div>
          ) : (
            <div className="space-y-0.5">
              <div className="px-1 py-0.2 rounded border border-black/40 text-[7.5px] font-black uppercase tracking-tight text-black inline-block">
                SET PRICE
              </div>
              <div className="text-sm font-bold text-black/40 leading-none">
                Not Priced
              </div>
            </div>
          )}
        </div>

        {/* Canonical QR Code (12mm equivalent) */}
        <div className="flex flex-col items-center flex-shrink-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 relative bg-white p-0.5 border border-black rounded">
            {qrDataUrl ? (
              <Image
                src={qrDataUrl}
                alt={`QR code for ${productName}`}
                fill
                className="object-contain"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[7px] font-bold text-black/40">
                QR
              </div>
            )}
          </div>
          <span className="text-[6.5px] font-bold text-black/70 tracking-tight mt-0.5">
            SCAN FOR INFO
          </span>
        </div>
      </div>
    </div>
  );
}
