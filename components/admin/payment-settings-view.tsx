"use client";

import React, { useState, useTransition } from "react";
import {
  GlobalPaymentSettings,
  PaymentProviderId,
  FeeChargedTo,
} from "@/lib/payment/types";
import { updateGlobalPaymentSettings } from "@/lib/payment/settings";

interface PaymentSettingsViewProps {
  initialSettings: GlobalPaymentSettings;
}

export function PaymentSettingsView({ initialSettings }: PaymentSettingsViewProps) {
  const [settings, setSettings] = useState<GlobalPaymentSettings>(initialSettings);
  const [isPending, startTransition] = useTransition();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Simulation test amount
  const [simAmount, setSimAmount] = useState<number>(100);

  // Field change helper
  const updateField = <K extends keyof GlobalPaymentSettings>(
    key: K,
    value: GlobalPaymentSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    setSaveError("");
    setSaveSuccess(false);

    startTransition(async () => {
      const res = await updateGlobalPaymentSettings(settings);
      if (res.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        setSaveError(res.error || "Failed to update payment settings.");
      }
    });
  };

  // Simulations
  const simCardFee =
    settings.card_enabled && settings.card_fee_charged_to === "retailer"
      ? Math.round(simAmount * (Number(settings.card_fee_rate) / 100) * 100) / 100
      : 0;
  const simCardTotal = Math.round((simAmount + simCardFee) * 100) / 100;

  const simAchFee =
    settings.ach_enabled && settings.ach_fee_charged_to === "retailer"
      ? Math.round(Number(settings.ach_fee_amount) * 100) / 100
      : 0;
  const simAchTotal = Math.round((simAmount + simAchFee) * 100) / 100;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
            <span>Settings</span>
            <span>/</span>
            <span className="text-zinc-900 dark:text-zinc-200">Payments & Fee Policy</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
            <span>💳</span> Payment Foundation & Global Fee Policy
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Provider-neutral transaction fees, credit card / ACH surcharges, and default B2B trade credit parameters.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 transition-colors shadow-2xs cursor-pointer self-start sm:self-auto"
        >
          {isPending ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
              Saving Settings...
            </>
          ) : (
            <>
              <span>💾</span> Save Payment Policy
            </>
          )}
        </button>
      </div>

      {/* Alerts */}
      {saveSuccess && (
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>✓</span>
            <span>Global payment settings saved successfully to system_settings!</span>
          </div>
          <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
            Key: payment_settings
          </span>
        </div>
      )}

      {saveError && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-xs font-bold text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300 flex items-center gap-2">
          <span>✕</span>
          <span>{saveError}</span>
        </div>
      )}

      {/* SECTION A — Payment Provider / Gateway */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center justify-center text-[10px] font-black">
                A
              </span>
              Payment Provider & Gateway Orchestration
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Provider-neutral abstraction layer separating business policy from processor implementation.
            </p>
          </div>
          <span
            className={`text-[11px] font-bold px-3 py-1 rounded-full self-start sm:self-auto border ${
              settings.provider === "not_connected"
                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
            }`}
          >
            {settings.provider === "not_connected" ? "Setup Pending / Inactive" : "Adapter Configured"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              Active Payment Provider Adapter
            </label>
            <select
              value={settings.provider}
              onChange={(e) => {
                const val = e.target.value as PaymentProviderId;
                updateField("provider", val);
                if (val === "not_connected") {
                  updateField("provider_display_name", "Not Connected");
                } else if (val === "stripe") {
                  updateField("provider_display_name", "Stripe");
                } else {
                  updateField("provider_display_name", "Custom Gateway");
                }
              }}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            >
              <option value="not_connected">Not Connected (Manual Offline Invoicing / Setup Pending)</option>
              <option value="stripe">Stripe Connect / Elements (Planned Adapter)</option>
              <option value="custom">Custom Merchant Gateway / ACH Processor</option>
            </select>
            <p className="text-[10px] text-zinc-400 mt-1">
              Selecting a provider does not immediately initiate live charges until server credentials and webhooks are verified.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              Gateway Public Display Name
            </label>
            <input
              type="text"
              value={settings.provider_display_name || ""}
              onChange={(e) => updateField("provider_display_name", e.target.value)}
              placeholder="e.g. Stripe, Authorize.Net, Direct Wire"
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            />
            <p className="text-[10px] text-zinc-400 mt-1">
              Internal reference name shown on administrative transaction logs.
            </p>
          </div>
        </div>

        {/* Security & Tokenization Notice */}
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3.5 dark:border-indigo-950 dark:bg-indigo-950/20 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-2.5">
          <span className="text-base leading-none">🛡️</span>
          <div className="space-y-0.5">
            <span className="font-bold block">PCI-DSS Tokenization & Credential Protection Rule</span>
            <p className="text-[11px] leading-relaxed text-indigo-700 dark:text-indigo-300">
              Raw credit card numbers, CVV codes, bank routing details, and private processor API secret keys are
              strictly forbidden from being written to application database tables or exposed in client bundles.
              Processor integration will utilize tokenized client Elements and secure server-to-server endpoints.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION B & C: Fee Policies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SECTION B: Credit / Debit Card Policy */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center justify-center text-[10px] font-black">
                  B
                </span>
                Credit / Debit Card Fee Policy
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Global processing surcharge for online corporate card payments.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.card_enabled}
                onChange={(e) => updateField("card_enabled", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:bg-zinc-700 peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Fee Type
                </label>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
                  Percentage (%)
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Default Fee Rate (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    value={settings.card_fee_rate}
                    onChange={(e) => updateField("card_fee_rate", Math.max(0, Number(e.target.value) || 0))}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 pr-7 text-xs font-mono font-bold outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                  <span className="absolute right-2.5 top-2 text-xs font-bold text-zinc-400 pointer-events-none">
                    %
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                Fee Charged To
              </label>
              <select
                value={settings.card_fee_charged_to}
                onChange={(e) => updateField("card_fee_charged_to", e.target.value as FeeChargedTo)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
              >
                <option value="retailer">Retailer (Pass-through surcharge at checkout)</option>
                <option value="platform">Platform (Absorbed by K SELECT)</option>
              </select>
            </div>

            {/* Card Simulation */}
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/60 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider text-[10px]">
                  Simulated Card Transaction
                </span>
                <span className="font-mono text-zinc-500">Order: ${simAmount.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-zinc-200/60 dark:border-zinc-800">
                <span className="text-zinc-600 dark:text-zinc-300">
                  Card Fee ({settings.card_fee_rate}%):
                </span>
                <span className="font-mono font-bold text-zinc-900 dark:text-white">
                  +${simCardFee.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-zinc-900 dark:text-white">
                <span>Total Charged to Retailer:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">
                  ${simCardTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION C: ACH Direct Bank Transfer Policy */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center justify-center text-[10px] font-black">
                  C
                </span>
                ACH Direct Debit Fee Policy
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Global processing fee for ACH bank direct debit transactions.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.ach_enabled}
                onChange={(e) => updateField("ach_enabled", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:bg-zinc-700 peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Fee Type
                </label>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
                  Fixed Amount ($)
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Default Fixed Fee ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-zinc-400 pointer-events-none">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    max="50"
                    value={settings.ach_fee_amount}
                    onChange={(e) => updateField("ach_fee_amount", Math.max(0, Number(e.target.value) || 0))}
                    className="w-full rounded-xl border border-zinc-200 bg-white pl-6 pr-3 py-2 text-xs font-mono font-bold outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                Fee Charged To
              </label>
              <select
                value={settings.ach_fee_charged_to}
                onChange={(e) => updateField("ach_fee_charged_to", e.target.value as FeeChargedTo)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
              >
                <option value="retailer">Retailer (Pass-through fee at checkout)</option>
                <option value="platform">Platform (Absorbed by K SELECT)</option>
              </select>
            </div>

            {/* ACH Simulation */}
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/60 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider text-[10px]">
                  Simulated ACH Transaction
                </span>
                <span className="font-mono text-zinc-500">Order: ${simAmount.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-zinc-200/60 dark:border-zinc-800">
                <span className="text-zinc-600 dark:text-zinc-300">
                  Fixed ACH Fee:
                </span>
                <span className="font-mono font-bold text-zinc-900 dark:text-white">
                  +${simAchFee.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-zinc-900 dark:text-white">
                <span>Total Charged to Retailer:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">
                  ${simAchTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION D: B2B Net Terms & Trade Credit Default Policy */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center justify-center text-[10px] font-black">
              D
            </span>
            B2B Net Terms & Trade Credit Default Policy
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Default platform rules governing wholesale credit terms and order restriction triggers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl border border-zinc-200/80 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50 flex items-start justify-between gap-4">
            <div>
              <span className="font-bold text-zinc-900 dark:text-white block">
                Past Due Invoices Block Net Terms
              </span>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                When enabled, retailers with any overdue unpaid invoices cannot place new orders using Net Terms until settled.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
              <input
                type="checkbox"
                checked={settings.past_due_blocks_terms}
                onChange={(e) => updateField("past_due_blocks_terms", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:bg-zinc-700 peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <div className="p-4 rounded-xl border border-zinc-200/80 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50 space-y-2">
            <div>
              <span className="font-bold text-zinc-900 dark:text-white block">
                Default Overdue Grace Period (Days)
              </span>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                Buffer days allowed past due date before credit gating triggers.
              </p>
            </div>
            <div className="relative w-32">
              <input
                type="number"
                min="0"
                max="30"
                value={settings.default_grace_period_days}
                onChange={(e) => updateField("default_grace_period_days", Math.max(0, Number(e.target.value) || 0))}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-mono font-bold outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Guidance Note */}
        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/40 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/40 text-xs text-zinc-600 dark:text-zinc-400 flex items-start gap-2.5">
          <span className="text-base leading-none">ℹ️</span>
          <div>
            <span className="font-bold text-zinc-800 dark:text-zinc-200 block">
              Retailer-Specific Overrides & Individual Terms:
            </span>
            <p className="text-[11px] mt-0.5 leading-relaxed">
              Individual credit limits (e.g. $10,000), approved term lengths (Net 15, Net 30, Net 60), and fee waivers or custom fee overrides (e.g. 2.0% card rate, $0.00 waived) are managed on a per-retailer basis in{" "}
              <strong className="text-zinc-900 dark:text-white">Admin &gt; Retail Network &gt; Retailer Detail &gt; Payments &amp; Terms</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Simulation Controls */}
      <div className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-bold text-zinc-700 dark:text-zinc-300">
            Interactive Fee Simulation Base:
          </span>
          <div className="relative w-32">
            <span className="absolute left-2.5 top-1.5 text-xs font-bold text-zinc-400 pointer-events-none">$</span>
            <input
              type="number"
              min="1"
              step="10"
              value={simAmount}
              onChange={(e) => setSimAmount(Math.max(1, Number(e.target.value) || 0))}
              className="w-full rounded-xl border border-zinc-200 bg-white pl-6 pr-2 py-1 text-xs font-mono font-bold outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            />
          </div>
        </div>
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
          Changes will take effect immediately upon clicking &ldquo;Save Payment Policy&rdquo;.
        </span>
      </div>
    </div>
  );
}
