"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  adminInviteBrandPartner,
  adminInviteRetailerPartner,
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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
          alert(`Success! Brand Partner invitation sent for ${formData.companyName}.`);
          router.push("/admin/applications");
          router.refresh();
        } else {
          setErrorMessage(res.error || "Failed to send Brand invitation.");
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
              placeholder="contact@company.com"
              required
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-400 font-mono"
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
            disabled={isSubmitting}
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
