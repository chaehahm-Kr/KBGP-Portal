"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { passwordSchema, PASSWORD_RULE_DESCRIPTION } from "@/lib/auth/password";
import { completeStaffInviteAcceptance } from "@/lib/staff/actions";

/**
 * 직원 초대 수락. 흐름은 app/portal/invite/accept/page.tsx와 동일하다 — 다만
 * 직원은 handle_new_user() 트리거가 초대 발송 시점에 이미 staff_members를
 * active 상태로 만들어두므로, 여기서는 비밀번호만 설정하면 끝난다(별도 status
 * 전환이 필요 없음).
 */
export default function AdminInviteAcceptPage() {
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

    await completeStaffInviteAcceptance();
  }

  if (status !== "ready") {
    return (
      <div className="flex min-h-screen flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-4 text-center">
        <p className="text-sm text-zinc-500">
          {status === "checking"
            ? "초대 링크를 확인하는 중입니다..."
            : "초대 링크가 만료되었거나 유효하지 않습니다. Super Admin에게 재초대를 요청해주세요."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-zinc-50 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold text-zinc-900">
          직원 초대 수락 — 비밀번호 설정
        </h1>
        <p className="text-sm text-zinc-500">
          로그인에 사용할 비밀번호를 설정하면 가입이 완료됩니다.
        </p>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-zinc-700"
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
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-zinc-400">
            {PASSWORD_RULE_DESCRIPTION}
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? "처리 중..." : "가입 완료"}
        </button>
      </form>
    </div>
  );
}
