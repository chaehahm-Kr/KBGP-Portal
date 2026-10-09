"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { passwordSchemaEn, PASSWORD_RULE_DESCRIPTION_EN, passwordSchema, PASSWORD_RULE_DESCRIPTION } from "@/lib/auth/password";
import { completeRetailerPasswordResetActivation } from "@/lib/auth/reset-password";
import { useTranslation } from "@/lib/i18n";

export default function RetailerResetPasswordPage() {
  const { locale } = useTranslation();
  const isKo = locale === "ko";

  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");
  const [invalidMessage, setInvalidMessage] = useState<string>(
    isKo 
      ? "비밀번호 재설정 링크가 만료되었거나 이미 사용되었습니다.\n보안을 위해 비밀번호 재설정 이메일을 다시 요청해주세요."
      : "This password reset link is invalid or has expired.\nFor security reasons, please request a new password reset email."
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
                isKo
                  ? "비밀번호 재설정 링크가 만료되었거나 이미 사용되었습니다.\n재설정 이메일을 다시 요청해주세요."
                  : "This password reset link has expired or has already been used.\nPlease request a new password reset email."
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
                isKo
                  ? "인증 토큰이 유효하지 않거나 만료되었습니다.\n새 재설정 링크를 요청해주세요."
                  : "The authentication token is invalid or has expired.\nPlease request a new reset link."
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
                isKo
                  ? "비밀번호 재설정 링크가 만료되었거나 이미 사용되었습니다.\n재설정 이메일을 다시 요청해주세요."
                  : "This password reset link has expired or has already been used.\nPlease request a new password reset email."
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
                isKo
                  ? "재설정 링크에서 세션을 초기화할 수 없습니다. 링크가 만료되었을 수 있습니다."
                  : "Unable to initialize session from reset link. It may have expired."
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
      }, 4000);

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
  }, [isKo]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (password !== confirmPassword) {
      setError(
        isKo
          ? "새 비밀번호와 비밀번호 확인이 일치하지 않습니다."
          : "New password and confirmation password do not match."
      );
      return;
    }

    const schema = isKo ? passwordSchema : passwordSchemaEn;
    const parsed = schema.safeParse(password);
    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ?? 
        (isKo ? PASSWORD_RULE_DESCRIPTION : `Password must be ${PASSWORD_RULE_DESCRIPTION_EN.toLowerCase()}.`)
      );
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
        setError(
          isKo
            ? "새 비밀번호는 이전 비밀번호와 달라야 합니다."
            : "New password must be different from your current password."
        );
      } else {
        setError(
          msg || 
          (isKo ? "비밀번호 변경에 실패했습니다. 다시 시도해주세요." : "Failed to update password. Please check your inputs and try again.")
        );
      }
      return;
    }

    // Complete account activation if invited
    await completeRetailerPasswordResetActivation();

    // Sign out to enforce clean login with new credentials
    await supabase.auth.signOut();

    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", window.location.pathname);
    }

    setPending(false);
    setSuccess(true);
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-zinc-800/80 bg-zinc-900/90 p-8 sm:p-10 shadow-2xl space-y-6 backdrop-blur-xl">
      {/* K SELECT HUB Retailer Identity Header */}
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

      <div className="border-t border-zinc-800/80 pt-6">
        {status === "checking" && (
          <div className="flex flex-col items-center justify-center py-8 space-y-3 text-center">
            <div className="w-8 h-8 rounded-full border-2 border-zinc-500 border-t-white animate-spin" />
            <p className="text-xs text-zinc-400">
              {isKo ? "보안 토큰을 확인하고 있습니다..." : "Verifying security token..."}
            </p>
          </div>
        )}

        {status === "invalid" && !success && (
          <div className="space-y-4">
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300 space-y-2">
              <div className="flex items-center gap-2 font-bold text-rose-200">
                <span>⚠️</span>
                <span>{isKo ? "링크 만료 또는 유효하지 않음" : "Link Expired or Invalid"}</span>
              </div>
              <p className="whitespace-pre-line leading-relaxed">{invalidMessage}</p>
            </div>

            <Link
              href="/forgot-password"
              className="block w-full rounded-lg bg-white px-4 py-2.5 text-center text-sm font-semibold text-zinc-950 transition-all hover:bg-zinc-100 shadow-sm"
            >
              {isKo ? "새 재설정 링크 요청" : "Request New Reset Link"}
            </Link>
          </div>
        )}

        {success && (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-300 space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-200 text-sm">
                <span>✅</span>
                <span>{isKo ? "비밀번호 변경 완료" : "Password Updated Successfully"}</span>
              </div>
              <p className="leading-relaxed">
                {isKo
                  ? "비밀번호가 성공적으로 변경되었습니다. 새 비밀번호로 리테일러 포털에 로그인해주세요."
                  : "Your password has been successfully updated. You can now sign in to your Retailer Portal account using your new credentials."}
              </p>
            </div>

            <Link
              href="/login"
              className="block w-full rounded-lg bg-white px-4 py-2.5 text-center text-sm font-semibold text-zinc-950 transition-all hover:bg-zinc-100 shadow-sm"
            >
              {isKo ? "리테일러 포털 로그인" : "Sign In to Retailer Portal"}
            </Link>
          </div>
        )}

        {status === "ready" && !success && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="pb-1">
              <h2 className="text-sm font-bold text-white">
                {isKo ? "새 비밀번호 설정" : "Set New Password"}
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                {isKo 
                  ? "계정에서 사용할 새 비밀번호를 입력해주세요."
                  : "Create a new secure password for your Retailer account"}
              </p>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-300"
              >
                {isKo ? "새 비밀번호" : "New Password"} <span className="text-rose-400">*</span>
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
                  placeholder={isKo ? "8자 이상 입력해주세요" : "Enter at least 8 characters"}
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
                {isKo ? PASSWORD_RULE_DESCRIPTION : PASSWORD_RULE_DESCRIPTION_EN}
              </p>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-300"
              >
                {isKo ? "새 비밀번호 확인" : "Confirm New Password"} <span className="text-rose-400">*</span>
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
                  placeholder={isKo ? "비밀번호를 다시 입력해주세요" : "Re-enter your new password"}
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
              {pending 
                ? (isKo ? "비밀번호 변경 중..." : "Updating Password...")
                : (isKo ? "비밀번호 변경하기" : "Update Password")}
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
          <span>{isKo ? "로그인 화면으로 돌아가기" : "Back to Sign In"}</span>
        </Link>
      </div>
    </div>
  );
}
