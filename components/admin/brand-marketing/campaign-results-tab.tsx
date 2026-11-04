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
  isLiveModeEnabled?: boolean;
}

interface CampaignResultsTabProps {
  campaigns: CampaignOption[];
  onSelectCompany: (company: CompanyResultItem) => void;
  onNavigateToBrandList?: (companyId: string) => void;
}

function formatRate(val: number | null | undefined): string {
  if (val === null || val === undefined) return "N/A";
  return `${(val * 100).toFixed(1)}%`;
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
              TAB A: Campaign Results
            </span>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>📊</span> Verified Email Delivery Analytics
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Select an email campaign to view verified Resend outreach volume, mailbox deliveries, bounces, and suppressions.
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

      {/* 2. SUMMARY METRICS GRID */}
      {metrics ? (
        <div className="space-y-4">
          {/* COMPLETED / SEND-LOCKED BANNER vs AWAITING DISPATCH BANNER */}
          {selectedCampaign?.status === "COMPLETED" || metrics.campaignStatus === "COMPLETED" || (metrics.emailsSent > 0 && metrics.emailsSent === metrics.delivered + (metrics.bounced || 0) + (metrics.suppressed || 0) + (metrics.failed || 0)) ? (
            <div className="p-3.5 border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-2xs bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200">
              <div className="flex items-center gap-2">
                <span className="text-base shrink-0">✅</span>
                <div>
                  <span className="font-bold tracking-tight">
                    CAMPAIGN COMPLETED — READ-ONLY RESULTS
                  </span>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
                    본 캠페인의 모든 승인 대상 발송이 완료되어 안전 잠금(Send Locked)되었습니다. 모든 발송 결과 및 전달 통계는 읽기 전용으로 안전하게 보존됩니다.
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold shrink-0 self-start sm:self-auto border bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700">
                DISPATCH COMPLETED ({metrics.emailsSent} RECIPIENTS)
              </span>
            </div>
          ) : metrics.emailsSent === 0 ? (
            <div className={`p-3.5 border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-2xs ${
              selectedCampaign?.isLiveModeEnabled
                ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200"
                : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200"
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-base shrink-0">{selectedCampaign?.isLiveModeEnabled ? "⚡" : "🛡️"}</span>
                <div>
                  <span className="font-bold tracking-tight">
                    {selectedCampaign?.isLiveModeEnabled
                      ? "LIVE MODE AUTHORIZED — AWAITING DISPATCH"
                      : "LIVE_MODE OFF — SIMULATION ONLY"}
                  </span>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
                    {selectedCampaign?.isLiveModeEnabled
                      ? "본 캠페인은 관리자 권한으로 LIVE 모드가 활성화되어 있습니다. 실제 발송(Send Now)을 실행하면 승인된 고객사 메일함으로 즉시 전송됩니다."
                      : "본 캠페인은 안전 시뮬레이션 상태입니다. 실제 외부 메일 발송이 발생하지 않았으며, 실제 발송(Emails Sent) 및 전달(Delivered)은 LIVE_MODE 활성화 및 승인 발송 시에만 측정됩니다."}
                  </p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold shrink-0 self-start sm:self-auto border ${
                selectedCampaign?.isLiveModeEnabled
                  ? "bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700"
                  : "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700"
              }`}>
                {selectedCampaign?.isLiveModeEnabled ? "LIVE READY (0 DISPATCHES)" : "0 ACTUAL DISPATCHES"}
              </span>
            </div>
          ) : null}

          {/* PRIMARY METRICS ROW (6 Cards) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Card 1: Companies Contacted */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight block truncate">
                Companies Contacted
              </span>
              <p className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 mt-1">
                {metrics.companiesContacted}
              </p>
              <span className="text-[10px] text-zinc-400">Distinct companies with sends</span>
            </div>

            {/* Card 2: Emails Sent */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight block truncate">
                Emails Sent
              </span>
              <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
                {metrics.emailsSent}
              </p>
              <span className="text-[10px] text-zinc-400">Accepted by provider</span>
            </div>

            {/* Card 3: Delivered */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight block truncate">
                Delivered
              </span>
              <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                {metrics.delivered > 0 ? (
                  metrics.delivered
                ) : metrics.emailsSent > 0 ? (
                  <span className="text-sm font-semibold text-zinc-400 dark:text-zinc-500">
                    Pending
                  </span>
                ) : (
                  0
                )}
              </p>
              <span className="text-[10px] text-zinc-400">Verified mailbox receipt</span>
            </div>

            {/* Card 4: Bounced */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight block truncate">
                Bounced
              </span>
              <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
                {metrics.bounced ?? 0}
              </p>
              <span className="text-[10px] text-zinc-400">MTA rejection / invalid</span>
            </div>

            {/* Card 5: Suppressed / Failed */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight block truncate">
                Suppressed / Failed
              </span>
              <p className="text-2xl font-extrabold text-red-600 dark:text-red-400 mt-1">
                {(metrics.suppressed || 0) + (metrics.failed || 0)}
              </p>
              <span className="text-[10px] text-zinc-400">
                {metrics.suppressed ? `${metrics.suppressed} supp. / ${metrics.failed || 0} fail` : "Preflight blocked"}
              </span>
            </div>

            {/* Card 6: Delivery Rate */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight block truncate">
                Delivery Rate
              </span>
              <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                {metrics.deliveryRate !== null ? formatRate(metrics.deliveryRate * 100) : "N/A"}
              </p>
              <span className="text-[10px] text-zinc-400">Delivered / Emails Sent</span>
            </div>
          </div>

          {/* SECONDARY METRICS ROW (Engagement & Hygiene) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <span className="text-[10px] text-zinc-500 font-semibold block uppercase tracking-tight">Opened</span>
              <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400 mt-0.5">
                {metrics.openedEstimated !== null ? metrics.openedEstimated : "N/A — Not Tracked"}
              </p>
              <span className="text-[10px] text-zinc-400">Tracking pixel unverified</span>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <span className="text-[10px] text-zinc-500 font-semibold block uppercase tracking-tight">Clicked</span>
              <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400 mt-0.5">
                {metrics.clicked !== null ? metrics.clicked : "N/A — Not Tracked"}
              </p>
              <span className="text-[10px] text-zinc-400">Link redirect unverified</span>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <span className="text-[10px] text-zinc-500 font-semibold block uppercase tracking-tight">Complained</span>
              <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mt-0.5">
                {metrics.complained !== null ? metrics.complained : "0 (No Complaints Recorded)"}
              </p>
              <span className="text-[10px] text-zinc-400">Spam reports</span>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <span className="text-[10px] text-zinc-500 font-semibold block uppercase tracking-tight">Unsubscribed</span>
              <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mt-0.5">
                {metrics.unsubscribed !== null ? metrics.unsubscribed : "0 (No Unsubscribes)"}
              </p>
              <span className="text-[10px] text-zinc-400">Commercial opt-outs</span>
            </div>
          </div>

          {/* 3. DELIVERY PERFORMANCE & TELEMETRY STANDARDS */}
          <div className="bg-zinc-50 dark:bg-zinc-950/40 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
            <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
              <span>📊</span> Delivery Telemetry & Outcome Breakdown
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <span className="text-[10px] text-zinc-500 font-semibold block">Delivery Rate</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {metrics.deliveryRate !== null ? formatRate(metrics.deliveryRate * 100) : "N/A"}
                </span>
                <p className="text-[10px] text-zinc-400 mt-0.5">Delivered / Emails Sent</p>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <span className="text-[10px] text-zinc-500 font-semibold block">Bounce Rate</span>
                <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                  {metrics.emailsSent > 0 ? formatRate(((metrics.bounced || 0) / metrics.emailsSent) * 100) : "0%"}
                </span>
                <p className="text-[10px] text-zinc-400 mt-0.5">Bounced / Emails Sent</p>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <span className="text-[10px] text-zinc-500 font-semibold block">Suppression Rate</span>
                <span className="text-sm font-bold text-red-600 dark:text-red-400">
                  {metrics.emailsSent > 0 ? formatRate((((metrics.suppressed || 0) + (metrics.failed || 0)) / metrics.emailsSent) * 100) : "0%"}
                </span>
                <p className="text-[10px] text-zinc-400 mt-0.5">Suppressed / Emails Sent</p>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <span className="text-[10px] text-zinc-500 font-semibold block">Provider Precision</span>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  100% Correlated
                </span>
                <p className="text-[10px] text-zinc-400 mt-0.5">Exact Resend Message IDs</p>
              </div>
            </div>

            {/* MANDATORY RELIABILITY POLICY DISCLOSURE */}
            <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 text-[11px] text-blue-950 dark:text-blue-200 leading-relaxed">
              <strong className="font-bold">🛡️ Email Delivery & Telemetry Standard:</strong>
              <ul className="list-disc pl-4 mt-1 space-y-0.5 text-zinc-600 dark:text-zinc-400">
                <li>
                  <strong className="text-zinc-800 dark:text-zinc-200">SENT ≠ DELIVERED:</strong> Messages are only counted as delivered upon verified SMTP gateway acceptance (Resend `email.delivered` webhook event).
                </li>
                <li>
                  <strong className="text-zinc-800 dark:text-zinc-200">Engagement Metrics:</strong> Open and Click telemetry are only recorded when verifiable provider tracking is enabled. Unverified tracking is disclosed transparently as N/A rather than zero.
                </li>
                <li>
                  <strong className="text-zinc-800 dark:text-zinc-200">Suppression Isolation:</strong> Bounces and preflight suppressions are permanently isolated to prevent re-sending to rejected mailboxes.
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
              Shows one row per company with verified email delivery outcomes and recipient breakdown.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
            {companyResults.length} Contacted Companies
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
                  <th className="py-2.5 px-3 text-center">Recipients</th>
                  <th className="py-2.5 px-3 text-center">Sent</th>
                  <th className="py-2.5 px-3 text-center">Delivered</th>
                  <th className="py-2.5 px-3 text-center">Bounced</th>
                  <th className="py-2.5 px-3 text-center">Suppressed</th>
                  <th className="py-2.5 px-3">Delivery Status</th>
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
                    <td className="py-3 px-3 text-center font-mono font-medium text-zinc-700 dark:text-zinc-300">
                      {c.recipientCount ?? c.recipients.length}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-blue-600 dark:text-blue-400">
                      {c.emailsSent ?? c.emailsSentCount}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {c.delivered ?? c.recipients.filter((r) => r.deliveryResult === "DELIVERED").length}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-amber-600 dark:text-amber-400">
                      {c.bounced ?? c.recipients.filter((r) => r.deliveryResult === "BOUNCED").length}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-red-600 dark:text-red-400">
                      {c.suppressed ?? c.recipients.filter((r) => r.deliveryResult === "FAILED").length}
                    </td>
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
      </div>
    </div>
  );
}
