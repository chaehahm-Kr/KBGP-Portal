"use client";

import React, { useState, useTransition } from "react";
import { RetailerBillSummary, RetailerBillDetail } from "@/lib/retailer/bill-types";
import { payRetailerBillAction } from "@/lib/retailer/bill-actions";
import { EffectivePaymentPolicy } from "@/lib/retailer/payment-policy";

interface PayBillModalProps {
  bill: RetailerBillSummary | RetailerBillDetail;
  effectivePolicy?: EffectivePaymentPolicy | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function PayBillModal({
  bill,
  effectivePolicy,
  isOpen,
  onClose,
}: PayBillModalProps) {
  const [isPending, startTransition] = useTransition();
  const [paymentMethod, setPaymentMethod] = useState<"card" | "ach">("card");
  const [statusMessage, setStatusMessage] = useState<{ type: "error" | "info"; text: string } | null>(null);

  if (!isOpen) return null;

  const balanceDue = Number(bill.balance_due || 0);
  const payBase = balanceDue;

  // Resolve channel policy & live fee calculation
  const cardPolicy = effectivePolicy?.card;
  const achPolicy = effectivePolicy?.ach;
  const activePolicy = paymentMethod === "card" ? cardPolicy : achPolicy;

  let feeAmount = 0;
  let feeDisclosure = "No processing fee";

  if (paymentMethod === "card" && cardPolicy) {
    if (cardPolicy.feeType === "waived" || cardPolicy.feeRate === 0) {
      feeAmount = 0;
      feeDisclosure = "Fee Waived (0%)";
    } else {
      feeAmount = Math.round(payBase * cardPolicy.feeRate * 100) / 100;
      const pct = (cardPolicy.feeRate * 100).toFixed(1).replace(/\.0$/, "");
      feeDisclosure = `${pct}% Processing Fee`;
    }
  } else if (paymentMethod === "ach" && achPolicy) {
    if (achPolicy.feeType === "waived" || achPolicy.feeAmount === 0) {
      feeAmount = 0;
      feeDisclosure = "Fee Waived ($0.00)";
    } else {
      feeAmount = Number(achPolicy.feeAmount.toFixed(2));
      feeDisclosure = `$${achPolicy.feeAmount.toFixed(2)} Fixed Fee`;
    }
  }

  const totalCharged = Math.round((payBase + feeAmount) * 100) / 100;
  const isProviderReady = Boolean(activePolicy?.providerReady);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (payBase <= 0) {
      setStatusMessage({ type: "error", text: "Please enter a valid payment amount." });
      return;
    }
    if (payBase > balanceDue) {
      setStatusMessage({
        type: "error",
        text: `Payment amount cannot exceed the balance due ($${balanceDue.toFixed(2)}).`,
      });
      return;
    }

    startTransition(async () => {
      const res = await payRetailerBillAction({
        invoiceId: bill.id,
        paymentMethod,
        amount: payBase,
      });

      if (!res.success) {
        setStatusMessage({
          type: res.providerPending ? "info" : "error",
          text: res.error || "Payment could not be processed.",
        });
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 sm:p-7 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 mb-1">
              <span>💳</span>
              <span>Pay Bill</span>
            </div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
              Pay Bill {bill.invoice_number}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Order #{bill.order_number} · Due {new Date(bill.due_date).toLocaleDateString()}
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

        {/* Current Balance Banner */}
        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Balance Due</p>
            <p className="text-2xl font-extrabold text-zinc-900 dark:text-white mt-0.5">
              ${balanceDue.toFixed(2)}
            </p>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Terms</span>
            <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{bill.terms_name}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 1. Payment Principal (Full Balance Only) */}
          <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
                Payment Principal (Full Invoice Settlement)
              </span>
              <span className="text-sm font-extrabold text-zinc-900 dark:text-white">
                ${balanceDue.toFixed(2)}
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              100% Full Balance
            </span>
          </div>

          {/* 2. Payment Method Selection (No Net Terms - Rule 9) */}
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
                    : `${((cardPolicy?.feeRate || 0.035) * 100).toFixed(1)}% Processing Fee`}
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

          {/* 3. Live Fee Calculation Breakdown (Rule 10 & 11) */}
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs">
            <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
              <span>Invoice Principal Reduction</span>
              <span className="font-semibold text-zinc-900 dark:text-white">
                ${payBase.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
              <span>Processing Fee ({feeDisclosure})</span>
              <span className="font-semibold text-zinc-900 dark:text-white">
                {feeAmount > 0 ? `+$${feeAmount.toFixed(2)}` : "$0.00"}
              </span>
            </div>
            <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-1" />
            <div className="flex justify-between text-sm font-bold text-zinc-900 dark:text-white pt-0.5">
              <span>Total Amount to Charge</span>
              <span className="text-base font-extrabold text-blue-600 dark:text-blue-400">
                ${totalCharged.toFixed(2)}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-2 leading-relaxed">
              * The ${payBase.toFixed(2)} principal will be applied toward your bill. The processing fee is collected by the payment processor and does not change your invoice subtotal.
            </p>
          </div>

          {/* 4. Provider Readiness Notice (Rule 12 & 25) */}
          {!isProviderReady && (
            <div className="p-4 rounded-xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                <span>⚠️</span>
                <span>Online Card / ACH Setup in Progress</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-800/90 dark:text-amber-300/90">
                Direct online payment processing is currently in configuration. To settle this bill via manual bank wire or physical check, please reach out to your account manager or email{" "}
                <a href="mailto:support@kselecthub.com" className="font-bold underline">
                  support@kselecthub.com
                </a>.
              </p>
            </div>
          )}

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl text-xs font-semibold ${
                statusMessage.type === "error"
                  ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900"
                  : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900"
              }`}
            >
              {statusMessage.text}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isPending || !isProviderReady}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                !isProviderReady
                  ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
                  : "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 hover:opacity-90"
              }`}
            >
              {isPending
                ? "Processing..."
                : !isProviderReady
                ? "Online Payment Pending"
                : `Pay $${totalCharged.toFixed(2)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
