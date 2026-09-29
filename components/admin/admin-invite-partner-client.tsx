"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  adminInviteBrandPartner,
  adminInviteRetailerPartner,
  checkDuplicateEmailAction,
  type DuplicateEmailCheckResult,
} from "@/lib/application/invitation-actions";

export function AdminInvitePartnerClient() {
  const router = useRouter();
  const [partnerType, setPartnerType] = useState<"brand" | "retailer">("brand");

  const [formData, setFormData] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    companyAddress: "",
    adminNotes: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dupResult, setDupResult] = useState<DuplicateEmailCheckResult | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === "email" && dupResult) {
      setDupResult(null);
    }
  };

  const handleEmailBlur = async () => {
    if (!formData.email.trim() || !formData.email.includes("@")) return;
    try {
      const res = await checkDuplicateEmailAction(formData.email);
      if (res.isDuplicate) {
        setDupResult(res);
      } else {
        setDupResult(null);
      }
    } catch (err) {
      console.warn("Email duplicate check error:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formData.companyName.trim()) {
      setErrorMessage("Company Name is required.");
      return;
    }
    if (!formData.contactName.trim()) {
      setErrorMessage("Primary Contact / Owner Name is required.");
      return;
    }
    if (!formData.email.trim() || !formData.email.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (dupResult?.isDuplicate) {
      setErrorMessage(dupResult.message || "이미 등록되거나 초청된 이메일입니다.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (partnerType === "brand") {
        const res = await adminInviteBrandPartner({
          companyName: formData.companyName,
          contactName: formData.contactName,
          email: formData.email,
          phone: formData.phone,
          adminNotes: formData.adminNotes,
        });

        if (res.success) {
          alert(`성공: ${formData.companyName} 파트너 초청 메일을 발송했습니다.`);
          router.push("/admin/applications");
          router.refresh();
        } else {
          setErrorMessage(res.error || "브랜드 파트너 초청 발송에 실패했습니다.");
          if (res.isDuplicate) {
            setDupResult({
              isDuplicate: true,
              message: res.error,
              details: res.details,
              type: res.duplicateType as any,
            });
          }
        }
      } else {
        const res = await adminInviteRetailerPartner({
          companyName: formData.companyName,
          contactName: formData.contactName,
          email: formData.email,
          phone: formData.phone,
          companyAddress: formData.companyAddress,
          adminNotes: formData.adminNotes,
        });

        if (res.success) {
          alert(`Success! Retailer Partner invitation sent for ${formData.companyName}.`);
          router.push("/admin/applications");
          router.refresh();
        } else {
          setErrorMessage(res.error || "Failed to send Retailer invitation.");
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred during invitation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 text-zinc-900 dark:text-white space-y-6">
      {/* Partner Type Segment Control */}
      <div className="flex rounded-xl bg-zinc-100 p-1.5 dark:bg-zinc-800/80">
        <button
          type="button"
          onClick={() => setPartnerType("brand")}
          className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all cursor-pointer ${
            partnerType === "brand"
              ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-900 dark:text-white"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          🏷️ Invite Brand Partner (브랜드 초대)
        </button>
        <button
          type="button"
          onClick={() => setPartnerType("retailer")}
          className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all cursor-pointer ${
            partnerType === "retailer"
              ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-900 dark:text-white"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          🏪 Invite Retailer Partner (리테일러 초대)
        </button>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/50 dark:border-rose-900 dark:text-rose-300 font-semibold">
            ⚠️ {errorMessage}
          </div>
        )}

        {dupResult?.isDuplicate && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm">
              <span>⚠️</span>
              <span>{dupResult.message}</span>
            </div>
            <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
              {dupResult.details}
            </p>
            {dupResult.type === "pending_invitation" && (
              <div className="pt-1">
                <Link
                  href="/admin/applications"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition-colors"
                >
                  <span>📋 기존 초청 보기 (신청서 목록 이동)</span>
                  <span>→</span>
                </Link>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-700 dark:text-zinc-300">
              Company Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="companyName"
              value={formData.companyName}
              onChange={handleChange}
              placeholder={partnerType === "brand" ? "e.g. Beauty Maker Co., Ltd." : "e.g. K-Beauty Glow Retail LLC"}
              required
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-400"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-zinc-700 dark:text-zinc-300">
              {partnerType === "brand" ? "Primary Contact Name *" : "Owner / Contact Name *"}
            </label>
            <input
              type="text"
              name="contactName"
              value={formData.contactName}
              onChange={handleChange}
              placeholder="e.g. Hong Gildong"
              required
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-400"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-zinc-700 dark:text-zinc-300">
              Email Address <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              onBlur={handleEmailBlur}
              placeholder="contact@company.com"
              required
              className={`w-full rounded-xl border bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-900 dark:bg-zinc-950 dark:text-white outline-none font-mono ${
                dupResult?.isDuplicate
                  ? "border-rose-400 focus:border-rose-500 dark:border-rose-800"
                  : "border-zinc-200 dark:border-zinc-800 focus:border-zinc-400"
              }`}
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-zinc-700 dark:text-zinc-300">
              Phone Number (Optional)
            </label>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+82 10-0000-0000 or +1 555-000-0000"
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-400 font-mono"
            />
          </div>
        </div>

        {partnerType === "retailer" && (
          <div className="space-y-1.5 pt-2">
            <label className="font-bold text-zinc-700 dark:text-zinc-300">
              Retailer Company Address (Optional)
            </label>
            <input
              type="text"
              name="companyAddress"
              value={formData.companyAddress}
              onChange={handleChange}
              placeholder="e.g. 123 Main St, Flushing, NY 11354"
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-400"
            />
            <p className="text-[11px] text-zinc-400">
              ℹ️ Note: Store Locations are managed separately during Retailer account onboarding / Retailer 360.
            </p>
          </div>
        )}

        <div className="space-y-1.5 pt-2">
          <label className="font-bold text-zinc-700 dark:text-zinc-300">
            Internal Admin Notes (Optional)
          </label>
          <textarea
            name="adminNotes"
            rows={3}
            value={formData.adminNotes}
            onChange={handleChange}
            placeholder="Pre-onboarding review notes, partner background..."
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-400"
          />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-100 dark:border-zinc-800 pt-4 mt-6">
          <button
            type="button"
            onClick={() => router.push("/admin/applications")}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || Boolean(dupResult?.isDuplicate)}
            className="px-6 py-2.5 rounded-xl text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting
              ? "Sending Invitation..."
              : partnerType === "brand"
              ? "Send Brand Invitation →"
              : "Send Retailer Invitation →"}
          </button>
        </div>
      </form>
    </div>
  );
}

