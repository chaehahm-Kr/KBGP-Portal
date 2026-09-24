"use client";

import React from "react";
import Image from "next/image";
import { StoreProductTagItem, PHYSICAL_PRICE_TAG_DIMENSIONS } from "@/lib/retailer/store-pricing-types";

interface PriceTagCardProps {
  item: StoreProductTagItem;
  className?: string;
  isPrintVersion?: boolean;
}

export function PriceTagCard({ item, className = "", isPrintVersion = false }: PriceTagCardProps) {
  const {
    productName,
    brandName,
    sku,
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
      className={`price-tag-container relative bg-white text-zinc-950 border border-zinc-300 rounded-xl p-3 flex flex-col justify-between shadow-sm select-none overflow-hidden ${
        isPrintVersion ? "print-tag-sheet" : ""
      } ${className}`}
      style={{
        width: isPrintVersion ? "2.25in" : "100%",
        maxWidth: isPrintVersion ? "2.25in" : "320px",
        height: isPrintVersion ? "1.25in" : "180px",
        boxSizing: "border-box",
      }}
    >
      {/* Top row: Brand & SKU */}
      <div className="flex items-center justify-between gap-1 leading-none">
        <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-purple-900 truncate">
          {brandName}
        </span>
        <span className="text-[9px] font-mono text-zinc-500 flex-shrink-0">
          {sku}
        </span>
      </div>

      {/* Middle row: Product Name */}
      <div className="my-1">
        <div className="text-xs sm:text-sm font-bold text-zinc-900 line-clamp-2 leading-tight">
          {productName}
        </div>
      </div>

      {/* Bottom row: Price block + QR code */}
      <div className="flex items-end justify-between gap-2 pt-1 border-t border-zinc-200">
        {/* Price Display */}
        <div className="flex-1 min-w-0">
          {isSale ? (
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-400 line-through font-semibold">
                  ${regularPrice?.toFixed(2)}
                </span>
                <span className="px-1.5 py-0.2 rounded bg-rose-600 text-white text-[9px] font-black uppercase tracking-tight">
                  SAVE {discountPercent}%
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-rose-600 leading-none">
                ${salePrice?.toFixed(2)}
              </div>
            </div>
          ) : (
            <div className="space-y-0.5">
              <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                {priceBasis === "msrp" ? "MSRP" : "Store Price"}
              </div>
              <div className="text-xl sm:text-2xl font-black text-zinc-950 leading-none">
                ${effectivePrice.toFixed(2)}
              </div>
            </div>
          )}
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center flex-shrink-0">
          <div className="w-11 h-11 sm:w-12 sm:h-12 relative bg-white p-0.5 border border-zinc-200 rounded-md">
            {qrDataUrl ? (
              <Image
                src={qrDataUrl}
                alt={`QR code for ${productName}`}
                fill
                className="object-contain"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[8px] text-zinc-400">
                QR
              </div>
            )}
          </div>
          <span className="text-[7px] font-bold text-zinc-400 tracking-tighter mt-0.5">
            SCAN INFO
          </span>
        </div>
      </div>
    </div>
  );
}
