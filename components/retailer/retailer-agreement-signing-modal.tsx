"use client";

import React, { useState, useTransition } from "react";
import { signCompanyAgreementAction } from "@/lib/agreement/actions";
import { createRetailerSupportInquiryAction } from "@/lib/retailer/support-actions";
import type { CompanyAgreementItem, AdditionalRecipientInput } from "@/lib/agreement/types";
import { stageLargeFiles } from "@/lib/files/stage-form-files";
import { useTranslation } from "@/lib/i18n";

interface RetailerAgreementSigningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedAgreement: CompanyAgreementItem) => void;
  agreement: CompanyAgreementItem;
  companyInfo: {
    id: string;
    name: string;
    address?: string | null;
    representativeName?: string | null;
  };
  currentUser: {
    displayName: string;
    email: string;
  };
  onOpenCompanyEdit?: () => void;
}

export function RetailerAgreementSigningModal({
  isOpen,
  onClose,
  onSuccess,
  agreement,
  companyInfo,
  currentUser,
  onOpenCompanyEdit,
}: RetailerAgreementSigningModalProps) {
  const { locale } = useTranslation();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Step 1 Validation
  const isNameMissing = !companyInfo.name || !companyInfo.name.trim();
  const isAddressMissing =
    !companyInfo.address ||
    !companyInfo.address.trim() ||
    companyInfo.address.toLowerCase().includes("no address") ||
    companyInfo.address.toLowerCase().includes("not recorded");
  const isRepresentativeMissing =
    !companyInfo.representativeName ||
    !companyInfo.representativeName.trim() ||
    companyInfo.representativeName.toLowerCase().includes("not recorded");
  const isCompanyInfoIncomplete = isNameMissing || isAddressMissing || isRepresentativeMissing;

  // Step 2: Signer & Recipients
  const [signerName, setSignerName] = useState(
    agreement.signer_name || companyInfo.representativeName || currentUser.displayName || ""
  );
  const [signerTitle, setSignerTitle] = useState(
    agreement.signer_title || "Managing Director"
  );
  const [signerEmail, setSignerEmail] = useState(
    agreement.signer_email || currentUser.email || ""
  );

  const [additionalRecipients, setAdditionalRecipients] = useState<AdditionalRecipientInput[]>([]);

  // Step 3: Review Confirmation & Agreement Inquiry Modal
  const [consentToAgreement, setConsentToAgreement] = useState(false);
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);
  const [inquirySubject, setInquirySubject] = useState(
    `Retailer Agreement Inquiry — ${agreement.agreement_id}`
  );
  const [inquiryContent, setInquiryContent] = useState("");
  const [inquiryFile, setInquiryFile] = useState<File | null>(null);
  const [inquirySending, setInquirySending] = useState(false);
  const [inquirySuccess, setInquirySuccess] = useState<string | null>(null);
  const [inquiryError, setInquiryError] = useState<string | null>(null);

  // Step 4: Signature & Authority
  const [authorityConfirmed, setAuthorityConfirmed] = useState(false);
  const [consentToESignature, setConsentToESignature] = useState(false);

  if (!isOpen) return null;

  const handleAddRecipient = () => {
    if (additionalRecipients.length >= 5) return;
    setAdditionalRecipients((prev) => [...prev, { name: "", title: "", email: "" }]);
  };

  const handleRemoveRecipient = (index: number) => {
    setAdditionalRecipients((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRecipientChange = (index: number, field: keyof AdditionalRecipientInput, value: string) => {
    setAdditionalRecipients((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSubmitInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryContent.trim()) {
      setInquiryError("Please enter your inquiry details.");
      return;
    }
    setInquirySending(true);
    setInquiryError(null);
    setInquirySuccess(null);

    try {
      const fd = new FormData();
      fd.append("category", "agreement_inquiry");
      fd.append("title", inquirySubject.trim());
      fd.append("content", inquiryContent.trim());
      if (inquiryFile) {
        fd.append("file", inquiryFile);
      }
      const res = await createRetailerSupportInquiryAction(await stageLargeFiles(fd));
      if (res.success) {
        setInquirySuccess(
          `Inquiry submitted successfully! Case #${res.caseNumber || "LOGGED"}. Our support team will review and respond promptly.`
        );
        setInquiryContent("");
        setInquiryFile(null);
        setTimeout(() => {
          setIsInquiryModalOpen(false);
          setInquirySuccess(null);
        }, 2200);
      } else {
        setInquiryError(res.error || "Failed to submit inquiry.");
      }
    } catch (err: any) {
      setInquiryError(err.message || "An unexpected error occurred.");
    } finally {
      setInquirySending(false);
    }
  };

  const handleExecute = () => {
    setErrorMessage(null);

    if (!signerName.trim() || !signerTitle.trim()) {
      setErrorMessage("Please enter the Signatory Name and Title.");
      return;
    }

    if (!signerEmail.trim() || !signerEmail.includes("@")) {
      setErrorMessage("Please enter a valid Signatory Email address.");
      return;
    }

    for (let i = 0; i < additionalRecipients.length; i++) {
      const r = additionalRecipients[i];
      if (!r.name.trim() || !r.title.trim() || !r.email.trim() || !r.email.includes("@")) {
        setErrorMessage(`Please complete all fields (Name, Title, Email) for recipient #${i + 1}.`);
        return;
      }
    }

    if (!consentToAgreement) {
      setErrorMessage("Please review and accept the Agreement terms in Step 3.");
      return;
    }

    if (!authorityConfirmed || !consentToESignature) {
      setErrorMessage("Please check both authority and electronic signature confirmations.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await signCompanyAgreementAction({
          companyAgreementId: agreement.id,
          companyId: agreement.company_id,
          signerName: signerName.trim(),
          signerTitle: signerTitle.trim(),
          signerEmail: signerEmail.trim(),
          authorityConfirmed,
          consentToAgreement,
          consentToESignature,
          additionalRecipients: additionalRecipients.length > 0 ? additionalRecipients : undefined,
        });

        if (res.success && res.agreement) {
          onSuccess(res.agreement);
        } else {
          setErrorMessage(res.error || "Failed to execute agreement. Please try again.");
        }
      } catch (err: any) {
        setErrorMessage(err.message || "An unexpected error occurred during execution.");
      }
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fadeIn">
        <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 flex flex-col max-h-[92vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-zinc-150 dark:border-zinc-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  RETAILER OPERATING AGREEMENT
                </span>
                <span className="text-xs text-zinc-400 font-mono">
                  [ID: {agreement.agreement_id}]
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-zinc-900 dark:text-white mt-0.5">
                Retailer Supply & K SELECT Platform Agreement (v{agreement.version || "1.0"})
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-lg cursor-pointer p-1"
            >
              ✕
            </button>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-800 text-xs font-semibold">
            {[
              { num: 1, label: "1. Company Info" },
              { num: 2, label: "2. Signer & Delivery" },
              { num: 3, label: "3. Agreement Review" },
              { num: 4, label: "4. Electronic Signature" },
            ].map((s) => (
              <button
                key={s.num}
                type="button"
                onClick={() => {
                  if (s.num > 1 && isCompanyInfoIncomplete) return;
                  setStep(s.num as any);
                }}
                className={`flex items-center gap-1.5 pb-1 border-b-2 transition-colors cursor-pointer ${
                  step === s.num
                    ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white font-bold"
                    : step > s.num
                    ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                    : "border-transparent text-zinc-400"
                }`}
              >
                <span>{step > s.num ? "✓" : s.num}</span>
                <span className="hidden sm:inline">{s.label.split(". ")[1]}</span>
              </button>
            ))}
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="my-3 p-3 rounded-xl bg-rose-50 text-xs font-semibold text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
              ⚠️ {errorMessage}
            </div>
          )}

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {/* STEP 1: Company Information */}
            {step === 1 && (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-150 dark:border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-zinc-900 dark:text-white">
                        Retailer Organization Details (Page 1 Overlay)
                      </h4>
                      <p className="text-zinc-500 dark:text-zinc-400 text-[11px] mt-0.5">
                        Please verify your corporate entity information below. These authoritative details will be embedded into your executed Agreement PDF.
                      </p>
                    </div>
                    {onOpenCompanyEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenCompanyEdit();
                        }}
                        className="px-3 py-1 text-xs font-bold rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1"
                      >
                        <span>✏️</span>
                        <span>Edit Info</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-medium text-zinc-400">Company Legal Name</span>
                          {!isNameMissing ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                              ✓ Verified
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900">
                              ⚠️ Required — Missing
                            </span>
                          )}
                        </div>
                        <strong className="text-sm font-bold text-zinc-900 dark:text-white block mt-1">
                          {companyInfo.name || "Not Recorded"}
                        </strong>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-medium text-zinc-400">Company Representative</span>
                          {!isRepresentativeMissing ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                              ✓ Verified
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900">
                              ⚠️ Required — Missing
                            </span>
                          )}
                        </div>
                        <strong className="text-sm font-bold text-zinc-900 dark:text-white block mt-1">
                          {companyInfo.representativeName || "Not Recorded"}
                        </strong>
                      </div>
                    </div>

                    <div className="sm:col-span-2 p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-medium text-zinc-400">Headquarters / Billing Address</span>
                          {!isAddressMissing ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                              ✓ Verified
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900">
                              ⚠️ Required — Missing
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-zinc-800 dark:text-zinc-200 block mt-1">
                          {companyInfo.address || "No address recorded on file"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {isCompanyInfoIncomplete && (
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <span>⚠️</span>
                      <span>Incomplete Corporate Information</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                      Official agreements require a verified Company Legal Name, Representative, and Headquarters Address. Please update your company profile before proceeding with execution.
                    </p>
                    {onOpenCompanyEdit && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenCompanyEdit();
                          }}
                          className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <span>✏️</span>
                          <span>Edit Company Information</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: Signer & Additional Recipients */}
            {step === 2 && (
              <div className="space-y-4 text-xs">
                <div className="space-y-3">
                  <h4 className="font-bold text-sm text-zinc-900 dark:text-white">
                    Authorized Signatory Information
                  </h4>
                  <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                    Provide the details of the authorized officer or representative executing this agreement on behalf of {companyInfo.name}.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                        Signatory Full Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={signerName}
                        onChange={(e) => setSignerName(e.target.value)}
                        placeholder="e.g. Sarah Jenkins"
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                        Corporate Role / Title <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={signerTitle}
                        onChange={(e) => setSignerTitle(e.target.value)}
                        placeholder="e.g. Managing Director & CEO"
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                        Signatory Email Address <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={signerEmail}
                        onChange={(e) => setSignerEmail(e.target.value)}
                        placeholder="e.g. sarah.jenkins@retailer.com"
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white font-mono"
                      />
                      <span className="text-[10px] text-zinc-400 mt-1 block">
                        The finalized signed PDF will be delivered directly to this email upon execution.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Additional Recipients Section */}
                <div className="pt-3 border-t border-zinc-150 dark:border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-bold text-xs text-zinc-900 dark:text-white">
                        Additional Delivery Recipients (Optional)
                      </h5>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Send a verified PDF copy to accounting, legal counsel, or store managers.
                      </p>
                    </div>
                    {additionalRecipients.length < 5 && (
                      <button
                        type="button"
                        onClick={handleAddRecipient}
                        className="px-3 py-1 text-xs font-bold rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                      >
                        + Add Recipient
                      </button>
                    )}
                  </div>

                  {additionalRecipients.map((r, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850 space-y-2 relative"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[11px] text-indigo-600 dark:text-indigo-400">
                          Recipient #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveRecipient(idx)}
                          className="text-rose-500 hover:text-rose-700 text-xs font-bold cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={r.name}
                          onChange={(e) => handleRecipientChange(idx, "name", e.target.value)}
                          placeholder="Full Name"
                          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                        />
                        <input
                          type="text"
                          value={r.title}
                          onChange={(e) => handleRecipientChange(idx, "title", e.target.value)}
                          placeholder="Title / Role"
                          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                        />
                        <input
                          type="email"
                          value={r.email}
                          onChange={(e) => handleRecipientChange(idx, "email", e.target.value)}
                          placeholder="Email Address"
                          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white font-mono"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 3: Agreement Review */}
            {step === 3 && (
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-zinc-900 dark:text-white">
                      Agreement Review & Acknowledgment
                    </h4>
                    <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                      Review the official 6-page Retailer Supply & Platform Agreement template.
                    </p>
                  </div>
                  <a
                    href="/agreements/retailer_template_v1.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-[11px] font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 inline-flex items-center gap-1"
                  >
                    <span>↗</span> Open Full PDF in New Tab
                  </a>
                </div>

                {/* Embedded PDF Viewer */}
                <div className="w-full h-80 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-zinc-100 dark:bg-zinc-950">
                  <iframe
                    src="/agreements/retailer_template_v1.pdf#toolbar=0&navpanes=0"
                    className="w-full h-full border-none"
                    title="Retailer Agreement Template Preview"
                  />
                </div>

                {/* Inquiry Guidance Box */}
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-850/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">💬</span>
                    <div>
                      <span className="font-bold text-zinc-900 dark:text-white block">
                        Questions about this Agreement?
                      </span>
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block">
                        Need clarification on clauses, commercial terms, or custom store conditions?
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setInquiryError(null);
                      setInquirySuccess(null);
                      setIsInquiryModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-xs whitespace-nowrap transition-colors cursor-pointer shadow-2xs shrink-0"
                  >
                    Submit Agreement Inquiry
                  </button>
                </div>

                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850 flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="consentToAgreement"
                    checked={consentToAgreement}
                    onChange={(e) => setConsentToAgreement(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                  />
                  <label htmlFor="consentToAgreement" className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed cursor-pointer font-medium">
                    <strong>I have reviewed and agree to the terms</strong> of the K SELECT Retailer Supply & Platform Agreement (Version {agreement.version || "1.0"}), including product supply terms, approved location policies, weekly count requirements, and 2-year commercial terms.
                  </label>
                </div>
              </div>
            )}

            {/* STEP 4: Electronic Signature */}
            {step === 4 && (
              <div className="space-y-4 text-xs">
                <div className="space-y-2">
                  <h4 className="font-bold text-sm text-zinc-900 dark:text-white">
                    Electronic Signature & Execution Attestation
                  </h4>
                  <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                    Your typed name will be rendered in cursive calligraphy on Page 6 of the official document.
                  </p>
                </div>

                {/* Signature Visual Card */}
                <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-850 space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 border-b border-zinc-200 dark:border-zinc-700 pb-2">
                    <span>Signatory: <strong>{signerName || "Name"}</strong> ({signerTitle || "Title"})</span>
                    <span className="font-mono">Date: {new Date().toISOString().split("T")[0]}</span>
                  </div>

                  <div className="py-4 text-center bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <span
                      style={{
                        fontFamily: "var(--font-alex-brush), 'Alex Brush', cursive, Georgia, serif",
                        fontSize: "36px",
                        color: "#0c2060",
                        lineHeight: "1.2",
                      }}
                      className="select-none tracking-normal"
                    >
                      {signerName || "Signature Preview"}
                    </span>
                  </div>

                  <div className="text-[10px] text-zinc-400 text-center font-mono">
                    Electronic Signature SHA-256 Verified Seal • Standard Execution Protocol
                  </div>
                </div>

                {/* Legal Confirmations */}
                <div className="space-y-2 pt-2">
                  <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="authorityConfirmed"
                      checked={authorityConfirmed}
                      onChange={(e) => setAuthorityConfirmed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                    />
                    <label htmlFor="authorityConfirmed" className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed cursor-pointer font-medium">
                      <strong>Authority Confirmation:</strong> I confirm that I am an authorized representative of <strong>{companyInfo.name}</strong> with the legal authority to bind the company to this Agreement.
                    </label>
                  </div>

                  <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="consentToESignature"
                      checked={consentToESignature}
                      onChange={(e) => setConsentToESignature(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                    />
                    <label htmlFor="consentToESignature" className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed cursor-pointer font-medium">
                      <strong>Electronic Signature Consent:</strong> I consent to execute this Agreement electronically and agree that this electronic signature has the same legal validity, effect, and enforceability as a physical handwritten signature under the U.S. Electronic Signatures in Global and National Commerce Act (E-SIGN) and Uniform Electronic Transactions Act (UETA).
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-zinc-150 dark:border-zinc-800">
            <div>
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep((prev) => (prev - 1) as any)}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
                >
                  ← Back
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              {step < 4 ? (
                <button
                  type="button"
                  disabled={step === 1 && isCompanyInfoIncomplete}
                  onClick={() => {
                    if (step === 1 && isCompanyInfoIncomplete) {
                      setErrorMessage("Company legal name, representative, and address must be recorded before proceeding.");
                      return;
                    }
                    if (step === 2) {
                      if (!signerName.trim() || !signerTitle.trim() || !signerEmail.trim()) {
                        setErrorMessage("Please complete all required signatory fields.");
                        return;
                      }
                    }
                    if (step === 3 && !consentToAgreement) {
                      setErrorMessage("Please accept the Agreement terms to continue.");
                      return;
                    }
                    setErrorMessage(null);
                    setStep((prev) => (prev + 1) as any);
                  }}
                  className={`px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
                    step === 1 && isCompanyInfoIncomplete
                      ? "bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed"
                      : "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 cursor-pointer"
                  }`}
                  title={step === 1 && isCompanyInfoIncomplete ? "Please complete required company information before continuing" : undefined}
                >
                  Continue →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleExecute}
                  disabled={isPending || !authorityConfirmed || !consentToESignature || !consentToAgreement}
                  className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isPending ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Executing Agreement...</span>
                    </>
                  ) : (
                    <>
                      <span>✍️</span>
                      <span>Sign & Execute Agreement</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SUB-MODAL: Agreement Inquiry Form */}
      {isInquiryModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 flex flex-col space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-zinc-150 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">📜</span>
                <div>
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                    Retailer Agreement Inquiry
                  </h4>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Agreement ID: {agreement.agreement_id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInquiryModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-lg cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {inquiryError && (
              <div className="p-3 rounded-xl bg-rose-50 text-xs font-semibold text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                ⚠️ {inquiryError}
              </div>
            )}

            {inquirySuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                ✅ {inquirySuccess}
              </div>
            )}

            <form onSubmit={handleSubmitInquiry} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={locale === "ko" ? "계약 및 약관 문의 (Agreement Inquiry)" : "Agreement / Contract Inquiry"}
                  readOnly
                  disabled
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Subject Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={inquirySubject}
                  onChange={(e) => setInquirySubject(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Inquiry Details / Questions <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={inquiryContent}
                  onChange={(e) => setInquiryContent(e.target.value)}
                  placeholder={`Please describe your questions, requested clause clarifications, or specific store condition inquiries regarding Agreement ${agreement.agreement_id}...`}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Attachment (Optional — PDF, JPG, PNG up to 20MB)
                </label>
                <input
                  type="file"
                  onChange={(e) => setInquiryFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-zinc-500 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 dark:file:bg-zinc-800 file:text-zinc-700 dark:file:text-zinc-300 hover:file:bg-zinc-200 dark:hover:file:bg-zinc-700 cursor-pointer"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-150 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsInquiryModalOpen(false)}
                  disabled={inquirySending}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inquirySending || !inquiryContent.trim()}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {inquirySending ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Submit Inquiry</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
