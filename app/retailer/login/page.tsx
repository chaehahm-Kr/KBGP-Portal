import type { Metadata } from "next";
import Image from "next/image";
import { RetailerLoginForm } from "@/components/auth/retailer-login-form";
import { loginRetailer } from "@/lib/auth/actions";

export const metadata: Metadata = {
  title: "Retailer Portal Login | K SELECT HUB",
  description: "Official B2B Retailer Portal Login",
};

export default async function RetailerLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ reason?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const isIdleLogout = resolvedParams.reason === "idle" || resolvedParams.reason === "session_expired";

  return (
    <div className="w-full max-w-md rounded-2xl border border-zinc-800/80 bg-zinc-900/90 p-8 sm:p-10 shadow-2xl space-y-6 backdrop-blur-xl">
      {/* K SELECT Hub Identity Header */}
      <div className="flex flex-col items-center justify-center text-center space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="relative w-9 h-9 rounded-lg overflow-hidden shadow-md border border-zinc-800/60 bg-black flex items-center justify-center">
            <Image
              src="/retailer-brand-mark.jpg"
              alt="K SELECT HUB"
              width={36}
              height={36}
              className="w-full h-full object-cover"
              priority
            />
          </div>
          <span className="text-lg font-bold text-white tracking-wide">
            K SELECT HUB
          </span>
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            Retailer Portal
          </h1>
          <p className="text-xs text-zinc-400 font-medium">
            Authorized wholesale buyers and store operators only
          </p>
        </div>
      </div>

      {isIdleLogout && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-300 flex items-start gap-2.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 shrink-0 text-amber-400 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <p className="font-semibold text-amber-200">Session Ended</p>
            <p className="text-amber-300/80 mt-0.5">Your session has expired. Please sign in again to continue.</p>
          </div>
        </div>
      )}

      {/* Login Form */}
      <div className="border-t border-zinc-800/80 pt-6">
        <RetailerLoginForm action={loginRetailer} />
      </div>

      {/* Footer Info */}
      <div className="border-t border-zinc-800/80 pt-4 text-center">
        <p className="text-[11px] text-zinc-500">
          Access is invitation-only. Contact your account manager for assistance.
        </p>
      </div>
    </div>
  );
}
