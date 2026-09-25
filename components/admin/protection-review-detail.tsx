"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AdminProtectionReviewDetail as ProtectionDetailType,
  AdminProtectionDecision,
} from "@/lib/protection/types";
import { submitAdminProtectionDecisionAction } from "@/app/admin/protection-reviews/actions";

interface AdminProtectionReviewDetailProps {
  review: ProtectionDetailType;
}

export function AdminProtectionReviewDetail({
  review,
}: AdminProtectionReviewDetailProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedAction, setSelectedAction] = useState<
    "approve" | "needs_info" | "reject"
  >(review.decision === "approved" ? "approve" : review.decision === "rejected" ? "reject" : review.decision === "needs_information" ? "needs_info" : "approve");

  const [approvedQuantity, setApprovedQuantity] = useState<string>(
    review.approvedQuantity !== null ? String(review.approvedQuantity) : String(Math.max(0, review.protectedQuantity - review.estimatedMovement))
  );
  const [approvedCreditAmount, setApprovedCreditAmount] = useState<string>(
    review.approvedCreditAmount !== null
      ? String(review.approvedCreditAmount)
      : review.initialTrialUnitCost
      ? String((Math.max(0, review.protectedQuantity - review.estimatedMovement) * review.initialTrialUnitCost).toFixed(2))
      : ""
  );
  const [decisionNotes, setDecisionNotes] = useState<string>(review.decisionNotes || "");

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isThresholdMet = review.sellThroughPercent >= 50;

  const handleSubmitDecision = (decision: "approved" | "rejected" | "needs_information") => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (decision === "rejected" && !decisionNotes.trim()) {
      setErrorMsg("A decision note explaining the reason for non-approval is required.");
      return;
    }

    if (decision === "needs_information" && !decisionNotes.trim()) {
      setErrorMsg("Please provide a note specifying the information needed from the retailer.");
      return;
    }

    const parsedQty = approvedQuantity.trim() ? parseInt(approvedQuantity, 10) : null;
    const parsedAmount = approvedCreditAmount.trim() ? parseFloat(approvedCreditAmount) : null;

    if (decision === "approved" && parsedQty !== null && (isNaN(parsedQty) || parsedQty < 0)) {
      setErrorMsg("Approved quantity must be a valid non-negative number.");
      return;
    }

    if (decision === "approved" && parsedAmount !== null && (isNaN(parsedAmount) || parsedAmount < 0)) {
      setErrorMsg("Approved credit amount must be a valid non-negative number.");
      return;
    }

    startTransition(async () => {
      const res = await submitAdminProtectionDecisionAction({
        protectionId: review.id,
        decision,
        decisionNotes,
        approvedQuantity: decision === "approved" ? parsedQty : null,
        approvedCreditAmount: decision === "approved" ? parsedAmount : null,
      });

      if (res.success) {
        setSuccessMsg(`Decision successfully recorded as ${decision.toUpperCase()}.`);
        router.refresh();
      } else {
        setErrorMsg(res.error || "Failed to record decision.");
      }
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <Link
          href="/admin/protection-reviews"
          className="inline-flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          <span>←</span>
          <span>Back to Protection Reviews Queue</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg">
            SKU: {review.sku}
          </span>
          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg">
            {review.companyName}
          </span>
        </div>
      </div>

      {/* Decision Status Banner */}
      <div
        className={`rounded-3xl p-6 border transition-all space-y-3 shadow-sm ${
          review.decision === "approved"
            ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200"
            : review.decision === "rejected"
            ? "bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-200"
            : review.decision === "needs_information"
            ? "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-950 dark:text-blue-200"
            : "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black shrink-0 ${
              review.decision === "approved"
                ? "bg-emerald-600 text-white"
                : review.decision === "rejected"
                ? "bg-zinc-700 text-white"
                : review.decision === "needs_information"
                ? "bg-blue-600 text-white"
                : "bg-amber-500 text-white"
            }`}
          >
            {review.decision === "approved"
              ? "✓"
              : review.decision === "rejected"
              ? "✕"
              : review.decision === "needs_information"
              ? "💬"
              : "⚠️"}
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-black tracking-tight">
              {review.decision === "approved"
                ? "Protection Review Approved"
                : review.decision === "rejected"
                ? "Protection Review Not Approved"
                : review.decision === "needs_information"
                ? "Additional Information Requested"
                : "Protection Review Pending Admin Decision"}
            </h2>
            <p className="text-xs sm:text-sm opacity-90 leading-relaxed">
              {review.decision === "approved"
                ? `Approved by Admin ${review.decisionByEmail || ""} on ${review.decisionAt ? new Date(review.decisionAt).toLocaleDateString() : ""}. Credit Processing Status: Pending.`
                : review.decision === "rejected"
                ? `Rejected on ${review.decisionAt ? new Date(review.decisionAt).toLocaleDateString() : ""}.`
                : review.decision === "needs_information"
                ? "Clarification requested from retailer before making a final resolution."
                : "Retailer has submitted a 90-day protection review request. Evaluate performance data below and make a resolution decision."}
            </p>
          </div>
        </div>

        {review.decision === "approved" && (
          <div className="pt-3 border-t border-emerald-200 dark:border-emerald-800/60 flex flex-wrap items-center gap-4 text-xs">
            <div>
              <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                Approved Protection Qty:
              </span>{" "}
              <span className="font-black text-emerald-950 dark:text-emerald-100">
                {review.approvedQuantity !== null ? `${review.approvedQuantity} units` : "Not specified"}
              </span>
            </div>
            <div>
              <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                Approved Credit Amount:
              </span>{" "}
              <span className="font-black text-emerald-950 dark:text-emerald-100">
                {review.approvedCreditAmount !== null ? `$${review.approvedCreditAmount.toFixed(2)}` : "Not specified"}
              </span>
            </div>
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-200/60 dark:bg-emerald-900/60 font-bold">
              <span>Credit Processing:</span>
              <span>Pending</span>
            </div>
          </div>
        )}
      </div>

      {/* Retailer & Product 2-Column Overview */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Retailer Information Box */}
        <div className="md:col-span-5 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <span className="text-base">🏢</span>
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
              Retailer Company Profile
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Company Name
              </span>
              <span className="text-sm font-black text-zinc-900 dark:text-white block mt-0.5">
                {review.companyName}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Business Type
                </span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200">
                  {review.companyBusinessType || "Retail Store"}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Store Count
                </span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200">
                  {review.totalStores} Store Location{review.totalStores > 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {review.companyContactEmail && (
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Contact Email
                </span>
                <span className="font-mono text-zinc-700 dark:text-zinc-300">
                  {review.companyContactEmail}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Product Information Box */}
        <div className="md:col-span-7 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <span className="text-base">📦</span>
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
              Trial Product Specification
            </h3>
          </div>

          <div className="flex gap-4">
            <div className="w-20 h-20 rounded-2xl bg-zinc-50 dark:bg-zinc-800 p-2 shrink-0 border border-zinc-100 dark:border-zinc-800 flex items-center justify-center overflow-hidden">
              {review.thumbnailUrl ? (
                <img
                  src={review.thumbnailUrl}
                  alt={review.productName}
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-2xl">📦</span>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-zinc-900 text-white">
                {review.brandName}
              </span>
              <h4 className="text-sm font-bold text-zinc-900 dark:text-white line-clamp-2 leading-snug">
                {review.productName}
              </h4>
              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                <span className="font-mono font-bold">{review.sku}</span>
                <span>•</span>
                <span>{review.categoryLabel}</span>
              </div>
            </div>
          </div>

          {/* Pricing References */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Initial Trial Retailer Unit Cost
              </span>
              <span className="text-xs font-black text-zinc-900 dark:text-white block mt-0.5">
                {review.initialTrialUnitCost !== null
                  ? `$${review.initialTrialUnitCost.toFixed(2)}`
                  : "Price Basis Unavailable"}
              </span>
              <span className="text-[9px] text-zinc-400 block mt-0.5">
                {review.sourceOrderNumber ? `From Order ${review.sourceOrderNumber}` : "Historical order snapshot"}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Catalog Wholesale Price Reference
              </span>
              <span className="text-xs font-black text-zinc-900 dark:text-white block mt-0.5">
                {review.currentCatalogWholesalePrice !== null
                  ? `$${review.currentCatalogWholesalePrice.toFixed(2)}`
                  : "N/A"}
              </span>
              <span className="text-[9px] text-zinc-400 block mt-0.5">
                Current B2B list price
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Trial Performance Overview */}
      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-7 space-y-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-base">📊</span>
            <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider">
              90-Day Trial Performance Audit
            </h3>
          </div>
          <span className="text-xs font-bold text-zinc-500">
            Aggregated Across All {review.totalStores} Store Locations
          </span>
        </div>

        {/* Sell-Through Gauge */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-zinc-600 dark:text-zinc-400">
              {review.isPeriodEnded
                ? "Trial Window: 90 Days Completed"
                : `Trial Window: Day ${review.daysElapsed} of 90 (${review.daysRemaining} days left)`}
            </span>
            <span
              className={
                isThresholdMet
                  ? "text-emerald-600 dark:text-emerald-400 font-extrabold text-sm"
                  : "text-amber-600 dark:text-amber-400 font-extrabold text-sm"
              }
            >
              {review.sellThroughPercent}% Estimated Sell-Through
            </span>
          </div>

          <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-4 overflow-hidden relative">
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-zinc-400 dark:bg-zinc-500 z-10" />
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isThresholdMet ? "bg-emerald-500" : "bg-amber-500"
              }`}
              style={{ width: `${review.sellThroughPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-zinc-400 font-medium">
            <span>0 units moved</span>
            <span className="text-zinc-600 dark:text-zinc-300 font-bold">
              50% Program Threshold ({Math.ceil(review.protectedQuantity * 0.5)} units)
            </span>
            <span>{review.protectedQuantity} units (100%)</span>
          </div>
        </div>

        {/* 4-Box Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
              Protected Initial Qty
            </span>
            <span className="text-lg font-black text-zinc-900 dark:text-white">
              {review.protectedQuantity}
            </span>
            <span className="text-[10px] text-zinc-400 block mt-0.5">Units covered</span>
          </div>

          <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
              Estimated Movement
            </span>
            <span className="text-lg font-black text-zinc-900 dark:text-white">
              {review.estimatedMovement}
            </span>
            <span className="text-[10px] text-zinc-400 block mt-0.5">All stores combined</span>
          </div>

          <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
              Trial Dates
            </span>
            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
              {review.trialStartDate}
            </span>
            <span className="text-[10px] text-zinc-400 block mt-0.5">to {review.trialEndDate}</span>
          </div>

          <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
              Store Data Coverage
            </span>
            <span className="text-lg font-black text-zinc-900 dark:text-white">
              {review.dataCoveragePercent}%
            </span>
            <span className="text-[10px] text-zinc-400 block mt-0.5">
              {review.storesReporting}/{review.totalStores} stores reporting
            </span>
          </div>
        </div>
      </div>

      {/* Store Location Breakdown Table */}
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
              {review.storeBreakdown.map((sb) => (
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

      {/* Retailer Review Request Section */}
      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-7 space-y-3 shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-base">📝</span>
            <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider">
              Retailer Review Request & Notes
            </h3>
          </div>
          {review.requestedAt && (
            <span className="text-xs text-zinc-500 font-mono">
              Submitted on {new Date(review.requestedAt).toLocaleString()}
            </span>
          )}
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2 text-zinc-500">
            <span>Requested By:</span>
            <span className="font-bold text-zinc-800 dark:text-zinc-200 font-mono">
              {review.requestedByEmail || "Authorized Retailer User"}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
              Retailer Merchandising Notes:
            </span>
            <p className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
              {review.requestNotes || "No additional notes provided by retailer."}
            </p>
          </div>
        </div>
      </div>

      {/* Admin Decision Action Panel */}
      <div className="rounded-3xl border-2 border-zinc-900 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 sm:p-8 space-y-6 shadow-md">
        <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚖️</span>
            <h3 className="text-base font-black text-zinc-900 dark:text-white tracking-tight">
              Admin Review Resolution Decision
            </h3>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Explicitly record an authorized K SELECT business decision. Decisions do not auto-calculate financial liability or execute payment refunds.
          </p>
        </div>

        {/* Action Tabs */}
        <div className="flex items-center gap-2 p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700">
          <button
            type="button"
            onClick={() => setSelectedAction("approve")}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all ${
              selectedAction === "approve"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            ✓ Approve Review
          </button>
          <button
            type="button"
            onClick={() => setSelectedAction("needs_info")}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all ${
              selectedAction === "needs_info"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            💬 Request More Info
          </button>
          <button
            type="button"
            onClick={() => setSelectedAction("reject")}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all ${
              selectedAction === "reject"
                ? "bg-zinc-900 text-white dark:bg-zinc-700 shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            ✕ Reject Review
          </button>
        </div>

        {/* Form Details per Selected Action */}
        {selectedAction === "approve" && (
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
              <span className="font-bold block">Approval Business Standard:</span>
              <p className="leading-relaxed">
                Recording an Approved Quantity and Credit Amount records an authorized business resolution. Actual Credit Memo generation and financial processing remains in Pending status.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-900 dark:text-white block">
                  Approved Protection Quantity (units):
                </label>
                <input
                  type="number"
                  min="0"
                  value={approvedQuantity}
                  onChange={(e) => setApprovedQuantity(e.target.value)}
                  placeholder="e.g. 18"
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-900 dark:text-white block">
                  Approved Credit Amount ($):
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={approvedCreditAmount}
                  onChange={(e) => setApprovedCreditAmount(e.target.value)}
                  placeholder="e.g. 153.00"
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-900 dark:text-white block">
                Resolution & Merchandising Notes (Optional):
              </label>
              <textarea
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder="e.g. Approved 18 units for trial protection credit processing. Operations will coordinate with store buyer."
                rows={3}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              type="button"
              disabled={isPending}
              onClick={() => handleSubmitDecision("approved")}
              className="w-full sm:w-auto px-6 py-3 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 disabled:opacity-60 cursor-pointer transition-transform active:scale-95"
            >
              {isPending ? "Submitting..." : "✓ Confirm & Record Approval"}
            </button>
          </div>
        )}

        {selectedAction === "needs_info" && (
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 text-xs text-blue-900 dark:text-blue-200 space-y-1">
              <span className="font-bold block">Clarification Request:</span>
              <p className="leading-relaxed">
                Specify the questions or physical store count verification required from the retailer. The retailer will see this note in their Protection dashboard.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-900 dark:text-white block">
                Information Needed Note (Required):
              </label>
              <textarea
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder="e.g. Please verify physical shelf count at Test Store 01 before trial resolution can be finalized."
                rows={4}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="button"
              disabled={isPending}
              onClick={() => handleSubmitDecision("needs_information")}
              className="w-full sm:w-auto px-6 py-3 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 disabled:opacity-60 cursor-pointer transition-transform active:scale-95"
            >
              {isPending ? "Submitting..." : "💬 Send Clarification Request"}
            </button>
          </div>
        )}

        {selectedAction === "reject" && (
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-800 dark:text-zinc-200 space-y-1">
              <span className="font-bold block">Non-Approval Decision:</span>
              <p className="leading-relaxed">
                A non-approval note is required to provide context to the retailer. Company and Product will remain permanently recorded under the initial trial.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-900 dark:text-white block">
                Reason for Non-Approval / Decision Notes (Required):
              </label>
              <textarea
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder="e.g. Performance audit indicates sell-through exceeded program threshold when counting confirmed restock orders."
                rows={4}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
              />
            </div>

            <button
              type="button"
              disabled={isPending}
              onClick={() => handleSubmitDecision("rejected")}
              className="w-full sm:w-auto px-6 py-3 rounded-xl text-xs font-black bg-zinc-900 hover:bg-black text-white dark:bg-zinc-700 dark:hover:bg-zinc-600 shadow-md disabled:opacity-60 cursor-pointer transition-transform active:scale-95"
            >
              {isPending ? "Submitting..." : "✕ Confirm & Record Non-Approval"}
            </button>
          </div>
        )}

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs font-bold text-red-700 dark:text-red-300">
            ⚠️ {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-300">
            ✓ {successMsg}
          </div>
        )}
      </div>
    </div>
  );
}
