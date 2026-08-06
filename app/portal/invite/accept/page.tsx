"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { passwordSchema, PASSWORD_RULE_DESCRIPTION } from "@/lib/auth/password";
import { completeInviteAcceptance } from "@/lib/company/invite-actions";

/**
 * 초대 이메일의 링크를 클릭하면 이 페이지로 온다. 흐름은
 * app/portal/reset-password/confirm/page.tsx와 동일하다 — Supabase 브라우저
 * 클라이언트가 URL의 초대 토큰으로 세션을 만들어주면, 사용자가 비밀번호를 설정하고,
 * 서버 액션(completeInviteAcceptance)이 company_users.status를 invited -> active로 바꾼다.
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

    const handleHashAuth = async () => {
      try {
        const hash = window.location.hash;
        if (hash) {
          const params = new URLSearchParams(hash.substring(1));
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");

          if (accessToken && refreshToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (data.session) {
              setStatus("ready");
              return;
            }
            if (error) {
              console.error("Error setting session from URL hash:", error);
            }
          }
        }
      } catch (err) {
        console.error("Error parsing URL hash:", err);
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setStatus("ready");
      }
    };

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session || event === "PASSWORD_RECOVERY") {
          setStatus("ready");
        }
      }
    );

    handleHashAuth();

    const timeout = setTimeout(() => {
      setStatus((current) => (current === "checking" ? "invalid" : current));
    }, 6000);

    return () => {
      subscription.subscription.unsubscribe();
      clearTimeout(timeout);
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

  if (status !== "ready") {
    return (
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl space-y-6 text-center">
        <p className="text-sm text-zinc-400">
          {status === "checking"
            ? "초대 링크를 확인하는 중입니다..."
            : "초대 링크가 만료되었거나 유효하지 않습니다. 회사 관리자에게 재초대를 요청해주세요."}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h1 className="text-xl font-semibold text-white">
          초대 수락 — 비밀번호 설정
        </h1>
        <p className="text-xs text-zinc-400">
          로그인에 사용할 비밀번호를 설정하면 가입이 완료됩니다.
        </p>

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
          className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
        >
          {pending ? "처리 중..." : "가입 완료"}
        </button>
      </form>
    </div>
  );
}
