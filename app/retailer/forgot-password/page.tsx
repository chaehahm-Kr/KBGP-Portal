import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { RetailerForgotPasswordForm } from "@/components/auth/retailer-forgot-password-form";
import { requestRetailerPasswordReset } from "@/lib/auth/reset-password";

export const metadata: Metadata = {
  title: "Forgot Password | K SELECT HUB",
  description: "Reset your K SELECT Retailer Portal account password",
};

export default function RetailerForgotPasswordPage() {
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
            Forgot Password
          </h1>
          <p className="text-xs text-zinc-400 font-medium">
            Enter your registered email to receive password reset instructions
          </p>
        </div>
      </div>

      {/* Forgot Password Form */}
      <div className="border-t border-zinc-800/80 pt-6">
        <RetailerForgotPasswordForm action={requestRetailerPasswordReset} />
      </div>

      {/* Back to Login Footer */}
      <div className="border-t border-zinc-800/80 pt-4 text-center">
        <Link
          href="/login"
          className="text-xs font-semibold text-zinc-400 hover:text-white transition-colors inline-flex items-center gap-1.5"
        >
          <span>←</span>
          <span>Back to Sign In</span>
        </Link>
      </div>
    </div>
  );
}
