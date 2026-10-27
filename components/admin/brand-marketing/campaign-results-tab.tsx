"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  CampaignSummaryMetrics,
  CompanyResultItem,
  CompanyInterestStatus,
} from "@/lib/brand-marketing/results-types";
import {
  getCampaignResultsSummaryAction,
  listCompanyResultsAction,
} from "@/lib/brand-marketing/results-actions";

interface CampaignOption {
  id: string;
  name: string;
  status: string;
  language: "ko" | "en";
  createdAt: string;
}

interface CampaignResultsTabProps {
  campaigns: CampaignOption[];
  onSelectCompany: (company: CompanyResultItem) => void;
  onNavigateToBrandList?: (companyId: string) => void;
}

export function CampaignResultsTab({
  campaigns,
  onSelectCompany,
  onNavigateToBrandList,
}: CampaignResultsTabProps) {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(
    campaigns[0]?.id || ""
  );

  // Sync selected campaign when campaigns list loads
  useEffect(() => {
    if (!selectedCampaignId && campaigns.length > 0) {
      setSelectedCampaignId(campaigns[0].id);
    }
  }, [campaigns, selectedCampaignId]);
  const [metrics, setMetrics] = useState<CampaignSummaryMetrics | null>(null);
  const [companyResults, setCompanyResults] = useState<CompanyResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load campaign results data whenever selected campaign changes
  useEffect(() => {
    if (!selectedCampaignId) return;

    let isMounted = true;
    setIsLoading(true);
    setErrorMsg(null);

    Promise.all([
      getCampaignResultsSummaryAction(selectedCampaignId),
      listCompanyResultsAction({ campaignId: selectedCampaignId }),
    ])
      .then(([summaryRes, companiesRes]) => {
        if (!isMounted) return;
        if (summaryRes.success && summaryRes.metrics) {
          setMetrics(summaryRes.metrics);
        } else {
          setMetrics(null);
        }

        if (companiesRes.success && companiesRes.results) {
          setCompanyResults(companiesRes.results);
        } else {
          setCompanyResults([]);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMsg(err.message || "Failed to load campaign results");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedCampaignId]);

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);

  return (
    <div className="space-y-6">
      {/* 1. CAMPAIGN SELECTOR HEADER */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              TAB A: Live Campaign Performance
            </span>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>📊</span> Campaign Results Overview
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Select an email campaign to view outreach volume, delivery verification, and conversion rates.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 shrink-0">
              Campaign:
            </label>
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 min-w-[220px]"
            >
              {campaigns.length === 0 ? (
                <option value="">No campaigns available</option>
              ) : (
                campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.status})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {selectedCampaign && (
          <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center gap-3 text-xs">
            <span className="text-zinc-500">
              Date:{" "}
              <strong className="text-zinc-700 dark:text-zinc-300 font-mono">
                {new Date(selectedCampaign.createdAt).toLocaleDateString()}
              </strong>
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <span className="text-zinc-500">
              Status:{" "}
              <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                {selectedCampaign.status}
              </span>
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <span className="text-zinc-500">
              Language:{" "}
              <span className="uppercase font-bold text-zinc-700 dark:text-zinc-300">
                {selectedCampaign.language}
              </span>
            </span>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-800 dark:text-red-200">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* 2. SUMMARY METRICS GRID (9 Cards) */}
      {metrics ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-3">
            {/* Card 1: Companies Contacted */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-2xs">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight block truncate">
                Companies Contacted
              </span>
              <p className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100 mt-1">
                {metrics.companiesContacted}
              </p>
              <span className="text-[10px] text-zinc-400">Unique company IDs</span>
            </div>

            {/* Card 2: Emails Sent */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-2xs">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight block truncate">
                Emails Sent
              </span>
              <p className="text-xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
                {metrics.emailsSent}
              </p>
              <span className="text-[10px] text-zinc-400">Recipient messages</span>
            </div>

            {/* Card 3: Delivered */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-2xs">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight block truncate">
                Delivered
              </span>
              <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                {metrics.delivered}
              </p>
              <span className="text-[10px] text-zinc-400">
                {metrics.deliveryRate > 0
                  ? `${(metrics.deliveryRate * 100).toFixed(1)}% rate`
                  : "Verified"}
              </span>
            </div>

            {/* Card 4: Opened (Estimated) */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-2xs">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight block truncate">
                Opened (Est.)
              </span>
              <p className="text-xl font-extrabold text-zinc-500 dark:text-zinc-400 mt-1">
                {metrics.openedEstimated !== null ? metrics.openedEstimated : "N/A"}
              </p>
              <span
                className="text-[10px] text-amber-600 dark:text-amber-400 block truncate"
                title="Open tracking is an unverified estimate due to image blocking and privacy proxy caching"
              >
                Not Tracked ℹ
              </span>
            </div>

            {/* Card 5: Clicked */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-2xs">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight block truncate">
                Clicked
              </span>
              <p className="text-xl font-extrabold text-zinc-500 dark:text-zinc-400 mt-1">
                {metrics.clicked !== null ? metrics.clicked : "N/A"}
              </p>
              <span className="text-[10px] text-zinc-400 block truncate">
                Not Tracked
              </span>
            </div>

            {/* Card 6: Replied */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-2xs">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight block truncate">
                Replied
              </span>
              <p className="text-xl font-extrabold text-purple-600 dark:text-purple-400 mt-1">
                {metrics.replied}
              </p>
              <span className="text-[10px] text-zinc-400">
                {metrics.replyRate > 0
                  ? `${(metrics.replyRate * 100).toFixed(1)}% rate`
                  : "Verified replies"}
              </span>
            </div>

            {/* Card 7: Interested Companies */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-2xs">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight block truncate">
                Interested
              </span>
              <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                {metrics.interestedCompanies}
              </p>
              <span className="text-[10px] text-zinc-400">
                {(metrics.interestRate * 100).toFixed(1)}% rate
              </span>
            </div>

            {/* Card 8: Meetings */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-2xs">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight block truncate">
                Meetings
              </span>
              <p className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">
                {metrics.meetings}
              </p>
              <span className="text-[10px] text-zinc-400">
                {(metrics.meetingConversionRate * 100).toFixed(1)}% conv.
              </span>
            </div>

            {/* Card 9: Partners */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-2xs">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight block truncate">
                Partners
              </span>
              <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
                {metrics.partners}
              </p>
              <span className="text-[10px] text-zinc-400">
                {(metrics.partnerConversionRate * 100).toFixed(1)}% conv.
              </span>
            </div>
          </div>

          {/* 3. RATES CONVERSION & RELIABILITY DISCLOSURE */}
          <div className="bg-zinc-50 dark:bg-zinc-950/40 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
            <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
              <span>📈</span> Conversion Funnel & Reliability Rules
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <span className="text-[10px] text-zinc-500 font-semibold block">Delivery Rate</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {(metrics.deliveryRate * 100).toFixed(1)}%
                </span>
                <p className="text-[10px] text-zinc-400 mt-0.5">Delivered / Emails Sent</p>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <span className="text-[10px] text-zinc-500 font-semibold block">Reply Rate</span>
                <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                  {(metrics.replyRate * 100).toFixed(1)}%
                </span>
                <p className="text-[10px] text-zinc-400 mt-0.5">Verified Replies / Emails Sent</p>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <span className="text-[10px] text-zinc-500 font-semibold block">Interest Rate</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {(metrics.interestRate * 100).toFixed(1)}%
                </span>
                <p className="text-[10px] text-zinc-400 mt-0.5">Interested / Companies</p>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <span className="text-[10px] text-zinc-500 font-semibold block">Meeting Conv.</span>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  {(metrics.meetingConversionRate * 100).toFixed(1)}%
                </span>
                <p className="text-[10px] text-zinc-400 mt-0.5">Meetings / Companies</p>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <span className="text-[10px] text-zinc-500 font-semibold block">Partner Conv.</span>
                <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                  {(metrics.partnerConversionRate * 100).toFixed(1)}%
                </span>
                <p className="text-[10px] text-zinc-400 mt-0.5">Partners / Companies</p>
              </div>
            </div>

            {/* MANDATORY RELIABILITY POLICY DISCLOSURE */}
            <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 text-[11px] text-blue-950 dark:text-blue-200 leading-relaxed">
              <strong className="font-bold">⚠️ Delivery & Engagement Reliability Standard:</strong>
              <ul className="list-disc pl-4 mt-1 space-y-0.5 text-zinc-600 dark:text-zinc-400">
                <li>
                  <strong className="text-zinc-800 dark:text-zinc-200">SENT ≠ DELIVERED:</strong> Messages are only counted as delivered upon verified SMTP gateway acceptance.
                </li>
                <li>
                  <strong className="text-zinc-800 dark:text-zinc-200">OPENED is an estimate:</strong> Image proxying and privacy protection (e.g. Apple Mail Privacy) make open tracking unreliable. When telemetry is not connected, it is disclosed as N/A rather than zero.
                </li>
                <li>
                  <strong className="text-zinc-800 dark:text-zinc-200">REPLIED requires human verification:</strong> Replies and interest are never inferred solely from opens or clicks.
                </li>
              </ul>
            </div>
          </div>
        </div>
      ) : isLoading ? (
        <div className="p-8 text-center text-xs text-zinc-400">
          Loading campaign summary metrics...
        </div>
      ) : (
        <div className="p-8 text-center text-xs text-zinc-400 border border-dashed rounded-xl">
          No campaign selected or no recipient metrics available.
        </div>
      )}

      {/* 4. CAMPAIGN COMPANY RESULTS BREAKDOWN TABLE */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>🏢</span> Contacted Companies in this Campaign
            </h3>
            <p className="text-xs text-zinc-500">
              Shows one row per company with aggregate delivery state, interest status, and follow-up.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
            {companyResults.length} Companies
          </span>
        </div>

        {companyResults.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-400">
            No company outreach records found for this campaign.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-950/60 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                <tr>
                  <th className="py-2.5 px-4">Company</th>
                  <th className="py-2.5 px-3">Emails Sent</th>
                  <th className="py-2.5 px-3">Delivery Result</th>
                  <th className="py-2.5 px-3">Reply</th>
                  <th className="py-2.5 px-3">Interest Status</th>
                  <th className="py-2.5 px-3">Next Follow-up</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {companyResults.map((c) => (
                  <tr
                    key={c.companyId}
                    className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/60 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {c.companyNameKr}
                      </div>
                      {c.brandNames.length > 0 && (
                        <div className="text-[11px] text-zinc-500 truncate max-w-[200px]">
                          {c.brandNames.join(", ")}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono text-zinc-700 dark:text-zinc-300 font-bold">
                        {c.emailsSentCount}
                      </span>{" "}
                      <span className="text-[10px] text-zinc-400">
                        recipient{c.emailsSentCount !== 1 ? "s" : ""}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          c.latestEmailResult === "DELIVERED"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : c.latestEmailResult === "SENT"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            : c.latestEmailResult === "BOUNCED"
                            ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {c.latestEmailResult}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {c.hasReply ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold">
                          ✓ Replied
                        </span>
                      ) : (
                        <span className="text-[10px] text-zinc-400">No reply</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          c.interestStatus === "INTERESTED"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : c.interestStatus === "NOT_INTERESTED"
                            ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-850 dark:text-zinc-400"
                        }`}
                      >
                        {c.interestStatus}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[11px] text-zinc-500 whitespace-nowrap">
                      {c.nextFollowupDate ? (
                        <span
                          className={`font-mono ${
                            c.followupDueStatus === "OVERDUE"
                              ? "text-red-600 font-bold"
                              : c.followupDueStatus === "DUE_TODAY"
                              ? "text-amber-600 font-bold"
                              : "text-zinc-700 dark:text-zinc-300"
                          }`}
                        >
                          {c.nextFollowupDate}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectCompany(c)}
                        className="px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded hover:bg-blue-100 cursor-pointer"
                      >
                        Details & Follow-up →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
