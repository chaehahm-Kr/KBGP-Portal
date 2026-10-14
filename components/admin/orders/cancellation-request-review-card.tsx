// components/admin/orders/cancellation-request-review-card.tsx
// Phase B5 — Admin Cancellation Request Review & Financial Impact Card

"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminRetailerOrderDetail } from "@/lib/admin/orders-types";
import {
  adminApproveCancellationRequestAction,
  adminRejectCancellationRequestAction,
} from "@/lib/admin/cancellation-actions";

interface CancellationReviewCardProps {
  order: AdminRetailerOrderDetail;
  cancellationRequest?: any;
}

export function CancellationRequestReviewCard({
  order,
  cancellationRequest,
}: CancellationReviewCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!order.cancellationRequested && !cancellationRequest) {
    return null;
  }

  const isNetTerms =
    order.paymentMethod === "terms" ||
    (order.paymentTerms &&
      !["PREPAID", "PREPAID_CARD", "PREPAID_ACH", "CARD", "ACH"].includes(
        order.paymentTerms.toUpperCase()
      ));

  // Compute financial impact estimate
  const unbilledCreditImpact = isNetTerms
    ? order.totalOrderedUnits > 0
      ? (order.totalRemainingUnits / order.totalOrderedUnits) * order.totalAmount
      : 0
    : 0;

  const handleApprove = () => {
    if (!confirm(`Are you sure you want to approve cancellation for Order #${order.orderNumber}?`)) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await adminApproveCancellationRequestAction({
        requestId: cancellationRequest?.id,
        orderId: order.id,
        adminNotes: adminNotes.trim() || undefined,
      });

      if (!res.success) {
        setError(res.error || "Failed to approve cancellation request.");
        return;
      }

      router.refresh();
    });
  };

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      setError("Please provide a reason for rejecting the cancellation request.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await adminRejectCancellationRequestAction({
        requestId: cancellationRequest?.id,
        orderId: order.id,
        adminNotes: rejectReason.trim(),
      });

      if (!res.success) {
        setError(res.error || "Failed to reject cancellation request.");
        return;
      }

      setShowRejectModal(false);
      router.refresh();
    });
  };

  return (
    <div className="rounded-2xl border border-orange-200 dark:border-orange-900/60 bg-gradient-to-br from-orange-50/80 to-amber-50/40 dark:from-orange-950/40 dark:to-zinc-900 p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-orange-200/60 dark:border-orange-900/40 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚠️</span>
          <div>
            <h2 className="text-sm font-bold text-orange-950 dark:text-orange-200">
              Retailer Cancellation Request Pending Review
            </h2>
            <p className="text-[11px] text-orange-700 dark:text-orange-400">
              The retailer has requested cancellation for unshipped quantities on this order.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => setShowRejectModal(true)}
            className="px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors shadow-2xs"
          >
            Reject Request
          </button>

          <button
            type="button"
            disabled={isPending}
            onClick={handleApprove}
            className="px-4 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold disabled:opacity-50 transition-colors shadow-2xs"
          >
            {isPending ? "Processing..." : "Approve Cancellation"}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Request Details & Financial Impact Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-white/80 dark:bg-zinc-900/80 border border-orange-100 dark:border-zinc-800 space-y-1">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            Retailer Reason
          </span>
          <p className="font-semibold text-zinc-900 dark:text-white">
            {order.cancellationNotes || "No detailed notes provided"}
          </p>
          <p className="text-[10px] text-zinc-500">
            Remaining to cancel: <strong>{order.totalRemainingUnits} units</strong>
          </p>
        </div>

        <div className="p-3 rounded-xl bg-white/80 dark:bg-zinc-900/80 border border-orange-100 dark:border-zinc-800 space-y-1">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            Credit Reservation Impact (B4)
          </span>
          <p className="font-bold text-emerald-600 dark:text-emerald-400">
            {isNetTerms ? `+$${unbilledCreditImpact.toFixed(2)} Available Credit` : "N/A (Prepaid Order)"}
          </p>
          <p className="text-[10px] text-zinc-500">
            {isNetTerms
              ? "Unbilled reservation will be released instantly"
              : "Prepaid orders do not consume Net Terms credit"}
          </p>
        </div>

        <div className="p-3 rounded-xl bg-white/80 dark:bg-zinc-900/80 border border-orange-100 dark:border-zinc-800 space-y-1">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            Dispatched Invoices (B3)
          </span>
          <p className="font-bold text-indigo-600 dark:text-indigo-400">
            {order.invoices.length} Active Invoice(s) Intact
          </p>
          <p className="text-[10px] text-zinc-500">
            Existing invoices for shipped items remain 100% valid
          </p>
        </div>
      </div>

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              Reject Cancellation Request
            </h3>
            <p className="text-xs text-zinc-500">
              Provide a clear reason for the retailer explaining why this cancellation request cannot be approved (e.g. goods already staged on pallet or dispatch in progress).
            </p>

            <form onSubmit={handleRejectSubmit} className="space-y-3 text-xs">
              <textarea
                rows={3}
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain the rejection reason..."
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-3 py-1.5 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold disabled:opacity-50"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
