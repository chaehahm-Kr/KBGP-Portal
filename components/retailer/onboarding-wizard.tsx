"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RetailerRole } from "@/lib/retailer/onboarding-types";

interface OnboardingWizardProps {
  rawToken: string;
  invitation: {
    id: string;
    companyId: string;
    companyName: string;
    email: string;
    role: RetailerRole;
    hasAllStoresAccess: boolean;
    assignedStores: Array<{
      id: string;
      name: string;
      city?: string;
    }>;
    expiresAt: string;
  };
  onAccept: (params: {
    rawToken: string;
    name: string;
    password?: string;
    acceptedTerms: boolean;
  }) => Promise<{ success: boolean; error?: string; redirectTo?: string }>;
}

export function OnboardingWizard({
  rawToken,
  invitation,
  onAccept,
}: OnboardingWizardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const roleLabel =
    invitation.role === "owner"
      ? "Company Owner"
      : invitation.role === "buyer"
      ? "Retail Buyer"
      : invitation.role === "store_manager"
      ? "Store Manager"
      : invitation.role === "accounting"
      ? "Finance / Accounting"
      : "Store Employee";

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg("Please enter your full name.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setStep(2);
  };

  const handleStep2Submit = () => {
    setStep(3);
  };

  const handleFinalSubmit = () => {
    setErrorMsg(null);

    if (!acceptedTerms) {
      setErrorMsg("You must agree to the Operating Standards & Terms to complete activation.");
      return;
    }

    startTransition(async () => {
      const res = await onAccept({
        rawToken,
        name: name.trim(),
        password,
        acceptedTerms,
      });

      if (res.success) {
        setStep(4);
        setTimeout(() => {
          router.push(res.redirectTo || "/retailer");
        }, 2000);
      } else {
        setErrorMsg(res.error || "Failed to complete account activation.");
      }
    });
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4 sm:p-6 text-zinc-900 dark:text-zinc-100">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden">
        {/* Top Header */}
        <div className="bg-zinc-900 text-white p-6 sm:p-8 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xl font-black tracking-tight">K SELECT</span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/10 text-zinc-300">
              Retailer Onboarding
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-extrabold tracking-tight pt-2">
            Activate Your Retailer Account
          </h1>
          <p className="text-xs text-zinc-400">
            Joining <span className="text-white font-bold">{invitation.companyName}</span> as{" "}
            <span className="text-emerald-400 font-bold">{roleLabel}</span>
          </p>

          {/* Stepper Progress */}
          <div className="grid grid-cols-3 gap-2 pt-4">
            <div
              className={`h-1.5 rounded-full transition-all ${
                step >= 1 ? "bg-white" : "bg-white/20"
              }`}
            />
            <div
              className={`h-1.5 rounded-full transition-all ${
                step >= 2 ? "bg-white" : "bg-white/20"
              }`}
            />
            <div
              className={`h-1.5 rounded-full transition-all ${
                step >= 3 ? "bg-white" : "bg-white/20"
              }`}
            />
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {/* STEP 1: Account Setup */}
          {step === 1 && (
            <form onSubmit={handleStep1Submit} className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Step 1: Set Up Your Profile & Credentials
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Create your login credentials for the K SELECT Retailer Portal.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block">
                  Email Address
                </label>
                <input
                  type="email"
                  value={invitation.email}
                  disabled
                  className="w-full bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-500 dark:text-zinc-400 font-mono cursor-not-allowed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block">
                  Your Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block">
                  Create Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
                />
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs font-bold text-red-700 dark:text-red-300">
                  ⚠️ {errorMsg}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl text-xs font-black bg-zinc-900 hover:bg-black text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-colors shadow-md mt-2 cursor-pointer"
              >
                Continue to Organization Review →
              </button>
            </form>
          )}

          {/* STEP 2: Company & Store Confirmation */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Step 2: Confirm Company & Store Access
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Please review your assigned company role and authorized store locations.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/80 space-y-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Retailer Organization
                  </span>
                  <span className="text-sm font-black text-zinc-900 dark:text-white block mt-0.5">
                    {invitation.companyName}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60">
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                      Assigned Role
                    </span>
                    <span className="font-bold text-zinc-900 dark:text-white">
                      {roleLabel}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                      Store Scope
                    </span>
                    <span className="font-bold text-zinc-900 dark:text-white">
                      {invitation.hasAllStoresAccess
                        ? "All Company Stores"
                        : `${invitation.assignedStores.length} Specific Store(s)`}
                    </span>
                  </div>
                </div>

                {invitation.assignedStores.length > 0 && (
                  <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60 space-y-1.5">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                      Accessible Store Locations:
                    </span>
                    <ul className="space-y-1 pl-1">
                      {invitation.assignedStores.map((s) => (
                        <li key={s.id} className="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                          <span className="text-emerald-500 font-bold">✓</span>
                          <span>{s.name}</span>
                          {s.city && <span className="text-zinc-400 text-[10px]">({s.city})</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleStep2Submit}
                  className="flex-1 py-3 px-4 rounded-xl text-xs font-black bg-zinc-900 hover:bg-black text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-colors shadow-md cursor-pointer"
                >
                  Proceed to Agreement →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Agreement Acceptance */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Step 3: Operating Standards & Agreement
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Review and accept the K SELECT Retailer Operating Standards v1.0.
                </p>
              </div>

              <div className="h-44 overflow-y-auto p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-300 space-y-2 leading-relaxed">
                <p className="font-bold text-zinc-900 dark:text-white">
                  K SELECT Retailer Partner Operating Standards (v1.0):
                </p>
                <ol className="list-decimal pl-4 space-y-1 text-[11px]">
                  <li>
                    <strong>Weekly Count Verification:</strong> Retailer agrees to perform defensible weekly inventory checks using mobile QR scanning or shelf verification.
                  </li>
                  <li>
                    <strong>Store Price & Tag Integrity:</strong> Retailer may establish store regular and sale prices while maintaining standard common product QR links.
                  </li>
                  <li>
                    <strong>90-Day Initial Trial Protection:</strong> Eligible first-time brand assortments qualify for review when company sell-through remains below 50% over 90 days with complete reporting.
                  </li>
                  <li>
                    <strong>Account & Tenant Security:</strong> User credentials and assigned store scopes must be maintained confidentially within your company organization.
                  </li>
                </ol>
              </div>

              <label className="flex items-start gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-zinc-900 focus:ring-zinc-900"
                />
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 leading-snug">
                  I, <span className="font-bold text-zinc-950 dark:text-white">{name}</span>, agree to the K SELECT Retailer Operating Standards & Terms of Service v1.0.
                </span>
              </label>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs font-bold text-red-700 dark:text-red-300">
                  ⚠️ {errorMsg}
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  disabled={isPending || !acceptedTerms}
                  onClick={handleFinalSubmit}
                  className="flex-1 py-3 px-4 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer transition-all"
                >
                  {isPending ? "Activating Account..." : "✓ Accept & Activate Account"}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Welcome & Complete */}
          {step === 4 && (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-3xl font-black mx-auto">
                ✓
              </div>
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white">
                  Welcome to K SELECT Retailer Portal!
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Your account is active. Redirecting you to the Retailer dashboard...
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
