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
      <div className="flex min-h-screen flex-1 flex-col items-center justify-center gap-4 bg-zinc-950 px-4 text-center text-zinc-400">
        <p className="text-sm">
          {status === "checking"
            ? "초대 링크를 확인하는 중입니다..."
            : "초대 링크가 만료되었거나 유효하지 않습니다. Super Admin에게 재초대를 요청해주세요."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-zinc-950 px-4 py-12 text-zinc-100">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-8 shadow-2xl backdrop-blur-md">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-md bg-indigo-950/80 px-2.5 py-1 text-[11px] font-bold text-indigo-300 border border-indigo-800">
            <span>🛡️</span>
            <span>Letusto 내부 직원 전용 백엔드 관리 시스템</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            K SELECT NETWORK ADMIN
          </h1>
          <p className="text-xs text-zinc-400">
            관리자 계정 초대 수락 및 로그인 비밀번호를 설정합니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-bold text-zinc-300 mb-1"
            >
              새 비밀번호 (New Password) <span className="text-rose-400">*</span>
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="8자 이상, 영문+숫자 포함"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-xs text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder:text-zinc-600"
            />
            <p className="mt-1 text-[10px] text-zinc-500">
              {PASSWORD_RULE_DESCRIPTION}
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-900/50 bg-rose-950/40 p-3 text-xs font-semibold text-rose-300" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-white px-4 py-3 text-xs font-bold text-zinc-950 transition-colors hover:bg-zinc-200 disabled:opacity-50 cursor-pointer shadow-md"
          >
            {pending ? "비밀번호 설정 중..." : "관리자 계정 설정 완료"}
          </button>
        </form>
      </div>
    </div>
  );
}
