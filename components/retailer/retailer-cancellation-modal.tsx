// components/retailer/retailer-cancellation-modal.tsx
// Phase B5 — Retailer Order Cancellation & Request Modal

"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RetailerOrderDetail } from "@/lib/retailer/orders";
import {
  retailerDirectCancelOrderAction,
  retailerSubmitCancellationRequestAction,
} from "@/lib/retailer/cancellation-actions";

interface CancellationModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: RetailerOrderDetail;
  mode: "direct_cancel" | "request_cancel";
}

const REASON_CATEGORIES = [
  { value: "buyer_request", label: "Buyer / Store Changed Mind" },
  { value: "out_of_stock", label: "Product Out of Stock or Discontinued" },
  { value: "delivery_delay", label: "Fulfillment or Delivery Delay" },
  { value: "duplicate_order", label: "Accidental Duplicate Order" },
  { value: "pricing_error", label: "Pricing or Commercial Terms Discrepancy" },
  { value: "other", label: "Other Operational Reason" },
];

export function RetailerCancellationModal({
  isOpen,
  onClose,
  order,
  mode,
}: CancellationModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reasonCategory, setReasonCategory] = useState("buyer_request");
  const [reasonNotes, setReasonNotes] = useState("");
  const [requestType, setRequestType] = useState<"full" | "partial">("full");
  const [error, setError] = useState<string | null>(null);

  // Partial item quantities map: itemId -> quantityToCancel
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    order.items.forEach((it) => {
      const remaining = Math.max(
        0,
        it.quantity - Number(it.quantityShipped || 0) - Number(it.quantityCancelled || 0)
      );
      initial[it.id] = remaining;
    });
    return initial;
  });

  if (!isOpen) return null;

  const hasActiveInvoices = (order.invoices || []).some(
    (inv) => !["void", "cancelled"].includes((inv.invoiceStatus || "").toLowerCase())
  );
  const hasCollectedPayment = (order.paymentStatus || "").toLowerCase() === "paid";
  const isDirect = mode === "direct_cancel" && !hasActiveInvoices && !hasCollectedPayment;

  const handleQtyChange = (itemId: string, max: number, val: number) => {
    const clamped = Math.max(0, Math.min(max, val));
    setItemQuantities((prev) => ({ ...prev, [itemId]: clamped }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      if (isDirect) {
        // Direct cancellation for Submitted orders without invoices or collected payments
        const res = await retailerDirectCancelOrderAction({
          orderId: order.id,
          reasonCategory,
          reasonNotes: reasonNotes.trim() || undefined,
        });

        if (!res.success) {
          setError(res.error || "Failed to cancel order.");
          return;
        }
      } else {
        // Cancellation request for orders with active invoices, collected payments, or in processing
        const itemsPayload =
          requestType === "partial" && order.items.length > 0
            ? Object.entries(itemQuantities)
                .filter(([_, qty]) => qty > 0)
                .map(([orderItemId, quantityToCancel]) => ({
                  orderItemId,
                  quantityToCancel,
                }))
            : undefined;

        if (requestType === "partial" && order.items.length > 0 && (!itemsPayload || itemsPayload.length === 0)) {
          setError("Please specify at least 1 unit to cancel.");
          return;
        }

        const res = await retailerSubmitCancellationRequestAction({
          orderId: order.id,
          requestType,
          reasonCategory,
          reasonNotes: reasonNotes.trim() || undefined,
          items: itemsPayload,
        });

        if (!res.success) {
          setError(res.error || "Failed to submit cancellation request.");
          return;
        }
      }

      onClose();
      router.refresh();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                {isDirect ? "Cancel Order" : "Request Order Cancellation"}
              </h2>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Order #{order.orderNumber} • Current Status:{" "}
              <strong className="text-zinc-700 dark:text-zinc-300 uppercase">
                {order.orderStatus}
              </strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {isDirect ? (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 space-y-1">
              <p className="font-semibold">Direct Cancellation Notice</p>
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Because this order has not yet been processed by the warehouse and has no active invoice or collected payment, you may cancel it immediately. Any Net Terms credit line reservation will be released instantly.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300 space-y-1">
                <p className="font-semibold">Cancellation Review Notice</p>
                <p className="text-[11px] text-amber-800 dark:text-amber-400">
                  Your cancellation request will be submitted for customer operations review.
                  {hasActiveInvoices
                    ? " This order has an associated active invoice requiring financial reconciliation before voiding."
                    : hasCollectedPayment
                    ? " If a payment has been collected, any eligible refund will be reviewed and processed separately upon approval."
                    : " Unshipped quantities will be placed on temporary fulfillment hold while under review."}
                </p>
              </div>

              {order.items.length > 0 && (
                <>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300">
                    Cancellation Scope:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRequestType("full")}
                      className={`p-3 rounded-xl border text-left font-medium transition-all ${
                        requestType === "full"
                          ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-600"
                          : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      }`}
                    >
                      <div className="font-bold">Cancel Remaining Units</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">
                        Request to cancel all {order.totalRemainingUnits} remaining units
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRequestType("partial")}
                      className={`p-3 rounded-xl border text-left font-medium transition-all ${
                        requestType === "partial"
                          ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-600"
                          : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      }`}
                    >
                      <div className="font-bold">Specific Items Only</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">
                        Select quantities line by line
                      </div>
                    </button>
                  </div>
                </>
              )}

              {requestType === "partial" && (
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1 border border-zinc-100 dark:border-zinc-800 rounded-xl p-2 bg-zinc-50/50 dark:bg-zinc-800/30">
                  {order.items.map((it) => {
                    const remaining = Math.max(
                      0,
                      it.quantity - Number(it.quantityShipped || 0) - Number(it.quantityCancelled || 0)
                    );
                    if (remaining <= 0) return null;

                    return (
                      <div
                        key={it.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="font-bold text-zinc-900 dark:text-white truncate">
                            {it.productName}
                          </p>
                          <p className="text-[10px] text-zinc-400 font-mono">
                            Remaining: {remaining} units
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] text-zinc-500">Cancel:</label>
                          <input
                            type="number"
                            min="0"
                            max={remaining}
                            value={itemQuantities[it.id] ?? remaining}
                            onChange={(e) =>
                              handleQtyChange(it.id, remaining, parseInt(e.target.value) || 0)
                            }
                            className="w-16 px-2 py-1 text-center font-bold rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Reason Category Selector */}
          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Reason for Cancellation <span className="text-rose-500">*</span>
            </label>
            <select
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium"
            >
              {REASON_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reason Notes */}
          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Additional Details / Notes (Optional)
            </label>
            <textarea
              rows={3}
              value={reasonNotes}
              onChange={(e) => setReasonNotes(e.target.value)}
              placeholder="Provide any additional context for customer operations..."
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-semibold"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold disabled:opacity-50 transition-colors shadow-xs"
            >
              {isPending
                ? "Processing..."
                : isDirect
                ? "Confirm Cancellation"
                : "Submit Cancellation Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
