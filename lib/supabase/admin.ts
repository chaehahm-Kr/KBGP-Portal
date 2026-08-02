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
export function createAdminClient() {
  return createSupabaseClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SECRET_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
