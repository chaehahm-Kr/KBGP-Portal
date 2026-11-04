"use client";

import React from "react";
import {
  CompanyResultItem,
  CompanyInterestStatus,
} from "@/lib/brand-marketing/results-types";

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
  onNavigateToBrandList,
}: CompanyResultsDetailDrawerProps) {
  if (!isOpen || !company) return null;

  const recipients = company.recipients || [];
  const totalContacts = company.recipientCount ?? recipients.length;
  const emailsSent = company.emailsSent ?? recipients.filter((r) => r.deliveryResult !== "PENDING").length;
  const delivered = company.delivered ?? recipients.filter((r) => r.deliveryResult === "DELIVERED").length;
  const bounced = company.bounced ?? recipients.filter((r) => r.deliveryResult === "BOUNCED").length;
  const suppressed = company.suppressed ?? recipients.filter(
    (r) => r.deliveryResult === "FAILED" || (r.errorMessage && r.errorMessage.toLowerCase().includes("suppress"))
  ).length;

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
                title="View candidate in Brand List"
              >
                Brand List에서 보기 ↗
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

        {/* BODY */}
        <div className="p-5 space-y-6 flex-1">
          {/* SECTION 1: DELIVERY METRICS SUMMARY CARDS */}
          <div>
            <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <span>📊</span> Email Delivery Summary
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Contacts</span>
                <p className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 mt-0.5">
                  {totalContacts}
                </p>
              </div>

              <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Emails Sent</span>
                <p className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 mt-0.5">
                  {emailsSent}
                </p>
              </div>

              <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20">
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">Delivered</span>
                <p className="text-base font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">
                  {delivered}
                </p>
              </div>

              <div className="p-3 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20">
                <span className="text-[10px] font-bold text-red-700 dark:text-red-400 uppercase">Bounced</span>
                <p className="text-base font-extrabold text-red-700 dark:text-red-300 mt-0.5">
                  {bounced}
                </p>
              </div>

              <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase">Suppressed</span>
                <p className="text-base font-extrabold text-amber-700 dark:text-amber-300 mt-0.5">
                  {suppressed}
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 2: RECIPIENT-LEVEL EMAIL DELIVERY TABLE */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
                  <span>✉️</span> Recipient-level Email Details
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Verified Resend delivery outcomes per contact recipient.
                </p>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                {recipients.length} Recipient{recipients.length !== 1 ? "s" : ""}
              </span>
            </div>

            {recipients.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-400 border border-dashed rounded-lg">
                No recipient records found for this company in this campaign.
              </div>
            ) : (
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-50 dark:bg-zinc-950/60 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                      <tr>
                        <th className="py-2.5 px-3">Contact</th>
                        <th className="py-2.5 px-3">Email Address</th>
                        <th className="py-2.5 px-3">Delivery Outcome</th>
                        <th className="py-2.5 px-3">Sent Time</th>
                        <th className="py-2.5 px-3">Outcome Detail / Message</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {recipients.map((rec) => {
                        const isDelivered = rec.deliveryResult === "DELIVERED";
                        const isBounced = rec.deliveryResult === "BOUNCED";
                        const isSuppressedOrFailed =
                          rec.deliveryResult === "FAILED" ||
                          (rec.errorMessage && rec.errorMessage.toLowerCase().includes("suppress"));
                        const isPending = rec.deliveryResult === "PENDING";

                        return (
                          <tr key={rec.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                            <td className="py-2.5 px-3 font-medium text-zinc-900 dark:text-zinc-100">
                              {rec.contactName || "—"}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                              {rec.recipientEmail}
                            </td>
                            <td className="py-2.5 px-3">
                              {isDelivered && (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                                  <span>✓</span> DELIVERED
                                </span>
                              )}
                              {isBounced && (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-extrabold bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300">
                                  <span>✕</span> BOUNCED
                                </span>
                              )}
                              {isSuppressedOrFailed && !isBounced && (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                                  <span>⚠️</span> SUPPRESSED
                                </span>
                              )}
                              {isPending && (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-bold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                  <span>⏳</span> PENDING
                                </span>
                              )}
                              {!isDelivered && !isBounced && !isSuppressedOrFailed && !isPending && (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300">
                                  {rec.deliveryResult}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-zinc-500 whitespace-nowrap">
                              {rec.sentDate ? new Date(rec.sentDate).toLocaleString() : "—"}
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-zinc-600 dark:text-zinc-400 max-w-xs truncate">
                              {rec.errorMessage ? (
                                <span className="font-mono text-[10px] text-red-600 dark:text-red-400" title={rec.errorMessage}>
                                  {rec.errorMessage}
                                </span>
                              ) : isDelivered ? (
                                <span className="text-zinc-400">Delivered to remote MTA</span>
                              ) : isPending ? (
                                <span className="text-zinc-400">Excluded or awaiting dispatch</span>
                              ) : (
                                <span className="text-zinc-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
