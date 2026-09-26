"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { signCompanyAgreementAction, getSignedExecutedPdfUrlAction } from "@/lib/agreement/actions";
import type { CompanyAgreementItem, AdditionalRecipientInput } from "@/lib/agreement/types";

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

  // Additional Recipients list
  const [additionalRecipients, setAdditionalRecipients] = useState<AdditionalRecipientInput[]>([]);

  const [consentAgreement, setConsentAgreement] = useState(false);
  const [authorityConfirmed, setAuthorityConfirmed] = useState(false);
  const [consentESignature, setConsentESignature] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Success Completion State
  const [isCompleted, setIsCompleted] = useState(false);
  const [completedAgreement, setCompletedAgreement] = useState<CompanyAgreementItem | null>(null);
  const [completedRecipientCount, setCompletedRecipientCount] = useState<number>(1);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  if (!isOpen) return null;

  const hasMissingCompanyInfo = !companyInfo.name || !companyInfo.address;

  const handleAddRecipientRow = () => {
    setAdditionalRecipients((prev) => [...prev, { name: "", title: "", email: "" }]);
  };

  const handleRemoveRecipientRow = (index: number) => {
    setAdditionalRecipients((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateRecipientRow = (
    index: number,
    field: keyof AdditionalRecipientInput,
    value: string
  ) => {
    setAdditionalRecipients((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  };

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
      if (!signerEmail.trim()) {
        setErrorMessage("서명자 이메일을 입력해 주세요.");
        return;
      }

      // Validate additional recipients if any added
      for (let i = 0; i < additionalRecipients.length; i++) {
        const r = additionalRecipients[i];
        if (!r.name.trim() || !r.title.trim() || !r.email.trim()) {
          setErrorMessage(`추가 수신자 #${i + 1}의 이름, 직책, 이메일을 모두 입력해 주세요.`);
          return;
        }
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
        companyAgreementId: agreement?.id,
        companyId: companyInfo.id,
        signerName: signerName.trim(),
        signerTitle: signerTitle.trim(),
        signerEmail: signerEmail.trim() || userEmail,
        authorityConfirmed,
        consentToAgreement: consentAgreement,
        consentToESignature: consentESignature,
        additionalRecipients,
      });

      if (!res.success || !res.agreement) {
        setErrorMessage(res.error || "전자서명 저장 중 오류가 발생했습니다.");
        setIsSubmitting(false);
        return;
      }

      setCompletedAgreement(res.agreement);
      setCompletedRecipientCount(res.recipientCount || 1 + additionalRecipients.length);
      setIsCompleted(true);
      setIsSubmitting(false);
      onSuccess(res.agreement);
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "서명 처리 중 오류가 발생했습니다.");
      setIsSubmitting(false);
    }
  };

  const handleDownloadCompletedPdf = async () => {
    if (!completedAgreement) return;
    setDownloadingPdf(true);
    try {
      const res = await getSignedExecutedPdfUrlAction(
        completedAgreement.final_pdf_path || `agreements/${companyInfo.id}/${completedAgreement.agreement_id}.pdf`
      );
      if (res.url) {
        const a = document.createElement("a");
        a.href = res.url;
        a.download = `${companyInfo.name}_${completedAgreement.agreement_id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (e) {
      console.error("PDF Download Error", e);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleOpenPdfWindow = async () => {
    if (!completedAgreement) return;
    const res = await getSignedExecutedPdfUrlAction(
      completedAgreement.final_pdf_path || `agreements/${companyInfo.id}/${completedAgreement.agreement_id}.pdf`
    );
    if (res.url) {
      window.open(res.url, "_blank");
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

        {/* SUCCESS COMPLETION STATE */}
        {isCompleted && completedAgreement ? (
          <div className="py-8 px-4 text-center space-y-6 flex-1 flex flex-col justify-center items-center">
            <div className="h-16 w-16 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center text-3xl font-bold shadow-xs">
              ✓
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-zinc-900 dark:text-white">
                계약이 성공적으로 완료되었습니다.
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
                전자서명이 원본 계약서에 정식 합성되어 법적 효력을 갖춘 최종 체결본 PDF 파일이 생성되었습니다.
              </p>
            </div>

            {/* Agreement Summary Box */}
            <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-left dark:border-zinc-800 dark:bg-zinc-950 space-y-2 text-xs">
              <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                <span className="text-zinc-500 font-medium">계약 ID:</span>
                <strong className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {completedAgreement.agreement_id}
                </strong>
              </div>
              <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                <span className="text-zinc-500 font-medium">계약 버전:</span>
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                  Version {completedAgreement.version || "1.0"}
                </span>
              </div>
              <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                <span className="text-zinc-500 font-medium">체결 일자:</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {completedAgreement.effective_date}
                </span>
              </div>
              <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                <span className="text-zinc-500 font-medium">서명자:</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {completedAgreement.signer_name} ({completedAgreement.signer_title})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 font-medium">계약서 사본 수신자:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  총 {completedRecipientCount}명에게 전달 완료
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleOpenPdfWindow}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 transition-colors shadow-xs cursor-pointer"
              >
                📄 계약서 보기
              </button>

              <button
                type="button"
                onClick={handleDownloadCompletedPdf}
                disabled={downloadingPdf}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-xs font-bold text-white transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                {downloadingPdf ? "다운로드 중..." : "📥 PDF 다운로드"}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 px-5 py-2.5 text-xs font-bold text-white transition-colors cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Step Progress Bar */}
            <div className="grid grid-cols-4 gap-2 my-4">
              {[
                { s: 1, label: "1. 회사 정보" },
                { s: 2, label: "2. 서명자 및 수신자" },
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

                  {/* Clarified Notice for Step 1 Corrections */}
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/60 flex items-start gap-3">
                    <span className="text-zinc-500 dark:text-zinc-400 text-sm">💡</span>
                    <div className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed space-y-1.5 flex-1">
                      <p className="font-semibold">
                        회사 정보 또는 담당자 정보가 정확하지 않은 경우 계약 진행 전에 수정해 주세요.
                      </p>
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            window.open("/portal/company/info?tab=basic", "_blank");
                          }}
                          className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-[11px] font-bold text-zinc-800 border border-zinc-300 shadow-2xs hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer"
                        >
                          ⚙️ 회사 정보 수정 ↗
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            window.open("/portal/account", "_blank");
                          }}
                          className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-[11px] font-bold text-zinc-800 border border-zinc-300 shadow-2xs hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer"
                        >
                          👤 내 정보 수정 ↗
                        </button>
                      </div>
                    </div>
                  </div>

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

              {/* STEP 2: Signer & Additional Recipients */}
              {step === 2 && (
                <div className="space-y-5">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Step 2: 계약 서명자 및 사본 수신자 설정
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    본 계약을 회사를 대표하여 체결하는 권한 있는 서명자의 정보와 계약서 완료 사본을 공유받을 수신자를 지정합니다.
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
                        서명자 이메일 (Signer Email) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={signerEmail}
                        onChange={(e) => setSignerEmail(e.target.value)}
                        placeholder="signer@company.com"
                        className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <p className="text-[11px] text-zinc-400 mt-1">
                        체결 완료된 계약서 사본이 해당 이메일로 자동 전송됩니다.
                      </p>
                    </div>

                    {/* Additional Recipients Section */}
                    <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                            계약서 사본을 함께 받을 사람 <span className="text-zinc-400 font-normal">(선택사항)</span>
                          </h4>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            CFO, 법무팀, 임원 등 완료된 계약서 사본을 함께 수신할 추가 담당자를 추가할 수 있습니다.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleAddRecipientRow}
                          className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 dark:text-indigo-300 px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer"
                        >
                          + 수신자 추가
                        </button>
                      </div>

                      {additionalRecipients.length > 0 && (
                        <div className="space-y-3 pt-1">
                          {additionalRecipients.map((rec, idx) => (
                            <div
                              key={idx}
                              className="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/60 space-y-3"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                  추가 수신자 #{idx + 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRecipientRow(idx)}
                                  className="text-xs text-rose-600 hover:text-rose-800 dark:text-rose-400 font-bold cursor-pointer"
                                >
                                  삭제
                                </button>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                <div>
                                  <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                                    성명 <span className="text-rose-500">*</span>
                                  </label>
                                  <input
                                    type="text"
                                    value={rec.name}
                                    onChange={(e) => handleUpdateRecipientRow(idx, "name", e.target.value)}
                                    placeholder="예: 김재무"
                                    className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                                    직책 <span className="text-rose-500">*</span>
                                  </label>
                                  <input
                                    type="text"
                                    value={rec.title}
                                    onChange={(e) => handleUpdateRecipientRow(idx, "title", e.target.value)}
                                    placeholder="예: CFO / 재무이사"
                                    className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                                    이메일 <span className="text-rose-500">*</span>
                                  </label>
                                  <input
                                    type="email"
                                    value={rec.email}
                                    onChange={(e) => handleUpdateRecipientRow(idx, "email", e.target.value)}
                                    placeholder="john@company.com"
                                    className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Agreement Review & Low-Emphasis Guidance */}
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

                  {/* Low-Emphasis Informational Text at Bottom of Step 3 (Requirement 1) */}
                  <div className="pt-2 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed space-y-1">
                    <p>
                      • 계약 내용에 문의사항이 있는 경우 계약을 완료하기 전에{" "}
                      <button
                        type="button"
                        onClick={() => {
                          window.open(
                            `/portal/support?new=1&category=agreement_change&company_name=${encodeURIComponent(
                              companyInfo.name
                            )}&agreement_id=${encodeURIComponent(agreement?.agreement_id || "")}`,
                            "_blank"
                          );
                        }}
                        className="text-indigo-600 dark:text-indigo-400 underline font-semibold hover:text-indigo-800 cursor-pointer"
                      >
                        문의 지원
                      </button>{" "}
                      메뉴를 통해 문의해 주세요.
                    </p>
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                      • 계약서 내용은 전자서명 과정에서 직접 수정할 수 없습니다.
                    </p>
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
                          서명 이메일: {signerEmail}
                        </span>
                        {additionalRecipients.length > 0 && (
                          <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 block mt-1">
                            추가 사본 수신자: {additionalRecipients.length}명
                          </span>
                        )}
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
                  <div className="space-y-3 pt-1">
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
          </>
        )}
      </div>
    </div>
  );
}
