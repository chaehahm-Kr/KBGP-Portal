"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { passwordSchemaEn, PASSWORD_RULE_DESCRIPTION_EN } from "@/lib/auth/password";
import { completeRetailerPasswordResetActivation } from "@/lib/auth/reset-password";

export default function RetailerResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");
  const [invalidMessage, setInvalidMessage] = useState<string>(
    "This password reset link is invalid or has expired.\nFor security reasons, please request a new password reset email."
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let isMounted = true;

    const parseAuthParameters = async () => {
      try {
        // 1. Check Query String (Search Params)
        const search = window.location.search;
        if (search) {
          const searchParams = new URLSearchParams(search.substring(1));
          const queryError = searchParams.get("error");
          const queryErrorCode = searchParams.get("error_code");
          const code = searchParams.get("code");

          if (queryErrorCode === "otp_expired" || queryError === "access_denied" || queryError) {
            if (isMounted) {
              setInvalidMessage(
                "This password reset link has expired or has already been used.\nPlease request a new password reset email."
              );
              setStatus("invalid");
            }
            return;
          }

          if (code) {
            const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            if (data.session && isMounted) {
              setStatus("ready");
              return;
            }
            if (exchangeError && isMounted) {
              console.error("[RetailerResetPassword] exchangeCodeForSession error:", exchangeError);
              setInvalidMessage(
                "The authentication token is invalid or has expired.\nPlease request a new reset link."
              );
              setStatus("invalid");
              return;
            }
          }
        }

        // 2. Check Hash Parameters
        const hash = window.location.hash;
        if (hash) {
          const hashParams = new URLSearchParams(hash.substring(1));
          const hashError = hashParams.get("error");
          const hashErrorCode = hashParams.get("error_code");
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");

          if (hashErrorCode === "otp_expired" || hashError === "access_denied" || hashError) {
            if (isMounted) {
              setInvalidMessage(
                "This password reset link has expired or has already been used.\nPlease request a new password reset email."
              );
              setStatus("invalid");
            }
            return;
          }

          if (accessToken && refreshToken) {
            const { data, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (data.session && isMounted) {
              setStatus("ready");
              return;
            }
            if (sessionError && isMounted) {
              console.error("[RetailerResetPassword] setSession error:", sessionError);
              setInvalidMessage(
                "Unable to initialize session from reset link. It may have expired."
              );
              setStatus("invalid");
              return;
            }
          }
        }

        // 3. Check Existing Active Session
        const { data } = await supabase.auth.getSession();
        if (data.session && isMounted) {
          setStatus("ready");
          return;
        }
      } catch (err) {
        console.error("[RetailerResetPassword] Error parsing auth tokens:", err);
      }

      // Grace period before marking invalid
      const timer = setTimeout(() => {
        if (isMounted) {
          setStatus((prev) => (prev === "checking" ? "invalid" : prev));
        }
      }, 5000);

      return () => clearTimeout(timer);
    };

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if ((session || event === "PASSWORD_RECOVERY") && isMounted) {
          setStatus("ready");
        }
      }
    );

    parseAuthParameters();

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (password !== confirmPassword) {
      setError("New password and confirmation password do not match.");
      return;
    }

    const parsed = passwordSchemaEn.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? `Password must be ${PASSWORD_RULE_DESCRIPTION_EN.toLowerCase()}.`);
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setPending(false);
      const msg = updateError.message || "";
      if (
        msg.toLowerCase().includes("different") ||
        msg.toLowerCase().includes("old password") ||
        msg.toLowerCase().includes("same as")
      ) {
        setError("New password must be different from your current password.");
      } else {
        setError(msg || "Failed to update password. Please check your inputs and try again.");
      }
      return;
    }

    // Complete account activation if invited
    await completeRetailerPasswordResetActivation();

    // Sign out to enforce clean login with new credentials
    await supabase.auth.signOut();

    setPending(false);
    setSuccess(true);
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-zinc-800/80 bg-zinc-900/90 p-8 sm:p-10 shadow-2xl space-y-6 backdrop-blur-xl">
      {/* Brand Identity Header */}
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
            Reset Password
          </h1>
          <p className="text-xs text-zinc-400 font-medium">
            Create a new secure password for your Retailer account
          </p>
        </div>
      </div>

      <div className="border-t border-zinc-800/80 pt-6">
        {status === "checking" && (
          <div className="flex flex-col items-center justify-center py-8 space-y-3 text-center">
            <div className="w-8 h-8 rounded-full border-2 border-zinc-500 border-t-white animate-spin" />
            <p className="text-xs text-zinc-400">Verifying security token...</p>
          </div>
        )}

        {status === "invalid" && !success && (
          <div className="space-y-4">
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300 space-y-2">
              <div className="flex items-center gap-2 font-bold text-rose-200">
                <span>⚠️</span>
                <span>Link Expired or Invalid</span>
              </div>
              <p className="whitespace-pre-line leading-relaxed">{invalidMessage}</p>
            </div>

            <Link
              href="/forgot-password"
              className="block w-full rounded-lg bg-white px-4 py-2.5 text-center text-sm font-semibold text-zinc-950 transition-all hover:bg-zinc-100 shadow-sm"
            >
              Request New Reset Link
            </Link>
          </div>
        )}

        {success && (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-300 space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-200 text-sm">
                <span>✅</span>
                <span>Password Updated Successfully</span>
              </div>
              <p className="leading-relaxed">
                Your password has been successfully updated. You can now sign in to your Retailer Portal account using your new credentials.
              </p>
            </div>

            <Link
              href="/login"
              className="block w-full rounded-lg bg-white px-4 py-2.5 text-center text-sm font-semibold text-zinc-950 transition-all hover:bg-zinc-100 shadow-sm"
            >
              Sign In to Retailer Portal
            </Link>
          </div>
        )}

        {status === "ready" && !success && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-300"
              >
                New Password <span className="text-rose-400">*</span>
              </label>
              <div className="relative mt-1.5">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  placeholder="Enter at least 8 characters"
                  className="block w-full rounded-lg border border-zinc-700 bg-zinc-800/80 pl-3.5 pr-10 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition-all focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-400 hover:text-zinc-200 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-zinc-400">
                {PASSWORD_RULE_DESCRIPTION_EN}
              </p>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-300"
              >
                Confirm New Password <span className="text-rose-400">*</span>
              </label>
              <div className="relative mt-1.5">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  placeholder="Re-enter your new password"
                  className="block w-full rounded-lg border border-zinc-700 bg-zinc-800/80 pl-3.5 pr-10 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition-all focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-400 hover:text-zinc-200 transition-colors"
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                >
                  {showConfirmPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 font-medium" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-all hover:bg-zinc-100 disabled:opacity-50 active:scale-[0.99] shadow-sm cursor-pointer"
            >
              {pending ? "Updating Password..." : "Update Password"}
            </button>
          </form>
        )}
      </div>

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
