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
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) setStatus("ready");
      }
    );

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setStatus("ready");
    });

    const timeout = setTimeout(() => {
      setStatus((current) => (current === "checking" ? "invalid" : current));
    }, 4000);

    return () => {
      subscription.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

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
      setError("비밀번호를 설정하지 못했습니다. 초대 링크가 만료되었을 수 있습니다.");
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
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-all focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-zinc-700"
          />
          <p className="mt-1.5 text-xs text-zinc-400">
            {PASSWORD_RULE_DESCRIPTION}
          </p>
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
