"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { passwordSchema, PASSWORD_RULE_DESCRIPTION } from "@/lib/auth/password";
import { completePasswordResetActivation } from "@/lib/auth/reset-password";

export default function ResetPasswordConfirmPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ready" | "invalid" | "success">("checking");
  const [invalidMessage, setInvalidMessage] = useState<string>(
    "비밀번호 재설정 링크가 만료되었거나 이미 사용되었습니다.\n보안을 위해 새로운 비밀번호 재설정 이메일을 요청해 주세요."
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

    const parseAuthParameters = async () => {
      try {
        // 1. Check Query String (Search Params)
        const search = window.location.search;
        if (search) {
          const searchParams = new URLSearchParams(search.substring(1));
          const queryError = searchParams.get("error");
          const queryErrorCode = searchParams.get("error_code");
          const queryErrorDesc = searchParams.get("error_description");
          const code = searchParams.get("code");

          if (queryErrorCode === "otp_expired" || queryError === "access_denied" || queryError) {
            if (isMounted) {
              setInvalidMessage(
                "비밀번호 재설정 링크가 만료되었거나 이미 사용되었습니다.\n보안을 위해 새로운 비밀번호 재설정 이메일을 요청해 주세요."
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
              console.error("[ResetConfirm] exchangeCodeForSession error:", exchangeError);
              setInvalidMessage(
                "인증 코드가 만료되었거나 올바르지 않습니다.\n새로운 비밀번호 재설정 링크를 요청해 주세요."
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
          const hashErrorDesc = hashParams.get("error_description");
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");

          if (hashErrorCode === "otp_expired" || hashError === "access_denied" || hashError) {
            if (isMounted) {
              setInvalidMessage(
                "비밀번호 재설정 링크가 만료되었거나 이미 사용되었습니다.\n보안을 위해 새로운 비밀번호 재설정 이메일을 요청해 주세요."
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
              console.error("[ResetConfirm] setSession error:", sessionError);
              setInvalidMessage(
                "인증 세션을 생성하지 못했습니다. 링크가 만료되었을 수 있습니다."
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
        console.error("[ResetConfirm] Error parsing auth tokens:", err);
      }

      // If no valid tokens found after initial check, give a short grace period then invalidate
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
        setError("비밀번호를 변경하지 못했습니다. 링크가 만료되었을 수 있습니다.");
      }
      return;
    }

    try {
      await completePasswordResetActivation();
    } catch (activationError) {
      console.error("Activation error during password reset:", activationError);
    }

    setPending(false);
    setStatus("success");
  }

  // 1. Checking State
  if (status === "checking") {
    return (
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900/90 p-8 shadow-2xl space-y-6 text-center backdrop-blur-sm">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-500 border-t-white" />
          <h2 className="text-base font-bold text-white">재설정 링크를 확인하는 중입니다...</h2>
          <p className="text-xs text-zinc-400">잠시만 기다려 주세요.</p>
        </div>
      </div>
    );
  }

  // 2. Expired / Invalid Link State
  if (status === "invalid") {
    return (
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900/90 p-8 shadow-2xl space-y-6 text-center backdrop-blur-sm">
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white">비밀번호 재설정 링크 만료</h2>
          <p className="text-xs text-zinc-300 whitespace-pre-line leading-relaxed">
            {invalidMessage}
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <Link
            href="/portal/reset-password"
            className="block w-full rounded-md bg-white px-4 py-2.5 text-center text-sm font-bold text-zinc-950 transition-colors hover:bg-zinc-100"
          >
            새 재설정 이메일 요청
          </Link>
          <Link
            href="/portal/login"
            className="block text-center text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
          >
            로그인으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  // 3. Success State
  if (status === "success") {
    return (
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900/90 p-8 shadow-2xl space-y-6 text-center backdrop-blur-sm">
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white">비밀번호 변경 완료</h2>
          <p className="text-xs text-zinc-300 leading-relaxed">
            비밀번호가 성공적으로 변경되었습니다.<br />새로운 비밀번호로 포털을 이용하실 수 있습니다.
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/portal"
            className="block w-full rounded-md bg-white px-4 py-2.5 text-center text-sm font-bold text-zinc-950 transition-colors hover:bg-zinc-100"
          >
            포털 시작하기
          </Link>
        </div>
      </div>
    );
  }

  // 4. Form State (status === "ready")
  return (
    <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900/90 p-8 shadow-2xl space-y-6 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-white">
            새 비밀번호 설정
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            새로운 비밀번호를 입력해 주세요.
          </p>
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-zinc-200"
          >
            새 비밀번호
          </label>
          <div className="relative mt-1">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="block w-full rounded-md border border-zinc-700 bg-zinc-950 pl-3 pr-10 py-2 text-sm text-white placeholder:text-zinc-600 outline-none transition-all focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-200 cursor-pointer"
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
          <p className="mt-1.5 text-[11px] text-zinc-400 leading-normal">
            {PASSWORD_RULE_DESCRIPTION}
          </p>
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-zinc-200"
          >
            새 비밀번호 확인
          </label>
          <div className="relative mt-1">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="••••••••"
              className="block w-full rounded-md border border-zinc-700 bg-zinc-950 pl-3 pr-10 py-2 text-sm text-white placeholder:text-zinc-600 outline-none transition-all focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-200 cursor-pointer"
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
          <div className="rounded-md bg-rose-500/10 border border-rose-500/20 p-2.5 text-xs text-rose-400 font-medium" role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-white px-4 py-2.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-zinc-100 disabled:opacity-50 cursor-pointer"
        >
          {pending ? "변경 중..." : "비밀번호 변경 완료"}
        </button>
      </form>
    </div>
  );
}
