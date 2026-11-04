"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  CompanyResultItem,
  DeliveryResultStatus,
} from "@/lib/brand-marketing/results-types";
import { listCompanyResultsAction } from "@/lib/brand-marketing/results-actions";

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
  // Filter States
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [emailResultFilter, setEmailResultFilter] = useState<DeliveryResultStatus | "ALL">("ALL");

  const [companyResults, setCompanyResults] = useState<CompanyResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Load results from server action
  const loadData = () => {
    setIsLoading(true);
    setErrorMsg(null);

    listCompanyResultsAction({
      campaignId: selectedCampaignId,
      searchQuery: searchQuery.trim() || undefined,
      emailResult: emailResultFilter,
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
    setCurrentPage(1);
    loadData();
  }, [selectedCampaignId, emailResultFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadData();
  };

  // Paginated slice
  const paginatedCompanies = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return companyResults.slice(start, start + pageSize);
  }, [companyResults, currentPage, pageSize]);

  const totalPages = Math.ceil(companyResults.length / pageSize) || 1;

  return (
    <div className="space-y-5">
      {/* 1. FILTER & SEARCH BAR */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              TAB B: Company Results (Email Delivery Analytics)
            </span>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <span>🏢</span> Company Outreach Directory
            </h2>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
            {companyResults.length} Contacted Companies
          </span>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="sm:col-span-2 flex gap-1.5">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search company, brand, recipient email..."
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
              <option value="ALL">All Delivery Statuses</option>
              <option value="DELIVERED">Delivered</option>
              <option value="BOUNCED">Bounced</option>
              <option value="FAILED">Suppressed / Failed</option>
              <option value="SENT">Sent (In Flight)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. RESULTS TABLE */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
        {errorMsg && (
          <div className="p-3 bg-red-50 dark:bg-red-950/60 border-b border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-200">
            ⚠️ {errorMsg}
          </div>
        )}

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
                  <th className="py-2.5 px-3 text-center">Recipient Count</th>
                  <th className="py-2.5 px-3 text-center">Emails Sent</th>
                  <th className="py-2.5 px-3 text-center">Delivered</th>
                  <th className="py-2.5 px-3 text-center">Bounced</th>
                  <th className="py-2.5 px-3 text-center">Suppressed / Failed</th>
                  <th className="py-2.5 px-3">Overall Email Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {paginatedCompanies.map((c) => (
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
                        <div className="text-[11px] text-zinc-500 truncate max-w-[220px] pl-4">
                          {c.brandNames.join(", ")}
                        </div>
                      )}
                    </td>

                    {/* Recipient Count */}
                    <td className="py-3 px-3 text-center font-mono font-medium text-zinc-700 dark:text-zinc-300">
                      {c.recipientCount ?? c.recipients.length}
                    </td>

                    {/* Emails Sent */}
                    <td className="py-3 px-3 text-center">
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {c.emailsSent ?? c.emailsSentCount}
                      </span>
                    </td>

                    {/* Delivered */}
                    <td className="py-3 px-3 text-center">
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {c.delivered ?? c.recipients.filter((r) => r.deliveryResult === "DELIVERED").length}
                      </span>
                    </td>

                    {/* Bounced */}
                    <td className="py-3 px-3 text-center">
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                        {c.bounced ?? c.recipients.filter((r) => r.deliveryResult === "BOUNCED").length}
                      </span>
                    </td>

                    {/* Suppressed / Failed */}
                    <td className="py-3 px-3 text-center">
                      <span className="font-mono font-bold text-red-600 dark:text-red-400">
                        {c.suppressed ?? c.recipients.filter((r) => r.deliveryResult === "FAILED").length}
                      </span>
                    </td>

                    {/* Overall Email Status */}
                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          (c.overallEmailStatus || c.latestEmailResult) === "DELIVERED"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : (c.overallEmailStatus || c.latestEmailResult) === "BOUNCED"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : (c.overallEmailStatus || c.latestEmailResult) === "SUPPRESSED"
                            ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                            : (c.overallEmailStatus || c.latestEmailResult) === "MIXED"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                            : (c.overallEmailStatus || c.latestEmailResult) === "SENT"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {c.overallEmailStatus || c.latestEmailResult}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectCompany(c)}
                        className="px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded hover:bg-blue-100 cursor-pointer"
                      >
                        View Email Details →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
            <span>
              Showing {(currentPage - 1) * pageSize + 1}–
              {Math.min(currentPage * pageSize, companyResults.length)} of {companyResults.length}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <span className="px-2 py-1 font-semibold text-zinc-700 dark:text-zinc-300">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
