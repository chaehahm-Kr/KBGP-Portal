import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env/public";
import { serverEnv } from "@/lib/env/server";

/**
 * secret 키(구 service_role 키)로 생성되는, RLS를 완전히 우회하는 관리자 권한 클라이언트.
 *
 * 반드시 아래처럼 명확히 제한된 서버 전용 용도로만 사용한다:
 *   - 직원(내부) 계정 비활성화 시 전체 로그인 세션 즉시 무효화
 *     (10_보안과권한요구사항.md 3번: "지금 로그인되어 있어도 즉시 튕겨나감")
 *   - 초대 발송 등 사용자 본인 세션 없이 수행해야 하는 시스템 내부 작업
 *
 * 일반적인 데이터 조회·입력에는 절대 사용하지 않는다 — 그런 용도에는 항상
 * lib/supabase/server.ts (RLS가 적용되는 클라이언트)를 사용한다.
 */
import { PROTECTED_BUSINESS_EMAILS } from "@/lib/auth/password-protection";

export function createAdminClient() {
  const client = createSupabaseClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SECRET_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  // Permanent Recurrence Prevention Guard:
  // Prohibit any admin client call from mutating passwords of protected production business accounts.
  const originalUpdateUserById = client.auth.admin.updateUserById.bind(client.auth.admin);
  client.auth.admin.updateUserById = (async (uid: string, attributes: any) => {
    if (attributes && attributes.password) {
      try {
        const { data: userRes } = await client.auth.admin.getUserById(uid);
        const email = userRes?.user?.email?.toLowerCase().trim();
        if (email && (PROTECTED_BUSINESS_EMAILS as readonly string[]).includes(email)) {
          throw new Error(
            `[SECURITY RECURRENCE PREVENTION GUARD] Blocked attempt to mutate password for protected business user: ${email}. ` +
            `Automated mutations against real business accounts are strictly prohibited.`
          );
        }
      } catch (err: any) {
        if (err.message?.includes("SECURITY RECURRENCE PREVENTION GUARD")) {
          throw err;
        }
        // If getUserById failed for transient reasons, proceed to original to avoid masking
      }
    }
    return originalUpdateUserById(uid, attributes);
  }) as typeof client.auth.admin.updateUserById;

  return client;
}
