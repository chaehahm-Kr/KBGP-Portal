"use client";

import React, { useState } from "react";
import { submitPublicRetailerApplication } from "@/lib/application/retailer-public-actions";

interface RetailerApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const READINESS_CHECKLIST = [
  {
    key: "kbeauty_space",
    title: "Dedicated K-Beauty Space",
    desc: "Does your store have a dedicated or prominent display area for K-Beauty curation?",
  },
  {
    key: "staff_education",
    title: "Staff Product Education",
    desc: "Are store staff willing to participate in brand routines & product knowledge training?",
  },
  {
    key: "weekly_sync",
    title: "Weekly Inventory Sync",
    desc: "Can your team complete a simple weekly unit scan/count to enable auto-replenishment?",
  },
  {
    key: "category_mindset",
    title: "Category Partnership Mindset",
    desc: "Are you aligned with MAP pricing policies and brand protection standards?",
  },
];

export function RetailerApplicationModal({ isOpen, onClose }: RetailerApplicationModalProps) {
  const [step, setStep] = useState<"self_check" | "application_form" | "success">("self_check");
  const [readinessResponses, setReadinessResponses] = useState<Record<string, "ready" | "discuss">>({
    kbeauty_space: "ready",
    staff_education: "ready",
    weekly_sync: "ready",
    category_mindset: "ready",
  });

  const [formData, setFormData] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    streetAddress: "",
    city: "",
    state: "",
    zipCode: "",
    numberOfLocations: "1",
    comments: "",
    consentChecked: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedAppNumber, setSubmittedAppNumber] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleReadinessToggle = (key: string, val: "ready" | "discuss") => {
    setReadinessResponses((prev) => ({ ...prev, [key]: val }));
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
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
      setErrorMessage("Owner / Contact Name is required.");
      return;
    }
    if (!formData.email.trim() || !formData.email.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    if (!formData.phone.trim()) {
      setErrorMessage("Phone number is required.");
      return;
    }
    if (!formData.streetAddress.trim() || !formData.city.trim() || !formData.state.trim() || !formData.zipCode.trim()) {
      setErrorMessage("Complete address (Street, City, State, ZIP) is required.");
      return;
    }
    if (!formData.consentChecked) {
      setErrorMessage("You must agree to the partnership application privacy consent.");
      return;
    }

    setIsSubmitting(true);

    try {
      const readinessArray = READINESS_CHECKLIST.map((item) => ({
        key: item.key,
        title: item.title,
        response: readinessResponses[item.key] || "ready",
      }));

      const res = await submitPublicRetailerApplication({
        companyName: formData.companyName,
        contactName: formData.contactName,
        email: formData.email,
        phone: formData.phone,
        streetAddress: formData.streetAddress,
        city: formData.city,
        state: formData.state,
        zipCode: formData.zipCode,
        numberOfLocations: formData.numberOfLocations,
        comments: formData.comments,
        consentChecked: formData.consentChecked,
        readinessAnswers: readinessArray,
      });

      if (res.success) {
        setSubmittedAppNumber(res.applicationNumber || null);
        setStep("success");
      } else {
        setErrorMessage(res.error || "Failed to submit application.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight">K SELECT HUB</span>
              <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-bold text-zinc-600 dark:text-zinc-300">
                Retailer Partnership
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Apply to join the authorized North America K-Beauty Retailer Network.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            ✕
          </button>
        </div>

        {/* STEP 1: Launch Readiness Self-Check */}
        {step === "self_check" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                Launch Readiness Self-Check
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Review key partnership operational requirements below. Select 'Discuss' if you need guidance from our team.
              </p>
            </div>

            <div className="space-y-3">
              {READINESS_CHECKLIST.map((item) => (
                <div
                  key={item.key}
                  className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5 max-w-md">
                    <span className="font-bold text-zinc-900 dark:text-white block">{item.title}</span>
                    <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">{item.desc}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleReadinessToggle(item.key, "ready")}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                        readinessResponses[item.key] === "ready"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200"
                      }`}
                    >
                      ✓ Ready
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReadinessToggle(item.key, "discuss")}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                        readinessResponses[item.key] === "discuss"
                          ? "bg-amber-600 text-white shadow-xs"
                          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200"
                      }`}
                    >
                      💬 Discuss
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 border-t border-zinc-100 dark:border-zinc-800 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setStep("application_form")}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 transition-colors shadow-xs"
              >
                Continue to Partnership Application →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Application Form */}
        {step === "application_form" && (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/50 dark:border-rose-900 dark:text-rose-300 text-xs font-semibold">
                ⚠️ {errorMessage}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-bold text-zinc-700 dark:text-zinc-300">
                  Company Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleFormChange}
                  placeholder="e.g. Apex Beauty Group LLC"
                  required
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-400"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-zinc-700 dark:text-zinc-300">
                  Owner / Primary Contact Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="contactName"
                  value={formData.contactName}
                  onChange={handleFormChange}
                  placeholder="Full name"
                  required
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-400"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-zinc-700 dark:text-zinc-300">
                  Business Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleFormChange}
                  placeholder="owner@apexbeauty.com"
                  required
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-400 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-zinc-700 dark:text-zinc-300">
                  Phone Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleFormChange}
                  placeholder="+1 (555) 000-0000"
                  required
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-400 font-mono"
                />
              </div>
            </div>

            {/* Address fields */}
            <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <span className="font-bold text-zinc-800 dark:text-zinc-200 block">
                Company Headquarters Address
              </span>
              <div className="space-y-2">
                <input
                  type="text"
                  name="streetAddress"
                  value={formData.streetAddress}
                  onChange={handleFormChange}
                  placeholder="Street Address *"
                  required
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-400"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleFormChange}
                    placeholder="City *"
                    required
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-400"
                  />
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleFormChange}
                    placeholder="State *"
                    required
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-400"
                  />
                  <input
                    type="text"
                    name="zipCode"
                    value={formData.zipCode}
                    onChange={handleFormChange}
                    placeholder="ZIP Code *"
                    required
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-400 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1">
                <label className="font-bold text-zinc-700 dark:text-zinc-300">
                  Number of Store Locations
                </label>
                <select
                  name="numberOfLocations"
                  value={formData.numberOfLocations}
                  onChange={handleFormChange}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-400"
                >
                  <option value="1">1 Store</option>
                  <option value="2-5">2 - 5 Stores</option>
                  <option value="6-15">6 - 15 Stores</option>
                  <option value="16+">16+ Stores</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-zinc-700 dark:text-zinc-300">
                Additional Comments / Store Details (Optional)
              </label>
              <textarea
                name="comments"
                rows={3}
                value={formData.comments}
                onChange={handleFormChange}
                placeholder="Tell us briefly about your stores, customer demographics, or brands you currently carry..."
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white outline-none focus:border-zinc-400"
              />
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  name="consentChecked"
                  checked={formData.consentChecked}
                  onChange={handleFormChange}
                  className="mt-0.5 rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-0"
                />
                <span>
                  I confirm that I am an authorized representative of this retail organization and agree to the K SELECT Retailer Partnership review process.
                </span>
              </label>
            </div>

            <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 pt-4 mt-4">
              <button
                type="button"
                onClick={() => setStep("self_check")}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                ← Back to Self-Check
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 transition-colors shadow-xs disabled:opacity-50"
              >
                {isSubmitting ? "Submitting..." : "Submit Retailer Application →"}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: Success UX */}
        {step === "success" && (
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-2xl font-bold">
              ✓
            </div>
            <div>
              <h3 className="text-base font-extrabold text-zinc-900 dark:text-white">
                Application Received
              </h3>
              {submittedAppNumber && (
                <div className="mt-1">
                  <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold">
                    {submittedAppNumber}
                  </span>
                </div>
              )}
              <p className="text-xs text-zinc-600 dark:text-zinc-300 max-w-md mx-auto mt-3 leading-relaxed">
                Our K SELECT team will review your application and contact you regarding next steps.
              </p>
            </div>
            <div className="pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 transition-colors"
              >
                Close Window
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
