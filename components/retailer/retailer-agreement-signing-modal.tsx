"use client";

import React, { useState, useTransition } from "react";
import { signCompanyAgreementAction } from "@/lib/agreement/actions";
import type { CompanyAgreementItem, AdditionalRecipientInput } from "@/lib/agreement/types";

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
}

export function RetailerAgreementSigningModal({
  isOpen,
  onClose,
  onSuccess,
  agreement,
  companyInfo,
  currentUser,
}: RetailerAgreementSigningModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  // Step 3: Review Confirmation
  const [consentToAgreement, setConsentToAgreement] = useState(false);

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
              onClick={() => setStep(s.num as any)}
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
                <h4 className="font-bold text-sm text-zinc-900 dark:text-white">
                  Retailer Organization Details (Page 1 Overlay)
                </h4>
                <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                  Please verify your corporate entity information below. These authoritative details will be embedded into your executed Agreement PDF.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <span className="text-[11px] font-medium text-zinc-400 block">Company Legal Name</span>
                    <strong className="text-sm font-bold text-zinc-900 dark:text-white block mt-0.5">
                      {companyInfo.name}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-zinc-400 block">Company Representative</span>
                    <strong className="text-sm font-bold text-zinc-900 dark:text-white block mt-0.5">
                      {companyInfo.representativeName || "Not Recorded"}
                    </strong>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[11px] font-medium text-zinc-400 block">Headquarters / Billing Address</span>
                    <span className="text-xs text-zinc-800 dark:text-zinc-200 block mt-0.5">
                      {companyInfo.address || "No address recorded on file"}
                    </span>
                  </div>
                </div>
              </div>

              {(!companyInfo.name || !companyInfo.address) && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs">
                  ℹ️ If you need to update your company name or address, you can edit it under the <strong>Company & Store Locations</strong> tab.
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
                onClick={() => {
                  if (step === 1 && (!companyInfo.name || !companyInfo.address)) {
                    setErrorMessage("Company name and address must be recorded before proceeding.");
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
                className="px-5 py-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-xs font-bold hover:bg-zinc-800 dark:hover:bg-zinc-100 shadow-xs cursor-pointer"
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
  );
}
