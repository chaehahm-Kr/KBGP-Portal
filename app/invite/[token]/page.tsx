import React from "react";
import { validateInvitationToken } from "@/lib/retailer/onboarding-actions";
import { acceptInvitationAction } from "@/app/retailer/account/team-actions";
import { OnboardingWizard } from "@/components/retailer/onboarding-wizard";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const validation = await validateInvitationToken(token);

  if (!validation.valid || !validation.invitation) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-zinc-800 bg-zinc-900/90 p-8 text-center backdrop-blur-xl shadow-2xl space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center text-2xl font-bold">
            ⚠️
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Invalid or Expired Invitation
            </h1>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
              {validation.error ||
                "This invitation link is no longer valid, has already been accepted, or has expired."}
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white transition-colors"
            >
              Return to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { invitation } = validation;

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-indigo-500/30 selection:text-indigo-200">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl px-4">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-black text-xl shadow-lg shadow-indigo-500/20 mb-3">
            K
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            K SELECT HUB
          </h2>
          <p className="text-xs text-zinc-400 font-medium tracking-wide uppercase mt-1">
            Retailer Partner Onboarding
          </p>
        </div>

        {/* Wizard Container */}
        <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/90 backdrop-blur-xl p-6 sm:p-10 shadow-2xl shadow-black/50">
          <OnboardingWizard
            rawToken={token}
            invitation={invitation}
            onAccept={acceptInvitationAction}
          />
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-zinc-500 mt-8">
          Need assistance with your onboarding? Contact{" "}
          <span className="text-zinc-400 font-medium">support@kselecthub.com</span>
        </p>
      </div>
    </div>
  );
}
