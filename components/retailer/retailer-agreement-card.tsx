"use client";

import React, { useState, useEffect } from "react";
import {
  getSignedExecutedPdfUrlAction,
  getAgreementRecipientsAction,
  resendAgreementRecipientEmailAction,
} from "@/lib/agreement/actions";
import { RetailerAgreementSigningModal } from "@/components/retailer/retailer-agreement-signing-modal";
import type {
  CompanyAgreementItem,
  AgreementRecipientItem,
} from "@/lib/agreement/types";

interface RetailerAgreementCardProps {
  initialAgreement: CompanyAgreementItem | null;
  error?: string | null;
  companyInfo: {
    id: string;
    name: string;
    address?: string | null;
    representativeName?: string | null;
  };
  currentUser: {
    displayName: string;
    email: string;
    role: string;
  };
  onOpenCompanyEdit?: () => void;
}

export function RetailerAgreementCard({
  initialAgreement,
  error = null,
  companyInfo,
  currentUser,
  onOpenCompanyEdit,
}: RetailerAgreementCardProps) {
  const [agreement, setAgreement] = useState<CompanyAgreementItem | null>(initialAgreement);
  const [isSigningModalOpen, setIsSigningModalOpen] = useState(false);
  const [isPreviewTemplateOpen, setIsPreviewTemplateOpen] = useState(false);

  // PDF Loading State
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Recipient Distribution History
  const [recipients, setRecipients] = useState<AgreementRecipientItem[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const isExecuted = agreement?.status === "active" && !!agreement.final_pdf_path;
  const isOwner = currentUser.role === "owner";

  useEffect(() => {
    if (agreement && isExecuted) {
      loadRecipients(agreement.id);
    }
  }, [agreement?.id, isExecuted]);

  const loadRecipients = async (companyAgreementId: string) => {
    setLoadingRecipients(true);
    try {
      const res = await getAgreementRecipientsAction(companyAgreementId);
      if (res.recipients) {
        setRecipients(res.recipients);
      }
    } catch (e) {
      console.error("Failed to load recipients:", e);
    } finally {
      setLoadingRecipients(false);
    }
  };

  const handleOpenPdf = async () => {
    if (!agreement) return;
    setLoadingPdf(true);
    setPdfError(null);

    const path = agreement.final_pdf_path || `agreements/${agreement.company_id}/${agreement.agreement_id}.pdf`;
    const res = await getSignedExecutedPdfUrlAction(path);
    setLoadingPdf(false);

    if (res.url) {
      window.open(res.url, "_blank", "noopener,noreferrer");
    } else {
      setPdfError(res.error || "Failed to generate download URL.");
    }
  };

  const handleDownloadPdf = async () => {
    if (!agreement) return;
    setLoadingPdf(true);
    setPdfError(null);

    const filename = `K_SELECT_Retailer_Agreement_${agreement.agreement_id}.pdf`;
    const path = agreement.final_pdf_path || `agreements/${agreement.company_id}/${agreement.agreement_id}.pdf`;
    const res = await getSignedExecutedPdfUrlAction(path, { downloadFilename: filename });
    setLoadingPdf(false);

    if (res.url) {
      const a = document.createElement("a");
      a.href = res.url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      setPdfError(res.error || "Failed to generate download link.");
    }
  };

  const handleResendRecipient = async (recipientId: string) => {
    setResendingId(recipientId);
    try {
      const res = await resendAgreementRecipientEmailAction(recipientId);
      if (res.success) {
        alert("A copy of the executed Agreement has been resent successfully.");
        if (agreement) loadRecipients(agreement.id);
      } else {
        alert(`Resend failed: ${res.error || "Unknown error"}`);
      }
    } catch (err: any) {
      alert(`Resend error: ${err.message}`);
    } finally {
      setResendingId(null);
    }
  };

  const handleSigningSuccess = (updatedAgreement: CompanyAgreementItem) => {
    setAgreement(updatedAgreement);
    setIsSigningModalOpen(false);
    loadRecipients(updatedAgreement.id);
  };

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 p-6 shadow-xs text-center space-y-2">
        <div className="text-xl">⚠️</div>
        <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200">
          Retailer Operating Agreement
        </h3>
        <p className="text-xs text-rose-700 dark:text-rose-300">
          {error}
        </p>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 pt-1">
          If you believe this is an error, please reach out to support@kselecthub.com.
        </p>
      </div>
    );
  }

  if (!agreement) {
    return (
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xs text-center space-y-2">
        <div className="text-xl">📑</div>
        <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
          Retailer Supply & Platform Agreement
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Agreement record is being configured. Please refresh the page or contact your account administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-xs space-y-5">
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl shrink-0">
            📑
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white">
                Retailer Supply & K SELECT Platform Agreement
              </h2>
              {isExecuted ? (
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1">
                  <span>✓</span> Agreement Completed
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800 inline-flex items-center gap-1">
                  <span>⚠️</span> Agreement Required
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Official company-level operating terms, approved store fulfillment guidelines, and 2-year commercial terms.
            </p>
          </div>
        </div>

        {/* Action Buttons in Header */}
        <div className="flex items-center gap-2 shrink-0">
          {!isExecuted ? (
            <>
              <button
                type="button"
                onClick={() => setIsPreviewTemplateOpen(true)}
                className="px-3.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
              >
                Preview Template
              </button>
              {isOwner ? (
                <button
                  type="button"
                  onClick={() => setIsSigningModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <span>✍️</span>
                  <span>Review & Sign Agreement</span>
                </button>
              ) : (
                <span className="text-[11px] text-zinc-400 italic">
                  Company Owner signature required
                </span>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleOpenPdf}
                disabled={loadingPdf}
                className="px-3.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-xs font-bold text-zinc-800 dark:text-zinc-200 transition-colors inline-flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
              >
                <span>👁️</span>
                <span>{loadingPdf ? "Opening..." : "View Agreement"}</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={loadingPdf}
                className="px-4 py-1.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors inline-flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
              >
                <span>⬇️</span>
                <span>Download PDF</span>
              </button>
            </>
          )}
        </div>
      </div>

      {pdfError && (
        <div className="p-3 rounded-xl bg-rose-50 text-xs font-semibold text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
          ⚠️ {pdfError}
        </div>
      )}

      {/* Main Body */}
      {!isExecuted ? (
        /* PENDING STATE CARD */
        <div className="p-5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 space-y-4">
          <div className="space-y-1.5">
            <h3 className="font-bold text-xs text-amber-950 dark:text-amber-200">
              Electronic Signature Pending for {companyInfo.name}
            </h3>
            <p className="text-xs text-amber-900/80 dark:text-amber-300/80 leading-relaxed">
              Your company has been assigned the authoritative <strong>Retailer Supply & K SELECT Platform Agreement (Version {agreement.version || "1.0"})</strong>.
              Execution is required once per company by an authorized officer or owner. Your store locations and staff users operate under this company-level agreement.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
            <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-amber-200/60 dark:border-amber-900/30">
              <span className="text-[10px] font-medium text-zinc-400 block">Agreement ID</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-white block mt-0.5">
                {agreement.agreement_id}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-amber-200/60 dark:border-amber-900/30">
              <span className="text-[10px] font-medium text-zinc-400 block">Initial Term</span>
              <span className="font-bold text-zinc-900 dark:text-white block mt-0.5">
                2 Years (Successive 2-Year Renewals)
              </span>
            </div>
            <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-amber-200/60 dark:border-amber-900/30">
              <span className="text-[10px] font-medium text-zinc-400 block">Execution Method</span>
              <span className="font-bold text-zinc-900 dark:text-white block mt-0.5">
                Electronic Signature (E-SIGN / UETA)
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* EXECUTED STATE DETAILS */
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-150 dark:border-zinc-800 space-y-0.5">
              <span className="text-[11px] font-medium text-zinc-400 block">Signatory</span>
              <strong className="text-zinc-900 dark:text-white text-xs block">
                {agreement.signer_name}
              </strong>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block">
                {agreement.signer_title || "Company Representative"}
              </span>
              {agreement.signer_email && (
                <span className="text-[10px] font-mono text-zinc-400 block">
                  {agreement.signer_email}
                </span>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-150 dark:border-zinc-800 space-y-0.5">
              <span className="text-[11px] font-medium text-zinc-400 block">Agreement ID & Version</span>
              <strong className="font-mono font-bold text-zinc-900 dark:text-white text-xs block">
                {agreement.agreement_id}
              </strong>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block">
                Standard Version {agreement.version || "1.0"}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-150 dark:border-zinc-800 space-y-0.5">
              <span className="text-[11px] font-medium text-zinc-400 block">Effective Date</span>
              <strong className="font-mono font-bold text-zinc-900 dark:text-white text-xs block">
                {agreement.effective_date || agreement.signed_at?.split("T")[0] || "—"}
              </strong>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">
                Active & Legally Binding
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-150 dark:border-zinc-800 space-y-0.5">
              <span className="text-[11px] font-medium text-zinc-400 block">Term Expiration</span>
              <strong className="font-mono font-bold text-zinc-900 dark:text-white text-xs block">
                {agreement.expiration_date || "—"}
              </strong>
              <span className="text-[10px] text-zinc-400 block">
                2-Year Successive Auto-Renewal
              </span>
            </div>
          </div>

          {/* Recipient Distribution History */}
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                <span>📫</span>
                <span>Distribution History & Verified Email Delivery</span>
              </h3>
              {loadingRecipients && (
                <span className="text-[10px] text-zinc-400 animate-pulse">Refreshing...</span>
              )}
            </div>

            {recipients.length === 0 ? (
              <p className="text-xs text-zinc-400 italic">
                PDF delivery record registered for {agreement.signer_email || "the signatory"}.
              </p>
            ) : (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-950">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-900 text-zinc-500 font-medium border-b border-zinc-200 dark:border-zinc-800 text-[11px]">
                    <tr>
                      <th className="py-2 px-3">Recipient</th>
                      <th className="py-2 px-3">Role / Title</th>
                      <th className="py-2 px-3">Email</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Delivery Status</th>
                      <th className="py-2 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {recipients.map((r) => (
                      <tr key={r.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40">
                        <td className="py-2 px-3 font-semibold text-zinc-900 dark:text-zinc-100">
                          {r.recipient_name}
                        </td>
                        <td className="py-2 px-3 text-zinc-600 dark:text-zinc-400 text-[11px]">
                          {r.recipient_title}
                        </td>
                        <td className="py-2 px-3 font-mono text-zinc-700 dark:text-zinc-300 text-[11px]">
                          {r.recipient_email}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.recipient_type === "signer"
                                ? "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
                                : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                            }`}
                          >
                            {r.recipient_type === "signer" ? "Signatory" : "Recipient"}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.delivery_status === "sent"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                            }`}
                          >
                            {r.delivery_status === "sent" ? "✓ Sent" : "⚠️ Failed"}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleResendRecipient(r.id)}
                            disabled={resendingId === r.id}
                            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 cursor-pointer disabled:opacity-50"
                          >
                            {resendingId === r.id ? "Sending..." : "Resend"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Tamper-Evident SHA-256 Checksum */}
          {agreement.final_pdf_hash && (
            <div className="pt-2 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
              <span>
                Document SHA-256: <span className="select-all font-semibold text-zinc-600 dark:text-zinc-300">{agreement.final_pdf_hash}</span>
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                🔒 Immutable Archival Storage
              </span>
            </div>
          )}
        </div>
      )}

      {/* Signing Wizard Modal */}
      {isSigningModalOpen && (
        <RetailerAgreementSigningModal
          isOpen={isSigningModalOpen}
          onClose={() => setIsSigningModalOpen(false)}
          onSuccess={handleSigningSuccess}
          agreement={agreement}
          companyInfo={companyInfo}
          currentUser={currentUser}
          onOpenCompanyEdit={onOpenCompanyEdit}
        />
      )}

      {/* Preview Template Modal */}
      {isPreviewTemplateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-4xl h-[90vh] rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-150 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                Retailer Supply & K SELECT Platform Agreement Template Preview
              </h3>
              <button
                onClick={() => setIsPreviewTemplateOpen(null as any)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 mt-3 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-zinc-100 dark:bg-zinc-950">
              <iframe
                src="/agreements/retailer_template_v1.pdf#toolbar=1"
                className="w-full h-full border-none"
                title="Retailer Agreement Template Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
