"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { signCompanyAgreementAction } from "@/lib/agreement/actions";
import type { CompanyAgreementItem } from "@/lib/agreement/types";

interface AgreementSigningModalProps {
  agreement: CompanyAgreementItem;
  companyInfo: {
    id: string;
    name: string;
    address?: string | null;
    representativeName?: string | null;
  };
  userEmail: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: CompanyAgreementItem) => void;
}

export function AgreementSigningModal({
  agreement,
  companyInfo,
  userEmail,
  isOpen,
  onClose,
  onSuccess,
}: AgreementSigningModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [signerName, setSignerName] = useState(companyInfo.representativeName || "");
  const [signerTitle, setSignerTitle] = useState("대표이사 (CEO)");
  const [signerEmail, setSignerEmail] = useState(userEmail || "");

  const [consentAgreement, setConsentAgreement] = useState(false);
  const [authorityConfirmed, setAuthorityConfirmed] = useState(false);
  const [consentESignature, setConsentESignature] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const hasMissingCompanyInfo = !companyInfo.name || !companyInfo.address;

  const handleNextStep = () => {
    setErrorMessage(null);
    if (step === 1) {
      if (hasMissingCompanyInfo) return;
      setStep(2);
    } else if (step === 2) {
      if (!signerName.trim()) {
        setErrorMessage("서명자 이름을 입력해 주세요.");
        return;
      }
      if (!signerTitle.trim()) {
        setErrorMessage("서명자 직책을 입력해 주세요.");
        return;
      }
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    }
  };

  const handleCompleteSigning = async () => {
    setErrorMessage(null);

    if (!consentAgreement || !authorityConfirmed || !consentESignature) {
      setErrorMessage("모든 필수 동의 항목에 동의해 주셔야 계약을 체결할 수 있습니다.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await signCompanyAgreementAction({
        companyAgreementId: agreement.id,
        signerName: signerName.trim(),
        signerTitle: signerTitle.trim(),
        signerEmail: signerEmail.trim() || userEmail,
        authorityConfirmed,
        consentToAgreement: consentAgreement,
        consentToESignature: consentESignature,
      });

      if (!res.success || !res.agreement) {
        setErrorMessage(res.error || "전자서명 저장 중 오류가 발생했습니다.");
        setIsSubmitting(false);
        return;
      }

      onSuccess(res.agreement);
      onClose();
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "서명 처리 중 오류가 발생했습니다.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-150 dark:border-zinc-800">
          <div>
            <span className="text-[10px] font-mono font-bold tracking-wider text-indigo-600 dark:text-indigo-400">
              K SELECT NETWORK AGREEMENT SIGNING WIZARD
            </span>
            <h2 className="text-lg font-extrabold text-zinc-900 dark:text-white mt-0.5">
              브랜드 공급·미국 유통 및 플랫폼 이용 기본계약서 전자서명
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="grid grid-cols-4 gap-2 my-4">
          {[
            { s: 1, label: "1. 회사 정보" },
            { s: 2, label: "2. 서명자 정보" },
            { s: 3, label: "3. 계약서 검토" },
            { s: 4, label: "4. 전자서명 완료" },
          ].map((item) => (
            <div
              key={item.s}
              className={`py-2 px-3 rounded-lg text-center text-xs font-bold transition-colors ${
                step === item.s
                  ? "bg-indigo-600 text-white shadow-xs"
                  : step > item.s
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
              }`}
            >
              {item.label}
            </div>
          ))}
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 rounded-xl bg-rose-50 p-3.5 text-xs font-semibold text-rose-800 dark:bg-rose-950/30 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Modal Body Content Area */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-5">
          {/* STEP 1: Company Info Check */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Step 1: 공급사(브랜드사) 기본 정보 확인
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                계약서에 자동으로 표기될 회사 기본 정보를 확인합니다.
              </p>

              {hasMissingCompanyInfo ? (
                <div className="rounded-xl border border-rose-250 bg-rose-50/60 p-5 dark:border-rose-900/50 dark:bg-rose-950/20 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-rose-600 dark:text-rose-400 font-bold text-lg">⚠️</span>
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-rose-900 dark:text-rose-300">
                        필수 회사 정보 누락
                      </h4>
                      <p className="text-xs text-rose-800 dark:text-rose-400">
                        계약서를 진행하려면 회사명과 회사 주소를 먼저 입력해 주세요.
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        router.push("/portal/company/info?tab=basic");
                      }}
                      className="rounded-lg bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-bold text-white transition-colors cursor-pointer"
                    >
                      회사 정보 수정
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-zinc-400 font-medium block">회사명 (공급사)</span>
                      <strong className="text-zinc-900 dark:text-zinc-100 font-bold text-sm">
                        {companyInfo.name}
                      </strong>
                    </div>
                    <div>
                      <span className="text-zinc-400 font-medium block">대표자명 (기존)</span>
                      <strong className="text-zinc-900 dark:text-zinc-100 font-bold text-sm">
                        {companyInfo.representativeName || "미입력 (다음 단계 지정)"}
                      </strong>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-zinc-400 font-medium block">회사 주소</span>
                      <strong className="text-zinc-900 dark:text-zinc-100 font-medium leading-relaxed block mt-0.5">
                        {companyInfo.address}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Signer Information */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Step 2: 계약 서명자 정보 입력
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                본 계약을 회사를 대표하여 체결하는 권한 있는 서명자의 실명과 직책을 입력해 주세요.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    서명자 성명 (Signer Name) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="예: 홍길동 (Hong Gildong)"
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    서명자 직책 (Signer Title) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={signerTitle}
                    onChange={(e) => setSignerTitle(e.target.value)}
                    placeholder="예: 대표이사 / CEO / 이사"
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    서명자 이메일 (Signer Email)
                  </label>
                  <input
                    type="email"
                    value={signerEmail}
                    onChange={(e) => setSignerEmail(e.target.value)}
                    placeholder="signer@company.com"
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[11px] text-zinc-400 mt-1">
                    로그인된 현재 계정 이메일이 자동 지정됩니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Agreement Review */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Step 3: 본 계약서 전문 검토 (v1.0)
                </h3>
                <a
                  href="/agreements/template_v1.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  📄 원본 PDF 새 창 열기 ↗
                </a>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                전자서명 전 계약서 전문(28개 조항)을 충분히 숙지해 주세요.
              </p>

              {/* Embedded PDF Viewer / Scroll Frame */}
              <div className="h-[340px] w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 overflow-hidden shadow-inner">
                <iframe
                  src="/agreements/template_v1.pdf#toolbar=0"
                  className="w-full h-full border-none"
                  title="Agreement Template Preview"
                />
              </div>
            </div>
          )}

          {/* STEP 4: Electronic Signature & Confirmation */}
          {step === 4 && (
            <div className="space-y-5">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Step 4: 전자서명 확인 및 최종 체결
              </h3>

              {/* Signature Preview Card */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/80 space-y-3">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                  ELECTRONIC SIGNATURE PREVIEW (전자서명 미리보기)
                </span>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                  <div>
                    <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 block">
                      서명 회사: {companyInfo.name}
                    </span>
                    <span className="text-xs text-zinc-600 dark:text-zinc-300 block">
                      서명자: <strong>{signerName}</strong> ({signerTitle})
                    </span>
                    <span className="text-[11px] font-mono text-zinc-400 block">
                      이메일: {signerEmail}
                    </span>
                  </div>

                  {/* Styled Typed Signature */}
                  <div className="h-16 px-6 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center min-w-[200px]">
                    <span className="text-lg font-extrabold text-indigo-800 dark:text-indigo-300 font-serif italic tracking-wide">
                      {signerName || "Electronic Signature"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Mandatory Checkboxes */}
              <div className="space-y-3 pt-2">
                <label className="flex items-start gap-3 p-3 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-850 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentAgreement}
                    onChange={(e) => setConsentAgreement(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 leading-snug">
                    [필수] 본 계약(브랜드 공급·미국 유통 및 플랫폼 이용 기본계약서 v1.0)의 모든 내용을 확인하고 이에 동의합니다.
                  </span>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-850 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={authorityConfirmed}
                    onChange={(e) => setAuthorityConfirmed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 leading-snug">
                    [필수] 본인은 {companyInfo.name} 회사를 대표하여 본 계약을 체결할 정당한 권한이 있음을 확인합니다.
                  </span>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-850 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentESignature}
                    onChange={(e) => setConsentESignature(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 leading-snug">
                    [필수] 본인은 본 전자서명을 계약 체결에 사용하는 법적 효력에 동의합니다.
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-150 dark:border-zinc-800 mt-4">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((step - 1) as any)}
              disabled={isSubmitting}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              이전 단계
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={handleNextStep}
              disabled={step === 1 && hasMissingCompanyInfo}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-xs font-bold text-white transition-colors shadow-sm cursor-pointer disabled:opacity-50"
            >
              다음 단계 →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCompleteSigning}
              disabled={isSubmitting || !consentAgreement || !authorityConfirmed || !consentESignature}
              className="rounded-xl bg-zinc-950 px-6 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 transition-colors shadow-md cursor-pointer flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white dark:text-zinc-950" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>전자서명 생성 및 저장 중...</span>
                </>
              ) : (
                "서명 확인 및 계약 완료"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
