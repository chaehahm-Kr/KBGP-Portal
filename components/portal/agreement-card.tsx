"use client";

import React, { useState, useEffect } from "react";
import { AgreementSigningModal } from "@/components/portal/agreement-signing-modal";
import { EditAgreementRecipientModal } from "@/components/agreement/edit-recipient-modal";
import {
  getSignedExecutedPdfUrlAction,
  getAgreementRecipientsAction,
  resendAgreementRecipientEmailAction,
} from "@/lib/agreement/actions";
import {
  type CompanyAgreementItem,
  type AgreementRecipientItem,
  AGREEMENT_STATUS_LABELS,
  AGREEMENT_STATUS_STYLES,
} from "@/lib/agreement/types";
import { getPersonDisplayName } from "@/lib/user/name-helper";

interface AgreementCardProps {
  agreement: CompanyAgreementItem;
  companyInfo: {
    id: string;
    name: string;
    address?: string | null;
    representativeName?: string | null;
    signerName?: string | null;
    signerTitle?: string | null;
  };
  companyUsers?: any[];
  userEmail: string;
  canWrite?: boolean;
}

export function AgreementCard({ agreement: initialAgreement, companyInfo, companyUsers, userEmail, canWrite = true }: AgreementCardProps) {
  const [agreement, setAgreement] = useState<CompanyAgreementItem>(initialAgreement);
  const [isSigningModalOpen, setIsSigningModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const resolveRecipientDisplayName = (r: AgreementRecipientItem) => {
    if (companyUsers && companyUsers.length > 0) {
      const match = companyUsers.find(
        (u) =>
          (u.email && r.recipient_email && u.email.toLowerCase() === r.recipient_email.toLowerCase()) ||
          (u.id && (r as any).user_id && u.id === (r as any).user_id)
      );
      if (match) {
        return getPersonDisplayName(match);
      }
    }
    return getPersonDisplayName({
      name: r.recipient_name,
      email: r.recipient_email,
    }) || r.recipient_name;
  };

  const resolveSignerDisplayName = () => {
    if (!agreement.signer_name) return "체결 대기 중";
    if (companyUsers && companyUsers.length > 0) {
      const match = companyUsers.find(
        (u) =>
          (u.email && (agreement as any).signer_email && u.email.toLowerCase() === (agreement as any).signer_email.toLowerCase()) ||
          (u.name && agreement.signer_name && (u.name === agreement.signer_name || u.korean_first_name === agreement.signer_name || u.english_name === agreement.signer_name))
      );
      if (match) {
        const dName = getPersonDisplayName(match);
        return `${dName} (${agreement.signer_title || "대표자"})`;
      }
    }
    const dName = getPersonDisplayName({ name: agreement.signer_name, email: (agreement as any).signer_email }) || agreement.signer_name;
    return `${dName} (${agreement.signer_title || "대표자"})`;
  };

  // Recipient History State
  const [recipients, setRecipients] = useState<AgreementRecipientItem[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [editingRecipient, setEditingRecipient] = useState<AgreementRecipientItem | null>(null);

  const statusLabel = AGREEMENT_STATUS_LABELS[agreement.status] || { ko: agreement.status, en: agreement.status };
  const statusStyle = AGREEMENT_STATUS_STYLES[agreement.status] || "bg-zinc-100 text-zinc-700 border-zinc-200";

  const fetchRecipients = async () => {
    if (!agreement.id) return;
    setLoadingRecipients(true);
    try {
      const res = await getAgreementRecipientsAction(agreement.id);
      if (res.recipients) {
        setRecipients(res.recipients);
      }
    } catch (e) {
      console.error("Fetch Recipients Error", e);
    } finally {
      setLoadingRecipients(false);
    }
  };

  useEffect(() => {
    if (agreement.status === "active") {
      fetchRecipients();
    }
  }, [agreement.id, agreement.status]);

  const handleOpenPdfViewer = async () => {
    const targetPath =
      agreement.final_pdf_path ||
      agreement.id ||
      `agreements/${companyInfo.id}/${agreement.agreement_id}.pdf`;

    setLoadingPdf(true);
    setPdfError(null);
    try {
      const res = await getSignedExecutedPdfUrlAction(targetPath);
      if (!res.url) {
        setPdfError(res.error || "PDF URL을 생성할 수 없습니다.");
        setLoadingPdf(false);
        return;
      }
      setPdfUrl(res.url);
      setLoadingPdf(false);
      setIsPreviewModalOpen(true);
    } catch (err: any) {
      setPdfError(err.message || "PDF 불러오기 오류");
      setLoadingPdf(false);
    }
  };

  const handleDownloadPdf = async () => {
    const targetPath =
      agreement.final_pdf_path ||
      agreement.id ||
      `agreements/${companyInfo.id}/${agreement.agreement_id}.pdf`;
    const downloadFilename = `K_SELECT_Agreement_${agreement.agreement_id || "v1.0"}.pdf`;

    setLoadingPdf(true);
    setPdfError(null);
    try {
      const res = await getSignedExecutedPdfUrlAction(targetPath, { downloadFilename });
      if (res.url) {
        const a = document.createElement("a");
        a.href = res.url;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        setPdfError(res.error || "PDF 다운로드 URL을 생성할 수 없습니다.");
      }
    } catch (err: any) {
      setPdfError(err.message || "PDF 다운로드 오류");
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleResendEmail = async (recipientId: string) => {
    setResendingId(recipientId);
    try {
      const res = await resendAgreementRecipientEmailAction(recipientId);
      if (res.success) {
        alert("계약서 사본 메일이 재발송되었습니다.");
        fetchRecipients();
      } else {
        alert(`재발송 실패: ${res.error || "오류 발생"}`);
      }
    } catch (e: any) {
      alert(`재발송 오류: ${e.message}`);
    } finally {
      setResendingId(null);
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Main Agreement Card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-150 dark:border-zinc-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-bold border ${statusStyle}`}>
                {statusLabel.ko}
              </span>
              <span className="text-xs font-mono text-zinc-400 font-semibold">
                Version {agreement.version || "1.0"}
              </span>
              {agreement.agreement_id && (
                <span className="text-xs font-mono font-bold text-indigo-650 dark:text-indigo-400">
                  [{agreement.agreement_id}]
                </span>
              )}
            </div>
            <h3 className="text-base font-extrabold text-zinc-900 dark:text-white mt-1">
              브랜드 공급·미국 유통 및 플랫폼 이용 기본계약서 (비독점)
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Brand Supply, U.S. Distribution & Platform Agreement (Non-Exclusive)
            </p>
          </div>

          <div className="flex items-center gap-2">
            {agreement.status === "pending" || agreement.status === "re_signature_required" ? (
              canWrite ? (
                <button
                  type="button"
                  onClick={() => setIsSigningModalOpen(true)}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-xs font-bold text-white transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <span>✍️</span>
                  <span>계약서 확인 / 서명</span>
                </button>
              ) : (
                <span className="text-xs text-zinc-500 italic bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
                  서명 권한이 없습니다 (조회 전용)
                </span>
              )
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenPdfViewer}
                  disabled={loadingPdf}
                  className="rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 px-3.5 py-2 text-xs font-bold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-750 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {loadingPdf ? "로딩..." : "📄 계약서 보기"}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={loadingPdf}
                  className="rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 px-3.5 py-2 text-xs font-bold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-750 transition-colors cursor-pointer disabled:opacity-50"
                >
                  📥 PDF 다운로드
                </button>
              </div>
            )}
          </div>
        </div>

        {pdfError && (
          <div className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-800 dark:bg-rose-950/30 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            ⚠️ {pdfError}
          </div>
        )}

        {/* Details Grid (3 Cards: Signed By, Effective Date, Term Expiration) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="space-y-1 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-150 dark:border-zinc-800">
            <span className="text-zinc-400 font-medium block text-[11px]">계약 체결자 (Signed By)</span>
            <strong className="text-zinc-900 dark:text-zinc-100 font-bold block text-xs">
              {resolveSignerDisplayName()}
            </strong>
          </div>

          <div className="space-y-1 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-150 dark:border-zinc-800">
            <span className="text-zinc-400 font-medium block text-[11px]">계약 발효일 (Effective Date)</span>
            <strong className="text-zinc-900 dark:text-zinc-100 font-mono font-bold block text-xs">
              {agreement.effective_date || agreement.signed_at?.split("T")[0] || "-"}
            </strong>
          </div>

          <div className="space-y-1 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-150 dark:border-zinc-800">
            <span className="text-zinc-400 font-medium block text-[11px]">최초 만료일 (Term Expiration)</span>
            <strong className="text-zinc-900 dark:text-zinc-100 font-mono font-bold block text-xs">
              {agreement.expiration_date || "-"}
            </strong>
          </div>
        </div>

        {/* Recipient Distribution History Section (Requirement 4) */}
        {agreement.status === "active" && (
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                📫 계약서 수신 기록 (Distribution History)
              </h4>
              <button
                type="button"
                onClick={fetchRecipients}
                disabled={loadingRecipients}
                className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                {loadingRecipients ? "새로고침 중..." : "🔄 새로고침"}
              </button>
            </div>

            {recipients.length > 0 ? (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-950">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-900 text-zinc-500 font-medium border-b border-zinc-200 dark:border-zinc-800 text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">수신자 성명</th>
                      <th className="py-2.5 px-3">직책</th>
                      <th className="py-2.5 px-3">이메일</th>
                      <th className="py-2.5 px-3">구분</th>
                      <th className="py-2.5 px-3">전송 일시</th>
                      <th className="py-2.5 px-3">전송 상태</th>
                      <th className="py-2.5 px-3 text-right">작업</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800">
                    {recipients.map((r) => (
                      <tr key={r.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40">
                        <td className="py-2.5 px-3 font-bold text-zinc-900 dark:text-zinc-100">
                          {resolveRecipientDisplayName(r)}
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
                          {canWrite ? (
                            <div className="flex items-center justify-end gap-2">
                              {r.recipient_type === "additional_recipient" && (
                                <button
                                  type="button"
                                  onClick={() => setEditingRecipient(r)}
                                  className="text-[11px] font-bold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:underline cursor-pointer"
                                >
                                  수정
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleResendEmail(r.id)}
                                disabled={resendingId === r.id}
                                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 cursor-pointer disabled:opacity-50"
                              >
                                {resendingId === r.id ? "발송 중..." : "메일 재발송"}
                              </button>
                            </div>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                수신 이력 정보를 불러오는 중이거나 등록된 수신자가 없습니다.
              </p>
            )}
          </div>
        )}

        {/* Operating Terms Info Box */}
        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50 text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-1">
          <p className="font-semibold text-zinc-800 dark:text-zinc-200">
            ℹ️ 기본계약 주요 운용 안내:
          </p>
          <ul className="list-disc list-inside space-y-0.5 opacity-90">
            <li>본 계약의 최초 계약기간은 2년이며, 만료일 90일 전까지 서면 통지가 없는 경우 2년 단위로 자동 연장됩니다.</li>
            <li>계약 상태가 체결 대기 중이더라도 포털 내 모든 기능(제품 등록, 주문 관리, 정산, 문의 등)은 정상 이용 가능합니다.</li>
            <li>전자서명이 완료된 최종 PDF 계약서는 암호화되어 안전하게 보존되며 언제든지 확인 및 다운로드할 수 있습니다.</li>
          </ul>
        </div>
      </div>

      {/* Recipient Edit Modal */}
      <EditAgreementRecipientModal
        isOpen={!!editingRecipient}
        onClose={() => setEditingRecipient(null)}
        recipient={editingRecipient}
        locale="ko"
        onSuccess={(updated, resent) => {
          setRecipients((prev) =>
            prev.map((rec) => (rec.id === updated.id ? { ...rec, ...updated } : rec))
          );
          if (resent) {
            alert("수신자 정보가 수정되었으며, 계약서 사본이 즉시 재발송되었습니다.");
          } else {
            alert("수신자 정보가 성공적으로 수정되었습니다.");
          }
          fetchRecipients();
        }}
      />

      {/* Signing Modal */}
      <AgreementSigningModal
        agreement={agreement}
        companyInfo={companyInfo}
        userEmail={userEmail}
        isOpen={isSigningModalOpen}
        onClose={() => setIsSigningModalOpen(false)}
        onSuccess={(updated) => setAgreement(updated)}
      />

      {/* Executed PDF Preview Modal */}
      {isPreviewModalOpen && pdfUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-4xl h-[90vh] rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-150 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                전자서명 완료된 최종 계약서 (ID: {agreement.agreement_id})
              </h3>
              <div className="flex items-center gap-2">
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-colors"
                >
                  새 창 열기 ↗
                </a>
                <button
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 mt-3 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-zinc-100 dark:bg-zinc-950">
              <iframe src={`${pdfUrl}#toolbar=1`} className="w-full h-full border-none" title="Executed Agreement PDF" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
