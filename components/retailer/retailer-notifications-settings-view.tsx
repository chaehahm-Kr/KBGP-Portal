"use client";

import React, { useState, useTransition } from "react";
import {
  WeeklyReportNotificationState,
  WeeklyReportRecipientItem,
  updateWeeklyReportEmailOptInAction,
  addWeeklyReportRecipientAction,
  toggleRecipientDeliveryAction,
  removeWeeklyReportRecipientAction,
} from "@/lib/retailer/notification-actions";

interface Props {
  initialState: WeeklyReportNotificationState;
}

export function RetailerNotificationsSettingsView({ initialState }: Props) {
  const [optIn, setOptIn] = useState<boolean>(initialState.optIn);
  const [optedInAt, setOptedInAt] = useState<string | null>(initialState.optedInAt);
  const [recipients, setRecipients] = useState<WeeklyReportRecipientItem[]>(
    initialState.recipients || []
  );
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [customEmail, setCustomEmail] = useState<string>("");
  const [isAddingMode, setIsAddingMode] = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canEdit = ["owner", "buyer", "store_manager"].includes(initialState.role);
  const canManageRecipients = initialState.canManageRecipients;

  // Filter eligible team members not already added as active recipients
  const availableTeamMembers = (initialState.eligibleTeamMembers || []).filter(
    (tm) => !recipients.some((r) => r.id === tm.id && r.optIn)
  );

  const handleGlobalToggle = (checked: boolean) => {
    if (!canEdit || isPending) return;

    setErrorMessage(null);
    setToastMessage(null);

    startTransition(async () => {
      const res = await updateWeeklyReportEmailOptInAction(checked);
      if (res.success) {
        setOptIn(!!res.optIn);
        const timestamp = res.optIn ? new Date().toISOString() : null;
        setOptedInAt(timestamp);

        // Also update current user in recipients list
        setRecipients((prev) =>
          prev.map((r) =>
            r.isCurrentUser
              ? {
                  ...r,
                  optIn: checked,
                  status: checked ? "active" : "disabled",
                  optedInAt: timestamp,
                }
              : r
          )
        );

        setToastMessage(
          checked
            ? "Weekly Report email delivery enabled for your account."
            : "Weekly Report email delivery disabled for your account."
        );
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        setErrorMessage(res.error || "Failed to update notification preferences.");
      }
    });
  };

  const handleToggleRecipient = (recipientId: string, currentStatus: boolean) => {
    if ((!canManageRecipients && !recipients.find((r) => r.id === recipientId)?.isCurrentUser) || isPending) {
      return;
    }

    setErrorMessage(null);
    setToastMessage(null);
    const newStatus = !currentStatus;

    startTransition(async () => {
      const res = await toggleRecipientDeliveryAction(recipientId, newStatus);
      if (res.success) {
        const timestamp = newStatus ? new Date().toISOString() : null;
        setRecipients((prev) =>
          prev.map((r) => {
            if (r.id === recipientId) {
              return {
                ...r,
                optIn: newStatus,
                status: newStatus ? "active" : "disabled",
                optedInAt: timestamp,
              };
            }
            return r;
          })
        );

        // If toggling self, update global switch too
        const isSelf = recipients.find((r) => r.id === recipientId)?.isCurrentUser;
        if (isSelf) {
          setOptIn(newStatus);
          setOptedInAt(timestamp);
        }

        setToastMessage(
          newStatus ? "Report recipient delivery enabled." : "Report recipient delivery paused."
        );
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        setErrorMessage(res.error || "Failed to update recipient delivery.");
      }
    });
  };

  const handleRemoveRecipient = (recipientId: string) => {
    if (!canManageRecipients || isPending) return;

    setErrorMessage(null);
    setToastMessage(null);

    startTransition(async () => {
      const res = await removeWeeklyReportRecipientAction(recipientId);
      if (res.success) {
        setRecipients((prev) =>
          prev.map((r) =>
            r.id === recipientId
              ? { ...r, optIn: false, status: "disabled", optedInAt: null }
              : r
          )
        );

        const isSelf = recipients.find((r) => r.id === recipientId)?.isCurrentUser;
        if (isSelf) {
          setOptIn(false);
          setOptedInAt(null);
        }

        setToastMessage("Recipient removed from report delivery.");
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        setErrorMessage(res.error || "Failed to remove recipient.");
      }
    });
  };

  const handleAddRecipient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageRecipients || isPending) return;

    setErrorMessage(null);
    setToastMessage(null);

    const payload = selectedUserId ? { userId: selectedUserId } : { email: customEmail };

    if (!payload.userId && !payload.email) {
      setErrorMessage("Please select a team member or enter an email address.");
      return;
    }

    startTransition(async () => {
      const res = await addWeeklyReportRecipientAction(payload);
      if (res.success && res.recipient) {
        const added = res.recipient;
        setRecipients((prev) => {
          const exists = prev.some((r) => r.id === added.id);
          if (exists) {
            return prev.map((r) => (r.id === added.id ? added : r));
          }
          return [...prev, added];
        });

        if (added.isCurrentUser) {
          setOptIn(true);
          setOptedInAt(added.optedInAt);
        }

        setSelectedUserId("");
        setCustomEmail("");
        setIsAddingMode(false);
        setToastMessage(`Added ${added.name} (${added.email}) as weekly report recipient.`);
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        setErrorMessage(res.error || "Failed to add recipient.");
      }
    });
  };

  return (
    <div className="w-full max-w-5xl space-y-6 pb-12">
      {/* Page Header (Left-Aligned) */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Notification Settings
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Manage your email communication preferences and automated operational reports for {initialState.companyName}.
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
          <div className="flex items-center gap-2">
            <span className="text-red-500 font-bold">⚠️</span>
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-xs text-red-600 dark:text-red-400 hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Primary Section Card: Weekly Performance & Reorder Reports */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xl">📊</span>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                Weekly Performance & Reorder Report Delivery
              </h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-2xl leading-relaxed">
              Receive a weekly summary email containing your store sales estimates, inventory health,
              and replenishment recommendations immediately following weekly inventory reconciliation.
            </p>
          </div>

          {/* Current User Toggle Switch */}
          <div className="flex items-center gap-3 shrink-0 self-start">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={optIn}
                onChange={(e) => handleGlobalToggle(e.target.checked)}
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
              Your Account Email
            </span>
            <span className="font-mono text-zinc-800 dark:text-zinc-200 font-medium">
              {initialState.email || "No email on record"}
            </span>
          </div>

          <div>
            <span className="text-zinc-400 block text-[10px] font-bold uppercase tracking-wider">
              Your Opt-in Status
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

        {/* Multi-Recipient Management Section */}
        <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <span>👥</span>
                <span>Authorized Report Recipients</span>
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Manage which store owners, buyers, and managers receive weekly performance reports.
              </p>
            </div>

            {canManageRecipients && (
              <button
                type="button"
                onClick={() => setIsAddingMode(!isAddingMode)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors self-start sm:self-auto cursor-pointer"
              >
                <span>{isAddingMode ? "✕ Close" : "+ Add Recipient"}</span>
              </button>
            )}
          </div>

          {/* Add Recipient Form Panel */}
          {isAddingMode && canManageRecipients && (
            <form
              onSubmit={handleAddRecipient}
              className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700 space-y-3"
            >
              <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                Add Store Leadership Recipient
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Select an existing store manager, buyer, or owner from your organization, or specify their registered email. For confidential financial data protection, external unverified users must first be invited to your team under Settings &gt; Team.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                    Select Organization Member
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => {
                      setSelectedUserId(e.target.value);
                      if (e.target.value) setCustomEmail("");
                    }}
                    className="w-full text-xs rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Choose verified team member --</option>
                    {availableTeamMembers.map((tm) => (
                      <option key={tm.id} value={tm.id}>
                        {tm.name} ({tm.email}) — {tm.role}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                    Or Enter Member Email
                  </label>
                  <input
                    type="email"
                    placeholder="manager@yourstore.com"
                    value={customEmail}
                    onChange={(e) => {
                      setCustomEmail(e.target.value);
                      if (e.target.value) setSelectedUserId("");
                    }}
                    className="w-full text-xs rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingMode(false);
                    setSelectedUserId("");
                    setCustomEmail("");
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || (!selectedUserId && !customEmail)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? "Adding..." : "Confirm Recipient"}
                </button>
              </div>
            </form>
          )}

          {/* Recipients Table / Roster */}
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Team Member</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Delivery</th>
                  {canManageRecipients && (
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {recipients.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canManageRecipients ? 5 : 4}
                      className="py-6 text-center text-zinc-400 text-xs"
                    >
                      No authorized recipients configured.
                    </td>
                  </tr>
                ) : (
                  recipients.map((rec) => (
                    <tr
                      key={rec.id}
                      className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                    >
                      {/* Name & Email */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                              <span>{rec.name}</span>
                              {rec.isCurrentUser && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                              {rec.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-2.5 px-3">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold capitalize bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                          {rec.role.replace("_", " ")}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 text-center">
                        {rec.status === "active" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 px-2 py-0.5 rounded-md">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : rec.status === "pending_verification" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/80 px-2 py-0.5 rounded-md">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Pending Verification
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-0.5 rounded-md">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                            Disabled
                          </span>
                        )}
                      </td>

                      {/* Delivery Toggle */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleRecipient(rec.id, rec.optIn)}
                          disabled={isPending || (!canManageRecipients && !rec.isCurrentUser)}
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer disabled:opacity-50 ${
                            rec.optIn
                              ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100"
                              : "bg-zinc-50 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100"
                          }`}
                        >
                          {rec.optIn ? "Enabled" : "Paused"}
                        </button>
                      </td>

                      {/* Actions */}
                      {canManageRecipients && (
                        <td className="py-2.5 px-3 text-right">
                          {!rec.isCurrentUser && (
                            <button
                              type="button"
                              onClick={() => handleRemoveRecipient(rec.id)}
                              disabled={isPending}
                              className="text-[11px] text-red-600 dark:text-red-400 hover:underline cursor-pointer disabled:opacity-50"
                            >
                              Remove
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Operational & Security Policy Note */}
        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-zinc-700 dark:text-zinc-300">
            <span>ℹ️</span>
            <span>Confidential Financial Data & Operational Policy</span>
          </div>
          <p>
            • <strong>Default Off & Explicit Consent:</strong> Automated email delivery is <strong>OFF by default</strong>. Reports are delivered only to verified store owners, buyers, and managers who explicitly enable receipt.
          </p>
          <p>
            • <strong>Role-Based Access:</strong> Weekly reports contain sensitive estimated retail margins, store movement, and replenishment data. Only verified leadership team members may be authorized.
          </p>
          <p>
            • <strong>Production Broadcast Calendar:</strong> Automated weekly email dispatches remain pending official K SELECT dispatch calendar activation. All recipient settings are securely preserved.
          </p>
        </div>
      </div>
    </div>
  );
}
