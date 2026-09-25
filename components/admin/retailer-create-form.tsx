"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRetailerWithInitialStoreAndOwnerAction } from "@/lib/retailer/admin-retailer-actions";
import Link from "next/link";

export function RetailerCreateForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form State
  const [companyName, setCompanyName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [country, setCountry] = useState("US");
  const [paymentTerms, setPaymentTerms] = useState("PREPAID_CARD");
  const [creditLimit, setCreditLimit] = useState(0);
  const [storeName, setStoreName] = useState("");
  const [storeCity, setStoreCity] = useState("");
  const [storeState, setStoreState] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [internalNote, setInternalNote] = useState("");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    companyId: string;
    inviteToken?: string;
  } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!companyName.trim()) {
      setErrorMessage("Company name is required.");
      return;
    }
    if (!storeName.trim()) {
      setErrorMessage("Initial store location name is required.");
      return;
    }
    if (!ownerEmail.trim()) {
      setErrorMessage("Owner email address is required.");
      return;
    }

    startTransition(async () => {
      const res = await createRetailerWithInitialStoreAndOwnerAction({
        companyName: companyName.trim(),
        businessRegistrationNumber: taxId.trim() || undefined,
        country,
        paymentTerms,
        creditLimit: Number(creditLimit) || 0,
        initialStoreName: storeName.trim(),
        initialStoreCity: storeCity.trim() || undefined,
        initialStoreState: storeState.trim() || undefined,
        initialStoreAddress: storeAddress.trim() || undefined,
        initialStorePhone: storePhone.trim() || undefined,
        ownerEmail: ownerEmail.trim(),
        ownerName: ownerName.trim() || undefined,
        internalNote: internalNote.trim() || undefined,
      });

      if (res.success && res.companyId) {
        setSuccessInfo({
          companyId: res.companyId,
          inviteToken: res.invitationResult?.rawToken,
        });
      } else {
        setErrorMessage(res.error || "Failed to create retailer organization.");
      }
    });
  };

  if (successInfo) {
    return (
      <div className="max-w-2xl mx-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm space-y-6">
        <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl font-bold mx-auto">
          ✓
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
            Retailer Successfully Onboarded
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
            The retailer organization and initial store were created. An invitation email was dispatched to{" "}
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{ownerEmail}</span>.
          </p>
        </div>

        {successInfo.inviteToken && (
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300 block">
              Direct Onboarding Link (For Testing / Manual Delivery):
            </span>
            <input
              type="text"
              readOnly
              value={`https://portal.kselecthub.com/invite/${successInfo.inviteToken}`}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 font-mono text-[11px] text-zinc-900 dark:text-white select-all"
            />
          </div>
        )}

        <div className="flex items-center justify-center gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <Link
            href={`/admin/retailers/${successInfo.companyId}`}
            className="px-5 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
          >
            View Retailer Detail →
          </Link>
          <Link
            href="/admin/retailers"
            className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Back to Retailers List
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl space-y-8">
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium">
          {errorMessage}
        </div>
      )}

      {/* Section 1: Company Profile */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-3 flex items-center gap-2">
          <span>🏢</span>
          <span>1. Retailer Company Information</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="sm:col-span-2">
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Company / Legal Entity Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Pacific Coast Beauty Supply LLC"
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value);
                if (!storeName) setStoreName(e.target.value);
              }}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Business Tax ID / Registration Number
            </label>
            <input
              type="text"
              placeholder="e.g. 95-1234567"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Country
            </label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none"
            >
              <option value="US">United States (US)</option>
              <option value="CA">Canada (CA)</option>
              <option value="KR">South Korea (KR)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Section 2: Commercial Terms */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-3 flex items-center gap-2">
          <span>💳</span>
          <span>2. Commercial & Payment Terms</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Payment Terms *
            </label>
            <select
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none"
            >
              <option value="PREPAID_CARD">Prepaid (Credit Card)</option>
              <option value="PREPAID_ACH">Prepaid (ACH / Bank Transfer)</option>
              <option value="NET_30">Net 30 Days</option>
              <option value="NET_45">Net 45 Days</option>
              <option value="NET_60">Net 60 Days</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Credit Limit ($ USD)
            </label>
            <input
              type="number"
              min="0"
              step="500"
              value={creditLimit}
              onChange={(e) => setCreditLimit(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white font-mono focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Admin Internal Notes
            </label>
            <textarea
              rows={2}
              placeholder="Internal underwriting notes, partner referral, or credit review remarks..."
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Section 3: Initial Store Location */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-3 flex items-center gap-2">
          <span>📍</span>
          <span>3. Initial Store Location</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="sm:col-span-2">
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Store Location Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Pacific Beauty Supply - Main Store"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              City
            </label>
            <input
              type="text"
              placeholder="e.g. Los Angeles"
              value={storeCity}
              onChange={(e) => setStoreCity(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              State / Province
            </label>
            <input
              type="text"
              placeholder="e.g. CA"
              value={storeState}
              onChange={(e) => setStoreState(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Street Address
            </label>
            <input
              type="text"
              placeholder="e.g. 1234 Olympic Blvd"
              value={storeAddress}
              onChange={(e) => setStoreAddress(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Section 4: Owner Invitation */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-3 flex items-center gap-2">
          <span>✉️</span>
          <span>4. Retailer Owner Invitation</span>
        </h2>

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          The owner will receive an invitation email containing a secure 7-day token to activate their account and complete the onboarding agreement.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Owner Full Name (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Sarah Jenkins"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Owner Email Address *
            </label>
            <input
              type="email"
              required
              placeholder="owner@retailer.com"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Submit Buttons */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Link
          href="/admin/retailers"
          className="px-5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all shadow-sm cursor-pointer disabled:opacity-50"
        >
          {isPending ? "Creating Retailer & Sending Invite..." : "Create Retailer & Send Invitation"}
        </button>
      </div>
    </form>
  );
}
