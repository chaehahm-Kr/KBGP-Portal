"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { passwordSchema, PASSWORD_RULE_DESCRIPTION } from "@/lib/auth/password";

/**
 * 비밀번호 재설정 이메일 링크를 클릭하면 이 페이지로 온다. Supabase의 브라우저
 * 클라이언트가 URL에 담긴 복구 토큰을 자동으로 읽어 세션을 만들어주므로(서버가 아니라
 * 브라우저에서만 가능 — 토큰이 URL 프래그먼트에 실려 오기 때문), 이 페이지는
 * 클라이언트 컴포넌트로 만들고 onAuthStateChange로 세션 생성을 기다린다.
 */
export default function ResetPasswordConfirmPage() {
  const router = useRouter();
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
    setPending(false);

    if (updateError) {
      setError("비밀번호를 변경하지 못했습니다. 링크가 만료되었을 수 있습니다.");
      return;
    }

    router.push("/portal");
  }

  if (status !== "ready") {
    return (
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl space-y-6 text-center">
        <p className="text-sm text-zinc-400">
          {status === "checking"
            ? "링크를 확인하는 중입니다..."
            : "링크가 만료되었거나 이미 사용되었습니다."}
        </p>
        {status === "invalid" && (
          <div className="border-t border-zinc-800 pt-4">
            <Link
              href="/portal/reset-password"
              className="text-xs font-semibold text-white hover:underline"
            >
              재설정 링크 다시 요청하기
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h1 className="text-xl font-semibold text-white">
          새 비밀번호 설정
        </h1>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-zinc-300"
          >
            새 비밀번호
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
          {pending ? "변경 중..." : "비밀번호 변경"}
        </button>
      </form>
    </div>
  );
}
