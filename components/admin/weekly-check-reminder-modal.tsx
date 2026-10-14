"use client";

import React, { useState, useEffect } from "react";
import {
  WeeklyCheckReminderPreview,
  adminGetWeeklyCheckReminderPreviewAction,
  adminSendWeeklyCheckReminderAction,
} from "@/lib/retailer/admin-retailer-actions";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  storeId: string;
  storeName: string;
  reportingWeek: string;
  onReminderSent?: () => void;
}

export function WeeklyCheckReminderModal({
  isOpen,
  onClose,
  companyId,
  storeId,
  storeName,
  reportingWeek,
  onReminderSent,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<WeeklyCheckReminderPreview | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load preview data whenever modal opens
  const loadPreview = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const res = await adminGetWeeklyCheckReminderPreviewAction({
      companyId,
      storeId,
      reportingWeek,
    });

    if (res.success && res.data) {
      setPreview(res.data);
      // Select all recipients by default
      setSelectedUserIds(res.data.recipients.map((r) => r.userId));
    } else {
      setError(res.error || "Failed to load reminder preview.");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadPreview();
    }
  }, [isOpen, companyId, storeId, reportingWeek]);

  if (!isOpen) return null;

  const handleToggleRecipient = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleToggleAll = () => {
    if (!preview) return;
    if (selectedUserIds.length === preview.recipients.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(preview.recipients.map((r) => r.userId));
    }
  };

  const handleSendReminder = async () => {
    if (selectedUserIds.length === 0 || isSending) return;

    setIsSending(true);
    setError(null);
    setSuccessMsg(null);

    const res = await adminSendWeeklyCheckReminderAction({
      companyId,
      storeId,
      reportingWeek,
      recipientUserIds: selectedUserIds,
    });

    if (res.success) {
      setSuccessMsg(
        `Successfully sent inventory check reminder to ${res.recipientsCount} recipient(s).`
      );
      if (onReminderSent) {
        onReminderSent();
      }
      setTimeout(() => {
        onClose();
      }, 1800);
    } else {
      setError(res.error || "Failed to send reminder.");
    }
    setIsSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">✉️</span>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                Send Weekly Inventory Check Reminder
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                🏪 {storeName} · Reporting Week <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{reportingWeek}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-400 text-xs">
              <span className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span>Checking store submission status and loading recipients...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center justify-between">
              <span>{error}</span>
              <button
                type="button"
                onClick={loadPreview}
                className="text-xs font-bold underline cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : preview ? (
            <>
              {/* Feedback Alert */}
              {successMsg && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Already Submitted Warning */}
              {preview.isAlreadySubmitted && (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs flex items-start gap-2.5">
                  <span className="text-base shrink-0">✅</span>
                  <div>
                    <p className="font-bold">Inventory Check Already Submitted</p>
                    <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-0.5">
                      Store &quot;{storeName}&quot; has already submitted its count for {reportingWeek}. No reminder is needed.
                    </p>
                  </div>
                </div>
              )}

              {/* 1. Recipient Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                    Recipients ({selectedUserIds.length}/{preview.recipients.length} Selected)
                  </label>
                  {preview.recipients.length > 1 && (
                    <button
                      type="button"
                      onClick={handleToggleAll}
                      className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      {selectedUserIds.length === preview.recipients.length ? "Deselect All" : "Select All"}
                    </button>
                  )}
                </div>

                {preview.recipients.length === 0 ? (
                  <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-800">
                    No active team members or store managers found for this store.
                  </p>
                ) : (
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    {preview.recipients.map((rec) => {
                      const isSelected = selectedUserIds.includes(rec.userId);

                      return (
                        <div
                          key={rec.userId}
                          onClick={() => handleToggleRecipient(rec.userId)}
                          className={`p-3 flex items-center justify-between gap-3 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer select-none transition-colors ${
                            isSelected ? "bg-indigo-50/20 dark:bg-indigo-950/20" : ""
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // handled by parent div
                              className="w-4 h-4 rounded-sm text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-zinc-900 dark:text-white">
                                  {rec.name}
                                </span>
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 capitalize">
                                  {rec.role.replace("_", " ")}
                                </span>
                              </div>
                              <span className="text-[11px] font-mono text-zinc-500">
                                {rec.email}
                              </span>
                            </div>
                          </div>
                          {rec.phone && (
                            <span className="text-[11px] text-zinc-400">{rec.phone}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 2. Email Template Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                    Email Preview
                  </label>
                  <span className="text-[10px] font-mono text-zinc-400">
                    Template: hub_retailer_weekly_check_reminder
                  </span>
                </div>

                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 p-4 space-y-3 text-xs font-mono">
                  <div className="border-b border-zinc-200 dark:border-zinc-700/60 pb-2">
                    <span className="text-zinc-400 block text-[10px] uppercase font-bold font-sans">
                      Subject
                    </span>
                    <span className="font-semibold text-zinc-900 dark:text-white font-sans text-xs">
                      {preview.subject}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px] uppercase font-bold font-sans mb-1">
                      Body Preview
                    </span>
                    <div className="whitespace-pre-wrap text-[11px] text-zinc-700 dark:text-zinc-300 leading-relaxed font-sans bg-white dark:bg-zinc-900 p-3 rounded-lg border border-zinc-200/80 dark:border-zinc-800">
                      {preview.body}
                    </div>
                  </div>
                </div>
              </div>

              {/* Policy note */}
              <p className="text-[10px] text-zinc-400 italic">
                * Note: In accordance with operational policy, reminders are manually initiated by Admin only. No automated background blasts are executed.
              </p>
            </>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={loadPreview}
            disabled={loading || isSending}
            className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <span>🔄</span>
            <span>Recheck Status</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSendReminder}
              disabled={
                loading ||
                isSending ||
                selectedUserIds.length === 0 ||
                (preview?.isAlreadySubmitted ?? false)
              }
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isSending ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Sending Reminder...</span>
                </>
              ) : (
                <>
                  <span>✉️</span>
                  <span>Send Reminder ({selectedUserIds.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
