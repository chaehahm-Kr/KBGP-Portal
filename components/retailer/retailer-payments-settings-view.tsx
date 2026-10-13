"use client";

import React from "react";
import Link from "next/link";
import { PaymentMethodsStatusResponse } from "@/lib/retailer/payment-method-types";
import { EffectivePaymentPolicy } from "@/lib/retailer/payment-policy";

interface PaymentsSettingsViewProps {
  statusData: PaymentMethodsStatusResponse;
  policy: EffectivePaymentPolicy;
  companyName: string;
}

export function RetailerPaymentsSettingsView({
  statusData,
  policy,
  companyName,
}: PaymentsSettingsViewProps) {
  const cardFeeDisplay =
    policy.card.feeType === "waived"
      ? "0.0% (Fee Waived)"
      : `${(policy.card.feeRate * 100).toFixed(1).replace(/\.0$/, "")}% Processing Fee`;

  const achFeeDisplay =
    policy.ach.feeType === "waived"
      ? "$0.00 (Fee Waived)"
      : `$${policy.ach.feeAmount.toFixed(2)} Fixed Fee`;

  const availableCredit = policy.terms.availableCredit ?? policy.terms.creditLimit;
  const openAr = policy.terms.openArBalance ?? 0;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
            <Link href="/account" className="hover:underline">Settings</Link>
            <span>/</span>
            <span className="text-zinc-800 dark:text-zinc-200">Payment Methods</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
            Payment Methods & Commercial Billing
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Authorized payment methods, trade credit lines, and payment gateway status for {companyName}.
          </p>
        </div>

        <Link
          href="/bills"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold transition-all shadow-xs shrink-0"
        >
          <span>View Invoices & Bills →</span>
        </Link>
      </div>

      {/* Online Gateway Integration Notice */}
      <div className="p-4 sm:p-5 rounded-2xl border border-amber-200/80 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/30 space-y-2">
        <div className="flex items-center gap-2.5">
          <span className="text-base">💳</span>
          <h3 className="font-bold text-xs sm:text-sm text-amber-950 dark:text-amber-200 flex items-center gap-2">
            <span>Online Payment Gateway: Setup Pending</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200/60 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
              Phase 2 Foundation
            </span>
          </h3>
        </div>
        <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
          Direct credit card and ACH bank transfer tokenization is currently in the integration phase. You can place orders via Card, ACH, or Net Terms during checkout, which are recorded for manual invoice settlement until live card-capture is activated.
        </p>
      </div>

      {/* Grid: Card and ACH Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card Section */}
        <div className="p-5 sm:p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg font-bold">
                💳
              </div>
              <div>
                <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                  Credit / Debit Card
                </h3>
                <span className="text-[11px] text-zinc-500">Corporate & purchasing cards</span>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              policy.card.effectiveEnabled
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            }`}>
              {policy.card.effectiveEnabled ? "Channel Allowed" : "Channel Disabled"}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-zinc-100 dark:border-zinc-800/60">
              <span className="text-zinc-500">Card Processing Policy</span>
              <span className="font-semibold text-zinc-900 dark:text-white">{cardFeeDisplay}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-zinc-100 dark:border-zinc-800/60">
              <span className="text-zinc-500">Saved Instruments</span>
              <span className="font-mono text-zinc-400">0 Cards</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-zinc-500">Live Gateway State</span>
              <span className="text-amber-600 dark:text-amber-400 font-bold">Setup Pending</span>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              disabled
              title="Online card storage will be enabled upon gateway connection."
              className="w-full py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 text-zinc-400 text-xs font-bold cursor-not-allowed text-center"
            >
              + Add Credit / Debit Card (Setup Pending)
            </button>
          </div>
        </div>

        {/* ACH Section */}
        <div className="p-5 sm:p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg font-bold">
                🏦
              </div>
              <div>
                <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                  ACH Direct Debit
                </h3>
                <span className="text-[11px] text-zinc-500">Bank direct electronic transfer</span>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              policy.ach.effectiveEnabled
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            }`}>
              {policy.ach.effectiveEnabled ? "Channel Allowed" : "Channel Disabled"}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-zinc-100 dark:border-zinc-800/60">
              <span className="text-zinc-500">ACH Processing Policy</span>
              <span className="font-semibold text-zinc-900 dark:text-white">{achFeeDisplay}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-zinc-100 dark:border-zinc-800/60">
              <span className="text-zinc-500">Linked Accounts</span>
              <span className="font-mono text-zinc-400">0 Accounts</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-zinc-500">Live Gateway State</span>
              <span className="text-amber-600 dark:text-amber-400 font-bold">Setup Pending</span>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              disabled
              title="Bank account linking will be enabled upon gateway connection."
              className="w-full py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 text-zinc-400 text-xs font-bold cursor-not-allowed text-center"
            >
              + Link Bank Account (Setup Pending)
            </button>
          </div>
        </div>
      </div>

      {/* Net Terms & Credit Line Foundation */}
      <div className="p-5 sm:p-6 rounded-2xl border border-purple-200/80 bg-purple-50/40 dark:border-purple-900/60 dark:bg-purple-950/20 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-200/60 dark:border-purple-900/60 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 flex items-center justify-center text-lg font-bold">
              📑
            </div>
            <div>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                <span>Wholesale Trade Credit & Net Terms</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  policy.terms.effectiveEnabled
                    ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-800"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                }`}>
                  {policy.terms.effectiveEnabled ? "Active & Approved" : "Not Approved"}
                </span>
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Authoritative commercial terms approved by K SELECT underwriter.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-purple-900 dark:text-purple-300">
              {policy.terms.termsDisplayLabel}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-purple-100 dark:border-purple-900/40 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Approved Credit Line</span>
            <p className="font-mono font-bold text-base text-zinc-900 dark:text-white">
              ${policy.terms.creditLimit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-zinc-400">Total authorized underwriting exposure</p>
          </div>

          <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-purple-100 dark:border-purple-900/40 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Current Open AR</span>
            <p className="font-mono font-bold text-base text-zinc-900 dark:text-white">
              ${openAr.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-zinc-400">
              {policy.terms.hasPastDue ? "⚠️ Overdue invoices outstanding" : "Unpaid issued invoices balance"}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-purple-100 dark:border-purple-900/40 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Available Credit</span>
            <p className="font-mono font-bold text-base text-emerald-600 dark:text-emerald-400">
              ${availableCredit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-zinc-400">Remaining line for wholesale checkout</p>
          </div>
        </div>
      </div>

      {/* Security Disclaimer */}
      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-[11px] text-zinc-500 dark:text-zinc-400 flex items-start gap-2.5">
        <span className="text-sm">🔒</span>
        <span>
          <strong>Data Security & Compliance:</strong> K SELECT HUB adheres to strict PCI-DSS guidelines. Raw card numbers, CVVs, and full bank account numbers are never stored in K SELECT databases. All live financial operations use tokenized representations through certified payment providers.
        </span>
      </div>
    </div>
  );
}
