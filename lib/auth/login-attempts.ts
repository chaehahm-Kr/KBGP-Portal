import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_THRESHOLD = 5;

export type LockoutStatus =
  | { locked: false }
  | { locked: true; retryAfterMinutes: number };

/**
 * 10_보안과권한요구사항.md 2번: "로그인 5회 연속 실패 시 일정 시간 잠금(예: 15분) 처리".
 * login_attempts는 RLS로 완전히 잠겨 있으므로(0002 마이그레이션) 반드시 admin 클라이언트로
 * 접근한다 — 로그인 시도 자체가 아직 인증되지 않은 사람이 하는 행동이라 일반 RLS로는
 * 표현할 수 없다.
 */
export async function checkLoginLockout(email: string): Promise<LockoutStatus> {
  const supabase = createAdminClient();
  const normalizedEmail = email.trim().toLowerCase();

  const { data: recentAttempts } = await supabase
    .from("login_attempts")
    .select("succeeded, attempted_at")
    .eq("email", normalizedEmail)
    .order("attempted_at", { ascending: false })
    .limit(LOCKOUT_THRESHOLD);

  if (!recentAttempts || recentAttempts.length < LOCKOUT_THRESHOLD) {
    return { locked: false };
  }

  const now = Date.now();
  const allRecentFailures = recentAttempts.every((attempt) => {
    const attemptedAt = new Date(attempt.attempted_at).getTime();
    return !attempt.succeeded && now - attemptedAt < LOCKOUT_WINDOW_MS;
  });

  if (!allRecentFailures) {
    return { locked: false };
  }

  const mostRecentFailureAt = new Date(recentAttempts[0].attempted_at).getTime();
  const unlockAt = mostRecentFailureAt + LOCKOUT_WINDOW_MS;
  const retryAfterMinutes = Math.max(1, Math.ceil((unlockAt - now) / 60000));

  return { locked: true, retryAfterMinutes };
}

export async function recordLoginAttempt(email: string, succeeded: boolean) {
  const supabase = createAdminClient();
  await supabase.from("login_attempts").insert({
    email: email.trim().toLowerCase(),
    succeeded,
  });
}
