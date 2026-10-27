"use client";

import React, { useState, useEffect, useTransition, useMemo } from "react";
import {
  CompanyResultItem,
  CompanyInterestStatus,
  DeliveryResultStatus,
  FollowupDueStatus,
} from "@/lib/brand-marketing/results-types";
import {
  listCompanyResultsAction,
  updateCompanyInterestStatusAction,
} from "@/lib/brand-marketing/results-actions";

interface CampaignOption {
  id: string;
  name: string;
  status: string;
}

interface CompanyResultsTabProps {
  campaigns: CampaignOption[];
  onSelectCompany: (company: CompanyResultItem) => void;
  onNavigateToBrandList?: (companyId: string) => void;
}

export function CompanyResultsTab({
  campaigns,
  onSelectCompany,
  onNavigateToBrandList,
}: CompanyResultsTabProps) {
  const [isPending, startTransition] = useTransition();

  // Filter States
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [emailResultFilter, setEmailResultFilter] = useState<DeliveryResultStatus | "ALL">("ALL");
  const [replyFilter, setReplyFilter] = useState<"ALL" | "REPLIED" | "NO_REPLY">("ALL");
  const [interestFilter, setInterestFilter] = useState<CompanyInterestStatus | "ALL">("ALL");
  const [followupDueFilter, setFollowupDueFilter] = useState<FollowupDueStatus | "ALL">("ALL");

  const [companyResults, setCompanyResults] = useState<CompanyResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load results from server action
  const loadData = () => {
    setIsLoading(true);
    setErrorMsg(null);

    listCompanyResultsAction({
      campaignId: selectedCampaignId,
      searchQuery: searchQuery.trim() || undefined,
      emailResult: emailResultFilter,
      replyStatus: replyFilter,
      interestStatus: interestFilter,
      followupDueStatus: followupDueFilter,
    })
      .then((res) => {
        if (res.success && res.results) {
          setCompanyResults(res.results);
        } else {
          setCompanyResults([]);
        }
      })
      .catch((err) => {
        setErrorMsg(err.message || "Failed to load company results");
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, [
    selectedCampaignId,
    emailResultFilter,
    replyFilter,
    interestFilter,
    followupDueFilter,
  ]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleQuickInterestChange = (companyId: string, campaignId: string, newStatus: CompanyInterestStatus) => {
    // Optimistic UI update
    setCompanyResults((prev) =>
      prev.map((c) => (c.companyId === companyId ? { ...c, interestStatus: newStatus } : c))
    );

    startTransition(async () => {
      const res = await updateCompanyInterestStatusAction({
        companyId,
        campaignId,
        interestStatus: newStatus,
      });
      if (!res.success) {
        loadData(); // Revert on failure
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* 1. FILTER & SEARCH BAR */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              TAB B: Company Results & Outreach Action List
            </span>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <span>🏢</span> Company Outreach Directory
            </h2>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
            {companyResults.length} Contacted Companies
          </span>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="sm:col-span-2 flex gap-1.5">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search company, brand, contact email..."
              className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
            />
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-bold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 cursor-pointer"
            >
              Search
            </button>
          </form>

          {/* Campaign Filter */}
          <div>
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium"
            >
              <option value="ALL">All Campaigns</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Email Result Filter */}
          <div>
            <select
              value={emailResultFilter}
              onChange={(e) => setEmailResultFilter(e.target.value as any)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium"
            >
              <option value="ALL">All Delivery States</option>
              <option value="DELIVERED">Delivered</option>
              <option value="SENT">Sent</option>
              <option value="BOUNCED">Bounced</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>

          {/* Reply Status Filter */}
          <div>
            <select
              value={replyFilter}
              onChange={(e) => setReplyFilter(e.target.value as any)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium"
            >
              <option value="ALL">All Reply Status</option>
              <option value="REPLIED">✓ Replied</option>
              <option value="NO_REPLY">No Reply</option>
            </select>
          </div>

          {/* Interest Status Filter */}
          <div>
            <select
              value={interestFilter}
              onChange={(e) => setInterestFilter(e.target.value as any)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium"
            >
              <option value="ALL">All Interest</option>
              <option value="INTERESTED">★ Interested</option>
              <option value="NOT_INTERESTED">✕ Not Interested</option>
              <option value="UNKNOWN">— Unknown</option>
            </select>
          </div>
        </div>

        {/* Second Row: Follow-up Due Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
          <span className="text-[11px] font-semibold text-zinc-500 mr-1">Follow-up:</span>
          {(
            [
              { key: "ALL", label: "All" },
              { key: "OVERDUE", label: "⚠️ Overdue" },
              { key: "DUE_TODAY", label: "⏰ Due Today" },
              { key: "UPCOMING", label: "📅 Upcoming" },
              { key: "NO_DATE", label: "No Date" },
              { key: "COMPLETED", label: "✓ Completed" },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFollowupDueFilter(item.key)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                followupDueFilter === item.key
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-800 dark:text-red-200">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* 2. COMPANY RESULTS DATA TABLE */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-zinc-400">Loading company results...</div>
        ) : companyResults.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-400">
            No contacted companies match the selected filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-950/60 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                <tr>
                  <th className="py-2.5 px-4">Company</th>
                  <th className="py-2.5 px-3">Campaign</th>
                  <th className="py-2.5 px-3 text-center">Emails Sent</th>
                  <th className="py-2.5 px-3">Latest Result</th>
                  <th className="py-2.5 px-3">Reply</th>
                  <th className="py-2.5 px-3">Interest</th>
                  <th className="py-2.5 px-3">Next Follow-up</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {companyResults.map((c) => (
                  <tr
                    key={c.companyId}
                    className="hover:bg-zinc-50/70 dark:hover:bg-zinc-900/70 transition-colors"
                  >
                    {/* Company */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[9px] px-1 py-0.2 rounded font-extrabold ${
                            c.grade === "A"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : c.grade === "B"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          {c.grade}
                        </span>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">
                          {c.companyNameKr}
                        </span>
                      </div>
                      {c.brandNames.length > 0 && (
                        <div className="text-[11px] text-zinc-500 truncate max-w-[180px] pl-4">
                          {c.brandNames.join(", ")}
                        </div>
                      )}
                    </td>

                    {/* Campaign */}
                    <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400 font-medium truncate max-w-[160px]">
                      {c.campaignName}
                    </td>

                    {/* Emails Sent */}
                    <td className="py-3 px-3 text-center">
                      <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                        {c.emailsSentCount}
                      </span>
                    </td>

                    {/* Latest Email Result */}
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

                    {/* Reply */}
                    <td className="py-3 px-3">
                      {c.hasReply ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold">
                          ✓ Replied
                        </span>
                      ) : (
                        <span className="text-[10px] text-zinc-400">No reply</span>
                      )}
                    </td>

                    {/* Interest Status (Interactive Dropdown) */}
                    <td className="py-3 px-3">
                      <select
                        value={c.interestStatus}
                        onChange={(e) =>
                          handleQuickInterestChange(
                            c.companyId,
                            c.campaignId,
                            e.target.value as CompanyInterestStatus
                          )
                        }
                        className={`text-[11px] font-bold py-1 px-1.5 rounded border cursor-pointer ${
                          c.interestStatus === "INTERESTED"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                            : c.interestStatus === "NOT_INTERESTED"
                            ? "bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
                            : "bg-white text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800"
                        }`}
                      >
                        <option value="UNKNOWN">— Unknown</option>
                        <option value="INTERESTED">★ Interested</option>
                        <option value="NOT_INTERESTED">✕ Not Interested</option>
                      </select>
                    </td>

                    {/* Next Follow-up */}
                    <td className="py-3 px-3 text-[11px] whitespace-nowrap">
                      {c.nextFollowupDate ? (
                        <div className="flex flex-col gap-0.5">
                          <span
                            className={`font-mono font-bold ${
                              c.followupDueStatus === "OVERDUE"
                                ? "text-red-600"
                                : c.followupDueStatus === "DUE_TODAY"
                                ? "text-amber-600"
                                : "text-zinc-700 dark:text-zinc-300"
                            }`}
                          >
                            {c.nextFollowupDate}
                          </span>
                          <span
                            className={`text-[9px] px-1 py-0.2 rounded w-fit font-bold ${
                              c.followupDueStatus === "OVERDUE"
                                ? "bg-red-100 text-red-700"
                                : c.followupDueStatus === "DUE_TODAY"
                                ? "bg-amber-100 text-amber-700"
                                : c.followupDueStatus === "COMPLETED"
                                ? "bg-emerald-100 text-emerald-700"
                                : "text-zinc-400"
                            }`}
                          >
                            {c.followupDueStatus}
                          </span>
                        </div>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectCompany(c)}
                          className="px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded hover:bg-blue-100 cursor-pointer"
                        >
                          Details →
                        </button>
                        {onNavigateToBrandList && (
                          <button
                            type="button"
                            onClick={() => onNavigateToBrandList(c.companyId)}
                            className="px-2 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded cursor-pointer"
                            title="Open in Brand List"
                          >
                            Brand ↗
                          </button>
                        )}
                      </div>
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
