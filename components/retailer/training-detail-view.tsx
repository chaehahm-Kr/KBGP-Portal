"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TrainingProductDetail } from "@/lib/retailer/training";
import { toggleProductTrainingAction } from "@/app/retailer/training/actions";

interface TrainingDetailViewProps {
  product: TrainingProductDetail;
  storeId?: string;
}

export function TrainingDetailView({ product, storeId }: TrainingDetailViewProps) {
  const router = useRouter();
  const [isCompleted, setIsCompleted] = useState(product.isCompleted);
  const [isPending, startTransition] = useTransition();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const handleToggleCompletion = (targetStatus: boolean) => {
    startTransition(async () => {
      const res = await toggleProductTrainingAction(product.id, targetStatus);
      if (res.success) {
        setIsCompleted(targetStatus);
        router.refresh();
      } else {
        alert(res.error || "Failed to update training status");
      }
    });
  };

  const backUrl = `/training${storeId ? `?storeId=${storeId}` : ""}`;
  const nextUrl = product.nextProductId
    ? `/training/${product.nextProductId}${storeId ? `?storeId=${storeId}` : ""}`
    : null;
  const prevUrl = product.prevProductId
    ? `/training/${product.prevProductId}${storeId ? `?storeId=${storeId}` : ""}`
    : null;

  const currentImage = product.images[selectedImageIndex]?.url || product.thumbnailUrl;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Top Navigation & Breadcrumbs */}
      <div className="flex items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <Link
          href={backUrl}
          className="inline-flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          <span>←</span>
          <span>Back to All Training Products</span>
        </Link>

        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          <span className="bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700">
            Product {product.currentIndex} of {product.totalCount}
          </span>
        </div>
      </div>

      {/* Completion Status Alert Banner */}
      <div
        className={`rounded-2xl p-4 sm:p-5 border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm ${
          isCompleted
            ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80 text-emerald-950 dark:text-emerald-200"
            : "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/80 text-blue-950 dark:text-blue-200"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black shrink-0 ${
              isCompleted
                ? "bg-emerald-500 text-white"
                : "bg-blue-600 text-white"
            }`}
          >
            {isCompleted ? "✓" : "📖"}
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black">
              {isCompleted ? "Training Module Completed!" : "Staff Training Guide"}
            </h2>
            <p className="text-xs opacity-90">
              {isCompleted
                ? "You have completed staff training for this product. You can review or proceed to the next item."
                : "Review the quick selling points below, then mark training complete."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
          {isCompleted ? (
            <>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleToggleCompletion(false)}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/60 transition-colors"
              >
                {isPending ? "Updating..." : "Reset"}
              </button>
              {nextUrl && (
                <Link
                  href={nextUrl}
                  className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Next Product</span>
                  <span>→</span>
                </Link>
              )}
            </>
          ) : (
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleToggleCompletion(true)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-60"
            >
              <span>{isPending ? "Saving..." : "✓ Mark Training Complete"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Product Hero Section */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 shadow-sm">
        {/* Media & Image Gallery */}
        <div className="md:col-span-5 space-y-3">
          <div className="relative aspect-square rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 p-6 flex items-center justify-center border border-zinc-100 dark:border-zinc-800 overflow-hidden">
            {currentImage ? (
              <img
                src={currentImage}
                alt={product.name}
                className="w-full h-full object-contain drop-shadow-sm"
              />
            ) : (
              <div className="text-5xl text-zinc-300 dark:text-zinc-600">📦</div>
            )}
            <div className="absolute top-3 left-3">
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-zinc-900 text-white">
                {product.brandName}
              </span>
            </div>
          </div>

          {/* Thumbnails */}
          {product.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {product.images.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`relative w-16 h-16 rounded-xl border-2 p-1 bg-zinc-50 dark:bg-zinc-800 overflow-hidden shrink-0 transition-all ${
                    selectedImageIndex === idx
                      ? "border-blue-600 ring-2 ring-blue-500/20"
                      : "border-zinc-200 dark:border-zinc-700 opacity-70 hover:opacity-100"
                  }`}
                >
                  <img src={img.url} alt="thumbnail" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Identity Specs */}
        <div className="md:col-span-7 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                {product.categoryLabel}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                SKU: {product.sku}
              </span>
              {product.origin && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  📍 {product.origin}
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight leading-snug">
              {product.name}
            </h1>

            {product.nameEn && product.nameEn !== product.name && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                {product.nameEn}
              </p>
            )}

            {product.volume && (
              <p className="text-xs text-zinc-700 dark:text-zinc-300">
                Size / Volume: <span className="font-bold">{product.volume}</span>
              </p>
            )}
          </div>

          {/* What It Is Quick Summary Box */}
          <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">💡</span>
              <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Quick Summary
              </span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium">
              {product.trainingSummary}
            </p>
            {product.targetCustomer && (
              <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60">
                <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 block mb-0.5">
                  Best For:
                </span>
                <span className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  {product.targetCustomer}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Structured Training Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. KEY BENEFITS */}
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-base font-bold">
              ✨
            </div>
            <div>
              <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider">
                Key Benefits
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Why customers choose this product
              </p>
            </div>
          </div>

          <ul className="space-y-2.5">
            {product.keyBenefits.map((benefit, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                <span className="text-indigo-500 font-bold shrink-0 mt-0.5">•</span>
                <span className="leading-relaxed">{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 2. KEY SELLING POINTS & TALK TRACKS */}
        <div className="rounded-3xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-blue-100 dark:border-blue-900/60 pb-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center text-base font-bold">
              🗣️
            </div>
            <div>
              <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider">
                Key Selling Points & Staff Tips
              </h3>
              <p className="text-[11px] text-blue-700 dark:text-blue-300">
                Talk-tracks for store recommendations
              </p>
            </div>
          </div>

          <ul className="space-y-2.5">
            {product.sellingPoints.map((point, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs text-zinc-800 dark:text-zinc-200 font-medium">
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <span className="leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 3. HOW TO USE */}
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-base font-bold">
              🧴
            </div>
            <div>
              <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider">
                How To Use
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Application steps and frequency
              </p>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed bg-zinc-50 dark:bg-zinc-800/60 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
            {product.howToUse}
          </p>
        </div>

        {/* 4. KEY INGREDIENTS */}
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center text-base font-bold">
              🌿
            </div>
            <div>
              <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider">
                Key Ingredients
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Active components & botanical extracts
              </p>
            </div>
          </div>

          <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed bg-zinc-50 dark:bg-zinc-800/60 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
            {product.keyIngredients}
          </p>
        </div>
      </div>

      {/* 5. IMPORTANT NOTES & PRECAUTIONS */}
      {product.importantNotes && (
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Important Notes & Precautions
            </h3>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {product.importantNotes}
          </p>
        </div>
      )}

      {/* Footer Navigation Bar */}
      <div className="sticky bottom-4 z-20 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-lg flex items-center justify-between gap-3">
        <div>
          {prevUrl ? (
            <Link
              href={prevUrl}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors inline-flex items-center gap-1.5"
            >
              <span>←</span>
              <span className="hidden sm:inline">Previous Product</span>
            </Link>
          ) : (
            <div className="w-12" />
          )}
        </div>

        <div>
          {isCompleted ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hidden sm:inline">
                ✓ Completed
              </span>
              {nextUrl && (
                <Link
                  href={nextUrl}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5 transition-colors"
                >
                  <span>Next Product</span>
                  <span>→</span>
                </Link>
              )}
            </div>
          ) : (
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleToggleCompletion(true)}
              className="px-6 py-2.5 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-60"
            >
              <span>{isPending ? "Saving..." : "✓ Mark Training Complete"}</span>
            </button>
          )}
        </div>

        <div>
          {nextUrl ? (
            <Link
              href={nextUrl}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors inline-flex items-center gap-1.5"
            >
              <span className="hidden sm:inline">Next Product</span>
              <span>→</span>
            </Link>
          ) : (
            <Link
              href={backUrl}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors inline-flex items-center gap-1.5"
            >
              <span>Finish</span>
              <span>✓</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
