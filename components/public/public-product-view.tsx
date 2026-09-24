"use client";

import React, { useState } from "react";
import Image from "next/image";
import { PublicProductDetail } from "@/lib/product/public";

interface PublicProductViewProps {
  product: PublicProductDetail;
}

export function PublicProductView({ product }: PublicProductViewProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const activeImage =
    product.images && product.images.length > 0
      ? product.images[selectedImageIndex]?.url
      : null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 antialiased py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Brand Header */}
        <header className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              KS
            </div>
            <div>
              <div className="text-xs font-bold text-purple-600 dark:text-purple-400 tracking-wider uppercase">
                K SELECT NETWORK
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Verified Authentic K-Beauty
              </div>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            ✓ Authentic Korean Product
          </span>
        </header>

        {/* Main Product Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 shadow-sm">
          {/* Gallery */}
          <div className="space-y-4">
            <div className="relative aspect-square w-full rounded-2xl bg-zinc-100 dark:bg-zinc-800 overflow-hidden border border-zinc-200 dark:border-zinc-700/60 shadow-inner">
              {activeImage ? (
                <Image
                  src={activeImage}
                  alt={product.name}
                  fill
                  className="object-contain p-4"
                  priority
                  sizes="(max-width: 768px) 100vw, 450px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-5xl text-zinc-400">
                  🧴
                </div>
              )}
            </div>

            {/* Thumbnail selector */}
            {product.images.length > 1 && (
              <div className="flex gap-2.5 overflow-x-auto pb-1">
                {product.images.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all ${
                      selectedImageIndex === idx
                        ? "border-purple-600 dark:border-purple-400 shadow-sm"
                        : "border-zinc-200 dark:border-zinc-700 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <Image
                      src={img.url}
                      alt={`Thumbnail ${idx + 1}`}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300">
                  {product.brandName}
                </span>
                <span className="px-2.5 py-0.5 rounded-lg text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {product.categoryLabel}
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-900 dark:text-white leading-tight">
                {product.name}
              </h1>
              {product.nameEn && (
                <p className="text-xs sm:text-sm text-zinc-400 font-normal">{product.nameEn}</p>
              )}
            </div>

            {/* Specifications Snapshot */}
            <div className="grid grid-cols-2 gap-3 p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-100 dark:border-zinc-800 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-400">Origin</span>
                <div className="font-semibold text-zinc-900 dark:text-zinc-200 mt-0.5">
                  🇰🇷 {product.origin}
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-400">Volume / Size</span>
                <div className="font-semibold text-zinc-900 dark:text-zinc-200 mt-0.5">
                  {product.volume || "Standard Size"}
                </div>
              </div>
            </div>

            {/* Key Benefits */}
            {product.bulletPoints.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Key Features & Benefits
                </h2>
                <ul className="space-y-1.5 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
                  {product.bulletPoints.map((bp, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-purple-500 font-bold">•</span>
                      <span>{bp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Description */}
            {product.description && (
              <div className="space-y-2 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  About This Product
                </h2>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-line">
                  {product.description}
                </p>
              </div>
            )}

            {/* Ingredients / Usage */}
            {product.ingredientsText && (
              <div className="space-y-2 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Ingredients & Formulation
                </h2>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-500 leading-relaxed max-h-32 overflow-y-auto pr-1">
                  {product.ingredientsText}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <footer className="text-center text-[11px] text-zinc-400 dark:text-zinc-600 pt-4">
          <p>© {new Date().getFullYear()} K SELECT NETWORK. All rights reserved.</p>
          <p className="mt-0.5">Authenticity verified through official brand distribution network.</p>
        </footer>
      </div>
    </div>
  );
}
