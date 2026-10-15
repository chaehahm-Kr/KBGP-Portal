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
    regularPrice,
    salePrice,
    discountPercent,
    isSaleActive,
    effectivePrice,
    priceBasis,
    qrDataUrl,
  } = item;

  const isSale = isSaleActive && salePrice !== null && discountPercent !== null;

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
                <span className="text-[9px] text-black/60 line-through font-semibold">
                  ${regularPrice?.toFixed(2)}
                </span>
                <span className="px-1 py-0.2 rounded bg-black text-white text-[8px] font-black uppercase tracking-tight">
                  SAVE {discountPercent}%
                </span>
              </div>
              <div className="text-lg sm:text-xl font-black text-black leading-none tracking-tight">
                ${salePrice?.toFixed(2)}
              </div>
            </div>
          ) : hasStorePrice && regularPrice ? (
            <div className="space-y-0.5">
              <div className="text-[8px] font-bold uppercase tracking-wider text-black/60">
                STORE PRICE
              </div>
              <div className="text-lg sm:text-xl font-black text-black leading-none tracking-tight">
                ${regularPrice.toFixed(2)}
              </div>
            </div>
          ) : (
            <div className="space-y-0.5">
              <div className="flex items-center gap-1">
                <span className="text-[8px] font-extrabold uppercase tracking-wider text-black/60">
                  MSRP
                </span>
                <span className="px-1 py-0.2 rounded border border-black/40 text-[7px] font-black uppercase tracking-tight text-black">
                  SET PRICE
                </span>
              </div>
              <div className="text-base sm:text-lg font-black text-black leading-none tracking-tight">
                ${effectivePrice.toFixed(2)}
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
