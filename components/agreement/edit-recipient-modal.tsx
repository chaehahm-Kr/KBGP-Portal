"use client";

import React, { useState, useEffect } from "react";
import { updateAgreementAdditionalRecipientAction } from "@/lib/agreement/actions";
import type { AgreementRecipientItem } from "@/lib/agreement/types";

interface EditAgreementRecipientModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipient: AgreementRecipientItem | null;
  onSuccess: (updated: AgreementRecipientItem, resent: boolean) => void;
  locale?: "ko" | "en";
}

export function EditAgreementRecipientModal({
  isOpen,
  onClose,
  recipient,
  onSuccess,
  locale = "ko",
}: EditAgreementRecipientModalProps) {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionType, setActionType] = useState<"save_and_resend" | "save_only" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isEn = locale === "en";

  useEffect(() => {
    if (recipient) {
      setName(recipient.recipient_name || "");
      setTitle(recipient.recipient_title || "");
      setEmail(recipient.recipient_email || "");
      setError(null);
    }
  }, [recipient]);

  if (!isOpen || !recipient) return null;

  const handleSubmit = async (resendImmediately: boolean) => {
    setError(null);

    const cleanName = name.trim();
    const cleanTitle = title.trim();
    const cleanEmail = email.trim();

    if (!cleanName) {
      setError(isEn ? "Recipient name is required." : "수신자 성명을 입력해 주세요.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setError(isEn ? "Please enter a valid email address." : "올바른 이메일 주소를 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    setActionType(resendImmediately ? "save_and_resend" : "save_only");

    try {
      const res = await updateAgreementAdditionalRecipientAction({
        recipientId: recipient.id,
        name: cleanName,
        title: cleanTitle,
        email: cleanEmail,
        resendImmediately,
      });

      if (!res.success) {
        setError(res.error || (isEn ? "Failed to update recipient." : "수신자 정보 수정에 실패했습니다."));
        setSubmitting(false);
        setActionType(null);
        return;
      }

      const updatedRecord: AgreementRecipientItem = res.recipient || {
        ...recipient,
        recipient_name: cleanName,
        recipient_title: cleanTitle,
        recipient_email: cleanEmail,
        updated_at: new Date().toISOString(),
        delivery_status: resendImmediately ? (res.resent ? "sent" : "failed") : recipient.delivery_status,
      };

      if (resendImmediately && !res.resent && res.resendError) {
        alert(
          isEn
            ? `Recipient information was updated, but email resend failed: ${res.resendError}`
            : `수신자 정보는 저장되었으나 메일 재발송에 실패했습니다: ${res.resendError}`
        );
      }

      onSuccess(updatedRecord, res.resent || false);
      onClose();
    } catch (err: any) {
      setError(err.message || (isEn ? "An unexpected error occurred." : "예기치 않은 오류가 발생했습니다."));
    } finally {
      setSubmitting(false);
      setActionType(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fadeIn">
      <div
        className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 flex flex-col space-y-5"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-150 dark:border-zinc-800">
          <div>
            <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 uppercase">
              {isEn ? "Recipient Correction" : "수신자 정보 수정"}
            </span>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white mt-0.5">
              {isEn ? "Edit Additional Recipient" : "추가 수신자 정보 수정 및 재발송"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-bold p-1 cursor-pointer disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            ⚠️ {error}
          </div>
        )}

        {/* Recipient Role Note */}
        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-850 p-3 border border-zinc-150 dark:border-zinc-800 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500 font-medium text-[11px]">
              {isEn ? "Recipient Role" : "수신자 구분"}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
              <span>🔒</span>
              <span>{isEn ? "Additional Recipient (Copy)" : "추가 수신자 (사본 전달)"}</span>
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {isEn
              ? "The legal Signer of the Agreement is immutable. You can edit this additional recipient’s details and resend the executed PDF copy."
              : "계약의 법적 서명자는 수정할 수 없으며, 계약서 사본을 전달받는 추가 수신자 정보만 수정 가능합니다. 수정 후 동일한 체결 완료 PDF가 발송됩니다."}
          </p>
        </div>

        {/* Form Fields */}
        <div className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-zinc-800 dark:text-zinc-200 mb-1">
              {isEn ? "Recipient Name *" : "수신자 성명 *"}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              placeholder={isEn ? "e.g. Jane Doe" : "예: 홍길동"}
              className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-medium text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block font-semibold text-zinc-800 dark:text-zinc-200 mb-1">
              {isEn ? "Title / Position" : "직책 / 부서"}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
              placeholder={isEn ? "e.g. Operations Manager" : "예: 운영팀장"}
              className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-medium text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block font-semibold text-zinc-800 dark:text-zinc-200 mb-1">
              {isEn ? "Email Address *" : "수신 이메일 주소 *"}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              placeholder={isEn ? "e.g. ops@company.com" : "예: contact@company.com"}
              className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-medium font-mono text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Modal Actions */}
        <div className="pt-3 border-t border-zinc-150 dark:border-zinc-800 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            {isEn ? "Cancel" : "취소"}
          </button>

          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            className="px-4 py-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/50 dark:text-indigo-300 text-indigo-700 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
          >
            {submitting && actionType === "save_only" ? (isEn ? "Saving..." : "저장 중...") : (isEn ? "Save Only" : "저장만 하기")}
          </button>

          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={submitting}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <span>✉️</span>
            <span>
              {submitting && actionType === "save_and_resend"
                ? (isEn ? "Saving & Sending..." : "저장 및 재발송 중...")
                : (isEn ? "Save & Resend" : "저장 및 즉시 재발송")}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
