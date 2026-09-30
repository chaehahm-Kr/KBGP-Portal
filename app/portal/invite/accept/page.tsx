"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { passwordSchema, PASSWORD_RULE_DESCRIPTION } from "@/lib/auth/password";
import { completeInviteAcceptance } from "@/lib/company/invite-actions";

/**
 * 초대 이메일의 링크를 클릭하면 이 페이지로 온다.
 * K SELECT NETWORK 브랜드 포털 가입자 초대 수락 및 비밀번호 설정 화면
 */
export default function InviteAcceptPage() {
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">(
    "checking"
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let isMounted = true;

    const handleAuth = async () => {
      try {
        // 1. Check Query String
        const search = window.location.search;
        if (search) {
          const searchParams = new URLSearchParams(search.substring(1));
          const queryError = searchParams.get("error");
          const queryErrorCode = searchParams.get("error_code");
          const code = searchParams.get("code");

          if (queryErrorCode === "otp_expired" || queryError === "access_denied" || queryError) {
            if (isMounted) setStatus("invalid");
            return;
          }

          if (code) {
            const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            if (data.session && isMounted) {
              setStatus("ready");
              return;
            }
            if (exchangeError && isMounted) {
              console.error("[InviteAccept] exchangeCodeForSession error:", exchangeError);
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
            if (isMounted) setStatus("invalid");
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
              console.error("[InviteAccept] setSession error:", sessionError);
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
        console.error("[InviteAccept] Error parsing tokens:", err);
      }

      const timeout = setTimeout(() => {
        if (isMounted) {
          setStatus((prev) => (prev === "checking" ? "invalid" : prev));
        }
      }, 4000);

      return () => clearTimeout(timeout);
    };

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if ((session || event === "PASSWORD_RECOVERY") && isMounted) {
          setStatus("ready");
        }
      }
    );

    handleAuth();

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("입력하신 두 비밀번호가 서로 일치하지 않습니다.");
      return;
    }

    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "비밀번호를 확인해주세요.");
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
        setError("새 비밀번호는 기존 비밀번호와 달라야 합니다. 다른 비밀번호를 입력해주세요.");
      } else {
        setError("비밀번호를 설정하지 못했습니다. 초대 링크가 만료되었을 수 있습니다.");
      }
      return;
    }

    await completeInviteAcceptance();
  }

  const renderHeader = () => (
    <div className="flex flex-col items-center justify-center text-center space-y-4">
      <div className="max-w-[260px] w-full px-2">
        <img
          src="/ksn-logo-dark.png"
          alt="K SELECT NETWORK"
          className="w-full h-auto object-contain"
        />
      </div>
      <p className="text-[11px] text-zinc-400 font-medium">브랜드사 담당자 전용 로그인입니다.</p>
    </div>
  );

  if (status === "checking") {
    return (
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900/90 p-8 shadow-2xl space-y-6 backdrop-blur-sm">
        {renderHeader()}
        <div className="border-t border-zinc-800 pt-8 pb-4 text-center space-y-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          <p className="text-sm font-medium text-zinc-300">
            초대 링크 및 가입 권한을 확인하는 중입니다...
          </p>
          <p className="text-xs text-zinc-500">
            잠시만 기다려 주세요.
          </p>
        </div>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900/90 p-8 shadow-2xl space-y-6 backdrop-blur-sm">
        {renderHeader()}
        <div className="border-t border-zinc-800 pt-6 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-white">
            초청 링크가 만료되었거나 유효하지 않습니다
          </h1>
          <p className="text-xs text-zinc-400 leading-relaxed">
            초대 링크가 7일 유효기간을 초과했거나 이미 수락 처리된 링크입니다. 회사 관리자에게 초청 메일 재발송을 요청해 주세요.
          </p>
          <div className="pt-4">
            <Link
              href="/portal/login"
              className="inline-flex w-full items-center justify-center rounded-md bg-zinc-800 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-700"
            >
              로그인 화면으로 이동
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900/90 p-8 shadow-2xl space-y-6 backdrop-blur-sm">
      {renderHeader()}

      <div className="border-t border-zinc-800 pt-6">
        <h1 className="text-xl font-semibold text-white text-center">
          초대 수락 — 비밀번호 설정
        </h1>
        <p className="mt-1 text-xs text-zinc-400 text-center mb-6">
          로그인에 사용할 비밀번호를 설정하면 가입이 완료됩니다.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-zinc-300"
            >
              비밀번호
            </label>
            <div className="relative mt-1">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="block w-full rounded-md border border-zinc-300 bg-white pl-3 pr-10 py-2 text-sm text-zinc-900 outline-none transition-all focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-zinc-700"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-300 cursor-pointer"
              >
                {showPassword ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-zinc-400">
              {PASSWORD_RULE_DESCRIPTION}
            </p>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-zinc-300"
            >
              비밀번호 확인
            </label>
            <div className="relative mt-1">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="block w-full rounded-md border border-zinc-300 bg-white pl-3 pr-10 py-2 text-sm text-zinc-900 outline-none transition-all focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-zinc-700"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-300 cursor-pointer"
              >
                {showConfirmPassword ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 font-medium" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 cursor-pointer"
          >
            {pending ? "가입 처리 중..." : "가입 완료"}
          </button>
        </form>
      </div>
    </div>
  );
}
