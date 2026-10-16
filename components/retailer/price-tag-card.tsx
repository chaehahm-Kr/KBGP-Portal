"use client";

import React from "react";
import Image from "next/image";
import {
  StoreProductTagItem,
  resolveShelfTagTemplate,
} from "@/lib/retailer/store-pricing-types";

interface PriceTagCardProps {
  item: StoreProductTagItem;
  className?: string;
  isPrintVersion?: boolean;
  scale?: number;
}

export function PriceTagCard({
  item,
  className = "",
  isPrintVersion = false,
  scale,
}: PriceTagCardProps) {
  const {
    productName,
    brandName,
    sku,
    regularPrice,
    salePrice,
    discountPercent,
    qrDataUrl,
    msrp,
  } = item;

  const template = resolveShelfTagTemplate(item);
  const isSale = template === "sale_1e";

  const effectiveRegularPrice =
    regularPrice !== null && regularPrice > 0
      ? regularPrice
      : msrp > 0
      ? msrp
      : null;

  const effectiveDiscount =
    discountPercent !== null && discountPercent !== undefined
      ? discountPercent
      : isSale && effectiveRegularPrice && salePrice
      ? Math.round(((effectiveRegularPrice - salePrice) / effectiveRegularPrice) * 100)
      : null;

  const brandDisplay = (brandName || "K SELECT LAB").toUpperCase();
  const skuDisplay = sku || "KS-PROD";
  const nameLen = (productName || "").length;

  if (isSale) {
    // SALE 1e Template (Matches Attachment 1 Refined Hierarchy)
    const nameFontSizeClass =
      nameLen > 40
        ? "text-[9.5px] leading-[1.12]"
        : nameLen > 24
        ? "text-[10.5px] leading-[1.15]"
        : "text-[12px] leading-[1.18]";

    const salePriceFontSizeClass =
      (salePrice || 0) >= 100
        ? "text-xl sm:text-2xl"
        : "text-2xl sm:text-3xl";

    return (
      <div
        className={`price-tag-container relative bg-white text-black border border-black rounded-lg flex select-none overflow-hidden ${
          isPrintVersion
            ? "print-tag-sheet"
            : "shadow-sm aspect-[5/3] w-full max-w-[280px]"
        } ${className}`}
        style={{
          width: isPrintVersion ? "50mm" : undefined,
          height: isPrintVersion ? "30mm" : undefined,
          maxWidth: isPrintVersion ? "50mm" : "280px",
          maxHeight: isPrintVersion ? "30mm" : undefined,
          boxSizing: "border-box",
        }}
      >
        {/* Solid Vertical Black SALE Band (Far Left: 15% width) */}
        <div className="w-[15%] bg-black text-white flex items-center justify-center relative select-none self-stretch shrink-0">
          <span className="font-black text-sm sm:text-base tracking-wider text-white rotate-[-90deg] whitespace-nowrap select-none">
            SALE
          </span>
        </div>

        {/* Main Content Area (Right of SALE Band) */}
        <div className="flex-1 flex flex-col justify-between pl-2 pr-2 py-1.5 min-w-0">
          {/* Header Row: Brand (Left) & SKU (Right) */}
          <div className="flex items-center justify-between gap-1 leading-none border-b border-black pb-1">
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-tight text-black truncate max-w-[65%]">
              {brandDisplay}
            </span>
            <span className="text-[8.5px] sm:text-[9.5px] font-mono font-bold text-black shrink-0">
              {skuDisplay}
            </span>
          </div>

          {/* Body: Text column (left of QR) and QR column (right) */}
          <div className="flex-1 flex items-stretch justify-between gap-1 pt-1 min-h-0">
            {/* Text Stack */}
            <div className="flex-1 flex flex-col justify-between min-w-0 pr-1">
              {/* Product Name */}
              <div className={`${nameFontSizeClass} font-bold text-black line-clamp-2 leading-tight`}>
                {productName}
              </div>

              {/* Price Stack: SAVE Box, Strikethrough Regular, Dominant SALE Price */}
              <div className="space-y-0.5 pt-0.5">
                {effectiveDiscount !== null && (
                  <div className="inline-block self-start border-[1.5px] border-black px-1.5 py-0.5 rounded-[2px] bg-white leading-none">
                    <span className="font-black text-[8.5px] sm:text-[9.5px] text-black tracking-tight block">
                      SAVE {effectiveDiscount}%
                    </span>
                  </div>
                )}
                <div className="text-[10.5px] sm:text-[11.5px] font-bold text-black line-through decoration-black decoration-[1.5px] leading-tight">
                  ${effectiveRegularPrice?.toFixed(2)}
                </div>
                <div className={`${salePriceFontSizeClass} font-black text-black leading-none tracking-tight pt-0.5`}>
                  ${salePrice?.toFixed(2)}
                </div>
              </div>
            </div>

            {/* QR Code Column */}
            <div className="w-[28%] sm:w-[26%] flex flex-col items-center justify-end shrink-0 self-end pb-0.5">
              <div className="w-full aspect-square relative bg-white">
                {qrDataUrl ? (
                  <Image
                    src={qrDataUrl}
                    alt={`QR code for ${productName}`}
                    fill
                    className="object-contain"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[7px] font-bold text-black">
                    QR
                  </div>
                )}
              </div>
              <span className="text-[5.5px] sm:text-[6.5px] font-extrabold text-black tracking-tight mt-0.5 whitespace-nowrap text-center block">
                SCAN FOR INFO
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // REGULAR 1c Template (Matches Attachment 1 & Claude PDF)
  const nameFontSizeClass =
    nameLen > 40
      ? "text-[11px] leading-[1.15]"
      : nameLen > 24
      ? "text-[13px] leading-[1.18]"
      : "text-[15px] leading-[1.2]";

  const regularPriceFontSizeClass =
    (effectiveRegularPrice || 0) >= 100
      ? "text-2xl sm:text-3xl"
      : "text-3xl sm:text-4xl";

  return (
    <div
      className={`price-tag-container relative bg-white text-black border border-black rounded-lg p-2 sm:p-2.5 flex flex-col justify-between select-none overflow-hidden ${
        isPrintVersion
          ? "print-tag-sheet"
          : "shadow-sm aspect-[5/3] w-full max-w-[280px]"
      } ${className}`}
      style={{
        width: isPrintVersion ? "50mm" : undefined,
        height: isPrintVersion ? "30mm" : undefined,
        maxWidth: isPrintVersion ? "50mm" : "280px",
        maxHeight: isPrintVersion ? "30mm" : undefined,
        boxSizing: "border-box",
      }}
    >
      {/* Top Header: Brand (Left) & SKU (Right) */}
      <div className="flex items-center justify-between gap-1 leading-none border-b border-black pb-1">
        <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-tight text-black truncate max-w-[65%]">
          {brandDisplay}
        </span>
        <span className="text-[9px] sm:text-[10px] font-mono font-bold text-black shrink-0">
          {skuDisplay}
        </span>
      </div>

      {/* Middle row: Product Name (up to 2 lines) */}
      <div className="my-auto py-0.5">
        <div className={`${nameFontSizeClass} font-bold text-black line-clamp-2 leading-tight`}>
          {productName}
        </div>
      </div>

      {/* Bottom row: Large Selling Price (Left) + Scannable QR (Right) */}
      <div className="flex items-end justify-between gap-1.5 pt-1">
        {/* Large Selling Price (Clean, no SALE graphics, no MSRP/STORE labels) */}
        <div className="flex-1 min-w-0">
          {effectiveRegularPrice !== null ? (
            <div className={`${regularPriceFontSizeClass} font-black text-black leading-none tracking-tight`}>
              ${effectiveRegularPrice.toFixed(2)}
            </div>
          ) : (
            <div className="text-base sm:text-lg font-bold text-black leading-none">
              Set Price
            </div>
          )}
        </div>

        {/* Canonical QR Code + SCAN FOR INFO */}
        <div className="w-[30%] sm:w-[28%] flex flex-col items-center shrink-0">
          <div className="w-full aspect-square relative bg-white">
            {qrDataUrl ? (
              <Image
                src={qrDataUrl}
                alt={`QR code for ${productName}`}
                fill
                className="object-contain"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[7px] font-bold text-black">
                QR
              </div>
            )}
          </div>
          <span className="text-[6px] sm:text-[7px] font-extrabold text-black tracking-tight mt-0.5 whitespace-nowrap text-center block">
            SCAN FOR INFO
          </span>
        </div>
      </div>
    </div>
  );
}
