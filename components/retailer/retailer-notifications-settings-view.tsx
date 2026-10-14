"use client";

import React, { useState, useTransition } from "react";
import {
  WeeklyReportNotificationState,
  updateWeeklyReportEmailOptInAction,
} from "@/lib/retailer/notification-actions";

interface Props {
  initialState: WeeklyReportNotificationState;
}

export function RetailerNotificationsSettingsView({ initialState }: Props) {
  const [optIn, setOptIn] = useState<boolean>(initialState.optIn);
  const [optedInAt, setOptedInAt] = useState<string | null>(initialState.optedInAt);
  const [isPending, startTransition] = useTransition();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canEdit = ["owner", "buyer", "store_manager"].includes(initialState.role);

  const handleToggle = (checked: boolean) => {
    if (!canEdit || isPending) return;

    setErrorMessage(null);
    setToastMessage(null);

    startTransition(async () => {
      const res = await updateWeeklyReportEmailOptInAction(checked);
      if (res.success) {
        setOptIn(!!res.optIn);
        setOptedInAt(res.optIn ? new Date().toISOString() : null);
        setToastMessage(
          checked
            ? "Weekly Report email delivery enabled."
            : "Weekly Report email delivery disabled."
        );
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        setErrorMessage(res.error || "Failed to update notification preferences.");
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Notification Settings
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Manage your email communication preferences and automated operational reports.
        </p>
      </div>

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-emerald-500 font-bold">✓</span>
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Feedback */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm flex items-center justify-between shadow-xs">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-xs text-red-600 dark:text-red-400 hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Section Card: Weekly Performance & Reorder Reports */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-xs space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xl">📊</span>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                Weekly Performance & Reorder Report
              </h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-2xl leading-relaxed">
              Receive a weekly summary email containing your store sales estimates, inventory health,
              and replenishment recommendations immediately following weekly inventory reconciliation.
            </p>
          </div>

          {/* Toggle Switch */}
          <div className="flex items-center gap-3 shrink-0">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={optIn}
                onChange={(e) => handleToggle(e.target.checked)}
                disabled={!canEdit || isPending}
                className="sr-only peer"
              />
              <div
                className={`w-11 h-6 bg-zinc-200 peer-focus:outline-hidden rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 ${
                  optIn ? "peer-checked:bg-indigo-600" : ""
                } ${(!canEdit || isPending) ? "opacity-60 cursor-not-allowed" : ""}`}
              />
            </label>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 w-12">
              {optIn ? "ON" : "OFF"}
            </span>
          </div>
        </div>

        {/* Status Callout / Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs">
          <div>
            <span className="text-zinc-400 block text-[10px] font-bold uppercase tracking-wider">
              Recipient Email
            </span>
            <span className="font-mono text-zinc-800 dark:text-zinc-200 font-medium">
              {initialState.email || "No email on record"}
            </span>
          </div>

          <div>
            <span className="text-zinc-400 block text-[10px] font-bold uppercase tracking-wider">
              Opt-in Status
            </span>
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              {optIn ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Subscribed (Opted-in)
                </span>
              ) : (
                <span className="text-zinc-500 inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                  Disabled (Default: Off)
                </span>
              )}
            </span>
          </div>

          <div>
            <span className="text-zinc-400 block text-[10px] font-bold uppercase tracking-wider">
              Schedule & Delivery
            </span>
            <span className="text-zinc-600 dark:text-zinc-400">
              Mondays @ 9:00 AM Eastern Time
            </span>
          </div>
        </div>

        {/* Operational Note */}
        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-zinc-700 dark:text-zinc-300">
            <span>ℹ️</span>
            <span>Important Operational Policy</span>
          </div>
          <p>
            Automated email reports are <strong>OFF by default</strong>. They are delivered only to verified store owners, buyers, and managers who explicitly enable this switch.
          </p>
          <p>
            Production automated broadcast is currently pending official K SELECT dispatch calendar sign-off. Your opt-in preference is safely preserved in your account settings.
          </p>
        </div>
      </div>
    </div>
  );
}
