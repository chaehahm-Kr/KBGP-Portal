"use client";

import React, { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { CampaignIssueRecipientItem } from "@/lib/brand-marketing/results-types";
import { addMarketingSuppressionAction } from "@/lib/brand-marketing/campaign-actions";

interface CampaignIssueRecipientsModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  campaignName: string;
  initialFilter?: "ALL" | "BOUNCED" | "SUPPRESSED_FAILED";
  recipients: CampaignIssueRecipientItem[];
  onRefreshRecipients?: () => Promise<void>;
}

export function CampaignIssueRecipientsModal({
  isOpen,
  onClose,
  campaignId,
  campaignName,
  initialFilter = "ALL",
  recipients: initialRecipients,
  onRefreshRecipients,
}: CampaignIssueRecipientsModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"ALL" | "BOUNCED" | "SUPPRESSED_FAILED">(initialFilter);
  const [searchQuery, setSearchQuery] = useState("");
  const [recipients, setRecipients] = useState<CampaignIssueRecipientItem[]>(initialRecipients);
  const [isPending, startTransition] = useTransition();

  // Single suppression confirmation modal
  const [confirmRecipient, setConfirmRecipient] = useState<CampaignIssueRecipientItem | null>(null);
  const [confirmReason, setConfirmReason] = useState<string>("BOUNCED");
  const [confirmNotes, setConfirmNotes] = useState<string>("");
  const [singleActionError, setSingleActionError] = useState<string | null>(null);

  // Bulk suppression confirmation modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ total: number; current: number; success: number } | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Keep internal recipients list synchronized when props change
  React.useEffect(() => {
    setRecipients(initialRecipients);
  }, [initialRecipients]);

  React.useEffect(() => {
    setActiveTab(initialFilter);
  }, [initialFilter]);

  // Filtered recipients based on tab and search query
  const filteredRecipients = useMemo(() => {
    return (recipients || []).filter((r) => {
      // Tab filter
      if (activeTab === "BOUNCED" && r.status !== "BOUNCED") return false;
      if (activeTab === "SUPPRESSED_FAILED" && r.status !== "FAILED") return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const emailMatch = r.recipientEmail.toLowerCase().includes(query);
        const compMatch = r.companyNameKr.toLowerCase().includes(query) || (r.companyNameEn || "").toLowerCase().includes(query);
        const brandMatch = (r.brandName || "").toLowerCase().includes(query);
        const idMatch = (r.providerMessageId || "").toLowerCase().includes(query);
        if (!emailMatch && !compMatch && !brandMatch && !idMatch) return false;
      }

      return true;
    });
  }, [recipients, activeTab, searchQuery]);

  const totalCount = (recipients || []).length;
  const bouncedCount = (recipients || []).filter((r) => r.status === "BOUNCED").length;
  const failedCount = (recipients || []).filter((r) => r.status === "FAILED").length;

  // 1. Tab-Specific Scoped Recipients (ADM-EMAIL-ANALYTICS-001-R2)
  // Ensures bulk actions operate strictly within the active tab's category.
  const tabScopedRecipients = useMemo(() => {
    const list = recipients || [];
    if (activeTab === "BOUNCED") {
      return list.filter((r) => r.status === "BOUNCED");
    }
    if (activeTab === "SUPPRESSED_FAILED") {
      return list.filter((r) => r.status === "FAILED");
    }
    return list;
  }, [recipients, activeTab]);

  // 2. Tab-Specific Metrics Breakdown
  const tabMetrics = useMemo(() => {
    const total = tabScopedRecipients.length;
    const alreadySuppressed = tabScopedRecipients.filter((r) => r.isSuppressed).length;
    const eligibleUnsuppressed = tabScopedRecipients.filter((r) => !r.isSuppressed && r.isEligibleForSuppression);
    const newCount = eligibleUnsuppressed.length;
    const ineligibleOrProtected = tabScopedRecipients.filter((r) => !r.isSuppressed && !r.isEligibleForSuppression).length;

    return {
      total,
      alreadySuppressed,
      eligibleUnsuppressed,
      newCount,
      ineligibleOrProtected,
    };
  }, [tabScopedRecipients]);

  // 3. Tab-Specific Labels & Metadata
  const tabBulkMeta = useMemo(() => {
    if (activeTab === "SUPPRESSED_FAILED") {
      return {
        label: `사전 차단 일괄 등록 (${tabMetrics.newCount})`,
        title: `프로바이더(Resend)에서 사전 차단된 미등록 대상자 ${tabMetrics.newCount}명을 일괄 수신 거부 등록합니다.`,
        modalTitle: "🛡️ 프로바이더 사전 차단 일괄 등록",
        categoryName: "사전 차단 / 발송 실패 (Preflight Suppressed / Failed)",
        reason: "BOUNCED" as const,
        source: "RESEND",
        defaultNotesPrefix: "Resend 사전 차단 수신자 일괄 등록 (Prior bounce or suppression)",
      };
    }
    if (activeTab === "BOUNCED") {
      return {
        label: `반송 일괄 등록 (${tabMetrics.newCount})`,
        title: `영구 반송(Hard Bounce)된 미등록 대상자 ${tabMetrics.newCount}명을 일괄 수신 거부 등록합니다.`,
        modalTitle: "🛡️ 영구 반송 일괄 등록",
        categoryName: "영구 반송 (Hard Bounce / Remote MTA Rejection)",
        reason: "BOUNCED" as const,
        source: "RESEND",
        defaultNotesPrefix: "Resend 영구 반송 수신자 일괄 등록 (Hard Bounce)",
      };
    }
    return {
      label: `일괄 수신 거부 등록 (${tabMetrics.newCount})`,
      title: `검증된 영구 반송 및 사전 차단 미등록 대상자 ${tabMetrics.newCount}명을 일괄 수신 거부 등록합니다.`,
      modalTitle: "🛡️ 전체 검증 대상 일괄 수신 거부 등록",
      categoryName: "전체 배송 이슈 (All Issues)",
      reason: "BOUNCED" as const,
      source: "RESEND",
      defaultNotesPrefix: "Resend 배송 이슈 일괄 등록 (Campaign verified failures)",
    };
  }, [activeTab, tabMetrics.newCount]);

  // Open single confirmation modal (preserves provider evidence, no MANUAL_ADMIN overwrite)
  const handleOpenSingleConfirm = (item: CampaignIssueRecipientItem) => {
    setConfirmRecipient(item);
    // Preserve provider evidence: bounce or preflight suppression from Resend
    setConfirmReason("BOUNCED");
    const notesText = item.status === "FAILED"
      ? `[RESEND Preflight Suppressed] MsgID: ${item.providerMessageId || "N/A"}, Error: ${item.errorMessage || "Prior bounce or suppression"}, Campaign: ${campaignName}`
      : `[RESEND Hard Bounce] MsgID: ${item.providerMessageId || "N/A"}, Error: ${item.errorMessage || "Remote MTA Rejection"}, Campaign: ${campaignName}`;
    setConfirmNotes(notesText);
    setSingleActionError(null);
  };

  // Execute single suppression
  const handleExecuteSingleSuppression = () => {
    if (!confirmRecipient) return;

    startTransition(async () => {
      try {
        const res = await addMarketingSuppressionAction({
          email: confirmRecipient.recipientEmail,
          reason: confirmReason,
          notes: `${confirmNotes}`,
          source: "RESEND",
        });

        if (res.success) {
          // Update local state immediately
          setRecipients((prev) =>
            prev.map((r) =>
              r.recipientEmail.toLowerCase() === confirmRecipient.recipientEmail.toLowerCase()
                ? { ...r, isSuppressed: true, suppressionReason: confirmReason }
                : r
            )
          );
          setConfirmRecipient(null);
          if (onRefreshRecipients) await onRefreshRecipients();
          try {
            router.refresh();
          } catch {}
        } else {
          setSingleActionError(res.error || "수신 거부 등록에 실패했습니다.");
        }
      } catch (err: any) {
        setSingleActionError(err.message || "오류가 발생했습니다.");
      }
    });
  };

  // Execute tab-specific bulk suppression of eligible unsuppressed recipients
  const handleExecuteBulkSuppression = async () => {
    const targets = tabMetrics.eligibleUnsuppressed;
    if (targets.length === 0) return;

    setBulkError(null);
    setBulkProgress({ total: targets.length, current: 0, success: 0 });

    let successCount = 0;
    const newlySuppressed = new Set<string>();

    for (let i = 0; i < targets.length; i++) {
      const item = targets[i];
      try {
        const isFailed = item.status === "FAILED";
        const reason = "BOUNCED";
        const notes = isFailed
          ? `[RESEND Preflight Suppressed] MsgID: ${item.providerMessageId || "N/A"}, Error: ${item.errorMessage || "Prior bounce or suppression"}, Campaign: ${campaignName}`
          : `[RESEND Hard Bounce] MsgID: ${item.providerMessageId || "N/A"}, Error: ${item.errorMessage || "Remote MTA Rejection"}, Campaign: ${campaignName}`;

        const res = await addMarketingSuppressionAction({
          email: item.recipientEmail,
          reason,
          notes,
          source: "RESEND",
        });

        if (res.success) {
          successCount++;
          newlySuppressed.add(item.recipientEmail.toLowerCase());
        }
      } catch (err) {
        console.warn(`[bulk-suppression] Error for ${item.recipientEmail}:`, err);
      }

      setBulkProgress({
        total: targets.length,
        current: i + 1,
        success: successCount,
      });
    }

    // Update local state
    setRecipients((prev) =>
      prev.map((r) =>
        newlySuppressed.has(r.recipientEmail.toLowerCase())
          ? { ...r, isSuppressed: true, suppressionReason: "BOUNCED" }
          : r
      )
    );

    setTimeout(() => {
      setShowBulkModal(false);
      setBulkProgress(null);
      if (onRefreshRecipients) onRefreshRecipients();
      try {
        router.refresh();
      } catch {}
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-6xl max-h-[90vh] bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden">
        {/* MODAL HEADER */}
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-start justify-between bg-zinc-50 dark:bg-zinc-950/60">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 border border-red-200 dark:border-red-800">
                Delivery Issues
              </span>
              <span className="text-xs text-zinc-400">•</span>
              <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                Campaign: {campaignName}
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>⚠️ 배송 이슈 수신자 목록 &amp; 안전 수신 거부 관리</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              반송(Bounced) 또는 프로바이더 사전 차단(Suppressed/Failed)된 수신자 내역을 조회하고, 영구 차단 대상자를 수신 거부 목록에 안전하게 등록합니다.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* CONTROLS BAR: TABS, SEARCH, TAB-SPECIFIC BULK ACTION */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("ALL")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === "ALL"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
              }`}
            >
              전체 ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("BOUNCED")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === "BOUNCED"
                  ? "bg-white dark:bg-zinc-900 text-amber-600 dark:text-amber-400 shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-amber-600"
              }`}
            >
              반송됨 ({bouncedCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("SUPPRESSED_FAILED")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === "SUPPRESSED_FAILED"
                  ? "bg-white dark:bg-zinc-900 text-red-600 dark:text-red-400 shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-red-600"
              }`}
            >
              사전 차단/실패 ({failedCount})
            </button>
          </div>

          {/* Search & Tab-Specific Bulk Action */}
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              placeholder="이메일, 기업명, 브랜드 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 w-52 sm:w-64"
            />

            <button
              type="button"
              onClick={() => setShowBulkModal(true)}
              disabled={tabMetrics.newCount === 0}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
                tabMetrics.newCount > 0
                  ? "bg-amber-600 hover:bg-amber-700 text-white border-amber-700 shadow-2xs"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700 cursor-not-allowed"
              }`}
              title={tabBulkMeta.title}
            >
              <span>🛡️</span> {tabBulkMeta.label}
            </button>
          </div>
        </div>

        {/* POLICY CALLOUT */}
        <div className="px-5 py-2.5 bg-amber-50/60 dark:bg-amber-950/20 border-b border-amber-200/50 dark:border-amber-900/30 text-[11px] text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span>💡</span>
            <span>
              <strong>안전 수신 거부 정책:</strong> 영구 반송(Hard Bounce) 및 원격 MTA 거부 수신자는 향후 발송 보호를 위해 수신 거부 등록이 권장됩니다.
              소프트 바운스(사서함 용량 초과 등)는 영구 차단되지 않도록 보호됩니다.
            </span>
          </div>
          <span className="font-mono text-[10px] shrink-0 font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300">
            미등록 대상: {tabMetrics.newCount}건 ({tabMetrics.total}건 중)
          </span>
        </div>

        {/* RECIPIENTS TABLE */}
        <div className="flex-1 overflow-y-auto">
          {filteredRecipients.length === 0 ? (
            <div className="p-12 text-center text-xs text-zinc-400">
              해당 조건의 반송 또는 발송 실패 수신자가 없습니다.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-bold text-zinc-600 dark:text-zinc-400 z-10">
                <tr>
                  <th className="py-2.5 px-4">수신자 이메일</th>
                  <th className="py-2.5 px-3">소속 기업 / 브랜드</th>
                  <th className="py-2.5 px-3 text-center">프로바이더 상태</th>
                  <th className="py-2.5 px-3">반송/실패 사유</th>
                  <th className="py-2.5 px-3">메시지 ID</th>
                  <th className="py-2.5 px-3 text-center">수신 거부 등록 여부</th>
                  <th className="py-2.5 px-4 text-right">조치</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredRecipients.map((item) => {
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-850/40 transition-colors"
                    >
                      {/* Email */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                          {item.recipientEmail}
                        </div>
                        {item.recipientName && (
                          <div className="text-[11px] text-zinc-500">{item.recipientName}</div>
                        )}
                      </td>

                      {/* Company & Brand */}
                      <td className="py-3 px-3">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">
                          {item.companyNameKr}
                        </div>
                        <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                          {item.companyNameEn && <span>{item.companyNameEn}</span>}
                          {item.brandName && (
                            <span className="px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                              {item.brandName}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Provider Status */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            item.status === "BOUNCED"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                              : "bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 border border-red-200 dark:border-red-800"
                          }`}
                        >
                          {item.status === "BOUNCED" ? "BOUNCED" : "FAILED / SUPPRESSED"}
                        </span>
                      </td>

                      {/* Error Message */}
                      <td className="py-3 px-3 max-w-xs">
                        <div
                          className="text-[11px] text-zinc-600 dark:text-zinc-300 truncate"
                          title={item.errorMessage || "사유 미기재"}
                        >
                          {item.errorMessage || "—"}
                        </div>
                        {item.isEligibleForSuppression ? (
                          <span className="inline-block mt-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400">
                            🛡️ 영구 차단 권장 (Permanent failure)
                          </span>
                        ) : (
                          <span className="inline-block mt-0.5 text-[9px] text-zinc-400">
                            소프트 바운스 / 임시 오류
                          </span>
                        )}
                      </td>

                      {/* Provider Message ID */}
                      <td className="py-3 px-3 font-mono text-[10px] text-zinc-500">
                        {item.providerMessageId ? (
                          <span title={item.providerMessageId}>
                            {item.providerMessageId.slice(0, 16)}...
                          </span>
                        ) : (
                          <span className="text-zinc-400 italic">미기재</span>
                        )}
                      </td>

                      {/* Current Suppression Status */}
                      <td className="py-3 px-3 text-center">
                        {item.isSuppressed ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                            title={`등록 사유: ${item.suppressionReason || "UNKNOWN"}`}
                          >
                            🛡️ 등록됨 ({item.suppressionReason || "ACTIVE"})
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-400">미등록</span>
                        )}
                      </td>

                      {/* Action Button */}
                      <td className="py-3 px-4 text-right">
                        {item.isSuppressed ? (
                          <span className="text-[11px] text-zinc-400 italic">차단 유지 중</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenSingleConfirm(item)}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors cursor-pointer"
                          >
                            + 수신 거부 등록
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950/60 text-xs">
          <div className="text-zinc-500">
            표시 중: <strong>{filteredRecipients.length}건</strong> (전체 {totalCount}건)
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>

      {/* SINGLE SUPPRESSION CONFIRMATION MODAL */}
      {confirmRecipient && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <span>🛡️</span> 수신 거부 등록 확인
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  이 수신자를 글로벌 수신 거부 목록에 등록하여 향후 캠페인 발송 시 자동으로 제외합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmRecipient(null)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                ✕
              </button>
            </div>

            {singleActionError && (
              <div className="p-3 text-xs bg-red-50 text-red-800 border border-red-200 rounded-lg">
                {singleActionError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                  수신자 이메일:
                </label>
                <input
                  type="text"
                  value={confirmRecipient.recipientEmail}
                  readOnly
                  className="w-full px-3 py-1.5 font-mono bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                    기업명:
                  </label>
                  <input
                    type="text"
                    value={confirmRecipient.companyNameKr}
                    readOnly
                    className="w-full px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200"
                  />
                </div>
                <div>
                  <label className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                    등록 사유 (Reason):
                  </label>
                  <select
                    value={confirmReason}
                    onChange={(e) => setConfirmReason(e.target.value)}
                    className="w-full px-3 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                  >
                    <option value="BOUNCED">BOUNCED (메일함 반송 / 프로바이더 차단)</option>
                    <option value="UNSUBSCRIBED">UNSUBSCRIBED (수신 거부 요청)</option>
                    <option value="COMPLAINT">COMPLAINT (스팸 신고)</option>
                    <option value="MANUAL_ADMIN">MANUAL_ADMIN (관리자 직접 등록)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                  사유 상세 / 감사 메모:
                </label>
                <textarea
                  rows={2}
                  value={confirmNotes}
                  onChange={(e) => setConfirmNotes(e.target.value)}
                  className="w-full px-3 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                  placeholder="반송 원인 또는 수신 거부 상세 메모를 입력하세요."
                />
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1">
                <div>• 캠페인: <strong>{campaignName}</strong></div>
                <div>• 발송 프로바이더: <strong>Resend</strong></div>
                {confirmRecipient.providerMessageId && (
                  <div>• 프로바이더 메시지 ID: <strong className="font-mono">{confirmRecipient.providerMessageId}</strong></div>
                )}
                <div>• 출처(Source): <strong>RESEND</strong></div>
                <div>• 감사 로그 기록: <strong>marketing_suppression_audit_log</strong>에 자동 기록됩니다.</div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmRecipient(null)}
                disabled={isPending}
                className="px-3 py-1.5 text-xs font-semibold rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleExecuteSingleSuppression}
                disabled={isPending}
                className="px-4 py-1.5 text-xs font-bold rounded bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
              >
                {isPending ? "등록 중..." : "수신 거부 등록 확인"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK SUPPRESSION CONFIRMATION MODAL (ADM-EMAIL-ANALYTICS-001-R2) */}
      {showBulkModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-5 space-y-4">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>🛡️</span> {tabBulkMeta.modalTitle}
            </h3>

            {bulkError && (
              <div className="p-3 text-xs bg-red-50 text-red-800 border border-red-200 rounded-lg">
                {bulkError}
              </div>
            )}

            <div className="space-y-3 text-xs text-zinc-600 dark:text-zinc-400">
              <p>
                선택된 <strong>{tabBulkMeta.categoryName}</strong> 카테고리 내에서 확인된 프로바이더 검증 대상자 중 미등록된{" "}
                <strong className="text-amber-600 dark:text-amber-400 font-bold">{tabMetrics.newCount}명</strong>
                을 수신 거부 목록에 일괄 등록합니다.
              </p>

              {/* 4-Stat Breakdown Grid (ADM-EMAIL-ANALYTICS-001-R2) */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <div className="text-[11px] text-zinc-500">카테고리 전체 (Total)</div>
                  <div className="text-base font-extrabold text-zinc-900 dark:text-zinc-100">{tabMetrics.total}건</div>
                </div>
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="text-[11px] text-amber-700 dark:text-amber-300 font-bold">신규 등록 예정 (New)</div>
                  <div className="text-base font-extrabold text-amber-600 dark:text-amber-400">{tabMetrics.newCount}건</div>
                </div>
                <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <div className="text-[11px] text-zinc-500">이미 등록됨 (Already Suppressed)</div>
                  <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">{tabMetrics.alreadySuppressed}건</div>
                </div>
                <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <div className="text-[11px] text-zinc-500">보호/제외 대상 (Skipped / Ineligible)</div>
                  <div className="text-base font-extrabold text-zinc-500">{tabMetrics.ineligibleOrProtected}건</div>
                </div>
              </div>

              {/* Scope & Provider Evidence Guarantee */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg space-y-1 text-[11px]">
                <div>• 등록 대상: <strong>{tabBulkMeta.categoryName} (타 탭 수신자 제외 보장)</strong></div>
                <div>• 출처(Source): <strong>RESEND (Campaign: {campaignName})</strong></div>
                <div>• 사유 보존: <strong>프로바이더 원인(Bounce/Preflight) 보존 (MANUAL_ADMIN 덮어쓰기 금지)</strong></div>
                <div>• 감사 기록: <strong>marketing_suppression_audit_log</strong>에 자동 기록</div>
              </div>

              {bulkProgress && (
                <div className="space-y-1 pt-2">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span>진행률:</span>
                    <span>
                      {bulkProgress.current} / {bulkProgress.total} ({bulkProgress.success} 성공)
                    </span>
                  </div>
                  <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-600 h-full transition-all duration-200"
                      style={{
                        width: `${(bulkProgress.current / bulkProgress.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                disabled={Boolean(bulkProgress)}
                className="px-3 py-1.5 text-xs font-semibold rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleExecuteBulkSuppression}
                disabled={Boolean(bulkProgress) || tabMetrics.newCount === 0}
                className="px-4 py-1.5 text-xs font-bold rounded bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
              >
                {bulkProgress ? "일괄 등록 처리 중..." : `${tabBulkMeta.label} 실행`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
