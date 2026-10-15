"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TrainingProductDetail, QuizQuestionGradeResult } from "@/lib/retailer/training";
import {
  toggleProductTrainingAction,
  submitRetailerQuizAction,
} from "@/app/retailer/training/actions";

interface TrainingDetailViewProps {
  product: TrainingProductDetail;
  storeId?: string;
}

export function TrainingDetailView({ product, storeId }: TrainingDetailViewProps) {
  const router = useRouter();
  const [isCompleted, setIsCompleted] = useState(product.isCompleted);
  const [isPending, startTransition] = useTransition();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Interactive Quiz State: Server-authoritative grading & incorrect-only retries
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [questionResults, setQuestionResults] = useState<Record<number, QuizQuestionGradeResult>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizPassed, setQuizPassed] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [isSubmittingQuiz, startQuizTransition] = useTransition();

  const hasQuiz = Array.isArray(product.quizQuestions) && product.quizQuestions.length > 0;
  const allQuizAnswered = hasQuiz && product.quizQuestions.every((_, i) => selectedAnswers[i] !== undefined);

  const incorrectCount = hasQuiz
    ? product.quizQuestions.filter((_, idx) => questionResults[idx] && !questionResults[idx].isCorrect).length
    : 0;

  const handleSelectAnswer = (qIndex: number, optionIndex: number) => {
    // If question was already graded correct, preserve it and keep it locked!
    if (questionResults[qIndex]?.isCorrect) return;
    setSelectedAnswers((prev) => ({ ...prev, [qIndex]: optionIndex }));
  };

  const handleSubmitQuiz = () => {
    if (!allQuizAnswered || isSubmittingQuiz) return;
    startQuizTransition(async () => {
      const res = await submitRetailerQuizAction(product.id, selectedAnswers);
      if (res.success) {
        setQuizSubmitted(true);
        setQuizPassed(res.passed);
        setQuizScore(res.score);
        const resultMap: Record<number, QuizQuestionGradeResult> = {};
        res.results.forEach((r) => {
          resultMap[r.questionIndex] = r;
        });
        setQuestionResults(resultMap);
        if (res.passed) {
          setIsCompleted(true);
          router.refresh();
        }
      } else {
        alert(res.error || "Failed to submit assessment quiz.");
      }
    });
  };

  const handleResetQuiz = () => {
    setSelectedAnswers({});
    setQuestionResults({});
    setQuizSubmitted(false);
    setQuizPassed(false);
    setQuizScore(0);
  };

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

  const storeQuery = storeId && storeId !== "all" ? `?store=${storeId}` : "";
  const backUrl = `/training${storeQuery}`;
  const nextUrl = product.nextProductId
    ? `/training/${product.nextProductId}${storeQuery}`
    : null;
  const prevUrl = product.prevProductId
    ? `/training/${product.prevProductId}${storeQuery}`
    : null;

  const currentImage = product.images[selectedImageIndex]?.url || product.thumbnailUrl;
  const isQuizPassed = hasQuiz && (quizPassed || (product.completionStatus === "verified" && !quizSubmitted));

  return (
    <div className="w-full max-w-5xl space-y-6 pb-24">
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

      {/* Preparation Status Warning (if in draft / preparing) */}
      {product.trainingStatus === "preparing" && (
        <div className="rounded-2xl p-4 border border-purple-200 dark:border-purple-800/80 bg-purple-50/70 dark:bg-purple-950/40 text-purple-950 dark:text-purple-200 flex items-start sm:items-center gap-3 shadow-2xs">
          <span className="text-xl shrink-0">⏳</span>
          <div className="text-xs space-y-0.5">
            <h4 className="font-bold">Training Module In Preparation (Review Mode)</h4>
            <p className="text-purple-800 dark:text-purple-300">
              This product was ordered or stocked by your store. You can review the grounded study guide and verified media assets below while final network publication is being finalized.
            </p>
          </div>
        </div>
      )}

      {/* Completion Status Alert Banner (Phase 1) */}
      <div
        className={`rounded-2xl p-4 sm:p-5 border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm ${
          isCompleted
            ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80 text-emerald-950 dark:text-emerald-200"
            : product.completionStatus === "legacy_needs_verification"
            ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/80 text-amber-950 dark:text-amber-200"
            : "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/80 text-blue-950 dark:text-blue-200"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black shrink-0 ${
              isCompleted
                ? "bg-emerald-500 text-white"
                : product.completionStatus === "legacy_needs_verification"
                ? "bg-amber-500 text-white"
                : "bg-blue-600 text-white"
            }`}
          >
            {isCompleted ? "✓" : product.completionStatus === "legacy_needs_verification" ? "⚠️" : "📖"}
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black">
              {isCompleted
                ? "Training Module Verified Complete!"
                : product.completionStatus === "legacy_needs_verification"
                ? "Quiz Verification Required"
                : "Staff Training Guide"}
            </h2>
            <p className="text-xs opacity-90">
              {isCompleted
                ? "You have completed certified staff training for this product. You can review or proceed to the next item."
                : product.completionStatus === "legacy_needs_verification"
                ? "This product was marked complete under legacy self-attestation. Pass the assessment quiz below to earn certified store coverage."
                : "Review the grounded product guide below, then complete the quiz or mark training finished."}
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
          ) : product.completionStatus === "legacy_needs_verification" ? (
            <a
              href="#quiz-section"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-700 text-white shadow-sm shadow-amber-500/20 flex items-center justify-center gap-1.5 transition-transform active:scale-95"
            >
              <span>Take Quiz to Verify</span>
              <span>↓</span>
            </a>
          ) : !hasQuiz ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleToggleCompletion(true)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-60"
            >
              <span>{isPending ? "Saving..." : "✓ Mark Training Complete"}</span>
            </button>
          ) : (
            <a
              href="#quiz-section"
              className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-100/70 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-900 text-center hover:bg-blue-200/70 transition-colors"
            >
              100% Quiz score required to complete ↓
            </a>
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
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  const fallback = e.currentTarget.parentElement?.querySelector(".fallback-placeholder");
                  if (fallback) (fallback as HTMLElement).style.display = "flex";
                }}
              />
            ) : null}
            <div
              className={`fallback-placeholder w-full h-full flex-col items-center justify-center text-center p-6 space-y-2 bg-gradient-to-b from-zinc-50 to-zinc-100/90 dark:from-zinc-800/40 dark:to-zinc-900/60 ${
                currentImage ? "hidden" : "flex"
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shadow-2xs">
                <svg className="w-6 h-6 text-zinc-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              </div>
              <div className="space-y-0.5 max-w-[200px]">
                <span className="text-[10px] font-extrabold tracking-wider text-zinc-400 dark:text-zinc-500 uppercase block">K SELECT</span>
                <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 block">{product.brandName}</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-200/60 dark:bg-zinc-800/80 border border-zinc-300/40 dark:border-zinc-700/40">
                {product.sku}
              </span>
            </div>
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

          {/* 1. What It Is Quick Summary Box */}
          <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">💡</span>
              <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Quick Overview
              </span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium">
              {product.trainingSummary}
            </p>
            {product.targetCustomer && (
              <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60">
                <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 block mb-0.5">
                  Best For / Target Customer:
                </span>
                <span className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium">
                  {product.targetCustomer}
                </span>
              </div>
            )}
          </div>

          {/* Infographic Visual Card (if available) */}
          {product.infographicUrl && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-950">
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/80 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <span>📊</span> Official Product Infographic
                </span>
                <span className="text-[10px] uppercase font-mono font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                  Approved Media
                </span>
              </div>
              <img
                src={product.infographicUrl}
                alt="Product Infographic"
                className="w-full h-auto object-cover max-h-72"
              />
            </div>
          )}
        </div>
      </div>

      {/* Structured Training Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 2. KEY BENEFITS & BENEFIT GRAPHIC */}
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-base font-bold">
                ✨
              </div>
              <div>
                <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider">
                  Top 3 Benefits
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Primary selling reasons customers buy
                </p>
              </div>
            </div>

            {/* Approved Benefit Graphic (if available) */}
            {product.benefitGraphicUrl && (
              <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800/60 overflow-hidden bg-indigo-50/20">
                <img
                  src={product.benefitGraphicUrl}
                  alt="Benefit Graphic"
                  className="w-full h-auto object-cover max-h-64"
                />
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 border-t border-indigo-100 dark:border-indigo-900/60 flex items-center justify-between">
                  <span>✨ Approved Benefit Graphic</span>
                  <span className="text-[9px] uppercase tracking-wider font-mono">Verified Claim</span>
                </div>
              </div>
            )}

            <ul className="space-y-2.5">
              {product.keyBenefits.map((benefit, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                  <span className="text-indigo-500 font-bold shrink-0 mt-0.5">•</span>
                  <span className="leading-relaxed font-medium">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 3. 15-SECOND PITCH & KEY SELLING POINTS */}
        <div className="rounded-3xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/10 p-6 space-y-4 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 border-b border-amber-200/60 dark:border-amber-900/60 pb-3">
              <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center text-base font-bold">
                🗣️
              </div>
              <div>
                <h3 className="text-sm font-black text-amber-950 dark:text-amber-200 uppercase tracking-wider">
                  15-Second Counter Pitch & Selling Points
                </h3>
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  Direct talk-tracks for retail staff
                </p>
              </div>
            </div>

            {/* 15s Counter Pitch Callout */}
            {product.pitch15s && (
              <div className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-100/60 dark:bg-amber-900/30 p-4 space-y-1.5 shadow-2xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1">
                  <span>💬</span> 15-Second Counter Pitch
                </span>
                <p className="text-xs sm:text-sm text-amber-950 dark:text-amber-100 font-bold italic leading-relaxed">
                  &ldquo;{product.pitch15s}&rdquo;
                </p>
              </div>
            )}

            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
                Quick Selling Points:
              </span>
              <ul className="space-y-2.5">
                {product.sellingPoints.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs text-zinc-800 dark:text-zinc-200 font-medium">
                    <span className="w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* 4. BEST FOR & LIFESTYLE IN-CONTEXT */}
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center text-base font-bold">
              🎯
            </div>
            <div>
              <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider">
                Target Customer & Fit
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Skin/hair profiles and recommended customer types
              </p>
            </div>
          </div>

          {/* Lifestyle Image (if available) */}
          {product.lifestyleImageUrl && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-zinc-50 dark:bg-zinc-800">
              <img
                src={product.lifestyleImageUrl}
                alt="Lifestyle Representation"
                className="w-full h-auto object-cover max-h-60"
              />
              <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-600 dark:text-zinc-300 border-t border-zinc-200 dark:border-zinc-700">
                📸 In-Context Lifestyle Visual
              </div>
            </div>
          )}

          <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed bg-zinc-50 dark:bg-zinc-800/60 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 font-medium">
            {product.targetCustomer || "Suitable for customers seeking high quality daily Korean care."}
          </p>
        </div>

        {/* 5. HOW TO USE & HOW-TO GRAPHIC */}
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
                Application routine and store recommendation guide
              </p>
            </div>
          </div>

          {/* How-To Graphic (if available) */}
          {product.howToGraphicUrl && (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 overflow-hidden bg-emerald-50/20">
              <img
                src={product.howToGraphicUrl}
                alt="How to Use Graphic"
                className="w-full h-auto object-cover max-h-60"
              />
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border-t border-emerald-100 dark:border-emerald-900/60">
                🧴 Application Steps
              </div>
            </div>
          )}

          <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed bg-zinc-50 dark:bg-zinc-800/60 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 whitespace-pre-line">
            {product.howToUse}
          </p>
        </div>
      </div>

      {/* 6. KEY INGREDIENTS & STORAGE PRECAUTIONS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-3 shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center text-base font-bold">
              🌿
            </div>
            <div>
              <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider">
                Key Ingredients
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Active functional components
              </p>
            </div>
          </div>
          <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed bg-zinc-50 dark:bg-zinc-800/60 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
            {product.keyIngredients}
          </p>
        </div>

        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-3 shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center text-base font-bold">
              ⚠️
            </div>
            <div>
              <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider">
                Storage & Important Precautions
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Handling guidelines for shelf longevity
              </p>
            </div>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed bg-zinc-50 dark:bg-zinc-800/60 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
            {product.storageHandlingSop || product.importantNotes || "Store in a cool, dry place away from direct sunlight."}
          </p>
        </div>
      </div>

      {/* 7. CUSTOMER QUESTIONS & OFFICIAL ANSWERS (OBJECTIONS) */}
      {product.customerObjections && product.customerObjections.length > 0 && (
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center text-base font-bold">
              💬
            </div>
            <div>
              <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider">
                Customer Questions & Official Answers
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                How to handle common customer inquiries on the retail floor
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {product.customerObjections.map((o, idx) => (
              <div
                key={o.id || idx}
                className="p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 space-y-1.5"
              >
                <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-start gap-1.5">
                  <span className="text-blue-600 font-black">Q:</span>
                  <span>{o.objection}</span>
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-300 flex items-start gap-1.5 pl-4">
                  <span className="text-emerald-600 font-bold shrink-0">A:</span>
                  <span className="leading-relaxed">{o.answer}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8. FUTURE-READY VIDEO MODULE SECTION */}
      <div className="rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-900/60 p-6 text-center space-y-2">
        <div className="w-10 h-10 rounded-2xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-lg mx-auto text-zinc-700 dark:text-zinc-300">
          🎬
        </div>
        <h4 className="text-xs font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
          Product & How-To Video Learning
        </h4>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
          {product.videoUrl ? (
            <video src={product.videoUrl} controls className="w-full rounded-2xl max-h-72 mt-2" />
          ) : (
            "Short-form staff training videos are currently in production and will appear here automatically upon release."
          )}
        </p>
      </div>

      {/* 9. STAFF UNDERSTANDING QUIZ SECTION */}
      {hasQuiz && (
        <div id="quiz-section" className="rounded-3xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20 p-6 sm:p-8 space-y-6 shadow-sm scroll-mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-100 dark:border-indigo-900/60 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-lg font-black shrink-0">
                🎯
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-indigo-950 dark:text-indigo-100 uppercase tracking-tight">
                  Staff Understanding Assessment ({product.quizQuestions.length} Questions)
                </h3>
                <p className="text-xs text-indigo-700 dark:text-indigo-300">
                  Quickly test your product knowledge before recommending to retail customers.
                </p>
              </div>
            </div>

            {quizSubmitted && (
              <button
                type="button"
                onClick={handleResetQuiz}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline self-start sm:self-auto"
              >
                Reset Quiz
              </button>
            )}
          </div>

          {/* Congratulatory banner if passed */}
          {isQuizPassed && (
            <div className="rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 p-5 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white text-lg font-bold flex items-center justify-center mx-auto shadow-sm">
                ✓
              </div>
              <h4 className="text-sm font-black text-emerald-900 dark:text-emerald-100">
                100% Score! Training Verified
              </h4>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                You correctly answered all {product.quizQuestions.length} questions and are fully prepared to answer customer questions for {product.name}!
              </p>
            </div>
          )}

          {/* Review banner if submitted but not passed */}
          {quizSubmitted && !quizPassed && (
            <div className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 p-4 space-y-1">
              <div className="flex items-center gap-2 text-xs font-black text-amber-900 dark:text-amber-200">
                <span>⚠️</span>
                <span>Score: {quizScore} of {product.quizQuestions.length} correct</span>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Review the tips on the incorrect question(s) below. Correct questions are preserved — choose a new answer for the remaining question(s) and submit again.
              </p>
            </div>
          )}

          {/* Quiz Questions List */}
          <div className="space-y-4">
            {product.quizQuestions.map((q, qIdx) => {
              const selected = selectedAnswers[qIdx];
              const result = questionResults[qIdx];
              const isCorrect = result?.isCorrect === true;
              const isWrong = result && !result.isCorrect;

              return (
                <div
                  key={q.id || qIdx}
                  className={`p-4 rounded-2xl border space-y-3 transition-all ${
                    isCorrect
                      ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800"
                      : isWrong
                      ? "bg-rose-50/60 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800"
                      : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500">
                    <span>QUESTION {qIdx + 1} OF {product.quizQuestions.length}</span>
                    {result && (
                      <span className={isCorrect ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                        {isCorrect ? "✓ Correct" : "✕ Review Recommended (Retry Available)"}
                      </span>
                    )}
                  </div>

                  <p className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white leading-snug">
                    {q.question}
                  </p>

                  <div className="space-y-2 pt-1">
                    {q.options.map((opt, optIdx) => {
                      const isOptionSelected = selected === optIdx;
                      return (
                        <button
                          key={optIdx}
                          type="button"
                          disabled={isCorrect || isSubmittingQuiz}
                          onClick={() => handleSelectAnswer(qIdx, optIdx)}
                          className={`w-full text-left p-3 rounded-xl border text-xs flex items-center gap-2.5 transition-all ${
                            isOptionSelected
                              ? isCorrect
                                ? "border-emerald-500 bg-emerald-100/70 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-100 font-bold"
                                : isWrong
                                ? "border-rose-400 bg-rose-100/70 dark:bg-rose-950/50 text-rose-950 dark:text-rose-200 font-bold"
                                : "border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-950 dark:text-indigo-200 font-bold shadow-2xs"
                              : isCorrect
                              ? "opacity-50 border-zinc-200 dark:border-zinc-800 cursor-not-allowed bg-zinc-50 dark:bg-zinc-800/40 text-zinc-500"
                              : "border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          }`}
                        >
                          <span className="w-5 h-5 rounded-full border border-zinc-300 dark:border-zinc-600 flex items-center justify-center text-[10px] shrink-0 font-bold">
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span className="leading-snug">{opt}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Feedback Explanation */}
                  {result && (
                    <div
                      className={`p-3 rounded-xl border text-xs space-y-1 ${
                        isCorrect
                          ? "bg-emerald-100/50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-900 dark:text-emerald-200"
                          : "bg-rose-100/50 dark:bg-rose-950/40 border-rose-200 text-rose-900 dark:text-rose-200"
                      }`}
                    >
                      <span className="font-bold block">
                        {isCorrect ? "✓ Official Explanation:" : "💡 Review Tip:"}
                      </span>
                      <p className="leading-relaxed">{result.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Submit Quiz / Retry Button */}
          {!quizPassed && (
            <div className="space-y-3">
              {quizSubmitted && !quizPassed ? (
                <button
                  type="button"
                  disabled={isSubmittingQuiz}
                  onClick={handleSubmitQuiz}
                  className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-bold text-xs shadow-md transition-all active:scale-95"
                >
                  {isSubmittingQuiz ? "Re-evaluating Answers..." : `Retry Incorrect Questions (${incorrectCount} remaining)`}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!allQuizAnswered || isSubmittingQuiz}
                  onClick={handleSubmitQuiz}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs shadow-md transition-all active:scale-95"
                >
                  {isSubmittingQuiz
                    ? "Evaluating on Server..."
                    : `Submit Quiz Answers (${Object.keys(selectedAnswers).length}/${product.quizQuestions.length})`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer Sticky Navigation Bar */}
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
          ) : !hasQuiz ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleToggleCompletion(true)}
              className="px-6 py-2.5 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-60"
            >
              <span>{isPending ? "Saving..." : "✓ Mark Training Complete"}</span>
            </button>
          ) : (
            <a
              href="#quiz-section"
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <span>Take Quiz to Complete</span>
              <span>↓</span>
            </a>
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
