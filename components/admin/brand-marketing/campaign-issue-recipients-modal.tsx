"use client";

import React, { useState, useTransition, useMemo } from "react";
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

  // Filtered recipients based on tab and search
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

  const bouncedCount = (recipients || []).filter((r) => r.status === "BOUNCED").length;
  const failedCount = (recipients || []).filter((r) => r.status === "FAILED").length;

  // Eligible for permanent suppression: verified hard bounces or provider suppressions that are not yet suppressed
  const eligibleUnsuppressed = useMemo(() => {
    return (recipients || []).filter((r) => !r.isSuppressed && r.isEligibleForSuppression);
  }, [recipients]);

  // Open single confirmation modal
  const handleOpenSingleConfirm = (item: CampaignIssueRecipientItem) => {
    setConfirmRecipient(item);
    setConfirmReason(item.status === "BOUNCED" ? "BOUNCED" : "MANUAL_ADMIN");
    setConfirmNotes(item.errorMessage || `Registered from campaign: ${campaignName}`);
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
          notes: `${confirmNotes} (Campaign: ${campaignName})`,
          source: `Campaign: ${campaignName}`,
        });

        if (res.success) {
          // Update local state
          setRecipients((prev) =>
            prev.map((r) =>
              r.recipientEmail.toLowerCase() === confirmRecipient.recipientEmail.toLowerCase()
                ? { ...r, isSuppressed: true, suppressionReason: confirmReason }
                : r
            )
          );
          setConfirmRecipient(null);
          if (onRefreshRecipients) await onRefreshRecipients();
        } else {
          setSingleActionError(res.error || "수신 거부 등록에 실패했습니다.");
        }
      } catch (err: any) {
        setSingleActionError(err.message || "오류가 발생했습니다.");
      }
    });
  };

  // Execute bulk suppression of eligible unsuppressed recipients
  const handleExecuteBulkSuppression = async () => {
    if (eligibleUnsuppressed.length === 0) return;

    setBulkError(null);
    setBulkProgress({ total: eligibleUnsuppressed.length, current: 0, success: 0 });

    let successCount = 0;
    const newlySuppressed = new Set<string>();

    for (let i = 0; i < eligibleUnsuppressed.length; i++) {
      const item = eligibleUnsuppressed[i];
      try {
        const res = await addMarketingSuppressionAction({
          email: item.recipientEmail,
          reason: item.status === "BOUNCED" ? "BOUNCED" : "MANUAL_ADMIN",
          notes: `일괄 등록: ${item.errorMessage || "Verified permanent delivery failure"} (Campaign: ${campaignName})`,
          source: `Bulk Campaign Action: ${campaignName}`,
        });

        if (res.success) {
          successCount++;
          newlySuppressed.add(item.recipientEmail.toLowerCase());
        }
      } catch (err) {
        console.warn(`[bulk-suppression] Error for ${item.recipientEmail}:`, err);
      }

      setBulkProgress({
        total: eligibleUnsuppressed.length,
        current: i + 1,
        success: successCount,
      });
    }

    // Update local state
    setRecipients((prev) =>
      prev.map((r) =>
        newlySuppressed.has(r.recipientEmail.toLowerCase())
          ? { ...r, isSuppressed: true, suppressionReason: r.status === "BOUNCED" ? "BOUNCED" : "MANUAL_ADMIN" }
          : r
      )
    );

    setTimeout(() => {
      setShowBulkModal(false);
      setBulkProgress(null);
      if (onRefreshRecipients) onRefreshRecipients();
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
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>⚠️</span> 반송 및 발송 실패 대상자 관리 (Delivery Issues & Suppression)
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              발송 중 반송(Bounce)되거나 사전 차단(Suppressed/Failed)된 수신자 목록을 조회하고, 영구 반송 대상자를 수신 거부 목록에 등록합니다.
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

        {/* CONTROLS BAR: TABS, SEARCH, BULK ACTION */}
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
              전체 ({recipients.length})
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

          {/* Search & Bulk Action */}
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
              disabled={eligibleUnsuppressed.length === 0}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
                eligibleUnsuppressed.length > 0
                  ? "bg-amber-600 hover:bg-amber-700 text-white border-amber-700 shadow-2xs"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700 cursor-not-allowed"
              }`}
              title="검증된 영구 반송 대상자만 일괄 수신 거부 목록에 등록합니다."
            >
              <span>🛡️</span> 검증 대상 일괄 등록 ({eligibleUnsuppressed.length}건)
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
            미등록 대상: {eligibleUnsuppressed.length}건
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
                  <th className="py-2.5 px-3 text-center">수신 거부 상태</th>
                  <th className="py-2.5 px-4 text-right">조치 (Action)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredRecipients.map((r) => {
                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-zinc-50/70 dark:hover:bg-zinc-900/60 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                          {r.recipientEmail}
                        </div>
                        {r.recipientName && (
                          <div className="text-[11px] text-zinc-400">
                            {r.recipientName}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {r.companyNameKr}
                        </div>
                        {r.brandName && (
                          <div className="text-[11px] text-zinc-500 truncate max-w-[160px]">
                            {r.brandName}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
                            r.status === "BOUNCED"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                              : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-200 dark:border-red-800"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className="text-[11px] text-zinc-700 dark:text-zinc-300 line-clamp-2 max-w-xs"
                          title={r.errorMessage || undefined}
                        >
                          {r.errorMessage || "—"}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[10px] text-zinc-500">
                        {r.providerMessageId ? (
                          <span title={r.providerMessageId}>
                            {r.providerMessageId.slice(0, 12)}...
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {r.isSuppressed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                            🛡️ 등록됨 ({r.suppressionReason || "ACTIVE"})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                            미등록
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {r.isSuppressed ? (
                          <span className="text-[11px] font-semibold text-zinc-400">
                            수신 차단 활성
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenSingleConfirm(r)}
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

        {/* FOOTER */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs bg-zinc-50 dark:bg-zinc-950/40">
          <span className="text-zinc-500">
            총 <strong>{filteredRecipients.length}</strong>명 표시 중 (반송 {bouncedCount}명, 사전 차단 {failedCount}명)
          </span>
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
                    <option value="BOUNCED">BOUNCED (메일함 반송)</option>
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

      {/* BULK SUPPRESSION CONFIRMATION MODAL */}
      {showBulkModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-5 space-y-4">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>🛡️</span> 검증 대상 일괄 수신 거부 등록
            </h3>

            {bulkError && (
              <div className="p-3 text-xs bg-red-50 text-red-800 border border-red-200 rounded-lg">
                {bulkError}
              </div>
            )}

            <div className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
              <p>
                현재 캠페인에서 확인된 영구 반송(Hard Bounce) 및 프로바이더 사전 차단 대상자 중 미등록된{" "}
                <strong className="text-amber-600 dark:text-amber-400 font-bold">{eligibleUnsuppressed.length}명</strong>
                을 수신 거부 목록에 일괄 등록합니다.
              </p>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg space-y-1 text-[11px]">
                <div>• 등록 대상 건수: <strong>{eligibleUnsuppressed.length}건</strong></div>
                <div>• 소프트 바운스/미확인 오류: <strong>자동 제외 (보호됨)</strong></div>
                <div>• 등록 출처: <strong>Campaign: {campaignName}</strong></div>
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
                disabled={Boolean(bulkProgress) || eligibleUnsuppressed.length === 0}
                className="px-4 py-1.5 text-xs font-bold rounded bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
              >
                {bulkProgress ? "일괄 등록 처리 중..." : "일괄 등록 실행"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
