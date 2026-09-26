"use client";

import React, { useState, useEffect } from "react";
import {
  adminListCompanyAgreementsAction,
  getSignedExecutedPdfUrlAction,
  adminSendSigningReminderAction,
  getAgreementAuditLogsAction,
  getAgreementRecipientsAction,
  resendAgreementRecipientEmailAction,
} from "@/lib/agreement/actions";
import { buildAgreementChangeInquiryUrl } from "@/lib/inquiry/types";
import {
  type CompanyAgreementItem,
  type AgreementAuditLogItem,
  type AgreementRecipientItem,
  AGREEMENT_STATUS_LABELS,
  AGREEMENT_STATUS_STYLES,
} from "@/lib/agreement/types";

interface CompanyAgreementsTabProps {
  companyId: string;
  companyName: string;
}

export function CompanyAgreementsTab({ companyId, companyName }: CompanyAgreementsTabProps) {
  const [agreements, setAgreements] = useState<CompanyAgreementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedAuditLogCa, setSelectedAuditLogCa] = useState<CompanyAgreementItem | null>(null);
  const [auditLogs, setAuditLogs] = useState<AgreementAuditLogItem[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const [selectedRecipientCa, setSelectedRecipientCa] = useState<CompanyAgreementItem | null>(null);
  const [recipients, setRecipients] = useState<AgreementRecipientItem[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [loadingPdfId, setLoadingPdfId] = useState<string | null>(null);

  const [reminderStatus, setReminderStatus] = useState<{ id: string; msg: string } | null>(null);

  const loadAgreements = async () => {
    setLoading(true);
    setError(null);
    const res = await adminListCompanyAgreementsAction(companyId);
    if (res.error) {
      setError(res.error);
    } else {
      setAgreements(res.agreements);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAgreements();
  }, [companyId]);

  const handleOpenPdf = async (ca: CompanyAgreementItem) => {
    setLoadingPdfId(ca.id);
    const path = ca.final_pdf_path || `agreements/${ca.company_id}/${ca.agreement_id}.pdf`;
    const res = await getSignedExecutedPdfUrlAction(path);
    setLoadingPdfId(null);
    if (res.url) {
      setPreviewPdfUrl(res.url);
    } else {
      alert(res.error || "PDF URL을 생성할 수 없습니다.");
    }
  };

  const handleSendReminder = async (ca: CompanyAgreementItem) => {
    const ok = confirm(`회사 [${companyName}]에 기본계약서 서명 안내를 재발송하시겠습니까?`);
    if (!ok) return;

    setReminderStatus({ id: ca.id, msg: "발송 중..." });
    const res = await adminSendSigningReminderAction(ca.id);
    if (res.success) {
      setReminderStatus({ id: ca.id, msg: "✅ 서명 안내 리마인더가 발송 및 기록되었습니다." });
    } else {
      setReminderStatus({ id: ca.id, msg: `❌ 발송 실패: ${res.error}` });
    }
  };

  const handleViewAuditTrail = async (ca: CompanyAgreementItem) => {
    setSelectedAuditLogCa(ca);
    setLoadingAudit(true);
    const res = await getAgreementAuditLogsAction(ca.id);
    setAuditLogs(res.logs || []);
    setLoadingAudit(false);
  };

  const handleViewRecipients = async (ca: CompanyAgreementItem) => {
    setSelectedRecipientCa(ca);
    setLoadingRecipients(true);
    const res = await getAgreementRecipientsAction(ca.id);
    setRecipients(res.recipients || []);
    setLoadingRecipients(false);
  };

  const handleResendRecipientEmail = async (recipientId: string) => {
    setResendingId(recipientId);
    try {
      const res = await resendAgreementRecipientEmailAction(recipientId);
      if (res.success) {
        alert("계약서 사본 메일이 성공적으로 재발송되었습니다.");
        if (selectedRecipientCa) handleViewRecipients(selectedRecipientCa);
      } else {
        alert(`재발송 실패: ${res.error || "오류 발생"}`);
      }
    } catch (e: any) {
      alert(`재발송 오류: ${e.message}`);
    } finally {
      setResendingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-zinc-500 font-semibold animate-pulse">
        계약서 데이터를 불러오는 중입니다...
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h3 className="text-base font-extrabold text-zinc-900 dark:text-white">
            회사 계약 관리 (Company Agreements)
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            회사 [{companyName}]의 기본계약서 및 서명 이력을 관리합니다.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 p-4 text-xs font-bold text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
          ⚠️ {error}
        </div>
      )}

      {agreements.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
          등록된 계약서가 없습니다. 브랜드 포털 최초 진입 시 기본계약서 v1.0이 자동으로 할당됩니다.
        </div>
      ) : (
        <div className="space-y-4">
          {agreements.map((ca) => {
            const statusLabel = AGREEMENT_STATUS_LABELS[ca.status] || { ko: ca.status, en: ca.status };
            const statusStyle = AGREEMENT_STATUS_STYLES[ca.status] || "bg-zinc-100 text-zinc-700 border-zinc-200";

            const changeCaseUrl = buildAgreementChangeInquiryUrl({
              company_name: companyName,
              agreement_id: ca.agreement_id,
              agreement_version: ca.version || "1.0",
              agreement_status: ca.status,
            });

            return (
              <div
                key={ca.id}
                className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-150 dark:border-zinc-800">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-bold border ${statusStyle}`}>
                        {statusLabel.ko}
                      </span>
                      <span className="text-xs font-mono font-bold text-indigo-650 dark:text-indigo-400">
                        [{ca.agreement_id}]
                      </span>
                      <span className="text-xs font-mono text-zinc-400">
                        Version {ca.version || "1.0"}
                      </span>
                    </div>
                    <h4 className="text-sm font-extrabold text-zinc-900 dark:text-white mt-1">
                      브랜드 공급·미국 유통 및 플랫폼 이용 기본계약서 (비독점)
                    </h4>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {ca.final_pdf_path && (
                      <button
                        type="button"
                        onClick={() => handleOpenPdf(ca)}
                        disabled={loadingPdfId === ca.id}
                        className="rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 px-3.5 py-2 text-xs font-bold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {loadingPdfId === ca.id ? "로딩..." : "📄 최종 PDF 보기"}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleViewRecipients(ca)}
                      className="rounded-xl border border-indigo-200 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300 px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer"
                    >
                      📫 수신자/배포 이력 (Recipients)
                    </button>

                    <button
                      type="button"
                      onClick={() => handleViewAuditTrail(ca)}
                      className="rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 px-3.5 py-2 text-xs font-bold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
                    >
                      📋 감사 이력 (Audit)
                    </button>

                    {ca.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => handleSendReminder(ca)}
                        className="rounded-xl bg-amber-600 hover:bg-amber-700 px-3.5 py-2 text-xs font-bold text-white transition-colors cursor-pointer shadow-xs"
                      >
                        🔔 서명 안내 리마인더
                      </button>
                    )}

                    <a
                      href={changeCaseUrl}
                      className="rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer"
                    >
                      💬 계약 변경 요청 케이스
                    </a>
                  </div>
                </div>

                {reminderStatus && reminderStatus.id === ca.id && (
                  <div className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                    {reminderStatus.msg}
                  </div>
                )}

                {/* Metadata Table */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-150 dark:border-zinc-800">
                    <span className="text-zinc-400 font-medium block text-[11px]">서명자 (Brand Signer)</span>
                    <strong className="text-zinc-900 dark:text-zinc-100 font-bold block">
                      {ca.signer_name ? `${ca.signer_name} (${ca.signer_title || "-"})` : "미서명"}
                    </strong>
                    {ca.signer_email && (
                      <span className="text-[11px] font-mono text-zinc-400 block mt-0.5">
                        {ca.signer_email}
                      </span>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-150 dark:border-zinc-800">
                    <span className="text-zinc-400 font-medium block text-[11px]">계약 발효일 (Effective Date)</span>
                    <strong className="text-zinc-900 dark:text-zinc-100 font-mono font-bold block">
                      {ca.effective_date || ca.signed_at?.split("T")[0] || "-"}
                    </strong>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-150 dark:border-zinc-800">
                    <span className="text-zinc-400 font-medium block text-[11px]">최초 만료일 (Expiration)</span>
                    <strong className="text-zinc-900 dark:text-zinc-100 font-mono font-bold block">
                      {ca.expiration_date || "-"}
                    </strong>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-150 dark:border-zinc-800">
                    <span className="text-zinc-400 font-medium block text-[11px]">갱신 거절 통지 기한</span>
                    <strong className="text-amber-700 dark:text-amber-400 font-mono font-bold block">
                      {ca.non_renewal_notice_deadline ? `${ca.non_renewal_notice_deadline} 까지` : "-"}
                    </strong>
                  </div>
                </div>

                {ca.final_pdf_hash && (
                  <div className="text-[10px] font-mono text-zinc-400 pt-1">
                    PDF SHA-256 Checksum: <span className="select-all font-semibold text-zinc-600 dark:text-zinc-300">{ca.final_pdf_hash}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* PDF Preview Modal */}
      {previewPdfUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-4xl h-[90vh] rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-150 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                최종 날인된 계약서 PDF (Admin Executed Preview)
              </h3>
              <div className="flex items-center gap-2">
                <a
                  href={previewPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300"
                >
                  새 창 열기 ↗
                </a>
                <button
                  onClick={() => setPreviewPdfUrl(null)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 mt-3 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-zinc-100 dark:bg-zinc-950">
              <iframe src={`${previewPdfUrl}#toolbar=1`} className="w-full h-full border-none" title="Admin Executed PDF Preview" />
            </div>
          </div>
        </div>
      )}

      {/* Recipient Distribution History Modal (Requirement 5) */}
      {selectedRecipientCa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-150 dark:border-zinc-800">
              <div>
                <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  RECIPIENT & DISTRIBUTION HISTORY
                </span>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  계약서 수신 및 배포 이력 (ID: {selectedRecipientCa.agreement_id})
                </h3>
              </div>
              <button
                onClick={() => setSelectedRecipientCa(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mt-4 space-y-3">
              {loadingRecipients ? (
                <div className="text-xs text-zinc-400 text-center py-6 animate-pulse">수신 이력을 불러오는 중...</div>
              ) : recipients.length === 0 ? (
                <div className="text-xs text-zinc-400 text-center py-6">등록된 수신자 기록이 없습니다.</div>
              ) : (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-950">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-50 dark:bg-zinc-900 text-zinc-500 font-medium border-b border-zinc-200 dark:border-zinc-800 text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">수신자 성명</th>
                        <th className="py-2.5 px-3">직책</th>
                        <th className="py-2.5 px-3">이메일</th>
                        <th className="py-2.5 px-3">구분</th>
                        <th className="py-2.5 px-3">발송 일시</th>
                        <th className="py-2.5 px-3">상태</th>
                        <th className="py-2.5 px-3 text-right">작업</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800">
                      {recipients.map((r) => (
                        <tr key={r.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40">
                          <td className="py-2.5 px-3 font-bold text-zinc-900 dark:text-zinc-100">
                            {r.recipient_name}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-400">
                            {r.recipient_title}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-zinc-700 dark:text-zinc-300 text-[11px]">
                            {r.recipient_email}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                r.recipient_type === "signer"
                                  ? "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
                                  : "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                              }`}
                            >
                              {r.recipient_type === "signer" ? "서명자 (Signer)" : "추가 수신자"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-zinc-500 text-[11px]">
                            {r.sent_at ? r.sent_at.replace("T", " ").substring(0, 16) : "-"}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                r.delivery_status === "sent"
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                              }`}
                            >
                              {r.delivery_status === "sent" ? "✓ 전송 완료" : "⚠️ 전송 실패"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleResendRecipientEmail(r.id)}
                              disabled={resendingId === r.id}
                              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 cursor-pointer disabled:opacity-50"
                            >
                              {resendingId === r.id ? "발송 중..." : "재발송"}
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
        </div>
      )}

      {/* Audit Log Modal */}
      {selectedAuditLogCa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-150 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                계약 감사 이력 (Audit Trail: {selectedAuditLogCa.agreement_id})
              </h3>
              <button
                onClick={() => setSelectedAuditLogCa(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mt-4 space-y-3">
              {loadingAudit ? (
                <div className="text-xs text-zinc-400 text-center py-6 animate-pulse">감사 이력을 불러오는 중...</div>
              ) : auditLogs.length === 0 ? (
                <div className="text-xs text-zinc-400 text-center py-6">감사 이력이 없습니다.</div>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl border border-zinc-150 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-850 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-650 dark:text-indigo-400 font-mono">
                        {log.action}
                      </span>
                      <span className="text-[11px] font-mono text-zinc-400">
                        {new Date(log.created_at).toLocaleString("ko-KR")}
                      </span>
                    </div>
                    <p className="text-zinc-700 dark:text-zinc-300">
                      수행자: <strong>{log.performed_by_name || log.performed_by_email || "System"}</strong> ({log.performed_by_email || "-"})
                    </p>
                    {log.details && (
                      <pre className="mt-1 p-2 rounded-lg bg-white dark:bg-zinc-900 text-[10px] font-mono text-zinc-600 dark:text-zinc-400 overflow-x-auto border border-zinc-200 dark:border-zinc-800">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
