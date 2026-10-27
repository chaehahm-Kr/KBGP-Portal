"use client";

import React, { useState, useTransition } from "react";
import {
  CompanyResultItem,
  CompanyInterestStatus,
  RecipientEmailActivity,
  CompanyActivityItem,
} from "@/lib/brand-marketing/results-types";
import {
  updateCompanyInterestStatusAction,
  updateCompanyFollowupAction,
  recordVerifiedReplyAction,
} from "@/lib/brand-marketing/results-actions";

interface CompanyResultsDetailDrawerProps {
  company: CompanyResultItem | null;
  isOpen: boolean;
  onClose: () => void;
  onInterestUpdated?: (companyId: string, newStatus: CompanyInterestStatus) => void;
  onFollowupUpdated?: () => void;
  onNavigateToBrandList?: (companyId: string) => void;
}

export function CompanyResultsDetailDrawer({
  company,
  isOpen,
  onClose,
  onInterestUpdated,
  onFollowupUpdated,
  onNavigateToBrandList,
}: CompanyResultsDetailDrawerProps) {
  const [isPending, startTransition] = useTransition();

  // Follow-up form states
  const [nextFollowupDate, setNextFollowupDate] = useState<string>(
    company?.nextFollowupDate || ""
  );
  const [followupNote, setFollowupNote] = useState<string>(company?.followupNote || "");
  const [interestStatus, setInterestStatus] = useState<CompanyInterestStatus>(
    company?.interestStatus || "UNKNOWN"
  );
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Manual reply recording modal/form state
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyNote, setReplyNote] = useState("");

  // Sync state when selected company changes
  React.useEffect(() => {
    if (company) {
      setNextFollowupDate(company.nextFollowupDate || "");
      setFollowupNote(company.followupNote || "");
      setInterestStatus(company.interestStatus || "UNKNOWN");
      setSaveSuccessMsg(null);
      setErrorMsg(null);
      setShowReplyForm(false);
      setReplyNote("");
    }
  }, [company]);

  if (!isOpen || !company) return null;

  const handleSaveInterest = (newStatus: CompanyInterestStatus) => {
    setInterestStatus(newStatus);
    startTransition(async () => {
      const res = await updateCompanyInterestStatusAction({
        companyId: company.companyId,
        campaignId: company.campaignId,
        interestStatus: newStatus,
      });
      if (res.success) {
        setSaveSuccessMsg(`Interest updated to ${newStatus}`);
        setTimeout(() => setSaveSuccessMsg(null), 3000);
        onInterestUpdated?.(company.companyId, newStatus);
      } else {
        setErrorMsg(res.error || "Failed to update interest");
      }
    });
  };

  const handleSaveFollowup = (markCompleted: boolean = false) => {
    setErrorMsg(null);
    setSaveSuccessMsg(null);
    startTransition(async () => {
      const res = await updateCompanyFollowupAction({
        companyId: company.companyId,
        campaignId: company.campaignId,
        nextFollowupDate: nextFollowupDate || null,
        followupNote: followupNote || null,
        markCompleted,
      });

      if (res.success) {
        setSaveSuccessMsg(
          markCompleted ? "Follow-up marked completed!" : "Follow-up saved successfully!"
        );
        setTimeout(() => setSaveSuccessMsg(null), 3000);
        onFollowupUpdated?.();
      } else {
        setErrorMsg(res.error || "Failed to save follow-up");
      }
    });
  };

  const handleRecordReply = () => {
    if (!replyNote.trim()) {
      setErrorMsg("Please enter a short note describing the verified reply.");
      return;
    }
    startTransition(async () => {
      const res = await recordVerifiedReplyAction(
        company.companyId,
        company.campaignId,
        company.recipients[0]?.id,
        replyNote
      );
      if (res.success) {
        setSaveSuccessMsg("Verified reply recorded successfully!");
        setShowReplyForm(false);
        setReplyNote("");
        setTimeout(() => setSaveSuccessMsg(null), 3000);
        onFollowupUpdated?.();
      } else {
        setErrorMsg(res.error || "Failed to record reply");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 h-full overflow-y-auto flex flex-col shadow-2xl">
        {/* DRAWER HEADER */}
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-start justify-between bg-zinc-50 dark:bg-zinc-950/40">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-extrabold uppercase ${
                  company.grade === "A"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300"
                    : company.grade === "B"
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300"
                    : company.grade === "C"
                    ? "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                }`}
              >
                Grade {company.grade}
              </span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">•</span>
              <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                Campaign: {company.campaignName}
              </span>
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {company.companyNameKr}
              {company.companyNameEn && (
                <span className="ml-2 text-sm font-normal text-zinc-500">
                  ({company.companyNameEn})
                </span>
              )}
            </h2>
            {company.brandNames.length > 0 && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Brands: {company.brandNames.join(", ")}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onNavigateToBrandList && (
              <button
                type="button"
                onClick={() => onNavigateToBrandList(company.companyId)}
                className="px-2.5 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded hover:bg-blue-100 cursor-pointer"
                title="View and edit this candidate in Brand List"
              >
                Brand List ↗
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* FEEDBACK BANNERS */}
        {saveSuccessMsg && (
          <div className="mx-5 mt-4 p-3 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-800 dark:text-emerald-200 flex items-center justify-between">
            <span>✓ {saveSuccessMsg}</span>
            <button
              onClick={() => setSaveSuccessMsg(null)}
              className="text-emerald-600 hover:text-emerald-900 font-bold"
            >
              ×
            </button>
          </div>
        )}
        {errorMsg && (
          <div className="mx-5 mt-4 p-3 rounded bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs font-medium text-red-800 dark:text-red-200 flex items-center justify-between">
            <span>⚠️ {errorMsg}</span>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-red-600 hover:text-red-900 font-bold"
            >
              ×
            </button>
          </div>
        )}

        {/* BODY */}
        <div className="p-5 space-y-6 flex-1">
          {/* SECTION 1: INTEREST & FOLLOW-UP CONTROLS */}
          <div className="bg-zinc-50 dark:bg-zinc-950/40 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800/80 pb-2">
              <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
                <span>🎯</span> Company Interest & Follow-up
              </h3>
              <span className="text-[11px] text-zinc-500">
                Company-level (not email-level)
              </span>
            </div>

            {/* Interest Status Radio Pills */}
            <div>
              <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                Prospect Interest Status
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["UNKNOWN", "INTERESTED", "NOT_INTERESTED"] as CompanyInterestStatus[]).map(
                  (status) => {
                    const isSelected = interestStatus === status;
                    return (
                      <button
                        key={status}
                        type="button"
                        disabled={isPending}
                        onClick={() => handleSaveInterest(status)}
                        className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? status === "INTERESTED"
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                              : status === "NOT_INTERESTED"
                              ? "bg-zinc-700 text-white border-zinc-700 shadow-xs"
                              : "bg-blue-600 text-white border-blue-600 shadow-xs"
                            : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        }`}
                      >
                        {status === "INTERESTED"
                          ? "★ INTERESTED"
                          : status === "NOT_INTERESTED"
                          ? "✕ NOT INTERESTED"
                          : "— UNKNOWN"}
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* Follow-up Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                  Next Follow-up Date
                </label>
                <input
                  type="date"
                  value={nextFollowupDate}
                  onChange={(e) => setNextFollowupDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                  Follow-up Schedule Status
                </label>
                <div className="pt-1">
                  <span
                    className={`inline-block text-[11px] px-2.5 py-1 rounded font-bold ${
                      company.followupDueStatus === "OVERDUE"
                        ? "bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300"
                        : company.followupDueStatus === "DUE_TODAY"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                        : company.followupDueStatus === "UPCOMING"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300"
                        : company.followupDueStatus === "COMPLETED"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {company.followupDueStatus === "OVERDUE"
                      ? "⚠️ Overdue"
                      : company.followupDueStatus === "DUE_TODAY"
                      ? "⏰ Due Today"
                      : company.followupDueStatus === "UPCOMING"
                      ? "📅 Upcoming"
                      : company.followupDueStatus === "COMPLETED"
                      ? "✓ Completed"
                      : "No Date Set"}
                  </span>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                  Follow-up Notes
                </label>
                <textarea
                  rows={2}
                  value={followupNote}
                  onChange={(e) => setFollowupNote(e.target.value)}
                  placeholder="Record meeting outcomes, specific product inquiries, or next steps..."
                  className="w-full px-2.5 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>

            {/* Follow-up Action Buttons */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleSaveFollowup(true)}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded hover:bg-emerald-100 cursor-pointer disabled:opacity-50"
              >
                ✓ Mark Completed
              </button>

              <button
                type="button"
                disabled={isPending}
                onClick={() => handleSaveFollowup(false)}
                className="px-4 py-1.5 text-xs font-bold text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 rounded hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Save Follow-up"}
              </button>
            </div>
          </div>

          {/* SECTION 2: RECIPIENT-LEVEL EMAIL ACTIVITY DETAILS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
                  <span>✉️</span> Recipient-level Email Details
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Multiple contacts per company are tracked independently.
                </p>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                {company.recipients.length} Recipient{company.recipients.length !== 1 ? "s" : ""}
              </span>
            </div>

            {company.recipients.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-400 border border-dashed rounded-lg">
                No recipient records found for this company in this campaign.
              </div>
            ) : (
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-50 dark:bg-zinc-950/60 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                      <tr>
                        <th className="py-2 px-3">Contact</th>
                        <th className="py-2 px-3">Email</th>
                        <th className="py-2 px-3">Delivery</th>
                        <th className="py-2 px-3">Open / Click</th>
                        <th className="py-2 px-3">Reply</th>
                        <th className="py-2 px-3">Sent Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {company.recipients.map((rec) => (
                        <tr key={rec.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                          <td className="py-2.5 px-3 font-medium text-zinc-900 dark:text-zinc-100">
                            {rec.contactName || "—"}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                            {rec.recipientEmail}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                rec.deliveryResult === "DELIVERED"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300"
                                  : rec.deliveryResult === "SENT"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300"
                                  : rec.deliveryResult === "BOUNCED"
                                  ? "bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300"
                                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                              }`}
                            >
                              {rec.deliveryResult}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-zinc-500">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] text-zinc-400">
                                Open: {rec.openedStatus === "TRACKED_OPENED" ? "Opened" : "N/A"}
                              </span>
                              <span
                                className={`text-[10px] ${
                                  rec.clickedStatus === "TRACKED_CLICKED"
                                    ? "text-purple-600 font-bold"
                                    : "text-zinc-400"
                                }`}
                              >
                                Click: {rec.clickedStatus === "TRACKED_CLICKED" ? "Clicked" : "N/A"}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            {rec.repliedStatus === "VERIFIED_REPLIED" ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold">
                                ✓ Replied
                              </span>
                            ) : (
                              <span className="text-[10px] text-zinc-400">No Reply</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-zinc-500 whitespace-nowrap">
                            {rec.sentDate ? new Date(rec.sentDate).toLocaleDateString() : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: COMPANY ACTIVITY HISTORY TIMELINE */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
                  <span>📜</span> Chronological Activity History
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Recorded outreach events, verified replies, and staff follow-ups.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded hover:bg-emerald-100 cursor-pointer"
              >
                + Record Verified Reply
              </button>
            </div>

            {/* Reply Form Modal / Inline Input */}
            {showReplyForm && (
              <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 rounded-lg space-y-2">
                <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                  Record Confirmed Prospect Reply
                </h4>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                  Enter notes from inbound email, phone confirmation, or meeting notes:
                </p>
                <textarea
                  rows={2}
                  value={replyNote}
                  onChange={(e) => setReplyNote(e.target.value)}
                  placeholder="e.g. Received reply via email asking for wholesale pricing catalog..."
                  className="w-full px-2.5 py-1.5 text-xs rounded border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowReplyForm(false)}
                    className="px-2.5 py-1 text-xs text-zinc-600 hover:text-zinc-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleRecordReply}
                    className="px-3 py-1 text-xs font-bold text-white bg-emerald-600 rounded hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
                  >
                    {isPending ? "Saving..." : "Save Reply Signal"}
                  </button>
                </div>
              </div>
            )}

            {company.activities.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-400 border border-dashed rounded-lg">
                No recorded activity entries yet for this company.
              </div>
            ) : (
              <div className="space-y-2">
                {company.activities.map((act) => (
                  <div
                    key={act.id}
                    className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${
                            act.activityType === "REPLY_RECORDED"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : act.activityType === "INTEREST_CHANGED"
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                              : act.activityType === "FOLLOWUP_COMPLETED"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          }`}
                        >
                          {act.activityType.replace(/_/g, " ")}
                        </span>
                        <span className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
                          {act.summary}
                        </span>
                      </div>
                      {act.details?.notes && (
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 pl-1 italic">
                          &ldquo;{act.details.notes}&rdquo;
                        </p>
                      )}
                      {act.staffEmail && (
                        <p className="text-[10px] text-zinc-400">by {act.staffEmail}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-400 whitespace-nowrap">
                      {new Date(act.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
