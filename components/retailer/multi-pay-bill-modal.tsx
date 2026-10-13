"use client";

import React, { useState, useTransition } from "react";
import { RetailerBillSummary } from "@/lib/retailer/bill-types";
import { payMultipleRetailerBillsAction } from "@/lib/retailer/bill-actions";
import { EffectivePaymentPolicy } from "@/lib/retailer/payment-policy";

interface MultiPayBillModalProps {
  selectedBills: RetailerBillSummary[];
  effectivePolicy?: EffectivePaymentPolicy | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function MultiPayBillModal({
  selectedBills,
  effectivePolicy,
  isOpen,
  onClose,
}: MultiPayBillModalProps) {
  const [isPending, startTransition] = useTransition();
  const [paymentMethod, setPaymentMethod] = useState<"card" | "ach">("card");
  const [statusMessage, setStatusMessage] = useState<{
    type: "error" | "info";
    text: string;
    details?: {
      principalAmount: number;
      processingFee: number;
      totalCharged: number;
      invoiceNumbers: string[];
    };
  } | null>(null);

  if (!isOpen || selectedBills.length === 0) return null;

  // 100% full balance total for selected bills
  const principalTotal = selectedBills.reduce(
    (sum, bill) => sum + Number(bill.balance_due || 0),
    0
  );
  const roundedPrincipal = Math.round(principalTotal * 100) / 100;

  // Fee calculation using effective policy
  const cardPolicy = effectivePolicy?.card;
  const achPolicy = effectivePolicy?.ach;

  let feeAmount = 0;
  let feeDisclosure = "No processing fee";

  if (paymentMethod === "card") {
    if (cardPolicy?.feeType === "waived" || cardPolicy?.feeRate === 0) {
      feeAmount = 0;
      feeDisclosure = "Fee Waived (0%)";
    } else {
      const rate = cardPolicy?.feeRate ?? 0.035;
      feeAmount = Math.round(roundedPrincipal * rate * 100) / 100;
      const pct = (rate * 100).toFixed(1).replace(/\.0$/, "");
      feeDisclosure = `${pct}% Processing Fee`;
    }
  } else if (paymentMethod === "ach") {
    if (achPolicy?.feeType === "waived" || achPolicy?.feeAmount === 0) {
      feeAmount = 0;
      feeDisclosure = "Fee Waived ($0.00)";
    } else {
      const flat = achPolicy?.feeAmount ?? 5.0;
      feeAmount = Number(flat.toFixed(2));
      feeDisclosure = `$${flat.toFixed(2)} Fixed Fee`;
    }
  }

  const totalCharged = Math.round((roundedPrincipal + feeAmount) * 100) / 100;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (selectedBills.length === 0 || roundedPrincipal <= 0) {
      setStatusMessage({ type: "error", text: "No payable bills selected." });
      return;
    }

    startTransition(async () => {
      const res = await payMultipleRetailerBillsAction({
        invoiceIds: selectedBills.map((b) => b.id),
        paymentMethod,
      });

      if (!res.success) {
        setStatusMessage({
          type: res.providerPending ? "info" : "error",
          text: res.error || "Payment could not be processed.",
          details: res.paymentDetails,
        });
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 sm:p-7 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 mb-1">
              <span>💳</span>
              <span>Multi-Invoice Payment</span>
            </div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
              Pay Selected Bills ({selectedBills.length})
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Review selected invoices and process combined settlement
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Selected Invoices Table / Compact List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              Selected Invoices ({selectedBills.length})
            </span>
            <span className="text-xs font-semibold text-zinc-500">
              Full Balance Settlement
            </span>
          </div>

          <div className="max-h-48 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-100/70 dark:bg-zinc-800/60 text-[10px] font-bold text-zinc-500 uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="py-2 px-3">Invoice #</th>
                  <th className="py-2 px-3">Order #</th>
                  <th className="py-2 px-3 text-right">Balance Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
                {selectedBills.map((b) => (
                  <tr key={b.id} className="hover:bg-white/60 dark:hover:bg-zinc-800/40">
                    <td className="py-2 px-3 font-semibold text-zinc-900 dark:text-white">
                      {b.invoice_number}
                    </td>
                    <td className="py-2 px-3 text-zinc-600 dark:text-zinc-400 font-mono">
                      {b.order_number}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-zinc-900 dark:text-white">
                      ${Number(b.balance_due || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Combined Balance Banner */}
        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Invoices Principal</p>
            <p className="text-2xl font-extrabold text-zinc-900 dark:text-white mt-0.5">
              ${roundedPrincipal.toFixed(2)}
            </p>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Invoices</span>
            <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              {selectedBills.length} Bill{selectedBills.length === 1 ? "" : "s"} (100% Full Balance)
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Payment Method Selection (No Net Terms - Net Terms cannot pay Net Terms) */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
              Payment Method
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {/* Credit Card */}
              <button
                type="button"
                onClick={() => setPaymentMethod("card")}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  paymentMethod === "card"
                    ? "border-zinc-900 dark:border-white bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white font-bold ring-1 ring-zinc-900 dark:ring-white"
                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">💳</span>
                  <span className="text-xs font-bold">Credit / Debit Card</span>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
                  {cardPolicy?.feeType === "waived"
                    ? "No fee (Waived)"
                    : `${((cardPolicy?.feeRate ?? 0.035) * 100).toFixed(1)}% Processing Fee`}
                </p>
              </button>

              {/* ACH Bank Transfer */}
              <button
                type="button"
                onClick={() => setPaymentMethod("ach")}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  paymentMethod === "ach"
                    ? "border-zinc-900 dark:border-white bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white font-bold ring-1 ring-zinc-900 dark:ring-white"
                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">🏦</span>
                  <span className="text-xs font-bold">ACH Bank Transfer</span>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
                  {achPolicy?.feeType === "waived"
                    ? "No fee (Waived)"
                    : `$${(achPolicy?.feeAmount ?? 5.0).toFixed(2)} Flat Fee`}
                </p>
              </button>
            </div>
          </div>

          {/* Fee Calculation Breakdown */}
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs">
            <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
              <span>Invoice Principal Total ({selectedBills.length} bills)</span>
              <span className="font-semibold text-zinc-900 dark:text-white">
                ${roundedPrincipal.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
              <span className="flex items-center gap-1.5">
                <span>Payment Processing Fee</span>
                <span className="text-[10px] text-zinc-400">({feeDisclosure})</span>
              </span>
              <span className="font-semibold text-zinc-900 dark:text-white">
                ${feeAmount.toFixed(2)}
              </span>
            </div>
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex justify-between text-sm font-extrabold text-zinc-900 dark:text-white">
              <span>Total Amount to Charge</span>
              <span className="text-base text-zinc-950 dark:text-zinc-50">
                ${totalCharged.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Status / Provider Pending Notice */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl text-xs space-y-1 ${
                statusMessage.type === "info"
                  ? "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 text-blue-900 dark:text-blue-200"
                  : "bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200"
              }`}
            >
              <div className="flex items-center gap-2 font-bold">
                <span>{statusMessage.type === "info" ? "ℹ️" : "⚠️"}</span>
                <span>
                  {statusMessage.type === "info"
                    ? "Online Payment Setup Pending"
                    : "Payment Error"}
                </span>
              </div>
              <p className="leading-relaxed opacity-90">{statusMessage.text}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || roundedPrincipal <= 0}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-zinc-900 dark:bg-white dark:text-zinc-950 hover:opacity-90 shadow-xs transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {isPending ? "Submitting..." : `Pay $${totalCharged.toFixed(2)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
