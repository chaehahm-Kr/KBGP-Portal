"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProtectionItemDetail } from "@/lib/retailer/protection";
import {
  requestProtectionReviewAction,
  respondToProtectionInfoAction,
} from "@/app/retailer/protection/actions";

interface ProtectionDetailViewProps {
  protection: ProtectionItemDetail;
  userRole: string;
}

export function ProtectionDetailView({
  protection,
  userRole,
}: ProtectionDetailViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showNotesInput, setShowNotesInput] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [showClarificationInput, setShowClarificationInput] = useState(false);
  const [clarificationNotes, setClarificationNotes] = useState("");
  const [currentStatus, setCurrentStatus] = useState(protection.status);

  const handleRequestReview = () => {
    startTransition(async () => {
      const res = await requestProtectionReviewAction(protection.id, reviewNotes);
      if (res.success) {
        setCurrentStatus("review_requested");
        setShowNotesInput(false);
        router.refresh();
      } else {
        alert(res.error || "Failed to submit protection review request");
      }
    });
  };

  const handleRespondClarification = () => {
    if (!clarificationNotes.trim()) {
      alert("Please enter a clarification note.");
      return;
    }
    startTransition(async () => {
      const res = await respondToProtectionInfoAction(protection.id, clarificationNotes);
      if (res.success) {
        setCurrentStatus("review_requested");
        setShowClarificationInput(false);
        router.refresh();
      } else {
        alert(res.error || "Failed to submit clarification");
      }
    });
  };

  const isThresholdMet = protection.sellThroughPercent >= 50;
  const isAuthorized = userRole === "owner" || userRole === "buyer";

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Top Navigation */}
      <div className="flex items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <Link
          href="/protection"
          className="inline-flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          <span>←</span>
          <span>Back to All 90-Day Protections</span>
        </Link>

        <span className="text-xs font-mono font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg">
          SKU: {protection.sku}
        </span>
      </div>

      {/* Status Alert Banner */}
      <div
        className={`rounded-3xl p-6 border transition-all space-y-4 shadow-sm ${
          currentStatus === "approved"
            ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200"
            : currentStatus === "rejected"
            ? "bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-200"
            : currentStatus === "needs_information"
            ? "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-950 dark:text-blue-200"
            : currentStatus === "threshold_met"
            ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200"
            : currentStatus === "review_available"
            ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200"
            : currentStatus === "review_requested"
            ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200"
            : "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-950 dark:text-blue-200"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black shrink-0 ${
                currentStatus === "approved"
                  ? "bg-emerald-600 text-white"
                  : currentStatus === "rejected"
                  ? "bg-zinc-700 text-white"
                  : currentStatus === "needs_information"
                  ? "bg-blue-600 text-white"
                  : currentStatus === "threshold_met"
                  ? "bg-emerald-500 text-white"
                  : currentStatus === "review_available"
                  ? "bg-amber-500 text-white"
                  : currentStatus === "review_requested"
                  ? "bg-indigo-600 text-white"
                  : "bg-blue-600 text-white"
              }`}
            >
              {currentStatus === "approved"
                ? "✓"
                : currentStatus === "rejected"
                ? "✕"
                : currentStatus === "needs_information"
                ? "💬"
                : currentStatus === "threshold_met"
                ? "✓"
                : currentStatus === "review_available"
                ? "⚠️"
                : currentStatus === "review_requested"
                ? "📋"
                : "🛡️"}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black">
                {currentStatus === "approved"
                  ? "Protection Review Approved"
                  : currentStatus === "rejected"
                  ? "Protection Review Not Approved"
                  : currentStatus === "needs_information"
                  ? "Additional Information Requested"
                  : currentStatus === "threshold_met"
                  ? "Protection Threshold Met!"
                  : currentStatus === "review_available"
                  ? "90-Day Period Ended — Review Available"
                  : currentStatus === "review_requested"
                  ? "Protection Review Requested"
                  : "Active 90-Day Initial Trial"}
              </h2>
              <p className="text-xs sm:text-sm opacity-90 leading-relaxed">
                {currentStatus === "approved"
                  ? "K SELECT Operations has approved your trial protection review. Credit processing remains pending until formal issuance."
                  : currentStatus === "rejected"
                  ? "K SELECT Operations has reviewed this trial. See resolution details below."
                  : currentStatus === "needs_information"
                  ? "K SELECT Operations has requested additional clarification or store count verification before concluding the review."
                  : currentStatus === "threshold_met"
                  ? `Company-wide estimated sell-through reached ${protection.sellThroughPercent}%, safely exceeding the 50% program threshold.`
                  : currentStatus === "review_available"
                  ? `Estimated sell-through (${protection.sellThroughPercent}%) is below 50% after the 90-day trial. You are eligible to submit a K SELECT Protection Review.`
                  : currentStatus === "review_requested"
                  ? `Review request recorded on ${protection.reviewRequestedAt ? new Date(protection.reviewRequestedAt).toLocaleDateString() : "recently"}. K SELECT operations will audit store counts and contact you.`
                  : `Currently on Day ${protection.daysElapsed} of 90 (${protection.daysRemaining} days remaining in trial window).`}
              </p>
            </div>
          </div>

          {currentStatus === "review_available" && !showNotesInput && (
            <div className="shrink-0">
              {isAuthorized ? (
                <button
                  type="button"
                  onClick={() => setShowNotesInput(true)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20 flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
                >
                  <span>🛡️ Request Protection Review</span>
                </button>
              ) : (
                <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  (Owner / Buyer Authorization Required)
                </span>
              )}
            </div>
          )}

          {currentStatus === "needs_information" && !showClarificationInput && isAuthorized && (
            <div className="shrink-0">
              <button
                type="button"
                onClick={() => setShowClarificationInput(true)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
              >
                <span>💬 Submit Clarification Response</span>
              </button>
            </div>
          )}
        </div>

        {/* Approved Detail Strip */}
        {currentStatus === "approved" && (
          <div className="pt-3 border-t border-emerald-200 dark:border-emerald-800/60 flex flex-wrap items-center gap-4 text-xs">
            {protection.approvedQuantity !== null && (
              <div>
                <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                  Approved Protection Qty:
                </span>{" "}
                <span className="font-black text-emerald-950 dark:text-emerald-100">
                  {protection.approvedQuantity} units
                </span>
              </div>
            )}
            {protection.approvedCreditAmount !== null && (
              <div>
                <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                  Approved Credit Amount:
                </span>{" "}
                <span className="font-black text-emerald-950 dark:text-emerald-100">
                  ${protection.approvedCreditAmount.toFixed(2)}
                </span>
              </div>
            )}
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-200/60 dark:bg-emerald-900/60 font-bold">
              <span>Credit Processing:</span>
              <span>Pending</span>
            </div>
          </div>
        )}

        {/* Admin Decision Notes Display */}
        {protection.decisionNotes && (
          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 text-xs">
            <span className="font-bold opacity-80 block mb-1">
              Admin Resolution Note:
            </span>
            <p className="opacity-90 leading-relaxed whitespace-pre-wrap">
              {protection.decisionNotes}
            </p>
          </div>
        )}

        {/* Review Notes submission box */}
        {showNotesInput && (
          <div className="pt-4 border-t border-amber-200 dark:border-amber-800/60 space-y-3">
            <label className="text-xs font-bold text-amber-900 dark:text-amber-200 block">
              Additional Feedback / Merchandising Notes (Optional):
            </label>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="e.g. Products were displayed on front beauty shelf. Customer feedback was positive on texture but price point was slow..."
              rows={3}
              className="w-full rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-900 p-3 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={handleRequestReview}
                className="px-4 py-2 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-700 text-white shadow-sm disabled:opacity-60 cursor-pointer"
              >
                {isPending ? "Submitting..." : "Confirm & Submit Review Request"}
              </button>
              <button
                type="button"
                onClick={() => setShowNotesInput(false)}
                className="px-3 py-2 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-amber-100 dark:hover:bg-amber-900/60"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Clarification Response Box */}
        {showClarificationInput && (
          <div className="pt-4 border-t border-blue-200 dark:border-blue-800/60 space-y-3">
            <label className="text-xs font-bold text-blue-900 dark:text-blue-200 block">
              Provide Requested Clarification or Store Verification:
            </label>
            <textarea
              value={clarificationNotes}
              onChange={(e) => setClarificationNotes(e.target.value)}
              placeholder="e.g. Physical inventory count verified across all shelves as requested..."
              rows={3}
              className="w-full rounded-xl border border-blue-300 dark:border-blue-700 bg-white dark:bg-zinc-900 p-3 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={handleRespondClarification}
                className="px-4 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-sm disabled:opacity-60 cursor-pointer"
              >
                {isPending ? "Submitting..." : "Send Clarification Response"}
              </button>
              <button
                type="button"
                onClick={() => setShowClarificationInput(false)}
                className="px-3 py-2 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-blue-100 dark:hover:bg-blue-900/60"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Product Card Showcase */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 shadow-sm">
        <div className="md:col-span-4 flex items-center justify-center">
          <div className="relative aspect-square w-full rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 p-4 border border-zinc-100 dark:border-zinc-800 flex items-center justify-center overflow-hidden">
            {protection.thumbnailUrl ? (
              <img
                src={protection.thumbnailUrl}
                alt={protection.productName}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-4xl text-zinc-300">📦</div>
            )}
            <div className="absolute top-3 left-3">
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-zinc-900 text-white">
                {protection.brandName}
              </span>
            </div>
          </div>
        </div>

        <div className="md:col-span-8 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                {protection.categoryLabel}
              </span>
              {protection.volume && (
                <span className="text-xs text-zinc-500">Size: {protection.volume}</span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight leading-snug">
              {protection.productName}
            </h1>

            {protection.description && (
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-3">
                {protection.description}
              </p>
            )}
          </div>

          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
            <Link
              href={`/training/${protection.productId}`}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>🎓 View Product Training Guide</span>
              <span>→</span>
            </Link>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <Link
              href={`/products/${protection.productId}`}
              className="text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1"
            >
              <span>View Product Detail</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Performance Gauge & Key Metrics Strip */}
      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-7 space-y-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-base">📊</span>
            <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider">
              Company-Wide Trial Performance
            </h3>
          </div>
          <span className="text-xs font-bold text-zinc-500">
            Aggregated Across All Company Stores
          </span>
        </div>

        {/* Big Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-zinc-600 dark:text-zinc-400">
              {protection.isPeriodEnded
                ? "Trial Window: 90 Days Completed"
                : `Trial Window: Day ${protection.daysElapsed} of 90 (${protection.daysRemaining} days left)`}
            </span>
            <span
              className={
                isThresholdMet
                  ? "text-emerald-600 dark:text-emerald-400 font-extrabold text-sm"
                  : "text-blue-600 dark:text-blue-400 font-extrabold text-sm"
              }
            >
              {protection.sellThroughPercent}% Estimated Sell-Through
            </span>
          </div>

          <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-4 overflow-hidden relative">
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-zinc-400 dark:bg-zinc-500 z-10" />
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isThresholdMet ? "bg-emerald-500" : "bg-blue-600"
              }`}
              style={{ width: `${protection.sellThroughPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-zinc-400 font-medium">
            <span>0 units moved</span>
            <span className="text-zinc-600 dark:text-zinc-300 font-bold">
              50% Program Threshold ({Math.ceil(protection.protectedQuantity * 0.5)} units)
            </span>
            <span>{protection.protectedQuantity} units (100%)</span>
          </div>
        </div>

        {/* 4-Box Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
              Protected Quantity
            </span>
            <span className="text-lg font-black text-zinc-900 dark:text-white">
              {protection.protectedQuantity}
            </span>
            <span className="text-[10px] text-zinc-400 block mt-0.5">Original trial units</span>
          </div>

          <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
              Estimated Movement
            </span>
            <span className="text-lg font-black text-zinc-900 dark:text-white">
              {protection.estimatedMovement}
            </span>
            <span className="text-[10px] text-zinc-400 block mt-0.5">All stores combined</span>
          </div>

          <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
              Trial Dates
            </span>
            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
              {protection.trialStartDate}
            </span>
            <span className="text-[10px] text-zinc-400 block mt-0.5">to {protection.trialEndDate}</span>
          </div>

          <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
              Data Coverage
            </span>
            <span className="text-lg font-black text-zinc-900 dark:text-white">
              {protection.dataCoveragePercent}%
            </span>
            <span className="text-[10px] text-zinc-400 block mt-0.5">
              {protection.storesReporting}/{protection.totalStores} stores reporting
            </span>
          </div>
        </div>
      </div>

      {/* Store Breakdown Table */}
      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-7 space-y-4 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <span className="text-base">🏬</span>
          <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider">
            Store Location Movement Breakdown
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Store Location</th>
                <th className="py-2.5 px-3 text-right">Estimated Movement</th>
                <th className="py-2.5 px-3 text-right">Last Reported Qty</th>
                <th className="py-2.5 px-3 text-right">Reporting Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {protection.storeBreakdown.map((sb) => (
                <tr key={sb.storeId} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <td className="py-3 px-3 font-bold text-zinc-900 dark:text-white">
                    {sb.storeName}
                  </td>
                  <td className="py-3 px-3 text-right font-black text-zinc-900 dark:text-white">
                    {sb.estimatedMovement} units
                  </td>
                  <td className="py-3 px-3 text-right text-zinc-600 dark:text-zinc-300">
                    {sb.currentRemainingQty !== null ? `${sb.currentRemainingQty} units` : "—"}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      ✓ Weekly Check Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Program Integrity Notice */}
      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 p-6 space-y-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="font-bold text-zinc-700 dark:text-zinc-300 block">
          Program Policy & Calculation Standards:
        </span>
        <ul className="space-y-1 list-disc pl-4 leading-relaxed">
          <li>Protection is granted once per Retailer Company × Product upon initial assortment placement.</li>
          <li>Reorders during or after the 90-day period do not create new trial windows or alter the protected initial quantity.</li>
          <li>Performance is calculated based on defensible Weekly Check counts across all participating store branches.</li>
          <li>Protection review requests record your eligibility for K SELECT merchandising and inventory resolution.</li>
        </ul>
      </div>
    </div>
  );
}
